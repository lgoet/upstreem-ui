# Auftrag an den Datenbank-Chat: Onboarding-Seite (Stand 13.10.2026)

Diesen ganzen Text als erste Nachricht in den Datenbank-Chat geben. Er ist in sich vollständig.

**Diese Runde ist eine BESTANDSAUFNAHME mit FEHLERSUCHE, MISSBRAUCHSPRÜFUNG, AUFRÄUMLISTE und
VORSCHLAG. Du änderst nichts.**

Die Onboarding-Seite wird wie die Drawer zu einer Komponente, die selbst lädt (`UC.rpc` und
`UC.edge` mit dem Nutzer-JWT). Bubble liefert ihr dann keine Daten mehr.

**Es gelten dieselbe Bauart und dieselben Regeln wie in den letzten Runden:**
- `security definer` mit festem `search_path`; kein anon; der Nutzer kommt aus `auth.uid()`;
- Antworten als `{meta, row}` bzw. `{meta, rows}`; stabile Fehler-`message`, kein 200 mit
  `status: error`;
- `_pi_rate_limit_v1`; nichts außerhalb der Transaktion;
- alles, was n8n anstößt, geht über eine Edge Function mit CORS (wie `start-job`, Rückmeldung 2
  der Fünf Ansichten, Abschnitt 1); die Webhook-Adressen kennt nur die Function;
- n8n meldet den Stand über Funktionen, die nur `service_role` ausführen darf und die erlaubte
  Übergänge prüfen (wie `prompt_research_job_update_v1`);
- Statuswechsel als Realtime-Broadcast (wie `view_job:<job_id>`), damit die Seite nicht im Takt
  fragt;
- **n8n baust du** (Entscheidung 09.10.): Lukas schickt dir die betroffenen Workflows als Export,
  du lieferst die geänderte JSON zum Import und eine Liste der Änderungen.

**Schwerpunkte, wörtlich von Lukas:**
- „sehr wichtige check auf fraud, spam versuche, falsche eingaben, scripting etc.“ (Abschnitt 3);
- die Sicherheit und Auth in Richtung n8n „muss alles überarbeitet werden“ (Abschnitt 4);
- RPCs, die es nicht mehr braucht, „direkt mit aufnehmen und aufräumen“ (Abschnitt 2).

---

## 0. Was die Seite heute tut (aus Bubble und der Komponente)

### 0.1 Der Ablauf für den Nutzer

Die Seite ist der erste Bildschirm nach der Anmeldung für einen Nutzer ohne Team. Sie erscheint
auch, wenn jemand „Create new team“ klickt.

| Station | Was passiert |
|---|---|
| 1 Brand | Formular: `brand_name` (max. 60), `website` (max. 255), `market` (ISO-2), `timezone` (IANA), `business_model` (`B2B` \| `B2C` \| `Hybrid` \| `CitiesRegions`). Absenden startet den großen Hintergrundlauf. |
| (warten) | Ladebild mit vier Phasen (1–4), endet bei Phase 5 |
| 2 Competitors | bis zu acht gefundene Marken, Mehrfachauswahl, **höchstens fünf** (nur im Browser geprüft) |
| 3 Topics | fünf bis acht gefundene Themen, Mehrfachauswahl, dazu bis zu **fünf eigene** (je max. 40 Zeichen, nur im Browser geprüft). „Weiter“ stößt die Prompt-Erzeugung an. |
| (warten) | zweites Ladebild, Phase 6, endet bei Phase 7 |
| 4 Prompts | nach Themen gruppiert, Mehrfachauswahl |
| 5 Plan | Tarif und Abrechnungszeitraum, danach Stripe-Kasse (mit oder ohne Testphase) |

Auswahl ist freiwillig. Jeder Haken wird **sofort** gespeichert, mit der vollständigen Auswahl,
nicht als Differenz.

