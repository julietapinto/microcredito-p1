
import type { Pool } from "pg";
import { Dinero } from "../../dominio/dinero.js";
import type {
  PagoRegistrado,
  RepositorioPagos
} from "../../aplicacion/puertos/repositorio-pagos.js";

interface FilaPago {
  id_pago: string;
  id_credito: string;
  clave_idempotencia: string;
  monto_centavos: string;
}

export class ConflictoIdempotenciaError extends Error {
  constructor() {
    super(
      "La clave de idempotencia ya fue utilizada con otros datos"
    );
    this.name = "ConflictoIdempotenciaError";
  }
}

export class RepositorioPagosPostgres
  implements RepositorioPagos {

  constructor(private readonly pool: Pool) {}

  buscarPorClave(
    _claveIdempotencia: string
  ): PagoRegistrado | undefined {
    throw new Error(
      "Este repositorio requiere operaciones asíncronas."
    );
  }

  guardar(_pago: PagoRegistrado): void {
    throw new Error(
      "Este repositorio requiere operaciones asíncronas."
    );
  }

  async buscarPorClaveAsync(
    claveIdempotencia: string
  ): Promise<PagoRegistrado | undefined> {
    const resultado = await this.pool.query<FilaPago>(
      `SELECT
         id_pago::text,
         id_credito,
         clave_idempotencia,
         monto_centavos::text
       FROM pagos
       WHERE clave_idempotencia = $1
         AND origen = 'API'`,
      [claveIdempotencia]
    );

    const fila = resultado.rows[0];

    return fila ? this.convertirFila(fila) : undefined;
  }

  async guardarAsync(
    pago: PagoRegistrado,
    fecha: string,
    canal: string
  ): Promise<PagoRegistrado> {
    const montoCentavos = pago.monto
      .comoDecimal()
      .times(100)
      .toFixed(0);

    const resultado = await this.pool.query<FilaPago>(
      `INSERT INTO pagos (
         clave_idempotencia,
         id_credito,
         fecha,
         monto_centavos,
         canal,
         origen
       )
       VALUES ($1, $2, $3, $4, $5, 'API')
       ON CONFLICT (clave_idempotencia)
       DO NOTHING
       RETURNING
         id_pago::text,
         id_credito,
         clave_idempotencia,
         monto_centavos::text`,
      [
        pago.claveIdempotencia,
        pago.idCredito,
        fecha,
        montoCentavos,
        canal
      ]
    );

    const filaInsertada = resultado.rows[0];

    if (filaInsertada) {
      return this.convertirFila(filaInsertada);
    }

    const existente = await this.buscarPorClaveAsync(
      pago.claveIdempotencia
    );

    if (!existente) {
      throw new Error(
        "No fue posible recuperar el pago existente."
      );
    }

    const mismoCredito =
      existente.idCredito === pago.idCredito;

    const mismoMonto =
      existente.monto.esIgualA(pago.monto);

    if (!mismoCredito || !mismoMonto) {
      throw new ConflictoIdempotenciaError();
    }

    return existente;
  }

  private convertirFila(
    fila: FilaPago
  ): PagoRegistrado {
    const monto = Dinero.desde(
      (Number(fila.monto_centavos) / 100).toFixed(2)
    );

    return {
      idPago: fila.id_pago,
      idCredito: fila.id_credito,
      claveIdempotencia: fila.clave_idempotencia,
      monto
    };
  }
}
