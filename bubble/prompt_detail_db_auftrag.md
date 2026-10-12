# Auftrag an den Datenbank-Chat: Prompt Detail als selbstladender Drawer (Stand 12.10.2026)

Diesen ganzen Text als erste Nachricht in den Datenbank-Chat geben. Er ist in sich vollständig.

**Diese Runde ist eine BESTANDSAUFNAHME mit FEHLERSUCHE, MISSBRAUCHSPRÜFUNG und VORSCHLAG. Du
änderst nichts.** Vorbild ist die letzte Runde (`url_detail_v1` mit `p_url` in den Dashboard-RPCs):
dieselbe Bauart und dieselben Regeln. Das heißt `security definer`, fester `search_path`, kein
anon, Nutzer aus `auth.uid()`, `{meta, row}`, stabile Fehler-`message`, `_pi_rate_limit_v1` und
nichts außerhalb der Transaktion.

---

## 0. Worum es geht

Nach Response und URL wird der **Prompt-Drawer** eine Komponente, die ihre Daten selbst holt. Er ist
ein Drawer der ersten Ebene und wird mit der `prompt_id` geöffnet (`?detail=prompt:<id>`), aus
Prompt Insights, Response Detail (Blitz), Quick Actions, Mira und den Pins der Seitenleiste.

Heute in Bubble:
- **Drawer selbst:** `get_prompt_detail_bundle_v6` (Kopf und Zusatzdaten).
- **Darunter drei Komponenten**, jede mit eigenem Bubble-RPC und der `prompt_id` im Aufruf:
  Visibility Chart, Top Citations, Responses-Tabelle.
- **Filter:** Kalender und Modelle. Märkte und Topics ergeben bei einem einzelnen Prompt keinen Sinn.

## 1. Was der neue Drawer zeigt (Layout wie Response und URL)

| Teil | Daten |
|---|---|
| Kopf | „Prompt / {Prompt-Text}“, Ask Mira, an die Seitenleiste heften, Schließen |
| Meta-Zeile | Market (Flagge), Topics (Chips), weitere Angaben aus v6, z. B. angelegt, letzter Lauf, aktiv/pausiert |
| Titel | der Prompt-Text, vollständig |
| Filterzeile | Kalender, Modelle |
| Visibility Chart | Sichtbarkeit der Marken in den Antworten auf diesen Prompt, mit Tabelle darunter |
| Top Citations | Ring der Typen und Liste (Domains oder URLs) für diesen Prompt |
| Responses | die Antworten auf diesen Prompt, mit Suche, Sortierung, Seiten und Filtern wie im Dashboard |

## 2. Bestandsaufnahme (bitte mit Definition und Beispiel)

1. `pg_get_functiondef('app.get_prompt_detail_bundle_v6'::regproc)`, Parameter, Rechte, Ausgabeform
   (Umschlag? verdoppelte Backslashes?). Was liefert es alles, und was davon braucht der Kopf?
2. **Welche RPCs füllen heute die drei Komponenten im Prompt-Drawer**, mit welchen Parametern?
   (`pg_stat_statements`, Aufrufe mit einer Prompt-Kennung.)
3. **Gibt es in den Dashboard- und Citations-RPCs schon eine Prompt-Einschränkung?**
   - Dashboard: `cached_dashboard_visibility_v1`, `cached_dashboard_overview_v1`,
     `cached_dashboard_responses_v1`.
   - Citations: `cached_citations_overview_v1`, `cached_citations_domains_v1`,
     `cached_citations_urls_v1`.
   - Export: `export_responses_v1`.

   Bei der URL kannte die Basis `p_url` schon, nur der Wrapper reichte `null` durch. Ist es hier
   ähnlich?
4. **Zeitraum und Modelle:** Wie gehen sie heute ein? Was gilt ohne Angabe?
5. **Market und Topics des Prompts:** woher (heutiger Prompt oder Lauf)? Kann ein Prompt mehrere
   Märkte haben?
6. Laufzeit kalt/warm (877c) für einen Prompt mit vielen Läufen; Ratenlimit heute.

## 3. Prüfung (Befund, Schwere, Vorschlag)

1. **Fremde Kennung:** `prompt_id` eines anderen Teams mit eigenem `p_team`: kommt „nicht
   gefunden“, ohne zu verraten, ob es den Prompt gibt? Fremdes `p_team`?
2. **Gelöschte/archivierte Prompts:** Was liefert v6, was sollen die neuen Funktionen liefern?
   (Ein Link aus einem alten Pin kann auf einen gelöschten Prompt zeigen.)
3. **Fremder Text:** Prompt-Text ist Nutzertext, Topic-Namen auch. Längen, Steuerzeichen?
4. **Zugang:** wie Response und URL (`team_access_<state>`)?
5. **Kosten:** Schreibt v6 beim Lesen?

## 4. Vorschlag (noch nicht bauen)

**A. `prompt_detail_v1(p_team uuid, p_prompt_id uuid)`** → `{meta, row}` als reines jsonb:
- `meta`: `team_id`, `prompt_id`, `data_as_of`.
- `row`: `prompt_id, prompt_text, market, tags[] {id, name, emoji, hex_light, hex_dark}` (leer `[]`,
  nicht `[{id:null}]`), `created_at`, `last_run_at`, `status` (aktiv/pausiert/gelöscht, falls es
  das gibt), `models[]` (die Modelle, mit denen der Prompt läuft) und was v6 sonst Sinnvolles für
  den Kopf hat.
- Fehler: `prompt_not_found` (PT404, auch bei fremdem Prompt), `team_forbidden` (42501),
  `team_deleted` (PT404), `team_access_<state>` (PT402), `prompt_rate_limited` (PT429, hint
  Sekunden), `team_invalid_param` (22023, hint Feld), `settings_not_authenticated` (28000).

**B. `p_prompt_id uuid default null` in den RPCs aus 2.3**, genau wie `p_url`. Damit gilt: gleiche
Ausgabe, gleiche Filter, der Cache-Schlüssel enthält `p_prompt_id`. Die Seite füllt die drei
Komponenten dann mit demselben Code wie das Dashboard. Im Export ebenso, damit der Export-Knopf
der Tabelle im Drawer die Antworten dieses Prompts liefert.

**C.** Prüfe bitte, dass `total_count` der Responses mit `p_prompt_id` zur Zahl der Läufe des
Prompts im Zeitraum passt, wie bei der URL (523 = 523).

`get_prompt_detail_bundle_v6` bleibt, bis Bubble nichts mehr daraus liest.

Dazu bitte:
1. die Antworten auf Abschnitt 2 und 3, Befunde nach Schwere;
2. nach dem Bau eine Datei mit **echten, ungekürzten Antworten** (Team 877c) für einen Prompt mit
   vielen Läufen:
   - `prompt_detail_v1`;
   - Visibility (Tag) und Overview;
   - Citations: Overview Domain und URL, Domains, URLs;
   - Responses, erste Seite und mit Suche;
   - Export mit `p_prompt_id`;
   - einen Prompt ohne Topics und einen ohne Läufe im Zeitraum;
   - jede Fehlerform einmal.
