import { z } from "zod";
import type { Pool } from "pg";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { calcularDeudaCredito } from "../../persistencia/servicios/deuda-cuotas-postgres.js";

function validarFecha(fecha: string): boolean {
  const resultado = new Date(`${fecha}T00:00:00.000Z`);

  return (
      !Number.isNaN(resultado.getTime()) &&
      resultado.toISOString().slice(0, 10) === fecha
  );
}

export function registrarCalcularDeudaCuota(
    servidor: McpServer,
    pool: Pool
): void {
  servidor.registerTool(
      "calcular_deuda_cuota",
      {
        title: "Calcular deuda exigible de cuotas",
        description:
            "Calcula el desglose de gastos, interés moratorio por política, interés corriente y capital de cuotas vencidas a una fecha de corte. Identifica expresamente los pagos históricos aún no conciliados. No genera ni modifica calendarios.",
        inputSchema: {
          id_credito: z.string().trim().min(1),
          fecha_corte: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          numero_cuota: z.number().int().positive().optional()
        }
      },
      async ({ id_credito, fecha_corte, numero_cuota }) => {
        if (!validarFecha(fecha_corte)) {
          return {
            content: [{
              type: "text",
              text: "La fecha de corte no es válida."
            }],
            isError: true
          };
        }

        const credito = await pool.query<{
          id_credito: string;
          capital_centavos: string;
          plazo_meses: number;
          tna_bps: number;
        }>(
            `SELECT
                    id_credito,
                    capital_centavos::text AS capital_centavos,
                    plazo_meses,
                    tna_bps
                 FROM creditos
                 WHERE id_credito = $1`,
            [id_credito]
        );

        const fila = credito.rows[0];

        if (!fila) {
          return {
            content: [{
              type: "text",
              text: `No existe el crédito ${id_credito}.`
            }],
            isError: true
          };
        }

        if (
            numero_cuota !== undefined &&
            numero_cuota > fila.plazo_meses
        ) {
          return {
            content: [{
              type: "text",
              text: `El crédito tiene ${fila.plazo_meses} cuotas.`
            }],
            isError: true
          };
        }

        const deuda = await calcularDeudaCredito(
            pool,
            id_credito,
            fecha_corte
        );

        const cuotas =
            numero_cuota === undefined
                ? deuda.cuotasVencidas
                : deuda.cuotasVencidas.filter(
                    cuota => cuota.numeroCuota === numero_cuota
                );

        if (numero_cuota !== undefined && cuotas.length === 0) {
          return {
            content: [{
              type: "text",
              text:
                  `La cuota ${numero_cuota} no está vencida a la fecha de corte ` +
                  "o no tiene saldo exigible."
            }],
            isError: true
          };
        }

        const sumarImportes = (
            selector: (cuota: typeof cuotas[number]) => string
        ): string => {
          const total = cuotas.reduce(
              (acumulado, cuota) =>
                  acumulado +
                  BigInt(
                      selector(cuota)
                          .replace(/^Q/, "")
                          .replace(".", "")
                  ),
              0n
          );

          return (
              `Q${total / 100n}.` +
              (total % 100n).toString().padStart(2, "0")
          );
        };

        const totalSeleccionado =
            numero_cuota === undefined
                ? deuda.total
                : {
                  gastos: sumarImportes(cuota => cuota.gastos),
                  interesMoratorio: sumarImportes(
                      cuota => cuota.interesMoratorio
                  ),
                  interesCorriente: sumarImportes(
                      cuota => cuota.interesCorriente
                  ),
                  capital: sumarImportes(cuota => cuota.capital),
                  exigible: sumarImportes(cuota => cuota.total)
                };

        const capital = BigInt(fila.capital_centavos);

        const datos = {
          idCredito: id_credito,
          fechaCorte: fecha_corte,
          capitalOriginal:
              `Q${capital / 100n}.` +
              (capital % 100n).toString().padStart(2, "0"),
          tasaNominalAnual: `${(fila.tna_bps / 100).toFixed(2)}%`,
          plazoMeses: fila.plazo_meses,
          politicaMora: deuda.politica,
          cuotasVencidas: cuotas,
          totalExigible: totalSeleccionado,
          incobrable: deuda.incobrable,
          registroPermitido: deuda.registroPermitido,
          pagosCanonicosSinConciliar:
          deuda.pagosCanonicosSinConciliar,
          alcance: deuda.advertencia
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
