import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Pool } from "pg";

import { registrarConsultarCredito } from "./herramientas/consultar-credito.js";
import { registrarCalcularDeudaCuota } from "./herramientas/calcular-deuda-cuota.js";
import { registrarExplicarMora } from "./herramientas/explicar-mora.js";
import { registrarListarCreditosMora } from "./herramientas/listar-creditos-mora.js";
import { registrarProximosVencimientos } from "./herramientas/proximos-vencimientos.js";
import { registrarConsultarCartera } from "./herramientas/consultar-cartera.js";
import { registrarConsultarCierre } from "./herramientas/consultar-cierre.js";
import { registrarPago } from "./herramientas/registrar-pago.js";
import { registrarConciliarPagoHistorico } from "./herramientas/conciliar-pago-historico.js";

export function crearServidorMcpPostgres(pool: Pool): McpServer {
    const servidor = new McpServer({
        name: "credito-vecino",
        version: "1.0.0"
    });

    registrarConsultarCredito(servidor, pool);
    registrarCalcularDeudaCuota(servidor, pool);
    registrarExplicarMora(servidor, pool);
    registrarListarCreditosMora(servidor, pool);
    registrarProximosVencimientos(servidor, pool);
    registrarConsultarCartera(servidor, pool);
    registrarConsultarCierre(servidor, pool);
    registrarPago(servidor, pool);
    registrarConciliarPagoHistorico(servidor, pool);

    return servidor;
}
