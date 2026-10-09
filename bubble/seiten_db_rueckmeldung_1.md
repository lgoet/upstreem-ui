# Rückmeldung 1 an den Datenbank-Chat: Fünf Ansichten (Stand 09.10.2026)

Antwort auf „Fünf Ansichten – Bestandsaufnahme und Vertragsvorschlag v1“ (im Repo:
`bubble/seiten_db_vorschlag_1.md`). Jede Antwort und jedes Feld ist gegen den Code der fünf
Komponenten geprüft (performance-radar.js, performance-detail.js, opportunities.js,
create-with-ai.js, teams.js, prompt-research.js, ask-mira.js).

**Kurz:** Die Grundform passt; die gemeinsamen Regeln (§1), das Job-Muster (§8) und die
Reihenfolge A → B → E → C → D sind freigegeben. Unten stehen die Änderungen je Ansicht, danach
die Antworten auf deine zwölf Fragen. **Die Entscheidungen des Nutzers stehen in Abschnitt N**
(Nachtrag 09.10.); sie gehen allem anderen vor. Offen ist nur noch N.2 (n8n-Nutzlasten).

**Umbenennungen fängt die Oberfläche ab.** Sie bekommt je Bereich ein Datenmodul (wie
`citations-data.js`). Wo die Komponente heute anders liest (`cells` statt `rows`, `series` statt
`rows`, nacktes Array statt `{meta, rows}`, `selected_companies` statt `companies[].is_selected`),
übersetzt das Modul. **Bitte dafür nichts am Vorschlag ändern.** Die Form `meta` + `rows` bleibt.

---

## 0. Quer über alle Ansichten: wer stößt n8n an? (entschieden: Weg b, siehe N.1)

Der Vorschlag setzt an drei Stellen eine „Next.js-Server-Route“ voraus: Prompt-Research-Start
(6.5), Mira senden (7.4), Sprache und PDF. **Die gibt es noch nicht.** Die App läuft in Bubble,
Next.js ist nur der spätere Weg. Heute stößt Bubble n8n per Workflow an.

Zwei Möglichkeiten für jetzt:

| Weg | Wie | Folge |
|---|---|---|
| a) Bubble bleibt Auslöser | Die Komponente ruft `*_start_v1` und gibt die `job_id` per Ereignis an einen Bubble-Workflow weiter, der n8n aufruft. | Kein neuer Baustein. Später für Next.js neu zu bauen. |
| b) **Supabase Edge Function** (Empfehlung) | `start-job` prüft das JWT, ruft `*_start_v1` mit dem Nutzer-Token und dann den n8n-Webhook. Das Secret liegt in den Supabase-Secrets. Gleiches Muster wie `signup-with-invite`. | Funktioniert heute aus Bubble und später unverändert aus Next.js. Mira-Senden kann die `session_id` eines neuen Chats direkt zurückgeben. |

Die `*_start_v1`-Funktionen legen nur den Job an und antworten mit `job_id`; den Webhook ruft die
Edge Function.

---

## N. Entscheidungen des Nutzers (Nachtrag 09.10.)

1. **Edge Function statt Next.js-Route: entschieden.** Bubble ruft n8n für diese Ansichten nicht
   mehr. Die Komponente ruft eine Edge Function (Nutzer-JWT), die legt über `*_start_v1` den Job an
   und stößt den Ausführer an. Die Webhook-Adressen liegen nur in den Supabase-Secrets, nie im
   Browser. Bitte die Edge Function im Vertrag mit Namen, Body und Antwort festhalten (Vorschlag:
   eine Funktion `start-job` mit `kind`, oder je Art eine). Die alten Bubble-Wege bleiben, bis die
   Seiten umgestellt sind.
2. **n8n-Nutzlasten: kommen vom Nutzer nach.** Heute stößt Bubble je einen n8n-Workflow per
   Webhook an. Beim PDF-Export ruft ein Run-JS-Schritt die Webhook-Adresse, wartet stumpf 2,5 s und
   setzt dann `askMiraSetExportPending(id, "no")`, ohne zu wissen, ob es geklappt hat. Das soll
   ein echter Job werden: die Oberfläche wartet auf `success`/`failed` (Status-Abruf oder
   Realtime-Ereignis), nicht auf eine Uhr. **Offen:** wohin das fertige PDF geht (Adresse zum
   Herunterladen oder E-Mail).
