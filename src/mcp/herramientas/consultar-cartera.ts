import { z } from "zod";
import type { Pool } from "pg";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { calcularDeudaCredito } from "../../persistencia/servicios/deuda-cuotas-postgres.js";

function validarFecha(fecha: string): boolean {
  const d = new Date(`${fecha}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === fecha;
}
function dinero(centavos: bigint): string {
  const signo = centavos < 0n ? "-" : "";
  const v = centavos < 0n ? -centavos : centavos;
  return `${signo}Q${v / 100n}.${(v % 100n).toString().padStart(2, "0")}`;
}

export function registrarConsultarCartera(servidor: McpServer, pool: Pool): void {
  servidor.registerTool("consultar_cartera", {
    title: "Consultar cartera, mora y riesgo",
    description: "Calcula cartera activa, créditos en mora, cartera en riesgo e incobrables del período a una fecha de corte. Excluye de los indicadores confirmados los créditos con pagos históricos canónicos sin conciliar.",
    inputSchema: {
      fecha_corte: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      fecha_inicio_periodo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
    }
  }, async ({ fecha_corte, fecha_inicio_periodo }) => {
    const inicioPeriodo = fecha_inicio_periodo ?? `${fecha_corte.slice(0, 7)}-01`;
    if (!validarFecha(fecha_corte) || !validarFecha(inicioPeriodo) || inicioPeriodo > fecha_corte) return { content: [{ type: "text", text: "Las fechas del período no son válidas." }], isError: true };
    const result = await pool.query<{ id_credito: string; reestructurado: boolean; capital_centavos: string }>(
      `SELECT id_credito,reestructurado,capital_centavos::text FROM creditos WHERE fecha_otorgamiento <= $1::date ORDER BY id_credito`, [fecha_corte]
    );
    let carteraActiva = 0n, carteraMora = 0n, carteraRiesgo = 0n, incobrablePeriodo = 0n;
    let verificables = 0, noConciliados = 0, enMora = 0, enRiesgo = 0, incobrables = 0;
    const detalle = [];
    for (const credito of result.rows) {
      const deuda = await calcularDeudaCredito(pool, credito.id_credito, fecha_corte);
      const balance = await pool.query<{ saldo: string }>(
        `WITH aplicado AS (SELECT id_cuota,SUM(capital_centavos) capital FROM aplicaciones_pagos GROUP BY id_cuota)
         SELECT COALESCE(SUM(GREATEST(q.amortizacion_centavos-COALESCE(a.capital,0),0)),0)::text saldo
         FROM cuotas_proyectadas q LEFT JOIN aplicado a ON a.id_cuota=q.id_cuota WHERE q.id_credito=$1`, [credito.id_credito]
      );
      const saldo = BigInt(balance.rows[0]?.saldo ?? "0");
      const dias = deuda.diasAtrasoMaximo;
      const riesgo = dias > 30 || credito.reestructurado;
      const incobrable = deuda.incobrable;
      const primeraCuotaIncobrable = deuda.cuotasVencidas.find(q => q.diasAtraso > 120);
      const fechaDeclaracionIncobrable = primeraCuotaIncobrable
        ? (() => { const d = new Date(`${primeraCuotaIncobrable.fechaVencimiento}T00:00:00.000Z`); d.setUTCDate(d.getUTCDate() + 121); return d.toISOString().slice(0, 10); })()
        : null;
      const fueIncobrableEnPeriodo = fechaDeclaracionIncobrable !== null && fechaDeclaracionIncobrable >= inicioPeriodo && fechaDeclaracionIncobrable <= fecha_corte;
      const confiable = deuda.pagosCanonicosSinConciliar === 0;
      if (!confiable) noConciliados++;
      else {
        verificables++;
        if (incobrable) { incobrables++; if (fueIncobrableEnPeriodo) incobrablePeriodo += saldo; }
        else {
          carteraActiva += saldo;
          if (dias > 0) { enMora++; carteraMora += saldo; }
          if (riesgo) { enRiesgo++; carteraRiesgo += saldo; }
        }
      }
      detalle.push({ idCredito: credito.id_credito, saldoCapitalCalculado: dinero(saldo), diasAtrasoMaximo: dias, reestructurado: credito.reestructurado, tramo: incobrable ? "INCOBRABLE" : deuda.cuotasVencidas.reduce((max, q) => q.diasAtraso > max.dias ? { dias: q.diasAtraso, tramo: q.tramo } : max, { dias: 0, tramo: "SIN_MORA" }).tramo, clasificacion: !confiable ? "NO_VERIFICABLE_HISTORICO" : incobrable ? "INCOBRABLE" : riesgo ? "EN_RIESGO" : dias > 0 ? "EN_MORA" : "ACTIVA" });
    }
    const porcentaje = (n: bigint, d: bigint): string => d === 0n ? "0.00%" : `${Number(n * 10000n / d) / 100}%`;
    const datos = {
      fechaCorte: fecha_corte,
      periodoIncobrables: { fechaInicio: inicioPeriodo, fechaFin: fecha_corte },
      resumen: {
        creditosEvaluados: result.rows.length,
        creditosConCalculoVerificable: verificables,
        creditosConPagosHistoricosSinConciliar: noConciliados,
        carteraActiva: dinero(carteraActiva),
        carteraEnMora: dinero(carteraMora),
        porcentajeCarteraEnMora: porcentaje(carteraMora, carteraActiva),
        carteraEnRiesgo: dinero(carteraRiesgo),
        porcentajeCarteraEnRiesgo: porcentaje(carteraRiesgo, carteraActiva),
        creditosEnMora: enMora,
        creditosEnRiesgo: enRiesgo,
        creditosIncobrablesALaFecha: incobrables,
        saldoCapitalDeclaradoIncobrableEnPeriodo: dinero(incobrablePeriodo)
      },
      detalle,
      alcance: "Los indicadores monetarios excluyen créditos con pagos históricos canónicos sin conciliación, porque no es posible determinar su capital pendiente real sin inventar aplicaciones. Los calendarios son proyecciones basadas en el manual del producto y deben confirmarse contra contrato."
    };
    return { content: [{ type: "text", text: JSON.stringify(datos, null, 2) }], structuredContent: datos };
  });
}
