import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

function extraerTexto(contenido: unknown): string {
  if (!Array.isArray(contenido)) return "";
  return contenido
    .filter((item: unknown): item is { type: string; text: string } =>
      typeof item === "object" && item !== null &&
      "type" in item && item.type === "text" &&
      "text" in item && typeof item.text === "string"
    )
    .map(item => item.text)
    .join("\n");
}

export class ClienteMcpCreditoVecino {
  private readonly cliente = new Client({
    name: "credito-vecino-chat",
    version: "1.0.0"
  });

  private transporte: StdioClientTransport | null = null;

  async conectar(): Promise<void> {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error("Defina DATABASE_URL antes de iniciar el chat.");
    }

    const entorno = Object.fromEntries(
      Object.entries(process.env).filter(
        (entrada): entrada is [string, string] => typeof entrada[1] === "string"
      )
    );

    this.transporte = new StdioClientTransport({
      command: process.execPath,
      args: ["--import", "tsx", "src/mcp/servidor.ts"],
      cwd: process.cwd(),
      env: entorno,
      stderr: "inherit"
    });

    await this.cliente.connect(this.transporte);
    const herramientas = await this.cliente.listTools();
    const requeridas = [
      "consultar_credito", "calcular_deuda_cuota", "explicar_mora",
      "listar_creditos_mora", "proximos_vencimientos", "consultar_cartera",
      "consultar_cierre", "registrar_pago", "conciliar_pago_historico"
    ];
    const disponibles = new Set(herramientas.tools.map(herramienta => herramienta.name));
    const faltantes = requeridas.filter(nombre => !disponibles.has(nombre));
    if (faltantes.length > 0) {
      throw new Error(`El servidor MCP no publicó todas las herramientas E3. Faltan: ${faltantes.join(", ")}`);
    }
    console.log(`MCP conectado: ${requeridas.length} herramientas E3 disponibles.`);
  }

  async invocar<T = unknown>(nombre: string, argumentos: Record<string, unknown>): Promise<T> {
    const resultado = await this.cliente.callTool({ name: nombre, arguments: argumentos });
    if (resultado.isError) {
      const detalle = extraerTexto(resultado.content);
      throw new Error(detalle || `La herramienta ${nombre} devolvió un error.`);
    }

    if (resultado.structuredContent !== undefined) {
      return resultado.structuredContent as T;
    }

    const texto = extraerTexto(resultado.content);

    try {
      return JSON.parse(texto) as T;
    } catch {
      return texto as T;
    }
  }

  async cerrar(): Promise<void> {
    await this.cliente.close();
    this.transporte = null;
  }
}
