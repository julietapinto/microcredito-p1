
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";
import { validarBaseDePruebas } from "./validar-db-pruebas.js";

async function main(): Promise<void> {
  // 1. Obtener y validar la conexi├│n antes de crear el Pool.
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
        "OPERACI├ôN BLOQUEADA: defina DATABASE_URL antes de ejecutar las migraciones."
    );
  }

  validarBaseDePruebas(connectionString);

  console.log(
      "Base de datos validada: credito_vecino_test"
  );

  // 2. Crear conexi├│n ├║nicamente despu├®s de validar la base.
  const pool = new Pool({ connectionString });

  let client;

  try {
    client = await pool.connect();

    await client.query("SELECT pg_advisory_lock($1)", [7342026]);

    await client.query(`
            CREATE TABLE IF NOT EXISTS schema_migrations (
                version TEXT PRIMARY KEY,
                aplicado_en TIMESTAMPTZ NOT NULL DEFAULT now()
            )
        `);

    const directorio = path.resolve(
        "src/persistencia/migrations"
    );

    const archivos = (await readdir(directorio))
        .filter((archivo) =>
            /^\d{3}_[a-z0-9_-]+\.sql$/i.test(archivo)
        )
        .sort((a, b) => a.localeCompare(b));

    console.log(`Migraciones encontradas: ${archivos.length}`);

    for (const archivo of archivos) {
      const aplicada = await client.query(
          "SELECT 1 FROM schema_migrations WHERE version = $1",
          [archivo]
      );

      if (aplicada.rowCount) {
        console.log(`Omitida ${archivo} (ya aplicada).`);
        continue;
      }

      const sql = await readFile(
          path.join(directorio, archivo),
          "utf8"
      );

      await client.query("BEGIN");

      try {
        await client.query(sql);

        await client.query(
            "INSERT INTO schema_migrations(version) VALUES ($1)",
            [archivo]
        );

        await client.query("COMMIT");

        console.log(`Aplicada ${archivo}.`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }

    console.log(
        "Migraciones finalizadas correctamente."
    );
  } finally {
    if (client) {
      try {
        await client.query(
            "SELECT pg_advisory_unlock($1)",
            [7342026]
        );
      } finally {
        client.release();
      }
    }

    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(
      "Error al ejecutar migraciones:",
      error
  );

  process.exitCode = 1;
});
