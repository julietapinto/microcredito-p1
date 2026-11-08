import type { Pool, PoolClient } from "pg";
import { Decimal } from "decimal.js";
import { Dinero } from "../../dominio/dinero.js";
import {
    calcularDiasAtraso,
    clasificarMora
} from "../../dominio/calculadora-mora.js";
import { aplicarPrelacion } from "../../dominio/prelacion-pago.js";
import { PoliticaPlana } from "../../dominio/politica-mora/politica-plana.js";
import { PoliticaEscalonada } from "../../dominio/politica-mora/politica-escalonada.js";
import type {
    PoliticaMora,
    ResultadoPoliticaMora
} from "../../dominio/politica-mora/politica-mora.js";

interface Credito {
    id_credito: string;
    fecha_otorgamiento: string;
}

interface Cuota {
    id_cuota: string;
    numero_cuota: number;
    fecha_vencimiento: string;
    amortizacion_centavos: string;
    interes_corriente_centavos: string;
    gastos_aplicados: string;
    moratorio_aplicado: string;
    corriente_aplicado: string;
    capital_aplicado: string;
}

interface PoliticaFila {
    codigo: string;
    nombre: string;
    parametros: {
        tipo: "plana" | "escalonada";
        nombre: string;
        tna_bps?: number;
        tramos?: {
            id: string;
            ini: number;
            fin: number;
            bps: number;
        }[];
        vigencia_otorgamiento: {
            desde?: string;
            hasta?: string;
        };
    };
}

interface MovimientoCapital {
    fecha: string;
    capitalCentavos: string;
}

interface HistorialCapital {
    id_cuota: string;
    fecha: string;
    capital_centavos: string;
}

interface DesgloseMora {
    tramo: string;
    dias: number;
    tasaNominalAnual: string;
    interesSinRedondear: string;
}

export interface ObligacionCuota {
    idCuota: string;
    numeroCuota: number;
    fechaVencimiento: string;
    diasAtraso: number;
    tramo: string;
    gastos: string;
    interesMoratorio: string;
    interesCorriente: string;
    capital: string;
    total: string;
    desgloseMora: readonly DesgloseMora[];
}

export interface DeudaCredito {
    idCredito: string;
    fechaCorte: string;
    politica: string;
    cuotasVencidas: ObligacionCuota[];
    total: {
        gastos: string;
        interesMoratorio: string;
        interesCorriente: string;
        capital: string;
        exigible: string;
    };
    incobrable: boolean;
    diasAtrasoMaximo: number;
    pagosCanonicosSinConciliar: number;
    registroPermitido: boolean;
    advertencia: string;
}

function dineroCentavos(value: string): Dinero {
    const centavos = BigInt(value);
    const unidades = centavos / 100n;
    const fraccion = (centavos % 100n)
        .toString()
        .padStart(2, "0");

    return Dinero.desde(`${unidades}.${fraccion}`);
}

function centavos(value: Dinero): bigint {
    return BigInt(
        value.comoDecimal().times(100).toFixed(0)
    );
}

function textoCentavos(value: bigint): string {
    return `Q${value / 100n}.${(value % 100n)
        .toString()
        .padStart(2, "0")}`;
}

function restaNoNegativa(a: string, b: string): Dinero {
    const restante = BigInt(a) - BigInt(b);

    return dineroCentavos(
        (restante > 0n ? restante : 0n).toString()
    );
}

function seleccionarPolitica(
    fecha: string,
    filas: PoliticaFila[]
): PoliticaFila | undefined {
    return filas.find(({ parametros }) => {
        const { desde, hasta } =
            parametros.vigencia_otorgamiento;

        return (!desde || fecha >= desde) &&
            (!hasta || fecha <= hasta);
    });
}

