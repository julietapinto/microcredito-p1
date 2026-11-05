# E3 — Implementación MCP: estado técnico

## Herramientas registradas

1. `consultar_credito`
2. `calcular_deuda_cuota`
3. `explicar_mora`
4. `listar_creditos_mora`
5. `proximos_vencimientos`
6. `consultar_cartera`
7. `consultar_cierre`
8. `registrar_pago`
9. `conciliar_pago_historico` (herramienta operativa adicional para habilitar conciliación respaldada)

Todas las herramientas de consulta reciben `fecha_corte` explícita. El cierre utiliza `fecha_corte` para determinar el día o mes consultado.

## Motor de deuda

El motor usa el calendario persistido y la política asociada a la fecha de otorgamiento:

- POL-2024-01: 24 % nominal anual, Actual/360.
- POL-2026-10: 18 %, 24 %, 30 % y 36 % nominal anual por días recorridos de cada tramo, Actual/360.
- El interés moratorio se calcula sobre capital de la cuota, no sobre intereses.
- El gasto de gestión de Q25.00 se genera una sola vez al día 31 para POL-2026-10.
- A partir del día 121 el crédito se clasifica como incobrable y deja de generar mora.

El cálculo resta las aplicaciones persistidas por concepto. Los cargos y aplicaciones se conservan por cuota.

## Registro de pagos nuevos

El registro:

- exige aprobación humana, identificador del aprobador y confirmación de cobrabilidad;
- requiere que `fecha` y `fecha_corte` coincidan;
- rechaza un importe distinto del total exigible calculado;
- rechaza créditos incobrables, cancelados y con pagos canónicos pendientes de conciliación;
- guarda pago, aplicaciones por concepto y evidencia de aprobación en una sola transacción;
- aplica la prelación: gastos, moratorio, corriente y capital;
- usa la clave de idempotencia y compara crédito, monto, fecha y canal.

El cliente MCP debe mostrar al operador el importe calculado y obtener su confirmación antes de invocar `registrar_pago`. El servidor exige la aprobación como dato de entrada y conserva evidencia, pero no incluye una interfaz gráfica propia.

## Conciliación histórica

No se asignan cuotas a pagos canónicos automáticamente. `conciliar_pago_historico` requiere que un operador proporcione:

- el pago canónico;
- la cuota o cuotas respaldadas por el expediente;
- los importes en centavos por concepto;
- el aprobador;
- una referencia de comprobante.

La suma de las aplicaciones debe coincidir exactamente con el importe original del pago y la cuota debe pertenecer al crédito y haber vencido a la fecha del pago. La conciliación queda auditada. Hasta conciliar los pagos históricos de un crédito, el motor advierte y bloquea nuevos cobros exactos para ese crédito.

## Limitaciones que deben declararse en la entrega

- El calendario se genera con el manual del producto y se marca `PROYECTADO`; no se verificó contra contratos individuales firmados.
- Los pagos históricos solo pueden conciliarse con comprobantes reales. No se deben inventar sus aplicaciones.
- La confirmación visual de aprobación depende del cliente MCP; este repositorio contiene el servidor y la validación de la aprobación recibida.
- La compilación y la suite completa deben ejecutarse en el entorno del proyecto con sus dependencias instaladas y PostgreSQL con las migraciones aplicadas.
