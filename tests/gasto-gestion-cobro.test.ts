import { describe, expect, it } from "vitest";
import { Dinero } from "../src/dominio/dinero.js";
import { GeneradorGastoGestionCobro } from "../src/dominio/gasto-gestion-cobro.js";

function crearGenerador():
  GeneradorGastoGestionCobro {
  return new GeneradorGastoGestionCobro({
    codigo: "GGC-2026-01",
    monto: Dinero.desde("25.00"),
    diasMinimos: 31
  });
}

describe("Gasto de gestión de cobro", () => {
  it("no genera gasto durante Mora 1", () => {
    const resultado = crearGenerador().generar(
      "CUOTA-002",
      30
    );

    expect(resultado.generado).toBe(false);
    expect(resultado.gasto.comoTexto()).toBe(
      "0.00"
    );
  });

  it("genera Q25.00 al alcanzar 31 días", () => {
    const resultado = crearGenerador().generar(
      "CUOTA-002",
      31
    );

    expect(resultado.generado).toBe(true);
    expect(resultado.gasto.comoTexto()).toBe(
      "25.00"
    );
  });

  it("no duplica el gasto al repetir el cierre", () => {
    const generador = crearGenerador();

    const primerCierre = generador.generar(
      "CUOTA-002",
      31
    );

    const segundoCierre = generador.generar(
      "CUOTA-002",
      31
    );

    expect(primerCierre.generado).toBe(true);
    expect(segundoCierre.generado).toBe(false);

    expect(
      segundoCierre.gasto.comoTexto()
    ).toBe("0.00");
  });

  it("no genera otro gasto al cambiar de tramo", () => {
    const generador = crearGenerador();

    generador.generar("CUOTA-002", 31);

    const mora3 = generador.generar(
      "CUOTA-002",
      75
    );

    const vencido = generador.generar(
      "CUOTA-002",
      100
    );

    expect(mora3.generado).toBe(false);
    expect(vencido.generado).toBe(false);
  });

  it("reproduce M-5: total adeudado Q1,047.76", () => {
    const gasto = crearGenerador().generar(
      "CUOTA-002",
      45
    ).gasto;

    const total = gasto
      .sumar(Dinero.desde("18.14"))
      .sumar(Dinero.desde("278.86"))
      .sumar(Dinero.desde("725.76"));

    expect(total.comoTexto()).toBe("1047.76");
  });
});