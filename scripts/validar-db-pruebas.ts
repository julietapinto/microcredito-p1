
export function validarBaseDePruebas(connectionString: string): void {
    let databaseName: string;

    try {
        const url = new URL(connectionString);

        databaseName = decodeURIComponent(
            url.pathname.replace(/^\/+/, "")
        );
    } catch {
        throw new Error(
            "OPERACI├ôN BLOQUEADA: DATABASE_URL no es v├ílida."
        );
    }

    if (databaseName !== "credito_vecino_test") {
        throw new Error(
            `OPERACI├ôN BLOQUEADA: se esperaba credito_vecino_test, pero se recibi├│ ${databaseName}.`
        );
    }
}
