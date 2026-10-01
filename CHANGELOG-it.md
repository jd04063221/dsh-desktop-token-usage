# Registro delle modifiche

[English](https://github.com/jd04063221/dsh-desktop-token-usage/blob/main/CHANGELOG.md) | [中文](https://github.com/jd04063221/dsh-desktop-token-usage/blob/main/CHANGELOG-zh.md) | [繁體中文（臺灣）](https://github.com/jd04063221/dsh-desktop-token-usage/blob/main/CHANGELOG-zh-TW.md) | [繁體中文（香港）](https://github.com/jd04063221/dsh-desktop-token-usage/blob/main/CHANGELOG-zh-HK.md) | [Deutsch](https://github.com/jd04063221/dsh-desktop-token-usage/blob/main/CHANGELOG-de.md) | [Français](https://github.com/jd04063221/dsh-desktop-token-usage/blob/main/CHANGELOG-fr.md) | [Español](https://github.com/jd04063221/dsh-desktop-token-usage/blob/main/CHANGELOG-es.md) | Italiano | [日本語](https://github.com/jd04063221/dsh-desktop-token-usage/blob/main/CHANGELOG-ja.md) | [한국어](https://github.com/jd04063221/dsh-desktop-token-usage/blob/main/CHANGELOG-ko.md)

Questo file documenta tutte le modifiche note a `dsh-desktop-token-usage`.
Il formato si basa su [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), e i numeri di versione seguono [Semantic Versioning](https://semver.org/).

> **Nota di aggiornamento**: questo plugin è un bundle DSH che si carica in due metà. `client.js` (l'interfaccia) viene aggiornato a caldo dal browser,
> mentre `index.js` / `lib/*` (l'Host) **mette in cache la generazione del modulo JS che ha già importato** dentro il processo DSH — riattivare
> il plugin non basta, e nemmeno cambiare lo specificatore, reinstallare o persino rinominare il package (Node mette in cache gli ESM per realpath):
> DSH va riavviato una volta prima che il nuovo codice venga caricato. Per capire quale generazione è in esecuzione, controlla se `Config.listConfigs`
> riporta `schema` o `absent` per questo plugin, insieme al fatto che il processo sia stato riavviato dopo la tua modifica; `boot.json`
> viene riscritto da ogni `apply`, quindi la sua esistenza ti dice solo quando il fiber è stato rimontato per l'ultima volta.

## [Unreleased]

### Aggiunte

- **Localizzazione (i18n)**: il pannello ora segue **l'impostazione linguistica di DSH** — non ha un selettore di lingua proprio,
  e cambiare lingua in DSH cambia il pannello subito, senza ricaricare. Qui si pubblicano dieci lingue:
  `en` e `zh` attraverso i dizionari integrati di DSH, più i pacchetti `zh-TW` (臺灣正體), `zh-HK` (香港繁體), `de`, `fr`,
  `es`, `it`, `ja` e `ko` che questo plugin registra nel catalogo di DSH. Numeri, percentuali, date, nomi di giorni e
  mesi e le forme plurali arrivano tutti da `Intl`, quindi i separatori delle migliaia, `萬`/`億` dove l'inglese scrive
  `K`/`M`/`B` e le categorie plurali proprie di ogni lingua vengono tutti corretti. Le stringhe stanno in `locales/<id>.json`
  e vengono generate nel bundle del client da [`scripts/build-dicts.mjs`](scripts/build-dicts.mjs): il blocco generato
  non va mai modificato a mano, e un test fallisce quando è obsoleto. `README-<id>.md` e `CHANGELOG-<id>.md`
  contengono entrambi i documenti in ciascuna lingua pubblicata. Nota: selezionare un language pack lascia **l'interfaccia di DSH** su
  `zh`/`en` — solo questo plugin cambia.

### Correzioni

- **Il tooltip dell'andamento si legge come quello della mappa di calore**: il suo titolo non incolla più la data al totale dei token — la data
  sta da sola e il totale è una riga `Tokens` tutta sua (forma compatta), così una riga è un solo numero.
- **Niente più a capo dentro un tooltip**: la scatola segue il suo contenuto (`width:max-content`) e si appende alla
  colonna sotto il cursore — ancorata a sinistra nella metà sinistra, ancorata a destra nella metà destra — invece di centrarsi dentro una
  scatola clamped, e un nome di modello lungo come `deepseek-v4.1-flash` viene ellissizzato su una sola riga invece di essere spinto
  su una seconda.

### Pianificato

- **Localizzazione, il livello rimanente**: i sei codici lingua `pt-BR`, `ru`, `vi`, `th`, `id` e `ar` sono progettati
  ma non ancora implementati. `ar` richiede anche la shell da destra a sinistra — inset specchiati, tooltip e lati degli assi, con
  l'asse temporale da sinistra a destra — che nessuna delle dieci lingue pubblicate richiede. Vedi
  [la progettazione](docs/superpowers/specs/2026-10-01-i18n-design.md).

## [0.1.5] - 2026-10-01

### Aggiunte

- **Un'opzione di raggruppamento**: per modello effettivo (modelli omonimi uniti tra provider), per provider API, o entrambi. Con
  "entrambi", la sezione dell'andamento e la sezione di scomposizione hanno ciascuna il proprio chip, commutabile indipendentemente.
- **Un'opzione di palette**: Primer (predefinito di GitHub), adatto ai daltonici (Okabe-Ito) o desaturato (bassa saturazione),
  ciascuna con un set di variabili chiaro e uno scuro che segue automaticamente il tema di sistema.

### Modifiche

- **La curva della percentuale di cache hit si sovrappone alle barre**: le barre impilate dei token e la curva della percentuale di cache hit condividono un solo grafico (la
  curva è mappata sull'area di disegno con l'intervallo min−10% dello span ~ max+10% dello span, con percentuali reali etichettate a
  destra), invece di occupare una striscia tutta sua.
- **L'asse Y della curva del hit rate è guidato dai dati**: il minimo/massimo del periodo impostano l'intervallo con il 10% dello span aggiunto a
  ciascun estremo; la curva mantiene l'interpolazione cubica monotona.
- **Semantica del hit rate**: il miss ora include cacheWrite (hit / (hit + miss)), in linea con la definizione ufficiale; su questa
  macchina cacheWrite è sempre 0, quindi nessun numero cambia.

### Correzioni

- **Le palette dei grafici seguono l'interruttore tema di DSH**, non quello del sistema operativo: DSH marca il scuro con
  `body[data-ds-dark-theme]` e lascia `<body>` nudo in modalità chiara, quindi le palette ora leggono quel marcatore (attraverso
  `light-dark()` + `color-scheme`) invece di `prefers-color-scheme`. Una shell scura su un desktop chiaro lasciava
  prima ogni grafico chiaro — e una shell chiara su un desktop scuro faceva il contrario.
- **Un modello, una riga**: i provider non concordano sugli id dei modelli — `commandcode` riporta `deepseek/deepseek-v4.1-flash` mentre
  `opencode-go` riporta `deepseek-v4.1-flash`, e la vista per modello elencava due volte quello stesso modello. La chiave per modello è ora
  l'ultimo segmento dell'id; la vista per provider li tiene ancora distinti.
- **La mappa di calore riempie la sua riga**: le 53 settimane fisse non si fermano più a metà della scheda. Tutte le 53 colonne ora
  condividono la larghezza disponibile su una base unica di 11px (le celle restano quadrate, e l'asse dei mesi e le fasce dei giorni della settimana si estendono con
  esse); solo una scheda troppo stretta per una cella di 11px ricade sullo scorrimento, e quello scorrimento si apre sulla settimana più recente
  invece che sulle più vecchie (su questa macchina, vuote). Gli angoli sono arrotondati del 24% della cella invece di un fisso
  2px, un cambio di palette o metrica fa un cross-fade in 0.18s, il passaggio del cursore su un giorno lo illumina tramite `filter: brightness()`
  (nessun spostamento di layout, nessun reflow), e `prefers-reduced-motion` disattiva le transizioni.
- **Tre correzioni di leggibilità nella mappa di calore**: un giorno senza attività conserva un filetto step-0 di 1px invece di un blocco pieno
  (una volta che il calendario occupa la scheda, un muro di grigio pieno si legge come dati); oggi è marcato con un anello interno a due toni
  (colore del pannello fuori, colore dell'etichetta dentro) che resta visibile sia sul passo più chiaro che su quello più scuro; e il passaggio del cursore su un
  giorno ora solleva il tooltip del pannello — la stessa scatola che mostra il grafico dell'andamento, clamped al grafico in base a una quota del
  centro della colonna, e disposta su quattro righe: data / Tokens / turni / richieste, con il numero dei token nella stessa
  forma compatta che usano le schede statistiche e il tooltip dell'andamento (`1.45亿` piuttosto che `145,156,311`, così nessun conteggio di token può
  allargare la scatola) — invece del nativo `title`, ritardato e non stilizzabile. L'intero calendario è **centrato con 15px per lato**, e le sue 53 colonne condividono la larghezza rimanente,
  così **non si scorre più affatto** — la scatola di scorrimento è sparita. La barra in basso era la scatola sotto il cursore fin dall'inizio: quando un
  conteggio di token si allunga è più largo del minimo di 160px per cui era clamped, quindi alle colonne ai bordi sporgeva dalla
  scatola di scorrimento, e un pixel bastava. La scatola ora si inclina lontano dal bordo che le è più vicino — una colonna nella
  metà sinistra è allineata a sinistra e cresce verso destra, una colonna nella metà destra è allineata a destra e cresce verso sinistra — con
  `max-width:calc(50% - 25px)` che garantisce che metà della span della colonna possa contenere l'intera scatola. Non attraversa mai
  il calendario a nessuna larghezza, e non ha bisogno di misurare la propria larghezza per garantirlo.
- **Il piè di pagina del pannello si legge come un fatto per riga.** Tre elementi flex di lunghezze molto diverse andavano a capo in un
  paragrafo irregolare, e la nota lunga si spezzava a metà frase dentro un termine 「…」; ogni termine citato è ora infrangibile.

## [0.1.4] - 2026-09-30

### Modifiche

- **La scheda della barra laterale ora ha una riga a tutta larghezza tutta sua nella sede del piè di pagina.** `sidebar.footer.action` è una singola
  riga orizzontale (`display: flex`) e su una installazione standard `dsh-opencode-go-usage`, il badge Cordis e
  `commandcode-panel` ci stanno anch'essi — e ognuno di essi dichiara `width: 100%`, quindi nessuno dei due può condividere la riga.
  Misurato in una finestra live di 0.2.0-rc.2, senza nulla che si interpone la scheda di questo plugin viene schiacciata a **105.2px** mentre il suo
  vicino prende 150.8px, e le tre serie di etichette si sovrappongono. La scheda ora trasforma la **sede in una
  colonna** (`[class*="_footerActions"]:has(.dtu-footCard)`), così ogni occupante riceve la riga a tutta larghezza per cui è stato scritto:
  la scheda occupa l'intero **256px**. Corrispondere sul suffisso della classe più `:has()` la mantiene indipendente dalle classi con hash di DSH
  e la tiene lontana da ogni antenato — forzare una direzione sui contenitori di riga della shell impilerebbe
  la barra laterale sopra il pannello principale. È `flex-direction` e non `flex-wrap` per due motivi: la shell avvolge ogni
  slot in un elemento `display: contents`, quindi un selettore figlio diretto non corrisponde mai alla sede; e su una sede a **colonna**
  `flex-wrap` significa "inizia un'altra colonna" — misurato, ciò mette la scheda accanto al suo vicino e allarga la barra laterale a
  387.8px, facendola traboccare. Questo richiede `:has()`, ed è per questo che la tabella di compatibilità qui sotto ora riporta la
  Chromium inclusa.
- **Le stesse finestre sono mostrate anche nel pannello**, in una riga `Finestre configurate`: etichetta, totale, divisione input/output, percentuale di cache hit
  e turni. Sono recenza sull'ora reale — l'Host le costruisce solo da `{root, useCache, now}` — e
  ignorano deliberatamente il filtro origine, quindi quella riga lo dice invece di stare tra le schede statistiche che seguono il filtro.
  Con entrambe le finestre disattive ricade su una scheda cumulativa unica.
- **L'andamento giornaliero non mette più due scale sullo stesso grafico.** La percentuale di cache hit era una linea disegnata sopra le barre dei token
  con il suo asse destro 0-100%; siccome normalmente sta sopra il 90%, la linea galleggiava in cima al grafico senza
  alcuna relazione visibile con le barre sotto. La percentuale di hit è già data per finestra nelle schede statistiche e nella
  riga `Finestre configurate`, quindi quella curva è sparita: il grafico ora sovrappone invece il **totale giornaliero dei token** alle barre, condividendo
  l'unico asse dei token a sinistra, i suoi vertici cadono in cima a ogni colonna impilata così composizione e andamento si leggono
  insieme. I giorni senza utilizzo abbassano la linea alla base, il che rende più chiara la forma vuoto-poi-picco. La
  voce del hit rate nella legenda è diventata `Totale giornaliero`.
- **La curva scorre invece di fare angoli.** I giorni consecutivi sono uniti da un'interpolazione **cubica monotona** (Fritsch-Carlson),
  così la tangente è continua in ogni punto dati. Monotona e non una semplice spline di proposito: una
  semplice spline supera il segno tra i punti, e proprio accanto a un giorno senza utilizzo significa scendere sotto l'asse.
- **Le scritture sono atomiche, limitate e disattivabili.** Entrambi gli scrittori ora scrivono un fratello `<name>.<pid>.tmp` e lo rinominano
  sopra la destinazione, così un lettore concorrente non vede mai un file parziale e un processo ucciso non ne può lasciare uno troncato.
  L'indice delle sessioni è limitato a 800 voci (le più vecchie eliminate, ri-scansionate su richiesta) e qualsiasi `.tmp` lasciato da un crash
  viene ripulito alla prossima scrittura. La diagnostica dell'Host (`calls.json`, `boot.json`) può essere disattivata del tutto con
  `DSH_TOKEN_USAGE_DIAG=0`. Tutto viene scritto dentro `$DSH_HOME/cache/dsh-desktop-token-usage/`; il README ora
  documenta ogni file, a cosa serve e come disattivarlo.
- **La compatibilità è dichiarata per DSH Desktop 0.2.0-rc.1.** Il plugin continua a non dichiarare nessuna peer
  dependency `@deepseek-ai/dsh*`, che è ciò che DSH effettivamente valida; `engines.dsh` è allargato a `^0.1.7-rc.2 || ^0.2.0-rc.1` solo
  per i lettori. Ogni package pubblicato toccato da questo plugin è stato confrontato tra le due release: `dsh-plugin-manager`
  è identico byte per byte, e `dsh-client-ui-sidebar`, `dsh-client-ui-layout` e `dsh-client-ui-cordis` differiscono solo nella
  stringa di versione, in una chiamata di analytics e nel CSS della title bar. Il contratto dello slot è invariato.

### Nota

- Dopo la release, è stata fatta una prova manuale su DSH Desktop `0.2.0-rc.2` con il plugin `0.1.3`: il pannello e le
  chiamate Remote funzionano.
- La voce si è spostata brevemente in `sidebar.panellist`, che dà una riga a tutta larghezza posseduta dalla barra laterale — ma quella sede rende
  solo un'icona e un'etichetta, quindi i numeri di utilizzo che la scheda esiste per mostrare non avrebbero avuto dove andare. È tornata.

## [0.1.3] - 2026-09-28

### Modifiche

- **CI ora pubblica tramite Trusted Publishing (OIDC); il repository non conserva più un token npm.** Il
  workflow elimina `NODE_AUTH_TOKEN`, aggiunge `id-token: write` e aggiorna npm sul runner (Node 22 include un npm
  più vecchio dell'11.5.1 che la pubblicazione fidata richiede). Le attestazioni di provenance vengono generate automaticamente,
  e il secret del repository `NPM_TOKEN` non viene più referenziato.

## [0.1.2] - 2026-09-28

### Modifiche

- **Il nome del package ha perso lo scope**: `@jd04063221/dsh-desktop-token-usage` → `dsh-desktop-token-usage`.
  Le versioni 0.1.0 e 0.1.1 erano package con scope; il nome con scope è deprecato e ora punta qui. Un nome senza
  scope non richiede uno scope npm corrispondente, quindi il comando di installazione è più breve e la pubblicazione non dipende più dal possederne uno.
  Aggiornati di conseguenza: `REMOTE_PACKAGE` dell'Host, l'`id` del modulo Client e la `name` della riga in `cordis.patch.yml`.
  La `id` della riga e la chiave dello slot `PANEL_ID` erano già la stringa senza scope, quindi nessuna configurazione di profile ha dovuto essere
  migrata questa volta.

### Nota

- Il nome del repository GitHub era già `dsh-desktop-token-usage`, quindi né l'URL del repository né i tag delle release
  hanno avuto bisogno di cambiare.

## [0.1.1] - 2026-09-28

### Correzioni

- **La pagina npm renderizzava di predefinito il README cinese.** npm 11 sceglie il readme in
  `@npmcli/package-json/lib/normalize.js` cercando il glob `{README,README.*}` e prendendo la prima corrispondenza che sembra markdown;
  su questa macchina quel glob ha restituito `README.zh.md`, quindi il campo `readme` del packument conteneva il documento
  cinese. I documenti cinese si chiamano ora `README-zh.md` e `CHANGELOG-zh.md` (un trattino non fa parte di quel
  glob, quindi solo `README.md` può essere selezionato).

### Modifiche

- I link del selettore di lingua in cima ai due documenti sono URL assoluti di GitHub: un link relativo non può essere
  aperto dalla pagina del package npm, perché npm non serve i file del repository come pagine. Gli URL assoluti funzionano
  sia su GitHub che su npm.

### Aggiunte

- Un workflow di pubblicazione GitHub Actions (`.github/workflows/publish.yml'): pushare un tag `v*` pubblica su npm,
  una esecuzione manuale usa di predefinito la dry run, e un tag pushato viene confrontato con la `version` in `package.json`.
  L'autenticazione usa il secret del repository `NPM_TOKEN` (un token ad accesso granulare con bypass 2FA abilitato).

## [0.1.0] - 2026-09-27

Prima release: statistiche sull'utilizzo dei token completamente offline, con tutti i dati presi dai log di sessione sotto l'locale `$DSH_HOME/sessions`.

### Aggiunte

**Statistica e livello dati**

- Legge `session.vN.jsonl.zstd`: questi file sono container in cui **più frame zstd sono concatenati uno dopo l'altro**. L'API di
  decompressione di Node decodifica solo il primo frame, quindi il codice individua i confini dei frame con una scansione strutturale (senza decomprimere) seguendo
  l'ufficiale `scanZstdFrames`, poi decomprime frame per frame e analizza riga per riga.
- Semantica di **fold** `(turn, step)`: nello stesso slot un record di utilizzo successivo sostituisce quello precedente, e l'accumulo inizia
  solo dopo `llm/retry-started`; `reasoningTokens` è trattato come un sottoinsieme di `outputTokens` e non viene contato due volte.
- L'indice è suddiviso in bucket per **ora locale** e memorizzato in cache in modo incrementale per `mtime+size` del file, persistito in
  `$DSH_HOME/cache/dsh-desktop-token-usage/sessions-index.json`.
- Deduzione dell'origine della sessione: `Desktop · Web` (desktop · web) / `CLI · Bots` (CLI · bot) / `Subagent` (subagent) — i log non contengono un campo di origine client,
  quindi l'origine può essere dedotta solo da `origin`, `delegationDepth` e dal `source.rpcId` del turno utente.

**Interfacce**

- Espone tre Remotes sul canale Typert ufficiale: `dshUsage/summary` (riepilogo dell'utilizzo), `dshUsage/config`
  (legge la finestra della scheda, incluso `writable`), e `dshUsage/setConfig` (scrive nel patch del profile attraverso l'ufficiale `configEditor`).

**Interfaccia utente**

- Scheda a piè della barra laterale (`sidebar.footer.action`): mostra la finestra "ultime N ore" / "ultimi N giorni" o il valore cumulativo a seconda della
  configurazione; ogni finestra mostra il **volume di input** (input senza cache + letture in cache), il **volume di output** e la **percentuale di cache hit**.
- Pannello centrale (il pannello `main`): filtri per intervallo di tempo e per origine, 6 schede statistiche, una mappa di calore dell'attività,
  un andamento giornaliero dei token (impilato per modello più una linea della percentuale di cache hit), un grafico a ciambella dell'utilizzo per modello e una lista delle quote.
- **Calendario** dell'attività: allineato al lunedì sulle ultime 53 settimane, con intestazioni dei mesi e coordinate dei giorni della settimana, e celle fisse a 11px;
  un controllo in cima alterna **Tokens / turni**, con predefinito la dimensione che ha più giorni con dati.
- Modulo di configurazione della pagina del plugin (`plugins.bundle.config`): `hours` (0-23) e `days` (1-30), dove `0` disattiva quella finestra.
- Tutta l'interfaccia dipende solo da React e dai token tema `--dsw-alias-*`, e non referenzia nessun package client `@deepseek-ai`.

**Diagnostica**

- `boot.json`: la catena di attivazione dell'Host (apply / iniezione typert / fornitura del servizio / registrazione del descrittore) e la configurazione effettiva delle finestre.
- `calls.json`: le ultime 20 invocazioni del pannello (filtri, finestre, numero di sessioni, token totali, tempo trascorso).

### Correzioni

- **I valori di ritorno delle Remote erano trattati come payload**: la forma reale è `{ ok, value }` / `{ ok: false, error }`, dove il fallimento è un valore e non un'eccezione.
  Il codice originale lasciava `data.totals` come `undefined`, il che faceva eccezione a tutto il pannello e lo renderizzava vuoto mentre la scheda della barra laterale mostrava solo `0`.
- **Collasso dell'altezza del pannello**: `.dtu-body` usava `flex:1 + min-height:0`, che veniva tagliato ogni volta che l'altezza del contenitore padre era
  indeterminata e collassava a un'altezza di 0; ripristinato a `display:block + height:100% + overflow:auto`, con l'intestazione resa sticky.
- **Celle della mappa di calore allungate**: `grid-auto-columns` espande le track per riempire la larghezza del contenitore, allungando i quadrati di 11px in barre larghe; passato a un layout flex.
- **Scala dei colori della mappa di calore non funzionava**: prima raggruppava per "giorno ÷ massimo", così un solo giorno eccevemente grande spingeva tutto il resto nello stesso
  bucket; passato ai quartili sui giorni diversi da zero.
- **Aggiunto un error boundary di rendering**: qualsiasi eccezione di rendering dentro uno slot ora mostra una spiegazione testuale invece di un blocco vuoto.
- **I test sovrascrivevano i file diagnostici di produzione**: l'`apply` in `npm test` scriveva i veri `boot.json` / `calls.json`,
  mentre il README insegna specificamente a leggere quei due file per capire "quale generazione di Host è attualmente in esecuzione". La directory di diagnostica
  ora può essere sovrascritta con la variabile d'ambiente `DSH_TOKEN_USAGE_DIAG_DIR`, e la suite di test punta automaticamente a una directory temporanea, così non inquina più i file di produzione.
- **I test gareggiavano con il writer dei log di sessione**: asserzioni come "gli intervalli giornalieri partizionano il totale" fallivano in modo intermittente
  ogni volta che la sessione in corso appendeva un record (lacuna osservata: 157,951 token, con la somma giornaliera che veniva fuori *maggiore*
  del totale dello snapshot). Quegli intervalli ora condividono un limite superiore fissato all'**inizio dell'ora corrente** — il
  filtro orario è per bucket, quindi fissare "now" non avrebbe aiutato: i record scritti dopo nello stesso bucket orario contano comunque.
  La mappa di calore ignora deliberatamente l'intervallo di tempo, quindi ora confronta invece la griglia stabile delle date, con una singola
  rilettura quando si somma tra snapshot.

### Modifiche

- I bucket dell'indice sono passati da giorni a **ore locali** (`CACHE_VERSION` 1 → 2, che ricostruisce l'indice una volta al primo avvio),
  rendendo possibili finestre come "le ultime ore"; il grafico giornaliero del pannello è unito dai bucket orari dall'Host.
- I dati della mappa di calore sono indipendenti dall'intervallo di tempo (la risposta `summary` ha guadagnato un campo `heatmap`, che segue ancora il filtro origine):
  un calendario filtrato su 7 giorni significherebbe "7 celle accese in una griglia di un anno", che non è ciò che una mappa di calore deve significare.
- I valori di configurazione sono persistiti nel `cordis.patch.yml` del profile attraverso l'ufficiale `configEditor`, non nei file del plugin.
- Introdotto l'unico dipendente `@deepseek-ai/*`, `@deepseek-ai/schemastery` (richiesto dalla scheda `Config` ufficiale).

### Preparazione alla release (npm)

- **Nome del package, row id e nome del repository unificati in `@jd04063221/dsh-desktop-token-usage`** (lo scope è stato rimosso in 0.1.2):
  questo plugin punta solo a **DSH Desktop** (i suoi dati provengono da `$DSH_HOME/sessions` di Desktop), quindi il nome porta `desktop` per tenerlo
  distinto da qualsiasi altra superficie. Aggiornati insieme: il nome del package, `REMOTE_PACKAGE` dell'Host, l'`id` del modulo Client (la convenzione
  ufficiale è che l'`id` di un modulo sia il suo nome di package — vedi `dsh-api-remotes/lib/client.js`), la `name` **e** la `id` della riga in
  `cordis.patch.yml`, la chiave dello slot della scheda di configurazione (`plugins.bundle.config` è indicizzato per il **nome del package**), la directory di diagnostica e
  cache-indice, e l'URL del repository GitHub.
- **Mancare anche solo uno di questi fallisce in silenzio**: l'`id` del modulo e la chiave della scheda di configurazione devono essere uguali al nome del package, e la `name` della riga deve essere
  esattamente il nome del package installato nel profile. La `id` della riga è anche l'ancora della sovrascrittura di configurazione `- id: …` di un profile —
  cambiarla significa migrare quella sovrascrittura, o le `hours`/`days` salvate smettono di applicarsi (migrata qui). Quando riconosce la propria voce Loader
  l'Host confronta sia il **nome del package** che la **row id**, così una riga legacy può ancora leggere e scrivere la configurazione (coperto da un test).
- Rimossi `private: true` e aggiunti `author` / `repository` / `homepage` / `bugs` / `keywords` /
  `publishConfig.access=public` (i package con scope hanno accesso restricted di default) / `engines.dsh` (dichiarativo; DSH non lo fa rispettare) / `prepublishOnly: npm test`,
  più un nuovo `LICENSE` MIT.
- ⚠️ **`jd04063221` in `name` / `author` / gli URL del repository è un username segnaposto**: va sostituito con il tuo scope npm e il tuo username GitHub prima della pubblicazione
  (vedi "Pubblicazione su npm" nel README per l'elenco item per item).

### Compatibilità e fallback

- **Un Client più recente dell'Host** è lo stato normale (il primo si aggiorna a caldo, il secondo richiede un riavvio), quindi ogni campo mancante ha un fallback:
  quando `card` è assente, il blocco cumulativo è calcolato al volo da `totals`; quando `heatmap` è assente, il calendario è riempito dai `days` dell'intervallo di
  filtro corrente, e l'intestazione cambia di conseguenza.
- Quando il profile non fornisce `configEditor`, il modulo di configurazione diventa **in sola lettura** con una spiegazione del motivo, e l'interfaccia di scrittura riporta un errore esplicito.

### Documentazione

- `README.md` (inglese, predefinito) / `README-zh.md` (cinese): installazione, utilizzo, opzioni di configurazione,
  la tabella della contabilità dei token, i limiti della deduzione dell'origine, limitazioni note e un ordine di troubleshooting,
  con i due selettori in cima ai file che si collegano l'uno all'altro.
- `docs/DESIGN.md`: il contratto dati, le principali scelte di progetto e le insidie incontrate (zstd multi-frame, l'envelope, la cache della generazione dei moduli, il meccanismo della pagina di configurazione, ecc.).
- `docs/research/`: note di ricerca preliminari e script di esplorazione dei log di sessione riutilizzabili.
- `docs/` non viene pubblicato: la whitelist `files` ora contiene una voce esplicita `!docs` (il `files` di npm
  supporta la negazione, mentre un `.npmignore` alla radice non può superare `files`, quindi la negazione è la forma che funziona).
- Note di ricerca oscurate: percorsi di macchina come `C:\Users\<user>` sono scritti come `%USERPROFILE%` / `$DSH_HOME`,
  i record reali citano la directory utente come `<user>`, e la convenzione è dichiarata in cima al documento.

### Limitazioni note

- Desktop e web **non sono distinguibili** nei dati locali e sono uniti in "desktop · web".
- La granularità delle finestre è arrotondata all'ora (i log non contengono marcatori a livello di minuto).
- La scheda non ha un canale di push e si affida a un aggiornamento silenzioso ogni 5 minuti; per vedere subito una modifica alla configurazione, apri il pannello e clicca "Aggiorna".
- Le sessioni storiche importate (come la migrazione reasonix) hanno tutte un utilizzo di 0; sono dati validi e non vengono stimati.

### Compatibilità

- **Ambiente testato: DSH Desktop `0.1.7-rc.2`** (`@deepseek-ai/dsh-desktop@0.1.7-rc.2`), Windows 11 Pro
  build 26200 (AMD64), Node v25.2.1. Attivazione del plugin, scheda della barra laterale, pannello, scheda di configurazione della pagina del plugin, RPC browser → Host,
  e una riconciliazione campo per campo dei numeri contro la projection cache di DSH hanno superato tutti la verifica — l'uso normale su 0.1.7-rc.2 è garantito.
- `engines.dsh` è dichiarato come `^0.1.7-rc.2` (precedentemente `>=0.1.7-rc.2`, il che equivaleva a rivendicare compatibilità anche con 0.2/1.0, senza prove).
  Il campo è **dichiarativo**: la documentazione ufficiale dichiara chiaramente che dichiarare un range non rifiuta host incompatibili.
- Le release DSH precedenti potrebbero non avere lo slot `plugins.bundle.config` e il servizio `configEditor` usati da questo plugin; le versioni più recenti non sono state testate.
- La conclusione misurata è scritta anche in due testi visuali: la `description` in `package.json` e la `meta.description` della locale.
  Il motivo è che l'interfaccia della lista dei plugin (`listBundles`) passa l'**URL del file** di `package.json` a `readPluginMeta`,
  e la documentazione ufficiale dice "i percorsi dei file e gli URL dei file non restituiscono metadati", quindi solo la descrizione di `package.json` ha effetto su quel percorso
  (come misurato: ogni bundle nella lista ha solo una `description` e nessun `meta`); la voce di locale è usata dai percorsi dell'interfaccia che possono risolvere i metadati per nome del package.

### Verifica

- Il risultato del fold corrisponde campo per campo alla projection cache di DSH (`session-5964a5d3-*`: `286650 / 182633 / 43826560 / 0`).
- Il riepilogo è autoconsistente: le dimensioni giorno/modello sommano di nuovo al totale; gli intervalli in millisecondi giornalieri e orari partizionano esattamente il totale;
  il calendario partiziona esattamente per origine; ogni riepilogo di finestra è ≤ del valore cumulativo; `hours=99` / `days=-3` vengono limitati.
- I descrittori wire sui due lati corrispondono campo per campo (tre endpoint), e il codec dei parametri accetta i valori che il browser invia effettivamente.
- Il rendering supera con un React/DOM finto in un ambiente senza browser (coprendo entrambe le forme della scheda, il modulo di configurazione, la struttura del calendario e entrambi i fallback).
- Dopo l'installazione, `fiberPhase: active`, e sia `sidebar.footer.action` che `main` sono registrati.
- 23 test in totale, con `npm test` completamente verde. **L'aspetto visivo e i numeri finali richiedono conferma manuale** (questo ambiente non ha controllo del browser).

---

## Allegato: indice dei commit

La release 0.1.0 è costituita dai seguenti commit (`git log --reverse`, fino a `2b4be69`):

| Commit | Ora | Contenuto |
|---|---|---|
| `9b46227` | 15:01 | Aggregazione dei token lato Host sui log di sessione locali e le interfacce Remote di utilizzo |
| `3b63332` | 15:02 | Scheda di utilizzo della barra laterale e pannello centrale dei token |
| `5407357` | 15:02 | Riconciliazione golden dell'aggregazione e test smoke del client senza browser |
| `6d6408e` | 15:02 | README, note di design e prime note di ricerca |
| `7d66caa` | 15:58 | Corretto l'involucro `{ok,value}` e il collasso dell'altezza del pannello |
| `61f272d` | 16:04 | Tracciamento della catena di attivazione dell'Host e documentazione di troubleshooting |
| `5ad18db` | 16:48 | Finestra della scheda di configurazione Config ufficiale, indice rifinito all'ora |
| `dda8906` | 16:49 | Corrette le note su come la configurazione si applica (le modifiche di configurazione passano per `fiber.restart`) |
| `3a593c5` | 16:58 | Il client ricade sul valore cumulativo quando all'Host manca `card` |
| `2ae0a20` | 19:00 | Modulo di configurazione integrato sulla pagina del plugin (hours/days) |
| `e104dc2` | 19:31 | Mappa di calore dell'attività rifatta (semantica del calendario, assi, scala dei colori quantili, cambio metrica) |
| `2b4be69` | 09:20 | Nome del package cambiato in uno con scope e completati i metadati di pubblicazione npm (preparazione alla release) |
