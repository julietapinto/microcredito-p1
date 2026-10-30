import { mockMcp } from './mockMcp.js';

export interface McpClient {
  consultarCartera(fechaCorte: string): Promise<any>;
  consultarCredito(id: string, fechaCorte: string): Promise<any>;
  calcularDeuda(id: string, fechaCorte: string): Promise<any>;
  registrarPago(id: string, monto: number, tokenAprobacion: string): Promise<any>;
}

export const mcpClient: McpClient = mockMcp;