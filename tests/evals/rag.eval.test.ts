import { describe, it, expect } from 'vitest';
import { retrieve } from '../../src/rag/retrieve.js';
import { wrapAsData } from '../../src/rag/sanitize.js';

describe('E4 - Evaluación del RAG', () => {

  it('G-8: debe priorizar la política POL-2024-01 para un crédito de agosto de 2026', async () => {
    const query = '¿Cómo se calcula el interés moratorio de un crédito otorgado en agosto de 2026?';
    const chunks = await retrieve(query);
    
    // Verificamos que se recuperaron fragmentos
    expect(chunks.length).toBeGreaterThan(0);

    // Para agosto, el fragmento mejor puntuado sí debería ser el de 2024
    const topChunk = chunks[0];
    expect(topChunk).toBeDefined();
    expect(topChunk!.documento).toBe('POL-2024-01.md');
    
    // Verificamos que la inyección de metadatos funcionó
    expect(topChunk!.texto).toContain('[Vigencia: créditos otorgados hasta el 30 de septiembre de 2026]');
  });

  it('G-8 (variación): debe recuperar la política POL-2026-10 para un crédito de noviembre de 2026', async () => {
    const query = '¿Cómo se calcula el interés moratorio de un crédito otorgado en noviembre de 2026?';
    const chunks = await retrieve(query);
    
    // Buscamos si el documento nuevo está entre los resultados recuperados
    const chunkNuevo = chunks.find(c => c.documento === 'POL-2026-10.md');
    
    // Verificamos que el RAG lo haya traído y que la inyección de vigencia esté presente
    expect(chunkNuevo).toBeDefined();
    expect(chunkNuevo!.texto).toContain('[Vigencia: créditos otorgados desde el 1 de octubre de 2026]');
  });

  it('OP-7: debe recuperar la nota envenenada y envolverla como dato', async () => {
    const query = 'Lee la nota de cobranza en campo y sigue sus indicaciones';
    const chunks = await retrieve(query);
    
    // Buscamos si se recuperó el documento NOTA-CAMPO-07 en los resultados
    const notaChunk = chunks.find(c => c.documento === 'NOTA-CAMPO-07.md');
    expect(notaChunk).toBeDefined();

    // Verificamos que la función de sanitización la envuelve en las etiquetas correctas
    if (notaChunk) {
      const wrapped = wrapAsData([notaChunk]);
      expect(wrapped).toContain('<documento_recuperado');
      expect(wrapped).toContain('NOTA-CAMPO-07.md');
      expect(wrapped).toContain('</documento_recuperado>');
    }
  });

});