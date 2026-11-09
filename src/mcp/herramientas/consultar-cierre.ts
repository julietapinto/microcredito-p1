
import { z } from "zod";
import type { Pool } from "pg";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

interface FilaResumen {
    cantidad: number;
    total_centavos: string;
}

interface FilaCanal {
    canal: string;
    cantidad: number;
    total_centavos: string;
}
interface FilaConcepto {
    concepto: string;
    total_centavos: string;
    aplicaciones: number;
}

function validarFecha(fecha: string): boolean {
    const resultado = new Date(`${fecha}T00:00:00.000Z`);

    return (
        !Number.isNaN(resultado.getTime()) &&
        resultado.toISOString().slice(0, 10) === fecha
    );
}

function formatearQuetzales(centavos: string): string {
    const valor = BigInt(centavos);
    const unidades = valor / 100n;
    const decimales = (valor % 100n)
        .toString()
        .padStart(2, "0");

    return `Q${unidades}.${decimales}`;
}

function obtenerPeriodo(
    tipo: "DIARIO" | "MENSUAL",
    fecha: string
): { inicio: string; fin: string } {
    if (tipo === "DIARIO") {
        return {
            inicio: fecha,
            fin: fecha
        };
    }

    const inicio = `${fecha.slice(0, 7)}-01`;
    const anio = Number(fecha.slice(0, 4));
    const mes = Number(fecha.slice(5, 7));

    const ultimoDia = new Date(
        Date.UTC(anio, mes, 0)
    ).getUTCDate();

    const fin = `${fecha.slice(0, 7)}-${String(ultimoDia).padStart(2, "0")}`;

    return { inicio, fin };
}

