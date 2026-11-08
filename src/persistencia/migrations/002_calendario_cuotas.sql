CREATE TABLE IF NOT EXISTS cuotas_proyectadas (
  id_cuota BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_credito TEXT NOT NULL REFERENCES creditos(id_credito) ON DELETE CASCADE,
  numero_cuota INTEGER NOT NULL CHECK (numero_cuota > 0),
  fecha_vencimiento DATE NOT NULL,
  saldo_capital_inicial_centavos BIGINT NOT NULL CHECK (saldo_capital_inicial_centavos >= 0),
  monto_cuota_centavos BIGINT NOT NULL CHECK (monto_cuota_centavos > 0),
  interes_corriente_centavos BIGINT NOT NULL CHECK (interes_corriente_centavos >= 0),
  amortizacion_centavos BIGINT NOT NULL CHECK (amortizacion_centavos >= 0),
  saldo_capital_final_centavos BIGINT NOT NULL CHECK (saldo_capital_final_centavos >= 0),
  tipo_calendario TEXT NOT NULL DEFAULT 'PROYECTADO'
    CHECK (tipo_calendario = 'PROYECTADO'),
  generado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (id_credito, numero_cuota)
);

CREATE INDEX IF NOT EXISTS idx_cuotas_proyectadas_vencimiento
  ON cuotas_proyectadas(fecha_vencimiento, id_credito);

CREATE INDEX IF NOT EXISTS idx_cuotas_proyectadas_credito
  ON cuotas_proyectadas(id_credito, numero_cuota);
