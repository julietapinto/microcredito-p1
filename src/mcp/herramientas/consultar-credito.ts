import { z } from "zod";
import type { Pool } from "pg";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { calcularDeudaCredito } from "../../persistencia/servicios/deuda-cuotas-postgres.js";

interface FilaCredito {
    id_credito: string;
    id_cliente: string;
    nombre_cliente: string;
    dpi: string;
    telefono: string;
    municipio: string;
    id_asesor: string;
    fecha_otorgamiento: string;
    capital_centavos: string;
    plazo_meses: number;
    tna_bps: number;
    reestructurado: boolean;
    cantidad_pagos: number;
    total_pagado_centavos: string;
    ultimo_pago: string | null;
}

interface FilaCuotaCalendario {
    numero_cuota: number;
    fecha_vencimiento: string;
    monto_cuota_centavos: string;
}

function formatearCapital(centavos: string): string {
    const valor = BigInt(centavos);
    const unidades = valor / 100n;
    const decimales = (valor % 100n).toString().padStart(2, "0");

    return `Q${unidades}.${decimales}`;
}

function validarFecha(fecha: string): boolean {
    const resultado = new Date(`${fecha}T00:00:00.000Z`);

    return (
        !Number.isNaN(resultado.getTime()) &&
        resultado.toISOString().slice(0, 10) === fecha
    );
}

