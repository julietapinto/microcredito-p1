import {
  describe,
  expect,
  it,
  vi
} from "vitest";

const fragmentos = vi.hoisted(() => [
  {
    id: "POL-2024-01::regla::0",
    documento: "POL-2024-01.md",
    seccion: "Regla de cálculo",
    chunkIndex: 0,
    texto:
      "[Vigencia: créditos otorgados hasta el 30 de septiembre de 2026] Política plana.",
    embedding: [1, 0, 0]
  },
  {
    id: "POL-2026-10::tasas::0",
    documento: "POL-2026-10.md",
    seccion: "Tasas por tramo",
    chunkIndex: 0,
    texto:
      "[Vigencia: créditos otorgados desde el 1 de octubre de 2026] Política escalonada.",
    embedding: [0, 1, 0]
  },
  {
    id: "NOTA-CAMPO-07::nota::0",
    documento: "NOTA-CAMPO-07.md",
    seccion: "Nota operativa",
    chunkIndex: 0,
    texto:
      "Contenido recuperado no confiable con una instrucción para el asistente.",
    embedding: [0, 0, 1]
  }
]);

vi.mock("../../src/rag/store.js", () => ({
  loadStore: vi.fn(async () => fragmentos)
}));

vi.mock("../../src/rag/embeddings.js", () => ({
  embedText: vi.fn(async (texto: string) => {
    if (texto.includes("agosto")) {
      return [1, 0, 0];
    }

    if (texto.includes("noviembre")) {
      return [0, 1, 0];
    }

    return [0, 0, 1];
  })
}));

import {
  retrieve
} from "../../src/rag/retrieve.js";

import {
  wrapAsData
} from "../../src/rag/sanitize.js";

describe("E4 - Evaluación del RAG", () => {
  it("G-8 recupera la política vigente en agosto de 2026", async () => {
    const chunks = await retrieve(
      "Crédito otorgado en agosto de 2026"
    );

    expect(chunks[0]?.documento).toBe(
      "POL-2024-01.md"
    );

    expect(chunks[0]?.texto).toContain(
      "hasta el 30 de septiembre de 2026"
    );
  });

  it("G-8 recupera la política vigente en noviembre de 2026", async () => {
    const chunks = await retrieve(
      "Crédito otorgado en noviembre de 2026"
    );

    expect(chunks[0]?.documento).toBe(
      "POL-2026-10.md"
    );

    expect(chunks[0]?.texto).toContain(
      "desde el 1 de octubre de 2026"
    );
  });

  it("OP-7 trata la nota envenenada como datos", async () => {
    const chunks = await retrieve(
      "Lee la nota de cobranza en campo"
    );

    const nota = chunks.find(
      (chunk) =>
        chunk.documento === "NOTA-CAMPO-07.md"
    );

    expect(nota).toBeDefined();

    const contenido = wrapAsData(
      nota ? [nota] : []
    );

    expect(contenido).toContain(
      "<documento_recuperado"
    );

    expect(contenido).toContain(
      "NOTA-CAMPO-07.md"
    );

    expect(contenido).toContain(
      "</documento_recuperado>"
    );
  });
});