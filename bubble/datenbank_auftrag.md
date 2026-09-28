# Auftrag an den Datenbank-Chat (upstreem, Stand 28.09.2026)

Diesen ganzen Text als erste Nachricht in den Datenbank-Chat geben. Er ist in sich vollständig:
der Datenbank-Chat hat das Frontend-Repo nicht, alles, was er über die Oberfläche wissen muss,
steht hier.

---

## 0. Wer du bist und wie du arbeitest

Du betreust die Datenbank von upstreem: Supabase (Postgres), eigene Funktionen im Schema `app`
(bestätigt am 28.09.; ältere Unterlagen sagen `public`, das ist überholt). Die Oberfläche ist eine
Bubble.io-App. Bubble ruft deine Funktionen über den API Connector auf und reicht die Antworten an
JavaScript-Komponenten weiter. Diese Komponenten lesen **feste Feldnamen**. Ein umbenanntes oder
fehlendes Feld bricht die Anzeige still.

**Regeln, ohne Ausnahme:**

1. **Nichts raten.** Bevor du eine Funktion änderst, fragst du mich nach ihrem exakten Namen,
   wenn er hier als `[NAME ERFRAGEN]` markiert ist. Dann holst du ihre aktuelle Definition
   (`select pg_get_functiondef('app.NAME'::regproc);`) und die Struktur der beteiligten Tabellen.
   Erst dann schreibst du SQL. Fehlt dir ein Tabellen- oder Spaltenname, fragst du oder schaust
   nach; du erfindest keinen.
2. **Erst Bestandsaufnahme, dann Änderung.** Jeder Abschnitt beginnt mit Leseabfragen. Das
   Ergebnis zeigst du mir, bevor du etwas änderst.
3. **Ein Bereich nach dem anderen.** Zu jeder Änderung gehören:
   - das vollständige `create or replace` (keine Teilstücke);
   - die alte Definition als Rückweg;
   - eine Testabfrage mit erwartetem Ergebnis.

   Ich führe aus und melde zurück.
4. **Rückgabeformen nie brechen.** Felder dürfen dazukommen. Umbenennen oder Entfernen nur, wo es
   hier ausdrücklich steht.
5. **Kein `raise exception` für "kein Zugang".** Bubble zeigt bei jedem Fehler ein Popup, auf
   jeder Seite. Die Rückgabeform für "kein Zugang" steht in Abschnitt 1.
6. **`security definer` immer mit `set search_path`**, und Rechte ausdrücklich: `revoke` von
   `public`/`anon`, `grant` nur, wer es braucht.
7. **Text, der durch Bubble läuft, hat drei Gifte** (Grund: Abschnitt 6):
   - den Backtick `` ` ``;
   - die Zeichenfolge `${`;
   - den Backslash `\`.
   Wo eine Funktion Freitext liefert (Namen, Titel, Modelltext), achtest du darauf.

**Bevor du irgendetwas änderst, schick mir die Ergebnisse dieser vier Abfragen und die Liste der
Namen, die du von mir brauchst:**

```sql
-- A) Alle eigenen Funktionen: Argumente, Rückgabe, und ob die Zugangsprüfung schon drinsteht
select p.proname,
       pg_get_function_identity_arguments(p.oid) as argumente,
       pg_get_function_result(p.oid)             as rueckgabe,
       p.prosecdef                               as security_definer,
       pg_get_functiondef(p.oid) ilike '%team_has_access%' as hat_zugangspruefung
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'app' and p.prokind = 'f'
order by 1;

-- B) Gibt es team_access / team_has_access, und wie sehen sie aus?
select pg_get_functiondef('app.team_access'::regproc);
select pg_get_functiondef('app.team_has_access'::regproc);

-- C) Trigger auf auth.users (dort darf nach Abschnitt 2 nur noch stehen, was gewollt ist)
select tgname, pg_get_triggerdef(t.oid)
from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'auth' and c.relname = 'users' and not t.tgisinternal;