function construirPolitica(
    fila: PoliticaFila
): PoliticaMora {
    if (fila.parametros.tipo === "plana") {
        if (fila.parametros.tna_bps === undefined) {
            throw new Error(
                `La política ${fila.codigo} no define tasa.`
            );
        }

        return new PoliticaPlana({
            codigo: fila.codigo,
            tasaNominalAnual:
                (fila.parametros.tna_bps / 10000).toString(),
            baseConteo: 360
        });
    }

    if (!fila.parametros.tramos?.length) {
        throw new Error(
            `La política ${fila.codigo} no define tramos.`
        );
    }

    return new PoliticaEscalonada({
        codigo: fila.codigo,
        baseConteo: 360,
        tramos: fila.parametros.tramos.map((tramo) => ({
            nombre: tramo.id,
            inicio: tramo.ini,
            fin: tramo.fin,
            tasaNominalAnual:
                (tramo.bps / 10000).toString()
        }))
    });
}

function sumar(a: bigint, b: bigint): bigint {
    return a + b;
}

/**
 * Genera explícitamente los cargos de gestión exigibles.
 * Debe invocarse dentro de una transacción activa y después
 * de validar la idempotencia del pago.
 */
export async function generarGastosGestionCobro(
    client: PoolClient,
    idCredito: string,
    fechaCorte: string
): Promise<void> {
    const creditoResult = await client.query<Credito>(
        `SELECT id_credito, fecha_otorgamiento::text
         FROM creditos
         WHERE id_credito = $1
             FOR UPDATE`,
        [idCredito]
    );

    const credito = creditoResult.rows[0];

    if (!credito) {
        throw new Error(`No existe el crédito ${idCredito}.`);
    }

    const politicasResult = await client.query<PoliticaFila>(
        "SELECT codigo, nombre, parametros FROM politicas"
    );

    const politicaFila = seleccionarPolitica(
        credito.fecha_otorgamiento,
        politicasResult.rows
    );

    if (!politicaFila) {
        throw new Error(
            "No existe política de mora vigente para el crédito."
        );
    }

    if (politicaFila.codigo !== "POL-2026-10") {
        return;
    }

    await client.query(
        `INSERT INTO gastos_gestion_cobro (
            id_cuota,
            monto_centavos,
            generado_en
        )
         SELECT
             q.id_cuota,
             2500,
             (q.fecha_vencimiento + 31)::date
         FROM cuotas_proyectadas q
         WHERE q.id_credito = $1
           AND q.fecha_vencimiento <= ($2::date - 31)
             ON CONFLICT (id_cuota) DO NOTHING`,
        [idCredito, fechaCorte]
    );
}

/**
 * Calcula el incremento de mora entre dos edades de atraso,
 * manteniendo constante el capital durante ese intervalo.
 *
 * Se usa la diferencia entre dos cálculos acumulados para
 * respetar los tramos y los límites definidos por la política.
 */
function calcularIncrementoMora(
    politica: PoliticaMora,
    capitalCentavos: bigint,
    diasInicio: number,
    diasFin: number
): {
    interesCentavos: bigint;
    desglose: DesgloseMora[];
} {
    if (
        capitalCentavos <= 0n ||
        diasFin <= diasInicio
    ) {
        return {
            interesCentavos: 0n,
            desglose: []
        };
    }

    const inicio = Math.min(diasInicio, 120);
    const fin = Math.min(diasFin, 120);

    if (fin <= inicio) {
        return {
            interesCentavos: 0n,
            desglose: []
        };
    }

    const capital = dineroCentavos(
        capitalCentavos.toString()
    );

    const calculoInicio = politica.calcular(capital, inicio);
    const calculoFin = politica.calcular(capital, fin);

    const interesCentavos =
        centavos(calculoFin.interesMoratorio) -
        centavos(calculoInicio.interesMoratorio);

    const desglose = calcularDiferenciaDesglose(
        calculoInicio,
        calculoFin
    );

    return {
        interesCentavos:
            interesCentavos > 0n ? interesCentavos : 0n,
        desglose
    };
}

/**
 * Obtiene únicamente los días e intereses correspondientes
 * al intervalo, sin repetir los días ya calculados.
 */
