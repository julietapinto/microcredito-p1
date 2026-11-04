
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { Dinero } from "../src/dominio/dinero.js";
import {
  ConflictoIdempotenciaError,
  RepositorioPagosPostgres
} from "../src/persistencia/repositorios/repositorio-pagos-postgres.js";

describe("RepositorioPagosPostgres", () => {
  let pool: Pool;
  let repositorio: RepositorioPagosPostgres;

  const clave = "TEST-IDEM-POSTGRES-001";
  const idCredito = "CV-2026-0001";

  beforeAll(() => {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error(
        "Debes configurar DATABASE_URL antes de ejecutar estas pruebas."
      );
    }

    pool = new Pool({ connectionString });
    repositorio = new RepositorioPagosPostgres(pool);
  });

  beforeEach(async () => {
    await pool.query(
      "DELETE FROM pagos WHERE clave_idempotencia LIKE 'TEST-IDEM-POSTGRES-%'"
    );
  });

  afterAll(async () => {
    if (pool) {
      await pool.query(
        "DELETE FROM pagos WHERE clave_idempotencia LIKE 'TEST-IDEM-POSTGRES-%'"
      );
      await pool.end();
    }
  });

  it("registra un pago nuevo en PostgreSQL", async () => {
    const pago = {
      idPago: "TEST-PAGO-001",
      idCredito,
      claveIdempotencia: clave,
      monto: Dinero.desde("100.00")
    };

    const guardado = await repositorio.guardarAsync(
      pago,
      "2026-11-01",
      "efectivo"
    );

    expect(guardado.idCredito).toBe(idCredito);
    expect(guardado.claveIdempotencia).toBe(clave);
    expect(guardado.monto.comoTexto()).toBe("100.00");
  });

  it("recupera el pago original cuando se repite la misma clave", async () => {
    const pago = {
      idPago: "TEST-PAGO-002",
      idCredito,
      claveIdempotencia: clave,
      monto: Dinero.desde("150.00")
    };

    const primero = await repositorio.guardarAsync(
      pago,
      "2026-11-01",
      "efectivo"
    );

    const segundo = await repositorio.guardarAsync(
      pago,
      "2026-11-01",
      "efectivo"
    );

    expect(segundo.idPago).toBe(primero.idPago);
    expect(segundo.monto.comoTexto()).toBe("150.00");
  });

  it("rechaza una clave reutilizada con otro monto", async () => {
    const pagoOriginal = {
      idPago: "TEST-PAGO-003",
      idCredito,
      claveIdempotencia: clave,
      monto: Dinero.desde("200.00")
    };

    await repositorio.guardarAsync(
      pagoOriginal,
      "2026-11-01",
      "efectivo"
    );

    const pagoDiferente = {
      ...pagoOriginal,
      idPago: "TEST-PAGO-004",
      monto: Dinero.desde("250.00")
    };

    await expect(
      repositorio.guardarAsync(
        pagoDiferente,
        "2026-11-01",
        "efectivo"
      )
    ).rejects.toBeInstanceOf(ConflictoIdempotenciaError);
  });

  it("permite recuperar un pago mediante su clave", async () => {
    const pago = {
      idPago: "TEST-PAGO-005",
      idCredito,
      claveIdempotencia: clave,
      monto: Dinero.desde("300.00")
    };

    await repositorio.guardarAsync(
      pago,
      "2026-11-01",
      "transferencia"
    );

    const recuperado =
      await repositorio.buscarPorClaveAsync(clave);

    expect(recuperado).toBeDefined();
    expect(recuperado?.monto.comoTexto()).toBe("300.00");
  });
});
