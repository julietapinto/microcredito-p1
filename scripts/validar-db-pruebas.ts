
export function validarBaseDePruebas(connectionString: string): void {
    let databaseName: string;

    try {
        const url = new URL(connectionString);

        databaseName = decodeURIComponent(
            url.pathname.replace(/^\/+/, "")
        );
    } catch {
        throw new Error(
            "OPERACIÓN BLOQUEADA: DATABASE_URL no es válida."
        );
    }

    if (databaseName !== "credito_vecino_test") {
        throw new Error(
            `OPERACIÓN BLOQUEADA: se esperaba credito_vecino_test, pero se recibió ${databaseName}.`
        );
    }
}
