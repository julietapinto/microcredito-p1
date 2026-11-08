
import { describe, expect, it } from "vitest";
import { Dinero } from "../src/dominio/dinero.js";
import { aplicarPrelacion } from "../src/dominio/prelacion-pago.js";

describe("Aplicación de pagos parciales", () => {
    it("aplica primero gastos y después mora", () => {
        const resultado = aplicarPrelacion(
            Dinero.desde("100.00"),
            {
                gastos: Dinero.desde("25.00"),
                interesMoratorio: Dinero.desde("100.00"),
                interesCorriente: Dinero.desde("200.00"),
                capital: Dinero.desde("745.60")
            }
        );

        expect(resultado.gastos.comoTexto()).toBe("25.00");
        expect(resultado.interesMoratorio.comoTexto()).toBe("75.00");
        expect(resultado.interesCorriente.comoTexto()).toBe("0.00");
        expect(resultado.capital.comoTexto()).toBe("0.00");
        expect(resultado.excedente.comoTexto()).toBe("0.00");
    });

    it("continúa con interés corriente después de cubrir gastos y mora", () => {
        const resultado = aplicarPrelacion(
            Dinero.desde("150.00"),
            {
                gastos: Dinero.desde("25.00"),
                interesMoratorio: Dinero.desde("75.00"),
                interesCorriente: Dinero.desde("200.00"),
                capital: Dinero.desde("745.60")
            }
        );

        expect(resultado.gastos.comoTexto()).toBe("25.00");
        expect(resultado.interesMoratorio.comoTexto()).toBe("75.00");
        expect(resultado.interesCorriente.comoTexto()).toBe("50.00");
        expect(resultado.capital.comoTexto()).toBe("0.00");
        expect(resultado.excedente.comoTexto()).toBe("0.00");
    });

    it("permite cubrir toda la deuda sin excedente", () => {
        const resultado = aplicarPrelacion(
            Dinero.desde("1070.60"),
            {
                gastos: Dinero.desde("25.00"),
                interesMoratorio: Dinero.desde("100.00"),
                interesCorriente: Dinero.desde("200.00"),
                capital: Dinero.desde("745.60")
            }
        );

        expect(resultado.gastos.comoTexto()).toBe("25.00");
        expect(resultado.interesMoratorio.comoTexto()).toBe("100.00");
        expect(resultado.interesCorriente.comoTexto()).toBe("200.00");
        expect(resultado.capital.comoTexto()).toBe("745.60");
        expect(resultado.excedente.comoTexto()).toBe("0.00");
    });

    it("rechaza un pago de cero", () => {
        expect(() =>
            aplicarPrelacion(
                Dinero.desde("0.00"),
                {
                    gastos: Dinero.desde("25.00"),
                    interesMoratorio: Dinero.desde("75.00"),
                    interesCorriente: Dinero.desde("200.00"),
                    capital: Dinero.desde("745.60")
                }
            )
        ).toThrow();
    });

    it("rechaza un pago negativo", () => {
        expect(() =>
            aplicarPrelacion(
                Dinero.desde("-10.00"),
                {
                    gastos: Dinero.desde("25.00"),
                    interesMoratorio: Dinero.desde("75.00"),
                    interesCorriente: Dinero.desde("200.00"),
                    capital: Dinero.desde("745.60")
                }
            )
        ).toThrow();
    });
});
