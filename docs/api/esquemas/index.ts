import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

// ==========================================
// EXTENDER ZOD CON OPENAPI (OBLIGATORIO)
// ==========================================
extendZodWithOpenApi(z);

// ==========================================
// TIPOS BASE
// ==========================================

export const DineroSchema = z.object({
  valor: z.string().regex(/^-?\d{1,13}\.\d{2}$/).openapi({
    description: "Importe como cadena decimal con 2 decimales exactos",
    example: "1004.62",
  }),
  moneda: z.enum(["GTQ"]).openapi({
    description: "Codigo ISO 4217. El Sistema opera unicamente en quetzales.",
    example: "GTQ",
  }),
});

export const ProblemDetailsSchema = z.object({
  type: z.string().url().openapi({
    description: "URI que identifica el TIPO de problema",
    example: "https://api.creditovecino.gt/problemas/clave-idempotencia-reutilizada",
  }),
  title: z.string().openapi({
    description: "Titulo del problema",
    example: "Clave de idempotencia reutilizada con otro contenido",
  }),
  status: z.number().int().min(400).max(599).openapi({
    description: "Codigo de estado HTTP",
    example: 409,
  }),
  detail: z.string().optional().openapi({
    description: "Explicacion especifica de esta ocurrencia",
    example: "La clave 5b0b9e2e... se uso antes con un monto distinto.",
  }),
  instance: z.string().optional().openapi({
    description: "URI de la ocurrencia concreta",
    example: "/creditos/C-004/pagos",
  }),
  traceId: z.string().optional().openapi({
    example: "01J9Z4T8Q2",
  }),
  errores: z.array(z.object({
    campo: z.string().openapi({ example: "monto.valor" }),
    mensaje: z.string().openapi({ example: "Debe ser decimal de punto fijo con 2 decimales" }),
  })).optional().openapi({
    description: "Lista de errores de validacion",
  }),
});

export const PaginacionSchema = z.object({
  limite: z.number().int().min(1).max(200).default(50).openapi({
    description: "Cantidad maxima de resultados",
    example: 50,
  }),
  cursor: z.string().optional().openapi({
    description: "Cursor opaco devuelto por la pagina anterior",
    example: "cursor-ejemplo",
  }),
});

// ==========================================
// CLIENTES
// ==========================================

export const ClienteSchema = z.object({
  id: z.string().regex(/^CLI-\d{3,8}$/).openapi({
    description: "Identificador del cliente",
    example: "CLI-001",
  }),
  nombre: z.string().min(1).openapi({
    description: "Nombre completo del cliente",
    example: "Lutwing Martinez",
  }),
  identificacion: z.string().min(1).openapi({
    description: "DPI o NIT",
    example: "1234-56789-0101",
  }),
  email: z.string().email().optional().openapi({
    description: "Correo electronico",
    example: "lutwing.martinez@gmail.com",
  }),
  telefono: z.string().optional().openapi({
    description: "Numero de telefono",
    example: "502-5555-1234",
  }),
  direccion: z.string().optional().openapi({
    description: "Direccion fisica",
    example: "Zona 10, Ciudad de Guatemala",
  }),
});

export const RegistrarClienteRequestSchema = ClienteSchema.omit({ id: true });

// ==========================================
// SOLICITUDES
// ==========================================

export const SolicitudCreditoSchema = z.object({
  id: z.string().regex(/^SOL-\d{3,8}$/).openapi({
    description: "Identificador de la solicitud",
    example: "SOL-001",
  }),
  clienteId: z.string().regex(/^CLI-\d{3,8}$/).openapi({
    description: "ID del cliente",
    example: "CLI-001",
  }),
  montoSolicitado: DineroSchema,
  plazoMeses: z.number().int().min(3).max(24).openapi({
    description: "Plazo en meses (3-24)",
    example: 12,
  }),
  tasaInteres: z.string().optional().openapi({
    description: "Tasa nominal anual (TNA) en porcentaje",
    example: "36.0",
  }),
  estado: z.enum(["PENDIENTE", "APROBADA", "RECHAZADA"]).openapi({
    description: "Estado de la solicitud",
    example: "PENDIENTE",
  }),
  fechaSolicitud: z.string().date().optional().openapi({
    description: "Fecha de la solicitud",
    example: "2026-08-28",
  }),
});

