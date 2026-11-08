import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { calcularSha256, parsearEventos } from "../src/persistencia/cargar-canonico.js";

const datos = path.resolve("datos");
describe("validación del paquete canónico", () => {
  it("coincide con la huella SHA-256 entregada", async () => {
    const bytes = await readFile(path.join(datos, "eventos.jsonl"));
    const esperado = (await readFile(path.join(datos, "eventos.sha256"), "utf8")).trim().split(/\s+/u)[0];
    expect(calcularSha256(bytes)).toBe(esperado);
  });
  it("detecta cualquier modificación del archivo", async () => {
    const original = await readFile(path.join(datos, "eventos.jsonl"));
    expect(calcularSha256(Buffer.concat([original, Buffer.from(" ")]))).not.toBe(calcularSha256(original));
  });
  it("valida 363 eventos y el orden de secuencia", async () => {
    const contenido = await readFile(path.join(datos, "eventos.jsonl"), "utf8");
    const eventos = parsearEventos(contenido);
    expect(eventos).toHaveLength(363);
    expect(eventos[0]?.seq).toBe(1);
    expect(eventos.at(-1)?.seq).toBe(363);
  });
  it("reconoce los conteos oficiales", async () => {
    const contenido = await readFile(path.join(datos, "eventos.jsonl"), "utf8");
    const eventos = parsearEventos(contenido);
    expect(eventos.filter((e) => e.tipo === "CLIENTE")).toHaveLength(60);
    expect(eventos.filter((e) => e.tipo === "DESEMBOLSO")).toHaveLength(75);
    expect(eventos.filter((e) => e.tipo === "PAGO")).toHaveLength(228);
  });
  it("detecta las claves repetidas sin eliminarlas de la bitácora", async () => {
    const contenido = await readFile(path.join(datos, "eventos.jsonl"), "utf8");
    const pagos = parsearEventos(contenido).filter((e) => e.tipo === "PAGO");
    const claves = pagos.map((e) => e.clave_idempotencia);
    expect(new Set(claves).size).toBe(226);
    expect(claves.length - new Set(claves).size).toBe(2);
  });
});
