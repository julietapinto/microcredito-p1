import { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";

import type {
  PuertoAsistente
} from "./puerto-asistente.js";

const entradaConsultaCredito = z.object({
  idCredito: z
    .string()
    .trim()
    .min(1, "El identificador del crédito es obligatorio"),

  fechaCorte: z.iso.date({
    error: "La fecha de corte debe usar el formato YYYY-MM-DD"
  })
});

const entradaCalculoDeuda = z.object({
  idCredito: z
    .string()
    .trim()
    .min(1, "El identificador del crédito es obligatorio"),

  numeroCuota: z
    .number()
    .int()
    .positive("El número de cuota debe ser positivo"),

  fechaCorte: z.iso.date({
    error: "La fecha de corte debe usar el formato YYYY-MM-DD"
  })
});
const entradaExplicacionMora = z.object({
  idCredito: z
    .string()
    .trim()
    .min(1, "El identificador del crédito es obligatorio"),

  fechaCorte: z.iso.date({
    error: "La fecha de corte debe usar el formato YYYY-MM-DD"
  })
});

export function crearServidorMcp(
  puerto: Partial<PuertoAsistente> = {}
): McpServer {
  const servidor = new McpServer({
    name: "credito-vecino",
    version: "1.0.0"
  });

  servidor.registerTool(
    "consultar_credito",
    {
      title: "Consultar crédito",
      description:
        "Consulta el estado financiero de un crédito en una fecha de corte explícita.",
      inputSchema: entradaConsultaCredito,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false
      }
    },
    async ({ idCredito, fechaCorte }) => {
      try {
        if (!puerto.consultarCredito) {
          throw new Error(
            "El adaptador de consultas todavía no está configurado"
          );
        }

        const resultado =
          await puerto.consultarCredito(
            idCredito,
            fechaCorte
          );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(resultado, null, 2)
            }
          ]
        };
      } catch (error) {
        const mensaje =
          error instanceof Error
            ? error.message
            : "Ocurrió un error inesperado";

        return {
          isError: true,
          content: [
            {
              type: "text",
              text: JSON.stringify({
                codigo: "ERROR_CONSULTA_CREDITO",
                mensaje
              })
            }
          ]
        };
      }
    }
  );

  servidor.registerTool(
    "calcular_deuda_cuota",
    {
      title: "Calcular deuda de una cuota",
      description:
        "Devuelve gastos, interés moratorio, interés corriente, capital y total exigible de una cuota.",
      inputSchema: entradaCalculoDeuda,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false
      }
    },
    async ({
      idCredito,
      numeroCuota,
      fechaCorte
    }) => {
      try {
        if (!puerto.calcularDeudaCuota) {
          throw new Error(
            "El cálculo de deuda todavía no está configurado"
          );
        }

        const resultado =
          await puerto.calcularDeudaCuota(
            idCredito,
            numeroCuota,
            fechaCorte
          );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(resultado, null, 2)
            }
          ]
        };
      } catch (error) {
        const mensaje =
          error instanceof Error
            ? error.message
            : "Ocurrió un error inesperado";

        return {
          isError: true,
          content: [
            {
              type: "text",
              text: JSON.stringify({
                codigo: "ERROR_CALCULO_DEUDA",
                mensaje
              })
            }
          ]
        };
      }
    }
  );
  servidor.registerTool(
  "explicar_mora",
  {
    title: "Explicar mora",
    description:
      "Devuelve el capital en mora y el desglose de los tramos recorridos, con sus días, tasas e intereses.",
    inputSchema: entradaExplicacionMora,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    }
  },
  async ({ idCredito, fechaCorte }) => {
    try {
      if (!puerto.explicarMora) {
        throw new Error(
          "La explicación de mora todavía no está configurada"
        );
      }

      const resultado = await puerto.explicarMora(
        idCredito,
        fechaCorte
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(resultado, null, 2)
          }
        ]
      };
    } catch (error) {
      const mensaje =
        error instanceof Error
          ? error.message
          : "Ocurrió un error inesperado";

      return {
        isError: true,
        content: [
          {
            type: "text",
            text: JSON.stringify({
              codigo: "ERROR_EXPLICACION_MORA",
              mensaje
            })
          }
        ]
      };
    }
  }
);
const entradaProximosVencimientos = z.object({
  fechaCorte: z.iso.date({
    error: "La fecha de corte debe usar el formato YYYY-MM-DD"
  }),

  ventanaDias: z
    .number()
    .int()
    .positive("La ventana debe ser mayor que cero")
    .max(365, "La ventana no puede superar 365 días")
});

