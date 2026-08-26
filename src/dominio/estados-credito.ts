import {
  clasificarMora,
  type TramoMora
} from "./calculadora-mora.js";

export type NombreEstadoCredito =
  | "SOLICITADO"
  | "APROBADO"
  | "RECHAZADO"
  | "ANULADO"
  | "VIGENTE"
  | "EN_MORA"
  | "REESTRUCTURADO"
  | "CANCELADO"
  | "INCOBRABLE";

export interface SituacionCredito {
  readonly estado: NombreEstadoCredito;
  readonly diasAtraso: number;
  readonly tramo: TramoMora;
}

interface EstadoCredito {
  readonly nombre: NombreEstadoCredito;

  registrarPago(
    diasAtrasoRestantes: number,
    saldoEsCero: boolean
  ): EstadoCredito;

  actualizarPorCorte(
    diasAtraso: number
  ): EstadoCredito;
}

abstract class EstadoBase implements EstadoCredito {
  abstract readonly nombre: NombreEstadoCredito;

  registrarPago(
    _diasAtrasoRestantes: number,
    _saldoEsCero: boolean
  ): EstadoCredito {
    throw new Error(
      `El crédito en estado ${this.nombre} no puede recibir pagos`
    );
  }

  actualizarPorCorte(
    _diasAtraso: number
  ): EstadoCredito {
    throw new Error(
      `El crédito en estado ${this.nombre} no admite actualización de mora`
    );
  }
}

class EstadoSolicitado extends EstadoBase {
  readonly nombre = "SOLICITADO" as const;
}

class EstadoAprobado extends EstadoBase {
  readonly nombre = "APROBADO" as const;
}

class EstadoRechazado extends EstadoBase {
  readonly nombre = "RECHAZADO" as const;
}

class EstadoAnulado extends EstadoBase {
  readonly nombre = "ANULADO" as const;
}

class EstadoCancelado extends EstadoBase {
  readonly nombre = "CANCELADO" as const;
}

class EstadoIncobrable extends EstadoBase {
  readonly nombre = "INCOBRABLE" as const;
}

class EstadoVigente extends EstadoBase {
  readonly nombre = "VIGENTE" as const;

  override registrarPago(
    diasAtrasoRestantes: number,
    saldoEsCero: boolean
  ): EstadoCredito {
    validarDias(diasAtrasoRestantes);

    if (saldoEsCero) {
      return new EstadoCancelado();
    }

    if (diasAtrasoRestantes > 0) {
      return new EstadoEnMora();
    }

    return new EstadoVigente();
  }

  override actualizarPorCorte(
    diasAtraso: number
  ): EstadoCredito {
    validarDias(diasAtraso);

    if (diasAtraso > 120) {
      return new EstadoIncobrable();
    }

    if (diasAtraso > 0) {
      return new EstadoEnMora();
    }

    return new EstadoVigente();
  }
}

class EstadoEnMora extends EstadoBase {
  readonly nombre = "EN_MORA" as const;

  override registrarPago(
    diasAtrasoRestantes: number,
    saldoEsCero: boolean
  ): EstadoCredito {
    validarDias(diasAtrasoRestantes);

    if (saldoEsCero) {
      return new EstadoCancelado();
    }

    if (diasAtrasoRestantes === 0) {
      return new EstadoVigente();
    }

    return new EstadoEnMora();
  }

  override actualizarPorCorte(
    diasAtraso: number
  ): EstadoCredito {
    validarDias(diasAtraso);

    if (diasAtraso > 120) {
      return new EstadoIncobrable();
    }

    if (diasAtraso === 0) {
      return new EstadoVigente();
    }

    return new EstadoEnMora();
  }
}

class EstadoReestructurado extends EstadoBase {
  readonly nombre = "REESTRUCTURADO" as const;

  override registrarPago(
    diasAtrasoRestantes: number,
    saldoEsCero: boolean
  ): EstadoCredito {
    validarDias(diasAtrasoRestantes);

    if (saldoEsCero) {
      return new EstadoCancelado();
    }

    if (diasAtrasoRestantes > 0) {
      return new EstadoEnMora();
    }

    return new EstadoVigente();
  }

  override actualizarPorCorte(
    diasAtraso: number
  ): EstadoCredito {
    validarDias(diasAtraso);

    if (diasAtraso > 120) {
      return new EstadoIncobrable();
    }

    if (diasAtraso > 0) {
      return new EstadoEnMora();
    }

    return new EstadoReestructurado();
  }
}

export class Credito {
  private estadoActual: EstadoCredito;
  private diasAtrasoActuales: number;

  constructor(
    readonly id: string,
    estadoInicial: NombreEstadoCredito,
    diasAtrasoIniciales = 0
  ) {
    if (id.trim() === "") {
      throw new Error(
        "El identificador del crédito es obligatorio"
      );
    }

    validarDias(diasAtrasoIniciales);

    this.estadoActual = crearEstado(estadoInicial);
    this.diasAtrasoActuales = diasAtrasoIniciales;
  }

  registrarPago(
    diasAtrasoRestantes: number,
    saldoEsCero = false
  ): void {
    this.estadoActual =
      this.estadoActual.registrarPago(
        diasAtrasoRestantes,
        saldoEsCero
      );

    this.diasAtrasoActuales = saldoEsCero
      ? 0
      : diasAtrasoRestantes;
  }

  actualizarPorCorte(diasAtraso: number): void {
    this.estadoActual =
      this.estadoActual.actualizarPorCorte(
        diasAtraso
      );

    this.diasAtrasoActuales = diasAtraso;
  }

  obtenerSituacion(): SituacionCredito {
    return {
      estado: this.estadoActual.nombre,
      diasAtraso: this.diasAtrasoActuales,
      tramo: clasificarMora(
        this.diasAtrasoActuales
      )
    };
  }
}

function crearEstado(
  nombre: NombreEstadoCredito
): EstadoCredito {
  const estados: Record<
    NombreEstadoCredito,
    () => EstadoCredito
  > = {
    SOLICITADO: () => new EstadoSolicitado(),
    APROBADO: () => new EstadoAprobado(),
    RECHAZADO: () => new EstadoRechazado(),
    ANULADO: () => new EstadoAnulado(),
    VIGENTE: () => new EstadoVigente(),
    EN_MORA: () => new EstadoEnMora(),
    REESTRUCTURADO: () =>
      new EstadoReestructurado(),
    CANCELADO: () => new EstadoCancelado(),
    INCOBRABLE: () => new EstadoIncobrable()
  };

  return estados[nombre]();
}

function validarDias(diasAtraso: number): void {
  if (
    !Number.isInteger(diasAtraso) ||
    diasAtraso < 0
  ) {
    throw new Error(
      "Los días de atraso son inválidos"
    );
  }
}