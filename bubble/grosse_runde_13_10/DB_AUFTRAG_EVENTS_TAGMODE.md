# DB-Auftrag: Impact Events, Topics mit „Und“ verknüpfen (`p_tagmode`)

Stand 13.10.2026. Zum Weiterleiten an den DB-Chat.

## Worum es geht

Beim Anlegen eines Events wählt man die betroffenen Topics. Heute zählt ein Prompt dazu, wenn er in
**irgendeinem** der gewählten Topics steht (ODER). Neu gibt es im Popup denselben Umschalter
„Or / And“ wie im Topics-Filter der App. Bei **And** zählen nur Prompts, die in **allen** gewählten
Topics stehen.

Der Name und die Werte des Parameters sind dieselben wie bei `cached_dashboard_responses_v1`
(Vertrag `events_backend_vertrag.md`, Abschnitt Responses): `p_tagmode` text, `"or"` / `"and"`,
Vorgabe `"or"`.

## Was die Oberfläche schon tut (Pin folgt)

- **Or** (Vorgabe): Der Parameter wird **nicht** mitgeschickt. Jeder Aufruf bleibt also gültig,
  auch solange die Funktionen ihn noch nicht kennen.
- **And mit mindestens zwei Topics**: `"p_tagmode": "and"` geht an `preview_impact_event_scope_v2` und an
  `create_impact_event_v2`. Mit nur einem Topic ist „alle“ dasselbe wie „eins“, dann fehlt der Parameter.
- Solange die Funktion den Parameter nicht kennt, antwortet PostgREST mit 404 PGRST202. Die
  Oberfläche zeigt dann am Topics-Feld „Matching all topics isn't available yet. Switch to Or to
  continue.“ und fällt **nicht** auf Bubble zurück. Sobald das SQL eingespielt ist, läuft derselbe
  Aufruf ohne Änderung an der Oberfläche durch.

## Was die Datenbank tun muss

### 1. `app.impact_resolve_scope_prompts_v1` (der gemeinsame Resolver)

Neuer Parameter `p_tagmode text default 'or'`.

- `'or'`: wie heute. Prompts, die in mindestens einem der Tags stehen.
- `'and'`: Prompts, die in **jedem** Tag aus `p_tag_ids` stehen, z. B.
  `group by prompt_id having count(distinct tag_id) = cardinality(p_tag_ids)`.
- Jeder andere Wert wirft `impact_event_invalid_param` mit `hint = 'p_tagmode'`.
- Bei `p_scope_mode = 'all'` wird der Parameter ignoriert, wie `p_tag_ids`.
- Ein Prompt zählt weiterhin **einmal**.

### 2. `preview_impact_event_scope_v2`

Neuer optionaler Parameter `p_tagmode text default 'or'`, an den Resolver durchreichen.

| Request | Antwort |
|---|---|
| `{"p_team": "877c649c-f5f2-44e9-bb04-155f5bf44e70", "p_scope_mode": "topics", "p_tag_ids": ["597a287b-9efd-414b-b82a-c5c3d247043f", "c7c51846-319e-4f11-992c-d72e5bd5ffbd"]}` | `{"affected_prompt_count": 102}` (ODER, wie heute) |
| `{"p_team": "877c649c-f5f2-44e9-bb04-155f5bf44e70", "p_scope_mode": "topics", "p_tag_ids": ["597a287b-9efd-414b-b82a-c5c3d247043f", "c7c51846-319e-4f11-992c-d72e5bd5ffbd"], "p_tagmode": "and"}` | `{"affected_prompt_count": <n>}`, nur Prompts in beiden Topics. `0` ist eine normale Antwort |
| `{"p_team": "…", "p_scope_mode": "topics", "p_tag_ids": ["…"], "p_tagmode": "xor"}` | 400, `message = impact_event_invalid_param`, `hint = p_tagmode` |

### 3. `create_impact_event_v2`

Neuer optionaler Parameter `p_tagmode text default 'or'`, an den Resolver durchreichen.

- Die Kohorte wird wie bisher beim Anlegen eingefroren. Mit `'and'` ist es die UND-Kohorte.
- Bei `'and'` mit 0 Prompts: `impact_event_no_active_prompts`, wie heute bei leerer Auswahl.
- **Am Event speichern:** neue Spalte `tag_mode text not null default 'or'`, damit das Detail sagen
  kann, wie verknüpft wurde.

Beispiel-Request (Body des RPC):

```json
{
  "p_team": "877c649c-f5f2-44e9-bb04-155f5bf44e70",
  "p_name": "Website Relaunch",
  "p_event_date": "2026-09-01",
  "p_scope_mode": "topics",
  "p_tag_ids": ["597a287b-9efd-414b-b82a-c5c3d247043f", "c7c51846-319e-4f11-992c-d72e5bd5ffbd"],
  "p_tagmode": "and",
  "p_urls": null,
  "p_description": null,
  "p_event_type": "website_relaunch",
  "p_icon": null,
  "p_color": null
}
```

### 4. `get_impact_event_v2` (und jedes Detail-Objekt, also auch die Antworten von create/update/add_url/remove_url)

Neues Feld `scope.tag_mode` (`"or"` / `"and"`) neben den Topics. Alte Events: `"or"`.

### 5. Analyse und betroffene Prompts

`cached_impact_event_analysis_v2` arbeitet auf der **eingefrorenen** Kohorte. Dort ist nichts zu
ändern, solange die Kohorte beim Anlegen mit dem richtigen Modus gebildet wurde. Bitte bestätigen,
dass nirgends nachträglich wieder über `p_tag_ids` mit ODER aufgelöst wird (z. B. bei der
Vergleichsgruppe oder in einer Zählung „betroffene Prompts“).

## Rückmeldung bitte

1. Je eine **echte** Antwort für die drei Zeilen der Tabelle in 2 (Team 877c…), dazu ein `create` mit
   `"and"` und das zugehörige `get_impact_event_v2` mit `scope.tag_mode`.
2. Bestätigung zu Punkt 5.
