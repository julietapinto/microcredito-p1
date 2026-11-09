import { Pool } from "pg";
import { RepositorioPagosPostgres } from "../../persistencia/repositorios/repositorio-pagos-postgres.js";

export interface ServicioMcp {
    readonly pool: Pool;
    readonly repositorioPagos: RepositorioPagosPostgres;
    cerrar(): Promise<void>;
}

export function crearServicioMcp(
    databaseUrl: string
): ServicioMcp {
    if (databaseUrl.trim() === "") {
        throw new Error("DATABASE_URL no puede estar vacío.");
    }

    const pool = new Pool({
        connectionString: databaseUrl,
        max: 10,
        connectionTimeoutMillis: 5000
    });

    const repositorioPagos = new RepositorioPagosPostgres(pool);

    return {
        pool,
        repositorioPagos,
        async cerrar(): Promise<void> {
            await pool.end();
        }
    };
}