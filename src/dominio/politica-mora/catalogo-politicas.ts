import type {
  PoliticaMora
} from "./politica-mora.js";

export interface PoliticaVigente {
  readonly vigenteDesde: string;
  readonly politica: PoliticaMora;
}

export class CatalogoPoliticasMora {
  private readonly politicas:
    readonly PoliticaVigente[];

  constructor(
    politicas: readonly PoliticaVigente[]
  ) {
    if (politicas.length === 0) {
      throw new Error(
        "El catálogo debe contener al menos una política"
      );
    }

    for (const entrada of politicas) {
      validarFechaISO(entrada.vigenteDesde);
    }

    const fechas = politicas.map(
      (entrada) => entrada.vigenteDesde
    );

    if (new Set(fechas).size !== fechas.length) {
      throw new Error(
        "No puede haber dos políticas con la misma fecha de vigencia"
      );
    }

    this.politicas = [...politicas].sort(
      (a, b) =>
        a.vigenteDesde.localeCompare(
          b.vigenteDesde
        )
    );
  }

  resolver(
    fechaOtorgamiento: string
  ): PoliticaMora {
    validarFechaISO(fechaOtorgamiento);

    const aplicables = this.politicas.filter(
      (entrada) =>
        entrada.vigenteDesde <= fechaOtorgamiento
    );

    const seleccionada =
      aplicables[aplicables.length - 1];

    if (!seleccionada) {
      throw new Error(
        "No existe una política vigente para la fecha de otorgamiento"
      );
    }

    return seleccionada.politica;
  }
}

export function validarFechaISO(
  fecha: string
): void {
  const coincidencia =
    /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha);

  if (!coincidencia) {
    throw new Error(
      "La fecha debe utilizar el formato YYYY-MM-DD"
    );
  }

  const anio = Number(coincidencia[1]);
  const mes = Number(coincidencia[2]);
  const dia = Number(coincidencia[3]);

  const diasPorMes = [
    31,
    esBisiesto(anio) ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31
  ];

  const limite = diasPorMes[mes - 1];

  if (
    anio < 1 ||
    mes < 1 ||
    mes > 12 ||
    limite === undefined ||
    dia < 1 ||
    dia > limite
  ) {
    throw new Error(
      "La fecha proporcionada no es válida"
    );
  }
}

function esBisiesto(anio: number): boolean {
  return (
    anio % 400 === 0 ||
    (anio % 4 === 0 && anio % 100 !== 0)
  );
}