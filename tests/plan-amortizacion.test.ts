import { describe, expect, it } from "vitest";
import { Dinero } from "../src/dominio/dinero.js";
import {
  AmortizacionFrancesa,
  sumarAmortizaciones
} from "../src/dominio/plan-amortizacion.js";

const filasEsperadas = [
  ["10000.00", "1004.62", "300.00", "704.62", "9295.38"],
  ["9295.38", "1004.62", "278.86", "725.76", "8569.62"],
  ["8569.62", "1004.62", "257.09", "747.53", "7822.09"],
  ["7822.09", "1004.62", "234.66", "769.96", "7052.13"],
  ["7052.13", "1004.62", "211.56", "793.06", "6259.07"],
  ["6259.07", "1004.62", "187.77", "816.85", "5442.22"],
  ["5442.22", "1004.62", "163.27", "841.35", "4600.87"],
  ["4600.87", "1004.62", "138.03", "866.59", "3734.28"],
  ["3734.28", "1004.62", "112.03", "892.59", "2841.69"],
  ["2841.69", "1004.62", "85.25", "919.37", "1922.32"],
  ["1922.32", "1004.62", "57.67", "946.95", "975.37"],
  ["975.37", "1004.63", "29.26", "975.37", "0.00"]
] as const;

describe("Plan de amortización francés", () => {
  const estrategia = new AmortizacionFrancesa();

  const plan = estrategia.generar(
    Dinero.desde("10000.00"),
    "0.36",
    12
  );

  it("genera exactamente 12 cuotas", () => {
    expect(plan.cuotas).toHaveLength(12);
  });

  it("reproduce las 12 filas del caso obligatorio", () => {
    const filasObtenidas = plan.cuotas.map((cuota) => [
      cuota.saldoInicial.comoTexto(),
      cuota.monto.comoTexto(),
      cuota.interes.comoTexto(),
      cuota.amortizacion.comoTexto(),
      cuota.saldoFinal.comoTexto()
    ]);

    expect(filasObtenidas).toEqual(filasEsperadas);
  });

  it("ajusta la última cuota a Q1,004.63", () => {
    const ultimaCuota = plan.cuotas.at(-1);

    expect(ultimaCuota?.monto.comoTexto()).toBe("1004.63");
  });

  it("suma exactamente Q10,000.00 de amortización", () => {
    expect(
      sumarAmortizaciones(plan).comoTexto()
    ).toBe("10000.00");
  });

  it("termina con saldo exactamente igual a cero", () => {
    const ultimaCuota = plan.cuotas.at(-1);

    expect(
      ultimaCuota?.saldoFinal.comoTexto()
    ).toBe("0.00");
  });

  it("maneja una tasa de cero sin dividir entre cero", () => {
    const planSinInteres = estrategia.generar(
      Dinero.desde("1200.00"),
      "0",
      12
    );

    expect(
      planSinInteres.cuotas[0]?.monto.comoTexto()
    ).toBe("100.00");

    expect(
      planSinInteres.cuotas.at(-1)?.saldoFinal.comoTexto()
    ).toBe("0.00");
  });

  it("rechaza capital, plazo o tasa inválidos", () => {
    expect(() =>
      estrategia.generar(Dinero.cero(), "0.36", 12)
    ).toThrow();

    expect(() =>
      estrategia.generar(Dinero.desde("1000"), "0.36", 0)
    ).toThrow();

    expect(() =>
      estrategia.generar(Dinero.desde("1000"), "-0.10", 12)
    ).toThrow();
  });
});