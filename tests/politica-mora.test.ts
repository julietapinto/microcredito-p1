import { describe, expect, it } from "vitest";
import { Dinero } from "../src/dominio/dinero.js";
import { PoliticaPlana } from "../src/dominio/politica-mora/politica-plana.js";
import { PoliticaEscalonada } from "../src/dominio/politica-mora/politica-escalonada.js";

function crearPoliticaEscalonada(): PoliticaEscalonada {
  return new PoliticaEscalonada({
    codigo: "POL-2026-10",
    baseConteo: 360,
    tramos: [
      {
        nombre: "MORA_1",
        inicio: 1,
        fin: 30,
        tasaNominalAnual: "0.18"
      },
      {
        nombre: "MORA_2",
        inicio: 31,
        fin: 60,
        tasaNominalAnual: "0.24"
      },
      {
        nombre: "MORA_3",
        inicio: 61,
        fin: 90,
        tasaNominalAnual: "0.30"
      },
      {
        nombre: "VENCIDO",
        inicio: 91,
        fin: 120,
        tasaNominalAnual: "0.36"
      }
    ]
  });
}

describe("Política de mora escalonada", () => {
  it("reproduce M-1: Q5.44 a los 15 días", () => {
    const resultado =
      crearPoliticaEscalonada().calcular(
        Dinero.desde("725.76"),
        15
      );

    expect(
      resultado.interesMoratorio.comoTexto()
    ).toBe("5.44");

    expect(resultado.desglose).toHaveLength(1);
    expect(resultado.desglose[0]?.dias).toBe(15);
  });

  it("reproduce M-2: Q18.14 a los 45 días", () => {
    const resultado =
      crearPoliticaEscalonada().calcular(
        Dinero.desde("725.76"),
        45
      );

    expect(
      resultado.interesMoratorio.comoTexto()
    ).toBe("18.14");

    expect(resultado.desglose).toHaveLength(2);
    expect(resultado.desglose[0]?.dias).toBe(30);
    expect(resultado.desglose[1]?.dias).toBe(15);
  });

  it("reproduce M-3: Q50.80 a los 100 días", () => {
    const resultado =
      crearPoliticaEscalonada().calcular(
        Dinero.desde("725.76"),
        100
      );

    expect(
      resultado.interesMoratorio.comoTexto()
    ).toBe("50.80");

    expect(
      resultado.desglose.map(
        (tramo) => tramo.dias
      )
    ).toEqual([30, 30, 30, 10]);
  });

  it("reproduce M-4: Q65.32 a los 120 días", () => {
    const resultado =
      crearPoliticaEscalonada().calcular(
        Dinero.desde("725.76"),
        120
      );

    expect(
      resultado.interesMoratorio.comoTexto()
    ).toBe("65.32");
  });

  it("no aumenta el moratorio después del día 120", () => {
    const politica = crearPoliticaEscalonada();

    const dia120 = politica.calcular(
      Dinero.desde("725.76"),
      120
    );

    const dia121 = politica.calcular(
      Dinero.desde("725.76"),
      121
    );

    expect(
      dia121.interesMoratorio.comoTexto()
    ).toBe(
      dia120.interesMoratorio.comoTexto()
    );
  });
});

function crearPoliticaPlana(): PoliticaPlana {
  return new PoliticaPlana({
    codigo: "POL-2024-01",
    tasaNominalAnual: "0.24",
    baseConteo: 360
  });
}

describe("Política de mora plana", () => {
  it("conserva el resultado Q7.26 del Proyecto 1", () => {
    const resultado = crearPoliticaPlana().calcular(
      Dinero.desde("725.76"),
      15
    );

    expect(
      resultado.interesMoratorio.comoTexto()
    ).toBe("7.26");
  });

  it("calcula Q21.77 para 45 días de atraso", () => {
    const resultado = crearPoliticaPlana().calcular(
      Dinero.desde("725.76"),
      45
    );

    expect(
      resultado.interesMoratorio.comoTexto()
    ).toBe("21.77");
  });

  it("deja de aumentar después del día 120", () => {
    const politica = crearPoliticaPlana();

    const dia120 = politica.calcular(
      Dinero.desde("725.76"),
      120
    );

    const dia121 = politica.calcular(
      Dinero.desde("725.76"),
      121
    );

    expect(
      dia121.interesMoratorio.comoTexto()
    ).toBe(
      dia120.interesMoratorio.comoTexto()
    );
  });

  it("rechaza capital y días inválidos", () => {
    const politica = crearPoliticaPlana();

    expect(() =>
      politica.calcular(
        Dinero.desde("-1.00"),
        15
      )
    ).toThrow();

    expect(() =>
      politica.calcular(
        Dinero.desde("725.76"),
        -1
      )
    ).toThrow();
  });
});