servidor.registerTool(
  "ver_proximos_vencimientos",
  {
    title: "Ver próximos vencimientos",
    description:
      "Consulta las cuotas que vencen dentro de una ventana de días desde una fecha de corte.",
    inputSchema: entradaProximosVencimientos,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    }
  },
  async ({ fechaCorte, ventanaDias }) => {
    try {
      if (!puerto.verProximosVencimientos) {
        throw new Error(
          "La consulta de vencimientos todavía no está configurada"
        );
      }

      const resultado =
        await puerto.verProximosVencimientos(
          fechaCorte,
          ventanaDias
        );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(resultado, null, 2)
          }
        ]
      };
    } catch (error) {
      const mensaje =
        error instanceof Error
          ? error.message
          : "Ocurrió un error inesperado";

      return {
        isError: true,
        content: [
          {
            type: "text",
            text: JSON.stringify({
              codigo: "ERROR_PROXIMOS_VENCIMIENTOS",
              mensaje
            })
          }
        ]
      };
      
    }
  }
);
const entradaListadoMora = z.object({
  fechaCorte: z.iso.date({
    error: "La fecha de corte debe usar el formato YYYY-MM-DD"
  }),

  tramo: z
    .enum([
      "MORA_1",
      "MORA_2",
      "MORA_3"
    ])
    .optional()
});
servidor.registerTool(
  "listar_creditos_en_mora",
  {
    title: "Listar créditos en mora",
    description:
      "Lista créditos en mora con sus días de atraso, tramo y saldo. Permite filtrar por tramo.",
    inputSchema: entradaListadoMora,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    }
  },
  async ({ fechaCorte, tramo }) => {
    try {
      if (!puerto.listarCreditosEnMora) {
        throw new Error(
          "El listado de créditos en mora todavía no está configurado"
        );
      }

      const resultado =
        await puerto.listarCreditosEnMora(
          fechaCorte,
          tramo
        );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(resultado, null, 2)
          }
        ]
      };
    } catch (error) {
      const mensaje =
        error instanceof Error
          ? error.message
          : "Ocurrió un error inesperado";

      return {
        isError: true,
        content: [
          {
            type: "text",
            text: JSON.stringify({
              codigo: "ERROR_LISTADO_MORA",
              mensaje
            })
          }
        ]
      };
    }
  }
);
const entradaConsultaCartera = z.object({
  fechaCorte: z.iso.date({
    error: "La fecha de corte debe usar el formato YYYY-MM-DD"
  })
});
servidor.registerTool(
  "consultar_cartera",
  {
    title: "Consultar cartera",
    description:
      "Devuelve cartera activa, en mora, en riesgo, desglose por tramo e incobrable del período.",
    inputSchema: entradaConsultaCartera,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    }
  },
  async ({ fechaCorte }) => {
    try {
      if (!puerto.consultarCartera) {
        throw new Error(
          "La consulta de cartera todavía no está configurada"
        );
      }

      const resultado =
        await puerto.consultarCartera(fechaCorte);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(resultado, null, 2)
          }
        ]
      };
    } catch (error) {
      const mensaje =
        error instanceof Error
          ? error.message
          : "Ocurrió un error inesperado";

      return {
        isError: true,
        content: [
          {
            type: "text",
            text: JSON.stringify({
              codigo: "ERROR_CONSULTA_CARTERA",
              mensaje
            })
          }
        ]
      };
    }
  }
);
const entradaConsultaCierre = z.object({
  tipo: z.enum([
    "DIARIO",
    "MENSUAL"
  ]),

  fechaCorte: z.iso.date({
    error: "La fecha de corte debe usar el formato YYYY-MM-DD"
  })
});

servidor.registerTool(
  "consultar_cierre",
  {
    title: "Consultar cierre",
    description:
      "Consulta desembolsos y recuperaciones por concepto para un cierre diario o mensual.",
    inputSchema: entradaConsultaCierre,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    }
  },
  async ({ tipo, fechaCorte }) => {
    try {
      if (!puerto.consultarCierre) {
        throw new Error(
          "La consulta de cierres todavía no está configurada"
        );
      }

      const resultado =
        await puerto.consultarCierre(
          tipo,
          fechaCorte
        );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(resultado, null, 2)
          }
        ]
      };
    } catch (error) {
      const mensaje =
        error instanceof Error
          ? error.message
          : "Ocurrió un error inesperado";

      return {
        isError: true,
        content: [
          {
            type: "text",
            text: JSON.stringify({
              codigo: "ERROR_CONSULTA_CIERRE",
              mensaje
            })
          }
        ]
      };
    }
  }
);
const entradaRegistroPago = z.object({
  idCredito: z
    .string()
    .trim()
    .min(1, "El identificador del crédito es obligatorio"),

  monto: z
    .string()
    .regex(
      /^\d+\.\d{2}$/,
      "El monto debe tener exactamente dos decimales"
    )
    .refine(
      (valor) => Number(valor) > 0,
      "El monto debe ser mayor que cero"
    ),

  moneda: z.literal("GTQ"),

  fechaCorte: z.iso.date({
    error: "La fecha de corte debe usar el formato YYYY-MM-DD"
  }),

  claveIdempotencia: z
    .string()
    .trim()
    .min(8, "La clave de idempotencia es obligatoria"),

  aprobacionHumana: z.boolean().default(false)
});
servidor.registerTool(
  "registrar_pago",
  {
    title: "Registrar pago",
    description:
      "Propone o registra un pago aplicando prelación e idempotencia. Solo ejecuta con aprobación humana explícita.",
    inputSchema: entradaRegistroPago,
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: false
    }
  },
  async ({
    idCredito,
    monto,
    moneda,
    fechaCorte,
    claveIdempotencia,
    aprobacionHumana
  }) => {
    try {
      if (!aprobacionHumana) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  estado: "PENDIENTE_APROBACION",
                  ejecutado: false,
                  requiereAprobacion: true,
                  mensaje:
                    "El pago no fue registrado. Se requiere confirmación humana.",
                  propuesta: {
                    idCredito,
                    monto: {
                      monto,
                      moneda
                    },
                    fechaCorte,
                    claveIdempotencia
                  }
                },
                null,
                2
              )
            }
          ]
        };
      }

      if (!puerto.registrarPago) {
        throw new Error(
          "El registro de pagos todavía no está configurado"
        );
      }

      const resultado = await puerto.registrarPago({
        idCredito,
        monto: {
          monto,
          moneda
        },
        fechaCorte,
        claveIdempotencia,
        aprobadoPorHumano: true
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(resultado, null, 2)
          }
        ]
      };
    } catch (error) {
      const mensaje =
        error instanceof Error
          ? error.message
          : "Ocurrió un error inesperado";

      return {
        isError: true,
        content: [
          {
            type: "text",
            text: JSON.stringify({
              codigo: "ERROR_REGISTRO_PAGO",
              mensaje
            })
          }
        ]
      };
    }
  }
);

  return servidor;
}