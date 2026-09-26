import { describe, expect, it } from "vitest";
import { Dinero } from "../src/dominio/dinero.js";
import type { PoliticaMora } from "../src/dominio/politica-mora/politica-mora.js";
import { PoliticaPlana } from "../src/dominio/politica-mora/politica-plana.js";
import {
  PoliticaEscalonada,
  type ConfiguracionTramoMora
} from "../src/dominio/politica-mora/politica-escalonada.js";
import { PoliticaRetroactiva } from "../src/dominio/politica-mora/politica-retroactiva.js";

const tramos: readonly ConfiguracionTramoMora[] = [
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
];

const politicaPlana = new PoliticaPlana({
  codigo: "PLANA_24",
  tasaNominalAnual: "0.24",
  baseConteo: 360
});

const politicaEscalonada = new PoliticaEscalonada({
  codigo: "ESCALONADA",
  baseConteo: 360,
  tramos
});

const politicaRetroactiva = new PoliticaRetroactiva({
  codigo: "RETROACTIVA",
  baseConteo: 360,
  tramos
});

const politicas: readonly PoliticaMora[] = [
  politicaPlana,
  politicaEscalonada,
  politicaRetroactiva
];

describe.each(
  politicas.map((politica) => [
    politica.codigo,
    politica
  ] as const)
)(
  "Contrato común de PoliticaMora: %s",
  (_codigo, politica) => {
    it("devuelve cero cuando no existen días de atraso", () => {
      const resultado = politica.calcular(
        Dinero.desde("725.76"),
        0
      );

      expect(
        resultado.interesMoratorio.comoTexto()
      ).toBe("0.00");

      expect(resultado.desglose).toEqual([]);
    });

    it("devuelve un resultado no negativo y con la misma moneda", () => {
      const capital = Dinero.desde(
        "725.76",
        "GTQ"
      );

      const resultado = politica.calcular(
        capital,
        45
      );

      expect(
        resultado.interesMoratorio.esNegativo()
      ).toBe(false);

      expect(
        resultado.interesMoratorio.moneda
      ).toBe("GTQ");
    });

    it("nunca permite que la mora exceda el capital", () => {
      const capital = Dinero.desde("725.76");

      const resultado = politica.calcular(
        capital,
        120
      );

      expect(
        resultado.interesMoratorio
          .comoDecimal()
          .lessThanOrEqualTo(
            capital.comoDecimal()
          )
      ).toBe(true);
    });

    it("rechaza días de atraso inválidos", () => {
      expect(() =>
        politica.calcular(
          Dinero.desde("725.76"),
          -1
        )
      ).toThrow();
    });
  }
);

describe("Invariantes de políticas moratorias", () => {
  it("la política escalonada es monótona entre los días 1 y 120", () => {
    const capital = Dinero.desde("725.76");
    let resultadoAnterior =
      Dinero.cero().comoDecimal();

    for (let dia = 1; dia <= 120; dia += 1) {
      const resultadoActual =
        politicaEscalonada
          .calcular(capital, dia)
          .interesMoratorio
          .comoDecimal();

      expect(
        resultadoActual.greaterThanOrEqualTo(
          resultadoAnterior
        )
      ).toBe(true);

      resultadoAnterior = resultadoActual;
    }
  });

  it("la mora escalonada nunca supera la retroactiva", () => {
    const capital = Dinero.desde("725.76");

    for (let dia = 1; dia <= 120; dia += 1) {
      const escalonada =
        politicaEscalonada
          .calcular(capital, dia)
          .interesMoratorio
          .comoDecimal();

      const retroactiva =
        politicaRetroactiva
          .calcular(capital, dia)
          .interesMoratorio
          .comoDecimal();

      expect(
        escalonada.lessThanOrEqualTo(
          retroactiva
        )
      ).toBe(true);
    }
  });

  it("la política escalonada equivale a una plana del 18% durante Mora 1", () => {
    const capital = Dinero.desde("725.76");

    const planaMora1 = new PoliticaPlana({
      codigo: "PLANA_18",
      tasaNominalAnual: "0.18",
      baseConteo: 360
    });

    for (let dia = 1; dia <= 30; dia += 1) {
      const escalonada =
        politicaEscalonada.calcular(
          capital,
          dia
        );

      const plana =
        planaMora1.calcular(
          capital,
          dia
        );

      expect(
        escalonada.interesMoratorio.comoTexto()
      ).toBe(
        plana.interesMoratorio.comoTexto()
      );
    }
  });

  it("ninguna política aumenta la mora después del día 120", () => {
    const capital = Dinero.desde("725.76");

    for (const politica of politicas) {
      const dia120 = politica
        .calcular(capital, 120)
        .interesMoratorio
        .comoTexto();

      const dia121 = politica
        .calcular(capital, 121)
        .interesMoratorio
        .comoTexto();

      expect(dia121).toBe(dia120);
    }
  });
});