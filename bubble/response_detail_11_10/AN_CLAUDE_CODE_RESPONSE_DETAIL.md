# An Claude Code: Response Detail v1 ist gebaut (11.10.2026)

Lukas spielt `response_detail_v1.sql` ein. Die Vorgeschichte und die Befunde stehen in `RESPONSE_DETAIL_V1_VORSCHLAG.md`. Echte, ungekürzte Antworten liegen in `response_detail_v1_echte_antworten.json`: ChatGPT, Google AIO, Perplexity, eine mit Produkten und Ads, eine ohne Quellen, dazu jede Fehlerform.

## Aufruf
`POST /rest/v1/rpc/response_detail_v1`
- Header: `Content-Profile: app` und das Nutzer-JWT.
- Body: `{ "p_team": "<uuid>", "p_prompt_run_id": "<uuid>" }`

Antwort (reines JSON, kein Umschlag, keine verdoppelten Backslashes):
```
{ meta: { team_id, prompt_run_id, data_as_of },
  row:  { prompt_run_id, id, run_at, run_day, model, model_detailed, model_display_name,
          prompt_id, prompt_text, market,
          tags[]            // [] wenn keine Topics (v8 lieferte [{id:null…}])
          response_json { text, meta }
          companies[]       // wie v8: eine Zeile je Nennung, neu: role, logo_url
          brands[]          // NEU: eine Zeile je Marke, für Zähler und Pills
          citations[]       // wie v8, feste Reihenfolge
          shopping_products_count, shopping_products[], ads[]   // wie v8
} }
```

## Was neu oder anders ist
- **`brands[]`:** Daraus entstehen „Brands mentioned“ (Anzahl = Länge) und je Marke eine Pill.
  - Felder: `company_id`, `name`, `role` ('own'/'competitor'), `logo_url`, `favicon_url`, `rank` (bester Rang), `ranks[]`, `mentions` (Anzahl Nennungen), `sentiment` (Mittel, 0–100).
  - Sortiert nach bestem Rang.
- **`logo_url` folgt der Logo-Regel:**
  - Eigene Marke: Logo-Override, sonst Favicon. Ein Override, das mit `//` beginnt, kommt mit `https:` davor.
  - Wettbewerber: immer Favicon.
  - `favicon_url` ist unverändert wie in v8.
- **`rank`:** Der Rang zählt alle Marken der Antwort, auch nicht getrackte. Er beginnt deshalb oft bei 2 oder höher. So anzeigen, nicht neu zählen.
- **Reihenfolge von `citations[]`:**
  - zuerst Quellen, die die eigene Marke erwähnen;
  - dann solche mit Wettbewerbern;
  - dann der Rest;
  - jeweils nach Domain, dann URL.
- **`citations[].mentions[]`:** Diese Seite hat die Marke irgendwann erwähnt (Team-weit, nicht nur in diesem Lauf). `count` ist immer 1, `match_type` immer null.
- **Zitat-Chips im Text:** Links im Antworttext tragen `?utm_source=chatgpt.com` und teils `/` am Ende. Vor dem Vergleich mit `citations[].url` die `utm_*`-Parameter und das `/` am Ende entfernen.
- **Nur getrackte Marken:**
  - `companies[]`/`brands[]` enthalten nur heute getrackte Marken.
  - Archivierte Wettbewerber fehlen auch in alten Antworten; so von Lukas entschieden.
  - Name und Logo kommen aus dem heutigen Stand.
- **Fremder Text:**
  - Antworttext, Quellen-Titel und -Beschreibungen, Produkt- und Ad-Texte immer maskieren. In 170 Quellen-Titeln und -Beschreibungen stehen HTML-Reste wie `<br>` oder `</a>`.
  - Links nur öffnen bei http(s), Bilder nur zeigen bei https. Es gibt 778 Quellen mit http, 5 ohne Schema und eine mit dem Text `null`.

## Fehler (`message` = Code)
| SQLSTATE | message | hint | Drawer |
|---|---|---|---|
| 28000 | `settings_not_authenticated` | – | Anmeldung |
| 42501 | `team_forbidden` | – | „Kein Zugriff“ |
| PT404 | `team_deleted` | – | „Team gelöscht“ |
| PT402 | `team_access_<state>` | Zustand | Hinweis auf Abo |
| 22023 | `team_invalid_param` | `p_team` / `p_prompt_run_id` | – |
| PT404 | `response_not_found` | – | „Antwort nicht gefunden“, auch bei einer ID aus einem fremden Team |
| PT429 | `response_rate_limited` | Sekunden | kurz warten, erneut laden |

**Ratenlimit:** 120 Aufrufe je Minute und Nutzer.

**Laufzeit:** 10–70 ms für normale Antworten. Bis 260 ms bei 99 Quellen (ca. 80 KB). Kalt, also wenn die Daten nicht im Speicher liegen, einzelne Aufrufe bis wenige Sekunden.

**Empfehlung für den Drawer:** Den Lade-Zustand zeigen und beim schnellen Durchklicken alte Anfragen abbrechen (AbortController).

## Alt bleibt
`get_mention_detail_v8` bleibt für Bubble unverändert. `get_mention_detail_v7` (Shopping, Events in Bubble) prüft nach `alte_mention_detail_zugang.sql` zusätzlich den Zugang.
