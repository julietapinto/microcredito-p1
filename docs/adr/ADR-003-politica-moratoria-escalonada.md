# ADR-003: Política moratoria escalonada

- Estado: Aceptada
- Fecha: 2026-09-24
- Proyecto: Crédito Vecino — Proyecto 2

## Contexto

El Proyecto 1 utilizaba una tasa moratoria plana del 24 % nominal anual. El Proyecto 2 requiere una política escalonada vigente para créditos otorgados a partir del 1 de octubre de 2026.

También deben coexistir créditos antiguos con política plana y créditos nuevos con política escalonada, sin modificar el motor cada vez que cambie una política.

## Decisión

Se define el puerto `PoliticaMora` con una operación común para calcular el interés moratorio.

Se implementan:

- `PoliticaPlana`: conserva el comportamiento del Proyecto 1.
- `PoliticaEscalonada`: calcula los tramos recorridos y redondea una sola vez al final.
- `PoliticaRetroactiva`: utilizada para pruebas de sustituibilidad e invariantes.
- `CatalogoPoliticas`: selecciona la política según la fecha de otorgamiento.

La política escalonada utiliza:

| Tramo | Días | TNA |
|---|---:|---:|
| Mora 1 | 1–30 | 18 % |
| Mora 2 | 31–60 | 24 % |
| Mora 3 | 61–90 | 30 % |
| Vencido | 91–120 | 36 % |

Después del día 120 el interés moratorio deja de aumentar.

## Alternativas consideradas

### Modificar `calculadora-mora.ts`

Descartada porque obligaría a modificar el motor por cada política nueva y violaría el principio abierto/cerrado.

### Utilizar condicionales por tipo de crédito

Descartada porque concentraría las variantes en un único componente y aumentaría el acoplamiento.

### Utilizar Strategy mediante `PoliticaMora`

Aceptada porque permite sustituir políticas, probarlas con el mismo contrato y mantener el cálculo desacoplado.

## Consecuencias positivas

- Coexisten políticas plana y escalonada.
- El motor anterior permanece sin cambios.
- Las políticas se prueban mediante un contrato común.
- Las tasas y los tramos quedan encapsulados.
- Se conserva el resultado histórico Q7.26.
- Se reproducen M-1 a M-5.

## Consecuencias negativas

- Se agregan más clases y configuración.
- El catálogo debe conocer las fechas de vigencia.
- Una configuración incorrecta de tramos debe rechazarse explícitamente.

## Evidencia

- `src/dominio/politica-mora/`
- `tests/politica-mora.test.ts`
- `tests/contrato-politica.test.ts`
- 89 pruebas aprobadas.
- `calculadora-mora.ts` no presenta cambios respecto de `entrega-p1`.