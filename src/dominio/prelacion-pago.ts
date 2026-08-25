import { Dinero } from "./dinero.js";

export interface ObligacionesPago {
  readonly gastos: Dinero;
  readonly interesMoratorio: Dinero;
  readonly interesCorriente: Dinero;
  readonly capital: Dinero;
}

export interface AplicacionPago
  extends ObligacionesPago {
  readonly excedente: Dinero;
}

type ConceptoPago = keyof ObligacionesPago;

class EslabonPrelacion {
  constructor(
    private readonly concepto: ConceptoPago,
    private readonly siguiente?: EslabonPrelacion
  ) {}

  aplicar(
    disponible: Dinero,
    deuda: ObligacionesPago,
    aplicado: Record<ConceptoPago, Dinero>
  ): Dinero {
    const montoAdeudado = deuda[this.concepto];

    const montoAplicado = disponible.menorQue(
      montoAdeudado
    )
      ? disponible
      : montoAdeudado;

    aplicado[this.concepto] = montoAplicado;

    const remanente = disponible.restar(
      montoAplicado
    );

    if (this.siguiente) {
      return this.siguiente.aplicar(
        remanente,
        deuda,
        aplicado
      );
    }

    return remanente;
  }
}

export function aplicarPrelacion(
  pago: Dinero,
  deuda: ObligacionesPago
): AplicacionPago {
  if (pago.esCero() || pago.esNegativo()) {
    throw new Error(
      "El pago debe ser mayor que cero"
    );
  }

  const cero = Dinero.cero(pago.moneda);

  const aplicado: Record<ConceptoPago, Dinero> = {
    gastos: cero,
    interesMoratorio: cero,
    interesCorriente: cero,
    capital: cero
  };

  const cadena = new EslabonPrelacion(
    "gastos",
    new EslabonPrelacion(
      "interesMoratorio",
      new EslabonPrelacion(
        "interesCorriente",
        new EslabonPrelacion("capital")
      )
    )
  );

  const excedente = cadena.aplicar(
    pago,
    deuda,
    aplicado
  );

  return {
    ...aplicado,
    excedente
  };
}