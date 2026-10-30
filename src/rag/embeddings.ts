const OLLAMA_URL = process.env.OLLAMA_URL ?? 'http://localhost:11434';
const MODEL = process.env.EMBEDDING_MODEL ?? 'bge-m3';

export async function embedText(text: string): Promise<number[]> {
  const res = await fetch(`${OLLAMA_URL}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, prompt: text }),
  });
  if (!res.ok) throw new Error(`Ollama embeddings failed: ${res.status}`);
  const data = await res.json() as { embedding: number[] };
  return data.embedding;
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  const results: number[][] = [];
  const CONCURRENCY = 4;
  for (let i = 0; i < texts.length; i += CONCURRENCY) {
    const slice = texts.slice(i, i + CONCURRENCY);
    const batch = await Promise.all(slice.map(embedText));
    results.push(...batch);
  }
  return results;
}