**Weitermachen:** Der Nutzer kann an jeder Stelle aufhören. Beim nächsten Besuch entscheidet das
Bündel, wohin er gehört (Komponente, `einstieg()`):
- kein Projekt → Formular;
- `draft` → Formular, vorbelegt;
- `submitted`/`processing`/`finalizing` → Ladebild; Phase 6 ist das zweite Ladebild;
- `ready` → Auswahl; wie weit, ergibt sich aus den Daten: Wettbewerber oder Themen vorhanden →
  mindestens Competitors, höchstens Topics; Prompts vorhanden → bis Plan;
- `failed` oder `last_error` → Formular mit Fehlerband.

Dazu kommt ein **Tor**: Gibt es schon ein Onboarding, fragt die Seite zuerst „Continue with this
setup“ oder „Start over“. Die Regel dafür kommt aus der DB im Bündel unter `restart`:
`has_onboarding`, `run_in_progress`, `allowed`, `remaining`, `next_allowed_at`, `company_name`.
Gelöscht wird beim Neustart erst, wenn das Formular wieder abgeschickt wird.

**Die Phasentabelle** (so in der Komponente, Stand 26.08., bitte bestätigen):

| Phase | Label | % | status | gesetzt von |
|---|---|---|---|---|
| 1 | Initializing project | 5 | submitted | `onboarding_start_v1` |
| 2 | Scanning website | 20 | processing | Onboarding-WF (n8n) |
| 3 | Reading pages | 45 | processing | Onboarding-WF |
| 4 | Analyzing brand | 70 | processing | Onboarding-WF |
| 5 | Done | 100 | ready | Onboarding-WF |
| 6 | Creating prompts | 60 | processing | `onboarding_prompts_claim_v1` |
| 7 | Prompts ready | 100 | ready | Prompt-WF (n8n) |
| 95 | Creating Workspace | 95 | finalizing | Finalize-RPC |
| 100 | Completed | 100 | completed | Finalize-RPC |

### 0.2 Bubble-Workflows (Screenshots von Lukas, 13.10.)

| Auslöser | Schritte |
|---|---|
| Seitenaufbau („Do once“, wenn SupabaseAuth eine User-ID hat) | Trigger FILL_DATA |
| FILL_DATA | 1. RPC `onboarding_get_bundle` 2. State `onboarding_id` setzen 3. Kanal `onboarding_realtime` abonnieren, wenn das Bündel ein Projekt hat 4. Run JS (`setOnboardingBundle`) |
| „Do every time“ `status_phase` ist 5 | Trigger FILL_DATA |
| „Do every time“ `status_phase` ist 7 | Trigger FILL_DATA |
| `onboarding_realtime` New message | 1. Run JS (`setOnboardingStatus`) 2. States `status_phase…` setzen |
| `uobStart` | 1. RPC `onboarding_start` 2. State `onboarding_id` 3. RPC „RPC GetStatus“ 4. Trigger Workflow Start Event (Run JS `startOnboardingWorkflow(…, onboarding_id, run_token)`) |
| `uobWorkflowStart` | 1. **n8n `onboarding_start_workflow`** (API Connector, mit `onboarding_id` und `run_token`) 2. Kanal `onboarding_realtime` abonnieren 3. Go to page onboarding |
| `uobSelect` | je nach `kind`: RPC `onboarding_set_candidate_selected` (brands), `onboarding_set_topic_selected` (topics), `onboarding_set_prompt_selected` (prompts) |
| `uobTopics` | **n8n `onboarding_prompts`** (API Connector, mit `topic_ids` und `new_topics` als Komma-Text) |
| `uobStep` | nur bei `plan`: RPC `get_billing_plans`, dann Run JS (`setOnboardingPlans`) |
| `uobFinish` | 1. Edge Function `create-onboarding-checkout` (`plan_id`, `billing_interval`, `brand_ids`, `topic_ids`, `prompt_ids`, `trial`) 2. Open an external website (Stripe) |
| `uobLogout` | Logout SupabaseAuth, dann Seite `signup` |
| `uobDashboard` | Seite `index` |

Wichtig für die Prüfung:
- **`run_token` liegt heute im Browser:** Er kommt aus der RPC, steht im Run-JS-Schritt, geht durch
  ein JS-Ereignis zurück nach Bubble und von dort an den n8n-Webhook.
