import type {
  PagoRegistrado,
  RepositorioPagos
} from "../../aplicacion/puertos/repositorio-pagos.js";

export class RepositorioPagosMemoria
  implements RepositorioPagos {
  private readonly pagosPorClave =
    new Map<string, PagoRegistrado>();

  buscarPorClave(
    claveIdempotencia: string
  ): PagoRegistrado | undefined {
    return this.pagosPorClave.get(
      claveIdempotencia
    );
  }

  guardar(pago: PagoRegistrado): void {
    this.pagosPorClave.set(
      pago.claveIdempotencia,
      pago
    );
  }

  cantidad(): number {
    return this.pagosPorClave.size;
  }
}