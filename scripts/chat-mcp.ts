import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { ClienteMcpCreditoVecino } from "../src/chat/cliente-mcp.js";
import { ChatMcpCreditoVecino } from "../src/chat/chat-mcp.js";

async function main(): Promise<void> {
  const fechaCorte = process.env.FECHA_CORTE ?? new Date().toISOString().slice(0, 10);
  const mcp = new ClienteMcpCreditoVecino();
  const rl = readline.createInterface({ input: stdin, output: stdout });

  try {
    await mcp.conectar();
    const chat = new ChatMcpCreditoVecino(mcp, fechaCorte);
    console.log("\nAsistente de Crédito Vecino conectado al servidor MCP real.");
    console.log(`Fecha de corte: ${fechaCorte}`);
    console.log("Escribe 'salir' para terminar.\n");

    while (true) {
      const mensaje = await rl.question("Tú: ");
      if (mensaje.trim().toLocaleLowerCase("es-GT") === "salir") break;

      try {
        let respuesta: string;
        if (chat.tienePagoPendiente() && mensaje.trim().toLocaleUpperCase("es-GT") === "CONFIRMAR PAGO" && !process.env.MCP_APROBADOR) {
          const aprobador = await rl.question("Nombre del aprobador responsable: ");
          respuesta = await chat.confirmarPago(mensaje, aprobador);
        } else if (chat.tienePagoPendiente()) {
          respuesta = await chat.confirmarPago(mensaje);
        } else {
          respuesta = await chat.responder(mensaje);
        }
        console.log(`\nCrédito Vecino: ${respuesta}\n`);
      } catch (error) {
        console.error("\nNo se pudo completar la consulta:", error instanceof Error ? error.message : error, "\n");
      }
    }
  } finally {
    rl.close();
    await mcp.cerrar();
  }
}

main().catch(error => {
  console.error("No se pudo iniciar el chat MCP:", error);
  process.exitCode = 1;
});
