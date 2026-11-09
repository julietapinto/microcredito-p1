# E2 — Persistencia y datos canónicos (Emanuel)

## Tecnología
PostgreSQL 16 con pgvector. El dinero se almacena como enteros en centavos (`BIGINT`), las tasas en puntos básicos (`INTEGER`) y las fechas como `DATE`.

## Modelo
- `clientes`: datos del cliente; DPI único.
- `asesores`: catálogo de asesores.
- `creditos`: desembolsos y relación con cliente/asesor.
- `pagos`: pagos aplicados; clave de idempotencia única.
- `eventos`: bitácora canónica completa por secuencia, incluyendo repeticiones.
- `politicas`: políticas versionadas como JSONB.
- `fragmentos`: fragmentos RAG con embedding `VECTOR(1024)` para BGE-M3.

## Ejecución (PowerShell)
En la raíz `microcredito-p1-main`:

```powershell
npm install
docker compose up -d
$env:DATABASE_URL="postgresql://postgres:postgres@localhost:5432/credito_vecino"
$env:CV_DATA_DIR="./datos"
npm run db:migrate
npm run db:seed
npm run db:seed
```

## Paquete canónico
La huella SHA-256 se verifica sobre los bytes de `eventos.jsonl` antes de cualquier escritura. La carga se cancela si no coincide. Se validan 363 eventos: 60 clientes, 75 desembolsos y 228 pagos. Las 228 líneas de pago contienen 226 claves únicas y 2 repeticiones dentro del archivo. La tabla `eventos` conserva la bitácora original; `pagos` aplica una sola fila por clave.

La carga es transaccional y repetible. Los conflictos se resuelven mediante claves únicas y `ON CONFLICT`; los datos no se duplican al repetir el comando.

## RAG
La tabla `fragmentos` tiene dimensión 1024 e índice HNSW por coseno. E4 debe usar BGE-M3 con la misma dimensión y no mezclar modelos.

## Variables
- `DATABASE_URL`: conexión PostgreSQL.
- `CV_DATA_DIR`: ubicación del paquete canónico.
- `API_PORT`: puerto reservado para la API.

## Integración con el núcleo
El puerto actual `RepositorioPagos` y el caso de uso `RegistrarPago` son síncronos. No se deben sustituir por un adaptador PostgreSQL asíncrono sin acordar primero con E3 la evolución del puerto y actualizar las pruebas del núcleo. Esta fase no cambia las reglas financieras.
