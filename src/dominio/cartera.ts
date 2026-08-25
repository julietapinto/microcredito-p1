import { Decimal } from "decimal.js";
import { Dinero, type Moneda } from "./dinero.js";

export interface CreditoCartera {
  readonly id: string;
  readonly saldoCapital: Dinero;
  readonly diasAtraso: number;
  readonly reestructurado: boolean;
  readonly incobrable: boolean;
}

export interface ResultadoCarteraRiesgo {
  readonly carteraActiva: Dinero;
  readonly capitalEnRiesgo: Dinero;
  readonly porcentaje: string;
  readonly creditosEnRiesgo: readonly string[];
}

export function calcularCarteraRiesgo(
  creditos: readonly CreditoCartera[]
): ResultadoCarteraRiesgo {
  const moneda: Moneda =
    creditos[0]?.saldoCapital.moneda ?? "GTQ";

  let carteraActiva = Dinero.cero(moneda);
  let capitalEnRiesgo = Dinero.cero(moneda);

  const creditosEnRiesgo: string[] = [];

  for (const credito of creditos) {
    validarCredito(credito, moneda);

    // Un crédito incobrable ya salió de la cartera activa.
    if (credito.incobrable) {
      continue;
    }

    carteraActiva = carteraActiva.sumar(
      credito.saldoCapital
    );

    const estaEnRiesgo =
      credito.diasAtraso > 30 ||
      credito.reestructurado;

    if (estaEnRiesgo) {
      capitalEnRiesgo = capitalEnRiesgo.sumar(
        credito.saldoCapital
      );

      creditosEnRiesgo.push(credito.id);
    }
  }

  const porcentaje = carteraActiva.esCero()
    ? new Decimal(0)
    : capitalEnRiesgo
        .comoDecimal()
        .div(carteraActiva.comoDecimal());

  if (
    porcentaje.lessThan(0) ||
    porcentaje.greaterThan(1)
  ) {
    throw new Error(
      "El porcentaje de cartera está fuera del rango permitido"
    );
  }

  return {
    carteraActiva,
    capitalEnRiesgo,
    porcentaje: porcentaje
      .toDecimalPlaces(4, Decimal.ROUND_HALF_UP)
      .toFixed(4),
    creditosEnRiesgo
  };
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