- **`trial` kommt aus dem Browser** (die Komponente rechnet ihn aus den Tarifdaten), ebenso die
  gewählten Ids im Checkout.
- **`last_error` wird dem Nutzer wörtlich angezeigt.** Was n8n dort hineinschreibt, steht im Bild.

### 0.3 RPCs auf der Seite (Screenshots von Lukas)

Laut Lukas sind einige davon nicht mehr in Gebrauch oder gibt es gar nicht mehr. Bitte jede einzeln
klären (Abschnitt 2):

- `get_my_teams`, `get_my_teams copy 2` (zweiter Bubble-Aufruf derselben Funktion?)
- `onboarding_get_bundle`, `onboarding_start`
- `onboarding_set_candidate_selected`, `onboarding_set_topic_selected`, `onboarding_set_prompt_selected`
- `onboarding_save_selection`
- „RPC SaveStep1“, „RPC Submit“, „RPC GetStatus“, „RPC finalize_onboarding“ (Bubble-Namen, die
  Funktionsnamen dahinter bitte aus `pg_stat_statements` bzw. dem Bestand ableiten)
- `get_billing_plans`
- Edge Function `create-onboarding-checkout`
- Realtime-Kanal `onboarding_realtime`
- n8n: `onboarding_start_workflow`, `onboarding_prompts` (Webhooks), dazu laut Phasentabelle
  `onboarding_prompts_claim_v1` und eine Finalize-Funktion

---

## 1. Bestandsaufnahme (bitte mit Definition und echtem Beispiel)

1. **Tabellen:** Welche Tabellen tragen das Onboarding (Projekt, Kandidaten, Themen, Prompts,
   Auswahl, Läufe, Neustarts)? Spalten, Schlüssel, RLS, Trigger. Wie hängen sie an `auth.users`
   und, nach dem Abschluss, an Team, Firma, Topics und Prompts?
2. **Jede Funktion aus 0.3**, dazu alles, was `onboarding` im Namen trägt:
   - Definition, Parameter, `security definer`/`invoker`, `search_path`, Rechte (anon,
     authenticated, service_role);
   - was sie liest und schreibt; Ausgabeform; Fehlerverhalten;
   - Aufrufe in den letzten 30 Tagen (`pg_stat_statements`, Rolle);
   - md5 der Definition (für den Rückweg).
3. **`onboarding_get_bundle`:** die vollständige Antwort für (a) einen Nutzer ohne Onboarding,
   (b) `draft`, (c) mitten im großen Lauf, (d) `ready` mit Auswahl, (e) im Promptlauf, (f) mit
   Prompts, (g) `failed`. Woher kommt `restart`, und wie wird `allowed`/`remaining`/
   `next_allowed_at` gerechnet?
4. **`onboarding_start`:**
   - Was legt sie an oder setzt sie zurück?
   - Wie entsteht `run_token`, wo wird er gespeichert, wie lange gilt er, wer prüft ihn?
   - Was passiert mit einem älteren Onboarding desselben Nutzers (löschen, archivieren)?
   - Neustart-Grenze: Wie viele Onboardings bzw. Neustarts je Nutzer und Zeitraum?
   - Ein Nutzer, der schon Teams hat („Create new team“): gleiche Regeln?
5. **n8n, Start-Workflow** (`onboarding_start_workflow`):
   - Welche Felder nimmt er, wie authentifiziert sich der Aufrufer (gar nicht? Header? Token im
     Body?), wie ruft er die DB zurück (Schlüssel, Funktionen)?
   - Was holt er von der Website (Crawler, welche Seiten, Grenzen), welche Modelle ruft er, mit
     welchen Eingaben (Markenname, Website-Text)?
   - Was schreibt er in welcher Reihenfolge (Kandidaten, Themen, Phasen, `last_error`)?
   - Laufzeit, Kosten je Lauf (Größenordnung), Zeitüberschreitung, was bei Absturz bleibt.
6. **n8n, Prompt-Workflow** (`onboarding_prompts`): dieselben Fragen. Dazu: Wie werden eigene
   Themen (`new_topics`, Komma-Text) angelegt? Was passiert bei einem zweiten Aufruf mit derselben
   Themenauswahl, mit einer anderen, oder während der erste noch läuft?
