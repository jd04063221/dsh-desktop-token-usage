# dsh-desktop-token-usage

[English](https://github.com/jd04063221/dsh-desktop-token-usage/blob/main/README.md) | [中文](https://github.com/jd04063221/dsh-desktop-token-usage/blob/main/README-zh.md) | [繁體中文（臺灣）](https://github.com/jd04063221/dsh-desktop-token-usage/blob/main/README-zh-TW.md) | [繁體中文（香港）](https://github.com/jd04063221/dsh-desktop-token-usage/blob/main/README-zh-HK.md) | Deutsch | [Français](https://github.com/jd04063221/dsh-desktop-token-usage/blob/main/README-fr.md) | [Español](https://github.com/jd04063221/dsh-desktop-token-usage/blob/main/README-es.md) | [Italiano](https://github.com/jd04063221/dsh-desktop-token-usage/blob/main/README-it.md) | [日本語](https://github.com/jd04063221/dsh-desktop-token-usage/blob/main/README-ja.md) | [한국어](https://github.com/jd04063221/dsh-desktop-token-usage/blob/main/README-ko.md)

Ein **vollständig offline** funktionierendes Statistik-Plugin für die Token-Nutzung in DSH (DeepSeek Harness).

- Die **Host-Hälfte** scannt `$DSH_HOME/sessions/**/session.vN.jsonl.zstd` und faltet die tatsächliche Token-Nutzung heraus;
- Die **Client-Hälfte** montiert eine Nutzungs-Karte am Fuß der linken Seitenleiste; ein Klick darauf öffnet ein Dashboard im zentralen
  Panel: Zeitraum- und Quellfilter, 6 Statistikkarten, eine Zeile der konfigurierten Fenster, eine Aktivitäts-Heatmap, einen täglichen Token-
  Verlauf (eine über die Token-Balken gelegte Cache-Trefferquote-Kurve, reale Prozentwerte rechts beschriftet, die Y-Achse um
  10% über das Min/Max des Zeitraums gepolstert) und ein Kreisdiagramm der Modellnutzung mit Liste.

Welche Zeiträume die Karte und die Zeile **Konfigurierte Fenster** des Dashboards meldet, entscheidet die **Plugin-
Konfiguration** (beide Fenster sind standardmäßig aus): unter **Einstellungen → Plugins → `Token 用量`** (Token-Nutzung) können Sie
ein Fenster „letzte N Stunden“ (0-23) und ein Fenster „letzte N Tage“ (1-30) unabhängig voneinander aktivieren; schalten Sie beide aus, fällt
jede Oberfläche auf einen einzigen kumulativen Block zurück.
Diese Fenster sind reale Uhrzeit-Nähe und ignorieren bewusst den Quellfilter des Dashboards; deshalb stehen sie in einer eigenen Zeile
und nicht unter den Statistikkarten, die dem Filter folgen.
Dieselbe Einstellungsseite wählt auch die **Gruppierung** — nach Modell, nach Anbieter oder beides (bei „beides“ bekommen der Verlaufs-
abschnitt und der Aufschlüsselungsabschnitt, `Nutzungsaufschlüsselung`, jeweils einen umschaltbaren Chip) — und die **Farbpalette** — Primer,
Farbenblind-freundlich oder Gedämpft, jeweils mit einem hellen und einem dunklen Satz, der DSHs eigenen Hell/Dunkel-Schalter folgt
(`body[data-ds-dark-theme]`), damit die Diagramme nie vom Shell abweichen.

Die Fußzeile der Seitenleiste ist eine einzelne horizontale Zeile, die sie sich mit jedem anderen dort registrierten Plugin teilt, und jedes
davon deklariert `width: 100%` — zwei können sie sich also nicht teilen. Live gemessen und ohne Eingriff wird diese Karte auf
105.2px zusammengedrückt. Die Karte macht deshalb aus dieser Zeile eine **Spalte** (`[class*="_footerActions"]:has(.dtu-footCard)` — gematcht
über den Klassensuffix plus `:has()`, damit nichts von DSHs gehashten Klassennamen abhängt und kein Vorfahre berührt wird), wodurch
jedem Plugin in diesem Platz die volle Breite gegeben wird, für die es geschrieben wurde; diese Karte spannt die vollen 256px. Es ist `flex-direction`
statt `flex-wrap`, weil das Shell jeden Slot in ein `display: contents`-Element wrapt — ein Selektor für direkte Kinder
trifft den Platz nie — und weil `flex-wrap` auf einem Spalten-Platz „beginne eine weitere Spalte“ bedeutet, was die Karte
stattdessen neben ihren Nachbarn schieben würde. Das braucht `:has()`; siehe die Kompatibilitätstabelle unten.

Kein Netzwerkzugriff, keine Telemetrie, keine API-Aufrufe: jede Zahl stammt aus Sitzungsprotokollen, die bereits auf Ihrem Rechner liegen.

## Screenshots

Mit den eigenen Komponenten dieses Plugins und **Beispieldaten** gerendert — die Aufnahmen entstehen offline über
[`scripts/render-shots.mjs`](scripts/render-shots.mjs) (das echte `client.js` und CSS gegen einen fake Host) plus
[`scripts/render-shots.py`](scripts/render-shots.py) (headless Chrome), daher sind keine Sitzungsprotokolle, Pfade oder
Kontodetails involviert. Heller Modus zuerst, dunkler Modus danach. Die Aufnahmen sind auf Chinesisch gerendert — das erste Skript nimmt
`--locale <id>`, um eine andere Sprache zu rendern — und alle zehn Sprachvarianten dieses README teilen sich denselben Bildsatz.

![Dashboard, heller Modus](assets/dashboard-light.png)

Sechs Statistikkarten, die Zeile der konfigurierten Fenster, die Aktivitäts-Heatmap, der tägliche Token-Verlauf mit der über die Balken
gelegten Cache-Trefferquote-Kurve und die Aufschlüsselung der Modellnutzung.

![Dashboard, dunkler Modus](assets/dashboard-dark.png)

Dasselbe Dashboard im dunklen Modus — jede Palette liefert einen hellen und einen dunklen Satz.

| Aktivitäts-Heatmap | Täglicher Verlauf |
|---|---|
| ![Aktivitäts-Heatmap](assets/heatmap-light.png) | ![Täglicher Verlauf](assets/trend-light.png) |

| Die Karte in der Seitenleiste | Ihre Seite im Plugin-Manager |
|---|---|
| ![Karte in der Seitenleiste](assets/sidebar-dark.png) | ![Einstellungen](assets/settings-light.png) |

Die Karte am Fuß der Seitenleiste zeigt die beiden konfigurierten Fenster; ein Klick darauf öffnet das obige Dashboard. Die Seite des
Plugins im Plugin-Manager enthält die Fenster-Zeiträume, die Gruppierung und die Palette.

## Kompatibilität und getestete Umgebung

**Vollständig verifiziert auf DSH Desktop 0.1.7-rc.2 und 0.2.0-rc.2, auf Kompatibilität mit 0.2.0-rc.1 geprüft.**

| Element | Getestete Umgebung |
|---|---|
| DSH | Desktop `0.1.7-rc.2` und `0.2.0-rc.2` (volle Verifikation), `0.2.0-rc.1` (Kompatibilitätsprüfung) |
| Mitgelieferte Laufzeit | Electron 44 / Chromium 152 / Node 24.18.1 (der Platz wird erst durch `:has()` zur Spalte, Chrome 105+; Palette-Theming braucht `light-dark()`, Chrome 123+) |
| Betriebssystem | Windows 11 Pro, Build 26200, AMD64 |
| Node (für die Tests) | v25.2.1, v26.7.0 |

Die Verifikation ging weit über „es installiert sich“ hinaus: Plugin-Aktivierung, die `fiberPhase: active` erreicht, Rendering von Karte und
zentralem Dashboard, die auf der Plugin-Seite mitgelieferte Konfigurationskarte, die les- und schreibbar ist, die
browser → Host Remote-Aufrufe, die Ende-zu-Ende funktionieren, und jedes Feld, das in einer Kreuzprüfung mit DSHs eigener Projektions-Cache übereinstimmt.

Für `0.2.0-rc.1` war die Prüfung strukturell statt eines zweiten vollständigen Laufs. Jedes veröffentlichte Paket, das dieses Plugin berührt,
wurde gegen `0.1.7-rc.2` gedifft: `dsh-plugin-manager` ist byte-identisch, und in `dsh-client-ui-sidebar`,
`dsh-client-ui-layout` und `dsh-client-ui-cordis` unterscheiden sich nur der Versionsstring, ein Analytics-Aufruf und Titelbalken-CSS.
Der `sidebar.footer.action`-Slot-Vertrag und seine `{ wide }`-Owner-Props sind unverändert, und die Pakete, die dieses Plugin
importiert (`dsh-api-remotes`, `dsh-client-ui-layout`, `dsh-client-ui-sidebar`), behalten ihre Namen. Ein manueller Versuch auf
`0.2.0-rc.1` meldet, dass Dashboard und Remote-Aufrufe funktionieren; auf `0.2.0-rc.2` folgte dann der vollständige Lauf auf
der Entwicklungsmaschine dieses Plugins: Aktivierung bis `fiberPhase: active`, Karte und Dashboard mit echten
Remote-Aufrufen (`calls.json`) und die in `boot.json` wirksamen Fenster passend zum Profile.

Dieses Plugin deklariert **keine** `@deepseek-ai/dsh*` Peer-Abhängigkeit, und genau das validiert DSH tatsächlich — ein fehlender
Peer-Bereich legt überhaupt keine Versionsbeschränkung fest. `engines.dsh` ist als `^0.1.7-rc.2 || ^0.2.0-rc.1` deklariert, nur für Menschen:
die offizielle Dokumentation sagt klar, dass eine deklarierte Range inkompatible Hosts nicht ablehnt.

**Andere Versionen als in der Tabelle oben sind ungetestet.** Frühere DSH-Builds können den `plugins.bundle.config`-Slot und
den `configEditor`-Dienst fehlen, den dieses Plugin nutzt (ohne sie gibt es keine Konfigurationskarte, und die Konfiguration lässt sich nur von Hand
im Profil-Patch ändern); Builds neuer als `0.2.0-rc.2` wurden noch nicht verifiziert.

## Was es auf die Festplatte schreibt

Das Plugin liest Sitzungsprotokolle und schreibt nur in ein eigenes Verzeichnis:
`$DSH_HOME/cache/dsh-desktop-token-usage/`. Neben einem Sitzungsprotokoll wird nichts geschrieben, sonst nirgends unter
`$DSH_HOME` wird etwas erstellt, geändert oder gelöscht, und es wird nie auf das Netzwerk zugegriffen.

| Datei in diesem Verzeichnis | Geschrieben von | Zweck | Zum Abschalten |
|---|---|---|---|
| `sessions-index.json` | `lib/session-usage.js` | Fold-Cache pro Sitzung, damit ein warmer Aufruf nicht jedes `session.vN.jsonl.zstd` neu scannt | Löschen; beim nächsten Aufruf wird sie neu aufgebaut |
| `calls.json` | `index.js` | Diagnose: die letzten 20 Remote-Aufrufe | `DSH_TOKEN_USAGE_DIAG=0` |
| `boot.json` | `index.js` | Diagnose: wann der Fiber zuletzt angewendet wurde | `DSH_TOKEN_USAGE_DIAG=0` |

Beide Schreiber sind **atomar**: sie legen einen `<name>.<pid>.tmp`-Bruder an und benennen ihn über das Ziel um, sodass ein gleichzeitiger
Leser nie eine unvollständige Datei sieht und ein getöteter Prozess keine abgeschnittene hinterlassen kann. Der Index ist auf 800
Einträge begrenzt (älteste fallen raus, bei Bedarf neu gescannt), und eine `.tmp`, die ein Absturz hinterlassen hat, wird beim nächsten Schreiben aufgeräumt.

## Installation

Dieses Repository ist ein DSH-Bundle (`package.json` deklariert `dsh.bundle.patch` und `dsh.client`). Installieren Sie es über den
offiziellen Einstiegspunkt; ein manuelles Bearbeiten von Profildateien ist nicht nötig. Das Paket ist in der offiziellen npm-Registry
veröffentlicht, der Paketname genügt also — der Manager löst ihn in der Registry auf und installiert es in das aktuelle
Profile:

```
plugin_manager  action: install_bundle  target: dsh-desktop-token-usage
```

Für eine Installation aus einem lokalen Verzeichnis (etwa um einen noch unveröffentlichten `main`-Stand zu fahren) zeigen
Sie `install_bundle` stattdessen auf den absoluten Pfad dieses Verzeichnisses.

```
plugin_manager  action: install_bundle  target: <absolute path to this directory>
```

Weil dieses Paket von `@deepseek-ai/schemastery` abhängt (die Schema-Bibliothek, die die offizielle Config-Karte braucht), und
`install_bundle` für lokale Verzeichnisse eine `link:`-Installation verwendet und **keine** Abhängigkeiten für verlinkte
Pakete installiert, installieren Sie zuerst einmal innerhalb dieses Repositories:

```
npm install            # installs dev/runtime dependencies only, no network data
```

### Nach Code-Änderungen: Der Client lädt hot neu, der Host braucht einen Neustart

| Welche Hälfte Sie geändert haben | Wie es wirkt |
|---|---|
| `client.js` (UI) | Der seitliche Modul-Snapshot wird per HMR auf die Seite geschoben, sobald sich mtime/size ändert; wenn es nicht wirkt, einmal hart neu laden (Ctrl/Cmd+Shift+R) |
| `index.js` / `lib/*` (Host) | **DSH muss neu gestartet werden**: Das erneute Aktivieren des Eintrags montiert nur den Fiber neu, er importiert die zwischengespeicherte JS-Modul-Generation nicht neu. Ebenso erfordert das Hinzufügen oder Ändern von `Config`-Feldern einen Neustart, bevor sie in den Einstellungen erscheinen |

Um zu erkennen, welche Version gerade läuft: prüfen Sie, ob `$DSH_HOME/cache/dsh-desktop-token-usage/boot.json` existiert und
ob `windows` den Erwartungen entspricht.

Deinstallation: `plugin_manager action: remove_bundle target: dsh-desktop-token-usage`.

> Der Paketname und die **Zeilen-id** des Plugins sind zwei verschiedene Dinge: die Zeilen-id ist `dsh-desktop-token-usage` (der Anker für
> Konfigurations-Überschreibungen im Profil), und der Paketname ist `dsh-desktop-token-usage`. Nutzen Sie den Paketnamen
> zum De- und Installieren, und die Zeilen-id, um die Konfiguration zu ändern.

## Verwendung

1. Sehen Sie sich die Karte am **unteren Ende der linken Seitenleiste**, über den Einstellungen an: sie zeigt das Eingabe-/Ausgabevolumen
   und die Cache-Trefferquote jedes Fensters gemäß Ihrer Konfiguration;
2. Klicken Sie sie an → das Dashboard öffnet sich im zentralen Panel;
3. Oben im Dashboard können Sie nach **Zeitraum** (letzte 7/14/30/90 Tage, alle, benutzerdefiniert) und nach **Quelle** filtern;
   ein Aktualisieren-Knopf sitzt unten rechts.

Filtern und Aggregieren passieren im Host: jede Änderung sendet eine frische Aggregationsanfrage an den Host (der
Host hält einen Index-Cache, der nach Datei-Mtime+size schlüsselt, daher liegen warme Aufrufe im Bereich von einigen hundert Millisekunden). Die Karte
aktualisiert sich still alle 5 Minuten — das Stundenfenster rutscht ohnehin mit der Uhr, sollte sich also auch dann
aktualisieren, wenn keine neue Nutzung anfällt.

### Die Aktivitäts-Heatmap lesen

- Es ist ein **Kalender** (montag-ausgerichtet, die letzten 53 Wochen) mit **Monats**- und **Wochentags**-Achsen; die Zellen teilen sich
  die Breite der Karte, dehnen sich also mit ihr und bleiben quadratisch (11px sind die Referenzgröße);
- Die Farbskala nutzt **Quartile über Tage mit Nicht-Null-Wert**, nicht „Tag ÷ Maximum“ — beim Letzten drückt ein einziger
  außergewöhnlich großer Tag alles andere in denselben Grauton;
- Der Kopf schaltet zwischen **Tokens / Runden** um; standardmäßig wird die Dimension gewählt, die **mehr Tage mit Daten** hat (auf einem
  Rechner mit viel importierter Historie sind Tokens spärlich, sodass eine Token-Darstellung als Standard fast ein leeres
  Raster ergeben würde);
- Sie **folgt dem Quellfilter, wird aber nicht vom Zeitraum beeinflusst**: ein auf 7 Tage heruntergefilterter Kalender hieße
  „7 beleuchtete Zellen in einem Jahresraster“, und genau so darf eine Heatmap nicht aussehen.

## Lokalisierung

Das Dashboard folgt **DSHs eigener Spracheinstellung**. Es hat keinen eigenen Sprachwähler: Ändern Sie die Sprache in
DSH, und das Dashboard schaltet sofort und ohne Neuladen um.

- `en` und `zh` sind DSHs eingebaute Locales, und dieses Plugin liefert für beide ein Wörterbuch;
- Die folgenden Sprachpakete werden in DSHs Katalog registriert und erscheinen daher in dessen eigenem Wähler: `zh-TW`
  (臺灣正體), `zh-HK` (香港繁體), `de`, `fr`, `es`, `it`, `ja` und `ko`. Die sechs übrigen Codes — `pt-BR`, `ru`,
  `vi`, `th`, `id` und `ar` (rechts-nach-links) — sind entworfen, aber noch nicht implementiert; siehe
  [das Design](docs/superpowers/specs/2026-10-01-i18n-design.md);
- Texte liegen in `locales/<id>.json`, eine flache Datei pro Sprache, und werden mit
  `node scripts/build-dicts.mjs` in `client.js` erzeugt. Bearbeiten Sie den erzeugten Block nie von Hand — `npm test` scheitert, solange er veraltet ist;
- Zahlen, Prozentwerte, Daten, Wochentags- und Monatsnamen und Pluralformen stammen alle aus `Intl`, sodass eine Sprache, die
  Tausender anders gruppiert, wo Englisch `K`/`M`/`B` schreibt `萬`/`億` schreibt oder ihre Pluralformen beugt,
  korrekt dasteht;
- `README-<id>.md` und `CHANGELOG-<id>.md` tragen beide Dokumente in jeder der zehn Sprachen. Sie bleiben für
  GitHub im Repository; npm zeigt nur `README.md`.

## Konfiguration

Bearbeiten Sie diese auf der Seite **Plugins → `Token 用量`** (Token-Nutzung) — der Eintrag `Plugins` in der Seitenleiste → `Token 用量`:
in der Seitenmitte zeichnet das Plugin seine eigene Karte — das Stunden-Feld, das Tage-Feld, die Auswahl für Gruppierung und Palette
und einen Speichern-Knopf.

DSH erzeugt **keinen** Editor automatisch aus dem `Config`-Schema — ein Plugin, das eigene Konfiguration mitbringt, muss das
Formular in den `plugins.bundle.config`-Slot rendern (adressiert über den Paketnamen). Genau das tut dieses Plugin:
beim Speichern ruft es den offiziellen `configEditor` auf, und die Werte landen im `cordis.patch.yml` des Profils, sodass Sie
sie dort auch direkt schreiben können:

```yaml
- id: dsh-desktop-token-usage
  disabled: false
  config:
    hours: 6
    days: 7
```

| Schlüssel | Standard | Beschreibung |
|---|---|---|
| `hours` | `0` | Wie viele Stunden der Abschnitt Konfigurierte Fenster meldet (0-23). `0` = dieses Fenster ausschalten |
| `days` | `0` | Wie viele Tage der Abschnitt Konfigurierte Fenster meldet (1-30). `0` = dieses Fenster ausschalten |

Wenn beide aus sind (Standard), zeigt die Karte kumulative Werte, genau wie vor dem Bestehen dieser beiden Parameter. Fenster
runden in der **lokalen Zeit** auf die Stunde: „letzte 6 Stunden“ bedeutet ab dem Anfang der Stunde vor 6 Stunden.

Änderungen wirken **sofort** nach dem Speichern: Cordis' `fiber.update()` startet den Fiber dieses Plugins neu, und `apply`
läuft mit der neuen Konfiguration erneut (Sie müssen DSH also nie neu starten, um einen Wert zu ändern); nach dem Speichern liest das
Formular die Konfiguration neu und aktualisiert die Karte automatisch.


## Datensemantik

Dieser Abschnitt ist wichtig — was die Zahlen bedeuten, wird vollständig durch DSHs Logsemantik bestimmt.

| Kennzahl | Definition |
|---|---|
| Token-Nutzung | `uncached input + output + cache read + cache write` |
| **Eingabevolumen** (Karte) | `uncached input + cache read` — also jeder Prompt-Token, den der Anbieter tatsächlich erhalten hat |
| **Ausgabevolumen** (Karte) | `usage.outputTokens` (`reasoningTokens` ist eine **Teilmenge** davon und wird nie doppelt gezählt) |
| Ungecachte Eingabe | `usage.inputTokens` — **in den nativen Feldern des Anbieters ist das bereits der Teil, der den Cache verfehlt hat**; DSHs eigene Projektion benennt ihn in `uncachedInputTokens` um |
| Cache-Lesung / -Schreibung | `usage.cacheReadTokens` / `usage.cacheWriteTokens` |
| Durchschnittliche Cache-Trefferquote | `cache read ÷ (cache read + uncached input + cache write)` — die Fehltreffer-Seite enthält auch Cache-Schreibungen |
| Anzahl der Anfragen | Anzahl der Modellaufrufe nach der Abrechnung (siehe „fold“ unten) |
| Abgeschlossene Runden | Anzahl der `turn/end`-Ereignisse |
| Nach Modell gruppieren | Das **letzte Segment** der Modell-id: ein Modell kommt als `deepseek/deepseek-v4.1-flash` von `commandcode` und als `deepseek-v4.1-flash` von `opencode-go` an, und beide folden in eine Zeile; die Gruppierung nach Anbieter trennt die beiden weiterhin |

**Fold-Semantik (hier ist es leicht, die Rechnung falsch zu machen)**: innerhalb desselben `(turn, step)` **ersetzt** ein späterer Nutzungs-
eintrag den früheren — die Streaming-Zahlen werden von der finalen Abrechnung überschrieben; erst wenn
`llm/retry-started` den Slot schließt, **addiert** ein weiterer Retry-Aufruf auf. „Total = Summe aller Nutzung“ ist also falsch; man
muss folden. Die Fold-Logik dieses Plugins entspricht Zeile für Zeile der `tokenUsage`-Projektion in
`dsh-token-meter` und ist durch Kreuzprüfungstests abgedeckt.

### Warum der Quellfilter nur drei Optionen hat

Die Sitzungsprotokolle von DSH 0.1.7-rc.2 haben **kein** Feld für die „Client-Quelle“: `SessionHeader` trägt nur
`version/id/createdAt/cwd/parentSession/isSeeded/origin/delegationDepth/agentPreset`, und der einzige Wert, den `origin`
je annimmt, ist `'subagent'`. Desktop und Web lassen sich mit lokalen Daten nicht unterscheiden. Das Dashboard bietet deshalb nur
die drei Optionen, die **aus lokalen Signalen ableitbar** sind:

| Label | Wie es bestimmt wird |
|---|---|
| Desktop · Web | Es gibt eine echte Nutzerrunde (`user/message` mit `source.kind ∈ {user, user-approval}`) und sie trägt `source.rpcId` |
| CLI · Bots | Es gibt eine echte Nutzerrunde, aber **kein** `rpcId` (headless / SDK / ACP / Bots und dergleichen, ohne treibenden Client) |
| Subagenten | `header.origin === 'subagent'` oder `delegationDepth > 0` |

Sitzungen ohne jede Nutzerrunde (z. B. solche, die nur Slash-Befehle ausführten), zählen zu `Alle` (alle) und werden
nicht einzeln aufgeführt.

## Bekannte Einschränkungen

- **Die erste Aggregation ist langsam**: bei etwa 150 Sitzungsdateien und 90,000+ Einträgen dauert ein Kaltstart etwa
  3–4 Sekunden; danach geht es inkrementell über den Datei-Fingerabdruck, mit warmen Aufrufen im Bereich von einigen hundert Millisekunden.
  Der Cache wird nach `$DSH_HOME/cache/dsh-desktop-token-usage/sessions-index.json` geschrieben; ihn zu löschen macht nur den nächsten Lauf
  langsamer.
- **Importierte historische Sitzungen können Null-Nutzung melden**: wenn eine historische Sitzung importiert wurde (z. B. eine reasonix-Migration,
  etwa), sind ihre Nutzungsfelder wirklich alle 0. Das sind gültige Daten, keine fehlenden Daten, und dieses Plugin
  schätzt sie nicht hoch.
- **Nur zehn Sprachen sind übersetzt**: Das Dashboard folgt DSHs Spracheinstellung, aber seine Texte decken noch nicht
  jede Sprache ab, auf die DSH eingestellt werden kann; der Abschnitt Lokalisierung oben nennt die sechs, die noch fehlen.
- **Fenster runden auf die Stunde**: die Protokolle haben keine Minuten-Buckets, daher richtet sich „letzte 1 Stunde“ auf den Anfang der
  Stunde aus.
- **Die Karte aktualisiert sich mit Verzögerung**: Es gibt keinen Host→Client-Pushkanal, deshalb verlässt sich die Karte auf einen stillen 5-Minuten-
  Aktualisierungstimer; wenn Sie gerade die Konfiguration geändert haben oder sofort eine Aktualisierung wollen, klicken Sie die Karte an, um das
  Dashboard zu öffnen, und drücken Sie `Aktualisieren`.

## Verifizierungsstatus

Bisher abgeschlossene Verifikation (siehe den Abschnitt „verification evidence“ in `docs/DESIGN.md`):

- Das gefaltete Ergebnis stimmt **DSHs eigener Projektions-Cache** Feld für Feld überein (`session-5964a5d3-*`: `286650 / 182633 / 43826560 / 0`);
- Sowohl die Tages- als auch die Modell-Zusammenfassungen addieren sich wieder auf die Summe, und die Millisekunden-Bereiche pro Tag/Stunde partitionieren die Summe exakt;
- Fenster-Zusammenfassungen der Karte: jedes Fenster kann nur kleiner oder gleich dem kumulativen Wert sein, die Eingabe/Ausgabe-Aufteilung geht auf, und Parameter außerhalb des Bereichs (`hours=99`/`days=-3`) werden begrenzt;
- Das `Config`-Schema validiert über die Standard-Schema-Schnittstelle: Standard 0/0, während `hours=24` und `days=31` abgelehnt werden;
- Host-Deskriptor und Client-Beitrag werden in den Tests **Feld für Feld gekreuzt geprüft**, und der Parameter-Codec akzeptiert die Werte, die der Browser tatsächlich sendet;
- Beide Client-Hälften rendern in einer Umgebung ohne Browser mit einem fake React/DOM (was die Fenster-Zeile der Karte und den kumulativen Fallback abdeckt), mit Assertions auf Style-Injection und Unmounting;
- Nach der Installation hat `include:dsh-desktop-token-usage` `fiberPhase` = `active`, und `dsh-desktop-token-usage` erscheint in beiden,
  `sidebar.footer.action` und `main` (`active: true`);
- Der Browser → Host RPC-Pfad funktioniert nachweislich (der Host-seitige Index wird nach dem Aufruf durch die Seite neu geschrieben).

**Bestätigt / braucht noch Ihre Bestätigung**:

1. **Der Host-seitige Konfigurationspfad ist Ende-zu-Ende verifiziert**: `Config.listConfigs` meldet `status: schema`
   für dieses Plugin (`id: include:dsh-desktop-token-usage`, `name` ist der Paketname); nach Neustart des Fibers ist `boot.json`s
   `windows` gleich der im Profil konfigurierten `{hours:5, days:1}` — sowohl das Lesen der Konfiguration als auch das Schreiben
   zurück über `configEditor` funktionieren unter dem gescopeten Paketnamen korrekt.
2. **Der Client braucht weiterhin einen harten Seiten-Neustart** (Ctrl/Cmd+Shift+R): die Konfigurationskarte in der Mitte der Plugin-Seite
   wird vom Client registriert (`plugins.bundle.config` ist nach dem **Paketnamen** schlüsselig), und ein neues Client-Modul muss
   geladen werden, bevor sie erscheint.
3. **Die Host-Modul-Generation braucht weiterhin einen Neustart**: Node cached ESM nach aufgelöstem realpath, sodass das Bearbeiten von Dateien — oder
   sogar das Umbenennen des Pakets — es nicht neu importiert; praktisch ist
   `import('dsh-desktop-token-usage') === import('dsh-desktop-token-usage')` dieselbe Modul-Instanz. Also kann neuer Host-Code
   wie das `payload.heatmap`, von dem die Heatmap abhängt, nur durch Neustart geladen werden; bis dahin greift der Client den
   Fallback „fehlendes `heatmap`“.
4. Die Optik des Dashboards (einschließlich der überarbeiteten Heatmap) braucht Ihr eigenes Auge — diese Umgebung hat keine Browser-
   steuerung.

### Wo Sie suchen, wenn etwas kaputtgeht

Zwei Selbstdiagnose-Dateien liegen unter `$DSH_HOME/cache/dsh-desktop-token-usage/`:

- `boot.json`: die Host-Aktivierungskette (`appliedAt`/`injectedAt`/`providedAt`/`registeredAt`) und die aktiven
  `windows`; falls es ein `error` gibt, sagt es, an welchem Schritt es hing. Jedes `apply` überschreibt sie, sodass `appliedAt` der
  Zeitpunkt des letzten Remounts des Fibers ist; aber **sie kann nicht beweisen, dass Sie den neuesten Code laufen** — Dateien
  zu bearbeiten importiert Module nicht neu, nur ein Neustart.
- `calls.json`: die letzten 20 Dashboard-Anfragen (Filter, Fenster, Sitzungsanzahl, Gesamt-Tokens, vergangene Zeit).
  **Ein Eintrag beweist, dass der Browser → Host-Pfad funktioniert; das Fehlen von Einträgen beweist für sich genommen nicht, dass der Pfad kaputt ist** (die Datei
  wurde möglicherweise einfach gelöscht), lesen Sie sie also zusammen mit `boot.json`; falls es wirklich nie einen Eintrag gab, wurde das
  Client-Modul wahrscheinlich nie geladen — **laden Sie die Seite hart neu** (Ctrl/Cmd+Shift+R).

Außerdem sagt Ihnen das `status` von `Config.listConfigs` direkt, ob das Modul des aktuellen Fibers `Config` exportiert:
`absent` = eine alte Modul-Generation (auf der Plugin-Seite wird es keine Konfigurationskarte geben); `schema` = ein schemastery-
Schema wurde erkannt (der Fall dieses Plugins). Beachten Sie, dass `schema` nur bedeutet, dass es **validiert werden kann**; die
Konfigurations-UI wird weiterhin vom Plugin selbst in die Plugin-Seite gerendert (siehe „Konfiguration“ oben), und DSH wird
kein Formular aus dem Schema erzeugen.
Ein Client, der älter ist als der Host, verursacht ebenfalls Probleme — deshalb **fällt der Client auf kumulative Werte zurück**, wenn er
das `card`-Feld nicht bekommt, statt auf „wird geladen“ zu bleiben.

## Entwicklung

```
npm install     # installs @deepseek-ai/schemastery (a link install does not install dependencies for linked packages)
npm test        # node --test: aggregation golden cross-check + window summaries + browserless client smoke tests
```

Die Tests führen auch `apply` aus, und wenn sie Diagnosedateien schreiben, zeigen sie auf ein temporäres Verzeichnis
(`DSH_TOKEN_USAGE_DIAG_DIR`) und überschreiben nicht die beiden Dateien, die Sie unter
`$DSH_HOME/cache/dsh-desktop-token-usage/` untersuchen wollen.

Struktur:

```
index.js                     Host half: Config (schemastery) + registration of the usage Remote service
client.js                    Client half: window __ModuleLoader__ factory + dashboard and sidebar entry
lib/session-usage.js         Pure Node aggregation: multi-frame zstd reading, folding, hourly bucketing, window summaries, index cache
test/session-usage.test.mjs  Aggregation, millisecond ranges, card windows, calendar, Config schema, Remote service
test/client-smoke.test.mjs   Client factory / slot registration / two-half wire-contract cross-check / rendering
docs/DESIGN.md               Design, data contracts, pitfalls hit, and verification evidence
docs/research/               Earlier research notes and reusable session-log probe scripts
CHANGELOG.md                 Version history (with a commit index)
```

Die Dokumente gibt es in zehn Sprachen: Englisch ist die Vorgabe (`README.md` / `CHANGELOG.md`), und jede andere Sprache hat
ihre eigenen `README-<id>.md` / `CHANGELOG-<id>.md`. Alle zehn werden über den Umschalter auf Zeile 3 jeder Datei verlinkt.

## Lizenz

MIT
