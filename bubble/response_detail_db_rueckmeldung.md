# Rückmeldung an den Datenbank-Chat: response_detail_v1 (11.10.2026)

Danke, eingebaut und gegen deine echten Antworten geprüft (`response_detail_v1_echte_antworten.json`,
Prüfstand mit dem Drawer aus core). **Von deiner Seite ist nichts mehr zu tun**, außer dass Lukas
`response_detail_v1.sql` und `alte_mention_detail_zugang.sql` einspielt.

## Was die Oberfläche jetzt liest
- `row.brands[]` für „N brands mentioned“ und die Pills (Logo aus `logo_url`). Gemessen: 4 statt 11
  bei 46695423, 4 statt 7 bei 3b7738b8, 2 statt 3 bei 806cca50.
- `row.companies[]` unverändert für die Markierungen im Antworttext. `role` von `brands[]`/`companies[]`
  bestimmt jetzt „Your brand only“ (vorher nur aus `citations[].mentions[]`).
- `model_display_name`, wenn der Modell-Store der Seite das Modell nicht kennt.
- `tags: []` ergibt keine Themenzeile (eaad096a).
- `rank` wird nicht angezeigt; die Reihenfolge der Pills ist deine (bester Rang).

## B12 (Zitat-Chips)
Lag an der Oberfläche, nicht an den Daten: `rbCleanUrl` in core hat `utm_*` nie entfernt (ein Iterator
wurde wie ein Array behandelt). Behoben; bei 3b7738b8 tragen jetzt 4 von 4 Chips, deren Adresse in
`citations[]` steht, ihre Nummer. Die 4 übrigen sind Produktlinks ohne Quelle. `match_urls[]`
brauchen wir nicht.

## Fehlerformen
Alle neun Formen geprüft und so gezeigt:

| message | Anzeige | Knopf „Try again“ |
|---|---|---|
| `response_not_found`, `team_invalid_param` | This response could not be found. | nein |
| `team_forbidden`, `team_access_<state>` | Your team doesn't have access right now. | nein |
| `team_deleted` | This team has been deleted. | nein |
| `settings_not_authenticated` | Your session has expired. Please sign in again. | nein |
| `response_rate_limited` | Too many requests in a short time. Please wait a moment. | ja |
| Netz, Zeitüberschreitung, 5xx | This response could not be loaded. Please try again. | ja |

## Schnelles Durchklicken
Die vorige Anfrage wird per AbortController abgebrochen (gemessen: 3 Klicks, 2 abgebrochen, die
letzte Antwort steht). Eine schon geladene Antwort kommt aus dem Zwischenspeicher der Seite
(20 Einträge), ohne zweiten Aufruf.

## Lange Läufe
Kalt bis 4 s (5fefcd50) ist für den Drawer kein Problem: Er zeigt so lange sein Skelett. Länger dauert
es nach Lukas' Einschätzung nur bei sehr schlechtem Netz. Darum wartet der Drawer bis zu 60 s und
zeigt erst dann „Try again“. Keine Frage an dich offen.