7. **Realtime `onboarding_realtime`:**
   - Postgres Changes oder Broadcast? Öffentlich oder privat?
   - Welche Zeile oder Nutzlast kommt an, und kann ein anderer Nutzer mithören (Kanalname
     erratbar, Filter nur im Client)?
8. **Auswahl:**
   - Die drei `onboarding_set_*_selected`: Prüfen sie, dass die Id zum Onboarding des Nutzers
     gehört? Höchstens fünf Wettbewerber auch in der DB?
   - Die Prompt-Auswahl: Gibt es eine Grenze (Planlimit)?
   - Wofür war `onboarding_save_selection`?
9. **Tarife und Kasse:**
   - `get_billing_plans`: Quelle, Felder, wer darf lesen.
   - `create-onboarding-checkout` (Quelltext): Welche Felder nimmt sie wirklich? Woher kommen
     Preis, Testphase und Auswahl: aus dem Body oder aus der DB? `success_url`/`cancel_url`?
   - Was passiert nach der Zahlung: Webhook → Finalize (Phase 95 → 100)? Welche Funktion legt
     Team, Firma, Wettbewerber, Topics, Prompts und Zeitpläne an? Ist das idempotent (Stripe
     schickt Ereignisse mehrfach)?
   - Wohin kommt der Nutzer nach der Kasse zurück, und was sieht er, solange Finalize läuft?
   - Abbruch der Kasse: Was bleibt, und kann er weitermachen?
10. **`get_my_teams`:** Wofür braucht die Seite das (Dashboard-Knopf, Weiterleitung)? Was liefert
    es für einen Nutzer ohne Team?
11. **Datenlage:**
    - Wie viele Onboardings gibt es, je Status?
    - Wie viele hängen seit mehr als einer Stunde in einer laufenden Phase?
    - Wie viele Nutzer haben mehr als ein Onboarding, wie viele Testphasen?
    - Gibt es Onboardings ohne Nutzer (gelöschte Konten)?

## 2. Aufräumliste (bitte vorschlagen, nicht ausführen)

Für jede Funktion, jeden Trigger und jede Tabelle des Onboardings eine Zeile:

| Name | Zustand (in Gebrauch / nur Bubble / tot / existiert nicht) | Aufrufe 30 Tage | ersetzt durch | Vorschlag (bleibt / nach Umbau löschen / sofort löschen) |

- Löschen nur mit Sicherung (`_aufraeumen_fn_backup`) und Rückweg, wie in
  `AUFRAEUMEN_NACH_UMBAU.md`.
- „Sofort“ nur für Funktionen ohne Aufruf in 30 Tagen **und** ohne Verweis aus anderen Funktionen,
  Triggern, Cron-Jobs oder Edge Functions.
- Bitte auch nachsehen, ob tote Funktionen noch Rechte für anon tragen. Dann ist das ein Befund für
  Abschnitt 3, kein Aufräumpunkt.

## 3. Missbrauchs- und Fehlerprüfung (Schwerpunkt)

Bitte jeden Punkt mit Test im Rollback, Befund und Schwere.

1. **Fremde Daten:**
   - Kann ein Nutzer mit einer fremden `onboarding_id`, Kandidaten-, Themen- oder Prompt-Id lesen
     oder schreiben?
   - Was verrät eine fremde Id (Fehlertext, Zeitverhalten)?
   - Realtime: Kann man Status oder Inhalte fremder Onboardings mithören?
2. **`run_token` und Webhooks:**
   - Kann jemand mit der Webhook-Adresse (steht in Bubble, also im Browser-Verkehr erreichbar?) und
     einer erratenen oder alten `onboarding_id` einen Lauf starten?
   - Kann er einen Lauf für ein fremdes Onboarding starten, einen laufenden zweimal starten oder
     einen fertigen neu anstoßen?
   - Prüft n8n den Token? Gilt er nur einmal?
   - Wird `run_token` in Logs, Antworten oder im Realtime-Kanal sichtbar?
