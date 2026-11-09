import 'dotenv/config';
import { ingestCorpus } from '../src/rag/ingest.js';

ingestCorpus().catch(err => {
  console.error('Fallo: ', err);
  process.exit(1);
});