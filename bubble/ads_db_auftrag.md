# Auftrag an den Datenbank-Chat: Ads V1, Domain und Topic-Farben (Stand 05.10.2026)

Diesen ganzen Text in den Datenbank-Chat geben. Er setzt den Vertrag aus `ADS_V1_RPCS.md` voraus
(die sechs Lese-RPCs im Schema `app`, Rückgabe `RETURNS TABLE("json" text)`). Es gelten dieselben
Arbeitsregeln wie im großen Auftrag (`datenbank_auftrag.md`, Abschnitt 0): nichts raten, erst
Bestandsaufnahme mit `pg_get_functiondef`, jede Änderung als vollständiges `create or replace` mit
alter Definition als Rückweg und einer Testabfrage. **Felder kommen nur dazu, keins wird
umbenannt oder entfernt.**

Das Frontend ist für alle drei Punkte schon fertig und liest die neuen Felder, sobald sie da sind.
Fehlen sie, läuft alles wie heute weiter (Rückfall unten jeweils beschrieben).

---

## 1. Eine Domain je Werbetreibendem: Feld `domain`

**Warum.** Die Oberfläche zeigt Werbetreibende als Logo-Chip. Für getrackte Firmen kommt das Logo
aus `logo_url`. Für alle anderen (`company_id` null, z. B. "MyProtein" in den Übergabedaten) gibt es
heute **kein** Feld, aus dem sich ein Favicon bauen ließe, also steht dort der Anfangsbuchstabe.
Die Advertiser-Objekte tragen keine Domain; nur die einzelnen Ads tragen ihre `landing_domain`.

**Übergangslösung im Frontend (bis dieses Feld kommt):** Die Komponente nimmt die Landing-Domain,
die bei den bereits geladenen Ads dieses Werbetreibenden am häufigsten vorkommt. Das hat zwei
Lücken: Werbetreibende, deren Ads noch nicht geladen sind, bleiben Buchstaben, und eine Ad, die auf
einen Händler verlinkt (Landing-Domain `amazon.de` für eine Marke), würde das Händler-Favicon
zeigen. Beides behebt nur die Datenbank.

**Was zu tun ist.** Ein Feld `domain` (Text, nackter Host in Kleinbuchstaben, ohne `www.`, ohne
Protokoll und Pfad, z. B. `"myprotein.com"`; `null`, wenn es keine gibt) an diesen Stellen:

| RPC | Objekt | neben |
|---|---|---|
| `list_ads_advertisers_v1` | jedes Element von `items` | `advertiser_name`, `logo_url` |
| `get_ads_overview_v1` | jedes Element von `advertiser_share` | `advertiser_name`, `company_id` |
| `get_ads_filter_options_v1` | jedes Element von `advertisers` | `value`, `label`, `count` |
| `get_ads_advertiser_detail_v1` | `advertiser` | `landing_domains` (bleibt) |

**Woher der Wert kommt**, in dieser Reihenfolge:

1. Ist der Werbetreibende eine getrackte Firma (`company_id` gesetzt): die Domain dieser Firma.
   Welche Spalte das ist, **nachsehen, nicht raten**; `logo_url` ist heute schon
   `https://www.google.com/s2/favicons?domain=<host>`, die Quelle dieses Hosts ist die richtige.
2. Sonst die häufigste `landing_domain` aller beobachteten Ads dieses Werbetreibenden im Team,
   **über die ganze Historie, nicht nur den gewählten Zeitraum** (sonst wechselt das Logo mit dem
   Kalender). Bei Gleichstand die alphabetisch erste, damit der Wert stabil bleibt.
3. Sonst `null`.

Normalisierung in SQL: `lower()`, führendes `www.` weg, alles ab `/`, `?`, `#` und `:` weg.

**Test:** `list_ads_advertisers_v1` für das Testteam
(`877c649c-f5f2-44e9-bb04-155f5bf44e70`, letzte 30 Tage). Erwartet: HOLY trägt `"holy.com"`,
More Nutrition `"morenutrition.de"`, MyProtein einen Host (nicht `null`), sofern es Ads mit
Landing-Domain hat.

---

## 2. Topic-Farbe und Emoji an jedem Topic-Objekt

**Warum.** Topics erscheinen in der Ads-Seite als der farbige Topic-Chip der App (wie in der
Prompts-Tabelle). Die Topic-Objekte der Ads-RPCs tragen heute nur `topic_id` und `topic_name`.

**Übergangslösung im Frontend:** Farbe und Emoji kommen über die `topic_id` aus dem Topic-Speicher
der Seite (`setUpstreemTopics`, läuft auf jeder Seite). Das funktioniert, solange die Topic dort
steht. Eine gelöschte oder fremde Topic bleibt grau.

**Was zu tun ist.** An **jedem** Topic-Objekt dieser Stellen drei Felder dazu, mit genau den Namen
und Werten, die `setUpstreemTopics` heute schon liefert (dieselbe Tabelle, dieselben Spalten):

| Feld | Inhalt |
|---|---|
| `hex_light` | Farbe im hellen Thema, `#rrggbb` |
| `hex_dark` | Farbe im dunklen Thema, `#rrggbb` |
| `emoji` | das Emoji der Topic oder `null` |

Stellen: `get_ads_overview_v1.topics[]`, `topics[]` in jedem Ad-Objekt (`recent_ads`, `ads`,
`items` der Library), `list_ads_prompts_v1.items[].topics[]`,
`get_ads_advertiser_detail_v1.prompts[].topics[]`. In `get_ads_filter_options_v1.topics[]` (Form
`value`/`label`/`count`) dürfen sie ebenfalls dazu.

**Test:** `get_ads_overview_v1` für das Testteam. Erwartet: jedes Element von `topics` trägt
`hex_light` und `hex_dark` wie in der Topic-Tabelle.

---

## 3. `prompt_run_id`: nichts zu tun, nur bestätigen

Jedes Ad-Objekt trägt laut Vertrag `prompt_run_id`. Die Oberfläche öffnet damit jetzt aus dem
Ad-Drawer die zugehörige Antwort ("View Response"), mit demselben Aufruf wie Shopping.
**Bitte nur bestätigen:** `prompt_run_id` in den Ads-RPCs ist dieselbe Id wie
`prompt_run_id` in den Shopping-RPCs (die Id des Laufs, die der Response-Drawer erwartet), und
sie ist in den Daten nie leer. Keine Änderung, wenn beides stimmt.

---

## 4. Härtung des Textes (falls noch nicht geschehen)

Bubble setzt jede Antwort in ein JavaScript-Backtick. Darin zerstören drei Zeichen in einem Wert
den ganzen Schritt: ein Backtick, die Folge `${` und ein einzelner Backslash. Am Ende jeder der
sechs RPCs, direkt vor der Rückgabe:

```sql
return query select replace(replace(replace(t, chr(92), chr(92) || chr(92)), chr(96), ''), '${', '$ {');
```

(`t` ist der fertige JSON-Text.) Gemessen am Prüfstand: ein `${x}` in einem Ad-Titel lässt heute
den ganzen Run-JS-Schritt mit "x is not defined" sterben.
