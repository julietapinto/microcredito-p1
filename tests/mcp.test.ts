import {
  Client,
  InMemoryTransport
} from "@modelcontextprotocol/client";

import {
  describe,
  expect,
  it
} from "vitest";

import {
  crearServidorMcp
} from "../src/mcp/crear-servidor.js";

import type {
  PuertoAsistente
} from "../src/mcp/puerto-asistente.js";

describe("Servidor MCP", () => {
  it("consulta un crédito mediante el puerto de aplicación", async () => {
    let fechaRecibida = "";

    const puerto: Partial<PuertoAsistente> = {
      async consultarCredito(idCredito, fechaCorte) {
        fechaRecibida = fechaCorte;

        return {
          idCredito,
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
            fechaVencimiento: "2026-11-15",
            monto: {
              monto: "350.00",
              moneda: "GTQ"
            }
          }
        };
      }
    };

    const servidor = crearServidorMcp(puerto);

    const cliente = new Client({
      name: "cliente-pruebas",
      version: "1.0.0"
    });

    const [
      transporteCliente,
      transporteServidor
    ] = InMemoryTransport.createLinkedPair();

    await Promise.all([
      cliente.connect(transporteCliente),
      servidor.connect(transporteServidor)
    ]);

    try {
      const herramientas = await cliente.listTools();
          const nombresHerramientas =
        herramientas.tools
          .map(
            (herramienta: { name: string }) =>
              herramienta.name
          )
          .sort();

      expect(nombresHerramientas).toEqual(
        [
          "consultar_credito",
          "calcular_deuda_cuota",
          "explicar_mora",
          "listar_creditos_en_mora",
          "ver_proximos_vencimientos",
          "consultar_cartera",
          "consultar_cierre",
          "registrar_pago"
        ].sort()
      );

      const herramientasLectura =
        herramientas.tools.filter(
          (herramienta: {
            name: string;
            annotations?: unknown;
          }) =>
            herramienta.name !==
            "registrar_pago"
        );

      expect(
        herramientasLectura
      ).toHaveLength(7);

      for (
        const herramienta of herramientasLectura
      ) {
        expect(
          herramienta.annotations
        ).toMatchObject({
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false
        });
      }

      const herramientaRegistro =
        herramientas.tools.find(
          (herramienta: {
            name: string;
            annotations?: unknown;
          }) =>
            herramienta.name ===
            "registrar_pago"
        );

      expect(
        herramientaRegistro?.annotations
      ).toMatchObject({
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false
      });

      const respuesta = await cliente.callTool({
        name: "consultar_credito",
        arguments: {
          idCredito: "CV-2026-0043",
          fechaCorte: "2026-10-31"
        }
      });

      const contenido = respuesta.content[0];

      if (contenido?.type !== "text") {
        throw new Error(
          "La herramienta no devolvió contenido de texto"
        );
      }

      const resultado = JSON.parse(contenido.text);

      expect(resultado).toMatchObject({
        idCredito: "CV-2026-0043",
        estado: "EN_MORA",
        diasAtraso: 45,
        tramo: "MORA_2"
      });

      expect(fechaRecibida).toBe("2026-10-31");
      expect(respuesta.isError).not.toBe(true);
    } finally {
      await cliente.close();
      await servidor.close();
    }
  });
  it("no registra un pago sin aprobación humana", async () => {
  let llamadasRegistro = 0;

  const puerto: Partial<PuertoAsistente> = {
    async registrarPago(solicitud) {
      llamadasRegistro++;

      return {
        idPago: "PAGO-001",
        idCredito: solicitud.idCredito,
        fechaCorte: solicitud.fechaCorte,
        monto: solicitud.monto,
        claveIdempotencia:
          solicitud.claveIdempotencia,
        reutilizado: false,
        aplicacion: {
          gastos: {
            monto: "0.00",
            moneda: "GTQ"
          },
          interesMoratorio: {
            monto: "0.00",
            moneda: "GTQ"
          },
          interesCorriente: {
            monto: "0.00",
            moneda: "GTQ"
          },
          capital: solicitud.monto
        },
        estadoCredito: "VIGENTE"
      };
    }
  };

  const servidor = crearServidorMcp(puerto);

  const cliente = new Client({
    name: "cliente-pruebas",
    version: "1.0.0"
  });

  const [
    transporteCliente,
    transporteServidor
  ] = InMemoryTransport.createLinkedPair();

  await Promise.all([
    cliente.connect(transporteCliente),
    servidor.connect(transporteServidor)
  ]);

  try {
    const respuesta = await cliente.callTool({
      name: "registrar_pago",
      arguments: {
        idCredito: "CV-2026-0043",
        monto: "350.00",
        moneda: "GTQ",
        fechaCorte: "2026-10-31",
        claveIdempotencia: "PAGO-001",
        aprobacionHumana: false
      }
    });

    const contenido = respuesta.content[0];

    if (contenido?.type !== "text") {
      throw new Error(
        "La herramienta no devolvió contenido de texto"
      );
    }

    const resultado = JSON.parse(contenido.text);

    expect(resultado).toMatchObject({
      estado: "PENDIENTE_APROBACION",
      ejecutado: false,
      requiereAprobacion: true
    });

    expect(llamadasRegistro).toBe(0);
    expect(respuesta.isError).not.toBe(true);
  } finally {
    await cliente.close();
    await servidor.close();
  }
});
it("registra el pago cuando existe aprobación humana", async () => {
  let llamadasRegistro = 0;
  let aprobacionRecibida = false;

  const puerto: Partial<PuertoAsistente> = {
    async registrarPago(solicitud) {
      llamadasRegistro++;
      aprobacionRecibida =
        solicitud.aprobadoPorHumano;

      return {
        idPago: "PAGO-001",
        idCredito: solicitud.idCredito,
        fechaCorte: solicitud.fechaCorte,
        monto: solicitud.monto,
        claveIdempotencia:
          solicitud.claveIdempotencia,
        reutilizado: false,
        aplicacion: {
          gastos: {
            monto: "25.00",
            moneda: "GTQ"
          },
          interesMoratorio: {
            monto: "10.00",
            moneda: "GTQ"
          },
          interesCorriente: {
            monto: "15.00",
            moneda: "GTQ"
          },
          capital: {
            monto: "300.00",
            moneda: "GTQ"
          }
        },
        estadoCredito: "VIGENTE"
      };
    }
  };

  const servidor = crearServidorMcp(puerto);

  const cliente = new Client({
    name: "cliente-pruebas",
    version: "1.0.0"
  });

  const [
    transporteCliente,
    transporteServidor
  ] = InMemoryTransport.createLinkedPair();

  await Promise.all([
    cliente.connect(transporteCliente),
    servidor.connect(transporteServidor)
  ]);

  try {
    const respuesta = await cliente.callTool({
      name: "registrar_pago",
      arguments: {
        idCredito: "CV-2026-0043",
        monto: "350.00",
        moneda: "GTQ",
        fechaCorte: "2026-10-31",
        claveIdempotencia: "PAGO-001",
        aprobacionHumana: true
      }
    });

    const contenido = respuesta.content[0];

    if (contenido?.type !== "text") {
      throw new Error(
        "La herramienta no devolvió contenido de texto"
      );
    }

    const resultado = JSON.parse(contenido.text);

    expect(resultado).toMatchObject({
      idPago: "PAGO-001",
      idCredito: "CV-2026-0043",
      reutilizado: false,
      estadoCredito: "VIGENTE"
    });

    expect(llamadasRegistro).toBe(1);
    expect(aprobacionRecibida).toBe(true);
    expect(respuesta.isError).not.toBe(true);
  } finally {
    await cliente.close();
    await servidor.close();
  }
});
    it("calcula la deuda de una cuota mediante MCP", async () => {
    let creditoRecibido = "";
    let cuotaRecibida = 0;
    let fechaRecibida = "";

    const puerto: Partial<PuertoAsistente> = {
      async calcularDeudaCuota(
        idCredito,
        numeroCuota,
        fechaCorte
      ) {
        creditoRecibido = idCredito;
        cuotaRecibida = numeroCuota;
        fechaRecibida = fechaCorte;

        return {
          idCredito,
          numeroCuota,
          fechaCorte,
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
        };
      }
    };

    const servidor = crearServidorMcp(puerto);

    const cliente = new Client({
      name: "cliente-pruebas",
      version: "1.0.0"
    });

    const [
      transporteCliente,
      transporteServidor
    ] = InMemoryTransport.createLinkedPair();

    await Promise.all([
      cliente.connect(transporteCliente),
      servidor.connect(transporteServidor)
    ]);

    try {
      const respuesta = await cliente.callTool({
        name: "calcular_deuda_cuota",
        arguments: {
          idCredito: "CV-2026-0043",
          numeroCuota: 4,
          fechaCorte: "2026-10-31"
        }
      });

      const contenido = respuesta.content[0];

      if (contenido?.type !== "text") {
        throw new Error(
          "La herramienta no devolvió contenido de texto"
        );
      }

      const resultado = JSON.parse(contenido.text);

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

      expect(creditoRecibido).toBe(
        "CV-2026-0043"
      );
      expect(cuotaRecibida).toBe(4);
      expect(fechaRecibida).toBe(
        "2026-10-31"
      );
      expect(respuesta.isError).not.toBe(true);
    } finally {
      await cliente.close();
      await servidor.close();
    }
  });
    it("explica la mora mediante el puerto del núcleo", async () => {
    let fechaRecibida = "";

    const resultadoNucleo = {
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
    };

    const puerto: Partial<PuertoAsistente> = {
      async explicarMora(
        _idCredito,
        fechaCorte
      ) {
        fechaRecibida = fechaCorte;
        return resultadoNucleo;
      }
    };

    const servidor = crearServidorMcp(puerto);

    const cliente = new Client({
      name: "cliente-pruebas",
      version: "1.0.0"
    });

    const [
      transporteCliente,
      transporteServidor
    ] = InMemoryTransport.createLinkedPair();

    await Promise.all([
      cliente.connect(transporteCliente),
      servidor.connect(transporteServidor)
    ]);

    try {
      const respuesta = await cliente.callTool({
        name: "explicar_mora",
        arguments: {
          idCredito: "CV-2026-0043",
          fechaCorte: "2026-10-31"
        }
      });

      const contenido = respuesta.content[0];

      if (contenido?.type !== "text") {
        throw new Error(
          "La herramienta no devolvió contenido de texto"
        );
      }

      const resultadoMcp =
        JSON.parse(contenido.text);

      expect(resultadoMcp).toEqual(
        resultadoNucleo
      );
      expect(fechaRecibida).toBe(
        "2026-10-31"
      );
      expect(respuesta.isError).not.toBe(true);
    } finally {
      await cliente.close();
      await servidor.close();
    }
  });
    it("lista créditos en mora mediante el puerto del núcleo", async () => {
    let fechaRecibida = "";
    let tramoRecibido = "";

    const resultadoNucleo = {
      fechaCorte: "2026-10-31",
      filtroTramo: "MORA_2",
      totalCreditos: 1,
      creditos: [
        {
          idCredito: "CV-2026-0043",
          diasAtraso: 45,
          tramo: "MORA_2",
          saldo: {
            monto: "1500.00",
            moneda: "GTQ"
          }
        }
      ]
    } as const;

    const puerto: Partial<PuertoAsistente> = {
      async listarCreditosEnMora(
        fechaCorte,
        tramo
      ) {
        fechaRecibida = fechaCorte;
        tramoRecibido = tramo ?? "";

        return resultadoNucleo;
      }
    };

    const servidor = crearServidorMcp(puerto);

    const cliente = new Client({
      name: "cliente-pruebas",
      version: "1.0.0"
    });

    const [
      transporteCliente,
      transporteServidor
    ] = InMemoryTransport.createLinkedPair();

    await Promise.all([
      cliente.connect(transporteCliente),
      servidor.connect(transporteServidor)
    ]);

    try {
      const respuesta = await cliente.callTool({
        name: "listar_creditos_en_mora",
        arguments: {
          fechaCorte: "2026-10-31",
          tramo: "MORA_2"
        }
      });

      const contenido = respuesta.content[0];

      if (contenido?.type !== "text") {
        throw new Error(
          "La herramienta no devolvió contenido de texto"
        );
      }

      const resultadoMcp =
        JSON.parse(contenido.text);

      expect(resultadoMcp).toEqual(
        resultadoNucleo
      );
      expect(fechaRecibida).toBe(
        "2026-10-31"
      );
      expect(tramoRecibido).toBe("MORA_2");
      expect(respuesta.isError).not.toBe(true);
    } finally {
      await cliente.close();
      await servidor.close();
    }
  });
    it("devuelve vencimientos, cartera y cierre igual que el núcleo", async () => {
    const puerto: Partial<PuertoAsistente> = {
      async verProximosVencimientos(
        fechaCorte,
        ventanaDias
      ) {
        return {
          fechaCorte,
          ventanaDias,
          totalCuotas: 1,
          montoTotal: {
            monto: "370.00",
            moneda: "GTQ"
          },
          cuotas: [
            {
              idCredito: "CV-2026-0043",
              numeroCuota: 5,
              fechaVencimiento: "2026-11-15",
              monto: {
                monto: "370.00",
                moneda: "GTQ"
              }
            }
          ]
        };
      },

      async consultarCartera(fechaCorte) {
        return {
          fechaCorte,
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
          desglosePorTramo: [
            {
              tramo: "MORA_2",
              cantidadCreditos: 1,
              capital: {
                monto: "1500.00",
                moneda: "GTQ"
              }
            }
          ],
          incobrableDelPeriodo: {
            monto: "800.00",
            moneda: "GTQ"
          }
        };
      },

      async consultarCierre(
        tipo,
        fechaCorte
      ) {
        return {
          tipo,
          fechaCorte,
          periodoDesde: "2026-10-01",
          periodoHasta: "2026-10-31",
          desembolsos: {
            monto: "2500.00",
            moneda: "GTQ"
          },
          recuperaciones: {
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
            total: {
              monto: "1228.75",
              moneda: "GTQ"
            }
          }
        };
      }
    };

    const servidor = crearServidorMcp(puerto);

    const cliente = new Client({
      name: "cliente-pruebas",
      version: "1.0.0"
    });

    const [
      transporteCliente,
      transporteServidor
    ] = InMemoryTransport.createLinkedPair();

    await Promise.all([
      cliente.connect(transporteCliente),
      servidor.connect(transporteServidor)
    ]);

    async function ejecutarHerramienta(
      name: string,
      arguments_: Record<string, unknown>
    ): Promise<unknown> {
      const respuesta = await cliente.callTool({
        name,
        arguments: arguments_
      });

      const contenido = respuesta.content[0];

      if (contenido?.type !== "text") {
        throw new Error(
          "La herramienta no devolvió contenido de texto"
        );
      }

      expect(respuesta.isError).not.toBe(true);

      return JSON.parse(contenido.text);
    }

    try {
      const vencimientos =
        await ejecutarHerramienta(
          "ver_proximos_vencimientos",
          {
            fechaCorte: "2026-10-31",
            ventanaDias: 30
          }
        );

      expect(vencimientos).toMatchObject({
        fechaCorte: "2026-10-31",
        ventanaDias: 30,
        totalCuotas: 1,
        montoTotal: {
          monto: "370.00",
          moneda: "GTQ"
        }
      });

      const cartera =
        await ejecutarHerramienta(
          "consultar_cartera",
          {
            fechaCorte: "2026-10-31"
          }
        );

      expect(cartera).toMatchObject({
        fechaCorte: "2026-10-31",
        carteraActiva: {
          monto: "2500.00",
          moneda: "GTQ"
        },
        porcentajeEnRiesgo: "0.6000"
      });

      const cierre =
        await ejecutarHerramienta(
          "consultar_cierre",
          {
            tipo: "MENSUAL",
            fechaCorte: "2026-10-31"
          }
        );

      expect(cierre).toMatchObject({
        tipo: "MENSUAL",
        fechaCorte: "2026-10-31",
        periodoDesde: "2026-10-01",
        periodoHasta: "2026-10-31",
        recuperaciones: {
          total: {
            monto: "1228.75",
            moneda: "GTQ"
          }
        }
      });
    } finally {
      await cliente.close();
      await servidor.close();
    }
  });
    it("rechaza una fecha de corte inválida", async () => {
    let llamadasConsulta = 0;

    const puerto: Partial<PuertoAsistente> = {
      async consultarCredito(
      _idCredito,
      _fechaCorte
      ) {
        llamadasConsulta++;

        return {
          idCredito: "CV-2026-0043",
          estado: "VIGENTE",
          saldo: {
            monto: "1000.00",
            moneda: "GTQ"
          },
          diasAtraso: 0,
          tramo: "SIN_MORA",
          cuotasPagadas: 0,
          cuotasVencidas: 0,
          proximaCuota: null
        };
      }
    };

    const servidor = crearServidorMcp(puerto);

    const cliente = new Client({
      name: "cliente-pruebas",
      version: "1.0.0"
    });

    const [
      transporteCliente,
      transporteServidor
    ] = InMemoryTransport.createLinkedPair();

    await Promise.all([
      cliente.connect(transporteCliente),
      servidor.connect(transporteServidor)
    ]);

    try {
      const respuesta = await cliente.callTool({
        name: "consultar_credito",
        arguments: {
          idCredito: "CV-2026-0043",
          fechaCorte: "08-11-2026"
        }
      });

      expect(respuesta.isError).toBe(true);
      expect(llamadasConsulta).toBe(0);
    } finally {
      await cliente.close();
      await servidor.close();
    }
  });
});