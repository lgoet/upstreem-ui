# Auftrag an den Datenbank-Chat: Settings als Seiten-Komponente (Stand 11.10.2026)

Diesen ganzen Text als erste Nachricht in den Datenbank-Chat geben. Er ist in sich vollständig:
der Datenbank-Chat hat das Frontend-Repo nicht.

**Diese Runde ist eine BESTANDSAUFNAHME mit FEHLERSUCHE, MISSBRAUCHS- und SICHERHEITSPRÜFUNG und
VORSCHLAG. Du änderst nichts.** Gebaut wird erst, wenn der Vertrag abgestimmt ist. Vorbilder sind
die fertigen Verträge Dashboard v1, Prompt Insights v1 und **Brands v1** (zuletzt, mit
`brands_v1_fix_1.sql`): genau diese Bauart, diese Regeln, dieser Detailgrad.

**Warum diesmal besonders gründlich:** Settings ist der Bereich, in dem geschrieben wird, was man
nicht zurücknehmen kann. Hier wird ein Team gelöscht, ein Mitglied entfernt, die Eigentümerschaft
übergeben, eingeladen (es geht eine E-Mail an eine fremde Adresse) und das Abo verwaltet (Stripe).
Jede Lücke hier ist eine Übernahme fremder Teams, Spam über unsere Absenderadresse, Geld, das
fehlt, oder Daten, die weg sind. **Nimm für jede Funktion an, dass ein angemeldeter Angreifer sie
mit seinem eigenen Token und jeder denkbaren Nutzlast direkt aufruft.**

---

## 0. Worum es geht

Die Ansicht **Settings** wird **eine** Komponente, die ihre Funktionen **selbst** aufruft:
PostgREST, `POST /rest/v1/rpc/<funktion>`, Schema `app`, Nutzer-JWT, `Content-Profile: app`;
Edge Functions über `POST /functions/v1/<name>` mit demselben JWT. Bubble ist nicht mehr dazwischen.

Drei Unterseiten:

| Unterseite | Inhalt | Wer schreibt dort |
|---|---|---|
| **Your Brand** | Logo und Name der eigenen Marke, Markt, Geschäftsmodell (`b2b`/`b2c`/`hybrid`), Branche, Zusammenfassung; die getrackten AI-Modelle (an/aus, Planlimit); „Leave team“, „Delete team“ | heute jeder, der die Seite sieht (bis auf Löschen) |
| **Team Organisation** | Mitglieder mit Rolle, offene Einladungen, Protokoll; Einladen, erneut senden, zurückziehen, entfernen, Rolle ändern | owner, admin (Regeln in 4.3) |
| **Billing** | Abo (Tarif, Takt, Preis, nächste Zahlung, Status), Tarifliste, „Manage billing“ (Stripe-Portal), Tarifwechsel (Stripe-Kasse) | owner (und admin?) |

**Verlinkt wird Schritt für Schritt.** Nach diesem Auftrag kommt ein abgestimmter Vertrag, danach
baust du in kleinen Stücken (Vorschlag in Abschnitt 7) und schickst je Stück echte Antworten. Die
Oberfläche schaltet jede Funktion einzeln frei.

---

## 1. Regeln, ohne Ausnahme

1. **Nichts raten.** Bevor du über eine Funktion etwas sagst, holst du ihre Definition:
   `select pg_get_functiondef('app.NAME'::regproc);` (bzw. `public.NAME`, siehe Abschnitt 3).
   Edge Functions liest du im Quelltext. Wo ein Name fehlt, ermittelst du ihn oder fragst.
2. **In dieser Runde keine Änderung.** Nur Leseabfragen, Ergebnisse und ein Vorschlag. **Kein
   einziger Schreibaufruf**, auch nicht in einer Transaktion: keine Einladung (geht als E-Mail
   hinaus), kein Entfernen, kein Löschen, keine Portal- oder Kassensitzung. Verhalten beim
   Schreiben liest du aus der Definition.
3. **Der Bestand läuft weiter.** Bubble ruft die alten Funktionen, bis die Seite umgestellt ist.
   Neues entsteht daneben als `_v1`.
4. `security definer` immer mit `set search_path = ''` (bzw. fest), `revoke` von `public`/`anon`,
   Nutzer **nur** aus `auth.uid()`, nie ein `p_user` aus der Nutzlast. Mitgliedschaft und Rolle
   prüft jede Funktion **selbst**, als erste Anweisungen.
5. **Die Oberfläche ist kein Schutz.** Was sie ausblendet, sperrt nichts. Gezählt wird nur, was die
   Datenbank selbst abweist.
