import { Dinero } from "../../dominio/dinero.js";

export interface PagoRegistrado {
  readonly idPago: string;
  readonly idCredito: string;
  readonly claveIdempotencia: string;
  readonly monto: Dinero;
}

export interface RepositorioPagos {
  buscarPorClave(
    claveIdempotencia: string
  ): PagoRegistrado | undefined;

  guardar(pago: PagoRegistrado): void;
}