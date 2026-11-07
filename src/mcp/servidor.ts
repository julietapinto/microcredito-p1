import {
  serveStdio
} from "@modelcontextprotocol/server/stdio";

import {
  AdaptadorAsistenteMemoria
} from "./adaptador-asistente-memoria.js";

import {
  crearDatosDemostracion
} from "./datos-asistente-memoria.js";

import {
  crearServidorMcp
} from "./crear-servidor.js";

const adaptador =
  new AdaptadorAsistenteMemoria(
    crearDatosDemostracion()
  );

void serveStdio(
  () => crearServidorMcp(adaptador)
);

console.error(
  "Servidor MCP de Crédito Vecino ejecutándose por stdio"
);