6. **Form wie die anderen Verträge:** reines `jsonb` mit `meta` und `rows`/`row`; stabile
   Fehler-`message` mit Präfix je Bereich (`settings_…`, `team_…`, `billing_…`), SQLSTATE wie
   gehabt (`22023` ungültig, `PT403` Rolle, `42501` fremdes Team, `PT404`, `PT409` Konflikt,
   `PT429` Rate); `hint` maschinenlesbar. Leer heißt `[]`, nie ein Fehler.
7. **Schreibende Funktionen** prüfen alles selbst, sperren, was sie ändern (`for update`), geben
   den **neuen Stand** des Abschnitts zurück (dieselbe Form wie die Lesefunktion), schreiben ihren
   Protokolleintrag in derselben Transaktion und leeren betroffene Caches. Kein
   `exception when others`.
8. **Freitext, der Bubble noch erreicht** (Teamname, Markenname, Anzeigename, E-Mail, Branche,
   Zusammenfassung): die drei Gifte (Backtick, `${`, Backslash) kommen nie in eine Antwort.
   Entweder beim Schreiben umschreiben und `rewritten: true` melden oder beim Ausliefern über
   `app.js_safe` (wie Brands v1). Der Teamname läuft durch Run-JS-Schritte auf **jeder** Seite.

---

## 2. Was die Seite zeigt und was man dort tun kann

### 2.1 Your Brand

**Lesen (heute zwei Quellen):** Name, Logo, Markt, Geschäftsmodell, Branche, Zusammenfassung kommen
heute aus den Teamdaten, die Bubble beim Seitenaufbau lädt (Funktion bitte ermitteln: der
„Team-Kopf“, den das Signal `account_updated` neu lädt). Die Modelle aus `get_team_model_settings`,
je Zeile gelesen: `model_key, display_name, logo_url, provider, currently_tracking,
disabled_reason, is_model_active, is_allowed_by_plan, can_enable, can_disable, can_toggle,
sort_order`, dazu `active_models_limit` und `user_can_manage` (aus der ersten Zeile).

**Schreiben:**

| Aktion | Nutzlast heute | Funktion heute |
|---|---|---|
| Einstellungen speichern | `market_id, business_model, industry, summary` (immer alle vier) | `set_own_brand_settings` (Brands kennt `set_own_brand_settings_v5`, bitte klären, welche) |
| Logo per Link | `url` | `set_own_brand_settings` |
| Modelle speichern | `model_keys` = die ganze aktive Liste, kommagetrennt | `manage_team_models`, danach `get_team_model_settings` |
| Team verlassen | `team_id, team_name` (Nutzer hat den Teamnamen getippt) | `leave_team` |
| Team löschen | `team_id, team_name` (getippt, dazu zweiter Klick) | `delete_team` |

Grenzen heute nur im Browser: Branche 48 Zeichen, Zusammenfassung **keine**, Logo-Link **ohne
Prüfung** (jedes Schema), Modelle „höchstens Planlimit, mindestens eins“.

### 2.2 Team Organisation

Lesen: `get_team_organisation` (Mitglieder), `get_team_invites`, `get_team_audit_log_v1`. Die Formen,
die die Oberfläche liest, stehen in Abschnitt 6.3–6.5 (unverändert übernehmen, nur ergänzen).

| Aktion | Nutzlast heute | Funktion heute |
|---|---|---|
| Einladen | `email, role` (`member`/`admin`) | `create_team_invite`, dann Edge `send-team-invite` |
| Erneut senden | `invite_id, email, role` | `resend_team_invite` (+ `send-team-invite`?) |
| Zurückziehen | `invite_id, email` | `revoke_team_invite` |
| Entfernen | `user_id, email` | `kick_team_member` |
| Rolle ändern | `user_id, email, role` (`member`/`admin`/`owner`) | `set_team_member_role` |

### 2.3 Billing

| Aktion | Funktion heute |
|---|---|
| Abo lesen | `get_team_billing_status` (bekannt: `get_team_billing_status_v1` → `{ok, team_id, team_name, billing:{…}}`) |
| Tarife lesen | `get_billing_plans` |
| „Manage billing“ | Edge `create-billing-portal-session` → URL → selber Tab |
| Tarif wählen | **unbekannt**: Bubble legt eine Kassen- bzw. Wechselsitzung an. Nutzlast heute `plan_id, plan_name, billing_interval, price_eur, monthly_price_eur, yearly_price_eur, trial_days, current_plan_id`. Das Access Gate nutzt denselben Weg. **Bitte die Funktion bzw. Edge Function ermitteln.** |

---

## 3. Bestandsaufnahme (bitte die Ergebnisse schicken)

