import {
  addDays,
  format,
  isValid,
  parseISO
} from "date-fns";

import {
  calcularDiasAtraso,
  clasificarMora,
  type TramoMora
} from "../dominio/calculadora-mora.js";

import {
  Dinero
} from "../dominio/dinero.js";

import {
  aplicarPrelacion
} from "../dominio/prelacion-pago.js";

import {
  RegistrarPago
} from "../aplicacion/casos-uso/registrar-pago.js";

import {
  RepositorioPagosMemoria
} from "../infraestructura/memoria/repositorio-pagos-memoria.js";

import {
  CatalogoPoliticasMora
} from "../dominio/politica-mora/catalogo-politicas.js";

import {
  PoliticaEscalonada
} from "../dominio/politica-mora/politica-escalonada.js";

import {
  PoliticaPlana
} from "../dominio/politica-mora/politica-plana.js";

import type {
  CreditoMemoria,
  DatosAsistenteMemoria
} from "./datos-asistente-memoria.js";

import type {
  ConsultaCreditoMcp,
  CreditoEnMoraMcp,
  DeudaCuotaMcp,
  DineroMcp,
  ExplicacionMoraMcp,
  ListadoCreditosMoraMcp,
  ProximosVencimientosMcp,
  PuertoAsistente
} from "./puerto-asistente.js";

import {
  calcularCarteraRiesgo
} from "../dominio/cartera.js";

import type {
  ConsultaCarteraMcp,
  ConsultaCierreMcp,
  PagoRegistradoMcp,
  SolicitudRegistroPagoMcp,
  TipoCierreMcp
} from "./puerto-asistente.js";

type ConsultasIniciales = Pick<
  PuertoAsistente,
  | "consultarCredito"
  | "calcularDeudaCuota"
  | "explicarMora"
  | "listarCreditosEnMora"
  | "verProximosVencimientos"
  | "consultarCartera"
  | "consultarCierre"
  | "registrarPago"
>;

