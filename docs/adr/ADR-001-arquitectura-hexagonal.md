# ADR-001: Estilo arquitectonico y organizacion modular

**Estado**: Aceptada
**Fecha**: 28/08/2026

## Contexto

El Sistema de Gestion de Microcredito debe evolucionar desde un nucleo de calculo en TypeScript (Proyecto 1) hasta un sistema completo con interfaz web (Proyecto 2) y asistente conversacional con RAG + servidor MCP (Proyecto Final).

**Requisitos que afectan esta decision:**
- Regla de incrementalidad (seccion 1): "El sistema que usted disene aqui es el mismo que continuara en el Proyecto 2 y en el Proyecto Final"
- Atributos de calidad priorizados:
  - Testabilidad: El nucleo debe ser probable sin base de datos ni red
  - Mantenibilidad: Debe permitir agregar nuevos adaptadores (API REST, MCP, chat)
  - Evolutividad: Debe soportar la transicion del proyecto sin reescrituras
- Restriccion: No se admiten microservicios sin justificacion solida (seccion 7.1)
- Stack tecnologico: TypeScript + Node.js

## Decision

**Se decide adoptar una Arquitectura Hexagonal (Puertos y Adaptadores) con un monolito modular.**

### Justificacion

1. **Aislamiento del nucleo de dominio**: Las reglas de negocio (calculo de cuotas, mora, prelacion, cartera en riesgo) viven en el nucleo, independientes de la infraestructura. Esto permite probar el calculo con funciones puras, sin base de datos ni red (atributo de testabilidad).

2. **Evolucion incremental hacia el Proyecto Final**: 
   - Hoy (P1): El nucleo se prueba con npm test.
   - P2: Se anade un adaptador primario (Express/Fastify) que expone la API REST.
   - Final: Se anaden adaptadores primarios para el servidor MCP y el chat.
   - Sin reescribir el nucleo: La misma logica de negocio sirve a todos los adaptadores.

3. **Una sola fuente de verdad**: La API REST, el asistente conversacional y el servidor MCP ejecutan el mismo caso de uso. Si el calculo viviera en el controlador REST, el asistente tendria que duplicarlo, y dos implementaciones del mismo calculo divergen siempre (seccion 7.1).

4. **Puerto Reloj (Clock)**: En lugar de leer new Date() directamente, el nucleo recibe la fecha como parametro. Esto permite:
   - Pruebas con fechas fijas (no fallan manana)
   - Simular escenarios de mora con fechas controladas
   - Cumplir con la seccion 6.5 (dias calendario)

5. **Monolito modular vs. Microservicios**:
   - Los microservicios son inapropiados para este dominio (seccion 7.1): repartir un desembolso y su asiento contable entre servicios convierte una transaccion local en un problema de consistencia distribuida.
   - Se opta por un monolito modular con modulos de frontera explicita: Originacion, Calculo Financiero, Cartera y Cobros, Cierres.
   - Si mas adelante un modulo necesita escalar aparte, la frontera ya existe.

### Modulos definidos (Contextos delimitados)

| Modulo | Responsabilidad | No le corresponde |
|--------|-----------------|-------------------|
| Originacion | Cliente, solicitud, evaluacion, aprobacion, desembolso | Calcular mora o cierres |
| Calculo Financiero | Plan de amortizacion, interes, mora, redondeo (funciones puras) | Persistir o consultar datos |
| Cartera y Cobros | Registro de pagos, prelacion, saldos, clasificacion por tramos | Definir la politica de tasas |
| Cierres | Cierre diario/mensual, cartera en riesgo, provisiones | Modificar creditos |
| Contratos / API | Exposicion de casos de uso al exterior | Contener reglas de negocio |

### Alternativas consideradas y motivo de descarte

| Alternativa | Motivo de descarte |
|-------------|-------------------|
| Arquitectura en capas (3 capas) | No aisla el nucleo de la infraestructura. Las pruebas requieren base de datos, violando la testabilidad. |
| Microservicios | Violacion explicita de la seccion 7.1 ("proponerlos sin justificacion se penaliza"). Introduce complejidad innecesaria y consistencia distribuida. |
| Arquitectura limpia (Clean Architecture) | Es muy similar a la hexagonal, pero la hexagonal es mas explicita sobre los puertos y adaptadores, facilitando su comprension. |
| MVC tradicional | Acopla la logica de negocio con los controladores, dificultando las pruebas y la evolucion hacia MCP/RAG. |

## Consecuencias

### Positivas
- El nucleo se prueba con funciones puras, sin infraestructura (seccion 4, E4).
- La misma logica de negocio sirve para API REST, MCP y chat (Una sola fuente de verdad).
- La evolucion del proyecto es incremental: P1 (nucleo) -> P2 (API) -> Final (MCP + chat).
- Los modulos tienen responsabilidad unica y fronteras claras.
- El puerto Reloj permite pruebas deterministas de mora y cierres.

### Negativas (Trade-offs)
- Mayor complejidad inicial vs. un script monolitico simple (necesario por la evolucion del proyecto).
- Requiere disciplina para mantener separados el nucleo y los adaptadores.
- El equipo debe entender el patron de inyeccion de dependencias.

### Compromisos asumidos
- El nucleo (src/dominio/) no importa nada de infraestructura (ni express, ni pg, ni fs).
- Los adaptadores se anadiran en fases posteriores (P2, Final).
- La fecha de corte siempre se recibe como parametro (nunca new Date() en el nucleo).