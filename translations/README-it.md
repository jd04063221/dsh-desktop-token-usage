# dsh-desktop-token-usage

[English](https://github.com/jd04063221/dsh-desktop-token-usage/blob/main/README.md) | [中文](https://github.com/jd04063221/dsh-desktop-token-usage/blob/main/translations/README-zh.md) | [繁體中文（臺灣）](https://github.com/jd04063221/dsh-desktop-token-usage/blob/main/translations/README-zh-TW.md) | [繁體中文（香港）](https://github.com/jd04063221/dsh-desktop-token-usage/blob/main/translations/README-zh-HK.md) | [Deutsch](https://github.com/jd04063221/dsh-desktop-token-usage/blob/main/translations/README-de.md) | [Français](https://github.com/jd04063221/dsh-desktop-token-usage/blob/main/translations/README-fr.md) | [Español](https://github.com/jd04063221/dsh-desktop-token-usage/blob/main/translations/README-es.md) | Italiano | [日本語](https://github.com/jd04063221/dsh-desktop-token-usage/blob/main/translations/README-ja.md) | [한국어](https://github.com/jd04063221/dsh-desktop-token-usage/blob/main/translations/README-ko.md)

Un plugin **completamente offline** di statistiche sull'utilizzo dei token per DSH (DeepSeek Harness).

- La **parte Host** scansiona `$DSH_HOME/sessions/**/session.vN.jsonl.zstd` ed estrae con il folding l'effettivo utilizzo dei token;
- La **parte Client** monta una scheda di utilizzo a piè della barra laterale sinistra; cliccandola si apre un pannello nel
  riquadro centrale: filtri per intervallo di tempo e per origine, 6 schede statistiche, una riga di finestre configurate, una mappa di calore dell'attività, un andamento
  giornaliero dei token (una curva della percentuale di cache hit sovrapposta alle barre dei token, percentuali reali etichettate a destra, con l'asse Y ampliato
  del 10% oltre il minimo/massimo del periodo), e un grafico a ciambella dell'utilizzo per modello con la rispettiva lista.

Quali intervalli di tempo riportino la scheda e la riga **Finestre configurate** del pannello è deciso dalla **configurazione del plugin** (entrambe le finestre sono disattive per predefinito): in **Impostazioni → Plugin → `Token 用量`** (Utilizzo token) puoi
attivare indipendentemente una finestra "ultime N ore" (0-23) e una finestra "ultimi N giorni" (1-30); se le disattivi entrambe, ogni superficie
torna a un unico blocco cumulativo.
Queste finestre misurano la recenza sull'ora reale e ignorano deliberatamente il filtro origine del pannello, perciò stanno in una riga
a sé invece che tra le schede statistiche che seguono il filtro.
La stessa pagina delle impostazioni sceglie anche il **raggruppamento** — per modello, per provider o entrambi (con entrambi, la sezione dell'andamento
e la sezione di scomposizione, `Scomposizione dell'utilizzo`, hanno ciascuna un chip commutabile) — e la **palette colori** — Primer, adatto ai daltonici o desaturato,
ciascuna con un set chiaro e uno scuro che segue l'interruttore chiaro/scuro di DSH (`body[data-ds-dark-theme]`), così i
grafici non contraddicono mai la shell.

Il piè della barra laterale è una singola riga orizzontale condivisa con ogni altro plugin registrato lì, e ognuno di essi dichiara
`width: 100%` — quindi non ce n'è mai due che possano condividerla. Misurato dal vivo, senza nulla che si interpone, questa scheda viene schiacciata a
105.2px. La scheda trasforma quindi quella riga in una **colonna** (`[class*="_footerActions"]:has(.dtu-footCard)` — basata sul
suffisso della classe più `:has()`, così nulla dipende dalle classi con hash di DSH e nessun antenato viene toccato), il che dà
a ogni plugin nella sede la riga a tutta larghezza per cui è stato scritto; questa scheda occupa l'intero 256px. È `flex-direction`
e non `flex-wrap` perché la shell avvolge ogni slot in un elemento `display: contents` — un selettore figlio diretto
non corrisponde mai alla sede — e perché su una sede a colonna `flex-wrap` significa "inizia un'altra colonna", il che spinge la scheda
accanto al suo vicino. Questo richiede `:has()`; vedi la tabella di compatibilità qui sotto.

Nessun accesso alla rete, nessuna telemetria, nessuna chiamata API: ogni numero proviene dai log delle sessioni che sono già sulla tua macchina.

## Schermate

Renderizzate dai componenti di questo plugin con **dati di esempio** — le immagini sono prodotte offline da
[`scripts/render-shots.mjs`](../scripts/render-shots.mjs) (il vero `client.js` e il vero CSS contro un Host finto) più
[`scripts/render-shots.py`](../scripts/render-shots.py) (Chrome headless), quindi non sono coinvolti log di sessione, percorsi né dati
account. Prima il tema chiaro, poi quello scuro. Le immagini sono renderizzate in cinese — il primo script accetta
`--locale <id>` per renderizzare un'altra lingua — e tutte e dieci le varianti linguistiche di questo README condividono lo stesso set.

![Pannello, tema chiaro](../assets/dashboard-light.png)

Sei schede statistiche, la riga delle finestre configurate, la mappa di calore dell'attività, l'andamento giornaliero dei token con la curva della
percentuale di cache hit sovrapposta alle barre, e la scomposizione dell'utilizzo per modello.

![Pannello, tema scuro](../assets/dashboard-dark.png)

Lo stesso pannello sul tema scuro — ogni palette include un set chiaro e uno scuro.

| Mappa di calore dell'attività | Andamento giornaliero |
|---|---|
| ![Mappa di calore dell'attività](../assets/heatmap-light.png) | ![Andamento giornaliero](../assets/trend-light.png) |

| La scheda della barra laterale | La sua pagina nel gestore dei plugin |
|---|---|
| ![Scheda della barra laterale](../assets/sidebar-dark.png) | ![Impostazioni](../assets/settings-light.png) |

La scheda a piè della barra laterale mostra le due finestre configurate; cliccandola si apre il pannello qui sopra. La pagina del
plugin nel gestore dei plugin riporta gli intervalli delle finestre, il raggruppamento e la palette.

## Compatibilità e ambiente testato

**Verificato completamente su DSH Desktop 0.1.7-rc.2 e 0.2.0-rc.2, controllato per la compatibilità con 0.2.0-rc.1.**

| Voce | Ambiente testato |
|---|---|
| DSH | Desktop `0.1.7-rc.2` e `0.2.0-rc.2` (verifica completa), `0.2.0-rc.1` (controllo di compatibilità) |
| Runtime inclusa | Electron 44 / Chromium 152 / Node 24.18.1 (trasformare la sede in colonna richiede `:has()`, Chrome 105+; il tema della palette richiede `light-dark()`, Chrome 123+) |
| Sistema operativo | Windows 11 Pro, build 26200, AMD64 |
| Node (usato per eseguire i test) | v25.2.1, v26.7.0 |

La verifica è andata ben oltre "si installa": attivazione del plugin che raggiunge `fiberPhase: active`, rendering della scheda della barra laterale e del
pannello centrale, la scheda di configurazione presente nella pagina del plugin leggibile e scrivibile, le
chiamate Remote browser → Host che funzionano end-to-end, e ogni campo che corrisponde alla projection cache di DSH in un cross-check.

Per `0.2.0-rc.1` il controllo è stato strutturale piuttosto che un secondo run completo. Ogni package pubblicato toccato da questo plugin
è stato confrontato con `0.1.7-rc.2`: `dsh-plugin-manager` è identico byte per byte, e in `dsh-client-ui-sidebar`,
`dsh-client-ui-layout` e `dsh-client-ui-cordis` differiscono solo la stringa di versione, una chiamata di analytics e il CSS della title bar.
Il contratto dello slot `sidebar.footer.action` e le sue owner prop `{ wide }` sono invariati, e i package che questo plugin
importa (`dsh-api-remotes`, `dsh-client-ui-layout`, `dsh-client-ui-sidebar`) mantengono i loro nomi. Una prova manuale su
`0.2.0-rc.1` riporta il pannello e le chiamate Remote funzionanti; su `0.2.0-rc.2` è poi seguito il run completo sulla
macchina di sviluppo di questo plugin: attivazione fino a `fiberPhase: active`, scheda e pannello che emettono vere
chiamate Remote (`calls.json`), e le finestre attive in `boot.json` coerenti con il profile.

Questo plugin **non** dichiara nessuna peer dependency `@deepseek-ai/dsh*`, ed è proprio questo che DSH valida — un peer range assente
non applica alcun vincolo di versione. `engines.dsh` è dichiarato come `^0.1.7-rc.2 || ^0.2.0-rc.1` solo per gli esseri umani:
la documentazione ufficiale dichiara chiaramente che dichiarare un range non rifiuta host incompatibili.

**Le versioni diverse dalla tabella sopra non sono state testate.** Le build DSH precedenti possono mancare dello slot `plugins.bundle.config` e del
servizio `configEditor` usato da questo plugin (senza di esse non c'è scheda di configurazione, e la configurazione si può modificare
solo a mano nel patch del profile); le build più recenti di `0.2.0-rc.2` non sono state verificate ancora.

## Cosa scrive su disco

Il plugin legge i log delle sessioni e scrive solo dentro una directory propria:
`$DSH_HOME/cache/dsh-desktop-token-usage/`. Non viene scritto nulla accanto a un log di sessione, non viene creato, modificato o eliminato nulla altrove sotto
`$DSH_HOME`, e non viene mai effettuato alcun accesso alla rete.

| File in quella directory | Scritto da | Scopo | Come disattivarlo |
|---|---|---|---|
| `sessions-index.json` | `lib/session-usage.js` | Cache di fold per sessione, così una chiamata a caldo non ri-scansiona ogni `session.vN.jsonl.zstd` | Eliminala; viene ricostruita alla prossima chiamata |
| `calls.json` | `index.js` | Diagnostica: le ultime 20 chiamate Remote | `DSH_TOKEN_USAGE_DIAG=0` |
| `boot.json` | `index.js` | Diagnostica: quando il fiber è stato applicato l'ultima volta | `DSH_TOKEN_USAGE_DIAG=0` |

Entrambi gli scrittori sono **atomici**: scrivono un fratello `<name>.<pid>.tmp` e lo rinominano sopra la destinazione, così un lettore
concorrente non vede mai un file parziale e un processo ucciso non può lasciarne uno troncato. L'indice è limitato a 800
voci (le più vecchie vengono eliminate e ri-scansionate su richiesta), e qualsiasi `.tmp` lasciato da un crash viene ripulito alla prossima scrittura.

## Installazione

Questo repository è un bundle DSH (`package.json` dichiara `dsh.bundle.patch` e `dsh.client`). Installalo tramite il
punto di ingresso ufficiale; non serve modificare a mano i file del profile. Il pacchetto è pubblicato sul registro npm ufficiale, quindi basta il
nome del pacchetto: il gestore lo risolve nel registro e lo installa nel profile corrente:

```
plugin_manager  action: install_bundle  target: dsh-desktop-token-usage
```

Per un'installazione da una directory locale (per esempio per eseguire un `main` non ancora pubblicato), indica a
`install_bundle` il percorso assoluto di questa directory.

```
plugin_manager  action: install_bundle  target: <absolute path to this directory>
```

Poiché questo package dipende da `@deepseek-ai/schemastery` (la libreria di schema che richiede la scheda Config ufficiale), e
`install_bundle` usa un install `link:` per le directory locali e **non** installa le dipendenze dei package collegati,
installa una volta dentro questo repository prima:

```
npm install            # installs dev/runtime dependencies only, no network data
```

### Dopo aver modificato il codice: il client si aggiorna a caldo, l'Host richiede il riavvio

| Quale metà hai modificato | Come si attiva |
|---|---|
| `client.js` (interfaccia) | Lo snapshot del modulo lato browser viene spinto alla pagina dall'HMR non appena cambiano mtime/dimensione; se non si attiva, fai un hard refresh della pagina (Ctrl/Cmd+Shift+R) |
| `index.js` / `lib/*` (Host) | **DSH va riavviato**: riattivare la voce rimonta solo il fiber, non reimporta la generazione del modulo JS già in cache. Lo stesso vale per aggiungere o modificare campi `Config`, che richiedono un riavvio prima di apparire in Impostazioni |

Per capire quale versione è in esecuzione: controlla se `$DSH_HOME/cache/dsh-desktop-token-usage/boot.json` esiste e se
`windows` corrisponde alle aspettative.

Disinstalla: `plugin_manager action: remove_bundle target: dsh-desktop-token-usage`.

> Il nome del package e la **row id** del plugin sono due cose diverse: la row id è `dsh-desktop-token-usage` (l'ancora per
> le sovrascritture di configurazione nel profile), mentre il nome del package è `dsh-desktop-token-usage`. Usa il nome del package
> per disinstallare/installare, e la row id per cambiare configurazione.

## Utilizzo

1. Guarda la scheda in **fondo alla barra laterale sinistra**, sopra Impostazioni: mostra per ogni finestra il volume di input/output
   e la percentuale di cache hit secondo la tua configurazione;
2. Cliccala → il pannello si apre nel riquadro centrale;
3. In cima al pannello puoi filtrare per **intervallo di tempo** (ultimi 7/14/30/90 giorni, tutto, personalizzato) e per **origine**;
   un pulsante di aggiornamento si trova nell'angolo in basso a destra.

Sia il filtro che l'aggregazione avvengono nell'Host: ogni modifica invia una nuova richiesta di aggregazione all'Host (l'Host
mantiene una cache dell'indice indicizzata su mtime+size del file, quindi le chiamate a caldo sono nell'ordine dei centinaia di millisecondi). La scheda
si aggiorna in silenzio una volta ogni 5 minuti — la finestra oraria scorre comunque con l'orologio, quindi dovrebbe aggiornarsi anche quando
non c'è nuovo utilizzo.

### Come leggere la mappa di calore dell'attività

- È un **calendario** (allineato al lunedì, ultime 53 settimane) con assi per **mese** e **giorno della settimana**; le celle condividono
  la larghezza della scheda, quindi si estendono con essa restando quadrate (11px è la misura di riferimento);
- La scala dei colori usa i **quartili sui giorni diversi da zero**, non "giorno ÷ massimo" — con la seconda, un solo
  giorno eccevemente grande comprime tutto il resto nella stessa tonalità di grigio;
- L'intestazione alterna **Tokens / turni**; come predefinito si sceglie la dimensione con **più giorni con dati** (su una
  macchia con molto storico importato i token sono radi, quindi disegnare i token per predefinito darebbe una griglia quasi vuota);
