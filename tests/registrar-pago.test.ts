import { describe, expect, it } from "vitest";
import { RegistrarPago } from "../src/aplicacion/casos-uso/registrar-pago.js";
import { Dinero } from "../src/dominio/dinero.js";
import { RepositorioPagosMemoria } from "../src/infraestructura/memoria/repositorio-pagos-memoria.js";

describe("Idempotencia del registro de pagos", () => {
  it("registra un pago correctamente", () => {
    const repositorio =
      new RepositorioPagosMemoria();

    const registrarPago =
      new RegistrarPago(repositorio);

    const resultado = registrarPago.ejecutar({
      idPago: "P-001",
      idCredito: "C-001",
      claveIdempotencia: "pago-unico-001",
      monto: Dinero.desde("500.00")
    });

    expect(resultado.idPago).toBe("P-001");
    expect(resultado.idCredito).toBe("C-001");

    expect(
      resultado.monto.comoTexto()
    ).toBe("500.00");

    expect(repositorio.cantidad()).toBe(1);
  });

  it("registrar dos veces la misma clave no duplica el pago", () => {
    const repositorio =
      new RepositorioPagosMemoria();

    const registrarPago =
      new RegistrarPago(repositorio);

    const comando = {
      idPago: "P-001",
      idCredito: "C-001",
      claveIdempotencia: "pago-unico-001",
      monto: Dinero.desde("500.00")
    };

    const primerResultado =
      registrarPago.ejecutar(comando);

    const segundoResultado =
      registrarPago.ejecutar(comando);

    expect(segundoResultado).toBe(
      primerResultado
    );

    expect(repositorio.cantidad()).toBe(1);
  });

  it("rechaza reutilizar una clave con otro monto", () => {
    const repositorio =
      new RepositorioPagosMemoria();

    const registrarPago =
      new RegistrarPago(repositorio);

    registrarPago.ejecutar({
      idPago: "P-001",
      idCredito: "C-001",
      claveIdempotencia: "misma-clave",
      monto: Dinero.desde("500.00")
    });

    expect(() =>
      registrarPago.ejecutar({
        idPago: "P-002",
        idCredito: "C-001",
        claveIdempotencia: "misma-clave",
        monto: Dinero.desde("600.00")
      })
    ).toThrow(
      "La clave de idempotencia ya fue utilizada con otros datos"
    );

    expect(repositorio.cantidad()).toBe(1);
  });

  it("rechaza pagos sin clave de idempotencia", () => {
    const repositorio =
      new RepositorioPagosMemoria();

    const registrarPago =
      new RegistrarPago(repositorio);

    expect(() =>
      registrarPago.ejecutar({
        idPago: "P-001",
        idCredito: "C-001",
        claveIdempotencia: "",
        monto: Dinero.desde("500.00")
      })
    ).toThrow(
      "La clave de idempotencia es obligatoria"
    );
  });

  it("rechaza pagos iguales o menores que cero", () => {
    const repositorio =
      new RepositorioPagosMemoria();

    const registrarPago =
      new RegistrarPago(repositorio);

    expect(() =>
      registrarPago.ejecutar({
        idPago: "P-001",
        idCredito: "C-001",
        claveIdempotencia: "clave-001",
        monto: Dinero.cero()
      })
    ).toThrow(
      "El monto del pago debe ser mayor que cero"
    );
  });
});