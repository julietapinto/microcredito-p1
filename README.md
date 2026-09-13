# Sistema de Gestión de Microcrédito

Proyecto académico del curso Análisis de Sistemas II de la Universidad Mariano Gálvez de Guatemala.

Crédito Vecino, S. A. requiere un sistema para administrar clientes, solicitudes, créditos, desembolsos, planes de amortización, pagos, mora, cierres y cartera en riesgo.

## Proyecto 1

El Proyecto 1 desarrolla la arquitectura, el diseño de componentes y el núcleo financiero del sistema.

En esta fase no se implementan:

- Interfaz gráfica.
- Servidor HTTP.
- Base de datos.
- Autenticación.
- Inteligencia artificial.
- Despliegue en producción.

## Entregables del Proyecto 1

### E1 Modelo del dominio en UML

Incluye:

- Diagrama general de casos de uso.
- Diagrama de clases del dominio.
- Diagramas de secuencia.
- Diagrama de estados del crédito.
- Diagramas de actividad.
- Matriz de trazabilidad entre requisitos, casos de uso y clases.

Los diagramas disponibles se encuentran en:

```text
UML/
Diagramas UML.pdf
```

### E2 Decisión de arquitectura

El sistema utiliza arquitectura hexagonal para separar las reglas financieras de los detalles técnicos.

La documentación contempla:

- Priorización de atributos de calidad.
- Justificación de la arquitectura seleccionada.
- Vista lógica.
- Vista de escenarios.
- Vista adicional de desarrollo o procesos.
- Modelo C4 de contexto.
- Modelo C4 de contenedores.
- Modelo C4 de componentes.
- Preparación para la futura integración del servidor MCP y el chat.

### E3 Diseño de componentes

El diseño considera:

- Módulos con responsabilidad única.
- Interfaces y puertos.
- Principios SOLID.
- Principios GRASP.
- Bajo acoplamiento.
- Alta cohesión.
- Patrón Strategy.
- Patrón State.
- Patrón Chain of Responsibility.
- Adaptadores y repositorios.

### E4 Núcleo financiero ejecutable

El núcleo está implementado en TypeScript y contiene:

- Objeto de valor `Dinero`.
- Plan de amortización francés.
- Ajuste de la última cuota.
- Cálculo de días de atraso.
- Clasificación de mora.
- Interés moratorio.
- Interés en suspenso.
- Prelación de pagos.
- Cartera en riesgo.
- Estados del crédito.
- Registro idempotente de pagos.
- Puerto `RepositorioPagos`.
- Adaptador de pagos en memoria.
- Pruebas automatizadas.

### E5 Contratos de API y ADR

La documentación incluye:

- Contrato OpenAPI.
- Esquemas derivados de Zod.
- Recursos principales del sistema.
- Convención uniforme de errores.
- Clave de idempotencia para registrar pagos.
- ADR de arquitectura hexagonal.
- ADR sobre la representación del dinero.

Los archivos principales se encuentran en:

```text
docs/api/openapi.yaml
docs/api/errores.md
docs/api/esquemas/
docs/adr/
```

### E6 Documento y repositorio

El repositorio reúne:

- Código fuente del núcleo.
- Pruebas automatizadas.
- Diagramas UML.
- Contratos de API.
- Registros de decisiones arquitectónicas.
- Documento consolidado del proyecto.
- Instrucciones de instalación, compilación y pruebas.

## Estructura del repositorio

```text
microcredito-p1/
├── docs/
│   ├── adr/
│   │   ├── ADR-001-arquitectura-hexagonal.md
│   │   └── ADR-002-representacion-del-dinero.md
│   ├── api/
│   │   ├── esquemas/
│   │   │   └── index.ts
│   │   ├── errores.md
│   │   └── openapi.yaml
│   └── E2 y E3 modificado 1.pdf
├── scripts/
│   └── generate-openapi.ts
├── src/
│   ├── aplicacion/
│   │   ├── casos-uso/
│   │   │   └── registrar-pago.ts
│   │   └── puertos/
│   │       └── repositorio-pagos.ts
│   ├── dominio/
│   │   ├── calculadora-mora.ts
│   │   ├── cartera.ts
│   │   ├── dinero.ts
│   │   ├── estados-credito.ts
│   │   ├── plan-amortizacion.ts
│   │   └── prelacion-pago.ts
│   └── infraestructura/
│       └── memoria/
│           └── repositorio-pagos-memoria.ts
├── tests/
│   ├── calculadora-mora.test.ts
│   ├── cartera.test.ts
│   ├── dinero.test.ts
│   ├── estados-credito.test.ts
│   ├── plan-amortizacion.test.ts
│   ├── prelacion-pago.test.ts
│   └── registrar-pago.test.ts
├── UML/
│   ├── Casos_de_uso.drawio.pdf
│   ├── Diagrama de Estados.drawio.pdf
│   ├── Diagramageneral.drawio.pdf
│   ├── README.md
│   └── Secuencias.drawio.pdf
├── Diagramas UML.pdf
├── package.json
├── package-lock.json
├── README.md
├── tsconfig.json
└── vitest.config.ts
```

## Descripción de las carpetas

### `src/dominio`

Contiene las reglas financieras y el comportamiento principal del crédito. No depende de servidor, base de datos ni interfaz gráfica.

### `src/aplicacion`

Contiene casos de uso y puertos utilizados para coordinar las operaciones del sistema.

### `src/infraestructura`

