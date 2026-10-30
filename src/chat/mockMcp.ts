export const mockMcp = {
  async consultarCartera(fechaCorte: string) {
    return {
      fechaCorte,
      carteraActiva: 250000.00,
      carteraMora: 45000.00,
      carteraRiesgo: { 
        tramo1: 10000.00, 
        tramo2: 20000.00, 
        tramo3: 15000.00 
      },
      incobrableMes: 5000.00,
    };
  },

  async consultarCredito(id: string, fechaCorte: string) {
    return {
      id,
      fechaCorte,
      estado: "Activo",
      saldo: 15000.50,
      diasAtraso: 45,
      tramo: "Mora 2",
      cuotasPagadas: 3,
      cuotasVencidas: 2,
      proximaCuota: "2026-11-15"
    };
  },

  async calcularDeuda(id: string, fechaCorte: string) {
    // Valores de ejemplo basados en el documento POL-COBRO-01
    return {
      id,
      fechaCorte,
      totalExigible: 1047.76,
      desglose: {
        gastos: 25.00,
        moratorio: 18.14,
        interesCorriente: 278.86,
        capital: 725.76
      }
    };
  },

  async registrarPago(id: string, monto: number, tokenAprobacion: string) {
    return {
      id,
      estado: "Pagado",
      montoAplicado: monto,
      tokenUtilizado: tokenAprobacion,
      mensaje: "Pago registrado exitosamente en el núcleo."
    };
  }
};
