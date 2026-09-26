import { describe, expect, it } from "vitest";
import { Dinero } from "../src/dominio/dinero.js";
import {
  calcularDevengoInteresCorriente,
  reconocerInteresAlRegularizar
} from "../src/dominio/interes-corriente.js";

describe("Interés corriente en suspenso", () => {
  it("reconoce normalmente el interés hasta el día 90", () => {
    const resultado =
      calcularDevengoInteresCorriente(
        Dinero.desde("1.00"),
        90
      );

    expect(
      resultado.ingresoInteresCorriente.comoTexto()
    ).toBe("90.00");

    expect(
      resultado.interesEnSuspenso.comoTexto()
    ).toBe("0.00");
  });

  it("no aumenta el ingreso entre el día 90 y el día 100", () => {
    const dia90 =
      calcularDevengoInteresCorriente(
        Dinero.desde("1.00"),
        90
      );

    const dia100 =
      calcularDevengoInteresCorriente(
        Dinero.desde("1.00"),
        100
      );

    expect(
      dia100.ingresoInteresCorriente.comoTexto()
    ).toBe(
      dia90.ingresoInteresCorriente.comoTexto()
    );

    expect(
      dia100.interesEnSuspenso.comoTexto()
    ).toBe("10.00");
  });

  it("reconoce el interés suspendido al regularizar", () => {
    const regularizacion =
      reconocerInteresAlRegularizar(
        Dinero.desde("10.00")
      );

    expect(
      regularizacion.ingresoInteresCorriente
        .comoTexto()
    ).toBe("10.00");

    expect(
      regularizacion.interesEnSuspenso.comoTexto()
    ).toBe("0.00");
  });

  it("rechaza montos y días inválidos", () => {
    expect(() =>
      calcularDevengoInteresCorriente(
        Dinero.desde("-1.00"),
        100
      )
    ).toThrow();

    expect(() =>
      calcularDevengoInteresCorriente(
        Dinero.desde("1.00"),
        -1
      )
    ).toThrow();
  });
});