import { Decimal } from "decimal.js";
import { Dinero } from "../dinero.js";
import type {
  ConfiguracionTramoMora
} from "./politica-escalonada.js";
import {
  type PoliticaMora,
  type ResultadoPoliticaMora,
  validarCalculoMora
} from "./politica-mora.js";

export interface ConfiguracionPoliticaRetroactiva {
  readonly codigo: string;
  readonly baseConteo: number;
  readonly tramos: readonly ConfiguracionTramoMora[];
}

export class PoliticaRetroactiva
  implements PoliticaMora {
  readonly codigo: string;

  private readonly baseConteo: Decimal;
  private readonly tramos:
    readonly ConfiguracionTramoMora[];

  constructor(
    configuracion: ConfiguracionPoliticaRetroactiva
  ) {
    this.codigo = configuracion.codigo;
    this.baseConteo = new Decimal(
      configuracion.baseConteo
    );
    this.tramos = [...configuracion.tramos];

    if (
      this.codigo.trim() === "" ||
      !this.baseConteo.isPositive() ||
      this.tramos.length === 0
    ) {
      throw new Error(
        "La configuración de la política retroactiva es inválida"
      );
    }
  }

  calcular(
    capitalEnMora: Dinero,
    diasAtraso: number
  ): ResultadoPoliticaMora {
    validarCalculoMora(
      capitalEnMora,
      diasAtraso
    );

    if (diasAtraso === 0) {
      return {
        interesMoratorio: Dinero.cero(
          capitalEnMora.moneda
        ),
        desglose: []
      };
    }

    const ultimoDia =
      this.tramos[this.tramos.length - 1]?.fin ?? 0;

    const diasDevengados = Math.min(
      diasAtraso,
      ultimoDia
    );

    const tramoActual = this.tramos.find(
      (tramo) =>
        diasDevengados >= tramo.inicio &&
        diasDevengados <= tramo.fin
    );

    if (!tramoActual) {
      throw new Error(
        "No existe un tramo para los días indicados"
      );
    }

    const tasa = new Decimal(
      tramoActual.tasaNominalAnual
    );

    const interesSinRedondear =
      capitalEnMora
        .comoDecimal()
        .times(tasa.div(this.baseConteo))
        .times(diasDevengados);

    const interesConTope = Decimal.min(
      interesSinRedondear,
      capitalEnMora.comoDecimal()
    );

    return {
      interesMoratorio: Dinero.desde(
        interesConTope.toString(),
        capitalEnMora.moneda
      ),
      desglose: [
        {
          tramo: tramoActual.nombre,
          dias: diasDevengados,
          tasaNominalAnual: tasa.toString(),
          interesSinRedondear:
            interesSinRedondear.toFixed(4)
        }
      ]
    };
  }
}