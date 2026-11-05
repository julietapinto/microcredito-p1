import type { Pool } from "pg";
import { Dinero } from "../../dominio/dinero.js";
import { combinarPlanConFechas } from "../../dominio/calendario-cuotas.js";
import { AmortizacionFrancesa } from "../../dominio/plan-amortizacion.js";

interface FilaCredito {
  id_credito: string;
  fecha_otorgamiento: string;
  capital_centavos: string;
  plazo_meses: number;
  tna_bps: number;
}

export interface FilaCuotaProyectada {
  id_credito: string;
  numero_cuota: number;
  fecha_vencimiento: string;
  saldo_capital_inicial_centavos: string;
  monto_cuota_centavos: string;
  interes_corriente_centavos: string;
  amortizacion_centavos: string;
  saldo_capital_final_centavos: string;
  tipo_calendario: "PROYECTADO";
}

function aCentavos(valor: Dinero): string {
  return valor.comoDecimal().times(100).toFixed(0);
}

/** Genera una sola vez el calendario teórico de un crédito y lo persiste. */
export async function asegurarCalendarioProyectado(
  pool: Pool,
  idCredito: string
): Promise<readonly FilaCuotaProyectada[]> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const creditoResult = await client.query<FilaCredito>(
      `SELECT id_credito, fecha_otorgamiento::text, capital_centavos::text,
              plazo_meses, tna_bps
       FROM creditos WHERE id_credito = $1 FOR UPDATE`,
      [idCredito]
    );
    const credito = creditoResult.rows[0];
    if (!credito) throw new Error(`No existe el crédito ${idCredito}.`);

    const existentes = await client.query<FilaCuotaProyectada>(
      `SELECT id_credito, numero_cuota, fecha_vencimiento::text,
              saldo_capital_inicial_centavos::text,
              monto_cuota_centavos::text,
              interes_corriente_centavos::text,
              amortizacion_centavos::text,
              saldo_capital_final_centavos::text, tipo_calendario
       FROM cuotas_proyectadas WHERE id_credito = $1 ORDER BY numero_cuota`,
      [idCredito]
    );

    if (existentes.rows.length === 0) {
      const capital = Dinero.desde(
        (Number(credito.capital_centavos) / 100).toFixed(2)
      );
      const tasaAnual = (credito.tna_bps / 10000).toString();
      const plan = new AmortizacionFrancesa().generar(
        capital, tasaAnual, credito.plazo_meses
      );
      const cuotas = combinarPlanConFechas(plan, credito.fecha_otorgamiento);

      for (const item of cuotas) {
        await client.query(
          `INSERT INTO cuotas_proyectadas (
             id_credito, numero_cuota, fecha_vencimiento,
             saldo_capital_inicial_centavos, monto_cuota_centavos,
             interes_corriente_centavos, amortizacion_centavos,
             saldo_capital_final_centavos, tipo_calendario
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'PROYECTADO')
           ON CONFLICT (id_credito, numero_cuota) DO NOTHING`,
          [
            idCredito, item.numero, item.fechaVencimiento,
            aCentavos(item.cuota.saldoInicial), aCentavos(item.cuota.monto),
            aCentavos(item.cuota.interes), aCentavos(item.cuota.amortizacion),
            aCentavos(item.cuota.saldoFinal)
          ]
        );
      }
    }

    const resultado = await client.query<FilaCuotaProyectada>(
      `SELECT id_credito, numero_cuota, fecha_vencimiento::text,
              saldo_capital_inicial_centavos::text,
              monto_cuota_centavos::text,
              interes_corriente_centavos::text,
              amortizacion_centavos::text,
              saldo_capital_final_centavos::text, tipo_calendario
       FROM cuotas_proyectadas WHERE id_credito = $1 ORDER BY numero_cuota`,
      [idCredito]
    );
    if (resultado.rows.length !== credito.plazo_meses) {
      throw new Error(`El calendario de ${idCredito} está incompleto; no se modificó el calendario existente.`);
    }
    await client.query("COMMIT");
    return resultado.rows;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function asegurarCalendariosProyectados(
  pool: Pool,
  fechaCorte: string
): Promise<void> {
  const resultado = await pool.query<{ id_credito: string }>(
    `SELECT id_credito FROM creditos
     WHERE fecha_otorgamiento <= $1::date
     ORDER BY fecha_otorgamiento, id_credito`,
    [fechaCorte]
  );
  for (const credito of resultado.rows) {
    await asegurarCalendarioProyectado(pool, credito.id_credito);
  }
}
