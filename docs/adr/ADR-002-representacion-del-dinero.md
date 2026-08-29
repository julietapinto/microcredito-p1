# ADR-002: Representacion del dinero

**Estado**: Aceptada
**Fecha**: 28/08/2026

## Contexto

El Sistema de Gestion de Microcredito debe manejar importes monetarios con exactitud absoluta. Un error de redondeo de un centavo en el calculo de intereses o cuotas se propaga a traves de todo el sistema y genera descuadres contables, incumplimiento regulatorio y perdida de confianza.

**Requisitos que afectan esta decision:**
- Seccion 6.2 del enunciado: "todo importe monetario se representa como entero en la unidad minima (centavos de quetzal) o mediante una biblioteca decimal"
- Invariante 6.10: "La suma de las amortizaciones de un plan es exactamente igual al capital desembolsado"
- Atributo de calidad priorizado: Exactitud (el sistema debe producir los numeros correctos, verificables contra ejemplos de referencia)

**Restricciones:**
- Stack tecnologico: TypeScript sobre Node.js (seccion 8)
- El nucleo debe ser ejecutable y probable sin infraestructura

## Decision

**Se decide implementar los importes monetarios como un Value Object Dinero usando la biblioteca decimal.js.**

### Justificacion

1. **Exactitud matematica**: decimal.js usa aritmetica decimal de precision arbitraria, evitando los errores de redondeo inherentes al punto flotante binario (IEEE 754) de Number.

2. **Inmutabilidad**: Siguiendo el patron Value Object, Dinero es inmutable. Operaciones como sumar() devuelven un nuevo objeto, nunca mutan el original. Esto previene efectos secundarios no deseados.

3. **Encapsulamiento de la unidad monetaria**: El objeto incluye el atributo moneda (ej: "GTQ", "USD") y prohibe operaciones entre monedas distintas, evitando errores conceptuales.

4. **Redondeo controlado**: El redondeo se aplica explicitamente en cada operacion (medio hacia arriba, 2 decimales), siguiendo la regla 6.2 y el caso de referencia 6.4.1.

5. **Verificable**: Las pruebas unitarias pueden verificar invariantes como sumatoria de amortizaciones igual a capital y saldo final igual a 0.00 sin errores de precision.

### Alternativas consideradas y motivo de descarte

| Alternativa | Motivo de descarte |
|-------------|-------------------|
| Number (punto flotante) | Violacion directa de la seccion 6.2. Penalizacion de -0.5 puntos. Ademas, los errores de redondeo hacen imposible cumplir los invariantes 6.10. |
| Enteros en centavos | Es valido (se menciona en 6.2), pero requiere manejar manualmente la division, multiplicacion y redondeo. decimal.js reduce el riesgo de errores de implementacion. |
| big.js | Es una alternativa valida, pero decimal.js tiene mejor soporte para redondeo y mayor adopcion en el ecosistema Node.js. |
| dinero.js | Especializado en dinero, pero anade dependencias adicionales y complejidad. decimal.js es mas liviano y suficiente para el alcance del proyecto. |

## Consecuencias

### Positivas
- El calculo financiero es exacto y reproducible, permitiendo verificar los casos de referencia del enunciado (6.4.1, 6.5, 6.8.1).
- Las pruebas unitarias pueden verificar invariantes sin tolerancias (ej: saldo final exactamente igual a 0.00).
- El tipo Dinero en TypeScript previene errores de tipo (ej: sumar Dinero con Number).
- Cumple con la regla no negociable del enunciado (seccion 6.2).
- La inmutabilidad facilita el razonamiento sobre el codigo y previene bugs.

### Negativas (Trade-offs)
- Mayor complejidad de implementacion que usar Number (aunque esto es necesario por el dominio).
- Dependencia externa (decimal.js) que debe ser instalada y mantenida.
- Ligera penalizacion en rendimiento vs. numeros nativos (insignificante para el volumen esperado).

### Compromisos asumidos
- El sistema usara consistentemente Dinero en todo el dominio, nunca Number para importes monetarios.
- El redondeo se aplicara en cada cuota individualmente (no al final), siguiendo la regla 6.2.
- La moneda por defecto sera "GTQ" (Quetzal guatemalteco).