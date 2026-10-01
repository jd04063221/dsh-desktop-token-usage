# Registro de cambios

[English](https://github.com/jd04063221/dsh-desktop-token-usage/blob/main/CHANGELOG.md) | [中文](https://github.com/jd04063221/dsh-desktop-token-usage/blob/main/CHANGELOG-zh.md) | [繁體中文（臺灣）](https://github.com/jd04063221/dsh-desktop-token-usage/blob/main/CHANGELOG-zh-TW.md) | [繁體中文（香港）](https://github.com/jd04063221/dsh-desktop-token-usage/blob/main/CHANGELOG-zh-HK.md) | [Deutsch](https://github.com/jd04063221/dsh-desktop-token-usage/blob/main/CHANGELOG-de.md) | [Français](https://github.com/jd04063221/dsh-desktop-token-usage/blob/main/CHANGELOG-fr.md) | Español | [Italiano](https://github.com/jd04063221/dsh-desktop-token-usage/blob/main/CHANGELOG-it.md) | [日本語](https://github.com/jd04063221/dsh-desktop-token-usage/blob/main/CHANGELOG-ja.md) | [한국어](https://github.com/jd04063221/dsh-desktop-token-usage/blob/main/CHANGELOG-ko.md)

Este archivo documenta todos los cambios notables de `dsh-desktop-token-usage`.
El formato se basa en [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), y los números de versión siguen [Versionado Semántico](https://semver.org/).

> **Nota de actualización**: Este plugin es un bundle de DSH que se carga en dos mitades. `client.js` (la UI) lo recarga en caliente el navegador,
> mientras que `index.js` / `lib/*` (el Host) **cachea la generación del módulo JS que ya ha importado** dentro del proceso de DSH —reactivar
> el plugin no basta, tampoco cambiar el especificador, reinstalar o incluso renombrar el paquete (Node cachea ESM por la realpath):
> hay que reiniciar DSH una vez para que se cargue el código nuevo. Para saber qué generación está en ejecución, compruebe si `Config.listConfigs`
> informa `schema` o `absent` para este plugin, junto con si el proceso se ha reiniciado desde su cambio; `boot.json`
> se reescribe con cada `apply`, así que su existencia solo le dice cuándo se montó por última vez el fiber.

## [Unreleased]

### Añadido

- **Localización (i18n)**: el panel ahora sigue **la propia configuración de idioma de DSH** —no tiene su selector propio, y
  cambiar el idioma en DSH cambia el panel al instante, sin recargar. Aquí se incluyen diez idiomas: `en` y `zh` a través de los
  diccionarios integrados de DSH, más los paquetes `zh-TW` (臺灣正體), `zh-HK` (香港繁體), `de`, `fr`, `es`, `it`, `ja` y `ko` que
  este plugin registra en el catálogo de DSH. Los números, porcentajes, fechas, nombres de días de la semana y de meses, y las
  formas plurales provienen de `Intl`, de modo que los separadores de miles, `萬`/`億` donde el inglés escribe `K`/`M`/`B`, y las
  propias categorías plurales de cada idioma salen bien. Los textos viven en `locales/<id>.json` y se generan en el bundle del
  cliente mediante [`scripts/build-dicts.mjs`](scripts/build-dicts.mjs): el bloque generado nunca debe editarse a mano, y una
  prueba falla mientras esté desactualizado. `README-<id>.md` y `CHANGELOG-<id>.md` contienen ambos documentos en cada idioma
  incluido. Nota: seleccionar un paquete de idioma deja **la propia interfaz de DSH** en `zh`/`en` —solo cambia este plugin.

### Corregido

- **La ventana de ayuda de la tendencia se lee como la del mapa de calor**: su título ya no pega la fecha al total de Tokens —la
  fecha queda sola y el total es una fila `Tokens` por sí misma (forma compacta)—, de modo que una línea es una cifra.
- **Nada se parte ya dentro de una ventana de ayuda**: la caja sigue su contenido (`width:max-content`) y cuelga de la columna
  bajo el cursor —anclada a la izquierda en la mitad izquierda, anclada a la derecha en la derecha— en lugar de centrarse dentro
  de una caja limitada, y un nombre de modelo largo como `deepseek-v4.1-flash` se corta con puntos suspensivos en una sola línea
  en lugar de empujarse a una segunda.

### Planificado

- **Localización, el nivel restante**: los seis códigos de idioma `pt-BR`, `ru`, `vi`, `th`, `id` y `ar` están diseñados pero aún
  no implementados. `ar` además necesita el shell de derecha a izquierda —insets reflejados, ventanas de ayuda y lados de los
  ejes, con el eje temporal de izquierda a derecha—, que ninguno de los diez idiomas incluidos requiere. Consulte
  [el diseño](docs/superpowers/specs/2026-10-01-i18n-design.md).

## [0.1.5] - 2026-10-01

### Añadido

- **Una opción de agrupación**: por modelo real (los modelos con el mismo nombre se fusionan entre proveedores), por proveedor de
  API, o ambas. Con «ambas», la sección de tendencia y la sección de desglose llevan cada una su propio chip, conmutable de
  forma independiente.
- **Una opción de paleta**: primer (el predeterminado de GitHub), cvd (Okabe-Ito, apto para daltónicos) o muted (baja
  saturación), cada una con un conjunto claro y otro oscuro de variables que sigue automáticamente el tema del sistema.

### Cambiado

- **La curva de tasa de aciertos se superpone a las barras**: las barras apiladas de Tokens y la curva de tasa de aciertos de
  caché comparten un solo gráfico (la curva se mapea sobre el área de trazado por el rango min−10% span ~ max+10% span del
  periodo, con porcentajes reales etiquetados a la derecha), en lugar de ocupar una franja propia.
- **El eje Y de la curva de tasa de aciertos se basa en los datos**: el mínimo/máximo del periodo fija el rango con un 10% del
  span de relleno en cada extremo; la curva conserva la interpolación cúbica monótona.
- **Semántica de la tasa de aciertos**: el fallo ahora incluye cacheWrite (hit / (hit + miss)), coincidiendo con la definición
  oficial; en esta máquina cacheWrite es siempre 0, así que ningún número cambia.

### Corregido

- **Las paletas de los gráficos siguen el propio interruptor de tema de DSH**, no el del sistema operativo: DSH marca el modo
  oscuro con `body[data-ds-dark-theme]` y deja `<body>` sin marcar en modo claro, de modo que las paletas leen ahora ese
  marcador (a través de `light-dark()` + `color-scheme`) en lugar de `prefers-color-scheme`. Un shell oscuro sobre un escritorio
  claro solía dejar todos los gráficos claros —y un shell claro sobre un escritorio oscuro hacía lo contrario.
- **Un modelo, una fila**: los proveedores no coinciden en los ids de modelo —`commandcode` informa
  `deepseek/deepseek-v4.1-flash` donde `opencode-go` informa `deepseek-v4.1-flash`, y la vista por modelo listaba ese único
  modelo dos veces. La clave por modelo es ahora el segmento final del id; la vista por proveedor aún distingue a los dos.
- **El mapa de calor de actividad llena su fila**: las 53 semanas fijadas ya no se detienen a mitad de la tarjeta. Las 53
  columnas comparten ahora el ancho disponible sobre una única base de 11px (las celdas se mantienen cuadradas, y el eje de mes
  y las bandas de día de la semana se estiran con ellas); solo una tarjeta demasiado estrecha para una celda de 11px recurre al
  desplazamiento, y ese desplazamiento se abre en la semana más reciente en lugar de en las más antiguas (vacías en esta
  máquina). Las esquinas se redondean un 24% de la celda en lugar de 2px fijos, un cambio de paleta o de métrica se funde
  durante 0.18s, pasar el cursor sobre un día lo aclara mediante `filter: brightness()` (sin desplazamiento de diseño, sin
  reflow), y `prefers-reduced-motion` desactiva las transiciones.
- **Tres correcciones de legibilidad en el mapa de calor**: un día sin actividad conserva un filete de 1px del paso 0 en lugar
  de un bloque sólido (una vez que el calendario abarca la tarjeta, un muro de gris sólido se lee como datos); hoy se marca con
  un anillo interior de dos tonos (color del panel por fuera, color de la etiqueta por dentro) que sigue visible tanto en el
  paso más pálido como en el más oscuro; y pasar el cursor sobre un día eleva ahora la propia ventana de ayuda del panel —la
  misma caja que muestra el gráfico de tendencia, limitada al trazado por una fracción del centro de la columna, y dispuesta en
  cuatro líneas: fecha / Tokens / turnos / solicitudes, con la cifra de Tokens en la misma forma compacta que usan las tarjetas
  de estadísticas y la ventana de ayuda de la tendencia (`1.45亿` en lugar de `145,156,311`, de modo que ninguna cifra de Tokens
  puede ensanchar la caja)— en lugar del nativo `title` retrasado y no estilizable. Todo el calendario está **centrado con 15px a
  cada lado**, y sus 53 columnas comparten el ancho restante, de modo que **ya no se desplaza nada** —la caja con
  desplazamiento desapareció. La barra inferior era siempre la caja de cursor: una vez que una cifra de Tokens se alarga, es más
  ancha que los 160px de ancho mínimo para los que se limitaba, así que en las columnas de los bordes sobresalía de la caja de
  desplazamiento, y un píxel bastaba. La caja se inclina ahora lejos del borde al que se acerca —una columna de la mitad
  izquierda se alinea a la izquierda y crece hacia la derecha, una columna de la mitad derecha se alinea a la derecha y crece
  hacia la izquierda— con `max-width:calc(50% - 25px)` garantizando que media extensión de la columna puede contener la caja
  entera. Nunca cruza el calendario con ningún ancho, y no necesita medir su propio ancho para garantizarlo.
- **El pie del panel se lee como un hecho por línea.** Tres elementos flex de longitudes muy distintas se partían en un párrafo
  desigual, y la nota larga se rompía a media frase dentro de un término «…»; ahora todo término entre comillas es
  ininterrumpible.

## [0.1.4] - 2026-09-30

### Cambiado

- **La tarjeta de la barra lateral obtiene ahora una línea de ancho completo propia en el asiento del pie.**
  `sidebar.footer.action` es una única fila horizontal (`display: flex`) y en una instalación de fábrica `dsh-opencode-go-usage`,
  la insignia de Cordis y `commandcode-panel` también se sientan en ella —y cada uno de ellos declara `width: 100%`, de modo que
  ninguno puede compartirla. Medido en una ventana viva de 0.2.0-rc.2, sin nada intermedio la tarjeta de este plugin se comprime
  a **105.2px** mientras su vecina ocupa 150.8px, y los tres juegos de etiquetas se solapan. La tarjeta convierte ahora el
  **asiento en una columna** (`[class*="_footerActions"]:has(.dtu-footCard)`), de modo que cada ocupante obtiene la línea de
  ancho completo para la que fue escrita: la tarjeta ocupa los **256px** completos. Coincidir con el sufijo de clase más `:has()`
  la mantiene independiente de los nombres de clase con hash de DSH y la mantiene lejos de cada ancestro —forzar una dirección en
  los contenedores de fila propios del shell apilaría la barra lateral encima del panel principal. Es `flex-direction` y no
  `flex-wrap` por dos razones: el shell envuelve cada slot en un elemento `display: contents`, de modo que un selector de hijo
  directo nunca coincide con el asiento; y en un asiento en **columna** `flex-wrap` significa «empezar otra columna» —medido,
  eso pone la tarjeta junto a su vecina y ensancha la barra lateral hasta 387.8px, desbordándola. Eso necesita `:has()`, y por
  eso la tabla de compatibilidad de abajo ahora registra el Chromium incluido.
- **Las mismas ventanas se muestran también en el panel**, en una fila `Ventanas configuradas`: etiqueta, total, división
  entrada/salida, tasa de aciertos de caché y turnos. Son recencia según el reloj —el Host las construye solo a partir de
  `{root, useCache, now}`— e ignoran deliberadamente el filtro de origen, de modo que esa fila lo dice en lugar de estar entre
  las tarjetas de estadísticas que siguen al filtro. Con ambas ventanas desactivadas vuelve a una única tarjeta acumulativa.
- **La tendencia por día ya no pone dos escalas en un mismo trazado.** La tasa de aciertos de caché era una línea dibujada
  sobre las barras de Tokens con su propio eje derecho de 0-100%; como normalmente se sitúa por encima del 90%, la línea
  flotaba por la parte superior del trazado sin relación visible con las barras de debajo. La tasa de aciertos ya se da por
  ventana en las tarjetas de estadísticas y en la fila `Ventanas configuradas`, así que esa curva desaparece: el gráfico
  superpone ahora el **total diario de Tokens** sobre las barras, compartiendo el único eje izquierdo de Tokens, con sus
  vértices cayendo en la parte superior de cada columna apilada de modo que la composición y la tendencia se lean juntas. Los
  días sin uso hunden la línea hasta la línea base, lo que hace más clara la forma de vacío y pico. La entrada de la tasa de
  aciertos de la leyenda pasó a ser `Total diario`.
- **La curva fluye en lugar de hacer esquinas.** Los días vecinos se unen con una interpolación **cúbica monótona**
  (Fritsch-Carlson), de modo que la tangente es continua en cada punto de datos. Monótona en lugar de una spline sencilla a
  propósito: una spline sencilla se desborda entre los puntos, y justo al lado de un día sin uso eso significa hundirse por
  debajo del eje.
- **Las escrituras son atómicas, acotadas y se pueden desactivar.** Ambos escritores escriben ahora un hermano
  `<name>.<pid>.tmp` y lo renombran sobre el destino, de modo que un lector concurrente nunca ve un archivo parcial y un proceso
  terminado no puede dejar uno truncado. El índice de sesiones está limitado a 800 entradas (las más antiguas se descartan y se
  vuelven a escanear bajo demanda), y cualquier `.tmp` que deje un fallo se elimina en la siguiente escritura. Los diagnósticos
  del Host (`calls.json`, `boot.json`) se pueden desactivar por completo con `DSH_TOKEN_USAGE_DIAG=0`. Todo se escribe dentro de
  `$DSH_HOME/cache/dsh-desktop-token-usage/`; el README documenta ahora cada archivo, para qué sirve y cómo desactivarlo.
- **Se declara la compatibilidad con DSH Desktop 0.2.0-rc.1.** El plugin sigue sin declarar ninguna dependencia peer
  `@deepseek-ai/dsh*`, que es lo que DSH realmente valida; `engines.dsh` se amplía a `^0.1.7-rc.2 || ^0.2.0-rc.1` solo para los
  lectores. Cada paquete publicado al que toca este plugin se comparó por diff entre las dos publicaciones: `dsh-plugin-manager`
  es idéntico byte a byte, y `dsh-client-ui-sidebar`, `dsh-client-ui-layout` y `dsh-client-ui-cordis` difieren solo en la cadena
  de versión, una llamada de analíticas y el CSS de la barra de título. El contrato del slot no cambia.

### Nota

- Tras la publicación se realizó una prueba manual en DSH Desktop `0.2.0-rc.2` con el plugin `0.1.3`: el panel y las llamadas
  Remote funcionan.
- La entrada se movió brevemente a `sidebar.panellist`, que da una fila de ancho completo de la que la barra lateral es
  propietaria —pero ese asiento solo renderiza un icono y una etiqueta, de modo que los números de uso que la tarjeta existe
  para mostrar no habrían tenido dónde ir. Volvió.

## [0.1.3] - 2026-09-28

### Cambiado

- **CI publica ahora mediante Trusted Publishing (OIDC); el repositorio ya no almacena un token de npm.** El flujo de trabajo
  elimina `NODE_AUTH_TOKEN`, añade `id-token: write` y actualiza npm en el runner (Node 22 incluye un npm anterior al 11.5.1 que
  requiere la publicación de confianza). Las attestations de procedencia se generan automáticamente, y el secreto del
  repositorio `NPM_TOKEN` ya no se referencia.

## [0.1.2] - 2026-09-28

### Cambiado

- **El nombre del paquete perdió su scope**: `@jd04063221/dsh-desktop-token-usage` → `dsh-desktop-token-usage`. Las versiones
  0.1.0 y 0.1.1 eran paquetes con scope; el nombre con scope está obsoleto y ahora apunta aquí. Un nombre sin scope no necesita
  un scope de npm coincidente, de modo que el comando de instalación es más corto y publicar ya no depende de poseer uno.
  Actualizado en paso: `REMOTE_PACKAGE` del Host, el `id` del módulo del Cliente y el `name` de la fila en `cordis.patch.yml`.
  El `id` de la fila y la clave de slot `PANEL_ID` ya eran la cadena sin scope, así que esta vez no hubo que migrar ninguna
  configuración del profile.

### Nota

- El nombre del repositorio en GitHub ya era `dsh-desktop-token-usage`, así que ni la URL del repositorio ni las etiquetas de
  publicación necesitaron cambios.

## [0.1.1] - 2026-09-28

### Corregido

- **La página de npm renderizaba el README chino por defecto.** npm 11 elige el readme en
  `@npmcli/package-json/lib/normalize.js` haciendo glob de `{README,README.*}` y tomando la primera coincidencia que parece
  markdown; en esta máquina ese glob devolvió `README.zh.md`, de modo que el campo `readme` del packument contenía el documento
  chino. Los documentos chinos se llaman ahora `README-zh.md` y `CHANGELOG-zh.md` (un guion no forma parte de ese glob, así que
  solo `README.md` puede seleccionarse).

### Cambiado

- Los enlaces del conmutador de idioma en la parte superior de ambos documentos son URL absolutas de GitHub: un enlace relativo
  no se puede abrir desde la página del paquete de npm, porque npm no sirve los archivos del repositorio como páginas. Las URL
  absolutas funcionan tanto en GitHub como en npm.

### Añadido

- Un flujo de publicación de GitHub Actions (`.github/workflows/publish.yml`): publicar una etiqueta `v*` publica en npm, una
  ejecución manual usa por defecto la simulación (dry run), y una etiqueta enviada se comprueba contra la `version` de
  `package.json`. La autenticación usa el secreto del repositorio `NPM_TOKEN` (un token de acceso granular con bypass 2FA
  habilitado).

## [0.1.0] - 2026-09-27

Primer lanzamiento: estadísticas de uso de Tokens totalmente sin conexión, con todos los datos tomados de los registros de
sesión bajo el local `$DSH_HOME/sessions`.

### Añadido

**Capa de estadísticas y datos**

- Lee `session.vN.jsonl.zstd`: estos archivos son contenedores en los que **varios frames zstd se concatenan de extremo a
  extremo**. La API de descompresión de Node solo decodifica el primer frame, así que el código localiza los límites de frame
  con un escaneo estructural (sin descomprimir) siguiendo el oficial `scanZstdFrames`, y después descomprime frame a frame y
  analiza línea a línea.
- Semántica de **plegado** de `(turn, step)`: dentro del mismo hueco un registro de uso posterior reemplaza al anterior, y la
  acumulación solo empieza después de `llm/retry-started`; `reasoningTokens` se trata como un subconjunto de `outputTokens` y no
  se cuenta dos veces.
- El índice se agrupa por **hora local** y se cachea incrementalmente por el `mtime+size` del archivo, persistido en
  `$DSH_HOME/cache/dsh-desktop-token-usage/sessions-index.json`.
- Inferencia del origen de la sesión: `Desktop · Web` / `CLI · Bots` / `Subagentes` —los registros no contienen ningún campo de
  origen del cliente, de modo que el origen solo puede derivarse de `origin`, `delegationDepth` y el `source.rpcId` del turno de
  usuario.

**Interfaces**

- Expone tres Remotes sobre el canal oficial Typert: `dshUsage/summary` (resumen de uso), `dshUsage/config` (lee la ventana de
  la tarjeta, incluido `writable`) y `dshUsage/setConfig` (escribe de vuelta en el patch del profile a través del `configEditor`
  oficial).

**Interfaz de usuario**

- Tarjeta al pie de la barra lateral (`sidebar.footer.action`): muestra la ventana de «últimas N horas» / «últimos N días» o el
  valor acumulativo según la configuración; cada ventana muestra el **volumen de entrada** (entrada sin caché + lecturas de
  caché), el **volumen de salida** y la **tasa de aciertos de caché**.
- Panel central (el panel `main`): filtros de intervalo de tiempo y de origen, 6 tarjetas de estadísticas, un mapa de calor de
  actividad, una tendencia diaria de Tokens (apilada por modelo más una línea de tasa de aciertos de caché), un gráfico de
  anillo del uso por modelo y una lista de cuotas.
- **Calendario** de actividad: alineado al lunes durante las últimas 53 semanas, con cabeceras de mes y coordenadas de día de
  la semana, y celdas fijadas en 11px; un control en la parte superior alterna entre **Tokens / turnos**, mostrando por defecto
  la dimensión que tenga más días con datos.
- Formulario de configuración de la página del plugin (`plugins.bundle.config`): `hours` (0-23) y `days` (1-30), donde `0`
  desactiva esa ventana.
- Toda la interfaz depende solo de React y de los tokens de tema `--dsw-alias-*`, y no referencia ningún paquete cliente
  `@deepseek-ai`.

**Diagnóstico**

- `boot.json`: la cadena de activación del Host (apply / inyección typert / provisión del servicio / registro del descriptor)
  y la configuración de ventana efectiva.
- `calls.json`: las últimas 20 invocaciones del panel (filtros, ventanas, número de sesiones, total de Tokens, tiempo
  transcurrido).

### Corregido

- **Los valores de retorno de Remote se trataban como cargas útiles**: la forma real es `{ ok, value }` / `{ ok: false, error }`,
  donde el fallo es un valor y no una excepción. El código original dejaba `data.totals` como `undefined`, lo que hacía que todo
  el panel lanzara un error y se renderizara en blanco mientras la tarjeta de la barra lateral mostraba solo `0`.
- **Colapso de la altura del panel**: `.dtu-body` usaba `flex:1 + min-height:0`, que se recortaba siempre que la altura del
  contenedor padre fuera indeterminada y colapsaba a una altura de 0; se revirtió a `display:block + height:100% + overflow:auto`,
  con la cabecera hecha sticky.
- **Las celdas del mapa de calor se estiraban**: `grid-auto-columns` expande las pistas para llenar el ancho del contenedor,
  estirando los cuadrados de 11px en barras anchas; se cambió a un diseño flex.
- **La escala de color del mapa de calor fallaba**: antes agrupaba por «día ÷ máximo», de modo que un único día
  excepcionalmente grande empujaba todo lo demás al mismo grupo; se cambió a cuartiles sobre los días distintos de cero.
- **Se añadió un límite de errores de renderizado**: cualquier excepción de renderizado dentro de un slot muestra ahora una
  explicación de texto en lugar de un bloque en blanco.
- **Las pruebas sobrescribían los archivos de diagnóstico de producción**: el `apply` de `npm test` escribía el `boot.json` /
  `calls.json` real, mientras que el README enseña expresamente a leer esos dos archivos para saber «qué generación del Host
  está en ejecución». El directorio de diagnóstico ahora puede sobrescribirse con la variable de entorno
  `DSH_TOKEN_USAGE_DIAG_DIR`, y el conjunto de pruebas apunta automáticamente a un directorio temporal, de modo que ya no
  contamina los archivos de producción.
- **Carreras de las pruebas con el escritor de registros de sesión**: aserciones como «los rangos por día particionan el
  total» fallaban intermitentemente cada vez que la sesión en ejecución añadía un registro (brecha observada: 157,951 Tokens,
  con la suma por día resultando *mayor* que el total de la instantánea). Esas ventanas ahora comparten una cota superior
  fijada al **inicio de la hora actual** —el filtrado por hora es por contenedor, así que fijar «ahora» no ayudaría: los
  registros escritos después en el contenedor de la hora actual siguen contando. El mapa de calor ignora deliberadamente el
  intervalo de tiempo, de modo que ahora compara la cuadrícula de fechas estable, con una única relectura al sumar a través de
  instantáneas.

### Cambiado

- Los contenedores del índice cambiaron de días a **horas locales** (`CACHE_VERSION` 1 → 2, lo que reconstruye el índice una
  vez en el primer arranque), haciendo posibles ventanas como «las últimas horas»; el gráfico diario del panel se fusiona desde
  los contenedores por hora por el Host.
- Los datos del mapa de calor son independientes del intervalo de tiempo (la respuesta `summary` ganó un campo `heatmap`, que
  aún sigue el filtro de origen): un calendario filtrado a 7 días significaría «7 celdas encendidas en una cuadrícula de un
  año», que no es lo que un mapa de calor debe significar.
- Los valores de configuración se persisten en el `cordis.patch.yml` del profile a través del `configEditor` oficial, no en los
  archivos propios del plugin.
- Se introdujo la única dependencia `@deepseek-ai/*`, `@deepseek-ai/schemastery` (requerida por la tarjeta `Config` oficial).

### Preparación de la publicación (npm)

- **Nombre del paquete, id de fila y nombre del repositorio unificados como `@jd04063221/dsh-desktop-token-usage`** (el scope
  se eliminó en 0.1.2): este plugin solo apunta a **DSH Desktop** (sus datos provienen de los `$DSH_HOME/sessions` de Desktop),
  de modo que el nombre lleva `desktop` para mantenerlo aparte de cualquier otra superficie. Actualizados a la vez: el nombre
  del paquete, `REMOTE_PACKAGE` del Host, el `id` del módulo del Cliente (la convención oficial es que el `id` de un módulo sea
  su nombre de paquete —véase `dsh-api-remotes/lib/client.js`), el `name` de la fila **y** el `id` de la fila en
  `cordis.patch.yml`, la clave de slot de la tarjeta de configuración (`plugins.bundle.config` se indexa por el **nombre del
  paquete**), el directorio de diagnósticos y caché de índice, y la URL del repositorio en GitHub.
- **Omitir cualquiera de ellos falla en silencio**: el `id` del módulo y la clave de la tarjeta de configuración deben ser
  igual al nombre del paquete, y el `name` de la fila debe ser exactamente el nombre del paquete instalado en el profile. El
  `id` de la fila es también el ancla de la anulación de configuración `- id: …` del profile —cambiarlo significa migrar esa
  anulación, o los `hours`/`days` guardados dejan de aplicarse (migrados aquí). Al reconocer su propia entrada de Loader el
  Host coincide tanto con el **nombre del paquete** como con el **id de la fila**, de modo que una fila heredada puede leer y
  escribir configuración (cubierto por una prueba).
- Se eliminó `private: true` y se añadieron `author` / `repository` / `homepage` / `bugs` / `keywords` /
  `publishConfig.access=public` (los paquetes con scope son restringidos por defecto) / `engines.dsh` (declarativo; DSH no lo
  hace cumplir) / `prepublishOnly: npm test`, más un nuevo `LICENSE` MIT.
- ⚠️ **`jd04063221` en `name` / `author` / las URL del repositorio es un nombre de usuario de marcador de posición**: debe
  reemplazarse por su propio scope de npm y su nombre de usuario de GitHub antes de publicar (véase «Publicar en npm» en el
  README para la lista elemento por elemento).

### Compatibilidad y alternativas

- **Un Cliente más nuevo que el Host** es el estado normal (el primero se recarga en caliente, el segundo necesita un
  reinicio), de modo que cada campo ausente tiene una alternativa: cuando falta `card`, el bloque acumulativo se calcula al
  momento a partir de `totals`; cuando falta `heatmap`, el calendario se rellena a partir de los `days` del rango de filtro
  actual, y la redacción de la cabecera cambia en consecuencia.
- Cuando el profile no proporciona `configEditor`, el formulario de configuración se vuelve **de solo lectura** con una
  explicación del motivo, y la interfaz de escritura informa de un error explícito.

### Documentación

- `README.md` (inglés, el predeterminado) / `README-zh.md` (chino): instalación, uso, opciones de configuración, la tabla de
  contabilidad de Tokens, los límites de la inferencia de origen, limitaciones conocidas y un orden de solución de problemas,
  con los dos conmutadores de la parte superior del archivo enlazándose entre sí.
- `docs/DESIGN.md`: el contrato de datos, los compromisos clave y los tropiezos encontrados (zstd multiframe, el sobre, el
  cacheo de la generación de módulos, el mecanismo de la página de configuración, etc.).
- `docs/research/`: notas de investigación tempranas y scripts reutilizables de sondeo de registros de sesión.
- `docs/` no se publica: la lista blanca `files` lleva ahora una entrada explícita `!docs` (el `files` de npm sí admite
  negación, mientras que un `.npmignore` de raíz no puede anular `files`, de modo que la negación es la forma que funciona).
- Notas de investigación redactadas: las rutas de máquina como `C:\Users\<user>` se escriben como `%USERPROFILE%` /
  `$DSH_HOME`, los registros reales citan el directorio de usuario como `<user>`, y la convención se indica en la parte
  superior del documento.

### Limitaciones conocidas

- Escritorio y web **no se pueden distinguir** en los datos locales y se fusionan en «Desktop · Web».
- La granularidad de la ventana se redondea a la hora (los registros no contienen marcas a nivel de minuto).
- La tarjeta no tiene canal de empuje y depende de una actualización silenciosa cada 5 minutos; para ver un cambio de
  configuración de inmediato, abra el panel y pulse «Actualizar».
- Las sesiones históricas importadas (como la migración de reasonix) tienen todas un uso de 0; son datos válidos y no se
  estiman.

### Compatibilidad

- **Entorno probado: DSH Desktop `0.1.7-rc.2`** (`@deepseek-ai/dsh-desktop@0.1.7-rc.2`), Windows 11 Pro compilación 26200
  (AMD64), Node v25.2.1. La activación del plugin, la tarjeta de la barra lateral, el panel, la tarjeta de configuración de la
  página del plugin, el RPC de navegador → Host y la conciliación campo por campo de los números contra la propia caché de
  proyección de DSH superaron todas la verificación —se garantiza el uso normal en 0.1.7-rc.2.
- `engines.dsh` se declara como `^0.1.7-rc.2` (antes `>=0.1.7-rc.2`, lo que equivalía a afirmar compatibilidad con 0.2/1.0
  también, sin evidencia). El campo es **declarativo**: la documentación oficial afirma claramente que declarar un rango no
  rechaza hosts incompatibles.
- Las versiones anteriores de DSH pueden no tener el slot `plugins.bundle.config` ni el servicio `configEditor` que usa este
  plugin; las versiones más nuevas no se han probado.
- La conclusión medida también se escribe en dos textos de pantalla: la `description` de `package.json` y la `meta.description`
  de la locale. La razón es que la interfaz de lista de plugins (`listBundles`) pasa la **URL de archivo** de `package.json` a
  `readPluginMeta`, y la documentación oficial dice «Las rutas de archivo y las URL de archivo no devuelven metadatos», de modo
  que solo la `description` de `package.json` surte efecto en esa ruta (medido: cada bundle de la lista tiene solo una
  `description` y no `meta`); la entrada de la locale la usan las rutas de la interfaz que pueden resolver los metadatos por
  nombre de paquete.

### Verificación

- El resultado del plegado coincide campo por campo con la propia caché de proyección de DSH (`session-5964a5d3-*`:
  `286650 / 182633 / 43826560 / 0`).
- El resumen es autocoherente: las dimensiones día/modelo vuelven a sumar el total; los intervalos de milisegundos diarios y
  por hora particionan exactamente el total; el calendario particiona exactamente por origen; cada resumen de ventana es ≤ el
  valor acumulativo; `hours=99` / `days=-3` se limitan.
- Los descriptores de cable de ambos lados coinciden campo por campo (tres endpoints), y el códec de parámetros acepta los
  valores que el navegador envía realmente.
- El renderizado pasa con un React/DOM falso en un entorno sin navegador (cubriendo ambas formas de tarjeta, el formulario de
  configuración, la estructura del calendario y ambas alternativas).
- Tras la instalación, `fiberPhase: active`, y tanto `sidebar.footer.action` como `main` están registrados.
- 23 pruebas en total, con `npm test` totalmente en verde. **La apariencia visual y las cifras finales requieren confirmación
  manual** (este entorno no tiene control de navegador).

---

## Apéndice: índice de commits

La versión 0.1.0 consta de los siguientes commits (`git log --reverse`, hasta `2b4be69`):

| Commit | Hora | Contenido |
|---|---|---|
| `9b46227` | 15:01 | Agregación de Tokens del lado del Host sobre registros de sesiones locales y las interfaces Remote de uso |
| `3b63332` | 15:02 | Tarjeta de uso en la barra lateral y panel central de Tokens |
| `5407357` | 15:02 | Conciliación golden de la agregación y pruebas smoke del cliente sin navegador |
| `6d6408e` | 15:02 | README, notas de diseño y notas tempranas de investigación |
| `7d66caa` | 15:58 | Corrección del sobre `{ok,value}` y del colapso de altura del panel |
| `61f272d` | 16:04 | Trazado de la cadena de activación del Host y documentos de solución de problemas |
| `5ad18db` | 16:48 | Ventana de la tarjeta de configuración Config oficial, índice refinado a horas |
| `dda8906` | 16:49 | Corrección de las notas sobre cómo se aplica la configuración (los cambios de configuración pasan por `fiber.restart`) |
| `3a593c5` | 16:58 | El cliente recurre al valor acumulativo cuando al Host le falta `card` |
| `2ae0a20` | 19:00 | Formulario de configuración integrado en la página del plugin (hours/days) |
| `e104dc2` | 19:31 | Rehacimiento del mapa de calor de actividad (semántica de calendario, ejes, escala de color por cuantiles, cambio de métrica) |
| `2b4be69` | 09:20 | Cambio del nombre del paquete a uno con scope y finalización de los metadatos de publicación de npm (preparación de la publicación) |