export const CrearSolicitudRequestSchema = z.object({
  clienteId: z.string().regex(/^CLI-\d{3,8}$/).openapi({
    example: "CLI-001",
  }),
  montoSolicitado: DineroSchema,
  plazoMeses: z.number().int().min(3).max(24).openapi({
    example: 12,
  }),
});

// ==========================================
// CREDITOS
// ==========================================

export const CreditoSchema = z.object({
  id: z.string().regex(/^C-\d{3,8}$/).openapi({
    description: "Identificador del credito",
    example: "C-001",
  }),
  solicitudId: z.string().regex(/^SOL-\d{3,8}$/).openapi({
    description: "ID de la solicitud que origino el credito",
    example: "SOL-001",
  }),
  clienteId: z.string().regex(/^CLI-\d{3,8}$/).openapi({
    description: "ID del cliente",
    example: "CLI-001",
  }),
  capitalDesembolsado: DineroSchema,
  plazoMeses: z.number().int().openapi({
    example: 12,
  }),
  tasaMensual: z.string().openapi({
    description: "Tasa mensual (TNA / 12)",
    example: "3.0",
  }),
  tasaNominalAnual: z.string().optional().openapi({
    description: "Tasa nominal anual en porcentaje",
    example: "36.0",
  }),
  estado: z.enum([
    "SOLICITADO", "APROBADO", "RECHAZADO", "ANULADO",
    "VIGENTE", "EN_MORA", "REESTRUCTURADO", "CANCELADO", "INCOBRABLE"
  ]).openapi({
    description: "Estado del credito",
    example: "VIGENTE",
  }),
  fechaDesembolso: z.string().date().optional().openapi({
    example: "2026-08-28",
  }),
  saldoCapital: DineroSchema.optional(),
  diasAtraso: z.number().int().min(0).optional().openapi({
    description: "Dias de atraso del credito",
    example: 0,
  }),
  tramoMora: z.enum(["SIN_MORA", "MORA_1", "MORA_2", "MORA_3", "VENCIDO", "INCOBRABLE"]).optional().openapi({
    description: "Clasificacion derivada de los dias de atraso",
    example: "SIN_MORA",
  }),
  reestructurado: z.boolean().optional().openapi({
    description: "Indica si el credito ha sido reestructurado",
    example: false,
  }),
});

export const DesembolsarCreditoRequestSchema = z.object({
  solicitudId: z.string().regex(/^SOL-\d{3,8}$/).openapi({
    example: "SOL-001",
  }),
  fechaDesembolso: z.string().date().optional().openapi({
    example: "2026-08-28",
  }),
});

// ==========================================
// PLAN DE AMORTIZACION
// ==========================================

export const CuotaSchema = z.object({
  numero: z.number().int().min(1).openapi({
    example: 1,
  }),
  saldoInicial: DineroSchema,
  monto: DineroSchema,
  interes: DineroSchema,
  amortizacion: DineroSchema,
  saldoFinal: DineroSchema,
  fechaVencimiento: z.string().date().openapi({
    example: "2026-09-28",
  }),
});

export const PlanAmortizacionSchema = z.object({
  creditoId: z.string().regex(/^C-\d{3,8}$/).openapi({
    example: "C-001",
  }),
  capital: DineroSchema,
  tasaNominalAnual: z.string().openapi({
    example: "36.0",
  }),
  plazoMeses: z.number().int().openapi({
    example: 12,
  }),
  cuotaMensual: DineroSchema,
  cuotas: z.array(CuotaSchema),
});

// ==========================================
// PAGOS
// ==========================================

export const MedioDePagoSchema = z.enum(["efectivo", "transferencia", "agente_bancario"]).openapi({
  description: "Canal por el que se recibio el pago",
});

