import { describe, expect, it } from "vitest";
import { Credito } from "../src/dominio/estados-credito.js";

describe("Ciclo de vida del crédito", () => {
  it("baja de Mora 2 a Mora 1", () => {
    const credito = new Credito(
      "C-001",
      "EN_MORA",
      45
    );

    expect(
      credito.obtenerSituacion().tramo
    ).toBe("MORA_2");

    credito.registrarPago(10);

    expect(credito.obtenerSituacion()).toEqual({
      estado: "EN_MORA",
      diasAtraso: 10,
      tramo: "MORA_1"
    });
  });

  it("regulariza de mora a vigente", () => {
    const credito = new Credito(
      "C-001",
      "EN_MORA",
      45
    );

    credito.registrarPago(0);

    expect(
      credito.obtenerSituacion().estado
    ).toBe("VIGENTE");

    expect(
      credito.obtenerSituacion().tramo
    ).toBe("SIN_MORA");
  });

  it("cancela al pagar la última cuota", () => {
    const credito = new Credito(
      "C-001",
      "VIGENTE"
    );

    credito.registrarPago(0, true);

    expect(
      credito.obtenerSituacion().estado
    ).toBe("CANCELADO");
  });

  it("pasa de vigente a mora por atraso", () => {
    const credito = new Credito(
      "C-001",
      "VIGENTE"
    );

    credito.actualizarPorCorte(31);

    expect(credito.obtenerSituacion()).toEqual({
      estado: "EN_MORA",
      diasAtraso: 31,
      tramo: "MORA_2"
    });
  });

  it("declara incobrable después de 120 días", () => {
    const credito = new Credito(
      "C-001",
      "EN_MORA",
      120
    );

    credito.actualizarPorCorte(121);

    expect(
      credito.obtenerSituacion().estado
    ).toBe("INCOBRABLE");
  });

  it("rechaza pagar un crédito solicitado", () => {
    const credito = new Credito(
      "C-001",
      "SOLICITADO"
    );

    expect(() =>
      credito.registrarPago(0)
    ).toThrow(
      "El crédito en estado SOLICITADO no puede recibir pagos"
    );
  });

  it("rechaza pagar créditos terminales", () => {
    const cancelado = new Credito(
      "C-001",
      "CANCELADO"
    );

    const rechazado = new Credito(
      "C-002",
      "RECHAZADO"
    );

    expect(() =>
      cancelado.registrarPago(0)
    ).toThrow();

    expect(() =>
      rechazado.registrarPago(0)
    ).toThrow();
  });
});