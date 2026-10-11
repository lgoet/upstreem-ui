# Auftrag an den Datenbank-Chat: URL Detail als selbstladender Drawer (Stand 12.10.2026)

Diesen ganzen Text als erste Nachricht in den Datenbank-Chat geben. Er ist in sich vollständig.

**Diese Runde ist eine BESTANDSAUFNAHME mit FEHLERSUCHE, MISSBRAUCHSPRÜFUNG und VORSCHLAG. Du
änderst nichts.** Vorbild ist die letzte Runde, `response_detail_v1`: dieselbe Bauart, dieselben
Regeln (`security definer`, fester `search_path`, kein anon, Nutzer aus `auth.uid()`, `{meta, row}`,
stabile Fehler-`message`, neuer Limiter `_pi_rate_limit_v1`, nichts außerhalb der Transaktion).

---

## 0. Worum es geht

Nach Response Detail wird der **URL-Drawer** eine Komponente, die ihre Daten selbst holt
(PostgREST, `POST /rest/v1/rpc/<funktion>`, Schema `app`, Nutzer-JWT). Er zeigt eine einzelne
zitierte Adresse. Geöffnet wird er mit der URL als Kennung (`?detail=url:<adresse>`) aus den
Citations-Tabellen, den Quellen in Response Detail, Quick Actions, Mira, den Pins der Seitenleiste.

Heute füllt Bubble den Drawer:
- **Kopf und Inhalt** über `get_url_bundle_v7`. Die Antwort geht in drei Setter: `url_detailed`,
  `conversion` und (teils getrennt) `markdown_summary`.
- **Eine Responses-Tabelle** darunter (die Antworten, die diese URL zitieren). Welche RPC sie
  füllt, weiß ich nicht sicher. Bitte nachsehen.
- **Ein Kalender** im Drawer (Zeitraum). Ob und wie er in `get_url_bundle_v7` eingeht, bitte
  nachsehen.

## 1. Was der Drawer zeigt (neues Layout, wie Response Detail)

| Teil | Felder heute |
|---|---|
| Kopf | „URL / {Titel}“, Knöpfe: Domain öffnen, Create with AI, Ask Mira, an die Seitenleiste heften, Schließen |
| Meta-Zeile | Favicon und Domain, Zitationstyp, URL-Typ, zuletzt gesehen |
| Titel | `title` (sonst die Adresse), darunter die Adresse als Link nach außen |
| Kennzahlen | `domain_share`, `global_share`, `global_rank` |
| Brands mentioned | `companies[]` (`company_id, company_name, logo_url`) |
| Embed | aus der Adresse (YouTube, TikTok, …), keine Daten |
| Meta Description | `description` (heute HTML-kodiert, `&amp;`) |
| AI Summary | `markdown_summary` (heute teils **unescaptes JSON im JSON**: `{"summary": "..."}` roh) |
| Citation Conversion | `conversion[]` (`company_id, company_name, logo_url, role, cited_runs, mentioned_runs, citation_conversion_pct`) |
| Responses | Tabelle wie im Dashboard (Suche, Sortierung, Seiten, Rang/Sentiment-Filter, Marken-Filter) |

## 2. Bestandsaufnahme (bitte mit Definition und Beispiel)

1. `pg_get_functiondef('app.get_url_bundle_v7'::regproc)`, Parameter, Rechte (anon, authenticated),
   Ausgabeform (Umschlag? verdoppelte Backslashes?).
2. **Welche RPC füllt die Responses-Tabelle im URL-Drawer?** (`pg_stat_statements` nach Funktionen
   mit einem URL-Parameter.) Liefert `get_url_bundle_v7` die Antworten selbst mit?
3. **Zeitraum:** Nimmt v7 `date_from/date_to`? Gelten Shares, Rang und Conversion für den Zeitraum
   oder für alles? Gibt es Filter für Modelle, Märkte, Topics?
4. **Wie wird die URL gefunden?** Exakter Vergleich, oder normalisiert (Schema, `www.`, `/` am Ende,
   `utm_*`, Raute)? Was passiert mit `http://` gegenüber `https://`, mit Groß-/Kleinschreibung?
5. `companies[]`: nur getrackte Marken des Teams? Woher (Erwähnung auf der Seite, team-weit)?
   Rolle (own/competitor) erkennbar? Logo nach der Logo-Regel (eigene Marke Override, Wettbewerber
   Favicon)?