export class AdaptadorAsistenteMemoria
  implements ConsultasIniciales {
  private readonly catalogoPoliticas =
    crearCatalogoPoliticas();
  private readonly repositorioPagos =
    new RepositorioPagosMemoria();

  private readonly casoRegistrarPago =
    new RegistrarPago(this.repositorioPagos);

  private readonly resultadosPagos =
    new Map<string, PagoRegistradoMcp>();

  constructor(
    private readonly datos: DatosAsistenteMemoria
    
  ) {}

  async consultarCredito(
    idCredito: string,
    fechaCorte: string
  ): Promise<ConsultaCreditoMcp> {
    validarFecha(fechaCorte);

    const credito = this.buscarCredito(idCredito);

    const cuotasPagadas =
      credito.cuotas.filter(
        (cuota) => cuota.pagada
      ).length;

    const cuotasVencidas =
      credito.cuotas.filter(
        (cuota) =>
          !cuota.pagada &&
          calcularDiasAtraso(
            cuota.fechaVencimiento,
            fechaCorte
          ) > 0
      );

    const diasAtraso =
      this.obtenerDiasAtrasoCredito(
        credito,
        fechaCorte
      );

    const proximaCuota =
      credito.cuotas
        .filter(
          (cuota) =>
            !cuota.pagada &&
            cuota.fechaVencimiento >= fechaCorte
        )
        .sort(
          (a, b) =>
            a.fechaVencimiento.localeCompare(
              b.fechaVencimiento
            )
        )[0];

    return {
      idCredito: credito.idCredito,
      estado: credito.estado,
      saldo: convertirDinero(
        credito.saldoCapital
      ),
      diasAtraso,
      tramo: clasificarMora(diasAtraso),
      cuotasPagadas,
      cuotasVencidas: cuotasVencidas.length,
      proximaCuota: proximaCuota
        ? {
            numero: proximaCuota.numero,
            fechaVencimiento:
              proximaCuota.fechaVencimiento,
            monto: convertirDinero(
              proximaCuota.capital.sumar(
                proximaCuota.interesCorriente
              )
            )
          }
        : null
    };
  }

  async calcularDeudaCuota(
    idCredito: string,
    numeroCuota: number,
    fechaCorte: string
  ): Promise<DeudaCuotaMcp> {
    validarFecha(fechaCorte);

    const credito = this.buscarCredito(idCredito);

    const cuota = credito.cuotas.find(
      (actual) => actual.numero === numeroCuota
    );

    if (!cuota) {
      throw new Error(
        `No existe la cuota ${numeroCuota} del crédito ${idCredito}`
      );
    }

    if (cuota.pagada) {
      throw new Error(
        `La cuota ${numeroCuota} ya está pagada`
      );
    }

    const diasAtraso = calcularDiasAtraso(
      cuota.fechaVencimiento,
      fechaCorte
    );

    const politica =
      this.catalogoPoliticas.resolver(
        credito.fechaOtorgamiento
      );

    const resultadoMora = politica.calcular(
      cuota.capital,
      diasAtraso
    );

    const gastos =
      diasAtraso >= 31
        ? Dinero.desde("25.00", "GTQ")
        : Dinero.cero("GTQ");

    const totalExigible = gastos
      .sumar(resultadoMora.interesMoratorio)
      .sumar(cuota.interesCorriente)
      .sumar(cuota.capital);

    return {
      idCredito,
      numeroCuota,
      fechaCorte,
      gastos: convertirDinero(gastos),
      interesMoratorio: convertirDinero(
        resultadoMora.interesMoratorio
      ),
      interesCorriente: convertirDinero(
        cuota.interesCorriente
      ),
      capital: convertirDinero(cuota.capital),
      totalExigible: convertirDinero(
        totalExigible
      )
    };
  }

  async explicarMora(
    idCredito: string,
    fechaCorte: string
  ): Promise<ExplicacionMoraMcp> {
    validarFecha(fechaCorte);

    const credito = this.buscarCredito(idCredito);

    const cuotasVencidas =
      credito.cuotas
        .filter(
          (cuota) =>
            !cuota.pagada &&
            calcularDiasAtraso(
              cuota.fechaVencimiento,
              fechaCorte
            ) > 0
        )
        .sort(
          (a, b) =>
            a.fechaVencimiento.localeCompare(
              b.fechaVencimiento
            )
        );

    const cuotaEnMora = cuotasVencidas[0];

    if (!cuotaEnMora) {
      const cero = Dinero.cero("GTQ");

      return {
        idCredito,
        fechaCorte,
        capitalEnMora: convertirDinero(cero),
        tramosRecorridos: [],
        interesMoratorioTotal:
          convertirDinero(cero)
      };
    }

    const diasAtraso = calcularDiasAtraso(
      cuotaEnMora.fechaVencimiento,
      fechaCorte
    );

    const politica =
      this.catalogoPoliticas.resolver(
        credito.fechaOtorgamiento
      );

    const resultado = politica.calcular(
      cuotaEnMora.capital,
      diasAtraso
    );

    return {
      idCredito,
      fechaCorte,
      capitalEnMora: convertirDinero(
        cuotaEnMora.capital
      ),
      tramosRecorridos:
        resultado.desglose.map(
          (tramo) => ({
            tramo: tramo.tramo,
            dias: tramo.dias,
            tasaNominalAnual:
              tramo.tasaNominalAnual,
            interesGenerado: convertirDinero(
              Dinero.desde(
                tramo.interesSinRedondear,
                cuotaEnMora.capital.moneda
              )
            )
          })
        ),
      interesMoratorioTotal:
        convertirDinero(
          resultado.interesMoratorio
        )
    };
  }

  async listarCreditosEnMora(
    fechaCorte: string,
    tramo?: TramoMora
  ): Promise<ListadoCreditosMoraMcp> {
    validarFecha(fechaCorte);

    const creditos: CreditoEnMoraMcp[] =
      this.datos.creditos
        .map((credito) => {
          const diasAtraso =
            this.obtenerDiasAtrasoCredito(
              credito,
              fechaCorte
            );

          return {
            idCredito: credito.idCredito,
            diasAtraso,
            tramo: clasificarMora(diasAtraso),
            saldo: convertirDinero(
              credito.saldoCapital
            )
          };
        })
        .filter(
          (credito) =>
            credito.diasAtraso > 0 &&
            (!tramo || credito.tramo === tramo)
        );

    return {
      fechaCorte,
      filtroTramo: tramo ?? null,
      totalCreditos: creditos.length,
      creditos
    };
  }

  async verProximosVencimientos(
    fechaCorte: string,
    ventanaDias: number
  ): Promise<ProximosVencimientosMcp> {
    validarFecha(fechaCorte);

    if (
      !Number.isInteger(ventanaDias) ||
      ventanaDias < 0
    ) {
      throw new Error(
        "La ventana de días debe ser un entero no negativo"
      );
    }

    const fechaLimite = format(
      addDays(parseISO(fechaCorte), ventanaDias),
      "yyyy-MM-dd"
    );

    const cuotas =
      this.datos.creditos.flatMap(
        (credito) =>
          credito.cuotas
            .filter(
              (cuota) =>
                !cuota.pagada &&
                cuota.fechaVencimiento >=
                  fechaCorte &&
                cuota.fechaVencimiento <=
                  fechaLimite
            )
            .map((cuota) => ({
              idCredito: credito.idCredito,
              numeroCuota: cuota.numero,
              fechaVencimiento:
                cuota.fechaVencimiento,
              monto: convertirDinero(
                cuota.capital.sumar(
                  cuota.interesCorriente
                )
              )
            }))
      );

    const montoTotal = cuotas.reduce(
      (total, cuota) =>
        total.sumar(
          Dinero.desde(
            cuota.monto.monto,
            "GTQ"
          )
        ),
      Dinero.cero("GTQ")
    );

    return {
      fechaCorte,
      ventanaDias,
      totalCuotas: cuotas.length,
      montoTotal: convertirDinero(montoTotal),
      cuotas
    };
  }
async consultarCartera(
  fechaCorte: string
): Promise<ConsultaCarteraMcp> {
  validarFecha(fechaCorte);

  const creditosCartera =
    this.datos.creditos.map(
      (credito) => ({
        id: credito.idCredito,
        saldoCapital: credito.saldoCapital,
        diasAtraso:
          this.obtenerDiasAtrasoCredito(
            credito,
            fechaCorte
          ),
        reestructurado: credito.reestructurado,
        incobrable:
          credito.estado === "INCOBRABLE"
      })
    );

  const resultado =
    calcularCarteraRiesgo(creditosCartera);

  const carteraEnMora =
    creditosCartera
      .filter(
        (credito) =>
          !credito.incobrable &&
          credito.diasAtraso > 0
      )
      .reduce(
        (total, credito) =>
          total.sumar(credito.saldoCapital),
        Dinero.cero("GTQ")
      );

  const incobrableDelPeriodo =
    creditosCartera
      .filter((credito) => credito.incobrable)
      .reduce(
        (total, credito) =>
          total.sumar(credito.saldoCapital),
        Dinero.cero("GTQ")
      );

  return {
    fechaCorte,
    carteraActiva:
      convertirDinero(resultado.carteraActiva),
    carteraEnMora:
      convertirDinero(carteraEnMora),
    carteraEnRiesgo:
      convertirDinero(
        resultado.capitalEnRiesgo
      ),
    porcentajeEnRiesgo:
      resultado.porcentaje,
    desglosePorTramo:
      resultado.desglosePorTramo.map(
        (desglose) => ({
          tramo: desglose.tramo,
          cantidadCreditos:
            desglose.creditos.length,
          capital: convertirDinero(
            desglose.saldoCapital
          )
        })
      ),
    incobrableDelPeriodo:
      convertirDinero(incobrableDelPeriodo)
  };
}
  async consultarCierre(
    tipo: TipoCierreMcp,
    fechaCorte: string
  ): Promise<ConsultaCierreMcp> {
    validarFecha(fechaCorte);

    const periodoDesde =
      tipo === "DIARIO"
        ? fechaCorte
        : `${fechaCorte.slice(0, 7)}-01`;

    const movimientos =
      this.datos.movimientos.filter(
        (movimiento) =>
          movimiento.fecha >= periodoDesde &&
          movimiento.fecha <= fechaCorte
      );

    const desembolsos = movimientos
      .filter(
        (movimiento) =>
          movimiento.tipo === "DESEMBOLSO"
      )
      .reduce(
        (total, movimiento) =>
          total.sumar(movimiento.monto),
        Dinero.cero("GTQ")
      );

    const pagos = movimientos.filter(
      (movimiento) =>
        movimiento.tipo === "PAGO"
    );

    const sumarConcepto = (
      seleccionar: (
        movimiento: (typeof pagos)[number]
      ) => Dinero
    ): Dinero =>
      pagos.reduce(
        (total, movimiento) =>
          total.sumar(seleccionar(movimiento)),
        Dinero.cero("GTQ")
      );

    const gastos = sumarConcepto(
      (movimiento) => movimiento.gastos
    );

    const interesMoratorio = sumarConcepto(
      (movimiento) =>
        movimiento.interesMoratorio
    );

    const interesCorriente = sumarConcepto(
      (movimiento) =>
        movimiento.interesCorriente
    );

    const capital = sumarConcepto(
      (movimiento) => movimiento.capital
    );

    const total = gastos
      .sumar(interesMoratorio)
      .sumar(interesCorriente)
      .sumar(capital);

    return {
      tipo,
      fechaCorte,
      periodoDesde,
      periodoHasta: fechaCorte,
      desembolsos: convertirDinero(desembolsos),
      recuperaciones: {
        gastos: convertirDinero(gastos),
        interesMoratorio:
          convertirDinero(interesMoratorio),
        interesCorriente:
          convertirDinero(interesCorriente),
        capital: convertirDinero(capital),
        total: convertirDinero(total)
      }
    };
  }
  async registrarPago(
    solicitud: SolicitudRegistroPagoMcp
  ): Promise<PagoRegistradoMcp> {
    validarFecha(solicitud.fechaCorte);

    if (solicitud.aprobadoPorHumano !== true) {
      throw new Error(
        "El pago requiere aprobación humana"
      );
    }

    if (solicitud.monto.moneda !== "GTQ") {
      throw new Error(
        "El adaptador solamente admite pagos en GTQ"
      );
    }

    const monto = Dinero.desde(
      solicitud.monto.monto,
      "GTQ"
    );

    const resultadoExistente =
      this.resultadosPagos.get(
        solicitud.claveIdempotencia
      );

    if (resultadoExistente) {
      this.casoRegistrarPago.ejecutar({
        idPago: resultadoExistente.idPago,
        idCredito: solicitud.idCredito,
        claveIdempotencia:
          solicitud.claveIdempotencia,
        monto
      });

      return {
        ...resultadoExistente,
        reutilizado: true
      };
    }

    const credito = this.buscarCredito(
      solicitud.idCredito
    );

    const cuota = [...credito.cuotas]
      .filter((actual) => !actual.pagada)
      .sort(
        (a, b) =>
          a.fechaVencimiento.localeCompare(
            b.fechaVencimiento
          )
      )[0];

    if (!cuota) {
      throw new Error(
        "El crédito no tiene cuotas pendientes"
      );
    }

    const deudaCalculada =
      await this.calcularDeudaCuota(
        credito.idCredito,
        cuota.numero,
        solicitud.fechaCorte
      );

    const deuda = {
      gastos: Dinero.desde(
        deudaCalculada.gastos.monto
      ),
      interesMoratorio: Dinero.desde(
        deudaCalculada.interesMoratorio.monto
      ),
      interesCorriente: Dinero.desde(
        deudaCalculada.interesCorriente.monto
      ),
      capital: Dinero.desde(
        deudaCalculada.capital.monto
      )
    };

    const aplicacion = aplicarPrelacion(
      monto,
      deuda
    );

    if (!aplicacion.excedente.esCero()) {
      throw new Error(
        "El monto del pago supera la deuda exigible"
      );
    }

    const idPago =
      `PAGO-${String(
        this.repositorioPagos.cantidad() + 1
      ).padStart(4, "0")}`;

    this.casoRegistrarPago.ejecutar({
      idPago,
      idCredito: solicitud.idCredito,
      claveIdempotencia:
        solicitud.claveIdempotencia,
      monto
    });

    credito.saldoCapital =
      credito.saldoCapital.restar(
        aplicacion.capital
      );

    const totalDeuda = deuda.gastos
      .sumar(deuda.interesMoratorio)
      .sumar(deuda.interesCorriente)
      .sumar(deuda.capital);

    if (totalDeuda.menorOIgualQue(monto)) {
      cuota.pagada = true;
    }

    const continuaEnMora =
      credito.cuotas.some(
        (actual) =>
          !actual.pagada &&
          calcularDiasAtraso(
            actual.fechaVencimiento,
            solicitud.fechaCorte
          ) > 0
      );

    if (credito.saldoCapital.esCero()) {
      credito.estado = "CANCELADO";
    } else {
      credito.estado = continuaEnMora
        ? "EN_MORA"
        : "VIGENTE";
    }

    this.datos.movimientos.push({
      tipo: "PAGO",
      fecha: solicitud.fechaCorte,
      monto,
      gastos: aplicacion.gastos,
      interesMoratorio:
        aplicacion.interesMoratorio,
      interesCorriente:
        aplicacion.interesCorriente,
      capital: aplicacion.capital
    });

    const resultado: PagoRegistradoMcp = {
      idPago,
      idCredito: solicitud.idCredito,
      fechaCorte: solicitud.fechaCorte,
      monto: convertirDinero(monto),
      claveIdempotencia:
        solicitud.claveIdempotencia,
      reutilizado: false,
      aplicacion: {
        gastos:
          convertirDinero(aplicacion.gastos),
        interesMoratorio:
          convertirDinero(
            aplicacion.interesMoratorio
          ),
        interesCorriente:
          convertirDinero(
            aplicacion.interesCorriente
          ),
        capital:
          convertirDinero(aplicacion.capital)
      },
      estadoCredito: credito.estado
    };

    this.resultadosPagos.set(
      solicitud.claveIdempotencia,
      resultado
    );

    return resultado;
  }
  private buscarCredito(
    idCredito: string
  ): CreditoMemoria {
    const credito = this.datos.creditos.find(
      (actual) =>
        actual.idCredito === idCredito
    );

    if (!credito) {
      throw new Error(
        `No existe el crédito ${idCredito}`
      );
    }

    return credito;
  }

  private obtenerDiasAtrasoCredito(
    credito: CreditoMemoria,
    fechaCorte: string
  ): number {
    const atrasos = credito.cuotas
      .filter((cuota) => !cuota.pagada)
      .map((cuota) =>
        calcularDiasAtraso(
          cuota.fechaVencimiento,
          fechaCorte
        )
      );

    return Math.max(0, ...atrasos);
  }
}

