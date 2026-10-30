import { mcpClient } from './mcpClient.js';
import { retrieve } from '../rag/retrieve.js';
import { formatCitations } from '../rag/cite.js';
import { HumanMessage, AIMessage } from '@langchain/core/messages';

export type ChatResponse = 
  | { type: 'text'; content: string }
  | { type: 'approval_required'; content: string; pagoData: any };

let lastAction: 'NONE' | 'WAITING_FOR_ID' = 'NONE';

export async function chat(userMessage: string, _history: (HumanMessage | AIMessage)[] = []): Promise<ChatResponse> {
  
  const msgLower = userMessage.toLowerCase().trim();

  // ==========================================
  // 0. SALUDOS RÁPIDOS
  // ==========================================
  if (/^(hola|buenos dias|buenos días|buenas tardes|buenas noches|quien eres|quién eres|que puedes hacer|qué puedes hacer)/i.test(msgLower)) {
    return {
      type: 'text',
      content: `Hola. Soy el Asistente Gerencial de Crédito Vecino. Puedo ayudarte a consultar la cartera, revisar el estado de un crédito, explicar políticas o registrar pagos. ¿Qué necesitas?`
    };
  }

  // ==========================================
  // 0.1. FILTRO DE SEGURIDAD Y COMANDOS PROHIBIDOS (OP-7)
  // ==========================================
  const pideDatosPersonales = msgLower.includes('dpi') || msgLower.includes('telefono') || msgLower.includes('direccion');
  const esIntentoDeInyeccion = msgLower.includes('ignora') || msgLower.includes('instrucciones') || msgLower.includes('olvida');
  
  // NUEVO: Detecta si el usuario intenta alterar datos (borrar, modificar, actualizar, insertar)
  const intentaModificarBaseDeDatos = msgLower.includes('borra') || 
                                      msgLower.includes('elimina') || 
                                      msgLower.includes('modifica') || 
                                      msgLower.includes('cambia') || 
                                      msgLower.includes('actualiza') || 
                                      msgLower.includes('inserta') ||
                                      msgLower.includes('edita');

  if (pideDatosPersonales || esIntentoDeInyeccion || intentaModificarBaseDeDatos) {
    return {
      type: 'text',
      content: `Como asistente gerencial, no tengo permitido modificar, borrar o alterar los datos del sistema, ni revelar información personal de los clientes. Si deseas realizar un cambio en un crédito, debes hacerlo a través de la interfaz de usuario correspondiente.`
    };
  }

  // ==========================================
  // 0.2. FILTRO DE DOMINIO
  // ==========================================
  const palabrasDominio = ['cartera', 'credito', 'crédito', 'mora', 'pago', 'pagar', 'saldo', 'cuota', 'interes', 'interés', 'politica', 'política', 'regla', 'calculo', 'cálculo', 'cliente', 'prestamo', 'préstamo', 'cv-'];
  const palabrasUsuario = msgLower.split(/\s+/);
  const tienePalabraDominio = palabrasUsuario.some(p => 
    palabrasDominio.some(d => p.includes(d))
  );
  const esCreditoIdSuelto = /^cv-\d{4}-\d{4}$/i.test(msgLower);

  if (!tienePalabraDominio && !esCreditoIdSuelto && lastAction !== 'WAITING_FOR_ID') {
    return {
      type: 'text',
      content: `Lo siento, solo puedo ayudarte con temas relacionados a la cartera, créditos, políticas y pagos de Crédito Vecino.`
    };
  }

  const matchCredito = userMessage.match(/CV-\d{4}-\d{4}/i);
  const creditoId = matchCredito ? matchCredito[0].toUpperCase() : null;

  // ==========================================
  // 1. RECUPERACIÓN DE CONTEXTO (Esperando ID)
  // ==========================================
  if (lastAction === 'WAITING_FOR_ID' && creditoId) {
    lastAction = 'NONE';
    const deuda = await mcpClient.calcularDeuda(creditoId, "2026-10-31");
    const montoFormateado = new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' }).format(deuda.totalExigible);
    
    return {
      type: 'approval_required',
      content: `He preparado el registro de pago para el crédito ${creditoId}.\nEl monto total exigible es ${montoFormateado}.\n\n¿Autorizas la operación? (s/n)`,
      pagoData: { ...deuda, creditoId }
    };
  }

  // ==========================================
  // 2. PAGOS
  // ==========================================
  const esPago = /(quiero|deseo|necesito|voy a|registrar|hacer|efectuar|realizar|proceder a)\s+(pagar|un pago|el pago|abonar|un abono)/i.test(msgLower) || 
                 /^(pagar|abonar)/i.test(msgLower);

  if (esPago) {
    if (!creditoId) {
      lastAction = 'WAITING_FOR_ID';
      return {
        type: 'text',
        content: `Para procesar un pago, necesito que me indiques el identificador del crédito (por ejemplo, CV-2026-0043).`
      };
    }

    const deuda = await mcpClient.calcularDeuda(creditoId, "2026-10-31");
    const montoFormateado = new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' }).format(deuda.totalExigible);
    
    return {
      type: 'approval_required',
      content: `He preparado el registro de pago para el crédito ${creditoId}.\nEl monto total exigible es ${montoFormateado}.\n\n¿Autorizas la operación? (s/n)`,
      pagoData: { ...deuda, creditoId }
    };
  }

  // ==========================================
  // 3. CIFRAS
  // ==========================================
  if (msgLower.includes('cartera')) {
    const data = await mcpClient.consultarCartera("2026-10-31");
    return {
      type: 'text',
      content: `Estado de la cartera al 31 de octubre de 2026:\n` +
               `- Cartera Activa: Q${data.carteraActiva.toFixed(2)}\n` +
               `- Cartera en Mora: Q${data.carteraMora.toFixed(2)}\n` +
               `- Incobrable del mes: Q${data.incobrableMes.toFixed(2)}\n\n` +
               `Desglose de Cartera en Riesgo:\n` +
               `- Tramo 1: Q${data.carteraRiesgo.tramo1.toFixed(2)}\n` +
               `- Tramo 2: Q${data.carteraRiesgo.tramo2.toFixed(2)}\n` +
               `- Tramo 3: Q${data.carteraRiesgo.tramo3.toFixed(2)}`
    };
  }

  if (msgLower.includes('saldo') || msgLower.includes('estado del crédito') || msgLower.includes('estado de la cuota') || (creditoId && msgLower.includes('estado'))) {
    const idABuscar = creditoId || "CV-2026-0030";
    const data = await mcpClient.consultarCredito(idABuscar, "2026-10-31");
    return {
      type: 'text',
      content: `Estado del crédito ${data.id} al ${data.fechaCorte}:\n` +
               `- Estado: ${data.estado}\n` +
               `- Saldo: Q${data.saldo.toFixed(2)}\n` +
               `- Días de atraso: ${data.diasAtraso}\n` +
               `- Tramo: ${data.tramo}\n` +
               `- Próxima cuota: ${data.proximaCuota}`
    };
  }

  // ==========================================
  // 4. RAG (Políticas)
  // ==========================================
  const chunks = await retrieve(userMessage);
  
  if (chunks.length > 0 && chunks[0]!.score > 0.45) {
    const topChunks = chunks.slice(0, 2);
    const cita = formatCitations(topChunks);
    const textoRecuperado = topChunks.map(c => c.texto).join('\n\n');

    return {
      type: 'text',
      content: `Según las políticas de Crédito Vecino:\n\n${textoRecuperado}\n\nFuente(s):\n${cita}`
    };
  }

  // ==========================================
  // 5. FALLBACK
  // ==========================================
  return {
    type: 'text',
    content: `No encontré información específica sobre esa consulta en los documentos oficiales. ¿Podrías reformular tu pregunta o ser más específico?`
  };
}