3. **Kosten (Spam):**
   - Jeder Start kostet Crawl und Modellaufrufe, jeder Topic-Wechsel einen Promptlauf.
   - Was kostet ein Nutzer, der 50-mal neu startet, 50-mal die Themen wechselt oder mehrere Konten
     anlegt?
   - Grenzen je Nutzer, je E-Mail-Domain, je Website-Domain und global je Stunde; parallele Läufe
     je Nutzer (höchstens einer).
   - Gleiche Website kurz hintereinander: Ergebnis wiederverwenden statt neu crawlen?
4. **Testphasen-Missbrauch (Fraud):**
   - Kann ein Nutzer über „Create new team“ oder neue Konten beliebig viele Testphasen holen?
   - Bitte vorschlagen: eine Testphase je Nutzer, je Website-Domain und je Zahlungsmittel
     (Stripe-Fingerprint), so weit machbar.
   - `trial` und Preis dürfen nie aus dem Browser kommen.
5. **Eingaben:**
   - **Markenname:** Länge, Steuerzeichen, unsichtbare Zeichen, Bidi, Homoglyphen, Emoji,
     HTML/Script (`<script>`, `javascript:`), Formel-Anfang (`=`, `+`, `-`, `@`) für spätere
     Exporte; nur Leerzeichen.
   - **Website:** nur `http(s)`; Länge; Host mit Punkt; Punycode. Kein `localhost`, keine IP,
     keine privaten Netze, kein `user:pass@`, kein Port außer 80/443, keine internen Hosts
     (`*.internal`, `*.supabase.co`, Metadaten-Adressen).
     **Das ist eine SSRF-Frage:** Der Crawler in n8n ruft die Adresse ab. Bitte sagen, was er
     heute abruft, ob er Weiterleitungen folgt (auch auf interne Ziele) und mit welcher Grenze
     für Größe und Zeit.
   - **Markt, Zeitzone, Geschäftsmodell:** nur bekannte Werte (Liste in der DB, nicht frei).
   - **Eigene Themen:** höchstens fünf, je max. 40 Zeichen, dieselbe Zeichenprüfung.
     Achtung: Ein Komma im Namen zerlegt heute den Komma-Text in zwei Themen. Vorschlag: als Liste
     (`text[]`) statt als Komma-Text.
   - Vorschlag wie beim Marken-Editor: NFKC, `btrim`, unsichtbare Zeichen entfernen, abweisen statt
     still kürzen.
6. **Prompt-Injection:**
   - Markenname, Website-Inhalt und eigene Themen gehen in Sprachmodelle.
   - Sie dürfen dort nur als abgegrenzte Daten stehen, nie als Anweisung.
   - Bitte die Prompts in beiden n8n-Workflows prüfen.
   - Kann eine präparierte Website die Wettbewerber-, Themen- oder Prompt-Liste mit beliebigem
     Text füllen (Länge, Links, HTML)? Was die Modelle zurückgeben, braucht dieselbe
     Zeichenprüfung wie eine Nutzereingabe, bevor es gespeichert wird.
7. **Fehlertexte:**
   - `last_error` erscheint wörtlich im Bild.
   - Vorschlag: n8n schreibt einen **Code** (`website_unreachable`, `website_blocked`,
     `website_empty`, `analysis_failed`, `timeout`, …), die Oberfläche macht daraus einen Satz.
   - Rohtext von n8n oder Modellen geht nie an den Nutzer.
8. **Hängende Läufe:**
   - Was passiert, wenn n8n abstürzt oder nie antwortet? Heute dreht das Ladebild ohne Ende.
   - Vorschlag: Fristen je Phase und ein Aufräumer (wie `_job_reaper_v1`), der den Lauf auf
     `failed` mit Code `timeout` setzt. Danach darf der Nutzer neu starten, ohne dass es als
     Neustart zählt.
9. **Rennen und Doppelklicks:**
   - zweimal Absenden, zwei Tabs;
   - Auswahl während des Promptlaufs;
   - Neustart während eines Laufs (das Tor sperrt nur im Browser);
   - Kasse zweimal öffnen;
   - Finalize zweimal (Webhook-Wiederholung).
