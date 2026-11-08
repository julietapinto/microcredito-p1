import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Pool } from "pg";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { asegurarCalendarioProyectado } from "../../persistencia/servicios/calendario-cuotas-postgres.js";

const importeCentavos = z.string().regex(/^\d+$/);
const aplicacionSchema = z.object({
  numero_cuota: z.number().int().positive(),
  gastos_centavos: importeCentavos,
  moratorio_centavos: importeCentavos,
  corriente_centavos: importeCentavos,
  capital_centavos: importeCentavos
});
function validarFecha(fecha: string): boolean {
  const d = new Date(`${fecha}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === fecha;
}

export function registrarConciliarPagoHistorico(servidor: McpServer, pool: Pool): void {
  servidor.registerTool("conciliar_pago_historico", {
    title: "Conciliar pago histórico con comprobante",
    description: "Permite al operador conciliar manualmente un pago canónico existente, distribuyéndolo entre cuotas y conceptos según el comprobante o expediente original. No estima ni inventa aplicaciones; exige aprobación y referencia documental.",
    inputSchema: {
      id_pago: z.number().int().positive(),
      id_credito: z.string().trim().min(1),
      aplicaciones: z.array(aplicacionSchema).min(1),
      aprobador: z.string().trim().min(2).max(120),
      referencia_comprobante: z.string().trim().min(3).max(200),
      aprobacion_humana: z.literal(true),
      fecha_corte: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
    }
  }, async ({ id_pago, id_credito, aplicaciones, aprobador, referencia_comprobante, aprobacion_humana, fecha_corte }) => {
    if (!validarFecha(fecha_corte)) return { content: [{ type: "text", text: "La fecha de corte no es válida." }], isError: true };
    if (!aprobacion_humana) return { content: [{ type: "text", text: "La conciliación requiere aprobación humana." }], isError: true };
    const cuotas = new Set(aplicaciones.map(a => a.numero_cuota));
    if (cuotas.size !== aplicaciones.length) return { content: [{ type: "text", text: "No repita el número de cuota dentro de una conciliación." }], isError: true };
    const totalAsignado = aplicaciones.reduce((acc, a) => acc + BigInt(a.gastos_centavos) + BigInt(a.moratorio_centavos) + BigInt(a.corriente_centavos) + BigInt(a.capital_centavos), 0n);
    if (totalAsignado <= 0n) return { content: [{ type: "text", text: "La distribución debe contener importes positivos." }], isError: true };
    const client = await pool.connect();
    try {
      await asegurarCalendarioProyectado(pool, id_credito);
      await client.query("BEGIN");
      const pago = await client.query<{ id_pago: string; id_credito: string; fecha: string; monto_centavos: string; origen: string }>(
        "SELECT id_pago::text,id_credito,fecha::text,monto_centavos::text,origen FROM pagos WHERE id_pago=$1 FOR UPDATE", [id_pago]
      );
      const fila = pago.rows[0];
      if (!fila || fila.id_credito !== id_credito) throw new Error("No existe el pago indicado para ese crédito.");
      if (fila.origen !== "CANONICO") throw new Error("Solo se pueden conciliar pagos históricos de origen CANONICO.");
      if (fila.fecha > fecha_corte) throw new Error("La fecha de corte no puede ser anterior a la fecha del pago.");
      if (totalAsignado !== BigInt(fila.monto_centavos)) throw new Error("La suma de las aplicaciones debe coincidir exactamente con el importe del pago histórico.");
      const existente = await client.query("SELECT 1 FROM aplicaciones_pagos WHERE id_pago=$1 LIMIT 1", [id_pago]);
      if (existente.rowCount) throw new Error("El pago histórico ya tiene aplicaciones; no se puede conciliar dos veces.");
      for (const aplicacion of aplicaciones) {
        const cuota = await client.query<{ id_cuota: string }>(
          `SELECT id_cuota::text FROM cuotas_proyectadas
           WHERE id_credito=$1 AND numero_cuota=$2 AND fecha_vencimiento <= $3::date FOR UPDATE`,
          [id_credito, aplicacion.numero_cuota, fila.fecha]
        );
        const idCuota = cuota.rows[0]?.id_cuota;
        if (!idCuota) throw new Error(`La cuota ${aplicacion.numero_cuota} no pertenece al crédito o aún no había vencido en la fecha del pago.`);
        await client.query(
          `INSERT INTO aplicaciones_pagos(id_pago,id_cuota,gastos_centavos,moratorio_centavos,corriente_centavos,capital_centavos)
           VALUES($1,$2,$3,$4,$5,$6)`,
          [id_pago, idCuota, aplicacion.gastos_centavos, aplicacion.moratorio_centavos, aplicacion.corriente_centavos, aplicacion.capital_centavos]
        );
      }
      await client.query(
        `INSERT INTO conciliaciones_pagos_historicos(id_conciliacion,id_pago,aprobador,referencia_comprobante)
         VALUES($1,$2,$3,$4)`, [randomUUID(), id_pago, aprobador, referencia_comprobante]
      );
      await client.query("COMMIT");
      const datos = { resultado: "PAGO_HISTORICO_CONCILIADO", idPago: id_pago, idCredito: id_credito, montoCentavos: fila.monto_centavos, cuotasConciliadas: aplicaciones.map(a => a.numero_cuota), aprobador, referenciaComprobante: referencia_comprobante, mensaje: "Conciliación registrada con respaldo documental." };
      return { content: [{ type: "text", text: JSON.stringify(datos, null, 2) }], structuredContent: datos };
    } catch (error) {
      await client.query("ROLLBACK");
      return { content: [{ type: "text", text: error instanceof Error ? error.message : "Error al conciliar el pago histórico." }], isError: true };
    } finally { client.release(); }
  });
}
