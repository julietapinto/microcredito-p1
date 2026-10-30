/**
 * Envuelve el contenido recuperado en delimitadores que el LLM
 * debe tratar como DATO, nunca como instrucción.
 */
export function wrapAsData(chunks: { documento: string; seccion: string; texto: string }[]): string {
  return chunks
    .map(c =>
      `<documento_recuperado fuente="${c.documento}" seccion="${c.seccion}">\n${c.texto}\n</documento_recuperado>`
    )
    .join('\n\n');
}

/**
 * Filtro de salida: impide filtrar DPI o teléfonos.
 * Se aplica a la respuesta final antes de mostrarla.
 */
const DPI_REGEX = /\b\d{4}\s?\d{5}\s?\d{4}\b/g;
const PHONE_REGEX = /\b[2-7]\d{3}[- ]?\d{4}\b/g;

export function redactPII(text: string): string {
  return text
    .replace(DPI_REGEX, '[DPI REDACTADO]')
    .replace(PHONE_REGEX, '[TELÉFONO REDACTADO]');
}