- **Segue il filtro origine ma non è influenzato dall'intervallo di tempo**: un calendario filtrato su 7 giorni significherebbe
  "7 celle accese in una griglia di un anno", che è esattamente ciò che una mappa di calore non dovrebbe sembrare.

## Localizzazione

Il pannello segue **l'impostazione linguistica di DSH**. Non ha un selettore di lingua proprio: cambia la lingua in
DSH e il pannello si adatta con essa, subito e senza ricaricare.

- `en` e `zh` sono le localizzazioni integrate di DSH, e questo plugin fornisce un dizionario per entrambe;
- I seguenti language pack sono registrati nel catalogo di DSH, quindi compaiono nel suo selettore: `zh-TW`
  (臺灣正體), `zh-HK` (香港繁體), `de`, `fr`, `es`, `it`, `ja` e `ko`. I restanti sei codici — `pt-BR`, `ru`,
  `vi`, `th`, `id` e `ar` (da destra a sinistra) — sono progettati ma non ancora implementati; vedi
  [la progettazione](../docs/superpowers/specs/2026-10-01-i18n-design.md);
- Le stringhe stanno in `locales/<id>.json`, un file piatto per lingua, e vengono generate in `client.js` da
  `node scripts/build-dicts.mjs`. Non modificare mai a mano il blocco generato — `npm test` fallisce quando è obsoleto;