function convertirDinero(
  dinero: Dinero
): DineroMcp {
  return {
    monto: dinero.comoTexto(),
    moneda: dinero.moneda
  };
}

function validarFecha(fecha: string): void {
  const fechaInterpretada = parseISO(fecha);

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(fecha) ||
    !isValid(fechaInterpretada) ||
    format(fechaInterpretada, "yyyy-MM-dd") !==
      fecha
  ) {
    throw new Error(
      "La fecha debe utilizar el formato YYYY-MM-DD"
    );
  }
}

function crearCatalogoPoliticas():
CatalogoPoliticasMora {
  return new CatalogoPoliticasMora([
    {
      vigenteDesde: "2024-01-01",
      politica: new PoliticaPlana({
        codigo: "POL-2024-01",
        tasaNominalAnual: "0.24",
        baseConteo: 360
      })
    },
    {
      vigenteDesde: "2026-01-01",
      politica: new PoliticaEscalonada({
        codigo: "POL-2026-01",
        baseConteo: 360,
        tramos: [
          {
            nombre: "MORA_1",
            inicio: 1,
            fin: 30,
            tasaNominalAnual: "0.18"
          },
          {
            nombre: "MORA_2",
            inicio: 31,
            fin: 60,
            tasaNominalAnual: "0.24"
          },
          {
            nombre: "MORA_3",
            inicio: 61,
            fin: 90,
            tasaNominalAnual: "0.30"
          },
          {
            nombre: "VENCIDO",
            inicio: 91,
            fin: 120,
            tasaNominalAnual: "0.36"
          }
        ]
      })
    }
    
    
  ]);
}