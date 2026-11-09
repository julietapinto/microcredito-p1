-- Registra aplicaciones auditables sin alterar pagos históricos canónicos.
CREATE TABLE IF NOT EXISTS aplicaciones_pagos (
  id_aplicacion BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_pago BIGINT NOT NULL REFERENCES pagos(id_pago) ON DELETE RESTRICT,
  id_cuota BIGINT NOT NULL REFERENCES cuotas_proyectadas(id_cuota) ON DELETE RESTRICT,
  gastos_centavos BIGINT NOT NULL DEFAULT 0 CHECK (gastos_centavos >= 0),
  moratorio_centavos BIGINT NOT NULL DEFAULT 0 CHECK (moratorio_centavos >= 0),
  corriente_centavos BIGINT NOT NULL DEFAULT 0 CHECK (corriente_centavos >= 0),
  capital_centavos BIGINT NOT NULL DEFAULT 0 CHECK (capital_centavos >= 0),
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (gastos_centavos + moratorio_centavos + corriente_centavos + capital_centavos > 0)
);
CREATE INDEX IF NOT EXISTS idx_aplicaciones_cuota ON aplicaciones_pagos(id_cuota);
CREATE INDEX IF NOT EXISTS idx_aplicaciones_pago ON aplicaciones_pagos(id_pago);

-- El gasto se registra una sola vez por cuota y solo para POL-2026-10.
CREATE TABLE IF NOT EXISTS gastos_gestion_cobro (
  id_gasto BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_cuota BIGINT NOT NULL UNIQUE REFERENCES cuotas_proyectadas(id_cuota) ON DELETE RESTRICT,
  monto_centavos BIGINT NOT NULL CHECK (monto_centavos > 0),
  generado_en DATE NOT NULL,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Estado explícito administrado por operación; no se infiere al cargar históricos.
CREATE TABLE IF NOT EXISTS estado_credito (
  id_credito TEXT PRIMARY KEY REFERENCES creditos(id_credito) ON DELETE RESTRICT,
  estado TEXT NOT NULL CHECK (estado IN ('VIGENTE','EN_MORA','CANCELADO','INCOBRABLE')),
  fecha_cambio DATE NOT NULL,
  motivo TEXT NOT NULL,
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Evidencia de aprobación para operaciones sensibles. La interfaz debe obtenerla
-- antes de invocar registrar_pago; este registro se escribe en la misma transacción.
CREATE TABLE IF NOT EXISTS aprobaciones_pago (
  id_aprobacion UUID PRIMARY KEY,
  id_pago BIGINT NOT NULL UNIQUE REFERENCES pagos(id_pago) ON DELETE RESTRICT,
  aprobador TEXT NOT NULL,
  aprobada_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_corte DATE NOT NULL,
  monto_confirmado_centavos BIGINT NOT NULL CHECK (monto_confirmado_centavos > 0)
);

-- Conciliación manual respaldada de pagos canónicos históricos.
CREATE TABLE IF NOT EXISTS conciliaciones_pagos_historicos (
  id_conciliacion UUID PRIMARY KEY,
  id_pago BIGINT NOT NULL UNIQUE REFERENCES pagos(id_pago) ON DELETE RESTRICT,
  aprobador TEXT NOT NULL,
  referencia_comprobante TEXT NOT NULL,
  conciliado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