```sql
-- A) Alle Kandidaten mit Schema, Argumenten, Rückgabe, Sicherheit und den Prüfungen im Text
select n.nspname, p.proname,
       pg_get_function_identity_arguments(p.oid) as args,
       pg_get_function_result(p.oid)            as returns,
       p.prosecdef                              as security_definer,
       p.proconfig                              as settings,          -- search_path?
       position('auth.uid()' in pg_get_functiondef(p.oid)) > 0          as nutzt_uid,
       position('require_team_access' in pg_get_functiondef(p.oid)) > 0 as prueft_team,
       pg_get_functiondef(p.oid) ~* '(role|rolle)\s*(=|in)'             as prueft_rolle,
       position('for update' in lower(pg_get_functiondef(p.oid))) > 0   as sperrt,
       position('exception' in lower(pg_get_functiondef(p.oid))) > 0    as faengt_fehler
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('app','public') and p.prokind = 'f'
  and p.proname ~* '(team|member|invite|kick|role|leave|owner|billing|plan|stripe|checkout|portal|model_setting|manage_team_models|own_brand|audit|subscription|quota|trial|seat)'
order by 1, 2;

-- B) Rechte (anon / authenticated / service_role) auf genau diese Funktionen
select n.nspname, p.proname, r.rolname, has_function_privilege(r.oid, p.oid, 'execute') as darf
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
cross join (select oid, rolname from pg_roles where rolname in ('anon','authenticated','service_role')) r
where n.nspname in ('app','public')
  and p.proname in ('get_team_organisation','get_team_invites','get_team_audit_log_v1',
    'get_team_model_settings','manage_team_models','set_own_brand_settings','set_own_brand_settings_v5',
    'create_team_invite','resend_team_invite','revoke_team_invite','kick_team_member',
    'set_team_member_role','leave_team','delete_team','get_team_billing_status',
    'get_team_billing_status_v1','get_billing_plans','get_team_plan_quota')
order by 2, 3;

-- C) Wird wirklich gerufen? (pg_stat_statements, letzte Tage)
select calls, round(mean_exec_time) ms_mittel, round(max_exec_time) ms_max, left(query, 160)
from pg_stat_statements
where query ~* '(team_member|invite|kick_team|leave_team|delete_team|billing|model_settings|manage_team_models|own_brand|audit_log)'
order by calls desc limit 60;

-- D) Tabellen mit Spalten: Teams, Mitgliedschaften, Rollen, Einladungen, Protokoll,
--    Modell-Einstellungen, Marken-Einstellungen, Abos, Tarife, Stripe-Kunden, Webhook-Ereignisse
select table_schema, table_name,
       string_agg(column_name || ' ' || data_type || coalesce(' default ' || column_default, ''), ', ' order by ordinal_position)
from information_schema.columns
where table_schema in ('app','public')
  and table_name ~* '(team|member|invite|audit|log|model|brand_setting|billing|plan|subscription|stripe|customer|webhook|trial)'
group by 1, 2 order by 1, 2;

-- E) Fremdschlüssel mit ON DELETE (was reißt delete_team mit?), Trigger, RLS-Policies
--    auf den Tabellen aus D (dieselben drei Abfragen wie in Prompt Insights, Abschnitt 3 D-F)

-- F) Datenlage, nur Zähler:
--    Teams ohne owner; Teams mit mehr als einem owner; Teams, deren einziges Mitglied kein owner ist;
--    Mitglieder je Team (max, p95); offene Einladungen je Team (max, p95), älteste offene;
--    Einladungen je Team und Tag (max der letzten 90 Tage); Einladungen an Adressen, die schon
--    Mitglied sind; doppelte offene Einladungen (Team + Adresse, normalisiert);
--    Teams mit deleted_at (in der Zukunft / Vergangenheit) und davon mit aktivem Stripe-Abo;
--    Teams je Nutzer (max) und Teams, die ein Nutzer in 90 Tagen angelegt UND gelöscht hat;
--    Testphasen je Nutzer bzw. Stripe-Kunde (max);
--    Länge der Zusammenfassung (max, p95), Branchen-Freitext (max), Logo-Links nach Schema
--    (https / http / data / javascript / andere) und nach Host;
--    Team-, Marken- und Anzeigenamen sowie E-Mails mit Backtick, '${', Backslash, Zeilenumbruch
--    oder unsichtbaren Zeichen; Protokolleinträge je Team (max), älteste.
```

Für **jede** Funktion aus Abschnitt 2 und jede Edge Function:

1. die Definition bzw. den Quelltext (Edge: auch, welcher Schlüssel benutzt wird und woher
   Team, Kunde, Preis und Rücksprung-URL kommen);
2. ein echtes Beispiel der **Lesefunktionen** (Team 877c): ungekürzte Antwort, Laufzeit kalt und warm;
3. ob sie Mitgliedschaft **und** Rolle prüft, und ob jede übergebene ID (`user_id`, `invite_id`,
   `model_key`, `plan_id`, `market_id`) zum Team bzw. zur erlaubten Menge gehört;
4. was sie protokolliert.

---

