
import type { Pool, PoolClient } from "pg";

export interface FragmentoDocumento {
    documento: string;
    identificador: string;
    seccion: string;
    contenido: string;
    metadata?: Record<string, unknown>;
    embedding: readonly number[];
}

export interface FragmentoRecuperado {
    documento: string;
    identificador: string;
    seccion: string;
    contenido: string;
    metadata: Record<string, unknown>;
    similitud: number;
}

interface FilaFragmento {
    documento: string;
    identificador: string;
    seccion: string;
    contenido: string;
    metadata: Record<string, unknown>;
    similitud: number | string;
}

const DIMENSIONES_EMBEDDING = 1024;

function validarTexto(valor: string, campo: string): void {
    if (typeof valor !== "string" || valor.trim().length === 0) {
        throw new Error(`El campo ${campo} no puede estar vacío.`);
    }
}

function validarEmbedding(embedding: readonly number[]): void {
    if (
        !Array.isArray(embedding) ||
        embedding.length !== DIMENSIONES_EMBEDDING
    ) {
        throw new Error(
            "El embedding debe contener 1024 dimensiones."
        );
    }

    if (
        !embedding.every(
            (valor) => typeof valor === "number" && Number.isFinite(valor)
        )
    ) {
        throw new Error(
            "El embedding contiene valores numéricos inválidos."
        );
    }

    if (embedding.every((valor) => valor === 0)) {
        throw new Error("El embedding no puede contener únicamente ceros.");
    }
}

function validarFragmento(fragmento: FragmentoDocumento): void {
    validarTexto(fragmento.documento, "documento");
    validarTexto(fragmento.identificador, "identificador");
    validarTexto(fragmento.seccion, "seccion");
    validarTexto(fragmento.contenido, "contenido");
    validarEmbedding(fragmento.embedding);
}

function serializarEmbedding(embedding: readonly number[]): string {
    return `[${embedding.join(",")}]`;
}

async function ejecutarGuardado(
    cliente: Pool | PoolClient,
    fragmento: FragmentoDocumento
): Promise<void> {
    validarFragmento(fragmento);

    await cliente.query(
        `INSERT INTO fragmentos (
            documento,
            identificador,
            seccion,
            contenido,
            metadata,
            embedding
        )
        VALUES ($1, $2, $3, $4, $5::jsonb, $6::vector)
        ON CONFLICT (documento, identificador)
        DO UPDATE SET
            seccion = EXCLUDED.seccion,
            contenido = EXCLUDED.contenido,
            metadata = EXCLUDED.metadata,
            embedding = EXCLUDED.embedding`,
        [
            fragmento.documento,
            fragmento.identificador,
            fragmento.seccion,
            fragmento.contenido,
            JSON.stringify(fragmento.metadata ?? {}),
            serializarEmbedding(fragmento.embedding)
        ]
    );
}

export class RepositorioFragmentosPostgres {
    constructor(private readonly pool: Pool) {}

    async guardar(fragmento: FragmentoDocumento): Promise<void> {
        await ejecutarGuardado(this.pool, fragmento);
    }

    async guardarMuchos(
        fragmentos: readonly FragmentoDocumento[]
    ): Promise<void> {
        if (fragmentos.length === 0) {
            return;
        }

        const cliente = await this.pool.connect();

        try {
            await cliente.query("BEGIN");

            for (const fragmento of fragmentos) {
                await ejecutarGuardado(cliente, fragmento);
            }

            await cliente.query("COMMIT");
        } catch (error) {
            await cliente.query("ROLLBACK");
            throw error;
        } finally {
            cliente.release();
        }
    }

    async buscarSimilares(
        embedding: readonly number[],
        limite = 5
    ): Promise<FragmentoRecuperado[]> {
        validarEmbedding(embedding);

        if (
            !Number.isInteger(limite) ||
            limite < 1 ||
            limite > 100
        ) {
            throw new Error(
                "El límite de resultados debe estar entre 1 y 100."
            );
        }

        const resultado = await this.pool.query<FilaFragmento>(
            `SELECT
                documento,
                identificador,
                seccion,
                contenido,
                metadata,
                1 - (embedding <=> $1::vector) AS similitud
            FROM fragmentos
            WHERE embedding IS NOT NULL
            ORDER BY embedding <=> $1::vector
            LIMIT $2`,
            [serializarEmbedding(embedding), limite]
        );

        return resultado.rows.map((fila) => ({
            documento: fila.documento,
            identificador: fila.identificador,
            seccion: fila.seccion,
            contenido: fila.contenido,
            metadata: fila.metadata ?? {},
            similitud: Number(fila.similitud)
        }));
    }

    async eliminarDocumento(documento: string): Promise<number> {
        validarTexto(documento, "documento");

        const resultado = await this.pool.query(
            "DELETE FROM fragmentos WHERE documento = $1",
            [documento]
        );

        return resultado.rowCount ?? 0;
    }
}