3. **Kein pg_cron-Worker.** Es braucht niemanden, der nach neuen Jobs sucht: Jeder Job hat einen
   Auslöser (Klick → Edge Function), und der Auslöser führt aus oder gibt weiter. Für „Look for new“
   heißt das: die Edge Function legt den Job an, antwortet sofort mit `job_id` und führt die
   Rechnung danach selbst aus (im Hintergrund der Funktion) bzw. gibt sie an n8n. `view_job` mit
   Status, Heartbeat und Aufräumen bleibt; das Aufräumen von Hängern darf ein seltener Cron sein
   (z. B. jede Minute), aber kein 5-s-Takt. Bitte zeigen, wie die Rechnung von bis zu 60 s ohne die
   30-s-Grenze von `authenticated` läuft.
4. **Prompt Research hart löschen, wie heute.** Gemeint ist der Papierkorb an einer früheren
   Recherche in der Liste links. `prompt_research_delete_v1` löscht Job, Vorschläge und Tags
   endgültig; C.8 entfällt.
5. **Private Realtime-Kanäle: ja.** Mit D.7 (alles auch auf `user:<uid>`), öffentliche parallel,
   bis Bubble nicht mehr zuhört.
6. **„Delete all Prompts“** ist das Menü neben „Accept all Prompts“ in der Ergebnisansicht von
   Prompt Research (`bubble_fn_deleteAllSuggestedPrompts`, nur Vorschlags-Ids). Es wird
   `prompt_research_decide_v1('ignore', ids)`: sichtbar ist beides gleich, die Vorschläge
   verschwinden. Kein eigener Löschweg für Vorschläge.
7. **Die 92 hängenden Prompt-Research-Jobs: freigegeben.** Bitte `prompt_research_haenger.sql`
   ausführen (nur Status auf `failed`, nichts löschen) und die Zahl danach melden.

## A. Performance

1. **Vorgabe 12/12 statt 10/10** für `p_company_limit`/`p_topic_limit`. Die Oberfläche hat 12/12
   als Obergrenze im Auswahlfenster (`performance-radar.js:98`). Der Bereich 1–25 passt.
2. **Eine ausdrückliche Liste wird nicht gekappt.** Werden `p_companies`/`p_topics` übergeben,
   gelten genau diese (bis 25), unabhängig vom `*_limit`. `selected_position` folgt der Reihenfolge
   in `p_companies`/`p_topics`.
3. **Zeilen und Spalten sind vertauscht beschrieben.** Im Radar sind die **Topics die Zeilen** und
   die **Marken die Spalten** (`performance-radar.js:3-4`). Nur der Text in 3.1, die Rechnung ist
   davon nicht berührt.
4. **`topic_emoji`** fehlt in `rows`, `topics` und `available_topics`. Der Radar zeichnet es im
   Topic-Chip und reicht es ins Detail weiter. Bitte mitliefern (null, wenn das Topic keins hat).
5. **Markenvarianten: ganze Liste in einem Aufruf.** Das Detail blättert und sucht im Browser über
   alle Zeilen (Seite zu 15). Mit `p_limit` 25/100 wären bei 877c 290 von 390 Namen unsichtbar, und
   die Suche fände sie nicht. Bitte `p_limit` bis **1000** erlauben, Vorgabe 1000. Sortierung
   `mentioned_count desc, name asc` passt. `mentions_total` in `meta` ist richtig.
6. **Kurve:** Gebraucht wird heute nur `p_mode = visibility`, `p_granularity = day` und der
   Topic-Fall (`p_company` + `p_tag_ids = [topic_id]`). Der Global-Umschalter ist ausgeblendet. `null`
   statt 0 bleibt richtig; die Oberfläche zeichnet daraus eine Lücke (das stelle ich vorher in core
   um).
7. **URLs im Detail:** `cached_citations_urls_v1` mit `p_tag_ids = [topic_id]` und
   `p_mentioned_brands = [company_id]`. Keine neue Funktion, wie von dir vorgeschlagen.
8. **Zeitraum und Filter:** Die Performance-Seite hat heute keinen Kalender und keine Filter. Die
   Parameter bitte trotzdem bauen; die Oberfläche schickt vorerst nur die Vorgaben.

