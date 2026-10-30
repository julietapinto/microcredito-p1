import type {
  TramoMora
} from "../dominio/calculadora-mora.js";

export type EstadoCreditoMcp =
  | "SOLICITADO"
  | "APROBADO"
  | "RECHAZADO"
  | "ANULADO"
  | "VIGENTE"
  | "EN_MORA"
  | "REESTRUCTURADO"
  | "CANCELADO"
  | "INCOBRABLE";

export interface DineroMcp {
  readonly monto: string;
  readonly moneda: string;
}

export interface ProximaCuotaMcp {
  readonly numero: number;
  readonly fechaVencimiento: string;
  readonly monto: DineroMcp;
}

export interface ConsultaCreditoMcp {
  readonly idCredito: string;
  readonly estado: EstadoCreditoMcp;
  readonly saldo: DineroMcp;
  readonly diasAtraso: number;
  readonly tramo: TramoMora;
  readonly cuotasPagadas: number;
  readonly cuotasVencidas: number;
  readonly proximaCuota: ProximaCuotaMcp | null;
}

export interface DeudaCuotaMcp {
  readonly idCredito: string;
  readonly numeroCuota: number;
  readonly fechaCorte: string;
  readonly gastos: DineroMcp;
  readonly interesMoratorio: DineroMcp;
  readonly interesCorriente: DineroMcp;
  readonly capital: DineroMcp;
  readonly totalExigible: DineroMcp;
}
export interface TramoMoraMcp {
  readonly tramo: TramoMora;
  readonly dias: number;
  readonly tasaNominalAnual: string;
  readonly interesGenerado: DineroMcp;
}

export interface ExplicacionMoraMcp {
  readonly idCredito: string;
  readonly fechaCorte: string;
  readonly capitalEnMora: DineroMcp;
  readonly tramosRecorridos: readonly TramoMoraMcp[];
  readonly interesMoratorioTotal: DineroMcp;
}
export interface CreditoEnMoraMcp {
  readonly idCredito: string;
  readonly diasAtraso: number;
  readonly tramo: TramoMora;
  readonly saldo: DineroMcp;
}

export interface ListadoCreditosMoraMcp {
  readonly fechaCorte: string;
  readonly filtroTramo: TramoMora | null;
  readonly totalCreditos: number;
  readonly creditos: readonly CreditoEnMoraMcp[];
}
export interface CuotaProximaMcp {
  readonly idCredito: string;
  readonly numeroCuota: number;
  readonly fechaVencimiento: string;
  readonly monto: DineroMcp;
}

export interface ProximosVencimientosMcp {
  readonly fechaCorte: string;
  readonly ventanaDias: number;
  readonly totalCuotas: number;
  readonly montoTotal: DineroMcp;
  readonly cuotas: readonly CuotaProximaMcp[];
}

export interface PuertoAsistente {
  consultarCredito(
    idCredito: string,
    fechaCorte: string
  ): Promise<ConsultaCreditoMcp>;

  calcularDeudaCuota(
    idCredito: string,
    numeroCuota: number,
    fechaCorte: string
  ): Promise<DeudaCuotaMcp>;

    explicarMora(
    idCredito: string,
    fechaCorte: string
  ): Promise<ExplicacionMoraMcp>;

    verProximosVencimientos(
    fechaCorte: string,
    ventanaDias: number
  ): Promise<ProximosVencimientosMcp>;
  
    listarCreditosEnMora(
    fechaCorte: string,
    tramo?: TramoMora
  ): Promise<ListadoCreditosMoraMcp>;
}