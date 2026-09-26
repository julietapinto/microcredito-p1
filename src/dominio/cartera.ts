import { Decimal } from "decimal.js";
import {
  Dinero,
  type Moneda
} from "./dinero.js";

export interface CreditoCartera {
  readonly id: string;
  readonly saldoCapital: Dinero;
  readonly diasAtraso: number;
  readonly reestructurado: boolean;
  readonly incobrable: boolean;
}

export type TramoCarteraRiesgo =
  | "MORA_1"
  | "MORA_2"
  | "MORA_3"
  | "VENCIDO"
  | "REESTRUCTURADO_AL_DIA";

export interface DesgloseCarteraRiesgo {
  readonly tramo: TramoCarteraRiesgo;
  readonly saldoCapital: Dinero;
  readonly porcentaje: string;
  readonly creditos: readonly string[];
}

export interface ResultadoCarteraRiesgo {
  readonly carteraActiva: Dinero;
  readonly capitalEnRiesgo: Dinero;
  readonly porcentaje: string;
  readonly creditosEnRiesgo: readonly string[];
  readonly desglosePorTramo:
    readonly DesgloseCarteraRiesgo[];
}

const TRAMOS: readonly TramoCarteraRiesgo[] = [
  "MORA_1",
  "MORA_2",
  "MORA_3",
  "VENCIDO",
  "REESTRUCTURADO_AL_DIA"
];

export function calcularCarteraRiesgo(
  creditos: readonly CreditoCartera[]
): ResultadoCarteraRiesgo {
  const moneda: Moneda =
    creditos[0]?.saldoCapital.moneda ?? "GTQ";

  let carteraActiva = Dinero.cero(moneda);
  let capitalEnRiesgo = Dinero.cero(moneda);

  const creditosEnRiesgo: string[] = [];

  const saldosPorTramo:
    Record<TramoCarteraRiesgo, Dinero> = {
      MORA_1: Dinero.cero(moneda),
      MORA_2: Dinero.cero(moneda),
      MORA_3: Dinero.cero(moneda),
      VENCIDO: Dinero.cero(moneda),
      REESTRUCTURADO_AL_DIA:
        Dinero.cero(moneda)
    };

  const creditosPorTramo:
    Record<TramoCarteraRiesgo, string[]> = {
      MORA_1: [],
      MORA_2: [],
      MORA_3: [],
      VENCIDO: [],
      REESTRUCTURADO_AL_DIA: []
    };

  for (const credito of creditos) {
    validarCredito(credito, moneda);

    // Un crédito incobrable ya salió de la cartera activa.
    if (credito.incobrable) {
      continue;
    }

    carteraActiva = carteraActiva.sumar(
      credito.saldoCapital
    );

    const tramo = obtenerTramoRiesgo(credito);

    if (tramo !== undefined) {
      capitalEnRiesgo = capitalEnRiesgo.sumar(
        credito.saldoCapital
      );

      creditosEnRiesgo.push(credito.id);

      saldosPorTramo[tramo] =
        saldosPorTramo[tramo].sumar(
          credito.saldoCapital
        );

      creditosPorTramo[tramo].push(
        credito.id
      );
    }
  }

  const porcentaje = calcularPorcentaje(
    capitalEnRiesgo,
    carteraActiva
  );

  const desglosePorTramo =
    TRAMOS.map(
      (tramo): DesgloseCarteraRiesgo => ({
        tramo,
        saldoCapital: saldosPorTramo[tramo],
        porcentaje: calcularPorcentaje(
          saldosPorTramo[tramo],
          carteraActiva
        ),
        creditos: [
          ...creditosPorTramo[tramo]
        ]
      })
    );

  return {
    carteraActiva,
    capitalEnRiesgo,
    porcentaje,
    creditosEnRiesgo,
    desglosePorTramo
  };
}

function obtenerTramoRiesgo(
  credito: CreditoCartera
): TramoCarteraRiesgo | undefined {
  if (
    credito.reestructurado &&
    credito.diasAtraso <= 30
  ) {
    return "REESTRUCTURADO_AL_DIA";
  }

  if (
    credito.diasAtraso >= 31 &&
    credito.diasAtraso <= 60
  ) {
    return "MORA_2";
  }

  if (
    credito.diasAtraso >= 61 &&
    credito.diasAtraso <= 90
  ) {
    return "MORA_3";
  }

  if (
    credito.diasAtraso >= 91 &&
    credito.diasAtraso <= 120
  ) {
    return "VENCIDO";
  }

  // Mora 1 ordinaria no forma parte de cartera en riesgo.
  return undefined;
}

function calcularPorcentaje(
  parte: Dinero,
  total: Dinero
): string {
  const porcentaje = total.esCero()
    ? new Decimal(0)
    : parte
        .comoDecimal()
        .div(total.comoDecimal());

  if (
    porcentaje.lessThan(0) ||
    porcentaje.greaterThan(1)
  ) {
    throw new Error(
      "El porcentaje de cartera está fuera del rango permitido"
    );
  }

  return porcentaje
    .toDecimalPlaces(
      4,
      Decimal.ROUND_HALF_UP
    )
    .toFixed(4);
}

function validarCredito(
  credito: CreditoCartera,
  moneda: Moneda
): void {
  if (credito.id.trim() === "") {
    throw new Error(
      "El identificador del crédito es obligatorio"
    );
  }

  if (credito.saldoCapital.moneda !== moneda) {
    throw new Error(
      "Todos los créditos deben utilizar la misma moneda"
    );
  }

  if (credito.saldoCapital.esNegativo()) {
    throw new Error(
      "El saldo de capital no puede ser negativo"
    );
  }

  if (
    !Number.isInteger(credito.diasAtraso) ||
    credito.diasAtraso < 0
  ) {
    throw new Error(
      "Los días de atraso son inválidos"
    );
  }
}