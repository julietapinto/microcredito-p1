
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Pool } from "pg";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { Dinero } from "../../dominio/dinero.js";

import {
    calcularDeudaCredito,
    aplicarPagoParcial,
    generarGastosGestionCobro
} from "../../persistencia/servicios/deuda-cuotas-postgres.js";

import {
    asegurarCalendarioProyectado
} from "../../persistencia/servicios/calendario-cuotas-postgres.js";

function validarFecha(fecha: string): boolean {
    const d = new Date(`${fecha}T00:00:00.000Z`);

    return (
        !Number.isNaN(d.getTime()) &&
        d.toISOString().slice(0, 10) === fecha
    );
}

function centavos(monto: Dinero): bigint {
    return BigInt(
        monto.comoDecimal().times(100).toFixed(0)
    );
}

function textoDinero(valor: string): string {
    const cantidad = BigInt(valor);

    return `Q${cantidad / 100n}.${(cantidad % 100n)
        .toString()
        .padStart(2, "0")}`;
}

function centavosDesdeTexto(valor: string): bigint {
    const normalizado = valor.replace(/^Q\s?/, "").trim();

    const partes = normalizado.split(".");
    const entero = partes[0] ?? "0";
    const decimal = partes[1] ?? "00";

    if (!/^\d+$/.test(entero) || !/^\d{1,2}$/.test(decimal)) {
        throw new Error(`Importe inválido: ${valor}`);
    }

    return (
        BigInt(entero) * 100n +
        BigInt(decimal.padEnd(2, "0"))
    );
}

