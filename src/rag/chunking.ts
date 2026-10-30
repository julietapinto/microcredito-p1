import type { RawDocument, Chunk } from './types.js';

const MAX_CHARS = 2400;      // ~600 tokens
const OVERLAP_CHARS = 480;   // 20%

function splitBySections(text: string): { seccion: string; cuerpo: string }[] {
  const lines = text.split('\n');
  const sections: { seccion: string; cuerpo: string }[] = [];
  let currentSeccion = 'Introducción';
  let buffer: string[] = [];

  for (const line of lines) {
    const headerMatch = line.match(/^#{2,3}\s+(.*)$/);
    if (headerMatch) {
      if (buffer.length) {
        sections.push({ seccion: currentSeccion, cuerpo: buffer.join('\n').trim() });
      }
      currentSeccion = headerMatch[1]?.trim() || currentSeccion;
      buffer = [];
    } else {
      buffer.push(line);
    }
  }
  
  if (buffer.length) {
    sections.push({ seccion: currentSeccion, cuerpo: buffer.join('\n').trim() });
  }
  
  return sections.filter(s => s.cuerpo.length > 0);
}

function splitByParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(p => p.length > 0);
}

function packParagraphs(paragraphs: string[]): string[] {
  const chunks: string[] = [];
  let current = '';

  for (const p of paragraphs) {
    if ((current + '\n\n' + p).length <= MAX_CHARS) {
      current = current ? current + '\n\n' + p : p;
    } else {
      if (current) chunks.push(current);
      // Solapamiento: arrastra el final del chunk anterior
      const overlap = current.slice(-OVERLAP_CHARS);
      current = overlap ? overlap + '\n\n' + p : p;

      if (current.length > MAX_CHARS) {
        const sentences = current.split(/(?<=\.)\s+/);
        let sub = '';
        for (const s of sentences) {
          if ((sub + ' ' + s).length <= MAX_CHARS) {
            sub = sub ? sub + ' ' + s : s;
          } else {
            if (sub) chunks.push(sub);
            sub = s;
          }
        }
        if (sub) current = sub;
      }
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

export function chunkDocument(doc: RawDocument): Chunk[] {
  const sections = splitBySections(doc.contenido);
  const chunks: Chunk[] = [];

  // Extraer contexto temporal del documento completo (si existe)
  // Busca líneas como "vigencia: créditos otorgados desde el 1 de octubre de 2026"
  const headerMatch = doc.contenido.match(/vigencia:\s*(.*)/i);
  const contextoVigencia = headerMatch 
    ? `[Vigencia: ${headerMatch[1]?.trim()}] ` 
    : '';

  for (const { seccion, cuerpo } of sections) {
    const paragraphs = splitByParagraphs(cuerpo);
    const packed = packParagraphs(paragraphs);

    packed.forEach((texto, i) => {
      chunks.push({
        id: `${doc.documento.replace('.md', '')}::${slug(seccion)}::${i}`,
        documento: doc.documento,
        seccion,
        chunkIndex: i,
        // Inyectamos la vigencia al principio del texto para el embedding
        texto: `${contextoVigencia}${texto}`,
      });
    });
  }
  
  return chunks;
}

function slug(s: string): string {
  return s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}