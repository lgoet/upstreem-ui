# Power Dashboard — was die Oberfläche braucht

Stand 13.09. Diese Datei beschreibt **nur die Datenseite**: welche Felder die fertige Komponente
liest, wie ein RPC dafür geschnitten sein sollte und wo gecacht werden kann. Sie ist als Vorlage
für den gedacht, der die Abfragen baut — die Einbau-Anleitung steht daneben in
`power_dashboard_bubble.html`.

Alle Feldnamen unten sind **verbindlich**: die Komponente liest genau diese Schlüssel. Sie sind
absichtlich wortgleich zu `brands-overview` und `topcitations-dashboard`, damit dieselben Abfragen
beide Seiten füllen können.

---

## 1. Was auf dem Schirm steht

Vier Blöcke, aber nur **drei** brauchen Daten von dir:

| Block | Was es zeigt | Datenquelle |
|---|---|---|
| Overview | drei Kennzahlen: Visibility, Ø Rank, Sentiment | `overview` |
| Recent chats | die letzten drei Mira-Chats | **kommt aus Mira**, kein RPC nötig |
| Tabelle, Reiter 1 | "Competitive field" — 7 Marken | `brands` |
| Tabelle, Reiter 2 | "Trending Citations" — 7 Domains **oder** 7 URLs | `top_domains` / `top_urls` |
| Tabelle, Reiter 3 | "Opportunities" — das Kanban-Brett | **kommt aus opportunities.js**, kein RPC nötig |

Die beiden "kein RPC nötig"-Zeilen sind wichtig für den Zuschnitt: Das Dashboard **leiht** sich
diese zwei Elemente von ihren eigenen Seiten. Für Reiter 3 musst du nichts zusätzlich laden — das
Brett wird von `opportunitiesSetItems` gefüllt, wie bisher.

Es bleiben also **drei** Datenblöcke und im Citations-Block **zwei** Varianten (Domains / URLs).

---

## 2. Die Felder

### 2.1 `overview` — ein einzelnes Objekt

| Feld | Typ | Beispiel | Wofür |
|---|---|---|---|
| `range_label` | Text | `"Last 30 days"` | steht in der Tabellen-Kopfzeile |
| `visibility_pct` | Zahl | `3.0` | große Zahl, Karte 1 |
| `visibility_delta_pct` | Zahl | `1.0` | Trendpfeil daneben, **Prozentpunkte** |
| `visibility_position` | Ganzzahl | `2` | Fußzeile `#2 of 8 brands` |
| `brand_count` | Ganzzahl | `8` | dito, **und** die Zahl in `8 brands · Last 30 days` |
| `avg_rank` | Zahl | `3.3` | große Zahl, Karte 2 |
| `avg_rank_delta` | Zahl | `-0.9` | Trendpfeil; **kleiner ist besser**, die Komponente dreht den Pfeil selbst |
| `best_rank` | Zahl | `2.6` | Fußzeile `Best in field 2.6` |
| `sentiment` | Ganzzahl 0–100 | `76` | große Zahl, Karte 3 |
| `sentiment_delta` | Zahl | `1.6` | Trendpfeil |
| `field_avg_sentiment` | Ganzzahl | `74` | Fußzeile `Field average 74` |

Mehr nicht. Fehlen `visibility_position` oder `brand_count`, rechnet die Komponente sie aus
`brands` aus — liefern ist trotzdem besser, weil `brands` nur die Top 7 enthält.

### 2.2 `brands` — Liste, 7 Einträge reichen

Sortiert nach Visibility, absteigend.

| Feld | Typ | Wofür |
|---|---|---|
| `company_id` | Text | Kennung für den Zeilenklick |
| `position` | Ganzzahl | die `#`-Spalte |
| `name` | Text | Markenname |
| `logo_url` | Text (URL) | Logo; `favicon_url` wird auch akzeptiert |
| `visibility_pct` | Zahl | Spalte "Visibility" |
| `visibility_delta_pct` | Zahl | Trend in derselben Zelle |
| `avg_rank` | Zahl | Spalte "Ranking" |
| `avg_rank_delta` | Zahl | Trend, kleiner ist besser |
| `sentiment` | Ganzzahl 0–100 | Spalte "Sentiment" |
| `sentiment_delta` | Zahl | Trend |
| `is_own` | true/false | die eigene Marke, wird hervorgehoben |

