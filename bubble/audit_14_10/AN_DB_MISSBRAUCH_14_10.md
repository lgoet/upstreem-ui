# An den DB-Chat: Missbrauch, Fraud, Spam und offene Fragen (14.10.)

Danke für audit_14_10, alles ist eingearbeitet (`prompt_branded`, Nachladen der Seiten, Drawer-Köpfe
mit Filter samt Rückfall bei `PGRST202`). Dieser Auftrag prüft die **neuen Funktionen der letzten
Runden auf Missbrauch** und sammelt, was sonst noch offen ist. Bitte jede Antwort wie gewohnt mit
echter Antwort belegen (Rollback, nichts speichern).

Was die UI selbst schon abfängt, steht jeweils dabei – die DB darf sich darauf **nicht** verlassen,
jeder Aufruf kann auch ohne die App kommen.

---

## A. Kosten: Was löst einen KI- oder n8n-Lauf aus?

### A1. `prompt_intent_set_v1` mit `p_intent: null` (zurück an die KI)

Jeder Aufruf reiht den Prompt neu ein und kostet einen Klassifizierungslauf.

- **Ratengrenze:** Gibt es eine je Team und je Nutzer? Wie hoch? Was passiert, wenn jemand in einer
  Schleife „zurück an die KI“ für denselben Prompt ruft (1000 Aufrufe in einer Minute)?
- **Sammelaktion:** `p_target: "filter"` mit bis zu 1000 Prompts und `p_intent: null` – sind das
  1000 Läufe? Gibt es eine Grenze je Tag oder je Tarif?
- **Schon offen:** Wird ein Prompt, der bereits `pending` ist, erneut eingereiht, oder bleibt es
  bei einem Lauf?
- **UI:** Ab Pin `c3620fc` gehen schnelle Klickfolgen nicht mehr einzeln hinaus. Nur der letzte
  Wert wird geschrieben (gemessen: fünf Wechsel, ein Aufruf). Die Sammelleiste bietet „zurück an
  die KI“ nicht an.

### A2. `start-job` (Prompt Research)

- **Grenze:** Bei laufendem Job kommt `reused`. Gibt es außerdem eine Grenze je Tag oder je Tarif?
  Wie viele Recherchen darf ein Team in 24 h starten, und wo steht das?
- **Kosten je Lauf:** Grob, was kostet ein Lauf an Modellaufrufen? Bei 20 Vorschlägen und drei
  Intents mehr als ohne?
- **Eingabe ins Modell:** `keywords` sind Freitext (1–20, zusammen bis 300 Zeichen) und gehen in den
  Prompt des Modells. Wird die Antwort des Modells nur über die Speicherprüfung gefiltert (Intent,
  Quote, Branded), oder auch auf Länge und Inhalt? Kann jemand über die Begriffe das Modell dazu
  bringen, beliebigen Text als „Vorschlag“ zu speichern?
- **UI:** Ein zweiter Start bei laufendem Job wird ignoriert (gemessen: fünf Klicks über zwei
  Sekunden, ein Aufruf).

### A3. Onboarding und Klassifizierung neuer Prompts

Wird jeder neu angelegte Prompt sofort klassifiziert (Trigger)? Dann ist jedes Anlegen ein Lauf.
Gilt dafür dieselbe Grenze wie fürs Anlegen selbst (Tarif-Kontingent)?

---

## B. Spam über Realtime

`team_prompts:<team>` sendet bei jeder Änderung an alle offenen Sitzungen des Teams. Die UI lädt
danach still nach. Dashboard, Citations und Brands warten dafür 1,5 s, die Prompts-Seite 0,6 s.

1. **Flut:** Ein Mitglied ruft `prompt_branded_set_v1` in einer Schleife. Jede Sitzung im Team lädt
   dann im Takt nach. Gibt es eine Grenze für Schreibaufrufe, die das abfängt?
