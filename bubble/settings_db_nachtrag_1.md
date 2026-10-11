# An den Datenbank-Chat: Nachtrag 1 zum Settings-Auftrag (11.10.2026)

Ergänzt `settings_db_auftrag.md`. Der Nutzer hat inzwischen die Bubble-Workflows von **Team
Organisation** und **Billing** geschickt. Daraus folgen diese Punkte. Bitte in deine laufende
Bestandsaufnahme aufnehmen; Form wie dort (Befund, Schwere, Vorschlag).

---

## 1. Antwortform der heutigen Team-Funktionen

Bubble prüft den Erfolg uneinheitlich:

| Funktion | Bubble wertet als Erfolg |
|---|---|
| `revoke_team_invite`, `resend_team_invite` | `first item's ok is yes` |
| `set_team_member_role`, `kick_team_member`, `create_team_invite` | nur `Objects:count > 0` |

Bitte für jede dieser fünf Funktionen sagen:

1. Was sie bei Erfolg und bei **jeder** Ablehnung zurückgibt: eine Zeile `ok:false` (mit welchem
   Feld für den Grund), eine Ausnahme (welche `message`), oder keine Zeile.
2. **Kritisch zu prüfen:** Liefern `set_team_member_role` oder `kick_team_member` bei einer
   Ablehnung (fehlende Rolle, letzter Owner, fremde ID) eine Zeile `ok:false`? Dann zeigt Bubble
   heute „Erfolg“ und lädt die Liste neu, obwohl nichts geändert wurde. Der Nutzer kann die
   Bedingung in Bubble sofort auf `ok` umstellen, sobald du die Form bestätigst.
3. `create_team_invite` meldet eine zweite offene Einladung an dieselbe Adresse heute als rohen
   Postgres-Fehler („duplicate key value violates unique constraint …“). Das verrät
   Constraint-Namen und ist keine stabile Meldung. Vorschlag im Vertrag: `team_invite_pending`
   (bzw. dieselbe Einladung mit `unchanged: true` zurück, Auftrag 4.4.5).

Die neue Seite wertet jede Schreibantwort so: `{ok:false}` oder `[{ok:false, …}]` ist ein
Fehlschlag, eine leere Liste ebenso. Im neuen Vertrag bitte **eine** Form: Erfolg mit dem neuen
Stand, Ablehnung immer als Ausnahme mit stabiler `message`.

## 2. Einladen: was passiert, wenn die E-Mail nicht hinausgeht

Heute (Workflow `utoInvite`): `create_team_invite` → `send-team-invite` → scheitert der Versand,
ruft Bubble `revoke_team_invite`. Folgen:

- Im Protokoll steht `invite_revoked` für eine Einladung, die nie jemand bekommen hat, und als
  Nächstes womöglich wieder `member_invited`.
- Läuft `send-team-invite` in eine Zeitüberschreitung, hat aber doch gesendet, kommt eine E-Mail mit
  einem Link an, der schon zurückgezogen ist.

Bitte prüfen und vorschlagen:

1. Welche Nutzlast schickt Bubble heute an `send-team-invite` (Quelltext der Edge Function: was
   liest sie aus dem Body)? Siehe Auftrag 4.4.1: erlaubt sein darf nur `invite_id` (+ `team_id`).
2. Prüft `send-team-invite` vor dem Versand, dass die Einladung noch offen ist? Dann kann eine
   späte Zustellung nach dem Zurückziehen nicht passieren.
3. Vorschlag: Der Versand gehört zur Einladung. Entweder legt die Edge Function an **und** sendet
   (ein Aufruf, scheitert der Versand, gibt es keine Einladung und keinen Protokolleintrag), oder
   die Einladung trägt `sent_at`/`send_failed_at`, und eine nie versendete Einladung wird ohne
   `invite_revoked` verworfen. Bitte begründet entscheiden.

Die neue Seite macht es bis dahin wie Bubble (bei gescheitertem Versand zurückziehen), lässt aber
den Dialog mit der Adresse offen.

## 3. Erneut senden

Bubble meldet heute Erfolg, sobald `resend_team_invite` `ok` liefert, auch wenn `send-team-invite`
danach scheitert. Bitte sagen: Was ändert `resend_team_invite` (Ablauf, Token, Zähler), und
geschieht das auch, wenn die E-Mail dann nicht hinausgeht?

## 4. Billing: Tarifwahl und Portal

Heute (Workflows `ublManage`, `ublSelectPlan`, `OPEN PORTAL`): **beide** öffnen nur
`create-billing-portal-session` und leiten auf die Adresse weiter. Der gewählte Tarif wird nicht
weitergegeben, und es gibt keinen Fehlerzweig (scheitert die Funktion, wird trotzdem weitergeleitet).

Bitte prüfen:

1. Welche Nutzlast liest `create-billing-portal-session`? Nimmt sie Tarif oder Takt an?
2. Ist das Stripe-Portal so eingestellt, dass man dort den Tarif wechseln kann? Welche Tarife
   bietet es an (dieselben wie `get_billing_plans`)?
3. **Team ohne Abo** (nie bezahlt, Testphase vorbei, gelöschtes Abo): Hat es einen Stripe-Kunden?
   Was zeigt das Portal dann, und wie kommt so ein Team heute zu einem Abo? Wenn es dafür keinen
   Weg gibt, brauchen wir eine Kassen-Funktion (Auftrag 4.6.2: nur `plan_id` und
   `billing_interval`, Preis aus der Tariftabelle).
4. Was antwortet die Funktion bei einem Fehler (Status, Body)?

## 5. Kleinigkeit

`get_team_audit_log_v1` wird bei jedem Neuladen der Team-Ansicht zweimal gerufen (Bubble-Seite,
kein DB-Fehler). Die neue Seite ruft sie einmal. Nur zur Info für die Ratenlimits.
