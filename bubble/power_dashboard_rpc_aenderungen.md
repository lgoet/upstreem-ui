# Änderungen am Power-Dashboard-RPC (Stand 14.09.)

Kurzer Nachtrag an den, der den RPC gebaut hat. Die Oberfläche unter den Kennzahlen wurde
umgebaut: Statt **einer großen Tabelle mit drei Reitern** stehen dort jetzt **zwei schmale Listen
nebeneinander**, und ein Umschalter wechselt zwischen diesen Listen ("Main Metrics") und dem
Opportunities-Brett.

**Die Antwortstruktur bleibt, wie sie ist.** Kein Feld wird umbenannt, kein Abschnitt fällt weg.
Es ändert sich nur, *wie viel* gebraucht wird — und eine Kleinigkeit an `brands`.

---

## 1. `brands`: vier Felder werden nicht mehr gelesen

Die linke Liste zeigt nur noch Logo, Name, Visibility und deren Trend. Rang und Sentiment sind aus
der Anzeige verschwunden.

Nicht mehr nötig:

```
avg_rank, avg_rank_delta, sentiment, sentiment_delta
```

Sie dürfen drinbleiben (sie stören nicht), aber wenn ihre Berechnung Aufwand kostet, kann sie für
diesen RPC entfallen. **`overview` behält seine Rang- und Sentiment-Felder** — die drei Kennzahlen
oben zeigen sie weiterhin.

## 2. `brands`: Menge und `position`

Die Liste zeigt **fünf** Zeilen. Steht die eigene Marke weiter hinten, hängt die Oberfläche sie
unten an und schreibt ihre echte Position davor.

Damit das geht, braucht sie:

* **`is_own: true`** an der eigenen Marke — sonst kann sie nicht erkannt werden;
* **`position`** als Rang in der **vollständigen** Rangliste, nicht als Index der gelieferten
  Liste. Steht die eigene Marke auf Platz 9, muss dort `9` stehen.

Liefere deshalb entweder **Top 5 plus die eigene Marke** oder einfach **Top 10** — die Oberfläche
schneidet selbst auf fünf zu und hängt die eigene an. Nur die Top 5 allein reicht nicht: Dann
fehlt die eigene Marke ab Platz 6, und genau sie ist der Grund, warum jemand hinsieht.

## 3. `top_domains` / `top_urls`: fünf statt sieben

Beide Listen zeigen **5** Einträge. Mehr zu liefern schadet nicht, wird aber abgeschnitten.

## 4. `data-needs-fn`: `needs` ist jetzt eine Liste

Das Ereignis, mit dem die Oberfläche sagt, welche Abschnitte sie braucht, hat eine neue Nutzlast:

```json
{ "mode": "metrics",       "needs": ["brands", "citations_domain"] }
{ "mode": "metrics",       "needs": ["brands", "citations_url"] }
{ "mode": "opportunities", "needs": ["opportunities"] }
```

Vorher war `needs` ein einzelner Wert und das Feld daneben hieß `tab`. Der Grund für die Liste:
"Main Metrics" zeigt **beide** Listen gleichzeitig, braucht also immer Marken **und**
Zitierungen — anders als vorher, wo je nach Reiter nur eines davon sichtbar war.

Der Workflow muss deshalb über `needs` **iterieren** und die fehlenden Abschnitte nachladen,
statt einen einzelnen Wert zu prüfen.

## 5. Was sich dadurch beim Laden ändert

Unverändert beim Seitenladen:

```
sections = [overview, brands, citations_domain, chats]
```

`citations_url` kommt weiterhin erst, wenn jemand auf URLs umschaltet; `opportunities`, wenn der
Bereich gewählt wird (oder beim Laden, falls er gespeichert war).

## 6. Vier Felder werden nicht mehr angezeigt — zwei davon sind teuer

Alle vier trugen die Kopfzeile **"8 brands · Last 30 days"** bzw. **"32.5k citations · 7 days"**
über der großen Tabelle. Diese Kopfzeile ist mit der Tabelle weggefallen; neben "Overview" stand
der Zeitraum schon vorher nicht mehr.

| Feld | Kostet | Empfehlung |
|---|---|---|
| `range_label` | nichts | kann bleiben |
| `citations_label` | nichts | kann bleiben |
| **`totalCountDomain`** | ein `COUNT` über **alle** zitierenden Domains des Zeitraums | **weglassen** |
| **`totalCountUrl`** | ein `COUNT` über **alle** zitierenden URLs des Zeitraums | **weglassen** |

Die zwei `COUNT`s sind der Punkt: Sie zählen über den ganzen Zeitraum, nicht über die fünf
gezeigten Zeilen, und niemand sieht das Ergebnis mehr. Wenn sie in der Abfrage Aufwand machen,
können sie ersatzlos raus.

Die Oberfläche nimmt alle vier weiterhin entgegen und hebt sie auf, falls sie wieder gezeigt
werden sollen — sie verwirft nichts stillschweigend.

**`overview.brand_count` bleibt dagegen nötig**: Es füllt die Fußzeile "All 8 brands" unter der
linken Liste.

## 7. Unverändert

* `overview` — die zehn Zahlenfelder, inklusive Rang und Sentiment (die drei Kennzahlen oben
  zeigen sie weiter) und `brand_count` für die Fußzeile
* `chats`, `chat_projects`, `opportunities` — Felder und Setter wie gehabt
* der `errors`-Block je Abschnitt — er wird inzwischen ausgewertet und zeigt im betroffenen
  Bereich "Could not load …" statt einer leeren Liste
* die Cache-Regeln, insbesondere der Chat-Cache über `user_id + max(updated_at)`

---

## 8. `chats.preview` bitte weglassen (15.09.)

Der RPC liefert je Chat ein `preview` — die ersten ~200 Zeichen der letzten Antwort. Das Feld
steht **in keiner Spezifikation** und wird **von keiner Komponente gelesen** (nachgesehen in
`ask-mira.js` und `power-dashboard.js`). Die Chatliste braucht drei Felder:

```json
{ "id": "…", "title": "…", "updated_at": "2026-09-14T10:00:00Z" }
```

Dazu optional `project_id`, `project_title`, `status`, `is_pinned` für Miras eigene Leiste.

Zwei Gründe, warum es weg soll:

1. **Es hat den Run-JS-Schritt getötet.** Der Vorschautext kommt aus einem Sprachmodell, und ein
   Modell setzt Backticks um URLs. Der Bubble-Ausdruck wird wörtlich in den JS-Quelltext gesetzt;
   ein Backtick beendet dort die Zeichenkette, und der Schritt stirbt beim Einlesen —
   `Uncaught SyntaxError: missing ) after argument list`. Das ist im Schritt nicht zu heilen.
2. **Es ist der größte Teil der Nutzlast.** 50 Chats × ~200 Zeichen, für nichts.

## 9. `opportunities.headline` / `.reason`: Backticks entfernen

Diese zwei **werden** angezeigt und sind ebenfalls Modelltext. Sie können bleiben, sollen aber
keinen rohen Backtick tragen:

```sql
replace(o.headline, chr(96), '')
replace(o.reason,   chr(96), '')
```

Alles andere — Anführungszeichen, Apostrophe, Umlaute, Zeilenumbrüche, Emoji — ist unkritisch,
das repariert `UC.readBubble` in der Komponente.