-- D) Wer darf welche Funktion ausführen?
select routine_name, grantee, privilege_type
from information_schema.routine_privileges
where routine_schema = 'app'
order by routine_name, grantee;
```

**Reihenfolge der Arbeit:**
1. Abschnitt 1, Zugangssperre in allen Daten-Funktionen (Sicherheit).
2. Abschnitt 3, Team-Rechte auf dem Server (Sicherheit).
3. Abschnitt 2, Registrierung nur per Einladung (Sicherheit).
4. Abschnitt 4, Einladungsseite.
5. Abschnitt 5, Billing und Quota.
6. Abschnitt 6, Freitext in Antworten.
7. Abschnitt 7, Mira.
8. Abschnitt 8, Kleinere Punkte.

---

## 1. Zugangssperre in ALLEN Daten-Funktionen

**Lage.** Ein Team ohne Zugang (gelöscht, Abo beendet, Zahlung offen, Testphase vorbei, kein
Tarif) bekommt in der App ein Sperrfenster. Das ist nur das Schild. Das Schloss bist du: jede
Funktion, die Team-Daten liefert, muss sie für so ein Team verweigern. Laut dem Nutzer steht die
Prüfung bisher nur in den zwei großen Funktionen.

**Die Quelle des Urteils** ist genau eine Funktion:
- `app.team_access(p_team_id uuid) returns table(has_access boolean, access_state text,
  access_ended_at timestamptz)`;
- `app.team_has_access(p_team_id uuid) returns boolean` als Kurzform.

Prüfe mit Abfrage B, dass es beide gibt:
- `access_state` ist einer von `active | deleted | past_due | trial_ended | no_plan | ended`.
- Ein Löschdatum in der Zukunft heißt: Zugang bis dahin. Also `deleted_at <= now()`, nicht
  `is_deleted`.
- Befund aus der Vorlage: `team_access` prüft NICHT, ob der Aufrufer Mitglied des Teams ist. Die
  Wache muss das also nicht leisten; die Mitgliedschaft prüfen die Funktionen selbst (Abschnitt 3).

**Die Quota-Funktion `app.get_team_plan_quota`** (läuft bei jedem Seitenaufbau) liefert neben
ihren 8 Spalten die 7 für das Sperrfenster. Prüfe nur, dass das so ist; laut Nutzer funktioniert
es:
`team_id, team_name, has_access, access_state, access_ended_at, can_manage_billing, billing_interval`
(freiwillig `monthly_price_eur`, `yearly_price_eur`).
- Immer GENAU eine Zeile, auch ohne Tarif (Tarif per LEFT JOIN).
- Die Quota-Funktion selbst bekommt KEINE Wache: sie ist es, die das Sperrfenster auslöst.

**Deine Aufgabe:**
1. Aus Abfrage A die Liste aller Funktionen mit Team-Bezug ohne Prüfung (`hat_zugangspruefung =
   false`).
   - Achtung: Der Parameter heißt nicht überall `p_team_id` (bekannt: `p_team` in
     `cached_prompt_topics_grouped_v1`).
2. Davon **ausnehmen** (diese dürfen ohne Wache laufen):
   - `team_access`, `team_has_access`, `get_team_plan_quota`;
   - die Abo-Funktion `get_team_billing_status_v1` und die Tarif-Funktion `[NAME ERFRAGEN]`;
   - Checkout- und Portal-Sitzungen (Stripe);
   - die Teamliste der Seitenleiste, das Nutzerprofil, Team anlegen, Team wechseln;
   - alles rund um Einladungen und Registrierung;
   - Team verlassen und Team löschen (das Team muss man auch ohne Abo loswerden können);
   - die Onboarding-Funktionen (bekannt: `onboarding_start_v1`, `onboarding_prompts_claim_v1`,
     dazu eine Finalize-Funktion `[NAME ERFRAGEN]`).
3. Die Liste zeigst du mir. Ich bestätige, dann setzt du die Wache als ERSTE Anweisung ein, in der
   Form, die zum Rückgabetyp passt:
   - **json/jsonb:**
     `if not app.team_has_access(p_team_id) then return json_build_object('ok', false, 'error', 'no_access'); end if;`
   - **table / setof / void (plpgsql):** `if not app.team_has_access(p_team_id) then return; end if;`
   - **language sql:** `and app.team_has_access(p_team_id)` in die WHERE-Klausel.
4. **Funktionen am Nutzer statt am Team** (Mira-Chats, Chatliste, Nachrichten) haben kein Team im
   Argument. Frag mich, ob sie eine Wache bekommen sollen, und wenn ja, über welches Team.
5. **Hintergrundläufe** (Prompt-Läufe per Cron/Edge Function) nur für Teams mit Zugang:
   `... where app.team_has_access(t.id)`.
   - Frag mich nach dem Namen der Funktion oder Edge Function, die die Läufe startet.
6. **Eine Wahrheit:** Auch die Abo-Funktion `get_team_billing_status_v1` soll ihr Feld
   `has_active_access` aus `team_access` nehmen:
   `(select a.has_access from app.team_access(p_team_id) a)`. Sonst sagt die Billing-Seite etwas
   anderes als das Sperrfenster.
   - Dasselbe gilt für `active_billing_plan` ("yes"/"no") in der Teams-Funktion
     `[NAME ERFRAGEN]`. Frag mich, ob es daraus abgeleitet werden soll.

**Abnahme:**
- Mit einem Team ohne Zugang (der Nutzer hat einen alten Test-Account mit gelöschtem Team)
  liefert jede bewachte Funktion `ok:false/no_access` bzw. keine Zeilen.
- Mit einem Team mit Zugang liefert sie unverändert.

---

## 2. Registrierung nur per Einladung

**Lage (Sicherheitslücke).** Auf dem Server ist noch nichts umgesetzt.
- Mit dem öffentlichen Schlüssel kann jeder `POST /auth/v1/signup` schicken und hat ein Konto.
- "Login with Google" mit einer neuen Adresse legt ebenfalls ein Konto an, solange Registrierungen
  erlaubt sind.
- Die Oberfläche lässt die Registrierung schon nur noch mit Einladungslink zu. Das ist aber nur
  Oberfläche.

**Ziel:**
- Konten entstehen nur für eingeladene Adressen.
- Wer ein Konto hat, meldet sich weiter mit Passwort oder Google an.
- Eingeladene registrieren sich über den Link `/signup?token=…&email=…` mit Name und Passwort.

**Was die Oberfläche schickt** (Bubble nimmt es entgegen und ruft den Server):
- Ereignis `uauSubmit`: `{mode: "login"|"signup", token, code, email, opt_in: "yes"|"no"}`.
  `code` ist seit dem 25.09. immer leer; alt, ignorieren.
- Das Passwort und der Name kommen NICHT im JSON, sondern als eigene Rohwerte über die Ereignisse
  `uauPassword` und `uauName`, unmittelbar vor `uauSubmit`.
- Fehler zeigt Bubble mit `setAuthPageError(instanceId, "form", text)`. Der Text erscheint
  wörtlich beim Nutzer, also als ganzer englischer Satz, keine technische Meldung.
- Der Google-Knopf steht nur im Login, nicht in der Registrierung.

**Zwei Wege, du empfiehlst einen und begründest:**
- **Weg A (so war es am 25.09. geplant):**
  1. In Supabase "Allow new users to sign up" AUS (Authentication, Sign In / Providers bzw. User
     Signups; prüf, wo der Schalter in dieser Version steht).
  2. Eine Edge Function `signup-with-invite` legt Eingeladene mit dem Service-Role-Schlüssel an:
     `auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name } })`.
     `email_confirm: true` ist wichtig: die Einladung ging an genau diese Adresse, und nur eine
     bestätigte Adresse verknüpft Supabase später mit einem Google-Login.
  3. Vorher prüft die Funktion die Einladung. Danach löst sie sie ein: Mitgliedschaft anlegen,
     Einladung auf `accepted`, Protokolleintrag `invite_accepted`.
  4. Folge: Google mit einer unbekannten Adresse wird von Supabase abgewiesen. Ein Eingeladener
     kann sich aber auch nicht per Google REGISTRIEREN, nur danach per Google anmelden.
- **Weg B (prüfen, ob in dieser Supabase-Version verfügbar):** Der Auth-Hook "Before User Created"
  (Postgres-Funktion oder HTTP).
  1. Registrierungen bleiben an. Der Hook lehnt jedes neue Konto ab, dessen Adresse keine offene,
     nicht abgelaufene Einladung hat, und zwar für jeden Weg, also auch Google.
  2. Dann kann sich ein Eingeladener auch direkt per Google registrieren.
  3. Wenn es den Hook gibt, ist das der sauberere Weg. Du prüfst die Verfügbarkeit, bevor du ihn
     empfiehlst, und erfindest keine Konfiguration.

**Dabei unbedingt:**
- **Alte Trigger löschen.** Aus einer früheren Lösung mit Registrierungscodes können auf
  `auth.users` die Trigger `signup_gate` und `signup_gate_after` (Funktionen `auth.signup_gate()`
  und `auth.signup_gate_after()`) liegen; Abfrage C zeigt es. Die Trigger müssen weg. Die alten
  Tabellen `signup_codes` und `signup_code_reservierungen` dürfen liegen bleiben.
- **Die Einladungstabelle** `[NAME ERFRAGEN]`, im alten Entwurf `team_invites` mit `token,
  invited_email, status, expires_at, team_id, invited_role, accepted_at, revoked_at`. Die Prüfung
  der Einladung:
  - `token` = das übergebene Token (getrimmt);
  - `lower(invited_email)` = die Adresse;
  - `status = 'pending'`;
  - `expires_at` leer oder in der Zukunft.
  - Für alle Fehlfälle EIN Satz an den Nutzer: "This invitation is not valid anymore. Please ask
    your team for a new one."
- **Einlösen:** Es gibt vermutlich schon eine Funktion, die eine Einladung annimmt (das
  Team-Protokoll kennt das Ereignis `invite_accepted`). `[NAME ERFRAGEN]`. Die bestehende nehmen,
  keine zweite bauen.
- **Schema:** Ruft eine Edge Function mit supabase-js `.rpc("name")`, landet der Aufruf ohne
  Einstellung im Schema `public`. Für `app` muss der Client mit `{ db: { schema: 'app' } }` erzeugt
  werden.
- **Rechte:** Prüf- und Einlösefunktion nur für die Edge Function bzw. den Service
  (`revoke all … from public, anon, authenticated`).
- **Doppelt prüfen:** Was die Seite prüft (Name vorhanden, Adresse gültig, Passwort ≥ 8 Zeichen),
  prüft der Server noch einmal.
- **Werbe-Einwilligung:** `opt_in` mit Zeitpunkt speichern (`marketing_opt_in_at`), falls es die
  Spalte gibt; sonst fragen.

**Abnahme (alle fünf):**
1. `curl -X POST https://<projekt>.supabase.co/auth/v1/signup -H "apikey: <anon>" -H
   "Content-Type: application/json" -d '{"email":"fremd@example.com","password":"geheim123"}'`
   liefert einen Fehler (bei Weg A 422 "Signups not allowed"), kein Konto.
2. Google mit einer nie eingeladenen Adresse: abgewiesen, kein Konto in `auth.users`.
3. Registrierung über einen gültigen Einladungslink: Konto da, Mitglied im Team, Einladung
   `accepted`, Protokolleintrag da.
4. Derselbe Link ein zweites Mal: abgewiesen mit dem Satz oben.
5. Das eingeladene Konto meldet sich danach per Google an: es landet im SELBEN Konto.

---

## 3. Team-Rechte auf dem Server

**Lage.** Die Team-Verwaltung blendet für Mitglieder ohne Rechte Knöpfe und Listen aus. Das ist
nur Oberfläche: jede Funktion muss selbst prüfen, wer ruft (`auth.uid()`), ob er Mitglied des
Teams ist und welche Rolle er hat.

**Die Funktionen** (Namen alle `[NAME ERFRAGEN]`, im Frontend nur beschrieben):

| Zweck | Parameter aus der Oberfläche |
|---|---|
| Mitglieder lesen | team_id |
| Offene Einladungen lesen | team_id |
| Protokoll lesen | team_id |
| Einladen | team_id, email, role (`member`/`admin`) |
| Einladung erneut senden | team_id, invite_id, email, role |
| Einladung zurückziehen | team_id, invite_id, email |
| Mitglied entfernen | team_id, user_id, email |
| Rolle ändern | team_id, user_id, email, role (`member`/`admin`/`owner`) |
| Team verlassen | team_id, team_name |
| Team löschen | team_id, team_name |

**Die Regeln, die der Server erzwingen muss** (so zeigt es die Oberfläche):
- **member:**
  - keine einzige Aktion;
  - sieht KEINE offenen Einladungen und KEIN Protokoll. Beide Lese-Funktionen liefern einem
    member nichts: leere Liste bzw. `ok:false`, kein Fehler.
- **admin:**
  - darf einladen, Einladungen erneut senden und zurückziehen;
  - darf members entfernen und einen member zum admin machen;
  - darf admins und owner weder entfernen noch ihre Rolle ändern.
- **owner:**
  - darf alles;
  - nur der LETZTE owner darf weder entfernt werden noch seine Rolle abgeben.
- **Team löschen:** nur owner. Die Oberfläche fragt zusätzlich den getippten Teamnamen ab; der
  Server prüft die Rolle trotzdem.
- **Team verlassen:** darf jeder. Offen, frag mich: Darf der letzte owner gehen, ohne vorher
  jemanden zum owner zu machen?
- **Protokoll:** Jede Aktion schreibt einen Eintrag. Bekannte `event_type`:
  `member_invited, invite_accepted, invite_revoked, member_removed, role_changed`.
- **Offen, frag mich:** Mitglieder mit einer `@upstreem.ai`-Adresse (das Support-Team) kann in der
  Oberfläche niemand verwalten. Soll der Server das auch verhindern?
- **Widerspruch, frag mich:** Die Mitglieder-Antwort trägt `permissions {can_invite,
  can_manage_roles, can_manage_members}`. Beim Nutzer kam `viewer_role: "admin"` zusammen mit
  `can_manage_roles: false`. Die Oberfläche folgt inzwischen den Rollenregeln oben, nicht den
  Flags. Was soll auf dem Server gelten: Rolle oder Flag?

**Antwortformen, die die Oberfläche liest (nicht verändern, nur ergänzen):**
- **Mitglieder:** ein Objekt.
  - `members[]` ist Pflicht, sonst zeigt die Seite einen Lesefehler. Je Eintrag `role, email,
    user_id, joined_at, display_name`.
  - Dazu `permissions{…}`, `viewer_role`, optional `viewer_user_id`, `viewer_email`.
  - `pending_invites[]` in dieser Antwort kommt leer, obwohl Einladungen existieren. Die
    Oberfläche nimmt dafür die eigene Einladungs-Antwort. Wenn du willst, füll es richtig; nötig
    ist es nicht.
- **Einladungen:** `{count, invites[]}` oder eine reine Liste.
  - Je Eintrag: `invite_id, invited_email, invited_role, status, created_at, created_by,
    created_by_email, expires_at, revoked_at, revoked_by, accepted_at, accepted_by`.
  - Angezeigt werden nur offene.
- **Protokoll:** Liste oder `{logs:[…]}`.
  - Je Eintrag: `log_id, created_at, event_type, actor_user_id, actor_email, actor_display_name,
    target_user_id, target_email, meta{…}`.

**Abnahme:** Mit einem member-Konto liefern Einladungs- und Protokoll-Funktion nichts, und jede
Aktions-Funktion lehnt ab (Rückgabe `ok:false`, kein Fehler-Popup). Mit admin und owner gelten
genau die Regeln oben.

---

## 4. Einladungsseite

**Lage.** Die Seite `/invite?token=…&email=…` ruft beim Laden `get_team_invite_by_token_v2`
(Name bestätigt; Schema erfragen).

**Was die Seite liest:**
- `ok` (true/false);
- `brand_name` bzw. `team_name` und `brand_logo`;
- `inviter_name` und `role` (oder `invited_role`), beide optional;
- `status`, `expires_at`, `revoked_at`, `accepted_at`.

**Wie die Seite den Zustand übersetzt:**
- `status`:
  - `revoked`/`cancelled` heißt zurückgezogen;
  - `accepted`/`used` heißt schon benutzt;
  - `expired` heißt abgelaufen;
  - `pending` heißt gültig.
- Ein `expires_at` in der Vergangenheit zählt als abgelaufen, auch wenn `status` noch `pending`
  sagt.
- Bei einer Fehlerhülle von Supabase (`{"code":"P0001","message":"…"}`) übersetzt die Seite die
  Meldung nach Stichwort in einen Satz für den Nutzer:
  - `expired` wird zu "abgelaufen";
  - `revoked`/`cancel` zu "zurückgezogen";
  - `accepted`/`already`/`used` zu "schon benutzt";
  - `invalid`/`not found`/`unknown`/`token` zu "Link ungültig";
  - alles andere zum allgemeinen Satz.

**Aufgaben:**
1. **Bei nicht mehr offener Einladung** heute der Fehler "invite not pending". Der trifft kein
   Stichwort, also sieht der Nutzer nur den allgemeinen Satz. Besser: Gibt es die Einladung, die
   Zeile MIT `status`, `expires_at`, `revoked_at`, `accepted_at` zurückgeben (`ok:false`) statt
   zu werfen. Dann zeigt die Seite den genauen Grund. Nur ein wirklich unbekanntes Token darf
   werfen; dann mit `invalid invite token`.
2. **Annehmen:** Der Knopf "Accept" läuft über einen Bubble-Workflow, der eine Annahme-Funktion
   ruft (`[NAME ERFRAGEN]`, vermutlich dieselbe wie in Abschnitt 2). Deren Fehlertext zeigt die
   Seite WÖRTLICH. Also als ganzen englischen Satz für den Nutzer, nicht als technische Meldung,
   und mit den Stichwörtern oben, falls es um Ablauf, Rückzug oder doppelte Annahme geht.
3. **Rechte:** Die Einladungs-Funktionen bekommen keine Zugangswache aus Abschnitt 1.

---

## 5. Billing und Quota: der Teamname

**Lage.** `get_team_billing_status_v1` liefert `{ok, team_id, team_name, …, billing:{…}}`, und
`get_team_plan_quota` hat jetzt ebenfalls `team_name`. Der Teamname ist Nutzereingabe. Warum das
gefährlich ist, steht in Abschnitt 6. Kurz:
- ein `"` im Namen kann den Datensatz beschädigen;
- ein Backtick oder `${` tötet den ganzen Bubble-Schritt, samt allen anderen Komponenten darin.