## B. Opportunities

1. **Felder der Karte bestätigen.** `dashboard_opportunities_v1` wird durchgereicht, ohne
   Umbenennung. Die Oberfläche liest genau diese Felder. Bitte prüfen, dass jedes davon in der
   Antwort steht, besonders `source_scope`, `trend_pct`, `supporting_urls_count`, `topics[].hex_dark`
   und `mentioned_competitors[].favicon_url`:
   - Karte: `id`, `label`, `recommendation_type`, `headline`, `reason`, `status`, `priority_label`,
     `priority_score`, `created_at`, `lead_title`, `lead_domain`, `lead_favicon`
   - Detail: `lead_url`, `effective_citation_type`, `market`, `competitor_count`,
     `global_share_pct`, `trend_pct`, `gap`, `your_conversion`, `avg_competitor_conversion`,
     `supporting_urls_count`
   - `mentioned_competitors[]`: `name`, `company_id`, `favicon_url`
   - `topics[]`: `name`, `emoji`, `hex_light`, `hex_dark`
   - `source_scope` (gezählt wird nur der Wert `external_only`)
2. **`opportunities_set_status_v1`:**
   - `p_ids` bis **500**. „Alle verschieben“ nimmt jede Karte einer Spalte; Done und Ignored wachsen
     ohne Grenze.
   - **Fremde oder gelöschte Ids überspringen statt alles abzulehnen.** Sie werden nicht geändert und
     in `meta.skipped_ids` gemeldet. Eine einzige veraltete Karte im Browser ließe sonst das ganze
     Verschieben scheitern. Ändern darf die Funktion weiterhin nur Karten des Teams.
   - Die Antwortzeilen reichen so. Die Oberfläche braucht vor allem Erfolg oder Fehler, um eine
     schon umgesetzte Karte zurückzunehmen.
3. **`opportunities_own_urls_v1`:** Passt. Die Oberfläche schickt `p_limit` 200 und sucht lokal; nur
   bei `total_count` über 200 nutzt sie `p_search`.
4. **`opportunities_create_v1`:**
   - **Kürzen statt ablehnen.** `p_title` über 300 und `p_reason` über 2.000 Zeichen bitte auf die
     Grenze kürzen. Beides ist Modelltext aus Mira, den die Oberfläche nicht kürzt; ein
     `invalid_param` hieße, die Karte geht verloren.
   - Mira schickt nur `lead_url`, `title`, `reason`. **Kein `recommendation_type`** (mein Auftrag 2.B
     war da falsch). `p_tag_ids`, `p_models`, `p_markets` und die Daten bleiben optional.
5. **„Look for new“ als Job, ohne Cron-Worker** (offene Frage 4, siehe N.3).
   - `opportunities_search_status_v1`: **`p_job_id` optional.** Ohne Angabe kommt der laufende oder
     zuletzt beendete Job des Teams. Nach einem Neuladen der Seite kennt die Oberfläche keine
     `job_id`, soll aber die laufende Suche weiter anzeigen.
   - `progress` und `step` braucht die Oberfläche nicht (das Ladebild hat bewusst keinen Balken).
     Gelesen werden `status`, `error.code` und `status_message` (als Unterzeile).
   - Nach `success` lädt die Oberfläche `dashboard_opportunities_v1` neu. Die Karten in `rows` sind
     damit nicht nötig, schaden aber nicht.
   - Grenzen: Aufräumer 3 min, die Oberfläche bricht erst nach rund 200 s ab. Das Ende bestimmt der
     Job-Status.

## E. Teams

1. **Keine Kennzahlen.** Die Tabelle hat keine Spalten für Sichtbarkeit, Rang oder Sentiment.
   `teams_portfolio_kpis_v1` wird nicht gebraucht (Frage 9).
2. **Alle Teams in einem Aufruf.** Suche (auch über den Tarif), Blättern und Zählen laufen im
   Browser. Die Oberfläche schickt `p_limit` 100 und kein `p_search`; bei `total_count` über 100
   holt sie die nächste Seite. **Bitte nachsehen:** Wie viele Teams hat der Nutzer mit den meisten
   Teams in Prod?
3. **`p_pinned_team_id` ist das aktive Team** (Frage 9). Die Oberfläche gibt es aus ihrem Team-Store
   mit. Kein `user_settings.pinned_team_id`, keine Setz-Funktion. Dass v1 ohne Angabe nichts mehr
   anheftet, ist richtig.
