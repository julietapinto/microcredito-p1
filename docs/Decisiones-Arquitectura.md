# E4. Decisión de arquitectura móvil/web y diseño responsivo

## E4.1 Decisión fundamentada entre nativa, híbrida o PWA

Para la solución propuesta se utilizará una **Progressive Web App (PWA)** como tecnología de acceso para las operaciones realizadas desde dispositivos móviles, manteniendo el acceso mediante navegador web para el personal de gerencia.

La elección de una PWA se fundamenta en las condiciones de uso identificadas para los dos perfiles principales del sistema: el asesor de campo y la gerencia.

Para el **asesor de campo**, el sistema debe utilizarse desde un teléfono de gama media y en condiciones donde la conexión a Internet puede ser intermitente. Una PWA permite proporcionar una interfaz optimizada para dispositivos móviles sin requerir una aplicación nativa independiente para cada plataforma. Además, permite plantear mecanismos de almacenamiento local y tolerancia a interrupciones temporales de conectividad, aspectos relevantes para las operaciones realizadas en campo.

Para la **gerencia**, el sistema estará orientado principalmente al uso desde computadoras de escritorio. En este contexto se requiere aprovechar un espacio de pantalla mayor para presentar información con mayor densidad y facilitar la consulta de indicadores, cartera y demás información administrativa. Al utilizar una aplicación web responsive, el mismo sistema puede adaptarse al entorno de escritorio sin requerir una aplicación independiente.

La decisión también mantiene coherencia con la arquitectura desarrollada en el Proyecto 1, cuyo núcleo se encuentra separado de la interfaz mediante una arquitectura hexagonal. De esta manera, la PWA funcionará como una capa de interacción con el sistema, mientras que las reglas de negocio permanecen independientes de la tecnología utilizada para presentar la información.

Por estas razones, se utilizará una **PWA con diseño responsive y enfoque mobile-first**, permitiendo que la solución pueda utilizarse tanto desde dispositivos móviles como desde computadoras de escritorio.

---

## E4.2 Estrategia responsiva mobile-first

La solución utiliza una estrategia **mobile-first** para los perfiles que utilizan dispositivos móviles y una distribución de mayor densidad para los perfiles que utilizan escritorio.

El prototipo diferencia explícitamente ambos contextos: móvil para asesor y cliente, y escritorio para comité y gerencia.

### Transformación del tablero gerencial

El tablero gerencial tiene como jerarquía principal:

1. **Cartera activa**, que representa el tamaño total administrado.
2. **Cartera en mora**, que representa el atraso general, considerando créditos con al menos un día de atraso.
3. **Cartera en riesgo**, que representa créditos con más de 30 días de atraso o reestructurados.
4. **Desglose por tramo**, que permite analizar y navegar hacia el detalle de los créditos.
5. **Incobrables del período**, presentado de manera independiente para no mezclarlo con la cartera activa o la cartera en riesgo.

La versión de escritorio aprovecha el espacio disponible para presentar esta información con mayor densidad. La versión móvil conserva la misma jerarquía, pero reorganiza los elementos verticalmente y desplaza la información secundaria a vistas de detalle cuando sea necesario.

| Elemento                     | Escritorio                                                                | Móvil                                                                                                             |
| ---------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Cartera activa               | Indicador principal visible en el tablero.                                | Tarjeta prioritaria visible en la pantalla principal.                                                             |
| Cartera en mora              | Indicador independiente: **Q174,000.00 — 21.75 %**.                       | Se mantiene como indicador independiente y visible.                                                               |
| Cartera en riesgo            | Indicador independiente: **Q56,000.00 — 7.00 %**.                         | Se mantiene como indicador independiente y visible, sin mezclarse visualmente con la cartera en mora.             |
| Desglose por tramos          | Los tramos se muestran para permitir el análisis y acceso al detalle.     | Los tramos se presentan de forma vertical y el detalle se consulta en una vista secundaria.                       |
| Detalle de cartera           | Se accede mediante *drill-down* desde el tramo seleccionado.              | Se abre una vista secundaria correspondiente al tramo seleccionado.                                               |
| Incobrables                  | Se muestran aparte como **“Dado por incobrable en el período”**.          | Se mantienen como información independiente y pueden pasar a una sección secundaria para reducir la carga visual. |
| Asistente del Proyecto Final | Se conserva el espacio reservado para el asistente conversacional futuro. | Se conserva como componente accesible dentro de la experiencia móvil, de acuerdo con la adaptación del prototipo. |

La distinción entre **cartera en mora** y **cartera en riesgo** es obligatoria para evitar interpretarlas como conceptos equivalentes. El prototipo establece que la cartera en mora corresponde a créditos con al menos un día de atraso, mientras que la cartera en riesgo corresponde a créditos con más de 30 días de atraso o reestructurados.

