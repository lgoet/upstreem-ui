# Response Detail als selbstladender Drawer: Bestandsaufnahme, Prüfung, Vorschlag (11.10.2026)

In dieser Runde wurde nichts geändert. Alle Tests liefen in Transaktionen, die danach zurückgerollt wurden, im Team 877c als Owner.

Beilagen:
- `get_mention_detail_v8_definition.sql`: die vollständige Definition.
- `get_mention_detail_v8_beispiele.json`: echte Antworten. Eine Antwort mit Produkten und Ads ist ausgepackt; die Antwort ohne Quellen und Tags steht roh im Umschlag.

## 1. Kurzfassung der Befunde nach Schwere

| # | Schwere | Befund | Vorschlag |
|---|---|---|---|
| B1 | **hoch** | Die alten Versionen `get_mention_detail`, `_v6` und `_v7` prüfen nur die Mitgliedschaft, nicht den Zugang. Ein Team ohne Plan liest damit weiter Antworten; v8 sperrt das. Alle drei sind für `PUBLIC` ausführbar, `anon` scheitert erst an „not authenticated“. `_v7` ist `security definer` **ohne** festen `search_path`. | Die drei Versionen für `PUBLIC`/`anon`/`authenticated` sperren, nachdem geprüft ist, dass Bubble sie nicht mehr ruft. Das ist in `pg_stat_statements` nachzusehen; sonst kommen sie auf die Aufräumliste. |
| B2 | mittel | `tags` ist bei Prompts ohne Topic **`[{id:null, name:null, …}]`** statt `[]`. Das betrifft 3.635 von 16.350 Läufen in 877c (22 %). | In v1 `[]` liefern. |
| B3 | mittel | `companies[]` enthält **eine Zeile je Nennung, nicht je Marke**. Beispiel 3b7738b8: BMW steht dreimal (X5, X3, X7), Mercedes zweimal; 7 Zeilen, aber nur 4 Marken. Der Drawer zählt „Brands mentioned“ und zeigt je Marke eine Pill, das wäre falsch. | `companies[]` bleibt unverändert (Rang je Nennung). Neu kommt `brands[]` dazu: je Marke eine Zeile mit `rank` (bester), `mentions` (Anzahl), `sentiment` (Mittel) und `ranks[]`. |
| B4 | mittel | Die eigene Marke ist in `companies[]` **nicht erkennbar**, `role` fehlt. In `citations[].mentions[]` und `shopping_products[].brand.type` steht sie. | `role` ('own'/'competitor') ergänzen. |
| B5 | mittel | **Logo-Regel nicht eingehalten:** v8 nimmt überall `coalesce(logo_override_url, favicon_url)`, auch für Wettbewerber. Heute hat kein Wettbewerber ein Logo-Override, die Regel ist also nur zufällig erfüllt. Zwei Logo-Overrides beginnen mit `//…cdn.bubble.io` (ohne `https:`), z. B. bei Mercedes in 877c. Ein `<img>` lädt das, die Regel „nur https“ verwirft es. | `logo_url`: eigene Marke Override (mit `https:` ergänzt, wenn er mit `//` beginnt), sonst Favicon; Wettbewerber nur Favicon. `favicon_url` bleibt wie v8. |
| B6 | mittel | **Ratenlimit** über den alten `check_rate_limit` (Zähler-Tabelle, bekannte Deadlocks), **30 je Minute**. Das ist zu knapp, wenn man durch eine Liste klickt. Die Meldung ist ein englischer Text mit `P0001`. | Den neuen Limiter nehmen (`_pi_rate_limit_v1('response_detail', 120, 'response')`): 120 je Minute, `PT429 response_rate_limited`, hint Sekunden. |
| B7 | niedrig | **Fehlerformen nicht stabil:** `mention_not_found` (P0001), `forbidden` (42501), `team_access_no_plan` (P0403, nicht PT402), `not authenticated` (P0001). `require_team_access` ist `security definer` ohne `search_path`. | v1 nimmt die Settings-Bauart: `_set_require_v1` und die Codes aus Abschnitt 4. |
| B8 | niedrig | Die **Reihenfolge von `citations[]`** ist nicht festgelegt (`jsonb_agg` ohne `order by`) und kann sich zwischen zwei Aufrufen ändern. | Feste Reihenfolge: zuerst Quellen mit eigener Marke, dann mit Wettbewerbern, dann Rest; je Gruppe Domain, dann URL. |
| B9 | niedrig | `citations[].mentions[].count` ist immer 1 und `match_type` immer null. `mentions` sagt, dass die Seite die Marke irgendwann erwähnt hat (`url_company_mention` des Teams). Das gilt nicht nur für diesen Lauf. | Die Felder bleiben. Im Vertrag steht, was sie bedeuten. |
| B10 | niedrig | Archivierte Wettbewerber verschwinden aus alten Antworten: `companies[]` filtert über das **heutige** `team_company`. So sind Kompyte und Finseo seit heute bei upstreem in keiner alten Antwort mehr zu sehen. Name und Logo kommen ebenfalls aus dem heutigen Stand. | So lassen, denn alle Seiten zeigen nur getrackte Marken. Alternative: archivierte als `role:'inactive'` mitgeben. Das entscheidet Lukas. |
| B11 | niedrig | Der **Markt** kommt aus dem heutigen Prompt (`prompt.market`), nicht aus dem Lauf. Der Lauf speichert keinen Markt. | So lassen und im Vertrag vermerken. |
| B12 | info | Zitat-Chips: Links im Text tragen `?utm_source=chatgpt.com` und teils `/` am Ende. `citations[].url` hat beides nicht, z. B. `…/deals/luxury/?utm_source=chatgpt.com` gegenüber `…/deals/luxury`. | Beim Zuordnen von Text-Link zu Quelle in der Oberfläche normalisieren: Query `utm_*` und `/` am Ende weg. Alternativ liefert v1 je Quelle `match_urls[]`. |

