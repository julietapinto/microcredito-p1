import { serveStdio } from "@modelcontextprotocol/server/stdio";
import {
  crearServidorMcp
} from "./crear-servidor.js";

void serveStdio(() => crearServidorMcp());

console.error(
  "Servidor MCP de Crédito Vecino ejecutándose por stdio"
);