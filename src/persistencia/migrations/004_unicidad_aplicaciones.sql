
-- Migración 004: unicidad de aplicaciones de pagos.
-- Impide que un mismo pago se aplique dos veces a una cuota.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM aplicaciones_pagos
    GROUP BY id_pago, id_cuota
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Hay aplicaciones duplicadas. Revisar antes de crear el índice.';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS
  uq_aplicaciones_pago_cuota
ON aplicaciones_pagos (id_pago, id_cuota);
