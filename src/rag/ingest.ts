import fs from 'node:fs/promises';
import path from 'node:path';
import { chunkDocument } from './chunking.js';
import { embedBatch } from './embeddings.js';
import { saveStore } from './store.js';
import type { RawDocument, EmbeddedChunk } from './types.js';

const DATA_DIR = process.env.CV_DATA_DIR;
if (!DATA_DIR) throw new Error('CV_DATA_DIR no está definida');

const CORPUS_DIR = path.join(DATA_DIR, 'corpus');

export async function ingestCorpus(): Promise<{ chunks: number; docs: number }> {
  const files = (await fs.readdir(CORPUS_DIR)).filter(f => f.endsWith('.md'));
  const docs: RawDocument[] = [];

  for (const f of files) {
    const contenido = await fs.readFile(path.join(CORPUS_DIR, f), 'utf-8');
    docs.push({ documento: f, contenido });
  }

  const allChunks = docs.flatMap(chunkDocument);
  console.log(`${docs.length} documentos → ${allChunks.length} chunks`);

  const embeddings = await embedBatch(allChunks.map(c => c.texto));

  const embedded: EmbeddedChunk[] = allChunks.map((c, i) => ({
  ...c, embedding: embeddings[i]!}));

  await saveStore(embedded);
  console.log(`Store guardado con ${embedded.length} chunks vectorizados`);
  return { chunks: embedded.length, docs: docs.length };
}