## 4. Fehlersuche, Missbrauchs- und Sicherheitsprüfung (das volle Paket)

Zu jedem Punkt: **Befund** (mit Abfrage oder Definitionsstelle), **Schwere** (kritisch / hoch /
mittel / niedrig), **Vorschlag**. Bitte jede Zeile beantworten, auch mit „trifft nicht zu, weil …“.

### 4.1 Zugang (alle Funktionen)

1. Mit dem öffentlichen Schlüssel **ohne** Nutzertoken (`curl`): jede Funktion lehnt ab.
2. Mit einem gültigen Token eines Nutzers, der **nicht** Mitglied ist, und `p_team` eines fremden
   Teams: jede Funktion lehnt ab (`42501`), **ohne** zu verraten, ob es das Team gibt.
3. Mit einem Token eines Mitglieds, das inzwischen **entfernt** wurde (sein JWT läuft noch bis zu
   einer Stunde): jede Funktion lehnt ab. Gibt es irgendwo einen Cache der Mitgliedschaft?
4. Team ohne Zugang (Abo beendet, gelöscht): Was darf es noch? Vorschlag: lesen ja; verlassen,
   löschen, Billing ja (siehe `datenbank_auftrag.md` §1); **Modelle anschalten nein** (kostet Läufe),
   Einladen nein.
5. Welche Funktionen sind heute `security invoker`, und reicht dort RLS allein?

### 4.2 Your Brand

1. **Wer darf schreiben?** Heute jeder, der die Seite sieht. Vorschlag: Markeneinstellungen und
   Logo owner und admin; Modelle owner und admin (bitte sagen, was `user_can_manage` heute
   bedeutet). member liest nur.
2. **Nur die eigene Marke dieses Teams.** Nimmt `set_own_brand_settings(_v5)` eine `company_id`
   entgegen? Dann ist jede fremde ID ein Angriff auf geteilte Firmen (Befund H6 aus Brands v1: ein
   member konnte einen Wettbewerber umbenennen). Bitte bestätigen, dass der Trigger
   `trg_enforce_own_brand_only` greift, und ob die Rolle inzwischen geprüft wird.
3. **Werte:** `market_id` aus der Markttabelle (und vom Plan erlaubt?); `business_model` genau
   `b2b|b2c|hybrid`; Branche 1–48 Zeichen nach Trimmen, NFKC, ohne Steuerzeichen; Zusammenfassung:
   Vorschlag höchstens 1.000 Zeichen (bitte aus F den heutigen Bestand nennen, bevor wir eine Zahl
   festlegen).
4. **Logo-Link:** nur `https://`, höchstens 2.048 Zeichen, kein `user:pass@`, kein IP-Literal, kein
   `localhost`, keine internen Hosts. **Holt irgendein Server-Prozess (Edge, n8n, Job) dieses Bild
   ab** (Farbe, Vorschau, Größe)? Dann ist das eine SSRF-Lücke: bitte genau sagen, wer es abruft.
5. **Die Zusammenfassung geht in Sprachmodelle** (Prompt-Vorschläge, Onboarding, Mira-Kontext?).
   Bitte sagen, wo sie gelesen wird. Sie ist Nutzereingabe und darf dort nur als Daten stehen,
   abgegrenzt, nie als Anweisung (Prompt-Injection). Gleiches für Branche und Markenname.
6. **Modelle:** Planlimit und „mindestens eins“ serverseitig, atomar; nur Schlüssel, die es gibt,
   die aktiv sind und die der Plan erlaubt; doppelte Schlüssel. **Kosten:** Löst das Anschalten
   Läufe oder ein Nachrechnen alter Tage aus? Was kostet ein Wechsel im Kreis (an, aus, an)?
   Vorschlag: Änderungen je Team und Tag begrenzen. Bleibt die Historie eines abgeschalteten
   Modells?
7. Ein **Markt-** oder **Branchenwechsel**: löst er irgendetwas aus (neue Prompts, Läufe, Kosten)?

### 4.3 Mitglieder und Rollen

Die Regeln, die die Oberfläche zeigt (bitte gegen den Bestand prüfen und sagen, wo der Server
anders entscheidet):

| | owner | admin | member |
|---|---|---|---|
| Mitglieder sehen | ja | ja | ja |
| Einladungen und Protokoll sehen | ja | ja | **nein** (leere Liste, kein Fehler) |
| Einladen (`member`/`admin`), erneut senden, zurückziehen | ja | ja | nein |
| member entfernen | ja | ja | nein |
| admin entfernen | ja | **nein** | nein |
| member → admin | ja | ja | nein |
| admin → member | ja | nein | nein |
| jemanden zum owner machen | ja | **nein** | nein |
| owner entfernen / herabstufen | ja, außer den letzten | nein | nein |
| sich selbst entfernen | nein (dafür gibt es „Leave“) | nein | nein |
| `@upstreem.ai`-Mitglieder (Support) | **offen, siehe 4.8** | nein | nein |

