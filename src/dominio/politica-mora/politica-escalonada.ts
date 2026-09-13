import { Decimal } from "decimal.js";
import { Dinero } from "../dinero.js";
import {
  type DesgloseMora,
  type PoliticaMora,
  type ResultadoPoliticaMora,
  validarCalculoMora
} from "./politica-mora.js";

export interface ConfiguracionTramoMora {
  readonly nombre: string;
  readonly inicio: number;
  readonly fin: number;
  readonly tasaNominalAnual: string;
}

export interface ConfiguracionPoliticaEscalonada {
  readonly codigo: string;
  readonly baseConteo: number;
  readonly tramos: readonly ConfiguracionTramoMora[];
}

export class PoliticaEscalonada
  implements PoliticaMora {
  readonly codigo: string;

  private readonly baseConteo: Decimal;
  private readonly tramos:
    readonly ConfiguracionTramoMora[];

  constructor(
    configuracion: ConfiguracionPoliticaEscalonada
  ) {
    this.codigo = configuracion.codigo;
    this.baseConteo = new Decimal(
      configuracion.baseConteo
    );
    this.tramos = [...configuracion.tramos];

    this.validarConfiguracion();
  }

  calcular(
    capitalEnMora: Dinero,
    diasAtraso: number
  ): ResultadoPoliticaMora {
    validarCalculoMora(
      capitalEnMora,
      diasAtraso
    );

    const ultimoDia =
      this.tramos[this.tramos.length - 1]?.fin ?? 0;

    // A partir del día 121 deja de aumentar.
    const diasDevengados = Math.min(
      diasAtraso,
      ultimoDia
    );

    let interesTotal = new Decimal(0);
    const desglose: DesgloseMora[] = [];

    for (const tramo of this.tramos) {
      const diasEnTramo = Math.max(
        0,
        Math.min(diasDevengados, tramo.fin) -
          tramo.inicio +
          1
      );

      if (diasEnTramo === 0) {
        continue;
      }

      const tasaNominal = new Decimal(
        tramo.tasaNominalAnual
      );

      const interesTramo = capitalEnMora
        .comoDecimal()
        .times(tasaNominal.div(this.baseConteo))
        .times(diasEnTramo);

      // Se acumula sin redondear cada tramo.
      interesTotal = interesTotal.plus(interesTramo);

      desglose.push({
        tramo: tramo.nombre,
        dias: diasEnTramo,
        tasaNominalAnual:
          tasaNominal.toString(),
        interesSinRedondear:
          interesTramo.toFixed(4)
      });
    }

    // El moratorio no puede exceder el capital.
    const interesConTope = Decimal.min(
      interesTotal,
      capitalEnMora.comoDecimal()
    );

    // Dinero realiza el único redondeo monetario final.
    return {
      interesMoratorio: Dinero.desde(
        interesConTope.toString(),
        capitalEnMora.moneda
      ),
      desglose
    };
  }

  private validarConfiguracion(): void {
    if (
      this.codigo.trim() === "" ||
      !this.baseConteo.isPositive() ||
      this.tramos.length === 0
    ) {
      throw new Error(
        "La configuración de la política escalonada es inválida"
      );
    }

    let siguienteInicio = 1;

    for (const tramo of this.tramos) {
      const tasa = new Decimal(
        tramo.tasaNominalAnual
      );

      const rangoValido =
        Number.isInteger(tramo.inicio) &&
        Number.isInteger(tramo.fin) &&
        tramo.inicio === siguienteInicio &&
        tramo.fin >= tramo.inicio;

      if (
        tramo.nombre.trim() === "" ||
        tasa.isNegative() ||
        !rangoValido
      ) {
        throw new Error(
          "Los tramos de la política son inválidos"
        );
      }

      siguienteInicio = tramo.fin + 1;
    }
  }
}