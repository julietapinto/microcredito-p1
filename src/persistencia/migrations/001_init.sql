CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS asesores (
  id_asesor TEXT PRIMARY KEY,
  nombre_completo TEXT NOT NULL,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS clientes (
  id_cliente TEXT PRIMARY KEY,
  nombre_completo TEXT NOT NULL,
  dpi TEXT NOT NULL UNIQUE,
  telefono TEXT NOT NULL,
  municipio TEXT NOT NULL,
  fecha_alta DATE NOT NULL,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS creditos (
  id_credito TEXT PRIMARY KEY,
  id_cliente TEXT NOT NULL REFERENCES clientes(id_cliente),
  id_asesor TEXT NOT NULL REFERENCES asesores(id_asesor),
  fecha_otorgamiento DATE NOT NULL,
  capital_centavos BIGINT NOT NULL CHECK (capital_centavos > 0),
  plazo_meses INTEGER NOT NULL CHECK (plazo_meses > 0),
  tna_bps INTEGER NOT NULL CHECK (tna_bps >= 0),
  reestructurado BOOLEAN NOT NULL DEFAULT FALSE,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pagos (
  id_pago BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  clave_idempotencia TEXT NOT NULL UNIQUE,
  id_credito TEXT NOT NULL REFERENCES creditos(id_credito),
  fecha DATE NOT NULL,
  monto_centavos BIGINT NOT NULL CHECK (monto_centavos > 0),
  canal TEXT NOT NULL,
  origen TEXT NOT NULL DEFAULT 'CANONICO',
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS eventos (
  seq INTEGER PRIMARY KEY CHECK (seq > 0),
  tipo TEXT NOT NULL CHECK (tipo IN ('CLIENTE', 'DESEMBOLSO', 'PAGO')),
  payload JSONB NOT NULL,
  clave_idempotencia TEXT,
  aplicado BOOLEAN NOT NULL DEFAULT TRUE,
  motivo_omision TEXT,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS politicas (
  codigo TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  tipo TEXT NOT NULL,
  vigencia_desde DATE,
  vigencia_hasta DATE,
  parametros JSONB NOT NULL,
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- BGE-M3 produce vectores de 1024 dimensiones.
CREATE TABLE IF NOT EXISTS fragmentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  documento TEXT NOT NULL,
  identificador TEXT NOT NULL,
  seccion TEXT,
  contenido TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  embedding VECTOR(1024),
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (documento, identificador)
);

CREATE INDEX IF NOT EXISTS idx_creditos_cliente ON creditos(id_cliente);
CREATE INDEX IF NOT EXISTS idx_creditos_asesor ON creditos(id_asesor);
CREATE INDEX IF NOT EXISTS idx_creditos_fecha ON creditos(fecha_otorgamiento);
CREATE INDEX IF NOT EXISTS idx_pagos_credito_fecha ON pagos(id_credito, fecha);
CREATE INDEX IF NOT EXISTS idx_eventos_tipo_seq ON eventos(tipo, seq);
CREATE INDEX IF NOT EXISTS idx_eventos_clave ON eventos(clave_idempotencia)
  WHERE clave_idempotencia IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_fragmentos_documento ON fragmentos(documento);
CREATE INDEX IF NOT EXISTS idx_fragmentos_embedding
  ON fragmentos USING hnsw (embedding vector_cosine_ops);

