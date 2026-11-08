import 'dotenv/config';
import readline from 'node:readline/promises';
import { chat } from '../src/chat/orchestrator.js';
import { HumanMessage, AIMessage } from '@langchain/core/messages';

async function main() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  console.log("Asistente Gerencial iniciado. Escribe 'salir' para terminar.\n");

  const history: (HumanMessage | AIMessage)[] = [];
  let pendingApproval: any = null;

  while (true) {
    const userMsg = await rl.question("Hazme una pregunta: ");
    if (userMsg.toLowerCase() === 'salir') break;

    // --- BLOQUE DE APROBACIÓN HUMANA ---
    if (pendingApproval) {
      const respuesta = userMsg.toLowerCase().trim();
      
            if (respuesta === 's' || respuesta === 'si' || respuesta === 'sí') {
        console.log("\n[EJECUTANDO] Conectando con el MCP para registrar el pago...");
        
        // Usamos el ID del crédito que viene en los datos de la aprobación
        const creditoId = pendingApproval.creditoId; 
        
        const resultado = await import('../src/chat/mcpClient.js').then(m => 
          m.mcpClient.registrarPago(creditoId, pendingApproval.totalExigible, "TOKEN-123")
        );
        
        console.log(`\n[EXITO] ${resultado.mensaje}\n`);
        
        history.push(new HumanMessage(userMsg));
        history.push(new AIMessage(`Pago registrado exitosamente para el crédito ${creditoId}.`));
      }
      
      pendingApproval = null;
      continue; // Volvemos al inicio del bucle
    }

    // --- FLUJO NORMAL DEL CHAT ---
    console.log("Pensando...");
    try {
      const result = await chat(userMsg, history);
      
      if (result.type === 'approval_required') {
        console.log(`\nASISTENTE:\n${result.content}\n`);
        pendingApproval = result.pagoData; // Guardamos los datos para esperar el 's/n'
        history.push(new HumanMessage(userMsg));
        history.push(new AIMessage(result.content));
      } else {
        console.log(`\nASISTENTE:\n${result.content}\n`);
        history.push(new HumanMessage(userMsg));
        history.push(new AIMessage(result.content));
      }
    } catch (error) {
      console.error("Error:", error);
    }
  }
  rl.close();
}

main();