Contiene adaptadores técnicos. En el Proyecto 1 se utiliza un repositorio de pagos en memoria para las pruebas.

### `tests`

Contiene las pruebas automatizadas del núcleo financiero.

### `docs`

Contiene documentación de arquitectura, contratos OpenAPI, códigos de error y decisiones arquitectónicas.

### `UML`

Contiene los diagramas UML exportados del Proyecto 1.

### `scripts`

Contiene herramientas auxiliares, como la generación del contrato OpenAPI a partir de esquemas Zod.

## Requisitos

Para ejecutar el proyecto se necesita:

- Node.js 20 o superior.
- npm.
- Git.

Puede comprobarse la versión instalada con:

```bash
node --version
npm --version
git --version
```

## Instalación

Clone el repositorio:

```bash
git clone https://github.com/julietapinto/microcredito-p1.git
```

Entre en la carpeta:

```bash
cd microcredito-p1
```

Instale las dependencias:

```bash
npm install
```

## Compilación

Para verificar los tipos y la compilación:

```bash
npm run build
```

La compilación debe terminar sin errores.

## Pruebas automatizadas

Para ejecutar toda la suite:

```bash
npm test
```

Estado base de la entrega del Proyecto 1:

```text
Test Files  7 passed (7)
Tests       42 passed (42)
```

Las pruebas verifican:

- Operaciones con dinero.
- Redondeo monetario.
- Plan de amortización francés.
- Ajuste exacto de la última cuota.
- Cálculo del interés moratorio.
- Clasificación de los tramos de mora.
- Interés en suspenso.
- Prelación de pagos.
- Cartera en riesgo.
- Transiciones del crédito.
- Rechazo de transiciones inválidas.
- Idempotencia del registro de pagos.

## Ejecución de pruebas en modo observación

Durante el desarrollo pueden ejecutarse las pruebas automáticamente después de cada cambio:

```bash
npm run test:watch
```

## Generación del contrato OpenAPI

Para generar o actualizar el contrato OpenAPI desde los esquemas definidos con Zod:

```bash
npm run generate-openapi
```

El contrato generado se encuentra en:

```text
docs/api/openapi.yaml
```

## Casos financieros de referencia

El núcleo reproduce los casos obligatorios del enunciado:

- Capital inicial de Q10,000.00.
- Tasa nominal anual del 36 %.
- Plazo de 12 meses.
- Cuota mensual de Q1,004.62.
- Última cuota ajustada a Q1,004.63.
- Interés moratorio de Q7.26.
- Cartera activa de Q800,000.00.
- Cartera en riesgo de Q56,000.00.
- Indicador de cartera en riesgo de 7.00 %.
- Indicador de 6.06 % después de declarar incobrable el crédito indicado.

## Arquitectura

El sistema emplea arquitectura hexagonal.

El dominio contiene las reglas financieras y no depende de infraestructura. Los casos de uso trabajan con interfaces o puertos, mientras que los adaptadores implementan los detalles necesarios para pruebas o integraciones futuras.

Esta separación permite:

- Probar el dominio sin base de datos.
- Sustituir adaptadores sin modificar las reglas financieras.
- Mantener bajo acoplamiento.
- Incorporar posteriormente API, persistencia e interfaz.

## Principios y patrones aplicados

### SOLID

- Responsabilidad única en los componentes financieros.
- Extensión mediante nuevas estrategias.
- Sustitución de implementaciones mediante interfaces.
- Puertos pequeños y específicos.
- Dependencia de abstracciones en los casos de uso.

### GRASP

- Experto en información.
- Alta cohesión.
- Bajo acoplamiento.
- Controlador.
- Polimorfismo.

### Patrones

- Value Object para `Dinero`.
- Strategy para los cálculos financieros.
- State para el ciclo de vida del crédito.
- Chain of Responsibility para la prelación de pagos.
- Ports and Adapters para la arquitectura hexagonal.

## Restricciones del Proyecto 1

El núcleo no incluye:

- Express o Fastify.
- Base de datos u ORM.
- Interfaz gráfica.
- Autenticación.
- Chat.
- RAG.
- MCP.
- Lectura directa de la fecha del sistema.
- Uso de `any`.

Las fechas de cálculo se reciben como parámetros para que las pruebas sean reproducibles.

## Versión entregada

La versión correspondiente al Proyecto 1 está identificada con la etiqueta:

```text
entrega-p1
```

Puede consultarse con:

```bash
git tag --list
git show entrega-p1
```

## Herramientas utilizadas

- TypeScript.
- Node.js.
- Vitest.
- Decimal.js.
- Date-fns.
- Zod.
- OpenAPI.
- Swagger Editor.
- Draw.io.
- Git.
- GitHub.
- Visual Studio Code.

También se utilizaron asistentes de inteligencia artificial como apoyo para revisar documentación, comprender requisitos y generar código guiado. El contenido producido fue revisado y validado por el equipo.

## Continuidad con el Proyecto 2

El Proyecto 2 continúa sobre este mismo sistema y repositorio.

La siguiente fase agrega:

- Investigación de usuarios.
- Personas y journey map.
- Arquitectura de información.
- Wireframes.
- Prototipo navegable en Figma.
- Diseño móvil y de escritorio.
- Evaluación heurística.
- Auditoría de accesibilidad.
- Política de mora escalonada.
- Verificación de los principios SOLID.

La interfaz se diseña en Figma durante el Proyecto 2; todavía no se implementa como una aplicación real.
