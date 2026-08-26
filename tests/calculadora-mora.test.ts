import { describe, expect, it } from "vitest";
import {
  calcularDiasAtraso,
  calcularMora,
  clasificarMora
} from "../src/dominio/calculadora-mora.js";
import { Dinero } from "../src/dominio/dinero.js";

describe("Calculadora de mora", () => {
  it("calcula exactamente 15 días de atraso", () => {
    const dias = calcularDiasAtraso(
      "2026-08-01",
      "2026-08-16"
    );

    expect(dias).toBe(15);
  });

  it("reproduce el interés moratorio obligatorio de Q7.26", () => {
    const resultado = calcularMora(
      Dinero.desde("725.76"),
      "0.24",
      "2026-08-01",
      "2026-08-16",
      360
    );

    expect(resultado.diasAtraso).toBe(15);
    expect(
      resultado.interesMoratorio.comoTexto()
    ).toBe("7.26");
  });

  it("calcula el interés únicamente sobre el capital", () => {
    const resultado = calcularMora(
      Dinero.desde("725.76"),
      "0.24",
      "2026-08-01",
      "2026-08-16"
    );

    expect(
      resultado.interesMoratorio.comoTexto()
    ).toBe("7.26");
  });

  it("clasifica correctamente todos los tramos", () => {
    expect(clasificarMora(0)).toBe("SIN_MORA");
    expect(clasificarMora(1)).toBe("MORA_1");
    expect(clasificarMora(30)).toBe("MORA_1");
    expect(clasificarMora(31)).toBe("MORA_2");
    expect(clasificarMora(60)).toBe("MORA_2");
    expect(clasificarMora(61)).toBe("MORA_3");
    expect(clasificarMora(90)).toBe("MORA_3");
    expect(clasificarMora(91)).toBe("VENCIDO");
    expect(clasificarMora(120)).toBe("VENCIDO");
    expect(clasificarMora(121)).toBe("INCOBRABLE");
  });

  it("suspende el interés corriente después de 90 días", () => {
    const resultado = calcularMora(
      Dinero.desde("1000.00"),
      "0.24",
      "2026-01-01",
      "2026-04-02"
    );

    expect(resultado.diasAtraso).toBe(91);
    expect(resultado.interesEnSuspenso).toBe(true);
    expect(resultado.tramo).toBe("VENCIDO");
  });

  it("no genera atraso si la fecha de corte es anterior", () => {
    const dias = calcularDiasAtraso(
      "2026-08-16",
      "2026-08-01"
    );

    expect(dias).toBe(0);
  });

  it("rechaza días, fechas y tasas inválidas", () => {
    expect(() => clasificarMora(-1)).toThrow();

    expect(() =>
      calcularDiasAtraso("fecha-invalida", "2026-08-01")
    ).toThrow();

    expect(() =>
      calcularMora(
        Dinero.desde("100"),
        "-0.24",
        "2026-08-01",
        "2026-08-16"
      )
    ).toThrow();
  });
});