10. **Abschluss:**
    - Legt Finalize nur an, was zum Onboarding des Nutzers gehört?
    - Werden die Grenzen des gekauften Plans eingehalten (Wettbewerber, Prompts)?
    - Wird die Auswahl aus der DB gelesen (nicht aus der Kasse)?
11. **Konto gelöscht oder Team verlassen:** Was passiert mit einem offenen Onboarding und einem
    laufenden Lauf?

## 4. n8n: Auth und Anbindung neu (Vorschlag nach dem Muster `start-job`)

**Der Browser spricht nie mit n8n und sieht nie einen Token.**

1. **Start über eine Edge Function `onboarding-start`:**
   - Sie prüft das Formular und legt den Lauf an. Ein Neustart mit seiner Grenze geschieht atomar
     in einer DB-Funktion.
   - Sie erzeugt den Lauf-Token serverseitig und ruft den n8n-Webhook mit einem **geheimen
     Header** (Secret aus dem Vault bzw. den Function-Secrets). Den Token bekommt n8n im Body.
   - Antwort an den Browser: `{onboarding_id, status, status_phase}`, **ohne Token**.
   - Ein zweiter Start, solange einer läuft, gibt den laufenden zurück (`reused: true`).
2. **Prompt-Lauf über eine Edge Function `onboarding-prompts`:**
   - Gleiche Bauart.
   - Die Themenauswahl liest die DB selbst, eigene Themen kommen als Liste.
   - Gleiche Auswahl wie beim letzten fertigen Lauf: nichts neu erzeugen.
3. **n8n meldet sich zurück:**
   - nur über Funktionen für `service_role` mit Token-Prüfung und erlaubten Übergängen;
   - Vorschlag: `onboarding_run_update_v1(p_onboarding, p_run_token, p_phase, p_error_code)` und je
     ein Schreibweg für Kandidaten, Themen und Prompts;
   - kein direkter Tabellenzugriff mehr.
4. **Webhooks in n8n:**
   - Header-Auth;
   - der alte, offene Aufruf wird nach der Umstellung abgeschaltet, nicht vorher;
   - n8n prüft den Token gegen die DB, bevor es arbeitet.
5. **Realtime:**
   - Broadcast `onboarding:<onboarding_id>`, Ereignis `onboarding_status`.
   - Nutzlast nur `{status, status_phase, progress_percent, error_code}`, keine Inhalte.
   - Ob öffentlich (Id nicht erratbar) oder privat mit Policy, entscheidest du. Die Oberfläche kann
     beides (core: `kanal(topic, {privat})`).
6. Bitte liste, welche n8n-Workflows du dafür von Lukas als Export brauchst.

## 5. Vorschlag (noch nicht bauen)

Alle Funktionen ohne `p_team`, der Nutzer kommt aus `auth.uid()`.

| Funktion | Zweck |
|---|---|
| `onboarding_bundle_v1()` | ersetzt `onboarding_get_bundle`. `meta`: `restart{has_onboarding, run_in_progress, allowed, remaining, next_allowed_at}`, `limits{name_max, website_max, competitors_max, own_topics_max, topic_max}`, Listen der erlaubten Märkte, Zeitzonen und Geschäftsmodelle. `row`: `project{onboarding_id, status, status_phase, progress_percent, error_code, company_name, website_input, website_url, website_domain, market, timezone, business_model, created_at, updated_at}`, `competitors[{id, name, domain, favicon_url, selected}]`, `topics[{id, name, description, hex_light, hex_dark, selected, is_own}]`, `prompts[{id, prompt_text, market, topic_ids, primary_topic_id, selected}]`. Kein Onboarding: `row: null`, kein Fehler. |
| `onboarding_status_v1(p_onboarding)` | nur Status (für das Nachladen nach einem Wiederverbinden) |
| `onboarding_save_v1(p_onboarding, …Formular…)` | Entwurf speichern (falls gewollt; sonst nur über `onboarding-start`) |
| `onboarding_select_v1(p_onboarding, p_kind, p_ids uuid[])` | ersetzt die drei `set_*_selected`: die **vollständige** Auswahl einer Art (so schickt sie die Seite heute); Grenzen in der DB; antwortet mit der gespeicherten Auswahl |
| `onboarding_restart_v1(p_onboarding)` | nur falls der Neustart nicht in `onboarding-start` aufgeht |
| `billing_plans_v1()` | ersetzt `get_billing_plans` (Felder wie heute: `id, name, monthly_price_eur, yearly_price_eur, prompts_per_day, competitors_max_active, trial_days, sort_order`, dazu `ai_responses_per_month`, `trial_eligible` **für diesen Nutzer**) |
| Edge `onboarding-start`, `onboarding-prompts` | Abschnitt 4 |
| Edge `create-onboarding-checkout` (überarbeitet) | Body nur `{onboarding_id, plan_id, billing_interval}`. Auswahl, Preis und Testphase aus der DB. Antwort `{url}`. |

