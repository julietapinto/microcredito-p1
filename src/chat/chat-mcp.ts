import { randomUUID } from "node:crypto";
import { ClienteMcpCreditoVecino } from "./cliente-mcp.js";

type DatosDeuda = {
  idCredito: string;
  fechaCorte: string;
  totalExigible: { exigible: string };
  incobrable: boolean;
  registroPermitido: boolean;
  pagosCanonicosSinConciliar: number;
  alcance?: string;
};

type PropuestaPago = {
  idCredito: string;
  monto: string;
  fecha: string;
  datosDeuda: DatosDeuda;
};

export class ChatMcpCreditoVecino {
  private propuesta: PropuestaPago | null = null;

  constructor(
    private readonly mcp: ClienteMcpCreditoVecino,
    private readonly fechaCorte: string
  ) {}

  tienePagoPendiente(): boolean {
    return this.propuesta !== null;
  }

  async responder(mensaje: string): Promise<string> {
    const texto = mensaje.trim();
    const normalizado = texto
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("es-GT");

    const idCredito = texto.match(/CV-\d{4}-\d{4}/i)?.[0].toUpperCase();

    if (this.propuesta) {
      return "Hay una propuesta de pago pendiente. Escribe exactamente CONFIRMAR PAGO para autorizarla o CANCELAR para descartarla.";
    }

    if (/(registrar|realizar|hacer|efectuar|procesar|quiero|necesito).{0,35}(pago|pagar|abono|abonar)|^(pagar|abonar)\b/.test(normalizado)) {
      if (!idCredito) {
        return "Indica el identificador del crédito. Ejemplo: CV-2026-0001.";
      }

      const deuda = await this.mcp.invocar<DatosDeuda>("calcular_deuda_cuota", {
        id_credito: idCredito,
        fecha_corte: this.fechaCorte
      });

      const monto = deuda.totalExigible?.exigible;

      if (!monto) {
        throw new Error("El servidor no devolvió el total exigible; no se puede proponer un pago.");
      }

      if (deuda.incobrable || !deuda.registroPermitido || deuda.pagosCanonicosSinConciliar > 0) {
        return `No puedo proponer el registro. El servidor indica que el pago no está permitido a la fecha ${this.fechaCorte}. ${deuda.alcance ?? ""}`;
      }

      this.propuesta = {
        idCredito,
        monto,
        fecha: this.fechaCorte,
        datosDeuda: deuda
      };

      return [
        `PROPUESTA DE PAGO — ${idCredito}`,
        `Monto exigible: ${monto}`,
        `Fecha de corte: ${this.fechaCorte}`,
        "",
        "El servidor todavía NO ha registrado ningún pago.",
        "Para continuar, revisa el monto y escribe exactamente CONFIRMAR PAGO.",
        "Escribe CANCELAR para detener la operación."
      ].join("\n");
    }

    if (normalizado.includes("cartera")) {
      const datos = await this.mcp.invocar("consultar_cartera", {
        fecha_corte: this.fechaCorte
      });

      return this.formatear(datos);
    }

    if (
      /(creditos|credito).{0,40}(mora|atraso)|(mora|atraso).{0,40}(creditos|credito)|listar.*mora/.test(normalizado)
    ) {
      const tramo = normalizado.includes("tramo 1")
        ? "MORA_1"
        : normalizado.includes("tramo 2")
          ? "MORA_2"
          : normalizado.includes("tramo 3")
            ? "MORA_3"
            : "TODOS";

      return this.formatear(
        await this.mcp.invocar("listar_creditos_mora", {
          fecha_corte: this.fechaCorte,
          tramo
        })
      );
    }

    if (/(proxim|venc|cuotas por vencer)/.test(normalizado)) {
      const ventana = Number(
        texto.match(/(\d+)\s*d[ií]as?/i)?.[1] ?? 30
      );

      return this.formatear(
        await this.mcp.invocar("proximos_vencimientos", {
          fecha_corte: this.fechaCorte,
          ventana_dias: Math.min(Math.max(ventana, 1), 365)
        })
      );
    }

    if (/(cierre).*(mensual|mes)|mensual.*cierre/.test(normalizado)) {
      return this.formatear(
        await this.mcp.invocar("consultar_cierre", {
          tipo_periodo: "MENSUAL",
          fecha_corte: this.fechaCorte
        })
      );
    }

    if (/(cierre).*(diario|dia)|diario.*cierre/.test(normalizado)) {
      return this.formatear(
        await this.mcp.invocar("consultar_cierre", {
          tipo_periodo: "DIARIO",
          fecha_corte: this.fechaCorte
        })
      );
    }

    if (idCredito && /(mora|atras|explica)/.test(normalizado)) {
      return this.formatear(
        await this.mcp.invocar("explicar_mora", {
          id_credito: idCredito,
          fecha_corte: this.fechaCorte
        })
      );
    }

    if (idCredito && /(deuda|debe|exigible|cuota)/.test(normalizado)) {
      const numeroCuota = Number(texto.match(/cuota\s+(\d+)/i)?.[1]);

      const argumentos: Record<string, unknown> = {
        id_credito: idCredito,
        fecha_corte: this.fechaCorte
      };

      if (Number.isInteger(numeroCuota) && numeroCuota > 0) {
        argumentos.numero_cuota = numeroCuota;
      }

      return this.formatear(
        await this.mcp.invocar("calcular_deuda_cuota", argumentos)
      );
    }

    if (idCredito) {
      return this.formatear(
        await this.mcp.invocar("consultar_credito", {
          id_credito: idCredito,
          fecha_corte: this.fechaCorte
        })
      );
    }

    return "Puedo consultar créditos, deuda de cuotas, mora, cartera, vencimientos y cierres. También puedo preparar un pago, pero siempre esperaré tu confirmación explícita antes de registrarlo. Indica un crédito como CV-2026-0001 cuando corresponda.";
  }