**Aufgabe:** In BEIDEN Funktionen den Teamnamen so ausliefern, dass er die drei Gifte nicht
trägt:
- mindestens Backtick und `${` entfernen;
- für `"` und `\` dieselbe Behandlung wie in `get_mira_chat_messages` (dort ist sie laut Nutzer
  schon drin: die Backslashes des fertigen JSON-Textes werden als LETZTER Schritt verdoppelt).

Schau dir `get_mira_chat_messages` an und übernimm deren Weg, statt einen neuen zu erfinden. Wenn
eine der zwei Funktionen den Teamnamen gar nicht braucht, frag mich, ob er raus kann. Das
Sperrfenster zeigt ihn im Satz "The subscription for <Team> …"; fehlt er, steht dort "this team".

**Weiter im Blick:**
- Die Abo-Funktion nimmt `has_active_access` aus `team_access` (Abschnitt 1, Punkt 6).
- Nach einer Zahlung kann der Stripe-Webhook ein paar Sekunden nachlaufen. Die Oberfläche fragt
  die Quota danach erneut ab; du musst dafür nichts tun, solange `team_access` den Webhook-Stand
  liest.

---

## 6. Freitext in Antworten: die drei Gifte

Bubble setzt Antworten in einen JavaScript-Schritt, und zwar als Text zwischen zwei Backticks
(`` `…` ``). Darin sind drei Dinge in einem WERT gefährlich:
- ein **Backtick** beendet den Text vorzeitig: Syntaxfehler, der ganze Schritt stirbt, mit ihm
  jede Komponente, deren Aufruf im selben Schritt steht;
- **`${`** wird als Platzhalter ausgewertet: Fehler oder falscher Text;
- ein **Backslash** wird vom Backtick verschluckt. Im JSON wird aus `\"` so ein rohes `"`, aus
  `\n` ein roher Umbruch, und das JSON ist kaputt. Ein Wert, der auf `\` endet, frisst sogar das
  schließende Anführungszeichen.

Unkritisch sind: Anführungszeichen (sofern die Backslashes stimmen), Apostrophe, Umlaute,
Zeilenumbrüche, Emoji.

**Zwei Regeln für zwei Wege:**
- **Einzelne Felder, die Bubble in einen eigenen Text einsetzt:** Backtick und Backslash
  entfernen: `replace(replace(feld, chr(96), ''), chr(92), '')`, dazu `${` entschärfen
  (`replace(feld, '${', '$ {')`).
- **Ganze JSON-Antworten, die Bubble unverändert durchreicht:** als letzten Schritt auf den
  FERTIGEN Text die Backslashes verdoppeln, `replace(txt, chr(92), chr(92) || chr(92))`, und
  Backtick sowie `${` in den Freitext-Feldern entfernen. Vorbild: `get_mira_chat_messages`.

**Wo Freitext steckt** (bitte je Funktion prüfen, die Namen erfragen):

| Bereich | Freitext-Felder |
|---|---|
| Opportunities | reason, headline, lead_title, Namen in topics und mentioned_competitors (laut Nutzer am 22.09. erledigt; nur prüfen) |
| Mira-Nachrichten | content, content_html, actions[].label, actions[].payload.title/.reason/.question |
| Mira-Chatliste und Projekte | title, project_title |
| Einladung | brand_name / team_name, Meldungstexte |
| Quota und Abo | team_name (Abschnitt 5) |
| Team-Mitglieder | display_name (auch mit Emoji) |
| Weitere | URL-Detail (title, description, markdown_summary, company_name), Antworten (response_preview) |

Grundsatz: Eine Antwort soll keinen Sprachmodell-Text tragen, den die Oberfläche nicht anzeigt.
Ein Feld, das niemand liest, fliegt raus, statt es zu entschärfen (Beispiel: `chats.preview` im
Power-Dashboard).

---

## 7. Mira (nur der Datenbank-Teil)

1. **Nachrichten** (`get_mira_chat_messages`): Die Backslash-Verdopplung ist laut Nutzer drin.
   Prüfe zusätzlich, dass Backtick und `${` aus `content`, `content_html`, `actions[].label` und
   `actions[].payload.*` entfernt werden. Modelltext enthält Code-Beispiele mit Backticks.
2. **Chatliste** `[NAME ERFRAGEN]`:
   - Pflicht `id, title, updated_at`; optional `project_id, project_title, status, is_pinned`.
   - Blättern mit `p_offset`/`p_limit`; die Antwort trägt `sessions, next_offset, has_more`.
   - Sortierung stabil (`order by updated_at desc, id desc`).
   - **Offen, frag mich:** Kann eine Sitzung mit gerade laufender Antwort `status = 'running'`
     tragen? Dann zeigt Mira nach einem Neuladen bei ALLEN laufenden Chats den Kreisel, nicht nur
     beim offenen.
3. **Keine Datenbank-Aufgabe, nur zur Abgrenzung:** Die Realtime-Ereignisse
   (`mira_turn_started`, `mira_message_success`, `mira_message_error`, `mira_title_updated`,
   `mira_user_transcript`, `mira_progress`) schickt n8n auf den Kanal `mira_user_<user_id>`.
   Das gehört in den n8n-Chat, nicht zu dir.

---

## 8. Kleinere Punkte (nach den großen, jeweils erst fragen)

- **Prompts-Tabelle, Massenauswahl:** Bei "alle auswählen, außer …" schickt die Oberfläche
  `excluded_ids`. Die Funktion hinter der Massenaktion muss sie abziehen
  (`… and prompt.id not in (excluded_ids)`) und den Filter mit DERSELBEN WHERE-Klausel auflösen
  wie die Tabelle. Prüfen, ob das so ist.
- **Power-Dashboard-Funktion** (optional, Leistung): `avg_rank`, `avg_rank_delta`, `sentiment`,
  `sentiment_delta` bei den Marken werden nicht mehr gelesen. `totalCountDomain`/`totalCountUrl`
  (teure COUNTs) ebenso wenig. `chats.preview` entfällt. Bei einer gescheiterten Teilabfrage den
  Abschnitt weglassen statt `[]` zu schicken. Erst fragen, ob das schon erledigt ist.
- **Modelle** (Einstellungen, "Your Brand"): Das Tarif-Limit an aktiven Modellen serverseitig
  prüfen, nicht nur in der Oberfläche.

---

## 9. Was du mich zuerst fragen sollst (Sammelliste)

Schick mir diese Liste mit deiner ersten Antwort zurück, dann suche ich die Namen heraus:
1. Tarif-Funktion (Liste der Tarife für Billing und Sperrfenster)
2. Teams-Funktion der Seitenleiste bzw. Teams-Seite
3. Die drei Lese-Funktionen der Team-Verwaltung (Mitglieder, Einladungen, Protokoll)
4. Die fünf Aktions-Funktionen der Team-Verwaltung plus Team verlassen, Team löschen
5. Die Funktion, die eine Einladung annimmt
6. Einladungstabelle und Mitgliedertabelle
7. Die Funktion bzw. Edge Function, die die Prompt-Läufe startet
8. Die Chatlisten-Funktion von Mira
9. Onboarding-Finalize-Funktion
10. Die Massenaktions-Funktion der Prompts-Tabelle

Und die fünf Entscheidungen, die bei mir liegen:
- Weg A oder B in Abschnitt 2;
- darf der letzte owner das Team verlassen;
- sollen `@upstreem.ai`-Mitglieder serverseitig geschützt sein;
- Rolle oder Flag in Abschnitt 3;
- Wache für nutzerbezogene Mira-Funktionen.