function calcularDiferenciaDesglose(
    inicio: ResultadoPoliticaMora,
    fin: ResultadoPoliticaMora
): DesgloseMora[] {
    const resultado: DesgloseMora[] = [];

    const claves = new Set([
        ...inicio.desglose.map(
            (item) => `${item.tramo}|${item.tasaNominalAnual}`
        ),
        ...fin.desglose.map(
            (item) => `${item.tramo}|${item.tasaNominalAnual}`
        )
    ]);

    for (const clave of claves) {
        const [tramo, tasa] = clave.split("|");

        const desgloseInicio = inicio.desglose.find(
            (item) =>
                item.tramo === tramo &&
                item.tasaNominalAnual === tasa
        );

        const desgloseFin = fin.desglose.find(
            (item) =>
                item.tramo === tramo &&
                item.tasaNominalAnual === tasa
        );

        const diasInicio = desgloseInicio?.dias ?? 0;
        const diasFin = desgloseFin?.dias ?? 0;

        const interesInicio = new Decimal(
            desgloseInicio?.interesSinRedondear ?? "0"
        );

        const interesFin = new Decimal(
            desgloseFin?.interesSinRedondear ?? "0"
        );

        const dias = diasFin - diasInicio;
        const interes = interesFin.minus(interesInicio);

        if (dias <= 0 || !interes.isPositive()) {
            continue;
        }

        resultado.push({
            tramo: tramo ?? "",
            dias,
            tasaNominalAnual: tasa ?? "0",
            interesSinRedondear: interes.toFixed(4)
        });
    }

    return resultado;
}

/**
 * Reconstruye la base de capital durante la mora.
 *
 * Los intereses anteriores a un abono se mantienen calculados
 * sobre el capital que existía antes de ese abono.
 * Los períodos siguientes utilizan el capital reducido.
 *
 * Convención: el pago reduce la base después de devengar
 * la mora correspondiente al día de su fecha.
 */
function calcularMoraHistorica(
    politica: PoliticaMora,
    capitalOriginalCentavos: bigint,
    fechaVencimiento: string,
    fechaCorte: string,
    movimientos: MovimientoCapital[]
): {
    interesMoratorio: Dinero;
    desglose: DesgloseMora[];
} {
    let capitalPendiente = capitalOriginalCentavos;
    let diasCalculados = 0;
    let moraAcumulada = 0n;

    const desglose: DesgloseMora[] = [];

    const movimientosOrdenados = [...movimientos]
        .filter(
            (movimiento) =>
                BigInt(movimiento.capitalCentavos) > 0n &&
                movimiento.fecha <= fechaCorte
        )
        .sort((a, b) => a.fecha.localeCompare(b.fecha));

    for (const movimiento of movimientosOrdenados) {
        const diasMovimiento = calcularDiasAtraso(
            fechaVencimiento,
            movimiento.fecha
        );

        const diasFinales = Math.max(
            diasCalculados,
            Math.max(0, diasMovimiento)
        );

        const incremento = calcularIncrementoMora(
            politica,
            capitalPendiente,
            diasCalculados,
            diasFinales
        );

        moraAcumulada += incremento.interesCentavos;
        desglose.push(...incremento.desglose);

        const capitalAplicado = BigInt(
            movimiento.capitalCentavos
        );

        capitalPendiente -= capitalAplicado;

        if (capitalPendiente < 0n) {
            capitalPendiente = 0n;
        }

        diasCalculados = diasFinales;
    }

    const diasCorte = calcularDiasAtraso(
        fechaVencimiento,
        fechaCorte
    );

    const incrementoFinal = calcularIncrementoMora(
        politica,
        capitalPendiente,
        diasCalculados,
        Math.max(diasCalculados, diasCorte)
    );

    moraAcumulada += incrementoFinal.interesCentavos;
    desglose.push(...incrementoFinal.desglose);

    // Se conserva el límite de mora definido por el cálculo anterior:
    // el moratorio no puede superar el capital pendiente actual.
    if (moraAcumulada > capitalPendiente) {
        moraAcumulada = capitalPendiente;
    }

    return {
        interesMoratorio: dineroCentavos(
            moraAcumulada.toString()
        ),
        desglose
    };
}

