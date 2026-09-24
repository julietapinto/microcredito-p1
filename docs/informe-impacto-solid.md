# Informe de impacto SOLID — Proyecto 2

## Comparación utilizada

El análisis compara el estado etiquetado como `entrega-p1` con la rama `feature/e6-politica-mora`.

Comandos utilizados:

```bash
git diff --name-status entrega-p1..HEAD -- src/dominio
git diff --stat entrega-p1..HEAD -- src/dominio
git diff --name-status entrega-p1..HEAD -- tests
git diff entrega-p1..HEAD -- src/dominio/calculadora-mora.ts
npm run build
npm test