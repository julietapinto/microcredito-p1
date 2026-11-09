import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

import { mockMcp } from './mockMcp.js';

export interface McpClient {
  consultarCartera(fechaCorte: string): Promise<any>;
  consultarCredito(id: string, fechaCorte: string): Promise<any>;
  calcularDeuda(id: string, fechaCorte: string): Promise<any>;
  registrarPago(id: string, monto: number, tokenAprobacion: string): Promise<any>;
}

export class RealMcpClient implements McpClient {
  private client: Client;
  private transport: StdioClientTransport;
  private isConnected = false;

  constructor() {
    this.client = new Client({ name: 'chat-gerencial', version: '1.0.0' }, { capabilities: {} });
    this.transport = new StdioClientTransport({
      command: 'npx',
      args: ['tsx', 'src/mcp/servidor.ts'], // Levanta tu servidor MCP real
      env: Object.fromEntries(
        Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined)
      )
    });
  }

  private async connect() {
    if (!this.isConnected) {
      await this.client.connect(this.transport);
      this.isConnected = true;
    }
  }

  async consultarCartera(fechaCorte: string): Promise<any> {
    await this.connect();
    const res = await this.client.callTool({ name: 'consultar_cartera', arguments: { fechaCorte } });
    const raw = this.parseResponse(res);
    
    // Adaptamos los datos del servidor real al formato del orquestador
    return {
      fechaCorte: raw.fechaCorte,
      carteraActiva: parseFloat(raw.carteraActiva.monto),
      carteraMora: parseFloat(raw.carteraEnMora.monto),
      carteraRiesgo: {
        tramo1: parseFloat(raw.desglosePorTramo.find((t: any) => t.tramo === 'MORA_1')?.capital.monto || '0'),
        tramo2: parseFloat(raw.desglosePorTramo.find((t: any) => t.tramo === 'MORA_2')?.capital.monto || '0'),
        tramo3: parseFloat(raw.desglosePorTramo.find((t: any) => t.tramo === 'MORA_3')?.capital.monto || '0'),
      },
      incobrableMes: parseFloat(raw.incobrableDelPeriodo.monto)
    };
  }

  async consultarCredito(id: string, fechaCorte: string): Promise<any> {
    await this.connect();
    const res = await this.client.callTool({ name: 'consultar_credito', arguments: { idCredito: id, fechaCorte } });
    const raw = this.parseResponse(res);
    
    return {
      id: raw.idCredito,
      fechaCorte: fechaCorte,
      estado: raw.estado,
      saldo: parseFloat(raw.saldo.monto),
      diasAtraso: raw.diasAtraso,
      tramo: raw.tramo,
      cuotasPagadas: raw.cuotasPagadas,
      cuotasVencidas: raw.cuotasVencidas,
      proximaCuota: raw.proximaCuota ? raw.proximaCuota.fechaVencimiento : 'Ninguna'
    };
  }

  async calcularDeuda(id: string, fechaCorte: string): Promise<any> {
    await this.connect();
    // Primero consultamos el crédito para saber cuál es la cuota a calcular
    const resCredito = await this.client.callTool({ name: 'consultar_credito', arguments: { idCredito: id, fechaCorte } });
    const creditoData = this.parseResponse(resCredito);
    const numeroCuota = creditoData.proximaCuota ? creditoData.proximaCuota.numero : 1;

    const res = await this.client.callTool({ 
      name: 'calcular_deuda_cuota', 
      arguments: { idCredito: id, numeroCuota, fechaCorte } 
    });
    const raw = this.parseResponse(res);

    return {
      id,
      fechaCorte,
      totalExigible: parseFloat(raw.totalExigible.monto),
      desglose: {
        gastos: parseFloat(raw.gastos.monto),
        moratorio: parseFloat(raw.interesMoratorio.monto),
        interesCorriente: parseFloat(raw.interesCorriente.monto),
        capital: parseFloat(raw.capital.monto)
      }
    };
  }

  async registrarPago(id: string, monto: number, tokenAprobacion: string): Promise<any> {
    await this.connect();
    const res = await this.client.callTool({
      name: 'registrar_pago',
      arguments: {
        idCredito: id,
        monto: monto.toFixed(2),
        moneda: 'GTQ',
        fechaCorte: new Date().toISOString().split('T')[0],
        claveIdempotencia: tokenAprobacion,
        aprobacionHumana: true
      }
    });
    return this.parseResponse(res);
  }

  private parseResponse(res: any) {
    if (res.isError) throw new Error(res.content[0].text);
    return JSON.parse(res.content[0].text);
  }
}

// Usamos el mock solo en las pruebas para que no levanten el servidor real
const useMock = process.env.NODE_ENV === 'test';
export const mcpClient: McpClient = useMock ? mockMcp : new RealMcpClient();