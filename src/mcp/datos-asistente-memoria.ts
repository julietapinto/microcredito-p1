import { Dinero } from "../dominio/dinero.js";

import type {
  NombreEstadoCredito
} from "../dominio/estados-credito.js";

export interface CuotaMemoria {
  readonly idCuota: string;
  readonly numero: number;
  readonly fechaVencimiento: string;
  readonly capital: Dinero;
  readonly interesCorriente: Dinero;
  pagada: boolean;
}

export interface CreditoMemoria {
  readonly idCredito: string;
  estado: NombreEstadoCredito;
  readonly fechaOtorgamiento: string;
  saldoCapital: Dinero;
  readonly tasaMoratoriaAnual: string;
  readonly reestructurado: boolean;
  readonly cuotas: CuotaMemoria[];
}

export interface MovimientoMemoria {
  readonly tipo: "DESEMBOLSO" | "PAGO";
  readonly fecha: string;
  readonly monto: Dinero;
  readonly gastos: Dinero;
  readonly interesMoratorio: Dinero;
  readonly interesCorriente: Dinero;
  readonly capital: Dinero;
}

export interface DatosAsistenteMemoria {
  readonly creditos: CreditoMemoria[];
  readonly movimientos: MovimientoMemoria[];
}

export function crearDatosDemostracion():
DatosAsistenteMemoria {
  const cero = Dinero.cero("GTQ");

  return {
    creditos: [
      {
        idCredito: "CV-2026-0043",
        estado: "EN_MORA",
        fechaOtorgamiento: "2026-01-15",
        saldoCapital: Dinero.desde(
          "1500.00",
          "GTQ"
        ),
        tasaMoratoriaAnual: "0.12",
        reestructurado: false,
        cuotas: [
          {
            idCuota: "CV-2026-0043-01",
            numero: 1,
            fechaVencimiento: "2026-06-15",
            capital: Dinero.desde("300.00"),
            interesCorriente:
              Dinero.desde("25.00"),
            pagada: true
          },
          {
            idCuota: "CV-2026-0043-02",
            numero: 2,
            fechaVencimiento: "2026-07-15",
            capital: Dinero.desde("300.00"),
            interesCorriente:
              Dinero.desde("25.00"),
            pagada: true
          },
          {
            idCuota: "CV-2026-0043-03",
            numero: 3,
            fechaVencimiento: "2026-08-15",
            capital: Dinero.desde("300.00"),
            interesCorriente:
              Dinero.desde("25.00"),
            pagada: true
          },
          {
            idCuota: "CV-2026-0043-04",
            numero: 4,
            fechaVencimiento: "2026-09-16",
            capital: Dinero.desde("1150.00"),
            interesCorriente:
              Dinero.desde("25.00"),
            pagada: false
          },
          {
            idCuota: "CV-2026-0043-05",
            numero: 5,
            fechaVencimiento: "2026-11-15",
            capital: Dinero.desde("350.00"),
            interesCorriente:
              Dinero.desde("20.00"),
            pagada: false
          }
        ]
      },
      {
        idCredito: "CV-2026-0044",
        estado: "VIGENTE",
        fechaOtorgamiento: "2026-08-10",
        saldoCapital: Dinero.desde(
          "1000.00",
          "GTQ"
        ),
        tasaMoratoriaAnual: "0.12",
        reestructurado: false,
        cuotas: [
          {
            idCuota: "CV-2026-0044-01",
            numero: 1,
            fechaVencimiento: "2026-11-10",
            capital: Dinero.desde("500.00"),
            interesCorriente:
              Dinero.desde("30.00"),
            pagada: false
          },
          {
            idCuota: "CV-2026-0044-02",
            numero: 2,
            fechaVencimiento: "2026-12-10",
            capital: Dinero.desde("500.00"),
            interesCorriente:
              Dinero.desde("20.00"),
            pagada: false
          }
        ]
      },
      {
        idCredito: "CV-2026-0045",
        estado: "INCOBRABLE",
        fechaOtorgamiento: "2025-12-01",
        saldoCapital: Dinero.desde(
          "800.00",
          "GTQ"
        ),
        tasaMoratoriaAnual: "0.12",
        reestructurado: false,
        cuotas: [
          {
            idCuota: "CV-2026-0045-01",
            numero: 1,
            fechaVencimiento: "2026-06-01",
            capital: Dinero.desde("800.00"),
            interesCorriente:
              Dinero.desde("40.00"),
            pagada: false
          }
        ]
      }
    ],
    movimientos: [
      {
        tipo: "DESEMBOLSO",
        fecha: "2026-10-01",
        monto: Dinero.desde("1500.00"),
        gastos: cero,
        interesMoratorio: cero,
        interesCorriente: cero,
        capital: cero
      },
      {
        tipo: "DESEMBOLSO",
        fecha: "2026-10-15",
        monto: Dinero.desde("1000.00"),
        gastos: cero,
        interesMoratorio: cero,
        interesCorriente: cero,
        capital: cero
      }
    ]
  };
}