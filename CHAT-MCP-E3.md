# Chat conectado al servidor MCP — E3

El chat de consola utiliza el servidor MCP real mediante `Client` y `StdioClientTransport` de `@modelcontextprotocol/sdk`. No utiliza mocks.

## Configuración PowerShell

Desde la raíz del proyecto:

```powershell
$env:DATABASE_URL = "postgresql://postgres:postgres@localhost:5433/credito_vecino_test"
$env:FECHA_CORTE = "2026-10-31"
# Opcional: evita que el chat solicite el nombre después de confirmar un pago.
$env:MCP_APROBADOR = "Nombre del responsable autorizado"
npm run chat
```

El servidor hijo hereda `DATABASE_URL` y se inicia por stdio. Al conectar, el cliente verifica que estén publicadas las nueve herramientas E3.

## Consultas de demostración

- `Consulta el crédito CV-2026-0001`
- `Calcula la deuda del crédito CV-2026-0001`
- `Explícame la mora del crédito CV-2026-0001`
- `Lista los créditos en mora`
- `Muestra los próximos vencimientos de 30 días`
- `Consulta la cartera`
- `Genera el cierre mensual`

## Confirmación humana del pago

1. Escribir: `Quiero registrar un pago para CV-2026-0001`.
2. El chat consulta `calcular_deuda_cuota` y muestra el monto exigible y la fecha de corte.
3. En este punto todavía no invoca `registrar_pago`.
4. Para autorizar, escribir exactamente `CONFIRMAR PAGO`. Para detener, escribir `CANCELAR`.
5. Si no se configuró `MCP_APROBADOR`, el chat solicita el nombre del responsable.
6. Solo después de la confirmación invoca `registrar_pago` con `aprobacion_humana: true` y `credito_cobrable_confirmado: true`.

La herramienta del servidor mantiene sus propias validaciones de dominio, aprobación, cobrabilidad, idempotencia y transacción. Una confirmación del chat no omite esas validaciones.

## Alcance

Esta es una interfaz CLI funcional para demostrar la invocación MCP y la pausa de aprobación. No es una interfaz web ni incorpora un modelo LLM: enruta intenciones comunes mediante reglas explícitas. La fecha de corte debe definirse en `FECHA_CORTE` para una demostración reproducible.