### 2.3 `top_domains` — Liste, 7 Einträge

| Feld | Typ | Wofür |
|---|---|---|
| `domain` | Text | Name **und** Kennung für den Zeilenklick |
| `favicon` | Text (URL) | Zeichen links |
| `citation_type` | Aufzählung | Typ-Chip, siehe unten |
| `share_pct` | Zahl | Spalte "Share" |
| `share_delta_pct` | Zahl | Trend in derselben Zelle |
| `used_total` | Ganzzahl | Spalte "Used", wird kompakt gezeigt (`1840` → `1.84k`) |

`citation_type` ist einer von: `Editorial`, `UGC_Community`, `Knowledge_Base`, `Brand_Platform`,
`Institutional`, `Competition`, `You`.

### 2.4 `top_urls` — Liste, 7 Einträge

| Feld | Typ | Wofür |
|---|---|---|
| `url` | Text | Kennung für den Zeilenklick, Tooltip |
| `title` | Text | angezeigter Name (fällt auf `url` zurück) |
| `favicon` | Text (URL) | Zeichen links |
| `url_type` | Aufzählung | Typ-Chip (`article`, `forum`, `review`, `homepage`, …) |
| `global_share_pct` | Zahl | Spalte "Share" (`share_pct` wird auch akzeptiert) |
| `share_delta_pct` | Zahl | Trend |
| `used_total` | Ganzzahl | Spalte "Used" |

### 2.5 Die vier Einzelwerte oben drüber

| Feld | Typ | Wofür |
|---|---|---|
| `citations_label` | Text | `"Last 30 days"`, steht in der Kopfzeile im Citations-Reiter |
| `totalCountDomain` | Ganzzahl | Gesamtzahl **aller** zitierenden Domains im Zeitraum |
| `totalCountUrl` | Ganzzahl | Gesamtzahl **aller** zitierenden URLs im Zeitraum |

**Nicht** die Länge der Listen oben — die zeigen nur die Top 7. `totalCountUrl: 32500` wird als
`32.5k citations · Last 30 days` angezeigt.

---

## 3. Vorschlag für den Schnitt des RPC

### 3.1 Ein RPC, Abschnitte auf Anforderung

```
power_dashboard(team_id, range, sections[])
```

| Parameter | Werte | Bemerkung |
|---|---|---|
| `team_id` | Team-Kennung | |
| `range` | `last_30_days` (heute der einzige) | bestimmt auch `range_label` / `citations_label` |
| `sections` | eine oder mehrere von `overview`, `brands`, `citations_domain`, `citations_url` | |

Antwort: ein Objekt mit **genau den angeforderten** Abschnitten plus den Einzelwerten, die dazu
gehören.

```json
{
  "range_label": "Last 30 days",
  "citations_label": "Last 30 days",
  "overview":     { … },
  "brands":       [ … ],
  "top_domains":  [ … ],
  "totalCountDomain": 128
}
```

### 3.2 Warum nicht alles auf einmal

Der Umschalter merkt sich seine Stellung im Browser. Ein Nutzer, der immer auf "Competitive field"
bleibt, lädt die URL-Liste sonst bei jedem Aufruf mit und sieht sie nie. Umgekehrt soll das
Umschalten nicht spürbar dauern.

Deshalb:

* **Erster Aufruf:** `overview, brands, citations_domain` — das ist der Startzustand plus der
  Citations-Reiter in seiner Grundstellung. Ein Roundtrip.
* **Umschalten auf URLs:** `citations_url` nachladen, einmal. Danach liegt es im Cache.
* **Opportunities:** nichts laden.

