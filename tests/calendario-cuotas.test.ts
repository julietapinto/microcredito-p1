import { describe, expect, it } from "vitest";
import { generarFechasVencimiento } from "../src/dominio/calendario-cuotas.js";

describe("generarFechasVencimiento", () => {
  it("conserva el día del otorgamiento en meses normales", () => {
    expect(generarFechasVencimiento("2026-01-15", 3)).toEqual([
      { numero: 1, fechaVencimiento: "2026-02-15" },
      { numero: 2, fechaVencimiento: "2026-03-15" },
      { numero: 3, fechaVencimiento: "2026-04-15" }
    ]);
  });

  it("limita el vencimiento al último día de febrero y recupera el día original después", () => {
    expect(generarFechasVencimiento("2026-01-31", 3)).toEqual([
      { numero: 1, fechaVencimiento: "2026-02-28" },
      { numero: 2, fechaVencimiento: "2026-03-31" },
      { numero: 3, fechaVencimiento: "2026-04-30" }
    ]);
  });

  it("respeta febrero bisiesto", () => {
    expect(generarFechasVencimiento("2028-01-31", 1)).toEqual([
      { numero: 1, fechaVencimiento: "2028-02-29" }
    ]);
  });

  it("rechaza fechas y cantidades inválidas", () => {
    expect(() => generarFechasVencimiento("2026-02-30", 2)).toThrow();
    expect(() => generarFechasVencimiento("2026-01-01", 0)).toThrow();
  });
});
