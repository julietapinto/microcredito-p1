# Estrategia de RAG (Retrieval-Augmented Generation)

Este documento detalla las decisiones de diseño, arquitectura y seguridad implementadas para el entregable E4 (RAG con citación de fuentes) del Proyecto Final.

## 1. Arquitectura del Pipeline RAG

El flujo de recuperación de información se compone de las siguientes fases:
1. **Ingesta:** Lectura de los 7 documentos del corpus en formato Markdown desde la ruta definida en `CV_DATA_DIR`.
2. **Fragmentación (Chunking):** División de los documentos en fragmentos lógicos con metadatos.
3. **Vectorización (Embeddings):** Conversión de cada fragmento en un vector numérico.
4. **Almacenamiento:** Persistencia de los vectores y el texto original.
5. **Recuperación:** Búsqueda por similitud semántica basada en la consulta del usuario.
6. **Citación:** Formateo de la fuente para que el modelo de lenguaje pueda referenciarla.

## 2. Estrategia de Fragmentación (Chunking)

La fragmentación es crítica para no perder el contexto legal de las políticas y evitar que las reglas se corten a la mitad.

*   **Tamaño del fragmento:** 2400 caracteres (aproximadamente 600 tokens).
*   **Solapamiento (Overlap):** 480 caracteres (20%).
*   **Separadores jerárquicos:** El algoritmo divide primero por encabezados Markdown (`##` o `###`), luego por párrafos (`\n\n`) y, si un párrafo excede el límite, por oraciones (usando el punto como separador).
*   **Inyección de metadatos temporales:** Para resolver la ambigüedad entre políticas con texto similar pero diferente vigencia (ej. POL-2024-01 vs POL-2026-10), el algoritmo extrae la fecha de vigencia del encabezado del documento y la inyecta al inicio del texto de cada fragmento (ej. `[Vigencia: créditos otorgados hasta el 30 de septiembre de 2026]`). Esto permite que el modelo de embeddings discrimine temporalmente.

## 3. Modelo de Embeddings

*   **Modelo elegido:** `bge-m3`.
*   **Proveedor:** Ollama (ejecución local).
*   **Justificación:** 
    1. Es un modelo de código abierto con excelente rendimiento en español (superando a alternativas como `nomic-embed-text`).
    2. Su ejecución local mediante Ollama garantiza la privacidad de los datos de la empresa y elimina los costos de API.
    3. Genera vectores de 1024 dimensiones, ofreciendo un buen equilibrio entre precisión y consumo de recursos.

## 4. Recuperación y Citación

*   **Métrica de similitud:** Similitud de coseno.
*   **Top-K:** Se recuperan los 4 fragmentos con mayor puntuación.
*   **Umbral mínimo:** Se descartan fragmentos con un score menor a 0.35 para evitar alucinaciones con información irrelevante.
*   **Formato de citación:** El sistema construye una cita con el formato `[Documento · Sección · ID_del_Chunk]`. Esta cita se inyecta en el prompt del sistema para obligar al modelo de lenguaje (E5) a respaldar sus afirmaciones con la fuente exacta.

## 5. Seguridad y Tratamiento de Datos (Prevención de OP-7)

El documento `NOTA-CAMPO-07.md` contiene instrucciones maliciosas diseñadas para engañar al modelo (Prompt Injection). Para mitigar este riesgo:

1.  **Aislamiento como dato:** Todo texto recuperado por el RAG es envuelto por la función `wrapAsData()` en etiquetas XML personalizadas: `<documento_recuperado>...</documento_recuperado>`.
2.  **Instrucción al System Prompt:** El prompt del asistente (E5) indica explícitamente que el contenido dentro de esas etiquetas es información a analizar, nunca órdenes a ejecutar.
3.  **Redacción de PII:** Se implementa un filtro de salida (`redactPII()`) que utiliza expresiones regulares para censurar números de DPI y teléfonos antes de mostrar la respuesta final al usuario.

## 6. Evolución y Dependencias

*   **Almacenamiento Actual:** Actualmente, los vectores se almacenan en un archivo local (`rag-store.json`) mediante el módulo `src/rag/store.ts` para permitir el desarrollo aislado.
*   **Integración Pendiente (E2):** Cuando el Integrante 2 complete el entregable E2 (Persistencia), el archivo `store.ts` será reemplazado por las consultas a PostgreSQL utilizando la extensión `pgvector`. La interfaz de funciones (`loadStore` y `saveStore`) se mantendrá intacta para no romper el resto del código.