export async function calcularDeudaCredito(
    pool: Pool,
    idCredito: string,
    fechaCorte: string,
    client?: PoolClient
): Promise<DeudaCredito> {
    const db = client ?? pool;

    const creditoResult = await db.query<Credito>(
        `SELECT id_credito, fecha_otorgamiento::text
         FROM creditos
         WHERE id_credito = $1`,
        [idCredito]
    );

    const credito = creditoResult.rows[0];

    if (!credito) {
        throw new Error(`No existe el crédito ${idCredito}.`);
    }

    const calendario = await db.query<{ existe: boolean }>(
        `SELECT EXISTS (
            SELECT 1
            FROM cuotas_proyectadas
            WHERE id_credito = $1
        ) AS existe`,
        [idCredito]
    );

    if (!calendario.rows[0]?.existe) {
        throw new Error(
            `El crédito ${idCredito} no tiene calendario proyectado. ` +
            "Debe generarse mediante la operación explícita de calendario."
        );
    }

    const politicaResult = await db.query<PoliticaFila>(
        "SELECT codigo, nombre, parametros FROM politicas"
    );

    const politicaFila = seleccionarPolitica(
        credito.fecha_otorgamiento,
        politicaResult.rows
    );

    if (!politicaFila) {
        throw new Error(
            "No existe política de mora vigente para el crédito."
        );
    }

    const politica = construirPolitica(politicaFila);

    const historial = await db.query<{ cantidad: string }>(
        `SELECT COUNT(*)::text AS cantidad
         FROM pagos p
         WHERE p.id_credito = $1
           AND p.origen = 'CANONICO'
           AND p.fecha <= $2::date
       AND NOT EXISTS (
         SELECT 1
         FROM aplicaciones_pagos a
         WHERE a.id_pago = p.id_pago
       )`,
        [idCredito, fechaCorte]
    );

    const pagosCanonicosSinConciliar = Number(
        historial.rows[0]?.cantidad ?? 0
    );

    const cuotasResult = await db.query<Cuota>(
        `SELECT
             q.id_cuota::text,
             q.numero_cuota,
             q.fecha_vencimiento::text,
             q.amortizacion_centavos::text,
             q.interes_corriente_centavos::text,
             COALESCE(a.gastos_aplicados, 0)::text AS gastos_aplicados,
             COALESCE(a.moratorio_aplicado, 0)::text AS moratorio_aplicado,
             COALESCE(a.corriente_aplicado, 0)::text AS corriente_aplicado,
             COALESCE(a.capital_aplicado, 0)::text AS capital_aplicado
         FROM cuotas_proyectadas q
                  LEFT JOIN (
             SELECT
                 ap.id_cuota,
                 SUM(ap.gastos_centavos) AS gastos_aplicados,
                 SUM(ap.moratorio_centavos) AS moratorio_aplicado,
                 SUM(ap.corriente_centavos) AS corriente_aplicado,
                 SUM(ap.capital_centavos) AS capital_aplicado
             FROM aplicaciones_pagos ap
                      INNER JOIN pagos p
                                 ON p.id_pago = ap.id_pago
             WHERE p.fecha <= $2::date
             GROUP BY ap.id_cuota
         ) a
                            ON a.id_cuota = q.id_cuota
         WHERE q.id_credito = $1
           AND q.fecha_vencimiento <= $2::date
         ORDER BY q.fecha_vencimiento, q.numero_cuota`,
        [idCredito, fechaCorte]
    );

    // Historial de abonos a capital agrupados por cuota y fecha.
    // Se excluyen pagos posteriores a la fecha de corte.
    const historialCapitalResult =
        await db.query<HistorialCapital>(
            `SELECT
                 a.id_cuota::text,
                 p.fecha::text AS fecha,
                 SUM(a.capital_centavos)::text AS capital_centavos
             FROM aplicaciones_pagos a
                      INNER JOIN pagos p
                                 ON p.id_pago = a.id_pago
                      INNER JOIN cuotas_proyectadas q
                                 ON q.id_cuota = a.id_cuota
             WHERE q.id_credito = $1
               AND p.fecha <= $2::date
         AND a.capital_centavos > 0
             GROUP BY a.id_cuota, p.fecha
             ORDER BY a.id_cuota, p.fecha`,
            [idCredito, fechaCorte]
        );

    const movimientosPorCuota =
        new Map<string, MovimientoCapital[]>();

    for (const movimiento of historialCapitalResult.rows) {
        const movimientos =
            movimientosPorCuota.get(movimiento.id_cuota) ?? [];

        movimientos.push({
            fecha: movimiento.fecha,
            capitalCentavos: movimiento.capital_centavos
        });

        movimientosPorCuota.set(
            movimiento.id_cuota,
            movimientos
        );
    }

    let gastosTotal = 0n;
    let moraTotal = 0n;
    let corrienteTotal = 0n;
    let capitalTotal = 0n;

    let diasAtrasoMaximo = 0;
    let incobrable = false;

    const cuotasVencidas: ObligacionCuota[] = [];

    for (const cuota of cuotasResult.rows) {
        const dias = calcularDiasAtraso(
            cuota.fecha_vencimiento,
            fechaCorte
        );

        const tramo = clasificarMora(dias);

        const capital = restaNoNegativa(
            cuota.amortizacion_centavos,
            cuota.capital_aplicado
        );

        const corriente = restaNoNegativa(
            cuota.interes_corriente_centavos,
            cuota.corriente_aplicado
        );

        const calculoMora =
            dias > 120
                ? {
                    interesMoratorio: Dinero.cero(),
                    desglose: [] as DesgloseMora[]
                }
                : calcularMoraHistorica(
                    politica,
                    BigInt(cuota.amortizacion_centavos),
                    cuota.fecha_vencimiento,
                    fechaCorte,
                    movimientosPorCuota.get(cuota.id_cuota) ?? []
                );

        const gastoResult = await db.query<{
            monto: string;
            aplicado: string;
        }>(
            `SELECT
                 COALESCE(g.monto_centavos, 2500)::text AS monto,
                 COALESCE((
                              SELECT SUM(a.gastos_centavos)
                              FROM aplicaciones_pagos a
                                       INNER JOIN pagos p
                                                  ON p.id_pago = a.id_pago
                              WHERE a.id_cuota = q.id_cuota
                                AND p.fecha <= $2::date
                     ), 0)::text AS aplicado
             FROM (SELECT $1::bigint AS id_cuota) q
                      LEFT JOIN gastos_gestion_cobro g
                                ON g.id_cuota = q.id_cuota`,
            [cuota.id_cuota, fechaCorte]
        );

        const gastoFila = gastoResult.rows[0];

        const gasto =
            politicaFila.codigo === "POL-2026-10" && dias >= 31
                ? restaNoNegativa(
                    gastoFila?.monto ?? "2500",
                    gastoFila?.aplicado ?? "0"
                )
                : Dinero.cero();

        const moraRestante = restaNoNegativa(
            centavos(calculoMora.interesMoratorio).toString(),
            cuota.moratorio_aplicado
        );

        const total = gasto
            .sumar(moraRestante)
            .sumar(corriente)
            .sumar(capital);

        if (total.esCero()) {
            continue;
        }

        diasAtrasoMaximo = Math.max(
            diasAtrasoMaximo,
            dias
        );

        if (dias > 120 && !capital.esCero()) {
            incobrable = true;
        }

        gastosTotal = sumar(gastosTotal, centavos(gasto));
        moraTotal = sumar(moraTotal, centavos(moraRestante));

        corrienteTotal = sumar(
            corrienteTotal,
            centavos(corriente)
        );

        capitalTotal = sumar(
            capitalTotal,
            centavos(capital)
        );

        cuotasVencidas.push({
            idCuota: cuota.id_cuota,
            numeroCuota: cuota.numero_cuota,
            fechaVencimiento: cuota.fecha_vencimiento,
            diasAtraso: dias,
            tramo,
            gastos: gasto.comoTexto(),
            interesMoratorio: moraRestante.comoTexto(),
            interesCorriente: corriente.comoTexto(),
            capital: capital.comoTexto(),
            total: total.comoTexto(),
            desgloseMora: calculoMora.desglose
        });
    }

    const exigible =
        gastosTotal +
        moraTotal +
        corrienteTotal +
        capitalTotal;

    const advertencia =
        pagosCanonicosSinConciliar > 0
            ? `Hay ${pagosCanonicosSinConciliar} pagos históricos CANONICO sin aplicación a cuotas. El cálculo es provisional y NO puede usarse para cobrar ni registrar un pago hasta conciliarlos.`
            : "Cálculo sobre cuotas proyectadas; confirmar que el calendario corresponde al contrato antes de usarlo como liquidación contractual.";

    return {
        idCredito,
        fechaCorte,
        politica: politicaFila.codigo,
        cuotasVencidas,
        total: {
            gastos: textoCentavos(gastosTotal),
            interesMoratorio: textoCentavos(moraTotal),
            interesCorriente: textoCentavos(corrienteTotal),
            capital: textoCentavos(capitalTotal),
            exigible: textoCentavos(exigible)
        },
        incobrable,
        diasAtrasoMaximo,
        pagosCanonicosSinConciliar,
        registroPermitido:
            pagosCanonicosSinConciliar === 0 &&
            !incobrable &&
            exigible > 0n,
        advertencia
    };
}

