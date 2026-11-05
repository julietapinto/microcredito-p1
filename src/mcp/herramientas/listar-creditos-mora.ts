import { z } from "zod";
import type { Pool } from "pg";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { calcularDeudaCredito } from "../../persistencia/servicios/deuda-cuotas-postgres.js";

const tramos = ["TODOS", "MORA_1", "MORA_2", "MORA_3", "VENCIDO", "INCOBRABLE"] as const;
function validarFecha(fecha: string): boolean {
  const d = new Date(`${fecha}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === fecha;
}
function dinero(centavos: string): string {
  const v = BigInt(centavos);
  return `Q${v / 100n}.${(v % 100n).toString().padStart(2, "0")}`;
}

export function registrarListarCreditosMora(servidor: McpServer, pool: Pool): void {
  servidor.registerTool("listar_creditos_mora", {
    title: "Listar créditos en mora",
    description: "Lista créditos con cuotas vencidas y saldo de capital por tramo a una fecha de corte. Excluye de la clasificación confirmada aquellos créditos con pagos canónicos históricos sin conciliar.",
    inputSchema: {
      fecha_corte: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      tramo: z.enum(tramos).default("TODOS")
    }
  }, async ({ fecha_corte, tramo }) => {
    if (!validarFecha(fecha_corte)) return { content: [{ type: "text", text: "La fecha de corte no es válida." }], isError: true };
    const ids = await pool.query<{ id_credito: string; id_cliente: string; nombre_cliente: string; municipio: string }>(
      `SELECT c.id_credito,c.id_cliente,cl.nombre_completo AS nombre_cliente,cl.municipio
       FROM creditos c JOIN clientes cl ON cl.id_cliente=c.id_cliente
       WHERE c.fecha_otorgamiento <= $1::date ORDER BY c.id_credito`, [fecha_corte]
    );
    const creditos = [];
    for (const fila of ids.rows) {
      const deuda = await calcularDeudaCredito(pool, fila.id_credito, fecha_corte);
      if (deuda.diasAtrasoMaximo === 0 && !deuda.incobrable) continue;
      const tramoMayor = deuda.cuotasVencidas.reduce((max, q) => q.diasAtraso > max.dias ? { dias: q.diasAtraso, tramo: q.tramo } : max, { dias: 0, tramo: "SIN_MORA" });
      if (tramo !== "TODOS" && tramoMayor.tramo !== tramo) continue;
      const capitalResult = await pool.query<{ saldo: string }>(
        `WITH aplicado AS (
           SELECT id_cuota,SUM(capital_centavos) AS capital
           FROM aplicaciones_pagos GROUP BY id_cuota
         )
         SELECT COALESCE(SUM(GREATEST(q.amortizacion_centavos-COALESCE(a.capital,0),0)),0)::text AS saldo
         FROM cuotas_proyectadas q LEFT JOIN aplicado a ON a.id_cuota=q.id_cuota
         WHERE q.id_credito=$1`, [fila.id_credito]
      );
      const saldoCapital = BigInt(capitalResult.rows[0]?.saldo ?? "0");
      creditos.push({
        idCredito: fila.id_credito,
        cliente: fila.nombre_cliente,
        municipio: fila.municipio,
        diasAtrasoMaximo: deuda.diasAtrasoMaximo,
        tramo: tramoMayor.tramo,
        saldoCapitalPendiente: dinero(saldoCapital.toString()),
        totalExigibleCuotasVencidas: deuda.total.exigible,
        estado: deuda.pagosCanonicosSinConciliar > 0 ? "NO_VERIFICABLE_POR_HISTORICO" : deuda.incobrable ? "INCOBRABLE" : "EN_MORA",
        pagosCanonicosSinConciliar: deuda.pagosCanonicosSinConciliar
      });
    }
    const datos = { fechaCorte: fecha_corte, filtroTramo: tramo, totalCreditosEnMora: creditos.length, creditos, alcance: "La mora se calcula desde el calendario proyectado. El saldo de capital y la clasificación quedan marcados como no verificables cuando existen pagos históricos sin aplicación a cuotas." };
    return { content: [{ type: "text", text: JSON.stringify(datos, null, 2) }], structuredContent: datos };
  });
}
