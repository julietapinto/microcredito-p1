# Códigos de error de la API

## Estructura de errores

Todos los errores siguen el formato `application/problem+json` (RFC 9457):

| Campo      | Tipo    | Descripción                               |
| ---------- | ------- | ----------------------------------------- |
| `type`     | string  | URI que identifica el tipo de problema    |
| `title`    | string  | Título breve del problema                 |
| `status`   | integer | Código de estado HTTP                     |
| `detail`   | string  | Explicación específica de esta ocurrencia |
| `instance` | string  | URI de la ocurrencia concreta             |
| `traceId`  | string  | Identificador de seguimiento              |
| `errores`  | array   | Lista de errores de validación (opcional) |

## Códigos de error por tipo

| Código HTTP | Tipo                        | Descripción                                           |
| ----------- | --------------------------- | ----------------------------------------------------- |
| 400         | `VALIDATION_ERROR`          | Error de validación en la entrada                     |
| 404         | `NOT_FOUND`                 | Recurso no encontrado                                 |
| 409         | `DUPLICATE_PAYMENT`         | Clave de idempotencia reutilizada con otro contenido  |
| 409         | `PAYMENT_ALREADY_PROCESSED` | Pago ya procesado con la misma clave                  |
| 409         | `CLIENT_ALREADY_EXISTS`     | Cliente ya existe (DPI duplicado)                     |
| 422         | `INVALID_STATE`             | El crédito no admite la operación en su estado actual |
| 422         | `DATE_OUT_OF_RANGE`         | Fecha fuera del rango permitido                       |
| 429         | `RATE_LIMIT_EXCEEDED`       | Demasiadas solicitudes en poco tiempo                 |
| 500         | `INTERNAL_SERVER_ERROR`     | Error no previsto del servidor                        |

## Ejemplos de errores

### Clave de idempotencia reutilizada (409)

```json
{
  "type": "https://api.creditovecino.gt/problemas/clave-idempotencia-reutilizada",
  "title": "Clave de idempotencia reutilizada con otro contenido",
  "status": 409,
  "detail": "La clave 5b0b9e2e... se usó antes con un monto distinto.",
  "instance": "/creditos/C-004/pagos",
  "traceId": "01J9Z4T8Q2"
}
```

### Error de validación (400)

```json
{
  "type": "https://api.creditovecino.gt/problemas/validacion",
  "title": "Error de validación",
  "status": 400,
  "detail": "El cuerpo de la petición no cumple con el contrato esperado.",
  "instance": "/clientes",
  "traceId": "01J9Z4T9K1",
  "errores": [
    {
      "campo": "monto.valor",
      "mensaje": "Debe ser decimal de punto fijo con 2 decimales"
    }
  ]
}
```

### Recurso no encontrado (404)

```json
{
  "type": "https://api.creditovecino.gt/problemas/credito-no-encontrado",
  "title": "El crédito no existe",
  "status": 404,
  "detail": "No existe ningún crédito con el identificador 'C-999'.",
  "instance": "/creditos/C-999/pagos",
  "traceId": "01J9Z4T900"
}
```

### Estado inválido (422)

```json
{
  "type": "https://api.creditovecino.gt/problemas/estado-no-admite-pago",
  "title": "El crédito no admite pagos en su estado actual",
  "status": 422,
  "detail": "El crédito 'C-010' está en estado 'solicitado': aún no fue desembolsado y no puede recibir pagos.",
  "instance": "/creditos/C-010/pagos",
  "traceId": "01J9Z4T9K1"
}
```

### Límite de solicitudes excedido (429)

```json
{
  "type": "https://api.creditovecino.gt/problemas/limite-excedido",
  "title": "Demasiadas solicitudes en poco tiempo",
  "status": 429,
  "detail": "Se superó el límite de 60 solicitudes por minuto para este cliente. Reintente tras 'Retry-After'.",
  "instance": "/creditos/C-004/pagos",
  "traceId": "01J9Z4T9X7"
}
```

### Error interno del servidor (500)

```json
{
  "type": "https://api.creditovecino.gt/problemas/error-servidor",
  "title": "Error no previsto del servidor",
  "status": 500,
  "detail": "Ocurrió un error inesperado al procesar el pago. Consulte el traceId con soporte.",
  "instance": "/creditos/C-004/pagos",
  "traceId": "01J9Z4TA02"
}
```
