# Interfaz E1

Instalación: `cd web`, `npm ci`, `npm run dev`. Verificación: `npm run build` y `npm run lint`. Configure `VITE_API_URL` con la URL base de la API; por defecto se utiliza `http://localhost:3000/api`.

La interfaz consume los recursos documentados en `docs/api/openapi.yaml`. El repositorio describe un núcleo financiero y un contrato, pero no incluye un servidor HTTP; se requiere implementación del backend y CORS para probar la integración completa. El navegador debe permitir `Content-Type` e `Idempotency-Key` en las solicitudes.

El pago requiere revisión y confirmación. La clave y el cuerpo de un intento se conservan en `sessionStorage` para reintentar sin generar otra clave durante la misma sesión de la pestaña. La garantía de idempotencia depende del servidor. Si una respuesta es incierta, consultar el historial antes de iniciar otra operación. Los rechazos 404 y 422 permiten editar. Un resultado incierto permanece pendiente para evitar duplicados; la recuperación tras cerrar la pestaña depende de almacenamiento persistente y de una consulta inequívoca por clave del lado del servidor.

Pendientes: pruebas de integración con servicios, accesibilidad y teléfono; paginación del historial; recuperación persistente de operaciones inciertas. El detalle de mora por períodos e importes y las recuperaciones de cierre por concepto no están definidos en el contrato actual. El chat es visual y requiere el módulo del integrante responsable. No se generan cifras financieras de ejemplo.
