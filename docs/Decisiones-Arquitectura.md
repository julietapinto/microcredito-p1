## E4. Decisión de arquitectura móvil/web y diseño responsivo

### E4.1 Decisión fundamentada entre nativa, híbrida o PWA

Para la solución propuesta se utilizará una **Progressive Web App (PWA)** como tecnología de acceso para las operaciones realizadas desde dispositivos móviles, manteniendo el acceso mediante navegador web para el personal de gerencia.

La elección de una PWA se fundamenta en las condiciones de uso identificadas para los dos perfiles principales del sistema: el asesor de campo y la gerencia.

Para el **asesor de campo**, el sistema debe utilizarse desde un teléfono de gama media y en condiciones donde la conexión a Internet puede ser intermitente. Una PWA permite proporcionar una interfaz optimizada para dispositivos móviles sin requerir una aplicación nativa independiente para cada plataforma. Además, permite plantear mecanismos de almacenamiento local y tolerancia a interrupciones temporales de conectividad, aspectos relevantes para las operaciones realizadas en campo.

Para la **gerencia**, el sistema estará orientado principalmente al uso desde computadoras de escritorio. En este contexto se requiere aprovechar un espacio de pantalla mayor para presentar información con mayor densidad y facilitar la consulta de indicadores, cartera y demás información administrativa. Al utilizar una aplicación web responsive, el mismo sistema puede adaptarse al entorno de escritorio sin requerir una aplicación independiente.

La decisión también mantiene coherencia con la arquitectura desarrollada en el Proyecto 1, cuyo núcleo se encuentra separado de la interfaz mediante una arquitectura hexagonal. De esta manera, la PWA funcionará como una capa de interacción con el sistema, mientras que las reglas de negocio permanecen independientes de la tecnología utilizada para presentar la información.

Por estas razones, se utilizará una **PWA con diseño responsive y enfoque mobile-first**, permitiendo que la solución pueda utilizarse tanto desde dispositivos móviles como desde computadoras de escritorio.

---

### E4.2 Estrategia responsiva mobile-first

El diseño de la interfaz seguirá un enfoque **mobile-first**, tomando como referencia las condiciones de trabajo del asesor de campo. La interfaz deberá priorizar la facilidad de interacción desde una pantalla pequeña, utilizando controles adecuados para interacción táctil, navegación sencilla y una cantidad limitada de información visible simultáneamente.

Para la **interfaz de gerencia en escritorio**, se aprovechará el espacio disponible para presentar una mayor cantidad de información simultáneamente. Los indicadores, tablas y demás elementos de consulta podrán distribuirse horizontalmente, permitiendo una mayor densidad de información.

En la **pantalla móvil**, el tablero deberá reorganizarse de manera que la información más importante permanezca visible y accesible, mientras que la información secundaria podrá trasladarse a vistas de detalle o componentes desplegables.

De forma general, se plantea la siguiente transformación:

| Elemento               | Escritorio                                  | Dispositivo móvil                                   |
| ---------------------- | ------------------------------------------- | --------------------------------------------------- |
| Indicadores            | Varios indicadores visibles simultáneamente | Indicadores organizados verticalmente y priorizados |
| Tablas                 | Mayor cantidad de columnas visibles         | Conversión a tarjetas, listas o vistas de detalle   |
| Navegación             | Mayor cantidad de opciones visibles         | Navegación simplificada y priorizada                |
| Información secundaria | Puede mostrarse simultáneamente             | Se traslada a vistas o secciones secundarias        |
| Gráficos               | Mayor espacio disponible para visualización | Se priorizan los gráficos principales               |
| Acciones               | Mayor cantidad de acciones visibles         | Se priorizan las acciones principales               |

En pantallas pequeñas se sacrificará principalmente la **densidad de información**, procurando mantener disponibles las funcionalidades esenciales. La información secundaria podrá consultarse mediante vistas de detalle sin ocupar espacio permanente en el tablero principal.

**[PENDIENTE]** La distribución definitiva de los componentes del tablero gerencial, así como los elementos específicos que serán ocultados, reorganizados o trasladados a vistas secundarias, se determinará durante el desarrollo del prototipo de interfaz.

---

### E4.3 Estrategia ante pérdida de conexión

Debido a que el asesor puede encontrarse en zonas con conectividad intermitente, la aplicación deberá contemplar la posibilidad de registrar un pago aun cuando temporalmente no exista conexión con el servidor.

Cuando el asesor intente registrar un pago, la aplicación verificará la disponibilidad de conexión. Si existe conexión, el pago se enviará normalmente al sistema para su procesamiento.

Si no existe conexión, el pago se almacenará temporalmente en el dispositivo como una **operación pendiente de sincronización**. La información necesaria para realizar posteriormente el registro deberá conservarse junto con la clave de idempotencia correspondiente.

Cuando el dispositivo recupere la conexión, las operaciones pendientes serán enviadas nuevamente al servidor.

Esta estrategia se relaciona directamente con la **clave de idempotencia implementada en el Proyecto 1**. El caso de uso `RegistrarPago` recibe una `claveIdempotencia` y consulta el repositorio para determinar si previamente se registró un pago con dicha clave. Si el pago ya existe, se valida que corresponda al mismo crédito y monto y se devuelve el registro existente en lugar de crear un segundo pago.

Por lo tanto, si un pago almacenado localmente se envía nuevamente debido a un reintento de sincronización, la clave de idempotencia permitirá que el sistema identifique la operación como una repetición del mismo pago y evite registrarlo nuevamente.

El flujo propuesto es:

```text
Asesor registra pago
        │
        ▼
¿Existe conexión?
   ┌────┴────┐
   │         │
  Sí        No
   │         │
   ▼         ▼
Enviar     Guardar
a API      localmente
   │        como pendiente
   │         │
   │    Recuperación de
   │       conexión
   │         │
   └────┬────┘
        ▼
Enviar pago pendiente
        │
        ▼
Validar clave de idempotencia
        │
   ┌────┴─────┐
   │          │
Existe      No existe
   │          │
   ▼          ▼
No duplicar  Registrar
el pago      el pago
```

Esta estrategia también deberá conservar la información temporal utilizada para el cálculo de mora. En el Proyecto 1, las funciones relacionadas con el cálculo de mora reciben una **fecha de corte** como parámetro, en lugar de depender directamente de la fecha actual del sistema.

Por esta razón, si el asesor registra un pago sin conexión y posteriormente recupera la conectividad, la fecha de sincronización no deberá sustituir automáticamente la fecha de corte utilizada originalmente.

Por ejemplo, si un pago fue registrado con una fecha de corte determinada y el dispositivo recupera la conexión al día siguiente, la sincronización deberá conservar la fecha de corte asociada a la operación. Esto permite mantener el cálculo financiero correspondiente al momento en que se realizó la operación, independientemente del momento en que esta sea enviada al servidor.

De esta manera, la estrategia ante pérdida de conexión se fundamenta en dos elementos existentes en el Proyecto 1:

* **Clave de idempotencia:** permite realizar reintentos de sincronización sin generar registros duplicados.
* **Fecha de corte parametrizada:** permite conservar el contexto temporal utilizado para los cálculos de mora y evitar depender automáticamente de la fecha del dispositivo.

**[PENDIENTE]** Queda por definir el mecanismo concreto de almacenamiento local, la forma en que la PWA detectará la recuperación de conexión y la interfaz mediante la cual el asesor podrá consultar el estado de las operaciones pendientes de sincronización.
