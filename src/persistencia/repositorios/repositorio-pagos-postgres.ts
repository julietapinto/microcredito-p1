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
  fecha: string;
  canal: string;
  origen: string;
}

export class ConflictoIdempotenciaError extends Error {
  constructor() {
    super("La clave de idempotencia ya fue utilizada con otros datos");
    this.name = "ConflictoIdempotenciaError";
  }
}

export class RepositorioPagosPostgres implements RepositorioPagos {
  constructor(private readonly pool: Pool) {}

  buscarPorClave(_claveIdempotencia: string): PagoRegistrado | undefined {
    throw new Error("Este repositorio requiere operaciones asíncronas.");
  }

  guardar(_pago: PagoRegistrado): void {
    throw new Error("Este repositorio requiere operaciones asíncronas.");
  }

  async buscarPorClaveAsync(
    claveIdempotencia: string
  ): Promise<PagoRegistrado | undefined> {
    const resultado = await this.pool.query<FilaPago>(
      `SELECT id_pago::text, id_credito, clave_idempotencia,
              monto_centavos::text, fecha::text, canal, origen
       FROM pagos
       WHERE clave_idempotencia = $1`,
      [claveIdempotencia]
    );

    const fila = resultado.rows[0];
    return fila?.origen === "API" ? this.convertirFila(fila) : undefined;
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
         clave_idempotencia, id_credito, fecha,
         monto_centavos, canal, origen
       )
       VALUES ($1, $2, $3, $4, $5, 'API')
       ON CONFLICT (clave_idempotencia) DO NOTHING
       RETURNING id_pago::text, id_credito, clave_idempotencia,
                 monto_centavos::text, fecha::text, canal, origen`,
      [pago.claveIdempotencia, pago.idCredito, fecha, montoCentavos, canal]
    );

    const insertado = resultado.rows[0];
    if (insertado) return this.convertirFila(insertado);

    const consulta = await this.pool.query<FilaPago>(
      `SELECT id_pago::text, id_credito, clave_idempotencia,
              monto_centavos::text, fecha::text, canal, origen
       FROM pagos
       WHERE clave_idempotencia = $1
       FOR UPDATE`,
      [pago.claveIdempotencia]
    );

    const existente = consulta.rows[0];

    if (!existente) {
      throw new Error("No fue posible recuperar el pago existente.");
    }

    if (existente.origen !== "API") {
      throw new ConflictoIdempotenciaError();
    }

    const mismoCredito = existente.id_credito === pago.idCredito;
    const mismoMonto = BigInt(existente.monto_centavos) === BigInt(montoCentavos);
    const mismaFecha = existente.fecha === fecha;
    const mismoCanal = existente.canal === canal;

    if (!mismoCredito || !mismoMonto || !mismaFecha || !mismoCanal) {
      throw new ConflictoIdempotenciaError();
    }

    return this.convertirFila(existente);
  }

  private convertirFila(fila: FilaPago): PagoRegistrado {
    return {
      idPago: fila.id_pago,
      idCredito: fila.id_credito,
      claveIdempotencia: fila.clave_idempotencia,
      monto: Dinero.desde(
        (Number(fila.monto_centavos) / 100).toFixed(2)
      )
    };
  }
}