export async function aplicarPagoExacto(
    client: PoolClient,
    idPago: string,
    deuda: DeudaCredito
): Promise<void> {
    const total = deuda.cuotasVencidas.reduce(
        (acc, cuota) =>
            acc +
            BigInt(
                cuota.total.replace(/^Q/, "").replace(".", "")
            ),
        0n
    );

    await aplicarPagoParcial(
        client,
        idPago,
        deuda,
        dineroCentavos(total.toString())
    );
}

export async function aplicarPagoParcial(
    client: PoolClient,
    idPago: string,
    deuda: DeudaCredito,
    montoPago: Dinero
): Promise<void> {
    if (!deuda.registroPermitido) {
        throw new Error(
            "El registro del pago no está permitido para este crédito."
        );
    }

    if (montoPago.esCero() || montoPago.esNegativo()) {
        throw new Error(
            "El monto del pago debe ser mayor que cero."
        );
    }

    const totalExigible = deuda.cuotasVencidas.reduce(
        (acc, cuota) =>
            acc +
            BigInt(
                cuota.total.replace(/^Q/, "").replace(".", "")
            ),
        0n
    );

    let disponible = centavos(montoPago);

    if (disponible > totalExigible) {
        throw new Error(
            "El pago supera el total exigible del crédito."
        );
    }

    for (const cuota of deuda.cuotasVencidas) {
        if (disponible === 0n) {
            break;
        }

        const obligaciones = {
            gastos: Dinero.desde(
                cuota.gastos.replace(/^Q/, "")
            ),
            interesMoratorio: Dinero.desde(
                cuota.interesMoratorio.replace(/^Q/, "")
            ),
            interesCorriente: Dinero.desde(
                cuota.interesCorriente.replace(/^Q/, "")
            ),
            capital: Dinero.desde(
                cuota.capital.replace(/^Q/, "")
            )
        };

        const resultado = aplicarPrelacion(
            dineroCentavos(disponible.toString()),
            obligaciones
        );

        const gastos = centavos(resultado.gastos);
        const moratorio = centavos(
            resultado.interesMoratorio
        );
        const corriente = centavos(
            resultado.interesCorriente
        );
        const capital = centavos(resultado.capital);

        const aplicado =
            gastos + moratorio + corriente + capital;

        if (aplicado > disponible) {
            throw new Error(
                "La aplicación supera el saldo disponible del pago."
            );
        }

        if (aplicado > 0n) {
            await client.query(
                `INSERT INTO aplicaciones_pagos (
                    id_pago,
                    id_cuota,
                    gastos_centavos,
                    moratorio_centavos,
                    corriente_centavos,
                    capital_centavos
                )
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [
                    idPago,
                    cuota.idCuota,
                    gastos.toString(),
                    moratorio.toString(),
                    corriente.toString(),
                    capital.toString()
                ]
            );
        }

        disponible = centavos(resultado.excedente);
    }

    if (disponible !== 0n) {
        throw new Error(
            "No se pudo distribuir completamente el pago."
        );
    }
}
