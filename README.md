# Sistema de Gestión de Microcrédito — Crédito Vecino, S. A.

Proyecto 1 del curso Análisis de Sistemas II.

## Integrantes

- Integrante 1: Análisis del dominio y UML.
- Integrante 2: Arquitectura y diseño de componentes.
- Integrante 3: Núcleo financiero, pruebas y coordinación.
- Integrante 4: OpenAPI, ADR, documentación e integración.

# Sistema de Gestión de Microcrédito — SGMC

## Objetivo

Diseñar e implementar el núcleo financiero de un sistema de microcréditos utilizando UML, arquitectura hexagonal, patrones de diseño, OpenAPI y pruebas automatizadas.

## Alcance

El proyecto contempla:

* Clientes y solicitudes de crédito.
* Aprobación, rechazo y desembolso.
* Plan de amortización francés.
* Registro e idempotencia de pagos.
* Mora e interés moratorio.
* Estados del crédito.
* Cartera en riesgo.
* Cierres diarios y mensuales.
* Contrato OpenAPI y manejo de errores.

La implementación actual se concentra en el núcleo financiero. La API HTTP, base de datos, autenticación e interfaz gráfica quedan fuera del alcance de esta etapa.

## Tecnologías

* Node.js 20 o superior.
* TypeScript.
* Decimal.js.
* Vitest.
* Zod.
* OpenAPI 3.0.3.
* Git y GitHub.

## Arquitectura

Se utiliza arquitectura hexagonal para mantener las reglas del dominio separadas de la infraestructura:

```text
Adaptadores → Casos de uso → Dominio
```

```text
src/
├── dominio/
├── aplicacion/
│   ├── casos-uso/
│   └── puertos/
└── infraestructura/
    └── memoria/
```

## Funcionalidades implementadas

* Objeto de valor `Dinero`.
* Plan de amortización francés.
* Ajuste de la última cuota.
* Cálculo de mora.
* Interés moratorio.
* Interés en suspenso.
* Prelación de pagos.
* Cartera en riesgo.
* Estados del crédito mediante State.
* Registro idempotente de pagos.
* Puerto `RepositorioPagos`.
* Adaptador de pagos en memoria.

## Reglas principales

### Tramos de mora

|       Días | Tramo        |
| ---------: | ------------ |
|          0 | `SIN_MORA`   |
|       1–30 | `MORA_1`     |
|      31–60 | `MORA_2`     |
|      61–90 | `MORA_3`     |
|     91–120 | `VENCIDO`    |
| Más de 120 | `INCOBRABLE` |

### Prelación de pagos

```text
Gastos → Interés moratorio → Interés corriente → Capital
```

### Cartera en riesgo

Se consideran en riesgo los créditos con más de 30 días de atraso y los créditos reestructurados. Los créditos incobrables se excluyen de la cartera activa.

## Contrato OpenAPI

El contrato documenta operaciones de:

* Clientes.
* Solicitudes.
* Créditos.
* Pagos.
* Cierres.
* Cartera en riesgo.

Archivo principal:

```text
docs/api/openapi.yaml
```

Los errores se documentan en:

```text
docs/api/errores.md
```

Las decisiones arquitectónicas se encuentran en:

```text
docs/adr/
```

## Instalación

```powershell
git clone https://github.com/julietapinto/microcredito-p1.git
cd microcredito-p1
npm ci
```

## Compilación

```powershell
npm run build
```

## Pruebas

```powershell
npm test
```

Resultado comprobado del núcleo financiero:

```text
7 archivos de prueba aprobados
42 pruebas aprobadas
0 pruebas fallidas
```

## Patrones aplicados

| Patrón                  | Aplicación                     |
| ----------------------- | ------------------------------ |
| Value Object            | `Dinero`                       |
| State                   | Estados del crédito            |
| Chain of Responsibility | Prelación de pagos             |
| Repository              | Repositorio de pagos           |
| Ports and Adapters      | Separación de infraestructura  |
| Idempotencia            | Prevención de pagos duplicados |

## Entregables

* E1: modelado UML.
* E2: diseño arquitectónico.
* E3: puertos, adaptadores y patrones.
* E4: implementación y pruebas.
* E5: OpenAPI, errores y ADR.
* E6: integración y documentación final.

## Estado actual

El repositorio cuenta con núcleo financiero, pruebas automatizadas, documentación arquitectónica, contrato OpenAPI y esquemas Zod.

La implementación completa de HTTP, persistencia, autenticación e interfaz gráfica queda prevista para una etapa posterior.