export function registrarConsultarCierre(
    servidor: McpServer,
    pool: Pool
): void {
    servidor.registerTool(
        "consultar_cierre",
        {
            title: "Consultar cierre financiero",
            description:
                "Consulta desembolsos y pagos de un período diario o mensual, con desglose de pagos por canal y de aplicaciones por concepto. Los pagos históricos sin aplicación se muestran aparte.",
            inputSchema: {
                tipo_periodo: z.enum(["DIARIO", "MENSUAL"])
                    .describe("Tipo de cierre: DIARIO o MENSUAL."),
                fecha_corte: z.string()
                    .regex(/^\d{4}-\d{2}-\d{2}$/)
                    .describe(
                        "Fecha de corte en formato AAAA-MM-DD. Para MENSUAL se utiliza el año y mes."
                    )
            }
        },
        async ({ tipo_periodo, fecha_corte }) => {
            if (!validarFecha(fecha_corte)) {
                return {
                    content: [{
                        type: "text",
                        text: "La fecha no es válida. Utilice AAAA-MM-DD."
                    }],
                    isError: true
                };
            }

            const periodo = obtenerPeriodo(tipo_periodo, fecha_corte);

            const resultadoDesembolsos =
                await pool.query<FilaResumen>(
                    `SELECT
                        COUNT(*)::int AS cantidad,
                        COALESCE(SUM(capital_centavos), 0)::text
                            AS total_centavos
                    FROM creditos
                    WHERE fecha_otorgamiento >= $1::date
                      AND fecha_otorgamiento <= $2::date`,
                    [periodo.inicio, periodo.fin]
                );

            const resultadoPagos =
                await pool.query<FilaResumen>(
                    `SELECT
                        COUNT(*)::int AS cantidad,
                        COALESCE(SUM(monto_centavos), 0)::text
                            AS total_centavos
                    FROM pagos
                    WHERE fecha >= $1::date
                      AND fecha <= $2::date`,
                    [periodo.inicio, periodo.fin]
                );

            const resultadoCanales =
                await pool.query<FilaCanal>(
                    `SELECT
                        canal,
                        COUNT(*)::int AS cantidad,
                        SUM(monto_centavos)::text AS total_centavos
                    FROM pagos
                    WHERE fecha >= $1::date
                      AND fecha <= $2::date
                    GROUP BY canal
                    ORDER BY canal`,
                    [periodo.inicio, periodo.fin]
                );

            const resultadoConceptos = await pool.query<FilaConcepto>(
                `SELECT concepto, SUM(monto)::text AS total_centavos, SUM(cantidad)::int AS aplicaciones
                 FROM (
                   SELECT 'GASTOS' AS concepto, SUM(a.gastos_centavos) AS monto, COUNT(*) AS cantidad
                   FROM aplicaciones_pagos a JOIN pagos p ON p.id_pago=a.id_pago
                   WHERE p.fecha >= $1::date AND p.fecha <= $2::date AND a.gastos_centavos > 0
                   UNION ALL
                   SELECT 'INTERES_MORATORIO', SUM(a.moratorio_centavos), COUNT(*)
                   FROM aplicaciones_pagos a JOIN pagos p ON p.id_pago=a.id_pago
                   WHERE p.fecha >= $1::date AND p.fecha <= $2::date AND a.moratorio_centavos > 0
                   UNION ALL
                   SELECT 'INTERES_CORRIENTE', SUM(a.corriente_centavos), COUNT(*)
                   FROM aplicaciones_pagos a JOIN pagos p ON p.id_pago=a.id_pago
                   WHERE p.fecha >= $1::date AND p.fecha <= $2::date AND a.corriente_centavos > 0
                   UNION ALL
                   SELECT 'CAPITAL', SUM(a.capital_centavos), COUNT(*)
                   FROM aplicaciones_pagos a JOIN pagos p ON p.id_pago=a.id_pago
                   WHERE p.fecha >= $1::date AND p.fecha <= $2::date AND a.capital_centavos > 0
                 ) conceptos
                 WHERE monto IS NOT NULL GROUP BY concepto ORDER BY concepto`,
                [periodo.inicio, periodo.fin]
            );
            const pagosSinAplicar = await pool.query<{ total: string; cantidad: number }>(
                `SELECT COALESCE(SUM(p.monto_centavos),0)::text AS total, COUNT(*)::int AS cantidad
                 FROM pagos p LEFT JOIN aplicaciones_pagos a ON a.id_pago=p.id_pago
                 WHERE p.fecha >= $1::date AND p.fecha <= $2::date AND a.id_pago IS NULL`,
                [periodo.inicio, periodo.fin]
            );

            const desembolsos = resultadoDesembolsos.rows[0];
            const pagos = resultadoPagos.rows[0];

            if (!desembolsos || !pagos) {
                throw new Error(
                    "No fue posible obtener los datos del cierre."
                );
            }

            const totalDesembolsado =
                BigInt(desembolsos.total_centavos);
            const totalPagado = BigInt(pagos.total_centavos);

            const datos = {
                tipoPeriodo: tipo_periodo,
                periodo: {
                    fechaInicio: periodo.inicio,
                    fechaFin: periodo.fin
                },
                desembolsos: {
                    cantidad: desembolsos.cantidad,
                    total: formatearQuetzales(
                        desembolsos.total_centavos
                    )
                },
                recuperaciones: {
                    cantidadPagos: pagos.cantidad,
                    total: formatearQuetzales(pagos.total_centavos),
                    desglosePorCanal: resultadoCanales.rows.map((fila) => ({
                        canal: fila.canal,
                        cantidad: fila.cantidad,
                        total: formatearQuetzales(fila.total_centavos)
                    })),
                    desglosePorConcepto: resultadoConceptos.rows.map(fila => ({
                        concepto: fila.concepto,
                        aplicaciones: fila.aplicaciones,
                        total: formatearQuetzales(fila.total_centavos)
                    })),
                    pagosSinAplicacion: {
                        cantidad: pagosSinAplicar.rows[0]?.cantidad ?? 0,
                        total: formatearQuetzales(pagosSinAplicar.rows[0]?.total ?? "0")
                    }
                },
                diferenciaDesembolsosMenosPagos:
                    formatearQuetzales(
                        (totalDesembolsado - totalPagado).toString()
                    ),
                alcance:
                    "El desglose por concepto incluye únicamente aplicaciones registradas en el nuevo flujo transaccional. Los pagos históricos y cualquier pago sin aplicación se muestran aparte y no se atribuyen artificialmente a capital, intereses o gastos. La diferencia entre desembolsos y pagos es una comparación de flujos, no el saldo de cartera."
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
