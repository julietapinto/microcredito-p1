import type { PlanAmortizacion } from "./plan-amortizacion.js";

export interface CuotaConVencimiento {
  readonly numero: number;
  readonly fechaVencimiento: string;
}

/**
 * Proyecta vencimientos mensuales conservando el día del otorgamiento.
 * Si el mes no contiene ese día, utiliza su último día (p. ej. 31 -> 28/29).
 * No representa una fecha contractual confirmada.
 */
export function generarFechasVencimiento(
  fechaOtorgamiento: string,
  cantidadCuotas: number
): readonly CuotaConVencimiento[] {
  validarFecha(fechaOtorgamiento);
  if (!Number.isInteger(cantidadCuotas) || cantidadCuotas < 1) {
    throw new Error("La cantidad de cuotas debe ser un entero positivo");
  }

  const anio = Number(fechaOtorgamiento.slice(0, 4));
  const mes = Number(fechaOtorgamiento.slice(5, 7));
  const dia = Number(fechaOtorgamiento.slice(8, 10));

  return Array.from({ length: cantidadCuotas }, (_, indice) => {
    const fechaMes = new Date(Date.UTC(anio, mes - 1 + indice + 1, 1));
    const ultimoDia = new Date(Date.UTC(
      fechaMes.getUTCFullYear(), fechaMes.getUTCMonth() + 1, 0
    )).getUTCDate();
    const diaFinal = Math.min(dia, ultimoDia);
    const vencimiento = new Date(Date.UTC(
      fechaMes.getUTCFullYear(), fechaMes.getUTCMonth(), diaFinal
    ));
    return {
      numero: indice + 1,
      fechaVencimiento: vencimiento.toISOString().slice(0, 10)
    };
  });
}

export function combinarPlanConFechas(
  plan: PlanAmortizacion,
  fechaOtorgamiento: string
): readonly (CuotaConVencimiento & {
  readonly cuota: PlanAmortizacion["cuotas"][number];
})[] {
  const fechas = generarFechasVencimiento(fechaOtorgamiento, plan.cuotas.length);
  return plan.cuotas.map((cuota, indice) => {
    const fecha = fechas[indice];
    if (!fecha) throw new Error("No fue posible generar la fecha de la cuota");
    return { ...fecha, cuota };
  });
}

function validarFecha(fecha: string): void {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha);
  if (!match) throw new Error("La fecha debe utilizar el formato AAAA-MM-DD");
  const anio = Number(match[1]);
  const mes = Number(match[2]);
  const dia = Number(match[3]);
  const fechaUTC = new Date(Date.UTC(anio, mes - 1, dia));
  if (
    anio < 1 || mes < 1 || mes > 12 ||
    fechaUTC.getUTCFullYear() !== anio ||
    fechaUTC.getUTCMonth() !== mes - 1 ||
    fechaUTC.getUTCDate() !== dia
  ) throw new Error("La fecha de otorgamiento no es válida");
}