Bitte prüfen, jeweils mit Definitionsstelle:

1. **Rechteausweitung:** admin macht sich selbst zum owner; admin stuft einen owner herab; admin
   entfernt einen admin; member ruft irgendeine Aktion; jemand ändert seine eigene Rolle.
2. **Fremde IDs:** `user_id` eines Nutzers aus einem anderen Team, eine erfundene `user_id`,
   `invite_id` eines anderen Teams.
3. **Der letzte owner** darf weder entfernt noch herabgestuft werden, auch nicht durch sich selbst.
   **Wettlauf:** zwei owner stufen sich gleichzeitig gegenseitig herab → kein owner mehr. Vorschlag:
   `select … for update` auf die Teamzeile in jeder Funktion, die Rollen oder Mitgliedschaften
   ändert, und die Prüfung nach der Sperre.
4. **Owner übergeben:** Was heißt `role = owner` heute: ein zweiter owner, oder geht die
   Eigentümerschaft über (der alte wird admin)? Wem gehört danach das Stripe-Abo (Rechnungsadresse,
   Zahlungsmittel)? Vorschlag in 6.6.
5. **Entfernen:** Was passiert mit dem, was das Mitglied angelegt hat (Prompts, Chats, Einladungen,
   die es verschickt hat)? **Offene Einladungen an die Adresse des Entfernten:** er könnte damit
   sofort wieder beitreten. Vorschlag: beim Entfernen die offenen Einladungen **an** seine Adresse
   zurückziehen; die **von** ihm verschickten bleiben, werden aber im Protokoll sichtbar.
6. **Plätze:** Gibt es eine Obergrenze an Mitgliedern je Plan? Zählen offene Einladungen mit?
   Wird sie beim Annehmen (nicht nur beim Einladen) geprüft?

### 4.4 Einladungen und die E-Mail (Spam, Phishing, Übernahme)

`send-team-invite` verschickt eine E-Mail **in unserem Namen an eine beliebige Adresse**, mit
Text, den der Einladende bestimmt (Teamname, sein Anzeigename). Das ist die gefährlichste Stelle des
Bereichs.

1. **Was die Edge Function aus der Nutzlast nimmt.** Erlaubt ist nur `invite_id` (und `team_id`
   zur Prüfung). Adresse, Teamname, Rolle, Absender und Link holt sie selbst aus der Datenbank.
   Nimmt sie heute `email` oder Text aus der Nutzlast, kann jeder angemeldete Nutzer beliebige
   E-Mails an beliebige Adressen schicken: **kritisch**.
2. Prüft die Edge Function selbst (mit dem Nutzer-JWT, nicht mit dem Service-Schlüssel allein),
   dass der Aufrufer owner/admin dieses Teams ist und die Einladung offen ist?
3. **Inhalt der E-Mail:** Teamname und Anzeigename sind Nutzereingabe. HTML-escapen, Länge kappen,
   **keine Links daraus machen** (ein Teamname „Your account is locked, visit evil.example“ wird
   sonst zur Phishing-Mail mit unserem Absender). Der einzige Link ist unser Einladungslink.
4. **Mengen:** Vorschlag je Team höchstens 50 offene Einladungen, je Team 20 und je Nutzer 30
   neue pro Tag, erneut senden je Einladung höchstens alle 5 Minuten und 5-mal insgesamt. Bitte mit
   den Zahlen aus F begründen oder anpassen.
5. **Adresse normalisieren:** trimmen, klein, NFKC, höchstens 254 Zeichen, genau ein `@`, keine
   Leer-, Steuer- und Anführungszeichen, kein Backtick, kein `${`, kein Backslash (alles erlaubt
   laut RFC, aber praktisch nie echt und für uns Gift). Schon Mitglied: Fehler. Schon offen
   eingeladen: dieselbe Einladung zurück (`unchanged: true`), keine zweite.
6. **Rolle** nur `member` oder `admin`, **nie `owner` über eine Einladung**. Ein admin darf nur
   einladen, was er selbst vergeben dürfte.
7. **Token:** zufällig (mindestens 128 Bit), nur als Hash gespeichert? Ablauf (wie lange)?
   Einmalig? **Liefert `get_team_invites` das Token oder den Link aus?** Dann kann jeder admin
   (und bei fehlender Rollenprüfung jedes Mitglied) eine Einladung selbst einlösen oder
   weitergeben: **kritisch**. Die Oberfläche braucht es nicht.
8. **Annehmen** (nicht Teil der Seite, aber Teil der Kette): nur mit einem Konto, dessen
   **bestätigte** E-Mail gleich der eingeladenen ist (`invite_email_mismatch` gibt es laut
   `invite_db_vertrag`); zurückgezogene oder abgelaufene Einladungen und ein Wettlauf zwischen
   Zurückziehen und Annehmen (Sperre auf die Einladungszeile).