- Numeri, percentuali, date, nomi di giorni e mesi e le forme plurali arrivano tutti da `Intl`, così una lingua che
  raggruppa le migliaia diversamente, scrive `萬`/`億` dove l'inglese scrive `K`/`M`/`B`, o declina i plurali a modo suo si legge
  correttamente;
- `translations/README-<id>.md` e `translations/CHANGELOG-<id>.md` contengono entrambi i documenti in ciascuna delle dieci lingue. Restano nel
  repository per GitHub; npm mostra solo `README.md`.

## Configurazione

Modifica queste impostazioni nella pagina **Plugin → `Token 用量`** (Utilizzo token) — la voce `Plugins` nella barra laterale → `Token 用量`:
al centro della pagina trovi due caselle di input etichettate `Intervallo di tempo delle finestre configurate del pannello` (l'intervallo di tempo mostrato sulla
scheda della barra laterale) e un pulsante di salvataggio.

DSH **non** genera automaticamente un editor dallo schema `Config` — un plugin che porta la sua configurazione
deve renderizzare il form nello slot `plugins.bundle.config` (indirizzato per nome del package). È proprio ciò che questo plugin
fa: al salvataggio chiama l'ufficiale `configEditor`, e i valori finiscono nel `cordis.patch.yml` del profile, quindi puoi
scriverli anche direttamente lì:

```yaml
- id: dsh-desktop-token-usage
  disabled: false
  config:
    hours: 6
    days: 7
```

| Chiave | Predefinito | Descrizione |
|---|---|---|
| `hours` | `0` | Quante ore riporta la sezione Finestre configurate (0-23). `0` = disattiva questa finestra |
| `days` | `0` | Quanti giorni riporta la sezione Finestre configurate (1-30). `0` = disattiva questa finestra |

Con entrambe disattive (predefinito) la scheda mostra i valori cumulativi, proprio come prima che esistessero questi due parametri. Le finestre
si arrotondano all'ora in **orario locale**: "ultime 6 ore" significa a partire dall'inizio dell'ora 6 ore fa.

Le modifiche hanno effetto **subito** dopo il salvataggio: `fiber.update()` di Cordis riavvia il fiber di questo plugin e `apply`
gira di nuovo con la nuova configurazione (quindi non hai mai bisogno di riavviare DSH per cambiare un valore); dopo il salvataggio, il form
rilegge la configurazione e aggiorna la scheda automaticamente.


## Semantica dei dati

Questa sezione conta — il significato dei numeri è determinato interamente dalla semantica dei log di DSH.

| Metrica | Definizione |
|---|---|
| Utilizzo dei token | `uncached input + output + cache read + cache write` |
| **Volume di input** (scheda) | `uncached input + cache read` — cioè ogni token di prompt che il provider ha effettivamente ricevuto |
| **Volume di output** (scheda) | `usage.outputTokens` (`reasoningTokens` ne è un **sottoinsieme** e non viene mai contato due volte) |
| Input senza cache | `usage.inputTokens` — **nei campi nativi del provider questa è già la parte che ha mancato la cache**; la proiezione di DSH la rinomina in `uncachedInputTokens` |
| Lettura / scrittura cache | `usage.cacheReadTokens` / `usage.cacheWriteTokens` |
| Percentuale media di cache hit | `cache read ÷ (cache read + uncached input + cache write)` — il lato dei miss include le scritture in cache |
| Numero di richieste | Numero di chiamate al modello dopo il settlement (vedi "fold" sotto) |
| Turni completati | Numero di eventi `turn/end` |
| Raggrappamento per modello | L'**ultimo segmento** dell'id del modello: un modello arriva come `deepseek/deepseek-v4.1-flash` da `commandcode` e come `deepseek-v4.1-flash` da `opencode-go`, e entrambi finiscono in una riga sola; il raggruppamento per provider li tiene ancora distinti |

