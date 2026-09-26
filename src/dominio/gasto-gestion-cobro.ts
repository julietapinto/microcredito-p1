    import { Dinero } from "./dinero.js";

export interface ConfiguracionGastoGestion {
  readonly codigo: string;
  readonly monto: Dinero;
  readonly diasMinimos: number;
}

export interface ResultadoGastoGestion {
  readonly generado: boolean;
  readonly gasto: Dinero;
}

export class GeneradorGastoGestionCobro {
  private readonly cuotasConGasto =
    new Set<string>();

  constructor(
    private readonly configuracion:
      ConfiguracionGastoGestion
  ) {
    if (
      configuracion.codigo.trim() === "" ||
      configuracion.monto.esNegativo() ||
      configuracion.monto.esCero() ||
      !Number.isInteger(
        configuracion.diasMinimos
      ) ||
      configuracion.diasMinimos < 1
    ) {
      throw new Error(
        "La configuración del gasto de gestión es inválida"
      );
    }
  }

  generar(
    idCuota: string,
    diasAtraso: number
  ): ResultadoGastoGestion {
    if (idCuota.trim() === "") {
      throw new Error(
        "El identificador de la cuota es obligatorio"
      );
    }

    if (
      !Number.isInteger(diasAtraso) ||
      diasAtraso < 0
    ) {
      throw new Error(
        "Los días de atraso son inválidos"
      );
    }

    const cero = Dinero.cero(
      this.configuracion.monto.moneda
    );

    if (
      diasAtraso <
      this.configuracion.diasMinimos
    ) {
      return {
        generado: false,
        gasto: cero
      };
    }

    if (this.cuotasConGasto.has(idCuota)) {
      return {
        generado: false,
        gasto: cero
      };
    }

    this.cuotasConGasto.add(idCuota);

    return {
      generado: true,
      gasto: this.configuracion.monto
    };
  }

  fueGenerado(idCuota: string): boolean {
    return this.cuotasConGasto.has(idCuota);
  }
}