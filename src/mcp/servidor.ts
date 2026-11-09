import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { crearServidorMcpPostgres } from "./crear-servidor-postgres.js";
import { crearServicioMcp } from "./servicios/servicio-mcp.js";

async function iniciarServidor(): Promise<void> {
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
        throw new Error(
            "Debe definir DATABASE_URL para iniciar el servidor MCP."
        );
    }

    const servicio = crearServicioMcp(databaseUrl);
    const servidor = crearServidorMcpPostgres(servicio.pool);
    const transporte = new StdioServerTransport();

    let cierreEnCurso: Promise<void> | undefined;

    const cerrar = (): Promise<void> => {
        if (!cierreEnCurso) {
            cierreEnCurso = (async () => {
                try {
                    await servidor.close();
                } finally {
                    await servicio.cerrar();
                }
            })();
        }

        return cierreEnCurso;
    };

    process.stdin.once("end", () => {
        void cerrar();
    });

    process.once("SIGINT", () => {
        void cerrar().finally(() => process.exit(0));
    });

    process.once("SIGTERM", () => {
        void cerrar().finally(() => process.exit(0));
    });

    await servidor.connect(transporte);

    console.error(
        "Servidor MCP de Crédito Vecino ejecutándose por stdio"
    );
}

iniciarServidor().catch((error: unknown) => {
    console.error("No se pudo iniciar el servidor MCP:", error);
    process.exitCode = 1;
});