**Semantica del fold (il luogo più facile per sbagliare i conti)**: nello stesso `(turn, step)` una voce di utilizzo successiva
**sostituisce** quella precedente — i numeri in streaming vengono sovrascritti dal settlement finale; solo quando
`llm/retry-started` chiude lo slot una nuova chiamata di retry **accumula**. Quindi "totale = somma di tutto l'utilizzo" è sbagliato;
bisogna fare il fold. La logica di fold di questo plugin corrisponde riga per riga con la proiezione `tokenUsage` in
`dsh-token-meter`, ed è coperta da test di cross-check.

### Perché il filtro origine ha solo tre opzioni

I log di sessione di DSH 0.1.7-rc.2 **non** hanno un campo "origine del client": `SessionHeader` contiene solo
`version/id/createdAt/cwd/parentSession/isSeeded/origin/delegationDepth/agentPreset`, e l'unico valore che `origin`
assume mai è `'subagent'`. Desktop e web non sono distinguibili dai dati locali. Il pannello offre quindi solo
le tre opzioni **derivabili da segnali locali**:

| Etichetta | Come viene determinata |
|---|---|
| Desktop · Web | Esiste un vero turno utente (`user/message` con `source.kind ∈ {user, user-approval}`) e riporta `source.rpcId` |
| CLI · Bots | C'è un vero turno utente ma **nessun** `rpcId` (headless / SDK / ACP / bot e simili, senza client che guida) |
| Subagent | `header.origin === 'subagent'` oppure `delegationDepth > 0` |

