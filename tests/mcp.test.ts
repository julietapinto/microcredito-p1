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
});