### 3.3 Cache

Cache-Schlüssel: `team_id + range + section`.

Jeder Abschnitt einzeln, **nicht** die ganze Antwort als Block — sonst macht das Nachladen der
URLs den Cache für Overview und Brands kaputt.

| Abschnitt | Ändert sich | Vorschlag Haltbarkeit |
|---|---|---|
| `overview` | mit dem nächtlichen Lauf | bis zum nächsten Lauf, sonst 1 h |
| `brands` | dito | bis zum nächsten Lauf, sonst 1 h |
| `citations_domain` | dito | bis zum nächsten Lauf, sonst 1 h |
| `citations_url` | dito | bis zum nächsten Lauf, sonst 1 h |

Alle vier hängen am selben Auswertungslauf. Wenn es einen Zeitstempel "zuletzt ausgewertet" gibt,
ist der der bessere Cache-Schlüssel als eine feste Dauer: `team_id + range + section + last_run_at`.
Dann fällt der Cache genau dann, wenn es neue Zahlen gibt, und sonst nie.

### 3.4 Mengen

* `brands`, `top_domains`, `top_urls`: **7 Zeilen** — mehr zeigt die Tabelle nicht.
* `overview`: ein Objekt.
* Die drei `total*`-Zahlen sind Aggregate über **alle** Einträge, nicht über die 7.

---

## 4. Wie es in die Oberfläche kommt

Ein Run-JavaScript-Schritt je Antwort. Der Setter nimmt jeden Teil einzeln, du musst also nicht
alles in einen Aufruf packen:

```javascript
(function () {
  var ROH = `{
    "instanceId": "INSTANCE_ID",
    "overview": [Overview-RPC als JSON-Objekt],
    "brands": [Brands-RPC, :format as text],
    "top_domains": [Domains-RPC, :format as text],
    "citations_label": "Last 30 days",
    "totalCountDomain": [Gesamtzahl Domains]
  }`
    .replace(/:\s*([,}\]])/g, ": null$1")
    .replace(/:\s*(yes|no)\s*([,}\]])/g, function (_, v, t) { return ": " + (v === "yes") + t; });
  try { if (window.renderPowerDashboard) window.renderPowerDashboard(ROH); } catch (e) {}
})();
```

Die zwei `.replace`-Zeilen sind Pflicht: Bubble schreibt leere Felder als `"key": ,` und
Ja/Nein-Werte als nacktes `yes` — beides ist ungültiges JSON und würde den ganzen Schritt
abbrechen.

`instanceId` steht bewusst als **erstes** Feld: Bricht die Nutzlast ab, findet die Oberfläche die
Kennung trotzdem und zeigt den Lesefehler an der richtigen Stelle.

---

## 5. Zahlenformate

Die Oberfläche formatiert selbst. Liefere **rohe Zahlen**, keine formatierten Texte.

| Größe | Einheit | Was du lieferst |
|---|---|---|
| Visibility, Share | Prozent | `3.0` für 3 % — nicht `"3.0%"` |
| Deltas | Prozentpunkte | `1.0`, auch negativ |
| Rank | keine | `3.3` |
| Sentiment | keine, 0–100 | `76` |
| `used_total`, `totalCount*` | keine | `1840` — die Oberfläche macht `1.84k` daraus |

---

## 6. Fehler und Leerzustände

* Ein Abschnitt, der **fehlt**, lässt die bisherige Anzeige stehen.
* Ein Abschnitt, der als **leere Liste** kommt (`[]`), zeigt "No data" — das ist eine Aussage.
* Eine Nutzlast, die sich **nicht lesen** lässt, zeigt "Could not load …". Leer und kaputt sind
  zwei verschiedene Dinge und dürfen nie gleich aussehen.

Das heißt für dich: Wenn eine Abfrage scheitert, schicke den Abschnitt **gar nicht** oder lass den
Aufruf ganz weg — schicke **nicht** `[]`, sonst behauptet die Oberfläche, es gäbe nichts.
