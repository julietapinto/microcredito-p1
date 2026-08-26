import { describe, expect, it } from "vitest";
import {
  calcularCarteraRiesgo,
  type CreditoCartera
} from "../src/dominio/cartera.js";
import { Dinero } from "../src/dominio/dinero.js";

function crearCredito(
  id: string,
  saldo: string,
  diasAtraso: number,
  reestructurado = false,
  incobrable = false
): CreditoCartera {
  return {
    id,
    saldoCapital: Dinero.desde(saldo),
    diasAtraso,
    reestructurado,
    incobrable
  };
}

const carteraReferencia: CreditoCartera[] = [
  crearCredito("C-001", "620000.00", 0),
  crearCredito("C-002", "124000.00", 8),
  crearCredito("C-003", "24000.00", 45),
  crearCredito("C-004", "18000.00", 75),
  crearCredito("C-005", "8000.00", 100),
  crearCredito("C-006", "6000.00", 0, true),
  crearCredito("C-007", "15000.00", 210, false, true)
];

describe("Cartera en riesgo", () => {
  it("reproduce exactamente el 7.00% obligatorio", () => {
    const resultado = calcularCarteraRiesgo(
      carteraReferencia
    );

    expect(
      resultado.carteraActiva.comoTexto()
    ).toBe("800000.00");

    expect(
      resultado.capitalEnRiesgo.comoTexto()
    ).toBe("56000.00");

    expect(resultado.porcentaje).toBe("0.0700");

    expect(resultado.creditosEnRiesgo).toEqual([
      "C-003",
      "C-004",
      "C-005",
      "C-006"
    ]);
  });

  it("reproduce 6.06% al declarar incobrable C-005", () => {
    const carteraModificada = carteraReferencia.map(
      (credito): CreditoCartera =>
        credito.id === "C-005"
          ? {
              ...credito,
              incobrable: true
            }
          : credito
    );

    const resultado = calcularCarteraRiesgo(
      carteraModificada
    );

    expect(
      resultado.carteraActiva.comoTexto()
    ).toBe("792000.00");

    expect(
      resultado.capitalEnRiesgo.comoTexto()
    ).toBe("48000.00");

    expect(resultado.porcentaje).toBe("0.0606");
  });

  it("incluye un crédito reestructurado aunque esté al día", () => {
    const resultado = calcularCarteraRiesgo([
      crearCredito("C-001", "10000.00", 0),
      crearCredito("C-002", "2000.00", 0, true)
    ]);

    expect(
      resultado.capitalEnRiesgo.comoTexto()
    ).toBe("2000.00");

    expect(resultado.creditosEnRiesgo).toEqual([
      "C-002"
    ]);
  });

  it("excluye créditos con exactamente 30 días", () => {
    const resultado = calcularCarteraRiesgo([
      crearCredito("C-001", "10000.00", 30)
    ]);

    expect(
      resultado.capitalEnRiesgo.comoTexto()
    ).toBe("0.00");
  });

  it("maneja correctamente una cartera vacía", () => {
    const resultado = calcularCarteraRiesgo([]);

    expect(
      resultado.carteraActiva.comoTexto()
    ).toBe("0.00");

    expect(resultado.porcentaje).toBe("0.0000");
  });

  it("rechaza saldos y días de atraso inválidos", () => {
    expect(() =>
      calcularCarteraRiesgo([
        crearCredito("C-001", "-100.00", 0)
      ])
    ).toThrow();

    expect(() =>
      calcularCarteraRiesgo([
        crearCredito("C-001", "100.00", -1)
      ])
    ).toThrow();
  });
});