import * as z from "zod/v4";

export const esquemaDineroMcp = z.object({
  monto: z
    .string()
    .regex(
      /^\d+\.\d{2}$/,
      "El monto debe tener dos decimales"
    ),
  moneda: z.string().min(1)
});

const esquemaTramoMora = z.enum([
  "SIN_MORA",
  "MORA_1",
  "MORA_2",
  "MORA_3",
  "VENCIDO",
  "INCOBRABLE"
]);

const esquemaEstadoCredito = z.enum([
  "SOLICITADO",
  "APROBADO",
  "RECHAZADO",
  "ANULADO",
  "VIGENTE",
  "EN_MORA",
  "REESTRUCTURADO",
  "CANCELADO",
  "INCOBRABLE"
]);

export const esquemaConsultaCredito = z.object({
  idCredito: z.string(),
  estado: esquemaEstadoCredito,
  saldo: esquemaDineroMcp,
  diasAtraso: z.number().int().nonnegative(),
  tramo: esquemaTramoMora,
  cuotasPagadas: z.number().int().nonnegative(),
  cuotasVencidas: z.number().int().nonnegative(),
  proximaCuota: z
    .object({
      numero: z.number().int().positive(),
      fechaVencimiento: z.iso.date(),
      monto: esquemaDineroMcp
    })
    .nullable()
});

export const esquemaDeudaCuota = z.object({
  idCredito: z.string(),
  numeroCuota: z.number().int().positive(),
  fechaCorte: z.iso.date(),
  gastos: esquemaDineroMcp,
  interesMoratorio: esquemaDineroMcp,
  interesCorriente: esquemaDineroMcp,
  capital: esquemaDineroMcp,
  totalExigible: esquemaDineroMcp
});

export const esquemaExplicacionMora = z.object({
  idCredito: z.string(),
  fechaCorte: z.iso.date(),
  capitalEnMora: esquemaDineroMcp,
  tramosRecorridos: z.array(
    z.object({
      tramo: z.string(),
      dias: z.number().int().nonnegative(),
      tasaNominalAnual: z.string(),
      interesGenerado: esquemaDineroMcp
    })
  ),
  interesMoratorioTotal: esquemaDineroMcp
});

export const esquemaListadoMora = z.object({
  fechaCorte: z.iso.date(),
  filtroTramo: esquemaTramoMora.nullable(),
  totalCreditos: z.number().int().nonnegative(),
  creditos: z.array(
    z.object({
      idCredito: z.string(),
      diasAtraso: z.number().int().nonnegative(),
      tramo: esquemaTramoMora,
      saldo: esquemaDineroMcp
    })
  )
});

export const esquemaProximosVencimientos =
  z.object({
    fechaCorte: z.iso.date(),
    ventanaDias: z.number().int().nonnegative(),
    totalCuotas: z.number().int().nonnegative(),
    montoTotal: esquemaDineroMcp,
    cuotas: z.array(
      z.object({
        idCredito: z.string(),
        numeroCuota: z.number().int().positive(),
        fechaVencimiento: z.iso.date(),
        monto: esquemaDineroMcp
      })
    )
  });

export const esquemaConsultaCartera = z.object({
  fechaCorte: z.iso.date(),
  carteraActiva: esquemaDineroMcp,
  carteraEnMora: esquemaDineroMcp,
  carteraEnRiesgo: esquemaDineroMcp,
  porcentajeEnRiesgo: z.string(),
  desglosePorTramo: z.array(
    z.object({
      tramo: esquemaTramoMora,
      cantidadCreditos:
        z.number().int().nonnegative(),
      capital: esquemaDineroMcp
    })
  ),
  incobrableDelPeriodo: esquemaDineroMcp
});

export const esquemaConsultaCierre = z.object({
  tipo: z.enum(["DIARIO", "MENSUAL"]),
  fechaCorte: z.iso.date(),
  periodoDesde: z.iso.date(),
  periodoHasta: z.iso.date(),
  desembolsos: esquemaDineroMcp,
  recuperaciones: z.object({
    gastos: esquemaDineroMcp,
    interesMoratorio: esquemaDineroMcp,
    interesCorriente: esquemaDineroMcp,
    capital: esquemaDineroMcp,
    total: esquemaDineroMcp
  })
});

const esquemaPagoRegistrado = z.object({
  idPago: z.string(),
  idCredito: z.string(),
  fechaCorte: z.iso.date(),
  monto: esquemaDineroMcp,
  claveIdempotencia: z.string(),
  reutilizado: z.boolean(),
  aplicacion: z.object({
    gastos: esquemaDineroMcp,
    interesMoratorio: esquemaDineroMcp,
    interesCorriente: esquemaDineroMcp,
    capital: esquemaDineroMcp
  }),
  estadoCredito: esquemaEstadoCredito
});

const esquemaPagoPendiente = z.object({
  estado: z.literal("PENDIENTE_APROBACION"),
  ejecutado: z.literal(false),
  requiereAprobacion: z.literal(true),
  mensaje: z.string(),
  propuesta: z.object({
    idCredito: z.string(),
    monto: esquemaDineroMcp,
    fechaCorte: z.iso.date(),
    claveIdempotencia: z.string()
  })
});

export const esquemaRespuestaRegistroPago =
  z.union([
    esquemaPagoRegistrado,
    esquemaPagoPendiente
  ]);