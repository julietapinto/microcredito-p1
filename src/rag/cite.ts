import type { RetrievedChunk, Citation } from './types.js';

export function toCitation(chunk: RetrievedChunk): Citation {
  return {
    documento: chunk.documento,
    seccion: chunk.seccion,
    chunkId: chunk.id,
    fragmento: chunk.texto.slice(0, 120).replace(/\s+/g, ' ') + '…',
  };
}

export function formatCitation(c: Citation): string {
  return `[${c.documento} · ${c.seccion} · ${c.chunkId}]`;
}

export function formatCitations(chunks: RetrievedChunk[]): string {
  return chunks.map(c => formatCitation(toCitation(c))).join('\n');
}