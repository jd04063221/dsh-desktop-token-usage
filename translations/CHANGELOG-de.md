# Changelog

[English](https://github.com/jd04063221/dsh-desktop-token-usage/blob/main/CHANGELOG.md) | [中文](https://github.com/jd04063221/dsh-desktop-token-usage/blob/main/translations/CHANGELOG-zh.md) | [繁體中文（臺灣）](https://github.com/jd04063221/dsh-desktop-token-usage/blob/main/translations/CHANGELOG-zh-TW.md) | [繁體中文（香港）](https://github.com/jd04063221/dsh-desktop-token-usage/blob/main/translations/CHANGELOG-zh-HK.md) | Deutsch | [Français](https://github.com/jd04063221/dsh-desktop-token-usage/blob/main/translations/CHANGELOG-fr.md) | [Español](https://github.com/jd04063221/dsh-desktop-token-usage/blob/main/translations/CHANGELOG-es.md) | [Italiano](https://github.com/jd04063221/dsh-desktop-token-usage/blob/main/translations/CHANGELOG-it.md) | [日本語](https://github.com/jd04063221/dsh-desktop-token-usage/blob/main/translations/CHANGELOG-ja.md) | [한국어](https://github.com/jd04063221/dsh-desktop-token-usage/blob/main/translations/CHANGELOG-ko.md)

Diese Datei dokumentiert alle nennenswerten Änderungen an `dsh-desktop-token-usage`.
Das Format basiert auf [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), und die Versionsnummern folgen [Semantic Versioning](https://semver.org/).

> **Upgrade-Hinweis**: Dieses Plugin ist ein DSH-Bundle, das in zwei Hälften lädt. `client.js` (die UI) wird vom Browser hot-reloaded,
> während `index.js` / `lib/*` (der Host) **bereits importierte JS-Modul-Generationen im DSH-Prozess cached** — das erneute
> Aktivieren des Plugins reicht nicht, ebenso wenig das Ändern des Specifiers, eine Neuinstallation oder sogar das Umbenennen des Pakets (Node cached ESM nach realpath):
> DSH muss einmal neu gestartet werden, bevor der neue Code geladen wird. Um zu erkennen, welche Generation läuft, prüfen Sie, ob `Config.listConfigs`
> für dieses Plugin `schema` oder `absent` meldet, zusammen mit der Frage, ob der Prozess seit Ihrer Änderung neu gestartet wurde; `boot.json`
> wird von jedem `apply` neu geschrieben, sodass seine Existenz nur sagt, wann der Fiber zuletzt remountet wurde.

## [0.1.6] - 2026-10-05

### Hinzugefügt

- **Lokalisierung (i18n)**: Das Dashboard folgt jetzt **DSHs eigener Spracheinstellung** — es hat keinen eigenen Wähler,
  und ein Sprachwechsel in DSH schaltet das Dashboard sofort um, ohne Neuladen. Zehn Sprachen werden hier mitgeliefert:
  `en` und `zh` über DSHs eingebaute Wörterbücher, plus die Pakete `zh-TW` (臺灣正體), `zh-HK` (香港繁體), `de`, `fr`,
  `es`, `it`, `ja` und `ko`, die dieses Plugin in DSHs Katalog registriert. Zahlen, Prozentwerte, Daten, Wochentags- und
  Monatsnamen und Pluralformen stammen alle aus `Intl`, sodass Tausendertrennzeichen, `萬`/`億` wo Englisch `K`/`M`/`B` schreibt,
  und die eigenen Pluralkategorien jeder Sprache alle korrekt herauskommen. Die Texte liegen in `locales/<id>.json`
  und werden vom Client-Bundle mit [`scripts/build-dicts.mjs`](../scripts/build-dicts.mjs) erzeugt: der erzeugte
  Block darf nie von Hand bearbeitet werden, und ein Test scheitert, solange er veraltet ist. `translations/README-<id>.md` und `translations/CHANGELOG-<id>.md`
  tragen beide Dokumente in jeder ausgelieferten Sprache. Hinweis: Die Auswahl eines Sprachpakets lässt **DSHs eigene Oberfläche** auf
  `zh`/`en` — nur dieses Plugin schaltet um.

### Behoben

- **Das Trend-Tooltip liest sich wie das der Heatmap**: sein Titel klebt nicht mehr das Datum an die Token-Summe — das Datum
  steht für sich, und die Summe ist eine eigene `Tokens`-Zeile (kompakte Form), sodass eine Zeile eine Zahl ist.
- **In einem Tooltip bricht nichts mehr um**: die Box folgt ihrem Inhalt (`width:max-content`) und hängt an der
  Spalte, über der man schwebt — in der linken Hälfte links verankert, in der rechten Hälfte rechts verankert — statt in einer
  begrenzten Box zentriert zu werden, und ein langer Modellname wie `deepseek-v4.1-flash` wird auf einer Zeile gekürzt, statt auf eine
  zweite gedrängt zu werden.

### Geplant

- **Lokalisierung, die verbleibende Stufe**: die sechs Sprachcodes `pt-BR`, `ru`, `vi`, `th`, `id` und `ar` sind entworfen,
  aber noch nicht implementiert. `ar` braucht zudem die Shell von rechts nach links — gespiegelte Insets, Tooltips und Achsenseiten, mit
  der Zeitachse von links nach rechts —, was keine der zehn ausgelieferten Sprachen erfordert. Siehe
  [das Design](../docs/superpowers/specs/2026-10-01-i18n-design.md).

## [0.1.5] - 2026-10-01

### Hinzugefügt

- **Eine Gruppierungsoption**: nach tatsächlichem Modell (gleichnamige Modelle über Anbieter hinweg zusammengeführt), nach API-Anbieter oder beides. Bei
  „beides“ tragen der Verlaufsabschnitt und der Aufschlüsselungsabschnitt jeweils ihren eigenen Chip, der unabhängig umschaltbar ist.
- **Eine Palette-Option**: Primer (GitHub-Standard), cvd (Okabe-Ito, farbenblindfreundlich) oder muted (geringe Sättigung),
  jeweils mit einem hellen und einem dunklen Satz von Variablen, der automatisch dem Systemthema folgt.

### Geändert

- **Die Trefferquote-Kurve liegt über den Balken**: die gestapelten Token-Balken und die Cache-Trefferquote-Kurve teilen sich ein Diagramm (die
  Kurve wird über die Zeichenfläche im Bereich min−10% Spanne ~ max+10% Spanne abgebildet, mit realen Prozentwerten rechts beschriftet),
  statt sich einen eigenen Streifen zu nehmen.
- **Die Y-Achse der Trefferquote-Kurve ist datengesteuert**: Min/Max des Zeitraums legen den Bereich fest, mit 10% der Spanne an
  jedem Ende als Polster; die Kurve behält die monotone kubische Interpolation.
- **Semantik der Trefferquote**: Fehltreffer enthält jetzt cacheWrite (Treffer / (Treffer + Fehltreffer)), passend zur offiziellen Definition; auf diesem
  Rechner ist cacheWrite immer 0, also ändert sich keine Zahl.

### Behoben

- **Die Diagramm-Paletten folgen DSHs eigenem Themeschalter**, nicht dem Betriebssystem: DSH markiert dunkel mit
  `body[data-ds-dark-theme]` und lässt `<body>` im hellen Modus unberührt, sodass die Paletten nun dieses Marker lesen (über
  `light-dark()` + `color-scheme`) statt `prefers-color-scheme`. Ein dunkles Shell auf einem hellen Desktop ließ früher
  jedes Diagramm hell — und ein helles Shell auf einem dunklen Desktop umgekehrt.
- **Ein Modell, eine Zeile**: Anbieter sind sich bei Modell-ids nicht einig — `commandcode` meldet `deepseek/deepseek-v4.1-flash`, wo
  `opencode-go` `deepseek-v4.1-flash` meldet, und die nach-Modell-Ansicht führte dieses eine Modell doppelt auf. Der Schlüssel nach Modell ist jetzt
  das letzte Segment der id; die nach-Anbieter-Ansicht trennt die beiden weiterhin.
- **Die Aktivitäts-Heatmap füllt ihre Zeile**: die festen 53 Wochen hören nicht mehr mitten in der Karte auf. Alle 53 Spalten teilen
  sich jetzt die verfügbare Breite auf einer 11px-Basis (Zellen bleiben quadratisch, und Monatsachse und Wochentagsbänder dehnen sich mit);
  nur eine Karte, die für eine 11px-Zelle zu schmal ist, fällt auf Scrollen zurück, und dieses Scrollen öffnet sich bei der neuesten Woche
  statt bei den ältesten (hier leeren) Wochen. Ecken sind um 24% der Zelle gerundet statt um eine feste
  2px, ein Paletten- oder Metrikwechsel blendet über 0.18s über, das Hovern hellt einen Tag über `filter: brightness()` auf
  (kein Layout-Shift, kein Reflow), und `prefers-reduced-motion` schaltet die Übergänge ab.
- **Drei Lesbarkeits-Fixes in der Heatmap**: ein Tag ohne Aktivität behält einen 1px-Strich der Stufe 0 statt eines Vollblocks
  (sobald der Kalender die Karte spannt, liest sich eine Wand aus Vollgrau als Daten); heute ist mit einem zweifarbigen Innenring
  markiert (Panelfarbe außen, Label-Farbe innen), der auf dem hellsten wie dem dunkelsten Schritt sichtbar bleibt; und das Hovern über einen
  Tag ruft nun den eigenen Tooltip des Dashboards hervor — dieselbe Box, die das Trenddiagramm zeigt, auf die Zeichenfläche begrenzt nach einem Anteil der
  Spaltenmitte, und als vier Zeilen angelegt: Datum / Tokens / Runden / Anfragen, mit der Token-Zahl in derselben
  kompakten Form, die die Statistikkarten und der Trend-Tooltip nutzen (`1.45亿` statt `145,156,311`, sodass keine Token-Zahl die Box verbreitern kann)
  — statt des verzögerten, nicht stylen nativen `title`. Der ganze Kalender ist **zentriert mit 15px auf jeder Seite**, und seine 53 Spalten teilen sich die verbleibende Breite,
  sodass **jetzt gar nichts mehr scrollt** — die Scroll-Box ist weg. Die untere Bar war die Hover-Box: sobald eine
  Token-Zahl lang wird, ist sie breiter als die 160px-Mindestbreite, auf die sie begrenzt war, sodass sie an den Randspalten
  aus der Scroll-Box herausragte, und ein Pixel reichte. Die Box lehnt sich nun von der Kante weg, der sie nahe ist — eine Spalte in der
  linken Hälfte ist linksbündig und wächst nach rechts, eine Spalte in der rechten Hälfte rechtsbündig und wächst nach links — mit
  `max-width:calc(50% - 25px)`, was garantiert, dass die halbe Spaltenbreite die ganze Box fasst. Sie kreuzt den Kalender in
  keiner Breite, und sie braucht keine Messung ihrer eigenen Breite, um das zu garantieren.
- **Die Dashboard-Fußzeile liest sich als eine Tatsache pro Zeile.** Drei Flex-Elemente sehr unterschiedlicher Längen brachen zu einem unruhigen
  Absatz, und die lange Notiz brach mitten im Satz innerhalb eines „…“-Begriffs; jeder zitierte Begriff ist jetzt unumbrüchig.

## [0.1.4] - 2026-09-30

### Geändert

- **Die Karte in der Seitenleiste bekommt jetzt eine eigene Zeile voller Breite in der Fußzeile.** `sidebar.footer.action` ist eine einzelne
  horizontale Zeile (`display: flex`), und in einer Standardinstallation sitzen dort auch `dsh-opencode-go-usage`, das Cordis-Badge und
  `commandcode-panel` — und jedes davon deklariert `width: 100%`, sodass keines die Zeile teilen kann.
  In einem live 0.2.0-rc.2-Fenster gemessen wird diese Plugins Karte ohne Eingriff auf **105.2px** zusammengedrückt, während ihr
  Nachbar 150.8px bekommt und die drei Sätze von Labels aneinanderstoßen. Die Karte macht jetzt aus dem **Platz eine
  Spalte** (`[class*="_footerActions"]:has(.dtu-footCard)`), sodass jeder Bewohner die volle Breite bekommt, für die er
  geschrieben wurde: die Karte spannt die vollen **256px**. Das Matching auf den Klassensuffix plus `:has()` hält sie unabhängig von DSHs
  gehashten Klassennamen und hält sie von jedem Vorfahren weg — eine erzwungene Richtung auf den eigenen Zeilencontainern des Shells würde
  die Seitenleiste über das Haupt-Panel stapeln. Es ist `flex-direction` statt `flex-wrap` aus zwei Gründen: das Shell wrapt jeden
  Slot in ein `display: contents`-Element, sodass ein Selektor für direkte Kinder den Platz nie trifft; und auf einem **Spalten**-Platz
  bedeutet `flex-wrap` „beginne eine weitere Spalte“ — gemessen bringt das die Karte neben ihren Nachbarn und verbreitert die Seitenleiste auf
  387.8px, wodurch sie überläuft. Das braucht `:has()`, weshalb die Kompatibilitätstabelle unten jetzt die mitgelieferte
  Chromium festhält.
- **Dieselben Fenster werden auch im Dashboard gezeigt**, in einer Zeile `Konfigurierte Fenster`: Label, Summe, Eingabe/Ausgabe-Aufteilung, Cache-Treffer-
  quote und Runden. Sie sind reale Uhrzeit-Nähe — der Host baut sie allein aus `{root, useCache, now}` — und
  ignorieren bewusst den Quellfilter, sodass diese Zeile das sagt, statt unter den Statistikkarten zu stehen, die dem Filter folgen.
  Wenn beide Fenster aus sind, fällt sie auf eine einzige kumulative Karte zurück.
- **Der tägliche Verlauf legt nicht mehr zwei Maßstäbe auf eine Zeichenfläche.** Die Cache-Trefferquote war eine Linie über den Token-Balken
  mit eigener 0-100%-Achse rechts; da sie normalerweise über 90% liegt, schwebte die Linie entlang der oberen Kante der Zeichenfläche
  ohne sichtbaren Bezug zu den Balken darunter. Die Trefferquote wird in den Statistikkarten und der
  Zeile `Konfigurierte Fenster` bereits pro Fenster gegeben, sodass diese Kurve weg ist: das Diagramm legt jetzt den **täglichen Token-Gesamtwert** über die Balken und nutzt
  die eine linke Token-Achse, ihre Eckpunkte landen auf der Oberseite jeder gestapelten Spalte, sodass Zusammensetzung und Verlauf gemeinsam lesbar sind.
  Tage ohne Nutzung senken die Linie auf die Grundlinie, was die Form „erst leer, dann Spitze“ klarer macht. Der
  Trefferquote-Eintrag der Legende wurde zu `Tagesgesamt`.
- **Die Kurve fließt, statt zu kanten.** Benachbarte Tage werden durch eine **monotone kubische** (Fritsch-Carlson)-
  Interpolation verbunden, sodass die Tangente an jedem Datenpunkt stetig ist. Monoton statt einer gewöhnlichen Spline, mit Absicht: eine
  gewöhnliche Spline überschießt zwischen Punkten, und direkt neben einem Tag ohne Nutzung hieße das ein Absturz unter die Achse.
- **Schreibvorgänge sind atomar, begrenzt und abschaltbar.** Beide Schreiber legen jetzt einen `<name>.<pid>.tmp`-Bruder an und benennen
  ihn über das Ziel um, sodass ein gleichzeitiger Leser nie eine unvollständige Datei sieht und ein getöteter Prozess keine abgeschnittene hinterlässt.
  Der Sitzungsindex ist auf 800 Einträge begrenzt (älteste fallen raus, bei Bedarf neu gescannt), und eine `.tmp`, die ein Absturz hinterlassen hat,
  wird beim nächsten Schreiben aufgeräumt. Die Diagnose des Hosts (`calls.json`, `boot.json`) lässt sich mit
  `DSH_TOKEN_USAGE_DIAG=0` vollständig abschalten. Alles wird innerhalb von `$DSH_HOME/cache/dsh-desktop-token-usage/` geschrieben; das README
  dokumentiert jetzt jede Datei, wofür sie da ist und wie man sie abschaltet.
- **Für DSH Desktop 0.2.0-rc.1 wird Kompatibilität deklariert.** Das Plugin deklariert weiterhin keine `@deepseek-ai/dsh*` Peer-
  Abhängigkeit, und genau das validiert DSH tatsächlich; `engines.dsh` ist auf `^0.1.7-rc.2 || ^0.2.0-rc.1` erweitert, nur
  für Leser. Jedes veröffentlichte Paket, das dieses Plugin berührt, wurde über die beiden Releases gedifft: `dsh-plugin-manager`
  ist byte-identisch, und `dsh-client-ui-sidebar`, `dsh-client-ui-layout` und `dsh-client-ui-cordis` unterscheiden sich nur im
  Versionsstring, einem Analytics-Aufruf und Titelbalken-CSS. Der Slot-Vertrag ist unverändert.

### Hinweis

- Nach dem Release wurde ein manueller Versuch auf DSH Desktop `0.2.0-rc.2` mit Plugin `0.1.3` durchgeführt: das Dashboard und die
  Remote-Aufrufe funktionieren.
- Der Eintrag zog kurzzeitig nach `sidebar.panellist`, was eine Zeile voller Breite gibt, die der Seitenleiste gehört — aber dieser Platz rendert
  nur ein Icon und ein Label, sodass die Nutzungszahlen, die die Karte zeigt, nirgendwo hätten stehen können. Er kam zurück.

## [0.1.3] - 2026-09-28

### Geändert

- **CI veröffentlicht jetzt über Trusted Publishing (OIDC); das Repository speichert kein npm-Token mehr.** Das
  Workflow verwirft `NODE_AUTH_TOKEN`, fügt `id-token: write` hinzu und aktualisiert npm auf dem Runner (Node 22 bringt ein npm,
  das älter als die 11.5.1 ist, die Trusted Publishing erfordert. Provenance-Atteste werden automatisch
  erzeugt, und das `NPM_TOKEN`-Repository-Geheimnis wird nicht mehr referenziert.

## [0.1.2] - 2026-09-28

### Geändert

- **Der Paketname hat seinen Scope abgelegt**: `@jd04063221/dsh-desktop-token-usage` → `dsh-desktop-token-usage`.
  Die Versionen 0.1.0 und 0.1.1 waren gescopete Pakete; der gescopte Name ist veraltet und verweist jetzt hier. Ein ungescopter
  Name braucht keinen passenden npm-Scope, sodass der Installationsbefehl kürzer ist und das Veröffentlichen nicht mehr vom Besitz eines solchen abhängt.
  Mitgeändert: das `REMOTE_PACKAGE` des Hosts, das Client-Modul-`id` und der Zeilen-`name` in `cordis.patch.yml`.
  Die Zeilen-`id` und der Slot-Schlüssel `PANEL_ID` waren bereits die ungescopte Zeichenkette, sodass keine Profil-Konfiguration
  migriert werden musste.

### Hinweis

- Der Name des GitHub-Repositories war bereits `dsh-desktop-token-usage`, sodass weder die Repository-URL noch die Release-
  Tags geändert werden mussten.

## [0.1.1] - 2026-09-28

### Behoben

- **Die npm-Seite zeigte standardmäßig das chinesische README.** npm 11 wählt das readme in
  `@npmcli/package-json/lib/normalize.js` aus, indem es `{README,README.*}` globt und den ersten Markdown-aussehenden
  Treffer nimmt; auf diesem Rechner lieferte jener Glob `README.zh.md` zurück, sodass das `readme`-Feld des Packuments das chinesische
  Dokument enthielt. Die chinesischen Dokumente heißen jetzt `README-zh.md` und `CHANGELOG-zh.md` (ein Bindestrich ist Teil jenes
  Globs nicht, sodass nur `README.md` ausgewählt werden kann).

### Geändert

- Die Sprachumschalter-Links oben in beiden Dokumenten sind absolute GitHub-URLs: ein relativer Link kann nicht von der
  npm-Paketseite geöffnet werden, weil npm Repository-Dateien nicht als Seiten ausliefert. Absolute URLs funktionieren auf
  GitHub und npm gleichermaßen.

### Hinzugefügt

- Ein GitHub-Actions-Veröffentlichungs-Workflow (`.github/workflows/publish.yml`): Das Pushen eines `v*`-Tags veröffentlicht auf npm,
  ein manueller Lauf ist standardmäßig der Dry Run, und ein Tag-Push wird gegen die `version` in `package.json` geprüft.
  Die Authentifizierung nutzt das `NPM_TOKEN`-Repository-Geheimnis (ein granulares Zugriffstoken mit aktiviertem 2FA-Bypass).

## [0.1.0] - 2026-09-27

Erstes Release: vollständig offline Token-Nutzungsstatistik, mit allen Daten aus den Sitzungsprotokollen unter dem lokalen `$DSH_HOME/sessions`.

### Hinzugefügt

**Statistik und Datenschicht**

- Liest `session.vN.jsonl.zstd`: dies sind Container, in denen **mehrere zstd-Frames Ende an Ende verkettet sind**. Nodes
  Dekompressions-API dekodiert nur den ersten Frame, sodass der Code Frame-Grenzen mit einem strukturellen Scan findet (ohne zu dekomprimieren), folgend
  dem offiziellen `scanZstdFrames`, und dann Frame für Frame dekomprimiert und Zeile für Zeile parst.
- `(turn, step)` **Fold**-Semantik: innerhalb desselben Slots ersetzt ein späterer Nutzungseintrag den früheren, und das Akkumulieren beginnt erst
  nach `llm/retry-started`; `reasoningTokens` gilt als Teilmenge von `outputTokens` und wird nicht doppelt gezählt.
- Der Index wird nach der **lokalen Stunde** bucketed und inkrementell nach Datei `mtime+size` gecached, persistiert nach
  `$DSH_HOME/cache/dsh-desktop-token-usage/sessions-index.json`.
- Ableitung des Sitzungsursprungs: `Desktop · Web` / `CLI · Bots` / `Subagenten` — die Protokolle enthalten kein Feld für die Client-Herkunft,
  sodass der Ursprung nur aus `origin`, `delegationDepth` und der `source.rpcId` der Nutzerrunde abgeleitet werden kann.

**Schnittstellen**

- Stellt drei Remotes über den offiziellen Typert-Kanal bereit: `dshUsage/summary` (Nutzungszusammenfassung), `dshUsage/config`
  (liest das Karten-Fenster, einschließlich `writable`), und `dshUsage/setConfig` (schreibt über den offiziellen `configEditor` zurück in den Profil-Patch).

**Benutzeroberfläche**

- Fußzeilen-Karte in der Seitenleiste (`sidebar.footer.action`): zeigt je nach Konfiguration das Fenster „letzte N Stunden“ / „letzte N Tage“ oder den kumulativen Wert;
  jedes Fenster zeigt das **Eingabevolumen** (ungecachte Eingabe + Cache-Lesungen), das **Ausgabevolumen** und die **Cache-Trefferquote**.
- Zentrales Dashboard (das `main`-Panel): Zeitraum- und Ursprungsfilter, 6 Statistikkarten, eine Aktivitäts-Heatmap,
  einen täglichen Token-Verlauf (nach Modell gestapelt plus eine Cache-Trefferquote-Linie), ein Kreisdiagramm der Modellnutzung und eine Anteilsliste.
- Aktivitäts-**Kalender**: montag-ausgerichtet über die letzten 53 Wochen, mit Monatsköpfen und Wochentagskoordinaten, Zellen fest bei 11px;
  ein Bedienelement oben schaltet zwischen **Tokens / Runden** um, standardmäßig mit der Dimension, die mehr Tage mit Daten hat.
- Konfigurationsformular auf der Plugin-Seite (`plugins.bundle.config`): `hours` (0-23) und `days` (1-30), wobei `0` dieses Fenster deaktiviert.
- Die gesamte UI hängt nur von React und den `--dsw-alias-*`-Theme-Tokens ab und referenziert kein `@deepseek-ai`-Client-Paket.

**Diagnose**

- `boot.json`: die Host-Aktivierungskette (apply / typert-Injection / Dienstbereitstellung / Deskriptor-Registrierung) und die wirksame Fensterkonfiguration.
- `calls.json`: die letzten 20 Dashboard-Aufrufe (Filter, Fenster, Sitzungsanzahl, Gesamt-Tokens, vergangene Zeit).

### Behoben

- **Remote-Rückgabewerte wurden als Payloads behandelt**: die echte Form ist `{ ok, value }` / `{ ok: false, error }`, wobei ein Fehler ein Wert ist statt einer Ausnahme.
  Der ursprüngliche Code ließ `data.totals` `undefined`, wodurch das gesamte Dashboard einen Fehler warf und leer rendete, während die Karte in der Seitenleiste nur `0` zeigte.
- **Dashboard-Höhen-Collapse**: `.dtu-body` nutzte `flex:1 + min-height:0`, was beschnitten wurde, wann immer die Höhe des Elterncontainers
  unbestimmt war und auf 0 kollabierte; zurück zu `display:block + height:100% + overflow:auto`, mit klebendem Kopf.
- **Heatmap-Zellen gestreckt**: `grid-auto-columns` dehnt Spuren, um die Containerbreite zu füllen, und streckte die 11px-Quadrate zu breiten Balken; umgestellt auf ein Flex-Layout.
- **Heatmap-Farbskala fehlgeschlagen**: sie bucketete zuvor nach „Tag ÷ Maximum“, sodass ein einziger außergewöhnlich großer Tag alles andere in denselben
  Bucket drückte; umgestellt auf Quartile über Tage mit Nicht-Null-Wert.
- **Rendering-Fehlergrenze hinzugefügt**: jede Rendering-Ausnahme innerhalb eines Slots zeigt jetzt eine textliche Erklärung statt eines leeren Blocks.
- **Tests überschrieben Produktions-Diagnosedateien**: das `apply` in `npm test` schrieb die echten `boot.json` / `calls.json`,
  während das README ausdrücklich lehrt, diese beiden Dateien zu lesen, um zu sagen, „welche Generation des Hosts gerade läuft“. Das Diagnoseverzeichnis
  lässt sich jetzt mit der Umgebungsvariablen `DSH_TOKEN_USAGE_DIAG_DIR` überschreiben, und die Testsuite zeigt automatisch auf ein temporäres Verzeichnis, sodass sie keine Produktionsdateien mehr verunreinigt.
- **Tests im Wettlauf mit dem Sitzungsprotokoll-Schreiber**: Assertions wie „Tagesbereiche partitionieren die Summe“ scheiterten intermittierend
  wann immer eine laufende Sitzung einen Eintrag anhängte (beobachtete Lücke: 157,951 Tokens, wobei die Tagessumme *größer*
  ausfiel als der Snapshot-Gesamtwert). Diese Fenster teilen sich jetzt eine obere Grenze, die am **Anfang der aktuellen Stunde** verankert ist — die
  Stundenfilterung ist pro Bucket, sodass „jetzt“ zu verankern nicht half: Einträge, die später in den Bucket der aktuellen Stunde geschrieben werden, zählen weiter.
  Die Heatmap ignoriert bewusst den Zeitraum, sodass sie jetzt stattdessen das stabile Datumsraster vergleicht, mit einem einzigen Neu-Lesen
  beim Summieren über Snapshots hinweg.

### Geändert

- Index-Buckets von Tagen auf **lokale Stunden** umgestellt (`CACHE_VERSION` 1 → 2, was den Index beim ersten Start einmal neu aufbaut),
  wodurch Fenster wie „die letzten paar Stunden“ möglich werden; das tägliche Diagramm des Dashboards wird vom Host aus den Stunden-Buckets zusammengeführt.
- Heatmap-Daten sind unabhängig vom Zeitraum (die `summary`-Antwort bekam ein `heatmap`-Feld, das weiterhin dem Ursprungsfilter folgt):
  ein auf 7 Tage heruntergefilterter Kalender hieße „7 beleuchtete Zellen in einem Einjahresraster“, und das ist nicht, was eine Heatmap bedeuten soll.
- Konfigurationswerte werden über den offiziellen `configEditor` ins `cordis.patch.yml` des Profils persistiert, nicht in die eigenen Dateien des Plugins.
- Eingeführt die einzige `@deepseek-ai/*`-Abhängigkeit `@deepseek-ai/schemastery` (erforderlich von der offiziellen `Config`-Karte).

### Veröffentlichungsvorbereitung (npm)

- **Paketname, Zeilen-id und Repository-Name vereinheitlicht als `@jd04063221/dsh-desktop-token-usage`** (der Scope wurde in 0.1.2 abgelegt):
  dieses Plugin zielt nur auf **DSH Desktop** (seine Daten kommen aus Desktops `$DSH_HOME/sessions`), sodass der Name `desktop` trägt, um ihn
  von jeder anderen Oberfläche zu unterscheiden. Gemeinsam aktualisiert: der Paketname, das `REMOTE_PACKAGE` des Hosts, das Client-Modul-`id` (die offizielle
  Konvention ist, dass die `id` eines Moduls sein Paketname ist — siehe `dsh-api-remotes/lib/client.js`), der Zeilen-`name` **und** die Zeilen-`id` in
  `cordis.patch.yml`, der Slot-Schlüssel der Konfigurationskarte (`plugins.bundle.config` ist nach dem **Paketnamen** schlüsselig), das Diagnose- und
  Index-Cache-Verzeichnis und die GitHub-Repository-URL.
- **Fehlt auch nur eines, schlägt es stillschweigend fehl**: die Modul-`id` und der Schlüssel der Konfigurationskarte müssen dem Paketnamen entsprechen, und der Zeilen-`name` muss
  der exakte Paketname sein, der ins Profil installiert ist. Die Zeilen-`id` ist außerdem der Anker für die `- id: …`-Konfigurationsüberschreibung eines Profils —
  sie zu ändern bedeutet, diese Überschreibung zu migrieren, sonst greifen die gespeicherten `hours`/`days` nicht mehr (hier migriert). Wenn der Host seinen eigenen
  Loader-Eintrag erkennt, matcht er sowohl den **Paketnamen** als auch die **Zeilen-id**, sodass eine Legacy-Zeile weiterhin Konfiguration lesen und schreiben kann (durch einen Test abgedeckt).
- `private: true` entfernt und `author` / `repository` / `homepage` / `bugs` / `keywords` /
  `publishConfig.access=public` (gescopete Pakete sind standardmäßig eingeschränkt) / `engines.dsh` (deklarativ; DSH erzwingt es nicht) / `prepublishOnly: npm test` hinzugefügt,
  plus eine neue MIT-`LICENSE`.
- ⚠️ **`jd04063221` in `name` / `author` / den Repository-URLs ist ein Platzhalter-Benutzername**: er muss vor dem Veröffentlichen durch Ihre eigene npm-Scope und Ihren eigenen GitHub-Benutzernamen ersetzt werden.

### Kompatibilität und Fallbacks

- **Ein Client, der neuer ist als der Host**, ist der Normalzustand (der Erstere hot-reloadet, der Letztere braucht einen Neustart), sodass jedes fehlende Feld einen Fallback hat:
  wenn `card` fehlt, wird der kumulative Block on the fly aus `totals` berechnet; wenn `heatmap` fehlt, wird der Kalender aus den `days` des aktuellen
  Filterzeitraums gefüllt, und die Überschriftenformulierung ändert sich entsprechend.
- Wenn das Profil keinen `configEditor` bereitstellt, wird das Konfigurationsformular **schreibgeschützt** mit einer Erklärung des Grundes, und die Schreib-Schnittstelle meldet einen expliziten Fehler.

### Dokumentation

- `README.md` (Englisch, die Vorgabe) / `README-zh.md` (Chinesisch): Installation, Nutzung, Konfigurationsoptionen,
  die Token-Buchführungstabelle, die Grenzen der Ursprungsableitung, bekannte Einschränkungen und eine Reihenfolge zur Fehlerdiagnose,
  wobei die beiden Umschalter oben in den Dateien aufeinander verweisen.
- `docs/DESIGN.md`: der Datenvertrag, die wichtigsten Trade-offs und die aufgetretenen Fallstricke (Multi-Frame-zstd, das Envelope, Modul-Generation-Caching, der Konfigurationsseiten-Mechanismus und so weiter).
- `docs/research/`: frühe Recherchenotizen und wiederverwendbare Sondierungsskripte für Sitzungsprotokolle.
- `docs/` wird nicht veröffentlicht: die `files`-Whitelist enthält jetzt einen expliziten `!docs`-Eintrag (npms `files` unterstützt
  Negation, während eine root-`.npmignore` `files` nicht überschreiben kann, sodass Negation die Form ist, die funktioniert).
- Recherchenotizen geschwärzt: Maschinenpfade wie `C:\Users\<user>` werden als `%USERPROFILE%` / `$DSH_HOME` geschrieben,
  echte Einträge zitieren das Benutzerverzeichnis als `<user>`, und die Konvention steht oben in der Dokumentation.

### Bekannte Einschränkungen

- Desktop und Web lassen sich in lokalen Daten **nicht unterscheiden** und werden zu „desktop · web“ zusammengefasst.
- Die Fenstergranularität wird auf die Stunde gerundet (die Protokolle enthalten keine Marker auf Minutebene).
- Die Karte hat keinen Pushkanal und verlässt sich auf einen stillen Aktualisierungstimer alle 5 Minuten; um eine Konfigurationsänderung sofort zu sehen, öffnen Sie das Dashboard und klicken Sie „Aktualisieren“.
- Importierte historische Sitzungen (wie die reasonix-Migration) haben alle eine Nutzung von 0; das sind gültige Daten und werden nicht geschätzt.

### Kompatibilität

- **Getestete Umgebung: DSH Desktop `0.1.7-rc.2`** (`@deepseek-ai/dsh-desktop@0.1.7-rc.2`), Windows 11 Pro
  Build 26200 (AMD64), Node v25.2.1. Plugin-Aktivierung, Karte in der Seitenleiste, Dashboard, Konfigurationskarte auf der Plugin-Seite, browser → Host RPC,
  und eine Abgleichung der Zahlen Feld für Feld gegen DSHs eigene Projektions-Cache bestanden alle die Verifikation — normale Nutzung auf 0.1.7-rc.2 ist gewährleistet.
- `engines.dsh` ist als `^0.1.7-rc.2` deklariert (zuvor `>=0.1.7-rc.2`, was einem Anspruch auf Kompatibilität mit 0.2/1.0 gleichkam, ohne Evidenz).
  Das Feld ist **deklarativ**: die offizielle Dokumentation sagt klar, dass eine deklarierte Range inkompatible Hosts nicht ablehnt.
- Frühere DSH-Releases haben möglicherweise den `plugins.bundle.config`-Slot und den `configEditor`-Dienst nicht, den dieses Plugin nutzt; neuere Versionen wurden nicht getestet.
- Das gemessene Ergebnis steht auch in zwei Anzeigetexten: der `description` in `package.json` und der `meta.description` der Locale.
  Der Grund ist, dass die Plugin-Liste-Schnittstelle (`listBundles`) die **Datei-URL** von `package.json` an `readPluginMeta` übergibt,
  und die offizielle Dokumentation sagt „Dateipfade und Datei-URLs liefern keine Metadaten“, sodass auf diesem Weg nur die Beschreibung aus `package.json` wirkt
  (wie gemessen: jedes Bundle in der Liste hat nur eine `description` und kein `meta`); der Locale-Eintrag wird von UI-Wegen benutzt, die Metadaten per Paketnamen auflösen können.

### Verifikation

- Das Fold-Ergebnis stimmt **DSHs eigener Projektions-Cache** Feld für Feld (`session-5964a5d3-*`: `286650 / 182633 / 43826560 / 0`).
- Die Zusammenfassung ist selbst-konsistent: die Tag-/Modell-Dimensionen addieren sich wieder auf die Summe; die täglichen und stündlichen Millisekunden-Intervalle partitionieren die Summe exakt;
  der Kalender partitioniert exakt nach Ursprung; jede Fenster-Zusammenfassung ist ≤ dem kumulativen Wert; `hours=99` / `days=-3` werden begrenzt.
- Die Wire-Deskriptoren auf beiden Seiten stimmen Feld für Feld überein (drei Endpunkte), und der Parameter-Codec akzeptiert die Werte, die der Browser tatsächlich sendet.
- Rendering besteht mit einem fake React/DOM in einer Umgebung ohne Browser (was beide Kartenformen, das Konfigurationsformular, die Kalenderstruktur und beide Fallbacks abdeckt).
- Nach der Installation `fiberPhase: active`, und sowohl `sidebar.footer.action` als auch `main` sind registriert.
- 23 Tests insgesamt, mit `npm test` vollständig grün. **Das visuelle Erscheinungsbild und die endgültigen Zahlen brauchen eine manuelle Bestätigung** (diese Umgebung hat keine Browsersteuerung).

---

## Anhang: Commit-Index

Release 0.1.0 besteht aus den folgenden Commits (`git log --reverse`, bis `2b4be69`):

| Commit | Zeit | Inhalt |
|---|---|---|
| `9b46227` | 15:01 | Host-seitige Token-Aggregation über lokale Sitzungsprotokolle und die Remote-Schnittstellen der Nutzung |
| `3b63332` | 15:02 | Nutzungs-Karte in der Seitenleiste und zentrales Token-Dashboard |
| `5407357` | 15:02 | Aggregations-Golden-Abgleich und browserlose Client-Smoke-Tests |
| `6d6408e` | 15:02 | README, Designnotizen und frühe Recherchenotizen |
| `7d66caa` | 15:58 | Das `{ok,value}`-Envelope und der Panel-Höhen-Collapse behoben |
| `61f272d` | 16:04 | Trace der Host-Aktivierungskette und Fehlersuche-Dokumentation |
| `5ad18db` | 16:48 | Fenster der offiziellen Config-Konfigurationskarte, Index auf Stunden verfeinert |
| `dda8906` | 16:49 | Hinweise korrigiert, wie Konfiguration wirkt (Konfigurationsänderungen laufen über `fiber.restart`) |
| `3a593c5` | 16:58 | Client fällt auf den kumulativen Wert zurück, wenn dem Host `card` fehlt |
| `2ae0a20` | 19:00 | Eingebautes Konfigurationsformular auf der Plugin-Seite (hours/days) |
| `e104dc2` | 19:31 | Aktivitäts-Heatmap überarbeitet (Kalendersemantik, Achsen, Quantil-Farbskala, Metrikumschalter) |
| `2b4be69` | 09:20 | Paketname auf einen gescopeten geändert und die npm-Veröffentlichungsmetadaten vervollständigt (Veröffentlichungsvorbereitung) |
