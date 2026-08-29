// @ts-nocheck
import { z } from "zod";
import { extendZodWithOpenApi, OpenApiGeneratorV3, OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import * as yaml from "yaml";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

// ==========================================
// EXTENDER ZOD CON OPENAPI (OBLIGATORIO)
// ==========================================
extendZodWithOpenApi(z);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import {
  ClienteSchema,
  RegistrarClienteRequestSchema,
  SolicitudCreditoSchema,
  CrearSolicitudRequestSchema,
  CreditoSchema,
  DesembolsarCreditoRequestSchema,
  PlanAmortizacionSchema,
  RegistrarPagoRequestSchema,
  PagoRegistradoSchema,
  CarteraEnRiesgoResponseSchema,
  CierreSchema,
  ProblemDetailsSchema,
  PaginacionSchema,
  DineroSchema,
  MedioDePagoSchema,
} from "../docs/api/esquemas/index.ts";

const registry = new OpenAPIRegistry();

// ==========================================
// REGISTRO DE SCHEMAS
// ==========================================

registry.register("Cliente", ClienteSchema);
registry.register("RegistrarClienteRequest", RegistrarClienteRequestSchema);
registry.register("SolicitudCredito", SolicitudCreditoSchema);
registry.register("CrearSolicitudRequest", CrearSolicitudRequestSchema);
registry.register("Credito", CreditoSchema);
registry.register("DesembolsarCreditoRequest", DesembolsarCreditoRequestSchema);
registry.register("PlanAmortizacion", PlanAmortizacionSchema);
registry.register("RegistrarPagoRequest", RegistrarPagoRequestSchema);
registry.register("PagoRegistrado", PagoRegistradoSchema);
registry.register("CarteraEnRiesgoResponse", CarteraEnRiesgoResponseSchema);
registry.register("Cierre", CierreSchema);
registry.register("ProblemDetails", ProblemDetailsSchema);
registry.register("Paginacion", PaginacionSchema);
registry.register("Dinero", DineroSchema);
registry.register("MedioDePago", MedioDePagoSchema);

// ==========================================
// REGISTRO DE PARAMETROS REUTILIZABLES
// ==========================================

registry.registerParameter("IdempotencyKeyHeader", {
  name: "Idempotency-Key",
  in: "header",
  required: true,
  schema: {
    type: "string",
    format: "uuid",
    description: "Clave generada por el cliente. Si se reintenta el mismo pago con la misma clave y el mismo cuerpo, se devuelve la respuesta original sin volver a cobrar.",
  },
});

// ==========================================
// REGISTRO DE PATHS (ENDPOINTS)
// ==========================================

// ========== CLIENTES ==========

registry.registerPath({
  method: "post",
  path: "/clientes",
  summary: "Registrar un nuevo cliente",
  description: "Crea un cliente en el sistema. El DPI debe ser unico.",
  request: {
    body: {
      content: {
        "application/json": {
          schema: RegistrarClienteRequestSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: "Cliente creado exitosamente",
      headers: {
        Location: {
          schema: { type: "string" },
          description: "URI del cliente creado",
        },
      },
      content: {
        "application/json": {
          schema: ClienteSchema,
        },
      },
    },
    400: {
      description: "Error de validacion",
      content: {
        "application/problem+json": {
          schema: ProblemDetailsSchema,
        },
      },
    },
    409: {
      description: "Cliente ya existe (DPI duplicado)",
      content: {
        "application/problem+json": {
          schema: ProblemDetailsSchema,
        },
      },
    },
    422: {
      description: "Violacion de regla de negocio",
      content: {
        "application/problem+json": {
          schema: ProblemDetailsSchema,
        },
      },
    },
    500: {
      description: "Error interno del servidor",
      content: {
        "application/problem+json": {
          schema: ProblemDetailsSchema,
        },
      },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/clientes",
  summary: "Listar clientes",
  description: "Obtiene la lista de clientes registrados con paginacion",
  request: {
    query: z.object({
      limit: z.number().int().min(1).max(200).default(50).optional().openapi({
        description: "Cantidad maxima de resultados",
      }),
      cursor: z.string().optional().openapi({
        description: "Cursor opaco para paginacion",
      }),
      q: z.string().optional().openapi({
        description: "Busqueda por nombre o identificacion",
      }),
    }),
  },
  responses: {
    200: {
      description: "Lista de clientes",
      content: {
        "application/json": {
          schema: z.object({
            data: z.array(ClienteSchema),
            paginacion: PaginacionSchema,
          }),
        },
      },
    },
    400: {
      description: "Parametros invalidos",
      content: {
        "application/problem+json": {
          schema: ProblemDetailsSchema,
        },
      },
    },
    500: {
      description: "Error interno del servidor",
      content: {
        "application/problem+json": {
          schema: ProblemDetailsSchema,
        },
      },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/clientes/{clienteId}",
  summary: "Obtener cliente por ID",
  request: {
    params: z.object({
      clienteId: z.string().regex(/^CLI-\d{3,8}$/).openapi({
        description: "Identificador del cliente",
      }),
    }),
  },
  responses: {
    200: {
      description: "Cliente encontrado",
      content: {
        "application/json": {
          schema: ClienteSchema,
        },
      },
    },
    404: {
      description: "Cliente no encontrado",
      content: {
        "application/problem+json": {
          schema: ProblemDetailsSchema,
        },
      },
    },
    500: {
      description: "Error interno del servidor",
      content: {
        "application/problem+json": {
          schema: ProblemDetailsSchema,
        },
      },
    },
  },
});

// ========== SOLICITUDES ==========

registry.registerPath({
  method: "post",
  path: "/solicitudes",
  summary: "Crear solicitud de credito",
  description: "Crea una nueva solicitud de credito. El estado inicial es PENDIENTE.",
  request: {
    body: {
      content: {
        "application/json": {
          schema: CrearSolicitudRequestSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: "Solicitud creada",
      headers: {
        Location: {
          schema: { type: "string" },
          description: "URI de la solicitud creada",
        },
      },
      content: {
        "application/json": {
          schema: SolicitudCreditoSchema,
        },
      },
    },
    400: {
      description: "Error de validacion",
      content: {
        "application/problem+json": {
          schema: ProblemDetailsSchema,
        },
      },
    },
    404: {
      description: "Cliente no encontrado",
      content: {
        "application/problem+json": {
          schema: ProblemDetailsSchema,
        },
      },
    },
    422: {
      description: "Violacion de regla de negocio",
      content: {
        "application/problem+json": {
          schema: ProblemDetailsSchema,
        },
      },
    },
    500: {
      description: "Error interno del servidor",
      content: {
        "application/problem+json": {
          schema: ProblemDetailsSchema,
        },
      },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/solicitudes/{solicitudId}",
  summary: "Obtener solicitud por ID",
  request: {
    params: z.object({
      solicitudId: z.string().regex(/^SOL-\d{3,8}$/).openapi({
        description: "Identificador de la solicitud",
      }),
    }),
  },
  responses: {
    200: {
      description: "Solicitud encontrada",
      content: {
        "application/json": {
          schema: SolicitudCreditoSchema,
        },
      },
    },
    404: {
      description: "Solicitud no encontrada",
      content: {
        "application/problem+json": {
          schema: ProblemDetailsSchema,
        },
      },
    },
    500: {
      description: "Error interno del servidor",
      content: {
        "application/problem+json": {
          schema: ProblemDetailsSchema,
        },
      },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/solicitudes/{solicitudId}/aprobar",
  summary: "Aprobar una solicitud de credito",
  description: "Cambia el estado de la solicitud a APROBADA. Solo permite aprobar solicitudes en estado PENDIENTE.",
  request: {
    params: z.object({
      solicitudId: z.string().regex(/^SOL-\d{3,8}$/).openapi({
        description: "Identificador de la solicitud",
      }),
    }),
    body: {
      content: {
        "application/json": {
          schema: z.object({
            tasaInteres: z.string().optional().openapi({
              description: "Tasa nominal anual (TNA) a aplicar",
              example: "36.0",
            }),
          }).optional(),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Solicitud aprobada",
      content: {
        "application/json": {
          schema: SolicitudCreditoSchema,
        },
      },
    },
    400: {
      description: "La solicitud no puede ser aprobada",
      content: {
        "application/problem+json": {
          schema: ProblemDetailsSchema,
        },
      },
    },
    404: {
      description: "Solicitud no encontrada",
      content: {
        "application/problem+json": {
          schema: ProblemDetailsSchema,
        },
      },
    },
    422: {
      description: "Violacion de regla de negocio",
      content: {
        "application/problem+json": {
          schema: ProblemDetailsSchema,
        },
      },
    },
    500: {
      description: "Error interno del servidor",
      content: {
        "application/problem+json": {
          schema: ProblemDetailsSchema,
        },
      },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/solicitudes/{solicitudId}/rechazar",
  summary: "Rechazar una solicitud de credito",
  description: "Cambia el estado de la solicitud a RECHAZADA. Solo permite rechazar solicitudes en estado PENDIENTE.",
  request: {
    params: z.object({
      solicitudId: z.string().regex(/^SOL-\d{3,8}$/).openapi({
        description: "Identificador de la solicitud",
      }),
    }),
    body: {
      content: {
        "application/json": {
          schema: z.object({
            motivo: z.string().optional().openapi({
              example: "No cumple con las politicas de credito",
            }),
          }).optional(),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Solicitud rechazada",
      content: {
        "application/json": {
          schema: SolicitudCreditoSchema,
        },
      },
    },
    400: {
      description: "La solicitud no puede ser rechazada",
      content: {
        "application/problem+json": {
          schema: ProblemDetailsSchema,
        },
      },
    },
    404: {
      description: "Solicitud no encontrada",
      content: {
        "application/problem+json": {
          schema: ProblemDetailsSchema,
        },
      },
    },
    500: {
      description: "Error interno del servidor",
      content: {
        "application/problem+json": {
          schema: ProblemDetailsSchema,
        },
      },
    },
  },
});

// ========== CREDITOS ==========

registry.registerPath({
  method: "post",
  path: "/creditos",
  summary: "Desembolsar credito aprobado",
  description: "Realiza el desembolso de una solicitud aprobada. Genera el plan de amortizacion y el credito queda en estado VIGENTE.",
  request: {
    body: {
      content: {
        "application/json": {
          schema: DesembolsarCreditoRequestSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: "Credito desembolsado exitosamente",
      headers: {
        Location: {
          schema: { type: "string" },
          description: "URI del credito creado",
        },
      },
      content: {
        "application/json": {
          schema: CreditoSchema,
        },
      },
    },
    400: {
      description: "Error de validacion",
      content: {
        "application/problem+json": {
          schema: ProblemDetailsSchema,
        },
      },
    },
    404: {
      description: "Solicitud no encontrada",
      content: {
        "application/problem+json": {
          schema: ProblemDetailsSchema,
        },
      },
    },
    422: {
      description: "Violacion de regla de negocio",
      content: {
        "application/problem+json": {
          schema: ProblemDetailsSchema,
        },
      },
    },
    500: {
      description: "Error interno del servidor",
      content: {
        "application/problem+json": {
          schema: ProblemDetailsSchema,
        },
      },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/creditos/{creditoId}",
  summary: "Obtener credito por ID",
  request: {
    params: z.object({
      creditoId: z.string().regex(/^C-\d{3,8}$/).openapi({
        description: "Identificador del credito",
      }),
    }),
  },
  responses: {
    200: {
      description: "Credito encontrado",
      content: {
        "application/json": {
          schema: CreditoSchema,
        },
      },
    },
    404: {
      description: "Credito no encontrado",
      content: {
        "application/problem+json": {
          schema: ProblemDetailsSchema,
        },
      },
    },
    500: {
      description: "Error interno del servidor",
      content: {
        "application/problem+json": {
          schema: ProblemDetailsSchema,
        },
      },
    },
  },
});

// ========== PLAN DE AMORTIZACION ==========

registry.registerPath({
  method: "get",
  path: "/creditos/{creditoId}/plan-amortizacion",
  summary: "Obtener plan de amortizacion del credito",
  description: "Retorna el plan de amortizacion completo con todas las cuotas calculadas",
  request: {
    params: z.object({
      creditoId: z.string().regex(/^C-\d{3,8}$/).openapi({
        description: "Identificador del credito",
      }),
    }),
  },
  responses: {
    200: {
      description: "Plan de amortizacion",
      content: {
        "application/json": {
          schema: PlanAmortizacionSchema,
        },
      },
    },
    404: {
      description: "Credito no encontrado",
      content: {
        "application/problem+json": {
          schema: ProblemDetailsSchema,
        },
      },
    },
    500: {
      description: "Error interno del servidor",
      content: {
        "application/problem+json": {
          schema: ProblemDetailsSchema,
        },
      },
    },
  },
});

// ========== PAGOS ==========

registry.registerPath({
  method: "post",
  path: "/creditos/{creditoId}/pagos",
  summary: "Registra un pago sobre un credito",
  description: "Aplica el pago en el orden de prelacion (gastos -> interes moratorio -> interes corriente -> capital) y devuelve el desglose.",
  request: {
    params: z.object({
      creditoId: z.string().regex(/^C-\d{3,8}$/).openapi({
        description: "Identificador del credito",
        example: "C-004",
      }),
    }),
    headers: z.object({
      "Idempotency-Key": z.string().uuid().openapi({
        description: "Clave de idempotencia generada por el cliente (UUID v4)",
        example: "5b0b9e2e-6a1f-4a5c-9c1e-0d6d1a1f0b3a",
      }),
    }),
    body: {
      content: {
        "application/json": {
          schema: RegistrarPagoRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Reintento con la misma clave. No se cobro de nuevo.",
      content: {
        "application/json": {
          schema: PagoRegistradoSchema,
        },
      },
    },
    201: {
      description: "Pago registrado por primera vez",
      headers: {
        Location: {
          schema: { type: "string" },
          description: "URI del pago creado",
        },
      },
      content: {
        "application/json": {
          schema: PagoRegistradoSchema,
        },
      },
    },
    404: {
      description: "El credito no existe",
      content: {
        "application/problem+json": {
          schema: ProblemDetailsSchema,
        },
      },
    },
    409: {
      description: "Clave de idempotencia reutilizada con otro contenido",
      content: {
        "application/problem+json": {
          schema: ProblemDetailsSchema,
        },
      },
    },
    422: {
      description: "Violacion de regla de negocio",
      content: {
        "application/problem+json": {
          schema: ProblemDetailsSchema,
        },
      },
    },
    429: {
      description: "Demasiadas solicitudes",
      content: {
        "application/problem+json": {
          schema: ProblemDetailsSchema,
        },
      },
    },
    500: {
      description: "Error no previsto del servidor",
      content: {
        "application/problem+json": {
          schema: ProblemDetailsSchema,
        },
      },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/creditos/{creditoId}/pagos/historial",
  summary: "Historial de pagos del credito",
  request: {
    params: z.object({
      creditoId: z.string().regex(/^C-\d{3,8}$/).openapi({
        description: "Identificador del credito",
      }),
    }),
    query: z.object({
      limit: z.number().int().min(1).max(200).default(50).optional(),
    }),
  },
  responses: {
    200: {
      description: "Historial de pagos",
      content: {
        "application/json": {
          schema: z.object({
            data: z.array(PagoRegistradoSchema),
            paginacion: PaginacionSchema,
          }),
        },
      },
    },
    404: {
      description: "Credito no encontrado",
      content: {
        "application/problem+json": {
          schema: ProblemDetailsSchema,
        },
      },
    },
    500: {
      description: "Error interno del servidor",
      content: {
        "application/problem+json": {
          schema: ProblemDetailsSchema,
        },
      },
    },
  },
});

// ========== CIERRES ==========

registry.registerPath({
  method: "get",
  path: "/cierres/diario",
  summary: "Obtener cierre diario",
  description: "Retorna el cierre consolidado para una fecha especifica",
  request: {
    query: z.object({
      fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).openapi({
        description: "Fecha del cierre (YYYY-MM-DD)",
        example: "2026-08-28",
      }),
    }),
  },
  responses: {
    200: {
      description: "Cierre diario",
      content: {
        "application/json": {
          schema: CierreSchema,
        },
      },
    },
    400: {
      description: "Fecha invalida",
      content: {
        "application/problem+json": {
          schema: ProblemDetailsSchema,
        },
      },
    },
    422: {
      description: "Fecha fuera de rango",
      content: {
        "application/problem+json": {
          schema: ProblemDetailsSchema,
        },
      },
    },
    500: {
      description: "Error interno del servidor",
      content: {
        "application/problem+json": {
          schema: ProblemDetailsSchema,
        },
      },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/cierres/mensual",
  summary: "Obtener cierre mensual",
  description: "Retorna el cierre consolidado para un mes completo. La fecha debe ser el ultimo dia del mes.",
  request: {
    query: z.object({
      fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).openapi({
        description: "Fecha de corte (debe ser fin de mes, YYYY-MM-DD)",
        example: "2026-08-31",
      }),
    }),
  },
  responses: {
    200: {
      description: "Cierre mensual",
      content: {
        "application/json": {
          schema: CierreSchema,
        },
      },
    },
    400: {
      description: "Fecha invalida",
      content: {
        "application/problem+json": {
          schema: ProblemDetailsSchema,
        },
      },
    },
    422: {
      description: "Fecha no es fin de mes o fuera de rango",
      content: {
        "application/problem+json": {
          schema: ProblemDetailsSchema,
        },
      },
    },
    500: {
      description: "Error interno del servidor",
      content: {
        "application/problem+json": {
          schema: ProblemDetailsSchema,
        },
      },
    },
  },
});

// ========== CARTERA EN RIESGO ==========

registry.registerPath({
  method: "get",
  path: "/cartera-riesgo",
  summary: "Consulta el indicador de cartera en riesgo a una fecha de corte",
  description: "Operacion segura e idempotente. Devuelve siempre, junto al porcentaje, lo dado por incobrable en el periodo.",
  request: {
    query: z.object({
      fechaCorte: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).openapi({
        description: "Fecha calendario en formato AAAA-MM-DD",
        example: "2026-08-22",
      }),
      incluirReestructurados: z.boolean().default(true).optional().openapi({
        description: "Indica si deben incluirse los creditos reestructurados en el indicador",
      }),
    }),
  },
  responses: {
    200: {
      description: "Indicador calculado",
      content: {
        "application/json": {
          schema: CarteraEnRiesgoResponseSchema,
        },
      },
    },
    400: {
      description: "Parametros de consulta invalidos",
      content: {
        "application/problem+json": {
          schema: ProblemDetailsSchema,
        },
      },
    },
    422: {
      description: "Fecha de corte fuera del rango permitido",
      content: {
        "application/problem+json": {
          schema: ProblemDetailsSchema,
        },
      },
    },
    500: {
      description: "Error interno del servidor",
      content: {
        "application/problem+json": {
          schema: ProblemDetailsSchema,
        },
      },
    },
  },
});

// ==========================================
// GENERAR EL DOCUMENTO OPENAPI
// ==========================================

const generator = new OpenApiGeneratorV3(registry);

const document = generator.generateDocument({
  openapi: "3.1.0",
  info: {
    title: "SGMC · API de Credito Vecino, S. A.",
    version: "1.0.0",
    description:
      "Contrato del Sistema de Gestion de Microcredito. Los esquemas se generan desde Zod: el contrato y la validacion en ejecucion son el mismo artefacto.",
    contact: {
      name: "Analisis de Sistemas II (037) — UMG",
    },
    license: {
      name: "Uso academico",
    },
  },
  servers: [
    {
      url: "https://api.creditovecino.gt/v1",
      description: "Produccion (ficticia)",
    },
    {
      url: "http://localhost:3000/api",
      description: "Desarrollo",
    },
  ],
  tags: [
    { name: "Clientes", description: "Gestion de clientes (Originacion)" },
    { name: "Solicitudes", description: "Gestion de solicitudes de credito (Originacion)" },
    { name: "Creditos", description: "Gestion de creditos y desembolsos (Originacion / Cartera)" },
    { name: "Pagos", description: "Registro y consulta de pagos (Cartera y Cobros)" },
    { name: "Cierres", description: "Cierres diarios y mensuales (Cierres)" },
    { name: "Cartera", description: "Analisis de cartera y riesgo (Cierres / Reporteria)" },
  ],
});

// Convertir a YAML
const yamlString = yaml.stringify(document);

// Guardar en archivo
const outputPath = path.join(__dirname, "../docs/api/openapi.yaml");

// Asegurar que la carpeta existe
const outputDir = path.dirname(outputPath);
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

fs.writeFileSync(outputPath, yamlString, "utf8");

console.log("OpenAPI generado en: " + outputPath);