9. **Aufzählung:** Verrät irgendeine Antwort, ob eine Adresse bei uns ein Konto hat oder in einem
   anderen Team ist? Darf sie nicht.
10. **Erneut senden** verlängert den Ablauf? Erzeugt es ein neues Token (dann ist das alte ungültig)?

### 4.5 Verlassen und Löschen

1. **Verlassen:** Der letzte owner darf nicht gehen, solange andere Mitglieder da sind (sonst steht
   ein Team ohne owner, mit laufendem Abo). Vorschlag: Fehler `team_last_owner`, die Oberfläche sagt
   „Make someone else owner first, or delete the team“. Ist er das **einzige** Mitglied: verlassen
   gleich löschen, oder ablehnen? Bitte den heutigen Stand sagen.
2. **Löschen:** nur owner. Den getippten Teamnamen prüft heute nur der Browser. Vorschlag: die
   Funktion nimmt `p_confirm_name` und vergleicht selbst (schützt vor einem versehentlichen oder
   untergeschobenen Aufruf, nicht vor einem Angreifer).
3. **Was löscht `delete_team` wirklich?** Sofort und hart (`ON DELETE CASCADE` über alles aus E),
   oder vorgemerkt (`deleted_at` in der Zukunft, Zugang bis dahin, dann ein Job)? Bitte den ganzen
   Weg. Vorschlag: **vorgemerkt mit 14 Tagen**, in denen der Support wiederherstellen kann
   (Schutz gegen versehentliches Löschen und gegen ein verärgertes Mitglied, das gerade owner
   geworden ist), danach endgültig.
4. **Laufendes Stripe-Abo beim Löschen:** wird es gekündigt (sofort, zum Periodenende)? Von wem
   (Funktion, Edge, Webhook)? Was, wenn Stripe nicht antwortet: Team gelöscht und Abo läuft weiter?
   Vorschlag: Löschen kündigt zum Periodenende **vor** dem Vormerken; scheitert die Kündigung,
   wird nicht gelöscht.
5. **Neu anmelden statt zahlen:** Ein Nutzer legt ein Team an, nutzt die Testphase, löscht das
   Team, legt ein neues an, bekommt wieder eine Testphase. Woran hängt die Testphase heute (Team,
   Nutzer, Stripe-Kunde, Domain der Adresse, Zahlungsmittel)? Bitte mit F belegen.
6. **Wohin danach?** Bubble schickt heute auf `signup`. Vorschlag: die Antwort trägt
   `remaining_teams` und `next_team_id` (das zuletzt benutzte andere Team), dann kann die Seite
   dorthin wechseln statt auf `signup`. Entscheidung beim Nutzer.

### 4.6 Billing (Geld)

1. **`create-billing-portal-session`:** Woher kommt die Stripe-Kunden-ID? Nur aus der Datenbank
   über das Team, nie aus der Nutzlast. Wer darf (owner, admin, `can_manage_billing`)? Woher kommt
   die **Rücksprung-URL**: fest im Server (Erlaubnisliste), **nie** aus der Nutzlast (sonst ein
   offener Weiterleiter mit Stripe-Vertrauen). Ratenlimit (jede Sitzung wird bei Stripe angelegt)?
   Test- oder Live-Schlüssel, und wie wird das unterschieden?
2. **Die Kasse (Tarif wählen):** Die Oberfläche schickt heute `price_eur` mit. **Der Preis kommt
   nie aus der Nutzlast**, nur `plan_id` und `billing_interval`; der Stripe-Preis kommt aus der
   Tariftabelle. Bitte bestätigen. Dazu: nur sichtbare, aktive Tarife wählbar (nicht „Legacy Free“,
   nicht interne Tarife); Testphase nur einmal (siehe 4.5.5); Gutscheincodes erlaubt?;
   Idempotenzschlüssel gegen doppelte Sitzungen; Tarifwechsel bei bestehendem Abo: neue Kasse oder
   Änderung mit anteiliger Verrechnung?
3. **Zugang kommt nur vom Webhook:** Der Rücksprung von Stripe („success“) schaltet nichts frei,
   nur das signierte Webhook-Ereignis. Signatur geprüft? Ereignisse doppelt oder in falscher
   Reihenfolge (idempotent, nach `created` sortiert)?
4. **`get_billing_plans`:** liefert nur öffentliche, aktive Tarife? Keine Stripe-IDs, die man nicht
   braucht.
5. **`get_team_billing_status`:** darf ein member es lesen (Preis, nächste Zahlung)? Vorschlag: ja,
   aber `can_manage_billing` nur für die, die wirklich dürfen. `has_active_access` aus
   `app.team_access` (Regel aus `datenbank_auftrag.md` §1.6).