export function registrarConsultarCredito(
    servidor: McpServer,
    pool: Pool
): void {
    servidor.registerTool(
        "consultar_credito",
        {
            title: "Consultar crédito",
            description:
                "Consulta los datos de un crédito, su cliente, los pagos registrados y el calendario proyectado hasta una fecha de corte. No genera ni modifica calendarios.",
            inputSchema: {
                id_credito: z.string().trim().min(1).describe(
                    "Identificador del crédito que se desea consultar."
                ),
                fecha_corte: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe(
                    "Fecha de corte en formato AAAA-MM-DD."
                )
            }
        },
        async ({ id_credito, fecha_corte }) => {
            if (!validarFecha(fecha_corte)) {
                return {
                    content: [{
                        type: "text",
                        text: "La fecha de corte no es válida."
                    }],
                    isError: true
                };
            }

            const resultado = await pool.query<FilaCredito>(
                `SELECT
                    c.id_credito,
                    c.id_cliente,
                    cl.nombre_completo AS nombre_cliente,
                    cl.dpi,
                    cl.telefono,
                    cl.municipio,
                    c.id_asesor,
                    c.fecha_otorgamiento::text AS fecha_otorgamiento,
                    c.capital_centavos::text AS capital_centavos,
                    c.plazo_meses,
                    c.tna_bps,
                    c.reestructurado,
                    COALESCE(p.cantidad_pagos, 0)::int AS cantidad_pagos,
                    COALESCE(p.total_pagado_centavos, '0') AS total_pagado_centavos,
                    p.ultimo_pago
                FROM creditos c
                INNER JOIN clientes cl
                    ON cl.id_cliente = c.id_cliente
                LEFT JOIN (
                    SELECT
                        id_credito,
                        COUNT(*)::int AS cantidad_pagos,
                        SUM(monto_centavos)::text AS total_pagado_centavos,
                        MAX(fecha)::text AS ultimo_pago
                    FROM pagos
                    WHERE fecha <= $2::date
                    GROUP BY id_credito
                ) p
                    ON p.id_credito = c.id_credito
                WHERE c.id_credito = $1`,
                [id_credito, fecha_corte]
            );

            const credito = resultado.rows[0];

            if (!credito) {
                return {
                    content: [{
                        type: "text",
                        text: `No se encontró el crédito ${id_credito}.`
                    }],
                    isError: true
                };
            }

            const calendarioResult = await pool.query<FilaCuotaCalendario>(
                `SELECT
                    numero_cuota,
                    fecha_vencimiento::text AS fecha_vencimiento,
                    monto_cuota_centavos::text AS monto_cuota_centavos
                FROM cuotas_proyectadas
                WHERE id_credito = $1
                ORDER BY numero_cuota`,
                [credito.id_credito]
            );

            const calendario = calendarioResult.rows;

            if (calendario.length !== credito.plazo_meses) {
                return {
                    content: [{
                        type: "text",
                        text:
                            `El crédito ${id_credito} no tiene un calendario proyectado completo. ` +
                            "Debe generarse mediante una operación explícita de calendario."
                    }],
                    isError: true
                };
            }

            const cuotasVencidasProyectadas = calendario.filter(
                cuota => cuota.fecha_vencimiento <= fecha_corte
            );

            const proximaCuota = calendario.find(
                cuota => cuota.fecha_vencimiento > fecha_corte
            );

            const diasAtrasoProyectado = cuotasVencidasProyectadas.reduce(
                (maximo, cuota) => {
                    const vencimiento = Date.parse(
                        `${cuota.fecha_vencimiento}T00:00:00.000Z`
                    );
                    const corte = Date.parse(`${fecha_corte}T00:00:00.000Z`);

                    return Math.max(
                        maximo,
                        Math.floor((corte - vencimiento) / 86400000)
                    );
                },
                0
            );

            const deuda = await calcularDeudaCredito(
                pool,
                credito.id_credito,
                fecha_corte
            );

            const estadoPersistido = await pool.query<{ estado: string }>(
                "SELECT estado FROM estado_credito WHERE id_credito = $1",
                [credito.id_credito]
            );

            const estadoCredito =
                deuda.pagosCanonicosSinConciliar > 0
                    ? "NO_VERIFICABLE_POR_PAGOS_HISTORICOS"
                    : deuda.incobrable
                        ? "INCOBRABLE"
                        : deuda.diasAtrasoMaximo > 0
                            ? "EN_MORA"
                            : estadoPersistido.rows[0]?.estado ?? "VIGENTE";

            const datos = {
                idCredito: credito.id_credito,
                fechaCorte: fecha_corte,
                cliente: {
                    id: credito.id_cliente,
                    nombre: credito.nombre_cliente,
                    dpi: credito.dpi,
                    telefono: credito.telefono,
                    municipio: credito.municipio
                },
                asesor: credito.id_asesor,
                fechaOtorgamiento: credito.fecha_otorgamiento,
                capital: formatearCapital(credito.capital_centavos),
                plazoMeses: credito.plazo_meses,
                tasaNominalAnual: `${(credito.tna_bps / 100).toFixed(2)}%`,
                reestructurado: credito.reestructurado,
                pagosRegistrados: {
                    cantidad: credito.cantidad_pagos,
                    totalPagado: formatearCapital(
                        credito.total_pagado_centavos
                    ),
                    ultimoPago: credito.ultimo_pago
                },
                estadoCredito,
                deuda: {
                    totalExigibleCuotasVencidas: deuda.total,
                    cuotasVencidas: deuda.cuotasVencidas.length,
                    diasAtrasoMaximo: deuda.diasAtrasoMaximo,
                    incobrable: deuda.incobrable,
                    registroPermitido: deuda.registroPermitido,
                    pagosCanonicosSinConciliar:
                    deuda.pagosCanonicosSinConciliar
                },
                calendario: {
                    tipo: "PROYECTADO",
                    cantidadCuotas: calendario.length,
                    cuotasConVencimientoHastaCorte:
                    cuotasVencidasProyectadas.length,
                    diasAtrasoMaximoProyectado: diasAtrasoProyectado,
                    proximaCuota: proximaCuota
                        ? {
                            numero: proximaCuota.numero_cuota,
                            fechaVencimientoProyectada:
                            proximaCuota.fecha_vencimiento,
                            monto: formatearCapital(
                                proximaCuota.monto_cuota_centavos
                            )
                        }
                        : null,
                    estadoPago: "NO_VERIFICABLE"
                },
                alcance:
                    deuda.advertencia +
                    " El calendario se consulta como proyección mensual persistida desde la fecha de otorgamiento y no sustituye un calendario contractual confirmado."
            };

            return {
                content: [{
                    type: "text",
                    text: JSON.stringify(datos, null, 2)
                }],
                structuredContent: datos
            };
        }
    );
}