Le sessioni senza alcun turno utente (per esempio quelle che hanno eseguito solo comandi slash) rientrano in `Tutte` (tutte) e non
sono elencate separatamente.

## Limitazioni note

- **La prima aggregazione è lenta**: con circa 150 file di sessione e 90,000+ record, un avviamento a freddo richiede circa
  3–4 secondi; dopodiché procede in modo incrementale per impronta del file, con chiamate a caldo nell'ordine dei centinaia di millisecondi.
  La cache viene scritta in `$DSH_HOME/cache/dsh-desktop-token-usage/sessions-index.json`; eliminarla rende solo la prossima esecuzione
  più lenta.
- **Le sessioni storiche importate possono riportare utilizzo zero**: se una sessione storica è stata importata (una migrazione reasonix,
  per esempio), i suoi campi di utilizzo sono davvero tutti 0. Sono dati validi, non dati mancanti, e questo plugin non
  ricade nella stima.
- **Solo dieci lingue sono tradotte**: il pannello segue l'impostazione linguistica di DSH, ma le sue stringhe non coprono
  ancora ogni lingua che DSH può impostare; la sezione Localizzazione qui sopra elenca le sei che mancano.
- **Le finestre si arrotondano all'ora**: i log non hanno intervalli a livello di minuto, quindi "ultima 1 ora" si allinea all'inizio
  dell'ora.
- **La scheda si aggiorna con ritardo**: non esiste un canale di push Host→Client, quindi la scheda si affida a un timer di aggiornamento
  silenzioso ogni 5 minuti; se hai appena cambiato la configurazione o vuoi un aggiornamento subito, clicca la scheda per aprire il
  pannello e premi `Aggiorna` (aggiorna).

## Stato della verifica

Verifica completata fin qui (vedi la sezione "prove di verifica" di `docs/DESIGN.md`):

- Il risultato del fold corrisponde alla **projection cache di DSH** campo per campo (`session-5964a5d3-*`: `286650 / 182633 / 43826560 / 0`);
- Sia i riepiloghi giornalieri che quelli per modello sommano di nuovo al totale, e gli intervalli in millisecondi per giorno/per ora partizionano esattamente il totale;
- Riepilogo delle finestre della scheda: ogni finestra può essere solo minore o uguale al valore cumulativo, l'identità della divisione input/output vale, e i parametri fuori intervallo (`hours=99`/`days=-3`) vengono limitati;
- Lo schema `Config` si valida attraverso l'interfaccia Standard Schema: predefinito 0/0, mentre `hours=24` e `days=31` vengono rifiutati;
- Il descrittore dell'Host e il contributo del Client sono **verificati campo per campo** nei test, e il codec dei parametri accetta i valori che il browser invia effettivamente;
- Entrambe le metà del Client rendono in un ambiente senza browser con un React/DOM finto (coprendo sia la riga delle finestre della scheda che il fallback cumulativo), con asserzioni su iniezione degli stili e smontaggio;
- Dopo l'installazione, `include:dsh-desktop-token-usage` ha `fiberPhase` = `active`, e `dsh-desktop-token-usage` compare sia in
  `sidebar.footer.action` che in `main` (`active: true`);