El tablero utiliza los valores corregidos definidos en E3:

| Indicador         |       Monto | Porcentaje |
| ----------------- | ----------: | ---------: |
| Cartera activa    | Q800,000.00 |          — |
| Cartera en mora   | Q174,000.00 |    21.75 % |
| Cartera en riesgo |  Q56,000.00 |     7.00 % |

El desglose de cartera en riesgo queda conformado por:

| Tramo          |      Monto | Porcentaje |
| -------------- | ---------: | ---------: |
| Mora 2         | Q24,000.00 |     3.00 % |
| Mora 3         | Q18,000.00 |     2.25 % |
| Vencido        |  Q8,000.00 |     1.00 % |
| Reestructurado |  Q6,000.00 |     0.75 % |

El prototipo establece además que **Mora 1 no forma parte de la cartera en riesgo**, y que los incobrables se muestran separadamente. También reserva un espacio para el asistente conversacional futuro.

En pantallas pequeñas se sacrifica principalmente la **densidad de información simultánea**, no la información funcional. Los datos secundarios pueden consultarse mediante vistas adicionales, manteniendo en la pantalla principal los indicadores prioritarios.

---

## E4.3 Estrategia ante pérdida de conexión

Debido a que el asesor puede registrar un pago en una zona sin conexión, la solución debe permitir almacenar temporalmente la operación y sincronizarla posteriormente.

El mecanismo propuesto es el siguiente:

1. El asesor registra el pago desde la pantalla **Registro de pago**.
2. Si existe conexión, la operación se envía normalmente al sistema.
3. Si no existe conexión, la operación se almacena localmente en **IndexedDB**.
4. La operación queda identificada como pendiente de sincronización y conserva todos los datos necesarios para su procesamiento posterior.
5. El **Service Worker** permite mantener el funcionamiento de la aplicación durante la pérdida de conectividad y gestionar el proceso de sincronización al recuperar la conexión.
6. Al recuperar la conexión, el sistema realiza un **reintento automático**.
7. El usuario también puede consultar las operaciones pendientes y ejecutar un **reintento manual** cuando sea necesario.

### Estados de la operación

Las operaciones de pago utilizarán los siguientes estados:

* **Pendiente:** el pago fue almacenado localmente y todavía no ha sido confirmado por el servidor.
* **Sincronizando:** el sistema está intentando enviar la operación.
* **Registrado:** el servidor confirmó correctamente el pago.
* **Error:** el intento de sincronización no pudo completarse y la operación puede volver a intentarse.

El prototipo de E3 ya contempla que el comprobante de pago muestre el **estado aplicado o pendiente de sincronización**, así como la protección contra duplicados mediante idempotencia.

### Consulta y reintento de pagos pendientes

El usuario podrá consultar las operaciones que se encuentren en estado **Pendiente** o **Error** mediante el componente de operaciones pendientes asociado al flujo de registro de pagos.

Para cada operación se deberá identificar como mínimo el crédito, monto, fecha de corte y estado. Cuando corresponda, se proporcionará una acción **Reintentar**.

El reintento no crea una nueva operación. Se vuelve a procesar la misma operación almacenada localmente.

### Conservación de la clave de idempotencia

Cada pago registrado sin conexión tendrá una **clave de idempotencia** que se conservará durante todos los intentos de sincronización.

Si un primer intento llega a procesarse en el servidor pero la respuesta no llega correctamente al dispositivo, un nuevo intento utilizará la **misma clave de idempotencia**. El servidor podrá reconocer que corresponde a la misma operación y evitar registrar nuevamente el pago.

Por lo tanto:

**Un pago pendiente conserva la misma clave de idempotencia durante todos sus reintentos.**

Esto evita que una pérdida de conexión, un error de comunicación o un reintento manual produzcan un doble registro del pago.

### Conservación de la fecha de corte

La **fecha de corte** utilizada para el cálculo de la mora también se conserva durante todos los reintentos.

Por ejemplo, si el asesor registra un pago sin conexión utilizando una fecha de corte determinada y el dispositivo recupera la conexión al día siguiente, la operación no debe cambiar automáticamente su fecha de corte por la fecha de sincronización.

Cada reintento conserva:

* la misma clave de idempotencia;
* el mismo identificador del pago;
* el mismo monto;
* la misma fecha de corte.

La fecha de corte se mantiene como un parámetro de la operación y no se sustituye por un valor implícito de “hoy”. De esta forma, la sincronización únicamente modifica el estado de la operación hasta obtener la confirmación del servidor.

El prototipo también muestra en el comprobante la **fecha de corte**, el estado de la operación y la protección anti-duplicados mediante idempotencia, manteniendo estos elementos visibles dentro del flujo de pago.
