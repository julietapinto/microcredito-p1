import { ChatOllama } from '@langchain/ollama';

export const model = new ChatOllama({
  baseUrl: process.env.OLLAMA_URL ?? 'http://localhost:11434',
  model: process.env.LLM_MODEL ?? 'qwen3:8b',
  temperature: 0,
});