export function registrarPago(
    servidor: McpServer,
    pool: Pool
): void {
    servidor.registerTool(
        "registrar_pago",
        {
            title: "Registrar pago parcial o exacto de crédito",

            description:
                "Registra pagos parciales o exactos hasta el total exigible. " +
                "Aplica la prelación gastos, mora, interés corriente y capital. " +
                "Exige aprobación humana explícita y confirmación de cobrabilidad. " +
                "Utiliza idempotencia y transacciones atómicas.",

            inputSchema: {
                id_credito: z.string().trim().min(1),
                monto: z.string().regex(/^\d+(\.\d{1,2})?$/),
                clave_idempotencia: z.string().trim().min(1).max(150),
                fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
                fecha_corte: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
                canal: z.string().trim().min(1).max(50),
                aprobacion_humana: z.literal(true),
                aprobador: z.string().trim().min(2).max(120),
                credito_cobrable_confirmado: z.literal(true)
            }
        },

        async ({
                   id_credito,
                   monto,
                   clave_idempotencia,
                   fecha,
                   fecha_corte,
                   canal,
                   aprobacion_humana,
                   aprobador,
                   credito_cobrable_confirmado
               }) => {
            // Defensa en profundidad: no depender únicamente de la validación Zod/MCP.
            // Rechazar antes de adquirir conexión o iniciar cualquier operación de BD.
            if (
                aprobacion_humana !== true ||
                credito_cobrable_confirmado !== true
            ) {
                return {
                    content: [{
                        type: "text",
                        text: "Pago rechazado: se requiere aprobación humana explícita y confirmación de cobrabilidad."
                    }],
                    isError: true
                };
            }

            const client = await pool.connect();
            let transaccionIniciada = false;

            try {
                if (
                    !validarFecha(fecha) ||
                    !validarFecha(fecha_corte) ||
                    fecha !== fecha_corte
                ) {
                    throw new Error(
                        "La fecha del pago y la fecha de corte deben ser iguales y válidas."
                    );
                }

                const importe = Dinero.desde(monto);

                if (importe.esCero() || importe.esNegativo()) {
                    throw new Error("El monto del pago debe ser mayor que cero.");
                }

                await asegurarCalendarioProyectado(pool, id_credito);

                await client.query("BEGIN");
                transaccionIniciada = true;

                const credito = await client.query<{
                    id_credito: string;
                    fecha_otorgamiento: string;
                }>(
                    `SELECT
                         id_credito,
                         fecha_otorgamiento::text
                     FROM creditos
                     WHERE id_credito = $1
                         FOR UPDATE`,
                    [id_credito]
                );

                const datosCredito = credito.rows[0];

                if (!datosCredito) {
                    throw new Error(`No existe el crédito ${id_credito}.`);
                }

                // Comprobar idempotencia antes de validar el estado.
                const existente = await client.query<{
                    id_pago: string;
                    id_credito: string;
                    monto_centavos: string;
                    fecha: string;
                    canal: string;
                    origen: string;
                }>(
                    `SELECT
                         id_pago::text,
                         id_credito,
                         monto_centavos::text,
                         fecha::text,
                         canal,
                         origen
                     FROM pagos
                     WHERE clave_idempotencia = $1
                         FOR UPDATE`,
                    [clave_idempotencia]
                );

                if (existente.rows[0]) {
                    const pago = existente.rows[0];

                    const mismo =
                        pago.id_credito === id_credito &&
                        BigInt(pago.monto_centavos) === centavos(importe) &&
                        pago.fecha === fecha &&
                        pago.canal === canal;

                    if (!mismo) {
                        throw new Error(
                            "Conflicto de idempotencia: la clave ya fue utilizada con otros datos."
                        );
                    }

                    if (pago.origen !== "API") {
                        throw new Error(
                            "La clave pertenece a un pago histórico canónico."
                        );
                    }

                    const evidencia = await client.query<{
                        aprobaciones: string;
                        aplicaciones: string;
                        total_aplicado: string;
                        monto_aprobado: string | null;
                    }>(
                        `SELECT
                             (
                                 SELECT COUNT(*)::text
                                 FROM aprobaciones_pago
                                 WHERE id_pago = $1
                             ) AS aprobaciones,
                             (
                                 SELECT COUNT(*)::text
                                 FROM aplicaciones_pagos
                                 WHERE id_pago = $1
                             ) AS aplicaciones,
                             (
                                 SELECT COALESCE(
                                                SUM(
                                                        gastos_centavos +
                                                        moratorio_centavos +
                                                        corriente_centavos +
                                                        capital_centavos
                                                ), 0
                                        )::text
                                 FROM aplicaciones_pagos
                                 WHERE id_pago = $1
                             ) AS total_aplicado,
                             (
                                 SELECT monto_confirmado_centavos::text
                                 FROM aprobaciones_pago
                                 WHERE id_pago = $1
                             ) AS monto_aprobado`,
                        [pago.id_pago]
                    );

                    const comprobacion = evidencia.rows[0];

                    if (!comprobacion) {
                        throw new Error(
                            "No se pudo recuperar la evidencia del pago."
                        );
                    }

                    if (
                        comprobacion.aprobaciones !== "1" ||
                        comprobacion.aplicaciones === "0" ||
                        BigInt(comprobacion.total_aplicado) !==
                        BigInt(pago.monto_centavos) ||
                        comprobacion.monto_aprobado === null ||
                        BigInt(comprobacion.monto_aprobado) !==
                        BigInt(pago.monto_centavos)
                    ) {
                        throw new Error(
                            "El pago existente no tiene evidencia completa de aprobación y aplicación."
                        );
                    }

                    await client.query("COMMIT");
                    transaccionIniciada = false;

                    const datos = {
                        resultado: "PAGO_YA_REGISTRADO",
                        idPago: pago.id_pago,
                        idCredito: pago.id_credito,
                        monto: importe.comoTexto(),
                        fecha: pago.fecha,
                        canal: pago.canal
                    };

                    return {
                        content: [{
                            type: "text",
                            text: JSON.stringify(datos, null, 2)
                        }],
                        structuredContent: datos
                    };
                }

                // Si el crédito aún no tiene historial de estado,
                // se inicializa como VIGENTE usando su fecha de otorgamiento.
                await client.query(
                    `INSERT INTO estado_credito (
                        id_credito,
                        estado,
                        fecha_cambio,
                        motivo
                    )
                     VALUES ($1, 'VIGENTE', $2::date, $3)
                         ON CONFLICT (id_credito) DO NOTHING`,
                    [
                        id_credito,
                        datosCredito.fecha_otorgamiento,
                        "Estado inicial creado al registrar el primer pago."
                    ]
                );

                const estadoActual = await client.query<{
                    estado: string;
                }>(
                    `SELECT estado
                     FROM estado_credito
                     WHERE id_credito = $1
                         FOR UPDATE`,
                    [id_credito]
                );

                const estado = estadoActual.rows[0]?.estado;

                if (!estado) {
                    throw new Error(
                        "No se pudo determinar el estado actual del crédito."
                    );
                }

                if (estado === "CANCELADO" || estado === "INCOBRABLE") {
                    throw new Error(
                        `El crédito está en estado ${estado} y no admite pagos ordinarios.`
                    );
                }

                // Generar cargos de gestión dentro de esta transacción.
                // Se ejecuta después de idempotencia y validación del estado;
                // los reintentos no regeneran cargos y un ROLLBACK los revierte.
                await generarGastosGestionCobro(
                    client,
                    id_credito,
                    fecha_corte
                );

                const deuda = await calcularDeudaCredito(
                    pool,
                    id_credito,
                    fecha_corte,
                    client
                );

                if (deuda.incobrable) {
                    throw new Error(
                        "Crédito incobrable: no se permiten pagos ordinarios."
                    );
                }

                if (deuda.pagosCanonicosSinConciliar > 0) {
                    throw new Error(
                        "El crédito tiene pagos históricos sin conciliar."
                    );
                }

                if (!deuda.registroPermitido) {
                    throw new Error(
                        "No existe una deuda exigible registrable."
                    );
                }

                const exigible = centavosDesdeTexto(
                    deuda.total.exigible
                );

                if (centavos(importe) > exigible) {
                    throw new Error(
                        `MONTO_EXCEDIDO: la deuda exigible es ${deuda.total.exigible}.`
                    );
                }

                const insertado = await client.query<{
                    id_pago: string;
                }>(
                    `INSERT INTO pagos (
                        clave_idempotencia,
                        id_credito,
                        fecha,
                        monto_centavos,
                        canal,
                        origen
                    )
                     VALUES ($1, $2, $3, $4, $5, 'API')
                         RETURNING id_pago::text`,
                    [
                        clave_idempotencia,
                        id_credito,
                        fecha,
                        centavos(importe).toString(),
                        canal
                    ]
                );

                const idPago = insertado.rows[0]?.id_pago;

                if (!idPago) {
                    throw new Error("No se pudo recuperar el identificador del pago.");
                }

                await aplicarPagoParcial(
                    client,
                    idPago,
                    deuda,
                    importe
                );

                await client.query(
                    `INSERT INTO aprobaciones_pago (
                        id_aprobacion,
                        id_pago,
                        aprobador,
                        fecha_corte,
                        monto_confirmado_centavos
                    )
                     VALUES ($1, $2, $3, $4, $5)`,
                    [
                        randomUUID(),
                        idPago,
                        aprobador,
                        fecha_corte,
                        centavos(importe).toString()
                    ]
                );

                const aplicacionResult = await client.query<{
                    gastos: string;
                    moratorio: string;
                    corriente: string;
                    capital: string;
                }>(
                    `SELECT
                         COALESCE(SUM(gastos_centavos), 0)::text AS gastos,
                         COALESCE(SUM(moratorio_centavos), 0)::text AS moratorio,
                         COALESCE(SUM(corriente_centavos), 0)::text AS corriente,
                         COALESCE(SUM(capital_centavos), 0)::text AS capital
                     FROM aplicaciones_pagos
                     WHERE id_pago = $1`,
                    [idPago]
                );

                const aplicacion = aplicacionResult.rows[0];

                if (!aplicacion) {
                    throw new Error("No se pudo recuperar la aplicación del pago.");
                }

                const totalAplicado =
                    BigInt(aplicacion.gastos) +
                    BigInt(aplicacion.moratorio) +
                    BigInt(aplicacion.corriente) +
                    BigInt(aplicacion.capital);

                if (totalAplicado !== centavos(importe)) {
                    throw new Error(
                        "La suma de aplicaciones no coincide con el pago registrado."
                    );
                }

                const saldoCapital = await client.query<{
                    saldo: string;
                }>(
                    `WITH aplicado AS (
                        SELECT
                            id_cuota,
                            SUM(capital_centavos) AS capital
                        FROM aplicaciones_pagos
                        GROUP BY id_cuota
                    )
                     SELECT COALESCE(
                                    SUM(
                                            GREATEST(
                                                    q.amortizacion_centavos -
                                                    COALESCE(a.capital, 0),
                                                    0
                                            )
                                    ), 0
                            )::text AS saldo
                     FROM cuotas_proyectadas q
                              LEFT JOIN aplicado a ON a.id_cuota = q.id_cuota
                     WHERE q.id_credito = $1`,
                    [id_credito]
                );

                const capitalPendiente =
                    BigInt(saldoCapital.rows[0]?.saldo ?? "0");

                // Recalcular dentro de la misma transacción para determinar
                // si después del pago aún quedan obligaciones vencidas.
                const deudaRestante = await calcularDeudaCredito(
                    pool,
                    id_credito,
                    fecha_corte,
                    client
                );

                const nuevoEstado =
                    capitalPendiente === 0n
                        ? "CANCELADO"
                        : deudaRestante.cuotasVencidas.length > 0
                            ? "EN_MORA"
                            : "VIGENTE";

                await client.query(
                    `INSERT INTO estado_credito (
                        id_credito,
                        estado,
                        fecha_cambio,
                        motivo
                    )
                     VALUES ($1, $2, $3, $4)
                         ON CONFLICT (id_credito)
           DO UPDATE SET
                        estado = EXCLUDED.estado,
                                           fecha_cambio = EXCLUDED.fecha_cambio,
                                           motivo = EXCLUDED.motivo,
                                           actualizado_en = now()`,
                    [
                        id_credito,
                        nuevoEstado,
                        fecha_corte,
                        nuevoEstado === "CANCELADO"
                            ? "Capital amortizado completamente."
                            : "Pago parcial o exacto aplicado según prelación."
                    ]
                );

                const datos = {
                    resultado: "PAGO_REGISTRADO",
                    idPago,
                    idCredito: id_credito,
                    monto: importe.comoTexto(),
                    fecha,
                    fechaCorte: fecha_corte,
                    canal,
                    claveIdempotencia: clave_idempotencia,
                    aprobador,
                    aprobacionHumana: true,
                    aplicacion: {
                        gastos: textoDinero(aplicacion.gastos),
                        interesMoratorio: textoDinero(aplicacion.moratorio),
                        interesCorriente: textoDinero(aplicacion.corriente),
                        capital: textoDinero(aplicacion.capital)
                    },
                    mensaje:
                        "Pago registrado y aplicado según la prelación del proyecto."
                };

                await client.query("COMMIT");
                transaccionIniciada = false;

                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify(datos, null, 2)
                    }],
                    structuredContent: datos
                };
            } catch (error) {
                if (transaccionIniciada) {
                    await client.query("ROLLBACK");
                }

                return {
                    content: [{
                        type: "text",
                        text:
                            error instanceof Error
                                ? error.message
                                : "Error al registrar el pago."
                    }],
                    isError: true
                };
            } finally {
                client.release();
            }
        }
    );
}
