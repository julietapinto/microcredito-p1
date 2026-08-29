import { Decimal } from "decimal.js";
import { Dinero, type Moneda } from "./dinero.js";

export interface Cuota {
  readonly numero: number;
  readonly saldoInicial: Dinero;
  readonly monto: Dinero;
  readonly interes: Dinero;
  readonly amortizacion: Dinero;
  readonly saldoFinal: Dinero;
}

export interface PlanAmortizacion {
  readonly capital: Dinero;
  readonly tasaNominalAnual: string;
  readonly plazoMeses: number;
  readonly cuotas: readonly Cuota[];
}

export interface EstrategiaAmortizacion {
  generar(
    capital: Dinero,
    tasaNominalAnual: string,
    plazoMeses: number
  ): PlanAmortizacion;
}

export class AmortizacionFrancesa
  implements EstrategiaAmortizacion {

  generar(
    capital: Dinero,
    tasaNominalAnual: string,
    plazoMeses: number
  ): PlanAmortizacion {
    this.validar(capital, tasaNominalAnual, plazoMeses);

    const tasaMensual = new Decimal(tasaNominalAnual).div(12);
    const cuotaBase = this.calcularCuota(
      capital,
      tasaMensual,
      plazoMeses
    );

    const cuotas: Cuota[] = [];
    let saldo = capital;

    for (let numero = 1; numero <= plazoMeses; numero += 1) {
      const saldoInicial = saldo;
      const interes = saldoInicial.multiplicar(tasaMensual);
      const esUltimaCuota = numero === plazoMeses;

      const amortizacion = esUltimaCuota
        ? saldoInicial
        : cuotaBase.restar(interes);

      const monto = esUltimaCuota
        ? amortizacion.sumar(interes)
        : cuotaBase;

      saldo = esUltimaCuota
        ? Dinero.cero(capital.moneda)
        : saldoInicial.restar(amortizacion);

      if (amortizacion.esNegativo() || saldo.esNegativo()) {
        throw new Error(
          "El plan produjo un saldo o amortización negativa"
        );
      }

      cuotas.push({
        numero,
        saldoInicial,
        monto,
        interes,
        amortizacion,
        saldoFinal: saldo
      });
    }

    return {
      capital,
      tasaNominalAnual,
      plazoMeses,
      cuotas
    };
  }

  private calcularCuota(
    capital: Dinero,
    tasaMensual: Decimal,
    plazoMeses: number
  ): Dinero {
    if (tasaMensual.isZero()) {
      const cuotaSinInteres = capital
        .comoDecimal()
        .div(plazoMeses);

      return Dinero.desde(
        cuotaSinInteres.toString(),
        capital.moneda
      );
    }

    const factor = tasaMensual.plus(1).pow(plazoMeses);

    const cuota = capital
      .comoDecimal()
      .times(tasaMensual.times(factor))
      .div(factor.minus(1));

    return Dinero.desde(
      cuota.toString(),
      capital.moneda
    );
  }

  private validar(
    capital: Dinero,
    tasaNominalAnual: string,
    plazoMeses: number
  ): void {
    if (capital.esCero() || capital.esNegativo()) {
      throw new Error("El capital debe ser mayor que cero");
    }

    if (!Number.isInteger(plazoMeses) || plazoMeses < 1) {
      throw new Error(
        "El plazo debe ser un número entero positivo"
      );
    }

    if (new Decimal(tasaNominalAnual).isNegative()) {
      throw new Error("La tasa no puede ser negativa");
    }
  }
}

export function sumarAmortizaciones(
  plan: PlanAmortizacion,
  moneda: Moneda = plan.capital.moneda
): Dinero {
  return plan.cuotas.reduce(
    (total, cuota) => total.sumar(cuota.amortizacion),
    Dinero.cero(moneda)
  );
}