export const RegistrarPagoRequestSchema = z.object({
  monto: DineroSchema,
  fechaPago: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).openapi({
    description: "Fecha calendario en formato AAAA-MM-DD",
    example: "2026-08-22",
  }),
  medio: MedioDePagoSchema,
  referencia: z.string().max(40).optional().openapi({
    description: "Referencia opcional del comprobante",
    example: "DEP-458921",
  }),
});

export const AplicacionDelPagoSchema = z.object({
  gastos: z.string().regex(/^-?\d{1,13}\.\d{2}$/).openapi({
    example: "0.00",
  }),
  interesMoratorio: z.string().regex(/^-?\d{1,13}\.\d{2}$/).openapi({
    example: "7.26",
  }),
  interesCorriente: z.string().regex(/^-?\d{1,13}\.\d{2}$/).openapi({
    example: "278.86",
  }),
  capital: z.string().regex(/^-?\d{1,13}\.\d{2}$/).openapi({
    example: "725.76",
  }),
  excedente: z.string().regex(/^-?\d{1,13}\.\d{2}$/).openapi({
    example: "0.00",
  }),
});

export const EstadoCreditoSchema = z.enum(["vigente", "en_mora", "cancelado", "reestructurado", "incobrable"]);
export const TramoMoraSchema = z.enum(["ninguno", "mora_1", "mora_2", "mora_3", "vencido"]);

export const PagoRegistradoSchema = z.object({
  pagoId: z.string().openapi({
    example: "PG-2026-000731",
  }),
  creditoId: z.string().regex(/^C-\d{3,8}$/).openapi({
    example: "C-004",
  }),
  recibidoEn: z.string().datetime().openapi({
    description: "Instante en formato RFC 3339 con zona horaria",
    example: "2026-08-22T09:15:00-06:00",
  }),
  montoRecibido: DineroSchema,
  aplicacion: AplicacionDelPagoSchema,
  saldoCapitalDespues: DineroSchema,
  estadoCredito: EstadoCreditoSchema,
  tramoMora: TramoMoraSchema,
  diasAtraso: z.number().int().min(0).openapi({
    example: 15,
  }),
  reproducido: z.boolean().openapi({
    description: "Indica si se reprodujo un pago anterior por idempotencia",
    example: false,
  }),
});

// ==========================================
// CARTERA EN RIESGO
// ==========================================

export const TramoCarteraSchema = z.object({
  tramo: z.enum(["mora_1", "mora_2", "mora_3", "vencido"]),
  creditos: z.number().int().min(0).openapi({
    description: "Cantidad de creditos clasificados en el tramo",
    example: 3,
  }),
  saldoCapital: DineroSchema,
});

export const CarteraEnRiesgoResponseSchema = z.object({
  fechaCorte: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).openapi({
    description: "Fecha calendario en formato AAAA-MM-DD",
    example: "2026-08-22",
  }),
  carteraActiva: DineroSchema,
  saldoEnRiesgo: DineroSchema,
  porcentajeEnRiesgo: z.number().min(0).max(1).openapi({
    description: "Proporcion entre el saldo en riesgo y la cartera activa",
    example: 0.07,
  }),
  dadoPorIncobrableEnElPeriodo: DineroSchema,
  porTramo: z.array(TramoCarteraSchema),
});

// ==========================================
// CIERRES
// ==========================================

export const CierreSchema = z.object({
  fecha: z.string().date().openapi({
    example: "2026-08-31",
  }),
  totalDesembolsos: DineroSchema,
  totalRecuperaciones: DineroSchema,
  totalInteresDevengado: DineroSchema.optional(),
  totalInteresMoratorio: DineroSchema.optional(),
  carteraActiva: DineroSchema,
  carteraEnRiesgo: DineroSchema,
  porcentajeRiesgo: z.string().openapi({
    description: "Porcentaje de cartera en riesgo como decimal",
    example: "0.0700",
  }),
  incobrablesPeriodo: DineroSchema,
  creditosActivos: z.number().int().optional().openapi({
    example: 6,
  }),
  creditosVencidos: z.number().int().optional().openapi({
    example: 1,
  }),
});