2. **Privat:** Ist der Kanal `team_prompts:<team>` privat, sodass nur Mitglieder dieses Teams
   beitreten und die Prompt-IDs sehen? Bitte mit einem Beitritt als Nicht-Mitglied belegen.
3. **Markenänderung:** `prompt_ids: null` lädt bei allen alles nach. Wie oft kann das ein Mitglied
   auslösen (Alias anlegen und löschen im Wechsel)?

---

## C. Rechte

1. **Wer darf schreiben?** Dürfen Member Intent und Branded setzen, oder nur Owner/Admin? Gilt
   dasselbe für Sammelaktionen und für „zurück an die KI“? Bitte die Regel nennen und je Rolle
   einen Beleg.
2. **Team-Prüfung:** Prüfen `prompt_intent_set_v1`, `prompt_branded_set_v1`, `start-job` und
   `prompt_research_decide_v1` bei jedem Aufruf, dass Nutzer und Prompt zum Team gehören? Beleg: ein
   Aufruf mit einer Prompt-ID aus einem fremden Team.
3. **Prompt Research:** Dürfen Member recherchieren und tracken (`decide accept`)? Tracken
   verbraucht Kontingent.

---

## D. Eingaben

1. **`p_expected_count`:** Was passiert mit einem erfundenen Wert? Nach eurer Antwort kommt 409
   `prompts_selection_changed`, wenn er nicht stimmt. Gibt es einen Fall, in dem ein falscher Wert
   mehr Prompts ändert als gezeigt?
2. **`p_excluded_ids`:** Obergrenze? Fremde IDs werden ignoriert?
3. **`params.intents` / `params.branded`:** bereits geprüft (400 bei unbekannten Werten). Danke.

---

## E. Trial-Fraud und Kontingent

1. **Neue Teams:** Lassen sich über viele Trial-Teams beliebig viele Recherchen und
   Klassifizierungen erzeugen? Hängt die Grenze aus A am Team oder am Nutzer?
2. **Tracken aus Prompt Research:** Wird das Kontingent bei `decide accept` in derselben
   Transaktion geprüft, sodass zwei gleichzeitige Aufrufe es nicht überschreiten?

---

## F. Offene Fragen ohne Missbrauch

1. **Events-Analyse und Intent-Filter:** `cached_impact_event_analysis_v2` liest die eingefrorene
   Kohorte. Soll der globale Intent-Filter dort wirken (Kohorte nach heutigem Intent einschränken),
   oder ist das fachlich falsch, weil sich Intents nach dem Anlegen ändern können? Eure Empfehlung
   bitte. Die UI schickt dort heute **keine** Filterparameter.
2. **`get_ads_advertiser_detail_v2`:** Stand nicht in eurer Liste aus B5 – nimmt die Funktion
   `p_intents`/`p_branded` und filtert sie? Die UI schickt sie heute mit.
3. **Karte „Visibility by intent“** (neu über der Prompts-Tabelle): Sie holt
   `cached_prompts_groups_v1` mit `p_group_by: "intent"` und den Filtern der Tabelle, einmal je
   Laden. Ist die Tabelle selbst nach Intent gruppiert, entfällt der Aufruf. Passt das von der Last
   her, oder lieber ein kleiner Teil in `prompts_page_meta_v1`?
4. **Vorlieben:** Ist `vor_nextjs_v1_nachtrag1.sql` in Produktion eingespielt? Wenn ja, schaltet die
   UI `VORLIEBEN_DB` ein (Sprache, Zahlen- und Datumsformat, Akzent im Konto). Bitte einmal
   nachsehen und bestätigen.
5. **Domain- und Brand-Kopf:** Die UI schickt ab sofort `p_intents`/`p_branded` an
   `domain_detail_v1` und `brand_detail_v1`. Ohne `audit_14_10.sql` kommt 404, dann fragt die UI
   einmal ohne Filter nach. Bitte bestätigen, dass `audit_14_10.sql` eingespielt ist, sobald Lukas
   es gemacht hat.
