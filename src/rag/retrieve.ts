import { loadStore } from './store.js';
import { embedText } from './embeddings.js';
import type { RetrievedChunk, EmbeddedChunk } from './types.js';

const TOP_K = 4;
const MIN_SCORE = 0.35;

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  
  const length = Math.min(a.length, b.length);

  for (let i = 0; i < length; i++) {
    const valA = a[i]!;
    const valB = b[i]!;
    
    dot += valA * valB;
    na += valA * valA;
    nb += valB * valB;
  }

  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export async function retrieve(query: string, topK = TOP_K): Promise<RetrievedChunk[]> {
  const store: EmbeddedChunk[] = await loadStore();
  const qEmb = await embedText(query);

  const scored = store
    .map(c => ({ ...c, score: cosine(qEmb, c.embedding) }))
    .filter(c => c.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return scored.map(({ embedding, ...rest }) => rest);
}