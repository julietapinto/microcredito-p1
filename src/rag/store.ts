import fs from 'node:fs/promises';
import path from 'node:path';
import type { EmbeddedChunk } from './types.js';

const STORE_PATH = process.env.RAG_STORE_PATH ?? 'datos/rag-store.json';

export async function saveStore(chunks: EmbeddedChunk[]): Promise<void> {
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
  await fs.writeFile(STORE_PATH, JSON.stringify(chunks), 'utf-8');
}

export async function loadStore(): Promise<EmbeddedChunk[]> {
  const raw = await fs.readFile(STORE_PATH, 'utf-8');
  return JSON.parse(raw) as EmbeddedChunk[];
}