### 4.7 Protokoll

1. Lesen nur owner und admin; member bekommt `[]`. Blättern (`p_limit` ≤ 100, `p_before`
   Zeitstempel + ID); wie viele Einträge hat das größte Team?
2. **Unveränderlich:** keine Update- oder Delete-Rechte für `authenticated`, auch nicht über eine
   Funktion. Bleibt das Protokoll beim Löschen eines Mitglieds (mit dessen E-Mail zum Zeitpunkt)?
3. **Vollständig:** Jede Aktion dieses Bereichs schreibt einen Eintrag, auch Marke, Logo, Modelle,
   Portal geöffnet, Kasse geöffnet, verlassen, löschen. Bekannte `event_type`: `member_invited,
   invite_accepted, invite_revoked, member_removed, role_changed`. Vorschlag für die neuen:
   `invite_resent, member_left, team_deleted, brand_settings_changed, brand_logo_changed,
   models_changed, billing_portal_opened, checkout_started`.
4. `meta` ist Freitext: die drei Gifte (Regel 8).

### 4.8 Offene Grundsatzfragen (beantwortet der Nutzer, du gibst eine Empfehlung)

1. Darf der letzte owner gehen (4.5.1)?
2. `@upstreem.ai`-Mitglieder (Support): Darf ein Kunde sie entfernen? Die Oberfläche sperrt sie;
   soll der Server es auch? Und umgekehrt: Was darf Support in einem Kundenteam?
3. Rolle oder Flag (`can_manage_roles` usw.)? Die Oberfläche folgt den Rollen.
4. Löschen: sofort oder vorgemerkt (4.5.3)?
5. Owner übergeben: zweiter owner oder Übergabe (4.3.4)?
6. **Erneute Anmeldung vor dem Gefährlichsten:** Vorschlag, dass `team_delete_v1` und das
   Übergeben der Eigentümerschaft eine frische Anmeldung verlangen (JWT `iat` oder `amr` jünger als
   15 Minuten, sonst `settings_reauth_required`). Die Oberfläche fragt dann das Passwort bzw. Google
   erneut. Bitte sagen, ob Supabase das hier sauber hergibt.

---

## 5. Was nicht in diesen Auftrag gehört (zur Abgrenzung)

- **Preferences** (Name, Bild, Sprache, Thema): schreibt über Supabase Auth und Storage direkt.
  Nur als Befund: Wird `user_metadata` irgendwo serverseitig für Rolle, Team oder Plan gelesen? Darf
  es nicht (vom Nutzer veränderbar).
- **Einladungsseite und Registrierung**: haben eigene Verträge (`invite_db_vertrag.md`,
  `signup_invite_setup.md`). 4.4.8 nur als Befund.
- **Marken-Editor** (Umbenennen, Aliase, Farbe der eigenen Marke): bleibt der Drawer.

---

## 6. Dein Vorschlag (noch nicht bauen)

Schlag einen Vertrag in der Form der Seiten-Verträge vor. Zum Prüfen, nicht als Vorgabe; die
Oberfläche ist schon mit diesen Namen vorbereitet und zieht jede Abweichung nach.

### 6.1 Lesen

| Funktion | Zweck |
|---|---|
| `settings_page_meta_v1(p_team)` | Rolle des Aufrufers, Teamname und -ID, **Rechte, vom Server abgeleitet** (`can_edit_brand, can_manage_models, can_invite, can_manage_members, can_manage_billing, can_leave, can_delete` je mit `reason`, z. B. `last_owner`), Zähler (Mitglieder, offene Einladungen), Zugangsstand |
| `settings_brand_v1(p_team)` | eigene Marke (`company_id, name, logo_url, favicon_url`), `market_id, business_model, industry, summary`, `models[]` in der heutigen Zeilenform, `limits{models_max, models_active}` |
| `team_members_v1(p_team)` | Form wie heute `get_team_organisation` (6.3) |
| `team_invites_v1(p_team)` | nur offene, Form 6.4, **ohne Token** |
| `team_log_v1(p_team, p_limit, p_before)` | Form 6.5, blätternd |
| `billing_status_v1(p_team)` | Form wie `get_team_billing_status_v1` (oder genau diese, wenn sie den Regeln genügt) |
| `billing_plans_v1()` | öffentliche, aktive Tarife |

### 6.2 Schreiben (jede gibt den neuen Stand ihres Abschnitts zurück)