  async confirmarPago(
    respuesta: string,
    aprobadorIngresado?: string
  ): Promise<string> {
    if (!this.propuesta) {
      return "No hay ningún pago pendiente de confirmación.";
    }

    const decision = respuesta.trim().toLocaleUpperCase("es-GT");

    if (decision === "CANCELAR") {
      this.propuesta = null;
      return "Operación cancelada. No se registró ningún pago.";
    }

    if (decision !== "CONFIRMAR PAGO") {
      return "No se ejecutó ninguna operación. Escribe exactamente CONFIRMAR PAGO para autorizar o CANCELAR para detener.";
    }

    const aprobador = (
      aprobadorIngresado ?? process.env.MCP_APROBADOR ?? ""
    ).trim();

    if (aprobador.length < 2) {
      return "El nombre del aprobador es obligatorio. El pago sigue pendiente y no se ha registrado.";
    }

    const propuesta = this.propuesta;

    const resultado = await this.mcp.invocar("registrar_pago", {
      id_credito: propuesta.idCredito,
      monto: propuesta.monto.replace(/^Q\s?/, ""),
      clave_idempotencia: `CHAT-${randomUUID()}`,
      fecha: propuesta.fecha,
      fecha_corte: propuesta.fecha,
      canal: "CHAT_MCP",
      aprobacion_humana: true,
      aprobador,
      credito_cobrable_confirmado: true
    });

    this.propuesta = null;

    return `El servidor MCP aceptó la solicitud de registro.\n${this.formatear(resultado)}`;
  }

  private formatear(valor: unknown): string {
    const texto = JSON.stringify(
      valor,
      (_clave, dato: unknown) => {
        if (typeof dato === "bigint") {
          return dato.toString();
        }

        if (typeof dato === "object" && dato !== null && !Array.isArray(dato)) {
          const objeto = dato as Record<string, unknown>;

          return Object.fromEntries(
            Object.entries(objeto).map(([clave, contenido]) => {
              if (["dpi", "telefono", "nombre_cliente"].includes(clave)) {
                return [clave, "[DATO RESERVADO]"];
              }

              return [clave, contenido];
            })
          );
        }

        return dato;
      },
      2
    );

    return texto ?? String(valor);
  }
}
