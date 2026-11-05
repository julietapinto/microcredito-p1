import { z } from "zod";
import type { Pool } from "pg";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { calcularDeudaCredito } from "../../persistencia/servicios/deuda-cuotas-postgres.js";

function validarFecha(fecha: string): boolean {
  const d = new Date(`${fecha}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === fecha;
}

export function registrarExplicarMora(servidor: McpServer, pool: Pool): void {
  servidor.registerTool("explicar_mora", {
    title: "Explicar mora de una cuota",
    description: "Calcula los días de atraso y el desglose de interés moratorio por cada tramo recorrido, según la política vigente para la fecha de otorgamiento. Obtiene el capital desde el calendario persistido.",
    inputSchema: {
      id_credito: z.string().trim().min(1),
      fecha_corte: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      numero_cuota: z.number().int().positive().optional()
    }
  }, async ({ id_credito, fecha_corte, numero_cuota }) => {
    if (!validarFecha(fecha_corte)) return { content: [{ type: "text", text: "La fecha de corte no es válida." }], isError: true };
    const deuda = await calcularDeudaCredito(pool, id_credito, fecha_corte);
    const cuotas = numero_cuota === undefined ? deuda.cuotasVencidas : deuda.cuotasVencidas.filter(q => q.numeroCuota === numero_cuota);
    if (numero_cuota !== undefined && cuotas.length === 0) {
      return { content: [{ type: "text", text: `La cuota ${numero_cuota} no está vencida a la fecha de corte o no tiene saldo exigible.` }], isError: true };
    }
    const datos = {
      idCredito: id_credito,
      fechaCorte: fecha_corte,
      politicaAplicada: deuda.politica,
      cuotas: cuotas.map(q => ({
        numeroCuota: q.numeroCuota,
        fechaVencimientoProyectada: q.fechaVencimiento,
        diasAtraso: q.diasAtraso,
        tramoActual: q.tramo,
        capitalEnMora: q.capital,
        interesMoratorio: q.interesMoratorio,
        desglosePorTramo: q.desgloseMora
      })),
      incobrable: deuda.incobrable,
      pagosCanonicosSinConciliar: deuda.pagosCanonicosSinConciliar,
      alcance: deuda.advertencia
    };
    return { content: [{ type: "text", text: JSON.stringify(datos, null, 2) }], structuredContent: datos };
  });
}
