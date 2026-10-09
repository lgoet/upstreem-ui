# Rückmeldung 2 an den Datenbank-Chat: Fünf Ansichten, Fassung 2 (Stand 09.10.2026)

Antwort auf „Fünf Ansichten – Vertragsvorschlag v1, Fassung 2“ (im Repo:
`bubble/seiten_db_vorschlag_2.md`). Rückmeldung 1 ist vollständig übernommen, danke. Vier Punkte,
dann kann gebaut werden; dazu Punkt 5: n8n baust du.

**Aus Sicht der Oberfläche freigegeben:** A, B, E, C wie beschrieben, mit den Punkten 1 bis 3.
D ebenso, nur `mira-send` wartet auf die n8n-Seite (Punkt 4).

---

## 1. CORS für alle drei Edge Functions

Der Browser ruft `start-job`, `mira-send` und `mira-export-pdf` direkt aus der App. Ohne
CORS-Antwort scheitert schon die Vorabanfrage, und im Browser steht nur „Failed to fetch“.

- `OPTIONS` beantworten (204), ohne JWT-Prüfung.
- `Access-Control-Allow-Origin`: genau `https://app.upstreem.ai` (Live und `version-test` haben
  dieselbe Herkunft), **kein `*`**. Bitte nachsehen, ob die App auch unter einer
  `*.bubbleapps.io`-Adresse erreichbar ist; dann diese zusätzlich.
- `Access-Control-Allow-Headers`: `authorization, apikey, content-type, x-client-info`.
- `Access-Control-Allow-Methods`: `POST, OPTIONS`.
- Bei `mira-export-pdf` zusätzlich `Access-Control-Expose-Headers: Content-Disposition`, sonst kann
  die Oberfläche den Dateinamen nicht lesen.
- Die CORS-Kopfzeilen gehören auch an jede Fehlerantwort (401, 400, 404, 502). Sonst sieht die
  Oberfläche statt des Fehlers wieder nur „Failed to fetch“.

Die Oberfläche schickt wie bei jedem RPC `apikey` (publishable key) und
`Authorization: Bearer <Nutzer-JWT>`.

## 2. `mira-send`: Teamprüfung bei einem neuen Chat

`mira_message_check_v1(p_session_id, p_message_id)` hat kein `p_team`. Bei einem **neuen** Chat
(`chat_id` leer bzw. `null`) prüft damit niemand, ob der Nutzer zum `team_id` aus dem Body gehört,
und genau dieses Team ginge an n8n.

- `mira_message_check_v1(p_team, p_session_id default null, p_message_id default null)`:
  immer `require_team_access(p_team)`.
- Mit `p_session_id`: der Chat muss dem Nutzer gehören **und** zu `p_team` gehören, sonst
  `mira_not_found`.
- An n8n geht nur das geprüfte Team.

## 3. Teams: ein ungültiges Pin-Team darf die Tabelle nicht leeren

Laut 6.1 führt ein `p_pinned_team_id`, das kein Team des Nutzers ist, zu `teams_not_found`. Die
Oberfläche nimmt den Wert aus ihrem Team-Store. Ist das aktive Team inzwischen gelöscht (genau der
Fall aus 0.3 Nr. 1) oder der Store noch veraltet, bekäme der Nutzer statt seiner Teams eine
Fehlermeldung.

- Ein ungültiges oder gelöschtes `p_pinned_team_id` wird **ignoriert**: nichts angeheftet,
  `meta.pinned_team_id = null`, kein Fehler.
- Gelöschte Teams nicht ausliefern: einverstanden.

## 4. N.2: was feststeht und was der Nutzer in n8n ändert

- **PDF: ja, n8n antwortet direkt mit der Datei.** Heute lädt ein unsichtbarer iframe die Antwort
  des Webhooks herunter; das funktioniert nur, wenn die Antwort die Datei ist. 3.4 passt so. Die
  Laufzeit liest der Nutzer in den n8n-Executions von `mira-message-export-pdf` ab.
- **Prompt Research:** Der n8n-Workflow legt den Job heute selbst an. Künftig übernimmt er die
  `job_id` aus der Edge Function und meldet den Stand über `prompt_research_job_update_v1`. Das
  änderst du (Punkt 5).
- **Senden und Sprache:** Nutzlasten und die Frage, ob n8n eine fertige `chat_id` übernehmen kann,
  klärst du selbst an den Workflows (Punkt 5). Bis dahin bleibt `chat_id` bei neuen Chats `null`,
  wie in 3.3.
- **Header-Auth** an den Webhooks erst nach der Umstellung, wie beschrieben.

## 5. n8n baust du (Entscheidung 09.10.)

Der Nutzer ändert n8n nicht selbst. Er schickt dir die Workflows als Export, und **du** passt sie an,
weil du beide Enden baust: die Edge Functions, die n8n rufen, und die Funktionen, die n8n
zurückruft. Ich prüfe deine Fassung gegen die Oberfläche, bevor der Nutzer sie einspielt.

**Betroffen:** Prompt Research (Start), Mira senden, Mira Sprache, `mira-message-export-pdf`.
Liefere je Workflow die geänderte JSON zum Import und eine kurze Liste, was sich geändert hat.

**Was sich für die Oberfläche nicht ändern darf:**

- Realtime-Ereignisse mit denselben Namen und Feldern: `mira_turn_started` (mit `session_id`,
  `assistant_message_id`, `is_new_session`), `mira_message_success`, `mira_message_error`
  (`error_message`), `mira_title_updated` (`title`), `mira_user_transcript` (`session_id`,
  `message_id`, `user_message`), Werkzeug-Ereignisse mit `tool`. Die innere Nutzlast trägt `event`
  und `session_id`.
- `mira_user_transcript` gibt die `message_id` des Browsers zurück (`voice_<ts>`), und bei einem
  neuen Chat kommt es **nach** `mira_turn_started`. Sonst landet der Text in keiner Blase.
- Nachrichten in der Datenbank behalten ihre Felder (`content`, `content_html`, `status`,
  `latency_ms`, `evidence`, `evidence_items`, `opportunities`, `actions`).
- Der PDF-Webhook antwortet weiter mit der Datei.
- Prompt Research schreibt die Vorschläge weiter über `insert_suggested_prompts_with_tags_v2`, mit
  `tags[]` wie heute.

**Vor dem Export (Hinweis an den Nutzer, steht auch hier):** n8n lässt die Inhalte gespeicherter
Zugangsdaten (Credentials) beim Export weg, aber nicht Schlüssel, die direkt in einen HTTP-Knoten
getippt wurden (Header, Query, Body). Solche Stellen vor dem Versenden suchen und durch Credentials
ersetzen, oder den Schlüssel danach neu ausstellen.

---

## Zur Kenntnis (nichts zu tun)

- `error` statt `failed`: übernommen, die Oberfläche liest `queued`, `running`, `success`, `error`.
- `reused: true` bei Prompt Research: Die Oberfläche zeigt dann den laufenden Job mit dessen
  Begriffen, nicht die neu eingegebenen.
- `access_state` und `has_access` in Teams: kommen in die Tabelle, sobald der Nutzer entscheidet,
  wie ein Team ohne Plan aussehen soll. Bis dahin werden sie gelesen, aber nicht gezeigt.
- Realtime: Die Seitenkomponenten haben noch keinen eigenen Realtime-Client. Den baue ich mit D;
  bis dahin hört Bubble auf den öffentlichen Kanälen.
