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
      

      expect(
        herramientas.tools.map(
          (herramienta) => herramienta.name
        )
      ).toContain("consultar_credito");

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
});