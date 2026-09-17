import { Dinero } from "./dinero.js";

export interface ResultadoDevengoInteres {
  readonly ingresoInteresCorriente: Dinero;
  readonly interesEnSuspenso: Dinero;
}

export function calcularDevengoInteresCorriente(
  interesCorrienteDiario: Dinero,
  diasAtraso: number
): ResultadoDevengoInteres {
  if (interesCorrienteDiario.esNegativo()) {
    throw new Error(
      "El interés corriente diario no puede ser negativo"
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

  const diasReconocidos = Math.min(
    diasAtraso,
    90
  );

  const diasEnSuspenso = Math.max(
    0,
    diasAtraso - 90
  );

  return {
    ingresoInteresCorriente:
      interesCorrienteDiario.multiplicar(
        diasReconocidos
      ),
    interesEnSuspenso:
      interesCorrienteDiario.multiplicar(
        diasEnSuspenso
      )
  };
}

export function reconocerInteresAlRegularizar(
  interesEnSuspenso: Dinero
): ResultadoDevengoInteres {
  if (interesEnSuspenso.esNegativo()) {
    throw new Error(
      "El interés en suspenso no puede ser negativo"
    );
  }

  return {
    ingresoInteresCorriente:
      interesEnSuspenso,
    interesEnSuspenso: Dinero.cero(
      interesEnSuspenso.moneda
    )
  };
}