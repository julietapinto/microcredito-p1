import { Dinero } from "../../dominio/dinero.js";
import type {
  PagoRegistrado,
  RepositorioPagos
} from "../puertos/repositorio-pagos.js";

export interface ComandoRegistrarPago {
  readonly idPago: string;
  readonly idCredito: string;
  readonly claveIdempotencia: string;
  readonly monto: Dinero;
}

export class RegistrarPago {
  constructor(
    private readonly repositorio: RepositorioPagos
  ) {}

  ejecutar(
    comando: ComandoRegistrarPago
  ): PagoRegistrado {
    this.validar(comando);

    const pagoExistente =
      this.repositorio.buscarPorClave(
        comando.claveIdempotencia
      );

    if (pagoExistente) {
      this.validarReintento(
        pagoExistente,
        comando
      );

      return pagoExistente;
    }

    const nuevoPago: PagoRegistrado = {
      idPago: comando.idPago,
      idCredito: comando.idCredito,
      claveIdempotencia:
        comando.claveIdempotencia,
      monto: comando.monto
    };

    this.repositorio.guardar(nuevoPago);

    return nuevoPago;
  }

  private validar(
    comando: ComandoRegistrarPago
  ): void {
    if (comando.idPago.trim() === "") {
      throw new Error(
        "El identificador del pago es obligatorio"
      );
    }

    if (comando.idCredito.trim() === "") {
      throw new Error(
        "El identificador del crédito es obligatorio"
      );
    }

    if (comando.claveIdempotencia.trim() === "") {
      throw new Error(
        "La clave de idempotencia es obligatoria"
      );
    }

    if (
      comando.monto.esCero() ||
      comando.monto.esNegativo()
    ) {
      throw new Error(
        "El monto del pago debe ser mayor que cero"
      );
    }
  }

  private validarReintento(
    pagoExistente: PagoRegistrado,
    comando: ComandoRegistrarPago
  ): void {
    const mismoCredito =
      pagoExistente.idCredito ===
      comando.idCredito;

    const mismoMonto =
      pagoExistente.monto.esIgualA(
        comando.monto
      );

    if (!mismoCredito || !mismoMonto) {
      throw new Error(
        "La clave de idempotencia ya fue utilizada con otros datos"
      );
    }
  }
}