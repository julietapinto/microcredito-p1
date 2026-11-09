import { describe, it, expect, vi, beforeEach } from 'vitest';
import { chat } from '../src/chat/orchestrator.js';
import { model } from '../src/chat/llm.js';

// Simulamos Ollama (LLM)
vi.mock('../src/chat/llm.js', () => ({
  model: {
    invoke: vi.fn().mockResolvedValue({ content: 'Respuesta simulada del LLM' })
  }
}));

// Simulamos el RAG
vi.mock('../src/rag/retrieve.js', () => ({
  retrieve: vi.fn().mockResolvedValue([
    { score: 0.9, texto: 'La mora se calcula...', documento: 'POL-2024-01' }
  ])
}));

// Simulamos la cita
vi.mock('../src/rag/cite.js', () => ({
  formatCitations: vi.fn().mockReturnValue('POL-2024-01')
}));

describe('Chat Gerencial (Orquestador)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('debe llamar al LLM con el contexto del RAG y devolver su respuesta', async () => {
    const respuesta = await chat('¿Cómo se calcula la mora?');
    
    // Verificamos que se llamó a Ollama
    expect(model.invoke).toHaveBeenCalled();
    
    // Verificamos que devuelve el texto que simulamos
    expect(respuesta).toEqual({
      type: 'text',
      content: 'Respuesta simulada del LLM'
    });
  });

  it('debe responder con texto plano si el usuario saluda', async () => {
    const respuesta = await chat('Hola, buenos días');
    
    // Los saludos no pasan por el LLM, usan reglas
    expect(model.invoke).not.toHaveBeenCalled();
    expect(respuesta).toEqual({
      type: 'text',
      content: expect.stringContaining('Hola. Soy el Asistente Gerencial')
    });
  });
});