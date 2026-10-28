import 'dotenv/config';
import { retrieve } from '../src/rag/retrieve.js';
import { formatCitations } from '../src/rag/cite.js';

const query = process.argv[2];
if (!query) {
  console.error('Uso: npm run rag:query "tu pregunta"');
  process.exit(1);
}

retrieve(query).then(chunks => {
  console.log(`\n Query: ${query}\n`);
  console.log(`${chunks.length} fragmentos recuperados:\n`);
  for (const c of chunks) {
    console.log(`— [${c.score.toFixed(3)}] ${c.documento} · ${c.seccion}`);
    console.log(`  ${c.texto.slice(0, 200).replace(/\s+/g, ' ')}…\n`);
  }
  console.log('Citas: ');
  console.log(formatCitations(chunks));
});