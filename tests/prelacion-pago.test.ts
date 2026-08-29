import { describe, expect, it } from "vitest";
import { Dinero } from "../src/dominio/dinero.js";
import {
  aplicarPrelacion,
  type ObligacionesPago
} from "../src/dominio/prelacion-pago.js";

const deuda: ObligacionesPago = {
  gastos: Dinero.desde("0.00"),
  interesMoratorio: Dinero.desde("7.26"),
  interesCorriente: Dinero.desde("278.86"),
  capital: Dinero.desde("725.76")
};

describe("Prelación de pagos", () => {
  it("aplica correctamente el pago exacto de Q1,011.88", () => {
    const resultado = aplicarPrelacion(
      Dinero.desde("1011.88"),
      deuda
    );

    expect(resultado.gastos.comoTexto()).toBe("0.00");
    expect(
      resultado.interesMoratorio.comoTexto()
    ).toBe("7.26");
    expect(
      resultado.interesCorriente.comoTexto()
    ).toBe("278.86");
    expect(resultado.capital.comoTexto()).toBe("725.76");
    expect(resultado.excedente.comoTexto()).toBe("0.00");
  });

  it("aplica correctamente el pago parcial de Q500.00", () => {
    const resultado = aplicarPrelacion(
      Dinero.desde("500.00"),
      deuda
    );

    expect(
      resultado.interesMoratorio.comoTexto()
    ).toBe("7.26");
    expect(
      resultado.interesCorriente.comoTexto()
    ).toBe("278.86");
    expect(resultado.capital.comoTexto()).toBe("213.88");
    expect(resultado.excedente.comoTexto()).toBe("0.00");
  });

  it("conserva el excedente de un pago de Q3,000.00", () => {
    const resultado = aplicarPrelacion(
      Dinero.desde("3000.00"),
      deuda
    );

    expect(resultado.excedente.comoTexto()).toBe(
      "1988.12"
    );
  });

  it("respeta gastos antes de los demás conceptos", () => {
    const deudaConGastos: ObligacionesPago = {
      gastos: Dinero.desde("50.00"),
      interesMoratorio: Dinero.desde("20.00"),
      interesCorriente: Dinero.desde("100.00"),
      capital: Dinero.desde("500.00")
    };

    const resultado = aplicarPrelacion(
      Dinero.desde("60.00"),
      deudaConGastos
    );

    expect(resultado.gastos.comoTexto()).toBe("50.00");

    expect(
      resultado.interesMoratorio.comoTexto()
    ).toBe("10.00");

    expect(
      resultado.interesCorriente.comoTexto()
    ).toBe("0.00");

    expect(resultado.capital.comoTexto()).toBe("0.00");
  });

  it("rechaza pagos iguales o menores que cero", () => {
    expect(() =>
      aplicarPrelacion(Dinero.cero(), deuda)
    ).toThrow("El pago debe ser mayor que cero");

    expect(() =>
      aplicarPrelacion(Dinero.desde("-10"), deuda)
    ).toThrow("El pago debe ser mayor que cero");
  });
});