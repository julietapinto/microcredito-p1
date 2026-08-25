import { Decimal } from "decimal.js";

Decimal.set({
  precision: 40,
  rounding: Decimal.ROUND_HALF_UP
});

export type Moneda = "GTQ" | "USD";

export class Dinero {
  private readonly valor: Decimal;

  private constructor(valor: Decimal, readonly moneda: Moneda) {
    if (!valor.isFinite()) {
      throw new Error("El importe debe ser finito");
    }

    this.valor = valor.toDecimalPlaces(
      2,
      Decimal.ROUND_HALF_UP
    );
  }

  static desde(valor: string, moneda: Moneda = "GTQ"): Dinero {
    return new Dinero(new Decimal(valor), moneda);
  }

  static cero(moneda: Moneda = "GTQ"): Dinero {
    return Dinero.desde("0", moneda);
  }

  sumar(otro: Dinero): Dinero {
    this.validarMoneda(otro);
    return new Dinero(this.valor.plus(otro.valor), this.moneda);
  }

  restar(otro: Dinero): Dinero {
    this.validarMoneda(otro);
    return new Dinero(this.valor.minus(otro.valor), this.moneda);
  }

  multiplicar(factor: Decimal.Value): Dinero {
    return new Dinero(
      this.valor.times(new Decimal(factor)),
      this.moneda
    );
  }

  menorQue(otro: Dinero): boolean {
    this.validarMoneda(otro);
    return this.valor.lessThan(otro.valor);
  }

  menorOIgualQue(otro: Dinero): boolean {
    this.validarMoneda(otro);
    return this.valor.lessThanOrEqualTo(otro.valor);
  }

  esIgualA(otro: Dinero): boolean {
    return (
      this.moneda === otro.moneda &&
      this.valor.equals(otro.valor)
    );
  }

  esCero(): boolean {
    return this.valor.isZero();
  }

  esNegativo(): boolean {
    return this.valor.isNegative();
  }

  comoDecimal(): Decimal {
    return new Decimal(this.valor);
  }

  comoTexto(): string {
    return this.valor.toFixed(2);
  }

  private validarMoneda(otro: Dinero): void {
    if (this.moneda !== otro.moneda) {
      throw new Error(
        `No se puede operar ${this.moneda} con ${otro.moneda}`
      );
    }
  }
}