import { Decimal } from "decimal.js";
import {
  differenceInCalendarDays,
  isValid,
  parseISO
} from "date-fns";
import { Dinero } from "./dinero.js";

export type TramoMora =
  | "SIN_MORA"
  | "MORA_1"
  | "MORA_2"
  | "MORA_3"
  | "VENCIDO"
  | "INCOBRABLE";

export type BaseConteo = 360 | 365;

export interface ResultadoMora {
  readonly diasAtraso: number;
  readonly tramo: TramoMora;
  readonly interesMoratorio: Dinero;
  readonly interesEnSuspenso: boolean;
}

export function calcularDiasAtraso(
  fechaVencimiento: string,
  fechaCorte: string
): number {
  const vencimiento = parseISO(fechaVencimiento);
  const corte = parseISO(fechaCorte);

  if (!isValid(vencimiento) || !isValid(corte)) {
    throw new Error("Las fechas proporcionadas no son válidas");
  }

  const dias = differenceInCalendarDays(
    corte,
    vencimiento
  );

  return Math.max(0, dias);
}

export function clasificarMora(
  diasAtraso: number
): TramoMora {
  if (
    !Number.isInteger(diasAtraso) ||
    diasAtraso < 0
  ) {
    throw new Error(
      "Los días de atraso deben ser un entero no negativo"
    );
  }

  if (diasAtraso === 0) {
    return "SIN_MORA";
  }

  if (diasAtraso <= 30) {
    return "MORA_1";
  }

  if (diasAtraso <= 60) {
    return "MORA_2";
  }

  if (diasAtraso <= 90) {
    return "MORA_3";
  }

  if (diasAtraso <= 120) {
    return "VENCIDO";
  }

  return "INCOBRABLE";
}

export function calcularMora(
  capitalEnMora: Dinero,
  tasaNominalAnualMoratoria: string,
  fechaVencimiento: string,
  fechaCorte: string,
  baseConteo: BaseConteo = 360
): ResultadoMora {
  if (capitalEnMora.esNegativo()) {
    throw new Error(
      "El capital en mora no puede ser negativo"
    );
  }

  const tasaMoratoria = new Decimal(
    tasaNominalAnualMoratoria
  );

  if (tasaMoratoria.isNegative()) {
    throw new Error(
      "La tasa moratoria no puede ser negativa"
    );
  }

  const diasAtraso = calcularDiasAtraso(
    fechaVencimiento,
    fechaCorte
  );

  const tasaDiaria = tasaMoratoria.div(baseConteo);

  const interesMoratorio = capitalEnMora.multiplicar(
    tasaDiaria.times(diasAtraso)
  );

  return {
    diasAtraso,
    tramo: clasificarMora(diasAtraso),
    interesMoratorio,
    interesEnSuspenso: diasAtraso > 90
  };
}