4. **Teamwechsel bleibt vorerst bei Bubble** (Ereignis `usnTeam`, auch aus der Seitenleiste).
   `current_team_id` braucht es in der Antwort nicht. Eine Funktion
   `user_set_active_team_v1(p_team)` auf `last_team_id` kommt erst mit Next.js; bitte als offenen
   Punkt notieren, nicht bauen.

## C. Prompt Research

1. **`p_business_model`: `b2c`, `b2b` und `hybrid`.** Die Oberfläche bietet `hybrid` an.
2. **`p_persona`:** feste Liste `student`, `entrepreneur`, `smb_owner`, `parent_family`,
   `tech_enthusiast`; leer wird `null`.
3. **`p_keywords`:** `text[]` mit 1–20 Einträgen, zusammen höchstens 300 Zeichen. Die Oberfläche hat
   ein Feld mit 300 Zeichen und keine Zahlgrenze; 10 wäre zu knapp. Bitte `keywords` auch in
   `prompt_research_jobs_v1` und im `meta` von `prompt_research_result_v1` als `text[]` liefern,
   damit es überall eine Form gibt.
4. **`p_market` ohne Rücksicht auf Groß- und Kleinschreibung.** Prompt Research schickt `DE`, der
   Rest der App `de`.
5. **`prompt_research_decide_v1`:**
   - **`p_with_tags boolean default true`** fehlt. Die Oberfläche hat den Schalter „Accept with Tags“
     (Vorgabe an); bei `false` werden keine Topics verknüpft.
   - `p_ids` bis **100**. „Accept all“ und „Delete all“ schicken alle Vorschläge eines Jobs.
   - PT409 mit `hint` als **reiner Zahl** (freie Plätze): einverstanden (Frage 12).
   - Das `meta` mit `prompts_active`, `prompts_limit` und `prompts_remaining` ist gut; die Oberfläche
     gibt es an die zentrale Kontingentanzeige weiter.
6. **`prompt_research_result_v1`:** `market_name` und `persona` fest ins `meta` (im Beispiel fehlen
   sie).
7. **`prompt_research_jobs_v1`:** laufende und fehlgeschlagene Jobs mitliefern ist richtig. Die
   Oberfläche zeigt sie künftig als eigene Zeile. `step`, `progress`, `status_message` passen.
8. **Hart löschen wie heute** (Frage 6, siehe N.4). `result_v1` meldet für einen gelöschten Job
   `prompt_research_not_found`.
9. **Märkte und Tags: nichts bauen** (Frage 10). Zentral vorhanden, heute von Bubble befüllt:

   | Store | Felder |
   |---|---|
   | `setUpstreemMarkets` / `setUpstreemAllMarkets` | `alpha2`, `alpha3`, `name`, `flag_url`, `prompt_count` |
   | `setUpstreemTopics` | `id`, `name`, `emoji`, `hex_light`, `hex_dark` |
   | `setUpstreemQuota` | `used`, `total`, `plan` |

   Abschnitt 6.6 kann gestrichen werden.

## D. Mira

1. **`mira_sessions_v1`:**
   - Reihenfolge **`is_pinned desc, updated_at desc, id desc`**. Sonst fehlt ein alter angepinnter
     Chat auf Seite 1, obwohl er oben stehen müsste.
   - Gelöschte Chats nie liefern; die Oberfläche wertet `status` nicht aus.
   - Die Trennung in `rows` und `projects[].sessions` ist in Ordnung.