6. `markdown_summary`: woher, wie gespeichert, warum JSON im JSON? Gibt es Seiten ohne?
7. `domain_share`, `global_share`, `global_rank`: Definition in einem Satz je Kennzahl.
8. Laufzeit kalt/warm (877c) für eine sehr oft zitierte URL und eine seltene; Ratenlimit heute.

## 3. Prüfung (Befund, Schwere, Vorschlag)

1. **Fremde Kennung:** URL, die nur ein anderes Team zitiert, mit eigenem `p_team`: kommt
   „nicht gefunden“, ohne zu verraten, ob es sie gibt? Fremdes `p_team`?
2. **Fremder Text:** `title`, `description`, `markdown_summary` kommen von fremden Seiten bzw.
   einem Sprachmodell. HTML-Reste, Steuerzeichen, Längen (größte im Bestand)? Die Oberfläche
   maskiert; bitte trotzdem sagen, was drinsteht.
3. **Adressen:** `url`, `favicon`, `logo_url`: Schemata im Bestand (`http:`, ohne Schema, `null`)?
4. **Zugang:** wie Response Detail (`team_access_<state>`)?
5. **Kosten:** schreibt v7 beim Lesen? Holt es etwas von außen?

## 4. Vorschlag (noch nicht bauen)

**A. `url_detail_v1(p_team uuid, p_url text, p_date_from date default null, p_date_to date default null)`**
→ `{meta, row}` als reines jsonb, ohne Umschlag:
- `meta`: `team_id`, `url` (so, wie sie gefunden wurde), `date_from`, `date_to`, `data_as_of`.
- `row`: `url, title, domain, favicon, url_type, citation_type, last_seen, domain_share,
  global_share, global_rank`
  - `description` **dekodiert** (keine `&amp;` mehr), als Klartext;
  - `summary` als **Klartext** (das `summary`-Feld aus dem JSON im JSON, kein JSON mehr);
  - `brands[]`: `{company_id, name, role, logo_url, favicon_url}` nach der Logo-Regel, eine Zeile
    je Marke, eigene Marke zuerst;
  - `conversion[]`: wie heute, dazu `role` und `logo_url` nach der Logo-Regel.
- Fehler: `url_not_found` (PT404), `team_forbidden` (42501), `team_deleted` (PT404),
  `team_access_<state>` (PT402), `url_rate_limited` (PT429, hint Sekunden),
  `team_invalid_param` (22023, hint Feld), `settings_not_authenticated` (28000).

**B. Responses: lieber erweitern als neu.** `cached_dashboard_responses_v1` bekommt einen
optionalen Parameter `p_url text default null` (nur Antworten, die diese URL zitieren, mit
derselben Normalisierung wie A). Gleiche Ausgabeform, gleiche Filter, gleicher Cache (der
Schlüssel muss `p_url` enthalten). Dann füllt die Seite die Tabelle mit genau dem Code, mit dem
Dashboard und Prompt Insights es schon tun. Für den Domain-Drawer, der als Nächstes kommt, wäre
`p_domain text default null` derselbe Schritt. Wenn das aus deiner Sicht schlecht ist, sag warum
und schlag die Alternative vor.

**C. Export:** Die Responses-Tabelle hat einen Export-Knopf. Der Export der App kennt keinen
Filter auf eine URL und gäbe alle Antworten des Zeitraums aus. Im neuen Drawer ist der Knopf
deshalb vorerst ausgeblendet. Kann der Export (`prompt_runs`) `p_url` mitnehmen? Wenn ja, zeige ich
ihn wieder.

`get_url_bundle_v7` bleibt, bis Bubble nichts mehr daraus liest.

Dazu bitte:
1. die Antworten auf Abschnitt 2 und 3, Befunde nach Schwere;
2. nach dem Bau eine Datei mit **echten, ungekürzten Antworten** (Team 877c): eine viel zitierte
   URL mit Zusammenfassung und Conversion, eine YouTube-URL, eine URL ohne Zusammenfassung, eine
   mit `http://`, dazu `cached_dashboard_responses_v1` mit `p_url` (erste Seite, und eine Seite
   mit Suche) und jede Fehlerform einmal.
