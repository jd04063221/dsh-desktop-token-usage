# dsh-desktop-token-usage

[English](https://github.com/jd04063221/dsh-desktop-token-usage/blob/main/README.md) | [中文](https://github.com/jd04063221/dsh-desktop-token-usage/blob/main/translations/README-zh.md) | [繁體中文（臺灣）](https://github.com/jd04063221/dsh-desktop-token-usage/blob/main/translations/README-zh-TW.md) | [繁體中文（香港）](https://github.com/jd04063221/dsh-desktop-token-usage/blob/main/translations/README-zh-HK.md) | [Deutsch](https://github.com/jd04063221/dsh-desktop-token-usage/blob/main/translations/README-de.md) | [Français](https://github.com/jd04063221/dsh-desktop-token-usage/blob/main/translations/README-fr.md) | Español | [Italiano](https://github.com/jd04063221/dsh-desktop-token-usage/blob/main/translations/README-it.md) | [日本語](https://github.com/jd04063221/dsh-desktop-token-usage/blob/main/translations/README-ja.md) | [한국어](https://github.com/jd04063221/dsh-desktop-token-usage/blob/main/translations/README-ko.md)

Un plugin de estadísticas de uso de Tokens **totalmente sin conexión** para DSH (DeepSeek Harness).

- La **mitad del Host** escanea `$DSH_HOME/sessions/**/session.vN.jsonl.zstd` y deduce mediante plegado el uso real de Tokens;
- La **mitad del Cliente** monta una tarjeta de uso al pie de la barra lateral izquierda; al hacer clic se abre un panel en
  el panel central: filtros de intervalo de tiempo y de origen, 6 tarjetas de estadísticas, una fila de ventanas configuradas,
  un mapa de calor de actividad, una tendencia diaria de Tokens (una curva de tasa de aciertos de caché superpuesta sobre las
  barras de Tokens, porcentajes reales etiquetados a la derecha, con el eje Y ampliado un 10% más allá del mínimo/máximo del
  periodo) y un gráfico de anillo del uso por modelo con una lista.

Los intervalos de tiempo que informan la tarjeta y la fila **Ventanas configuradas** del panel los decide la **configuración
del plugin** (ambas ventanas están desactivadas por defecto): en **Configuración → Plugins → `Token 用量`** (Uso de Tokens)
puede activar de forma independiente una ventana de «últimas N horas» (0-23) y otra de «últimos N días» (1-30); desactive
ambas y cada superficie volverá a un único bloque acumulativo. Esas ventanas miden la recencia según el reloj e ignoran
deliberadamente el filtro de origen del panel, de modo que ocupan una fila propia en lugar de estar entre las tarjetas de
estadísticas que siguen al filtro. La misma página de configuración también elige la **agrupación** —por modelo, por proveedor
o ambas (con «ambas», la sección de tendencia y la sección de desglose, `Desglose del uso`, reciben cada una un chip
conmutable)— y la **paleta de colores** —primer, cvd o muted, cada una con un conjunto claro y otro oscuro que sigue el
propio interruptor claro/oscuro de DSH (`body[data-ds-dark-theme]`), de modo que los gráficos nunca discrepan del shell.

El pie de la barra lateral es una única fila horizontal compartida con todos los demás plugins registrados allí, y cada uno de
ellos declara `width: 100%` —de modo que no pueden compartirla dos a la vez. Medido en vivo, sin nada intermedio esta tarjeta
se comprime a 105.2px. Por eso la tarjeta convierte esa fila en una **columna** (`[class*="_footerActions"]:has(.dtu-footCard)`
—basada en el sufijo de clase más `:has()`, así que nada depende de los nombres de clase con hash de DSH y no se toca ningún
ancestro—), lo que da a cada plugin en el asiento la línea de ancho completa para la que fue escrita; esta tarjeta ocupa los
256px completos. Es `flex-direction` y no `flex-wrap` porque el shell envuelve cada slot en un elemento `display: contents`
—un selector de hijo directo nunca coincide con el asiento— y porque en un asiento en columna `flex-wrap` significa «empezar
otra columna», lo que empujaría la tarjeta junto a su vecina. Eso necesita `:has()`; consulte la tabla de compatibilidad más
abajo.

Sin acceso a la red, sin telemetría, sin llamadas a la API: cada número proviene de registros de sesiones que ya están en su
máquina.

## Capturas de pantalla

Renderizadas desde los propios componentes de este plugin con **datos de ejemplo** —las capturas se producen sin conexión con
[`scripts/render-shots.mjs`](../scripts/render-shots.mjs) (el `client.js` real y el CSS contra un Host falso) más
[`scripts/render-shots.py`](../scripts/render-shots.py) (Chrome sin cabeza), así que no intervienen registros de sesiones, rutas
ni datos de cuenta. Tema claro primero, tema oscuro segundo. Las capturas están renderizadas en chino —el primer script acepta
`--locale <id>` para renderizar otro idioma— y las diez variantes de idioma de este README comparten el mismo conjunto.

![Panel, tema claro](../assets/dashboard-light.png)

Seis tarjetas de estadísticas, la fila de ventanas configuradas, el mapa de calor de actividad, la tendencia diaria de Tokens
con la curva de tasa de aciertos de caché superpuesta sobre las barras y el desglose del uso por modelo.

![Panel, tema oscuro](../assets/dashboard-dark.png)

El mismo panel en el tema oscuro —cada paleta incluye un conjunto claro y otro oscuro.

| Mapa de calor de actividad | Tendencia diaria |
|---|---|
| ![Mapa de calor de actividad](../assets/heatmap-light.png) | ![Tendencia diaria](../assets/trend-light.png) |

| La tarjeta de la barra lateral | Su página en el gestor de plugins |
|---|---|
| ![Tarjeta de la barra lateral](../assets/sidebar-dark.png) | ![Configuración](../assets/settings-light.png) |

La tarjeta al pie de la barra lateral muestra las dos ventanas configuradas; al hacer clic se abre el panel de arriba. La
página del plugin en el gestor de plugins contiene los intervalos de las ventanas, la agrupación y la paleta.

## Compatibilidad y entorno probado

**Verificado por completo en DSH Desktop 0.1.7-rc.2 y 0.2.0-rc.2, comprobado para compatibilidad con 0.2.0-rc.1.**

| Elemento | Entorno probado |
|---|---|
| DSH | Desktop `0.1.7-rc.2` y `0.2.0-rc.2` (verificación completa), `0.2.0-rc.1` (comprobación de compatibilidad) |
| Runtime incluido | Electron 44 / Chromium 152 / Node 24.18.1 (convertir el asiento en columna necesita `:has()`, Chrome 105+; el temado de las paletas necesita `light-dark()`, Chrome 123+) |
| Sistema operativo | Windows 11 Pro, compilación 26200, AMD64 |
| Node (para ejecutar las pruebas) | v25.2.1, v26.7.0 |

La verificación fue mucho más allá de «se instala»: la activación del plugin alcanzando `fiberPhase: active`, el renderizado de
la tarjeta de la barra lateral y del panel central, la tarjeta de configuración que lleva la página del plugin siendo legible y
escribible, las llamadas Remote de navegador → Host funcionando de extremo a extremo, y cada campo coincidiendo con la propia
caché de proyección de DSH en una comprobación cruzada.

Para `0.2.0-rc.1` la comprobación fue estructural en lugar de una segunda ejecución completa. Cada paquete publicado al que toca
este plugin se comparó por diff contra `0.1.7-rc.2`: `dsh-plugin-manager` es idéntico byte a byte, y en `dsh-client-ui-sidebar`,
`dsh-client-ui-layout` y `dsh-client-ui-cordis` solo difieren la cadena de versión, una llamada de analíticas y el CSS de la
barra de título. El contrato del slot `sidebar.footer.action` y sus props propietarias `{ wide }` permanecen sin cambios, y los
paquetes que importa este plugin (`dsh-api-remotes`, `dsh-client-ui-layout`, `dsh-client-ui-sidebar`) conservan sus nombres. Una
prueba manual en `0.2.0-rc.1` informa de que el panel y las llamadas Remote funcionan; en `0.2.0-rc.2` se hizo después la
ejecución completa en la máquina de desarrollo de este plugin: activación hasta `fiberPhase: active`, la tarjeta y el panel
emitiendo llamadas Remote reales (`calls.json`), y las ventanas activas en `boot.json` coincidiendo con el profile.

Este plugin **no** declara ninguna dependencia peer `@deepseek-ai/dsh*`, y eso es lo que DSH realmente valida —un rango peer
ausente no aplica ninguna restricción de versión en absoluto. `engines.dsh` se declara como `^0.1.7-rc.2 || ^0.2.0-rc.1` solo
para los lectores humanos: la documentación oficial afirma claramente que declarar un rango no rechaza hosts incompatibles.

**Las versiones distintas de las de la tabla de arriba no están probadas.** Compilaciones anteriores de DSH pueden carecer del
slot `plugins.bundle.config` y del servicio `configEditor` que usa este plugin (sin ellos no hay tarjeta de configuración, y la
configuración solo puede editarse a mano en el patch del profile); las compilaciones más recientes que `0.2.0-rc.2` aún no se
han verificado.

## Qué escribe en el disco

El plugin lee registros de sesiones y solo escribe dentro de un directorio propio: `$DSH_HOME/cache/dsh-desktop-token-usage/`.
No se escribe nada junto a un registro de sesión, no se crea, modifica ni elimina nada en ningún otro lugar bajo `$DSH_HOME`, y
nunca se realiza ningún acceso a la red.

| Archivo en ese directorio | Escrito por | Propósito | Para desactivarlo |
|---|---|---|---|
| `sessions-index.json` | `lib/session-usage.js` | Caché de plegado por sesión, para que una llamada en caliente no vuelva a escanear cada `session.vN.jsonl.zstd` | Elimínelo; se reconstruye en la siguiente llamada |
| `calls.json` | `index.js` | Diagnóstico: las últimas 20 llamadas Remote | `DSH_TOKEN_USAGE_DIAG=0` |
| `boot.json` | `index.js` | Diagnóstico: cuándo se aplicó por última vez el fiber | `DSH_TOKEN_USAGE_DIAG=0` |

Ambos escritores son **atómicos**: escriben un hermano `<name>.<pid>.tmp` y lo renombran sobre el destino, de modo que un lector
concurrente nunca ve un archivo parcial y un proceso terminado no puede dejar ninguno truncado. El índice está limitado a 800
entradas (las más antiguas se descartan y se vuelven a escanear bajo demanda), y cualquier `.tmp` que deje un fallo se elimina
en la siguiente escritura.

## Instalación

Este repositorio es un bundle de DSH (`package.json` declara `dsh.bundle.patch` y `dsh.client`). Instálelo a través del punto de
entrada oficial; no es necesario editar manualmente los archivos del profile. El paquete está publicado en el registro oficial de npm,
así que basta el nombre del paquete: el gestor lo resuelve en el registro y lo instala en el profile actual:

```
plugin_manager  action: install_bundle  target: dsh-desktop-token-usage
```

Para instalarlo desde un directorio local (por ejemplo, para ejecutar un `main` aún no publicado), indique a
`install_bundle` la ruta absoluta de este directorio.

```
plugin_manager  action: install_bundle  target: <absolute path to this directory>
```

Como este paquete depende de `@deepseek-ai/schemastery` (la biblioteca de esquemas que necesita la tarjeta Config oficial), y
`install_bundle` usa una instalación `link:` para directorios locales y **no** instala las dependencias de los paquetes
enlazados, instale primero una vez dentro de este repositorio:

```
npm install            # installs dev/runtime dependencies only, no network data
```

### Después de editar el código: el cliente se recarga en caliente, el Host necesita un reinicio

| Qué mitad cambió | Cómo surte efecto |
|---|---|
| `client.js` (UI) | La instantánea del módulo del lado del navegador se envía a la página por HMR una vez cambia su mtime/size; si no surte efecto, recargue la página a fondo una vez (Ctrl/Cmd+Shift+R) |
| `index.js` / `lib/*` (Host) | **Hay que reiniciar DSH**: reactivar la entrada solo vuelve a montar el fiber, no reimporta la generación del módulo JS en caché. Del mismo modo, añadir o cambiar campos de `Config` también requiere un reinicio antes de que aparezcan en Configuración |

Para saber qué versión está en ejecución: compruebe si existe `$DSH_HOME/cache/dsh-desktop-token-usage/boot.json` y si `windows`
coincide con lo esperado.

Desinstalación: `plugin_manager action: remove_bundle target: dsh-desktop-token-usage`.

> El nombre del paquete y el **row id** del plugin son dos cosas distintas: el row id es `dsh-desktop-token-usage` (el punto de
> anclaje de las anulaciones de configuración en el profile), y el nombre del paquete es `dsh-desktop-token-usage`. Use el nombre
> del paquete para desinstalar/instalar, y el row id para cambiar la configuración.

## Uso

1. Mire la tarjeta en la **parte inferior de la barra lateral izquierda**, encima de Configuración: según su configuración,
   muestra el volumen de entrada/salida y la tasa de aciertos de caché de cada ventana;
2. Haga clic en ella → el panel se abre en el panel central;
3. En la parte superior del panel puede filtrar por **intervalo de tiempo** (últimos 7/14/30/90 días, todo, personalizado) y
   por **origen**; un botón de actualización está en la esquina inferior derecha.

Tanto el filtrado como la agregación ocurren en el Host: cada cambio emite una nueva solicitud de agregación al Host (el Host
mantiene una caché de índice basada en el mtime+size del archivo, de modo que las llamadas en caliente se cuentan en cientos de
milisegundos). La tarjeta se actualiza en silencio una vez cada 5 minutos —la ventana de horas se desliza con el reloj en
cualquier caso, así que debería actualizarse incluso cuando no haya nuevo uso.

### Cómo leer el mapa de calor de actividad

- Es un **calendario** (alineado al lunes, las últimas 53 semanas) con ejes de **mes** y **día de la semana**; las celdas
  reparten el ancho de la tarjeta, de modo que se estiran con ella y se mantienen cuadradas (11px es el tamaño de referencia);
- La escala de color usa **cuartiles sobre los días distintos de cero**, no «día ÷ máximo» —con esta última, un único día
  excepcionalmente grande comprime todo lo demás al mismo tono de gris;
- La cabecera alterna entre **Tokens / turnos**; por defecto se muestra la dimensión que tenga **más días con datos** (en una
  máquina con mucho historial importado los Tokens son escasos, de modo que dibujar Tokens por defecto daría una cuadrícula
  casi vacía);
- **Sigue el filtro de origen pero no se ve afectado por el intervalo de tiempo**: un calendario filtrado a 7 días significaría
  «7 celdas encendidas en una cuadrícula de un año», que es exactamente lo que un mapa de calor no debería parecer.

## Localización

El panel sigue **la propia configuración de idioma de DSH**. No tiene su propio selector de idioma: cambie el idioma en DSH y
el panel cambia con él, al instante y sin recargar.

- `en` y `zh` son las locales integradas de DSH, y este plugin incluye un diccionario para ambas;
- Los siguientes paquetes de idioma están registrados en el catálogo de DSH, de modo que aparecen en su propio selector: `zh-TW`
  (臺灣正體), `zh-HK` (香港繁體), `de`, `fr`, `es`, `it`, `ja` y `ko`. Los seis códigos restantes —`pt-BR`, `ru`, `vi`, `th`, `id`
  y `ar` (de derecha a izquierda)— están diseñados pero aún no implementados; consulte
  [el diseño](../docs/superpowers/specs/2026-10-01-i18n-design.md);
- Los textos viven en `locales/<id>.json`, un archivo plano por idioma, y se generan en `client.js` mediante
  `node scripts/build-dicts.mjs`. Nunca edite el bloque generado a mano —`npm test` falla mientras esté desactualizado—;
- Los números, porcentajes, fechas, nombres de días de la semana y de meses, y las formas plurales provienen todos de `Intl`,
  de modo que un idioma que agrupa los miles de otro modo, escribe `萬`/`億` donde el inglés escribe `K`/`M`/`B`, o flexiona sus
  plurales, se lee correctamente;
- `translations/README-<id>.md` y `translations/CHANGELOG-<id>.md` contienen ambos documentos en cada uno de los diez idiomas. Permanecen en el
  repositorio para GitHub; npm muestra solo `README.md`.

## Configuración

Edite estos valores en la página **Plugins → `Token 用量`** (Uso de Tokens) —la entrada `Plugins` de la barra lateral →
`Token 用量`—: en el medio de la página hay dos campos de entrada etiquetados
`Intervalo de tiempo de las ventanas configuradas del panel` (el intervalo de tiempo que muestra la tarjeta de la barra lateral)
y un botón de guardar.

DSH **no** genera automáticamente un editor a partir del esquema `Config` —un plugin que trae su propia configuración tiene que
renderizar el formulario en el slot `plugins.bundle.config` (direccionado por el nombre del paquete). Eso es lo que hace este
plugin: al guardar llama al `configEditor` oficial, y los valores acaban en el `cordis.patch.yml` del profile, de modo que
también puede escribirlos ahí directamente:

```yaml
- id: dsh-desktop-token-usage
  disabled: false
  config:
    hours: 6
    days: 7
```

| Clave | Predeterminado | Descripción |
|---|---|---|
| `hours` | `0` | Cuántas horas informa la sección de Ventanas configuradas (0-23). `0` = desactiva esta ventana |
| `days` | `0` | Cuántos días informa la sección de Ventanas configuradas (1-30). `0` = desactiva esta ventana |

Con ambas desactivadas (por defecto) la tarjeta muestra valores acumulativos, igual que antes de que existieran estos dos
parámetros. Las ventanas se redondean a la hora en **hora local**: «últimas 6 horas» significa a partir del comienzo de la hora
hace 6 horas.

Los cambios surten efecto **inmediatamente** después de guardar: el `fiber.update()` de Cordis reinicia el fiber de este plugin y
`apply` se ejecuta de nuevo con la nueva configuración (así que nunca necesita reiniciar DSH para cambiar un valor); después de
guardar, el formulario vuelve a leer la configuración y actualiza la tarjeta automáticamente.


## Semántica de los datos

Esta sección importa —lo que significan los números lo determina por completo la semántica de los registros de DSH.

| Métrica | Definición |
|---|---|
| Uso de Tokens | `uncached input + output + cache read + cache write` |
| **Volumen de entrada** (tarjeta) | `uncached input + cache read` —es decir, cada token de prompt que el proveedor recibió realmente |
| **Volumen de salida** (tarjeta) | `usage.outputTokens` (`reasoningTokens` es un **subconjunto** del mismo y nunca se cuenta dos veces) |
| Entrada sin caché | `usage.inputTokens` —**en los campos nativos del proveedor esta ya es la parte que falló en la caché**; la propia proyección de DSH lo renombra a `uncachedInputTokens` |
| Lectura / escritura de caché | `usage.cacheReadTokens` / `usage.cacheWriteTokens` |
| Tasa media de aciertos de caché | `cache read ÷ (cache read + uncached input + cache write)` —el lado de fallo incluye las escrituras de caché |
| Número de solicitudes | Número de llamadas al modelo tras la liquidación (véase «plegado» más abajo) |
| Turnos completados | Número de eventos `turn/end` |
| Agrupar por modelo | El **último segmento** del id del modelo: un modelo llega como `deepseek/deepseek-v4.1-flash` desde `commandcode` y como `deepseek-v4.1-flash` desde `opencode-go`, y ambos se pliegan en una sola fila; agrupar por proveedor aún los mantiene separados |

**Semántica de plegado (un lugar fácil para equivocarse en el cálculo)**: dentro del mismo `(turn, step)`, una entrada de uso
posterior **reemplaza** a la anterior —los números del streaming se sobrescriben con la liquidación final; solo cuando
`llm/retry-started` cierra el hueco **acumula** la siguiente llamada de reintento. Así que «total = suma de todo el uso» es
incorrecto; hay que plegar. La lógica de plegado de este plugin corresponde línea por línea con la proyección `tokenUsage` en
`dsh-token-meter`, y está cubierta por pruebas de comprobación cruzada.

### Por qué el filtro de origen tiene solo tres opciones

Los registros de sesión de DSH 0.1.7-rc.2 **no** tienen ningún campo de «origen del cliente»: `SessionHeader` solo contiene
`version/id/createdAt/cwd/parentSession/isSeeded/origin/delegationDepth/agentPreset`, y el único valor que `origin` toma es
`'subagent'`. Escritorio y web no se pueden distinguir a partir de datos locales. El panel ofrece por tanto solo las tres
opciones **derivables de señales locales**:

| Etiqueta | Cómo se determina |
|---|---|
| Desktop · Web | Existe un turno real de usuario (`user/message` con `source.kind ∈ {user, user-approval}`) y lleva `source.rpcId` |
| CLI · Bots | Hay un turno real de usuario pero **sin** `rpcId` (headless / SDK / ACP / bots y similares, sin cliente que los dirija) |
| Subagentes | `header.origin === 'subagent'` o `delegationDepth > 0` |

Las sesiones sin ningún turno de usuario (por ejemplo, las que solo ejecutaron comandos con barra) cuentan para `Todos` y no se
listan por separado.

## Limitaciones conocidas

- **La primera agregación es lenta**: con unos 150 archivos de sesión y 90,000+ registros, un arranque en frío tarda unos
  3–4 segundos; a partir de ahí pasa a modo incremental por la huella del archivo, con llamadas en caliente de cientos de
  milisegundos. La caché se escribe en `$DSH_HOME/cache/dsh-desktop-token-usage/sessions-index.json`; eliminarla solo hace más
  lenta la siguiente ejecución.
- **Las sesiones históricas importadas pueden informar un uso de cero**: si una sesión histórica se importó (una migración de
  reasonix, por ejemplo), sus campos de uso son realmente todos 0. Son datos válidos, no datos faltantes, y este plugin no
  recurre a estimarlos.
- **Solo diez idiomas están traducidos**: el panel sigue la configuración de idioma de DSH, pero sus textos aún no cubren
  todos los idiomas a los que se puede fijar DSH; la sección de Localización de arriba lista los seis que siguen faltando.
- **Las ventanas se redondean a la hora**: los registros no tienen contenedores a nivel de minuto, así que «última 1 hora» se
  alinea al comienzo de la hora.
- **La tarjeta se actualiza con retraso**: no hay canal de empuje Host→Client, así que la tarjeta depende de un temporizador de
  actualización silenciosa de 5 minutos; si acaba de cambiar la configuración o quiere una actualización de inmediato, haga
  clic en la tarjeta para abrir el panel y pulse `Actualizar`.

## Estado de verificación

Verificación completada hasta la fecha (consulte la sección «evidencia de verificación» de `docs/DESIGN.md`):

- El resultado plegado coincide con **la propia caché de proyección de DSH** campo por campo (`session-5964a5d3-*`:
  `286650 / 182633 / 43826560 / 0`);
- Tanto los resúmenes por día como los por modelo vuelven a sumar el total, y los rangos de milisegundos por día/hora
  particionan el total exactamente;
- Resúmenes de ventana de la tarjeta: cada ventana solo puede ser menor o igual que el valor acumulativo, la identidad de la
  división entrada/salida se cumple, y los parámetros fuera de rango (`hours=99`/`days=-3`) se limitan;
- El esquema `Config` se valida a través de la interfaz Standard Schema: por defecto 0/0, mientras que `hours=24` y `days=31`
  se rechazan;
- El descriptor del Host y la contribución del Cliente se **comprueban campo por campo** en las pruebas, y el códec de
  parámetros acepta los valores que el navegador envía realmente;
- Ambas mitades del cliente se renderizan en un entorno sin navegador con un React/DOM falso (cubriendo tanto la fila de
  ventanas de la tarjeta como la alternativa acumulativa), con aserciones sobre la inyección de estilos y el desmontaje;
- Tras la instalación, `include:dsh-desktop-token-usage` tiene `fiberPhase` = `active`, y `dsh-desktop-token-usage` aparece
  tanto en `sidebar.footer.action` como en `main` (`active: true`);
- La ruta RPC de navegador → Host se demuestra que funciona (el índice del lado del Host se reescribe después de que la página
  lo llame).

**Confirmado / aún necesita su confirmación**:

1. **La ruta de configuración del lado del Host se ha verificado de extremo a extremo**: `Config.listConfigs` informa
   `status: schema` para este plugin (`id: include:dsh-desktop-token-usage`, `name` es el nombre del paquete); después de
   reiniciar el fiber, `windows` de `boot.json` es igual al `{hours:5, days:1}` configurado en el profile —tanto leer la
   configuración como escribirla de vuelta a través de `configEditor` funcionan correctamente bajo el nombre de paquete con
   scope.
2. **El cliente aún necesita una recarga a fondo de la página** (Ctrl/Cmd+Shift+R): la tarjeta de configuración en el medio de
   la página del plugin la registra el cliente (`plugins.bundle.config` se indexa por **nombre de paquete**), y hay que cargar
   un módulo nuevo del cliente antes de que aparezca.
3. **La generación del módulo del Host aún necesita un reinicio**: Node cachea ESM por la realpath resuelta, de modo que editar
   archivos —o incluso renombrar el paquete— no lo reimporta; en la práctica
   `import('dsh-desktop-token-usage') === import('dsh-desktop-token-usage')` es la misma instancia de módulo. Así que el código
   nuevo del Host como el `payload.heatmap` del que depende el mapa de calor solo se puede cargar reiniciando; hasta entonces el
   cliente usa la alternativa de «falta `heatmap`».
4. Los visuales del panel (incluido el mapa de calor rehecho) necesitan sus propios ojos —este entorno no tiene control de
   navegador.

### Dónde mirar cuando algo falla

Dos archivos de autodiagnóstico viven bajo `$DSH_HOME/cache/dsh-desktop-token-usage/`:

- `boot.json`: la cadena de activación del Host (`appliedAt`/`injectedAt`/`providedAt`/`registeredAt`) y las `windows` activas;
  si hay un `error`, le dice en qué paso se detuvo. Cada `apply` lo reescribe, así que `appliedAt` es la hora del montaje más
  reciente del fiber; pero **no puede demostrar que está ejecutando el código más reciente** —editar archivos no reimporta
  módulos, solo un reinicio lo hace.
- `calls.json`: las últimas 20 solicitudes del panel (filtros, ventana, número de sesiones, total de Tokens, tiempo
  transcurrido). **Un registro demuestra que la ruta navegador → Host funciona; la ausencia de registros no demuestra por sí
  sola que la ruta esté rota** (el archivo puede haberse eliminado simplemente), así que léalo junto con `boot.json`; si
  realmente nunca ha habido un registro, lo más probable es que el módulo del cliente nunca se haya cargado —**recargue la
  página a fondo** (Ctrl/Cmd+Shift+R).

Además, el `status` de `Config.listConfigs` le dice directamente si el módulo del fiber actual exporta `Config`: `absent` = una
generación antigua del módulo (no habrá tarjeta de configuración en la página del plugin); `schema` = se ha reconocido un
esquema schemastery (que es el caso de este plugin). Tenga en cuenta que `schema` solo significa que **se puede validar**; la
interfaz de configuración sigue siendo renderizada por el propio plugin en la página del plugin (véase «Configuración» más
arriba), y DSH no generará un formulario a partir del esquema.
Un cliente más antiguo que el Host también causa problemas —por eso el cliente **recurre a los valores acumulativos** cuando no
puede obtener el campo `card`, en lugar de quedarse en «cargando».

## Desarrollo

```
npm install     # installs @deepseek-ai/schemastery (a link install does not install dependencies for linked packages)
npm test        # node --test: aggregation golden cross-check + window summaries + browserless client smoke tests
```

Las pruebas también ejecutan `apply`, de modo que cuando escriben archivos de diagnóstico apuntan a un directorio temporal
(`DSH_TOKEN_USAGE_DIAG_DIR`) y no sobrescribirán los dos archivos que desea inspeccionar bajo
`$DSH_HOME/cache/dsh-desktop-token-usage/`.

Distribución:

```
index.js                     Host half: Config (schemastery) + registration of the usage Remote service
client.js                    Client half: window __ModuleLoader__ factory + dashboard and sidebar entry
lib/session-usage.js         Pure Node aggregation: multi-frame zstd reading, folding, hourly bucketing, window summaries, index cache
test/session-usage.test.mjs  Aggregation, millisecond ranges, card windows, calendar, Config schema, Remote service
test/client-smoke.test.mjs   Client factory / slot registration / two-half wire-contract cross-check / rendering
docs/DESIGN.md               Design, data contracts, pitfalls hit, and verification evidence
docs/research/               Earlier research notes and reusable session-log probe scripts
CHANGELOG.md                 Version history (with a commit index)
translations/                 Los README y CHANGELOG de los otros nueve idiomas
```

Los documentos vienen en diez idiomas: el inglés es el predeterminado (`README.md` / `CHANGELOG.md`), y cada otro idioma
tiene su propio `translations/README-<id>.md` / `translations/CHANGELOG-<id>.md`. Los diez están enlazados entre sí por el conmutador de la línea 3 de
cada archivo.

## Licencia

MIT