**Fehler** (`message` = Code, `hint` = Grund):

| SQLSTATE | message | hint |
|---|---|---|
| 28000 | `onboarding_not_authenticated` | – |
| PT404 | `onboarding_not_found` (auch fremd) | – |
| 22023 | `onboarding_invalid` | `name_empty` / `name_too_long` / `name_characters` / `website_invalid` / `website_blocked` / `market` / `timezone` / `business_model` / `topic_too_long` / `topic_characters` / `too_many_topics` / `too_many_competitors` |
| PT409 | `onboarding_busy` | ein Lauf läuft (Phase) |
| PT429 | `onboarding_rate_limited` | Sekunden |
| PT429 | `onboarding_restart_limited` | `next_allowed_at` |
| PT402 | `onboarding_trial_used` | – |
| PT409 | `onboarding_checkout_open` | die Kasse läuft schon (URL wiederverwenden) |

**Läufe** schreiben nur `error_code`, nie Rohtext. Die Oberfläche übersetzt.

---

## Dazu bitte

1. die Antworten auf 1 bis 4, Befunde nach Schwere (sofort / vor dem Umbau / mit dem Umbau);
2. die Aufräumliste aus Abschnitt 2;
3. den Vorschlag aus 5, angepasst an deine Befunde, als `ONBOARDING_V1_VORSCHLAG.md`;
4. die Liste der n8n-Workflows, die Lukas dir als Export schicken soll;
5. echte, ungekürzte Antworten von `onboarding_get_bundle` für die Fälle aus 1.3. Bitte aus Prod,
   aus bestehenden Onboardings oder in einer Transaktion mit Rollback angelegt, keine erfundenen.
   Damit messe ich die heutige Komponente gegen die heutige Form, bevor sie umgestellt wird.

**Hilfsabfragen** (anpassen, wo die Namen abweichen):

```sql
-- A) Alle Onboarding-Funktionen mit Rechten und Aufrufen
select p.oid::regprocedure as fn, p.prosecdef, p.proconfig,
       has_function_privilege('anon', p.oid, 'execute') as anon,
       has_function_privilege('authenticated', p.oid, 'execute') as authed,
       md5(pg_get_functiondef(p.oid)) as md5
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('public','app') and p.proname ~* '(onboard|billing_plan|my_teams|finaliz|save_?step|submit|get_?status)'
order by 1;

-- B) Aufrufe der letzten Zeit
select r.rolname, s.calls, round(s.mean_exec_time::numeric, 1) as ms, left(s.query, 160) as q
from pg_stat_statements s join pg_roles r on r.oid = s.userid
where s.query ~* '(onboard|billing_plan|my_teams|finaliz)'
order by s.calls desc limit 60;

-- C) Tabellen, Trigger, Policies
select event_object_table, trigger_name, action_timing, event_manipulation, action_statement
from information_schema.triggers
where event_object_table ~* 'onboard' order by 1, 2;
select schemaname, tablename, policyname, cmd, roles, qual, with_check
from pg_policies where tablename ~* 'onboard' order by 2, 3;

-- D) Realtime: Veröffentlichung und Kanäle
select * from pg_publication_tables where tablename ~* 'onboard';

-- E) Cron
select jobid, schedule, command from cron.job where command ~* 'onboard';
```
