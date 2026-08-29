import { describe, expect, it } from "vitest";
import { Dinero } from "../src/dominio/dinero.js";

describe("Dinero", () => {
  it("redondea a dos decimales con medio hacia arriba", () => {
    const dinero = Dinero.desde("10.005");

    expect(dinero.comoTexto()).toBe("10.01");
  });

  it("mantiene los importes inmutables", () => {
    const original = Dinero.desde("10.00");
    const resultado = original.sumar(Dinero.desde("5.00"));

    expect(original.comoTexto()).toBe("10.00");
    expect(resultado.comoTexto()).toBe("15.00");
  });

  it("permite restar importes de la misma moneda", () => {
    const resultado = Dinero
      .desde("20.00")
      .restar(Dinero.desde("8.50"));

    expect(resultado.comoTexto()).toBe("11.50");
  });

  it("impide operar importes de monedas diferentes", () => {
    const quetzales = Dinero.desde("10.00", "GTQ");
    const dolares = Dinero.desde("10.00", "USD");

    expect(() => quetzales.sumar(dolares)).toThrow(
      "No se puede operar GTQ con USD"
    );
  });

  it("identifica cero y valores negativos", () => {
    expect(Dinero.cero().esCero()).toBe(true);
    expect(Dinero.desde("-1.00").esNegativo()).toBe(true);
  });
});