- Il percorso RPC browser → Host è provato funzionante (l'indice lato Host viene riscritto dopo che la pagina lo chiama).

**Confermato / necessita ancora della tua conferma**:

1. **Il percorso di configurazione lato Host è stato verificato end-to-end**: `Config.listConfigs` riporta `status: schema`
   per questo plugin (`id: include:dsh-desktop-token-usage`, `name` è il nome del package); dopo aver riavviato il fiber, i `windows`
   di `boot.json` equivalgono a `{hours:5, days:1}` configurati nel profile — sia la lettura della configurazione che la scrittura
   via `configEditor` funzionano correttamente sotto il nome del package con scope.
2. **Il client richiede ancora un hard refresh della pagina** (Ctrl/Cmd+Shift+R): la scheda di configurazione al centro della pagina del plugin
   è registrata dal client (`plugins.bundle.config` è indicizzato per **nome del package**), e un nuovo modulo client deve
   essere caricato prima che appaia.
3. **La generazione del modulo Host richiede ancora un riavvio**: Node mette in cache gli ESM per realpath risolto, quindi modificare i file — o
   persino rinominare il package — non li reimporta; in pratica
   `import('dsh-desktop-token-usage') === import('dsh-desktop-token-usage)` è la stessa istanza di modulo. Quindi nuovo codice Host
   come `payload.heatmap` di cui la mappa di calore dipende può essere caricato solo riavviando; fino a quel momento il client usa
   il fallback "manca `heatmap`".
4. Gli aspetti visivi del pannello (inclusa la mappa di calore rifatta) richiedono i tuoi occhi — questo ambiente non ha controllo del browser.

### Dove guardare quando qualcosa va storto

Due file di auto-diagnosi vivono in `$DSH_HOME/cache/dsh-desktop-token-usage/`:

- `boot.json`: la catena di attivazione dell'Host (`appliedAt`/`injectedAt`/`providedAt`/`registeredAt`) e i `windows`
  attivi; se c'è un `error`, indica quale passo si è bloccato. Ogni `apply` lo riscrive, quindi `appliedAt` è l'ora
  dell'ultimo rimontaggio del fiber; ma **non può provare che stai eseguendo l'ultimo codice** — modificare i file
  non reimporta i moduli, solo un riavvio lo fa.
- `calls.json`: le ultime 20 richieste del pannello (filtri, finestra, numero di sessioni, token totali, tempo trascorso).
  **Un record prova che il percorso browser → Host funziona; l'assenza di record non prova di per sé che il percorso sia rotto** (il file
  può essere stato semplicemente eliminato), quindi leggilo insieme a `boot.json`; se davvero non c'è mai stato un record, il
  modulo client molto probabilmente non si è mai caricato — **fai un hard refresh della pagina** (Ctrl/Cmd+Shift+R).

Inoltre, lo `status` di `Config.listConfigs` ti dice direttamente se il modulo del fiber corrente esporta `Config`:
`absent` = una vecchia generazione di modulo (non ci sarà scheda di configurazione sulla pagina del plugin); `schema` = è stata riconosciuta
una schema schemastery (che è il caso di questo plugin). Nota che `schema` significa solo che **può essere validata**; la
configurazione dell'interfaccia viene comunque renderizzata dal plugin stesso nella pagina del plugin (vedi "Configurazione" sopra), e DSH non
genererà un form dallo schema.
Anche un client più vecchio dell'Host causa problemi — ed è per questo che il client **ricade sui valori cumulativi** quando non
riesce a ottenere il campo `card`, invece di restare su "in caricamento".

## Sviluppo

```
npm install     # installs @deepseek-ai/schemastery (a link install does not install dependencies for linked packages)
npm test        # node --test: aggregation golden cross-check + window summaries + browserless client smoke tests
```

I test eseguono anche `apply`, quindi quando scrivono file diagnostici puntano a una directory temporanea
(`DSH_TOKEN_USAGE_DIAG_DIR`) e non sovrascriveranno i due file che vuoi ispezionare in
`$DSH_HOME/cache/dsh-desktop-token-usage/`.

Struttura:

```
index.js                     Host half: Config (schemastery) + registration of the usage Remote service
client.js                    Client half: window __ModuleLoader__ factory + dashboard and sidebar entry
lib/session-usage.js         Pure Node aggregation: multi-frame zstd reading, folding, hourly bucketing, window summaries, index cache
test/session-usage.test.mjs  Aggregation, millisecond ranges, card windows, calendar, Config schema, Remote service
test/client-smoke.test.mjs   Client factory / slot registration / two-half wire-contract cross-check / rendering
docs/DESIGN.md               Design, data contracts, pitfalls hit, and verification evidence
docs/research/               Earlier research notes and reusable session-log probe scripts
CHANGELOG.md                 Version history (with a commit index)
translations/                 I README e i CHANGELOG degli altri nove linguaggi
```

I documenti esistono in dieci lingue: l'inglese è predefinito (`README.md` / `CHANGELOG.md`), e ogni altra lingua ha
il suo `translations/README-<id>.md` / `translations/CHANGELOG-<id>.md`. Tutte e dieci sono collegate tra loro dal selettore alla riga 3 di ogni file.

## Licenza

MIT