| Funktion | Parameter | Antwort |
|---|---|---|
| `settings_brand_save_v1` | `p_team, p_market_id, p_business_model, p_industry, p_summary` | wie `settings_brand_v1` ohne `models`, mit `rewritten` |
| `settings_brand_logo_v1` | `p_team, p_logo_url` (`null` = entfernen) | dasselbe |
| `team_models_set_v1` | `p_team, p_model_keys text[]` | `models[]` und `limits` |
| `team_invite_create_v1` | `p_team, p_email, p_role` | die Einladung (ohne Token) und `unchanged` |
| `team_invite_resend_v1` | `p_team, p_invite_id` | die Einladung, neues `expires_at` |
| `team_invite_revoke_v1` | `p_team, p_invite_id` | `team_invites_v1` |
| `team_member_remove_v1` | `p_team, p_user_id` | `team_members_v1` |
| `team_member_role_v1` | `p_team, p_user_id, p_role` | `team_members_v1` |
| `team_leave_v1` | `p_team, p_confirm_name` | `remaining_teams, next_team_id` |
| `team_delete_v1` | `p_team, p_confirm_name` | `deleted_at` (bzw. Ende der Frist), `remaining_teams, next_team_id` |

**Edge Functions:**

| Name | Nutzlast | Antwort |
|---|---|---|
| `send-team-invite` | `{team_id, invite_id}` | `{ok, sent_at}` bzw. `edge_*`-Fehler |
| `create-billing-portal-session` | `{team_id}` | `{url}` (nur `https://billing.stripe.com/…`) |
| Kasse (Name?) | `{team_id, plan_id, billing_interval}` | `{url}` (nur `https://checkout.stripe.com/…`) |

Die Oberfläche ruft `team_invite_create_v1` und danach `send-team-invite`. Scheitert der Versand,
steht die Einladung offen da und die Seite sagt „Invite created, but the email could not be sent.
Use Resend.“ Die Seite wiederholt Edge-Aufrufe **nie** von selbst (eine E-Mail könnte schon
hinaus sein). Eine RPC wiederholt sie bei `XX000` einmal; das ist nur sicher, weil ein Fehler die
Transaktion zurückrollt. Bitte bestätigen, dass keine dieser Funktionen vor einem möglichen Fehler
etwas außerhalb der Transaktion anstößt (`pg_net`, `http`, Queue).

### 6.3–6.5 Antwortformen, die die Oberfläche heute liest (übernehmen, nur ergänzen)

- **Mitglieder:** `members[]` (Pflicht) mit `role, email, user_id, joined_at, display_name`;
  `viewer_role`, `viewer_user_id`, `viewer_email`; `permissions{…}` darf bleiben.
- **Einladungen:** `{count, invites[]}`; je Zeile `invite_id, invited_email, invited_role, status,
  created_at, created_by_email, expires_at, resend_count, last_sent_at`.
- **Protokoll:** `{logs[]}`; je Zeile `log_id, created_at, event_type, actor_user_id, actor_email,
  actor_display_name, target_user_id, target_email, meta{…}`.

### 6.6 Dazu bitte

1. die **Rechtetabelle** aus 4.3, so wie der Server sie dann erzwingt;
2. zu jeder Funktion Parameter, Antwortform und ein **echtes Beispiel** (Lesen: Team 877c);
3. die **Grenzen** als Tabelle mit Fehler-`message` und `hint` (Länge, Mengen, Tagesgrenzen,
   Ratenlimits; Vorschlag Lesen 60 und Schreiben 20 pro Minute und Nutzer);
4. die **Befunde aus Abschnitt 4**, sortiert nach Schwere, die kritischen zuerst und einzeln;
5. die **offenen Fragen** aus 4.8 mit deiner Empfehlung.

---

## 7. Reihenfolge der Schritte (Vorschlag)

Verlinkt wird in dieser Reihenfolge, je Schritt mit echten Antworten und einem Test in der
Oberfläche, bevor der nächste beginnt:

1. **Lesen:** `settings_page_meta_v1`, `settings_brand_v1`, `team_members_v1`, `team_invites_v1`,
   `team_log_v1`, `billing_status_v1`, `billing_plans_v1`. Danach sieht die Seite alles, schreibt
   aber noch über nichts.
2. **Your Brand schreiben:** Einstellungen, Logo, Modelle.
3. **Einladungen:** anlegen, Versand, erneut senden, zurückziehen.
4. **Mitglieder:** Rolle, entfernen.
5. **Billing:** Portal, Kasse.
6. **Verlassen und Löschen** zuletzt, nach den Fixes aus 4.5.

**Kritische Befunde aus Abschnitt 4 werden vor Schritt 1 behoben**, auch für die alten Funktionen,
die Bubble bis zur Umstellung weiter ruft: Eine Lücke dort ist heute offen, nicht erst nach dem
Umbau.

Nach jedem Bau brauche ich wie immer eine Datei mit **echten, ungekürzten Antworten** (Lesen: Team
877c; Schreiben: zurückgerollt, **ohne** E-Mail und **ohne** Stripe-Aufruf), jede Fehlerform
einmal.
