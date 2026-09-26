import { Decimal } from "decimal.js";
import { Dinero } from "../dinero.js";
import {
  type PoliticaMora,
  type ResultadoPoliticaMora,
  validarCalculoMora
} from "./politica-mora.js";

export interface ConfiguracionPoliticaPlana {
  readonly codigo: string;
  readonly tasaNominalAnual: string;
  readonly baseConteo: number;
}

export class PoliticaPlana implements PoliticaMora {
  readonly codigo: string;

  private readonly tasaNominalAnual: Decimal;
  private readonly baseConteo: Decimal;

  constructor(configuracion: ConfiguracionPoliticaPlana) {
    this.codigo = configuracion.codigo;
    this.tasaNominalAnual = new Decimal(
      configuracion.tasaNominalAnual
    );
    this.baseConteo = new Decimal(
      configuracion.baseConteo
    );

    if (
      this.codigo.trim() === "" ||
      this.tasaNominalAnual.isNegative() ||
      !this.baseConteo.isPositive()
    ) {
      throw new Error(
        "La configuración de la política plana es inválida"
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

    // Después de 120 días no sigue aumentando el moratorio.
    const diasDevengados = Math.min(diasAtraso, 120);

    const tasaDiaria =
      this.tasaNominalAnual.div(this.baseConteo);

    const interesSinRedondear =
      capitalEnMora
        .comoDecimal()
        .times(tasaDiaria)
        .times(diasDevengados);

    // El interés nunca puede exceder el capital en mora.
    const interesConTope = Decimal.min(
      interesSinRedondear,
      capitalEnMora.comoDecimal()
    );

    return {
      interesMoratorio: Dinero.desde(
        interesConTope.toString(),
        capitalEnMora.moneda
      ),
      desglose:
        diasDevengados === 0
          ? []
          : [
              {
                tramo: "PLANA",
                dias: diasDevengados,
                tasaNominalAnual:
                  this.tasaNominalAnual.toString(),
                interesSinRedondear:
                  interesSinRedondear.toFixed(4)
              }
            ]
    };
  }
}