2. **`mira_messages_v1`:**
   - Vorgabe **`p_limit` 200**. Die Oberfläche kann noch keine älteren Nachrichten nachladen; jede
     Lieferung ersetzt den ganzen Chat. `p_before_id` bitte trotzdem bauen.
   - Echte Zeilenumbrüche statt `\` + `n`: richtig, die Oberfläche macht daraus `<br>`.
   - Aufsteigend sortiert: richtig.
3. **`mira_project_save_v1`:**
   - **`p_title` optional, Vorgabe `New project`.** Die Oberfläche legt ein Projekt ohne Titel an und
     öffnet danach selbst das Umbenennen.
   - **Optional `p_session_id`:** „Projekt mit Chat anlegen“ in einem Aufruf (heute ein eigenes
     Ereignis); legt das Projekt an und verschiebt den Chat hinein.
4. **`mira_session_update_v1`** und **`mira_session_delete_v1`**: passen (umbenennen, an- und
   abheften, verschieben, löschen).
5. **Einstellungen** (Frage 8): `user_settings.mira_settings jsonb` mit `get`/`set`,
   **genau drei Schlüssel:**

   | Schlüssel | Werte | Vorgabe |
   |---|---|---|
   | `brand` | `logo`, `icon`, `none` | `logo` |
   | `citation` | `favicon`, `icon`, `none` | `icon` |
   | `response` | `logo`, `icon`, `none` | `logo` |

   Alles andere (Seite, Breite, offen oder zu, Blasenstil) bleibt bewusst im Browser.
6. **`mira_turn_status_v1`:** passt als Rückfall. `queued`/`running`/`success`/`error` deckt sich mit
   den Zuständen der Oberfläche.
7. **Realtime** (Frage 11, entschieden: ja, siehe N.5):
   - **Alle Mira-Ereignisse müssen (auch) auf `user:<uid>` gehen.** Ein Kanal je Session reicht
     nicht: Die Oberfläche zeigt Kreisel, Punkt und neuen Titel auch für Chats, die gerade nicht
     offen sind. Vor allem kennt sie beim Senden in einen **neuen** Chat dessen id noch nicht und
     übernimmt sie erst aus `mira_turn_started` (`is_new_session`). `mira:<session_id>` ist höchstens
     ein Zusatz.
   - **Die innere Nutzlast trägt `event` und `session_id`.** Ereignisnamen und Felder bleiben wie
     heute: `mira_turn_started`, `mira_message_success`, `mira_message_error`,
     `mira_title_updated`, `mira_user_transcript`, Werkzeug-Ereignisse mit `tool`.
   - **Private Kanäle parallel zu den öffentlichen: einverstanden.** Die öffentlichen erst abschalten,
     wenn niemand mehr darauf hört. Heute abonniert Bubble.
8. **Senden, Sprache, PDF** (Frage 7): über die Edge Function (N.1); die n8n-Seite kommt nach (N.2).
   Die Nutzlasten der Oberfläche:
   - Senden: `{chat_id ('' = neu), message, answer_detail: Medium|High|Ultra, model: pro|flash}`
   - Sprache: `{message_id: 'voice_<ts>', chat_id (null = neu), audio_base64, mime_type, duration_ms}`.
     Das Transkript muss dieselbe `message_id` zurückgeben und bei einem neuen Chat **nach**
     `mira_turn_started` kommen.
   - PDF: `{assistant_message_id, session_id}`. Offen ist, wo die fertige Datei herkommt (Adresse
     oder Download).

---

## Deine zwölf Fragen, kurz

| # | Antwort |
|---|---|
| 1 | Betrifft die Oberfläche heute nicht: die Kurve zeigt nur Visibility. Deine Empfehlung passt. |
| 2 | Beide behalten. Die Oberfläche nutzt `mentioned_count`. |
| 3 | Ja, `dashboard_opportunities_v1` reicht. Gefiltert wird nur im Browser (Status, Suche, External only), nach Topic gar nicht. |
| 4 | Job ja, Worker nein: der Auslöser führt aus (N.3). |
| 5 | Edge Function stößt n8n an (N.1), Nutzlasten folgen (N.2). `prompt_research_job_update_v1` statt direktem Schreiben: ja. |
| 6 | Hart löschen wie heute (N.4). |
| 7 | Edge Function (N.1); n8n-Nutzlasten folgen (N.2). |
| 8 | Siehe D.5. |
| 9 | Keine Kennzahlen; Pin = aktives Team; Teamwechsel bleibt bei Bubble (E.1, E.3, E.4). |
| 10 | Zentral vorhanden, nichts bauen (C.9). |
| 11 | Ja, mit D.7 (N.5). |
| 12 | Ja, `hint` als reine Zahl. |

**Separat:** `prompt_research_haenger.sql` ist freigegeben (N.7). Das Aufräumen des Cron-Protokolls
entfällt mit N.3. Der Entzug der anon-Rechte kommt erst, wenn Bubble die alten Funktionen nicht
mehr ruft.
