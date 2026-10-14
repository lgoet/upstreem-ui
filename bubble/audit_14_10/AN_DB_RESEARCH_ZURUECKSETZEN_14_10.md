# An den DB-Chat: Prompt Research einmal zurücksetzen (14.10.)

**Auftrag von Lukas:** Alle bisherigen Recherchen samt Vorschlägen löschen, für **alle Teams**.
Das Feature startet danach leer. Abwärtskompatibilität ist nicht nötig.

**Ausdrücklich NICHT anfassen:** aktive und inaktive Prompts (`team_prompts` bzw. die Prompt-
Tabelle), ihre Tags, Läufe, Antworten und alles, was an ihnen hängt. Auch Prompts, die früher aus
einer Recherche **getrackt** wurden, bleiben, wie sie sind – nur ihre Herkunft aus der Recherche
darf verloren gehen.

## Warum

Alte Vorschläge haben `intent: null` und `intent_status: null` (gebaut vor audit_14_10). Die UI
zeigt dafür jetzt einen Strich (Pin `2b601e1`). Lukas will die Altlasten aber ganz weg haben,
statt einer Liste voller Striche.

## Was bitte gebaut wird

1. **Eine SQL-Datei** `prompt_research_zuruecksetzen.sql`, die in **einer Transaktion**:
   - alle Zeilen der Vorschläge löscht (`prompt_research_suggestion` o. ä. – eure Namen);
   - alle Jobs löscht (`prompt_research_job` o. ä.), auch laufende und gescheiterte;
   - alles löscht, was nur an Recherchen hängt (Zwischenstände, Kontexte, Realtime-Reste,
     Aufräumer-Einträge);
   - Fremdschlüssel von Prompts auf Vorschläge oder Jobs (falls es eine Herkunftsspalte gibt)
     **auf null setzt** statt Prompts zu löschen;
   - am Ende **zählt und ausgibt**: gelöschte Jobs, gelöschte Vorschläge, angefasste Prompts
     (muss die Zahl der genullten Herkunftsspalten sein, sonst nichts) und die Zahl der Prompts
     vorher und nachher je Team (**muss gleich sein**).
2. **Ein Probelauf mit Rollback** vorab, mit genau diesen Zahlen als Beleg.
3. **Kein Rückweg nötig.** Bitte trotzdem kurz notieren, was weg ist.

## Danach prüft die UI

- `prompt_research_jobs_v1` liefert für jedes Team `rows: []`.
- Eine neue Recherche läuft wie gewohnt (`start-job`, Realtime, Ergebnis mit Intent und Branded).
- Prompt-Liste und Prompt-Zahlen je Team sind unverändert.
