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
} from "../../src/mcp/crear-servidor.js";

import type {
  PuertoAsistente
} from "../../src/mcp/puerto-asistente.js";

const escenarios = [
  {
    id: "G-1",
    pregunta:
      "¿Cuál es el estado del crédito CV-2026-0043?",
    herramienta: "consultar_credito",
    requiereAprobacion: false
  },
  {
    id: "G-2",
    pregunta:
      "¿Cuánto debe la cuota 4 del crédito CV-2026-0043?",
    herramienta: "calcular_deuda_cuota",
    requiereAprobacion: false
  },
  {
    id: "G-3",
    pregunta:
      "Explique la mora del crédito CV-2026-0043.",
    herramienta: "explicar_mora",
    requiereAprobacion: false
  },
  {
    id: "G-4",
    pregunta:
      "Liste los créditos que se encuentran en mora.",
    herramienta: "listar_creditos_en_mora",
    requiereAprobacion: false
  },
  {
    id: "G-5",
    pregunta:
      "¿Cuáles son los próximos vencimientos?",
    herramienta: "ver_proximos_vencimientos",
    requiereAprobacion: false
  },
  {
    id: "G-6",
    pregunta:
      "¿Cuál es el resumen actual de la cartera?",
    herramienta: "consultar_cartera",
    requiereAprobacion: false
  },
  {
    id: "G-7",
    pregunta:
      "Muestre el cierre mensual y sus recuperaciones.",
    herramienta: "consultar_cierre",
    requiereAprobacion: false
  },
  {
    id: "G-8",
    pregunta:
      "Registre el pago del crédito CV-2026-0043.",
    herramienta: "registrar_pago",
    requiereAprobacion: true
  }
] as const;

describe("Evals gerenciales G-1 a G-8", () => {
  it("relaciona cada escenario con una herramienta MCP disponible", async () => {
    const puerto: Partial<PuertoAsistente> = {};
    const servidor = crearServidorMcp(puerto);

    const cliente = new Client({
      name: "cliente-evals",
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
      const respuesta =
        await cliente.listTools();

      expect(escenarios).toHaveLength(8);

      expect(
        escenarios.map(
          (escenario) => escenario.id
        )
      ).toEqual([
        "G-1",
        "G-2",
        "G-3",
        "G-4",
        "G-5",
        "G-6",
        "G-7",
        "G-8"
      ]);

      for (const escenario of escenarios) {
        expect(
          escenario.pregunta.length
        ).toBeGreaterThan(0);

        const herramienta =
          respuesta.tools.find(
            (actual) =>
              actual.name ===
              escenario.herramienta
          );

        expect(herramienta).toBeDefined();

        if (escenario.requiereAprobacion) {
          expect(
            herramienta?.annotations
          ).toMatchObject({
            readOnlyHint: false,
            destructiveHint: true
          });
        } else {
          expect(
            herramienta?.annotations
          ).toMatchObject({
            readOnlyHint: true,
            destructiveHint: false
          });
        }
      }
    } finally {
      await cliente.close();
      await servidor.close();
    }
  });

  it("exige aprobación humana solamente en G-8", () => {
    const escenariosConAprobacion =
      escenarios.filter(
        (escenario) =>
          escenario.requiereAprobacion
      );

    expect(escenariosConAprobacion).toEqual([
      expect.objectContaining({
        id: "G-8",
        herramienta: "registrar_pago"
      })
    ]);
  });
});