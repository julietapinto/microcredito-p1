import {
  describe,
  expect,
  it
} from "vitest";

import {
  AdaptadorAsistenteMemoria
} from "../src/mcp/adaptador-asistente-memoria.js";
  
import {
  crearDatosDemostracion
} from "../src/mcp/datos-asistente-memoria.js";

describe(
  "Adaptador MCP en memoria",
  () => {
    it(
      "consulta un crédito usando la fecha de corte",
      async () => {
        const adaptador =
          new AdaptadorAsistenteMemoria(
            crearDatosDemostracion()
          );

        const resultado =
          await adaptador.consultarCredito(
            "CV-2026-0043",
            "2026-10-31"
          );

        expect(resultado).toMatchObject({
          idCredito: "CV-2026-0043",
          estado: "EN_MORA",
          saldo: {
            monto: "1500.00",
            moneda: "GTQ"
          },
          diasAtraso: 45,
          tramo: "MORA_2",
          cuotasPagadas: 3,
          cuotasVencidas: 1,
          proximaCuota: {
            numero: 5,
            fechaVencimiento:
              "2026-11-15",
            monto: {
              monto: "370.00",
              moneda: "GTQ"
            }
          }
        });
      }
    );

    it(
      "filtra los créditos en mora por tramo",
      async () => {
        const adaptador =
          new AdaptadorAsistenteMemoria(
            crearDatosDemostracion()
          );

        const resultado =
          await adaptador
            .listarCreditosEnMora(
              "2026-10-31",
              "MORA_2"
            );

        expect(resultado).toMatchObject({
          fechaCorte: "2026-10-31",
          filtroTramo: "MORA_2",
          totalCreditos: 1
        });

        expect(resultado.creditos).toEqual([
          {
            idCredito: "CV-2026-0043",
            diasAtraso: 45,
            tramo: "MORA_2",
            saldo: {
              monto: "1500.00",
              moneda: "GTQ"
            }
          }
        ]);
      }
    );

    it(
      "calcula los próximos vencimientos",
      async () => {
        const adaptador =
          new AdaptadorAsistenteMemoria(
            crearDatosDemostracion()
          );

        const resultado =
          await adaptador
            .verProximosVencimientos(
              "2026-10-31",
              20
            );

        expect(resultado.totalCuotas).toBe(2);

        expect(resultado.montoTotal).toEqual({
          monto: "900.00",
          moneda: "GTQ"
        });

        expect(resultado.cuotas).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              idCredito: "CV-2026-0043",
              numeroCuota: 5,
              fechaVencimiento:
                "2026-11-15"
            }),
            expect.objectContaining({
              idCredito: "CV-2026-0044",
              numeroCuota: 1,
              fechaVencimiento:
                "2026-11-10"
            })
          ])
        );
      }
    );

    it(
      "rechaza consultar un crédito inexistente",
      async () => {
        const adaptador =
          new AdaptadorAsistenteMemoria(
            crearDatosDemostracion()
          );

        await expect(
          adaptador.consultarCredito(
            "NO-EXISTE",
            "2026-10-31"
          )
        ).rejects.toThrow(
          "No existe el crédito NO-EXISTE"
        );
      }
    );
    it("calcula la deuda de una cuota vencida", async () => {
  const adaptador =
    new AdaptadorAsistenteMemoria(
      crearDatosDemostracion()
    );

  const resultado =
    await adaptador.calcularDeudaCuota(
      "CV-2026-0043",
      4,
      "2026-10-31"
    );

  expect(resultado).toEqual({
    idCredito: "CV-2026-0043",
    numeroCuota: 4,
    fechaCorte: "2026-10-31",
    gastos: {
      monto: "25.00",
      moneda: "GTQ"
    },
    interesMoratorio: {
      monto: "28.75",
      moneda: "GTQ"
    },
    interesCorriente: {
      monto: "25.00",
      moneda: "GTQ"
    },
    capital: {
      monto: "1150.00",
      moneda: "GTQ"
    },
    totalExigible: {
      monto: "1228.75",
      moneda: "GTQ"
    }
  });
});

it("explica la mora por tramos recorridos", async () => {
  const adaptador =
    new AdaptadorAsistenteMemoria(
      crearDatosDemostracion()
    );

  const resultado =
    await adaptador.explicarMora(
      "CV-2026-0043",
      "2026-10-31"
    );

  expect(resultado).toEqual({
    idCredito: "CV-2026-0043",
    fechaCorte: "2026-10-31",
    capitalEnMora: {
      monto: "1150.00",
      moneda: "GTQ"
    },
    tramosRecorridos: [
      {
        tramo: "MORA_1",
        dias: 30,
        tasaNominalAnual: "0.18",
        interesGenerado: {
          monto: "17.25",
          moneda: "GTQ"
        }
      },
      {
        tramo: "MORA_2",
        dias: 15,
        tasaNominalAnual: "0.24",
        interesGenerado: {
          monto: "11.50",
          moneda: "GTQ"
        }
      }
    ],
    interesMoratorioTotal: {
      monto: "28.75",
      moneda: "GTQ"
    }
    
  });
  
});
it("consulta el resumen de cartera en una fecha de corte", async () => {
  const adaptador =
    new AdaptadorAsistenteMemoria(
      crearDatosDemostracion()
    );

  const resultado =
    await adaptador.consultarCartera(
      "2026-10-31"
    );

  expect(resultado).toMatchObject({
    fechaCorte: "2026-10-31",
    carteraActiva: {
      monto: "2500.00",
      moneda: "GTQ"
    },
    carteraEnMora: {
      monto: "1500.00",
      moneda: "GTQ"
    },
    carteraEnRiesgo: {
      monto: "1500.00",
      moneda: "GTQ"
    },
    porcentajeEnRiesgo: "0.6000",
    incobrableDelPeriodo: {
      monto: "800.00",
      moneda: "GTQ"
    }
  });

  expect(
    resultado.desglosePorTramo.find(
      (tramo) => tramo.tramo === "MORA_2"
    )
  ).toEqual({
    tramo: "MORA_2",
    cantidadCreditos: 1,
    capital: {
      monto: "1500.00",
      moneda: "GTQ"
    }
  });
});
  it("consulta el cierre mensual", async () => {
    const adaptador =
      new AdaptadorAsistenteMemoria(
        crearDatosDemostracion()
      );

    const resultado =
      await adaptador.consultarCierre(
        "MENSUAL",
        "2026-10-31"
      );

    expect(resultado).toMatchObject({
      tipo: "MENSUAL",
      fechaCorte: "2026-10-31",
      periodoDesde: "2026-10-01",
      periodoHasta: "2026-10-31",
      desembolsos: {
        monto: "2500.00",
        moneda: "GTQ"
      },
      recuperaciones: {
        total: {
          monto: "0.00",
          moneda: "GTQ"
        }
      }
    });
  });
});