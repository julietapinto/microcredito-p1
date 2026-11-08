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
  const fecha = "2026-11-01";
  const canal = "efectivo";

  beforeAll(() => {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString?.includes("/credito_vecino_test")) {
      throw new Error("Las pruebas requieren credito_vecino_test.");
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

  const crearPago = (monto = "100.00", credito = idCredito) => ({
    idPago: "TEST-PAGO-001",
    idCredito: credito,
    claveIdempotencia: clave,
    monto: Dinero.desde(monto)
  });

  it("registra un pago nuevo", async () => {
    const guardado = await repositorio.guardarAsync(
      crearPago(), fecha, canal
    );
    expect(guardado.idCredito).toBe(idCredito);
    expect(guardado.monto.comoTexto()).toBe("100.00");
  });

  it("recupera el pago original al repetir la misma solicitud", async () => {
    const primero = await repositorio.guardarAsync(
      crearPago(), fecha, canal
    );
    const segundo = await repositorio.guardarAsync(
      crearPago(), fecha, canal
    );
    expect(segundo.idPago).toBe(primero.idPago);

    const conteo = await pool.query(
      "SELECT COUNT(*)::int AS total FROM pagos WHERE clave_idempotencia=$1",
      [clave]
    );
    expect(conteo.rows[0].total).toBe(1);
  });

  it.each([
    ["otro monto", crearPago("250.00"), fecha, canal],
    ["otro crédito", crearPago("100.00", "CV-2026-OTRO"), fecha, canal],
    ["otra fecha", crearPago(), "2026-11-02", canal],
    ["otro canal", crearPago(), fecha, "transferencia"]
  ])("rechaza la misma clave con %s", async (_caso, pago, otraFecha, otroCanal) => {
    await repositorio.guardarAsync(crearPago(), fecha, canal);

    await expect(
      repositorio.guardarAsync(pago, otraFecha, otroCanal)
    ).rejects.toBeInstanceOf(ConflictoIdempotenciaError);
  });

  it("recupera un pago mediante su clave", async () => {
    await repositorio.guardarAsync(crearPago("300.00"), fecha, "transferencia");

    const recuperado = await repositorio.buscarPorClaveAsync(clave);

    expect(recuperado).toBeDefined();
    expect(recuperado?.monto.comoTexto()).toBe("300.00");
  });
});
