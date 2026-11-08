import { z } from "zod";
import type { Pool } from "pg";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

interface FilaVencimiento {
    id_credito: string;
    id_cliente: string;
    nombre_cliente: string;
    numero_cuota: number;
    fecha_vencimiento: string;
    monto_cuota_centavos: string;
}

function validarFecha(fecha: string): boolean {
    const resultado = new Date(`${fecha}T00:00:00.000Z`);

    return (
        !Number.isNaN(resultado.getTime()) &&
        resultado.toISOString().slice(0, 10) === fecha
    );
}

function sumarDias(fecha: string, dias: number): string {
    const resultado = new Date(`${fecha}T00:00:00.000Z`);
    resultado.setUTCDate(resultado.getUTCDate() + dias);

    return resultado.toISOString().slice(0, 10);
}

function diasEntre(inicial: string, final: string): number {
    return Math.round(
        (
            Date.parse(`${final}T00:00:00.000Z`) -
            Date.parse(`${inicial}T00:00:00.000Z`)
        ) / 86400000
    );
}

function formatearCentavos(centavos: string): string {
    const valor = BigInt(centavos);

    return (
        `Q${valor / 100n}.` +
        (valor % 100n).toString().padStart(2, "0")
    );
}

export function registrarProximosVencimientos(
    servidor: McpServer,
    pool: Pool
): void {
    servidor.registerTool(
        "proximos_vencimientos",
        {
            title: "Consultar próximos vencimientos",
            description:
                "Consulta las cuotas de los calendarios mensuales proyectados que ya están persistidos y vencen dentro de una ventana desde una fecha de corte. No genera ni modifica calendarios. Los pagos no se asocian a cuotas históricas.",
            inputSchema: {
                fecha_corte: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
                    .describe("Fecha de corte en formato AAAA-MM-DD."),
                ventana_dias: z.number().int().positive().max(365)
                    .describe(
                        "Cantidad de días futuros que se desean consultar."
                    )
            }
        },
        async ({ fecha_corte, ventana_dias }) => {
            if (!validarFecha(fecha_corte)) {
                return {
                    content: [{
                        type: "text",
                        text:
                            "La fecha de corte no es válida. " +
                            "Utilice el formato AAAA-MM-DD."
                    }],
                    isError: true
                };
            }

            const fechaLimite = sumarDias(fecha_corte, ventana_dias);

            const resultado = await pool.query<FilaVencimiento>(
                `SELECT
                     q.id_credito,
                     c.id_cliente,
                     cl.nombre_completo AS nombre_cliente,
                     q.numero_cuota,
                     q.fecha_vencimiento::text AS fecha_vencimiento,
                     q.monto_cuota_centavos::text AS monto_cuota_centavos
                 FROM cuotas_proyectadas q
                          INNER JOIN creditos c
                                     ON c.id_credito = q.id_credito
                          INNER JOIN clientes cl
                                     ON cl.id_cliente = c.id_cliente
                 WHERE q.fecha_vencimiento > $1::date
                   AND q.fecha_vencimiento <= $2::date
                 ORDER BY
                     q.fecha_vencimiento,
                     q.id_credito,
                     q.numero_cuota`,
                [fecha_corte, fechaLimite]
            );

            let totalCentavos = 0n;

            const vencimientos = resultado.rows.map(fila => {
                totalCentavos += BigInt(fila.monto_cuota_centavos);

                return {
                    idCredito: fila.id_credito,
                    idCliente: fila.id_cliente,
                    nombreCliente: fila.nombre_cliente,
                    numeroCuota: fila.numero_cuota,
                    fechaVencimientoProyectada: fila.fecha_vencimiento,
                    diasHastaVencimiento: diasEntre(
                        fecha_corte,
                        fila.fecha_vencimiento
                    ),
                    montoCuota: formatearCentavos(
                        fila.monto_cuota_centavos
                    ),
                    estadoPago: "NO_VERIFICABLE"
                };
            });

            const montoTotal = formatearCentavos(
                totalCentavos.toString()
            );

            const datos = {
                fechaCorte: fecha_corte,
                ventanaDias: ventana_dias,
                fechaLimite,
                tipoCalendario: "PROYECTADO",
                totalCuotasProyectadas: vencimientos.length,
                montoTotalProgramado: montoTotal,
                vencimientos,
                alcance:
                    "Las cuotas se consultan desde calendarios mensuales proyectados y persistidos, generados a partir de la fecha de otorgamiento. No se confirma que las fechas sean contractuales. Los pagos históricos no están asociados a cuotas, por lo que el estado de pago no es verificable y el monto total es programado, no saldo exigible confirmado. Los calendarios inexistentes no se generan durante esta consulta."
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