**Ergebnis der Prüfung auf fremde Kennungen** (in Ordnung):
- Ein Lauf eines fremden Teams mit eigenem `p_team` ergibt `mention_not_found`. Das ist genau dieselbe Antwort wie bei einer zufälligen ID, es wird also nicht verraten, ob der Lauf existiert.
- Ein fremdes `p_team` ergibt `42501 forbidden`.
- `anon` ergibt `permission denied`.
- `null` ergibt `mention_not_found`.

## 2. Bestandsaufnahme

**Definition:** siehe Beilage. Merkmale:
- `security definer`, `search_path app, public`.
- Rechte: authenticated und service_role ja, anon nein.
- Ablauf: Ratenlimit, dann `require_team_access`, dann ein großes CTE, dann der Umschlag `js_json_envelope`. Der Umschlag ruft `js_safe` und verdoppelt danach alle Backslashes.

**Woher kommen `companies[]`?**
- Aus `recommendation` des Laufs, verbunden mit `team_company` und `role in ('own','competitor')`.
- Dabei sind nur heute getrackte Marken, keine anderen. Nicht getrackte Nennungen haben `company_id null`; das sind im Bestand 377.190 Zeilen in 877c.
- Sortiert nach `rank`. Der Rang zählt alle Marken der Antwort, auch nicht getrackte; deshalb beginnt er oft bei 2 oder 3 (Beispiel 7a418601: KIA #2, Toyota #3).
- Name: Override, sonst Firmenname.

**`favicon_url` der eigenen Marke:** Ja, das Logo-Override wird geliefert, siehe B5 (`//`-Adresse).

**`citations[].mentions[].role`:** Werte `own` und `competitor`; andere Rollen gibt es in `team_company` nicht. Sortiert wird `own` zuerst, dann nach Name.

**Woher kommen die Quellen?**
- Die Vereinigung aus `recommendation_citation`, `staged_citation_urls` (über `run_key`) und `citations_flat`. `citations_flat` ist bei allen Läufen der letzten 60 Tage leer.
- Der Titel ist auf 100 Zeichen gekürzt.
- Fehlt der Titel, gilt die Domain; fehlt die Beschreibung, gilt die URL.

**Laufzeit** (877c, Owner, über den SQL-Pfad):

| Lauf | Quellen | Text | Größe | erster Aufruf | danach |
|---|---|---|---|---|---|
| ChatGPT 7a418601 | 99 | 2,6k | 79 KB | 481 ms | 25 ms |
| Perplexity 9bc335d1 | 85 | 2,4k | 72 KB | 170 ms | – |
| Google AIO 3e7315af | 23 | 6,4k | 42 KB | 115 ms | – |
| ChatGPT längster Text 71ec0ccb | 5 | 22k | 29 KB | 249 ms | – |
| Produkte + Ads 3b7738b8 | 4 | 3,9k | 15 KB | 42 ms | – |
| ohne Quellen eaad096a | 0 | 76 | 0,7 KB | 20 ms | 2 ms |
| ohne Tags 5fefcd50, kalt | 1 | 1,1k | 3 KB | **4.194 ms** | 36 ms |

Kalt, also wenn die Daten nicht im Speicher liegen, kann ein Aufruf einzelne Sekunden dauern. Warm liegt er unter 0,5 s.

**Ratenlimit:** `mention_detail` 30 je Minute und Nutzer. Der 31. Aufruf scheitert mit `P0001 Rate limit exceeded…`.

**Modellname:** `llm_model_catalog.display_name` gibt es: chatgpt = ChatGPT, google-aio = Google AI Overviews, perplexity = Perplexity.

## 3. Prüfung

**Fremder Text:**
- Antworttexte: keine HTML-Tags, keine Steuerzeichen und kein `javascript:` in einer Stichprobe von 14.728 Läufen. Längster Text 11.860 Zeichen in der Stichprobe; im Bestand bis 22.450 (71ec0ccb). Das 99. Perzentil liegt bei 7.403 Zeichen.
- Quellen-Titel und -Beschreibungen: 170 enthalten HTML-Reste wie `<br>`, `</a>`, `<p>`, `<span>`. Davon enthält keine `<script>`, `on…=` oder `javascript:`. Längste Beschreibung 4.957 Zeichen, längster Titel 487 Zeichen; v8 kürzt den Titel auf 100.
- Produkte: kein HTML. Längen: Titel 61, Anbietertitel 150, Händler 37.
- Ads: kein HTML, keine Steuerzeichen. Längen: Titel 96, Beschreibung 812.
- Im Datenbestand gibt es keine Längenbegrenzung. v1 muss nichts kürzen; die Oberfläche maskiert.

**Adressen nach Schema:**

| Feld | https | http | anderes |
|---|---|---|---|
| `source_url.url` | 269.190 | 778 | 5 ohne Schema (`www.caranddriver.com/…`), 1 Zeile mit dem Text `null` |
| `source_domain.favicon` | 68.210 | 62 | – |
| `company.favicon_url` | 364 | – | – |
| `team_brand_profile.logo_override_url` | 4 | – | 2× `//…` |
| Produkt-Thumbnail / `image_urls` | 850 / 1.721 | – | – |
| `ad.url` / `ad.image_url` | 128 / 128 | – | – |

Kein `javascript:` und kein `data:`. Die Regel der Oberfläche (Links nur http(s), Bilder nur https) reicht. Für die 2 Logos mit `//` ergänzt v1 `https:`.

**Zugang:**
- v8 verlangt Zugang; ein Team ohne Plan bekommt `team_access_no_plan`.
- Vorschlag: so lassen. Eine Antwort ansehen ist Produktnutzung, anders als Settings und Billing.

**Kosten:**
- v8 holt nichts von außerhalb; Favicons sind fertige Adressen.
- v8 **schreibt beim Lesen**, aber nur den Ratenlimit-Zähler (`rate_limit`). Sonst schreibt es nichts.

## 4. Vorschlag `response_detail_v1(p_team uuid, p_prompt_run_id uuid)`
Bauart wie Settings v1:
- `security definer`, `search_path app, public, pg_temp`.
- Nur `authenticated` und `service_role`.
- Nutzer aus `auth.uid()`; Rückgabe ist reines `jsonb` ohne Umschlag.

**Ablauf:**
1. `_set_require_v1(p_team)`: Mitglied, Team nicht gelöscht.
2. Zugang prüfen; ohne Zugang `PT402 team_access_<state>`.
3. `_pi_rate_limit_v1('response_detail', 120, 'response')`.
4. Lauf laden, nur `team_id = p_team`.

**Antwort:**
```
{ meta: { team_id, prompt_run_id, data_as_of },
  row:  { …alle Felder von v8 unverändert…,
          tags: []                           // B2: leer statt [ {id:null…} ]
          companies[]: + role, + logo_url    // B4, B5
          brands[]: [{ company_id, name, role, logo_url, favicon_url,
                       rank, ranks[], mentions, sentiment }]   // B3, sortiert nach rank
          citations[]: feste Reihenfolge     // B8
          model_display_name }               // aus llm_model_catalog
}
```

**Fehler** (`message` = Code):

| SQLSTATE | message | hint |
|---|---|---|
| 28000 | `settings_not_authenticated` | – |
| 42501 | `team_forbidden` | – |
| PT404 | `team_deleted` | – |
| PT402 | `team_access_<state>` | Zustand |
| PT404 | `response_not_found` | – (auch bei fremdem Lauf) |
| 22023 | `team_invalid_param` | `p_team` / `p_prompt_run_id` |
| PT429 | `response_rate_limited` | Sekunden |

**Bleibt:** v8 bleibt, bis Bubble nichts mehr daraus liest.

**Zu B1:** Eine Sperre der Altversionen bekommst du als eigene kleine Datei mit Rückweg.

## 5. Zu entscheiden (Lukas)
1. **B10:** Archivierte Wettbewerber in alten Antworten weglassen (Vorschlag) oder als `inactive` zeigen?
2. **B3:** `brands[]` zusätzlich zu `companies[]` (Vorschlag), oder `companies[]` direkt je Marke zusammenfassen? Das zweite würde die Form ändern, die die Oberfläche heute liest.
3. **Ratenlimit:** 120 je Minute (Vorschlag)?

Nach Freigabe baue ich `response_detail_v1.sql` mit Rückweg. Dazu kommen echte, ungekürzte Antworten:
- je eine von ChatGPT, Google AIO und Perplexity;
- eine mit Produkten und Ads;
- eine ohne Quellen;
- jede Fehlerform einmal.

## 6. Gebaut (11.10.2026, nach Freigabe)
Entscheidungen:
- archivierte Wettbewerber weglassen;
- `brands[]` zusätzlich zu `companies[]`;
- 120 Aufrufe je Minute.

**Dateien (je als ein Block):**
1. `response_detail_v1.sql` (+ Rückweg): neue Funktion. Im Rollback getestet; Antworten in `response_detail_v1_echte_antworten.json`.
   - Gleiche Inhalte wie v8, geprüft an 3b7738b8: Text, Produkte, Ads, Quellen-Menge und `companies` ohne die neuen Felder sind identisch.
2. `alte_mention_detail_zugang.sql` (+ Rückweg), zu B1:
   - `get_mention_detail_v7` wird noch von Bubble gebraucht (Shopping, Events). Es prüft jetzt den Zugang wie v8 und hat einen festen `search_path`.
   - `get_mention_detail` und `_v6` sind nicht mehr für PUBLIC/anon ausführbar; authenticated bleibt.
   - Im Rollback getestet:
     - Team mit Zugang: unverändert.
     - Team ohne Zugang: `team_access_no_plan`.
     - anon auf v6: abgelehnt.
   - Der Rückweg stellt v7 byte-genau wieder her; die md5 ist geprüft.
