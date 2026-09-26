import type { Dinero } from "../dinero.js";

export interface DesgloseMora {
  readonly tramo: string;
  readonly dias: number;
  readonly tasaNominalAnual: string;
  readonly interesSinRedondear: string;
}

export interface ResultadoPoliticaMora {
  readonly interesMoratorio: Dinero;
  readonly desglose: readonly DesgloseMora[];
}

export interface PoliticaMora {
  readonly codigo: string;

  calcular(
    capitalEnMora: Dinero,
    diasAtraso: number
  ): ResultadoPoliticaMora;
}

export function validarCalculoMora(
  capitalEnMora: Dinero,
  diasAtraso: number
): void {
  if (capitalEnMora.esNegativo()) {
    throw new Error(
      "El capital en mora no puede ser negativo"
    );
  }

  if (
    !Number.isInteger(diasAtraso) ||
    diasAtraso < 0
  ) {
    throw new Error(
      "Los días de atraso deben ser un entero no negativo"
    );
  }
}