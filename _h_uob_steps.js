/* ==============================================================================================
   onboarding-page -- die drei Stellen, nach denen gefragt wurde.

   Alle Beispiele hier sind GEMESSEN (_h_uob_drei.html), nicht getippt: ein erfundenes Beispiel,
   das im Feld anders aussieht, kostet beim Suchen eine Stunde.

   Reihenfolge im Ablauf:
     Schritt 3 (Topics) --> [1] uobTopics feuert --> dein Workflow laeuft --> [3] setOnboardingPrompts
     Waehrend der grosse Lauf arbeitet ------------------------------------> [2] setOnboardingStatus
   ============================================================================================== */


/* ══════════════════════════════════════════════════════════════════════════════════════════════
   [1] WEITER-KLICK BEI TOPICS   -->   Ereignis  uobTopics
   ══════════════════════════════════════════════════════════════════════════════════════════════

   BUBBLE-SEITIG
     Toolbox-Element "JavaScript to Bubble", Suffix  uobTopics
       Value type      : text
       Trigger event   : angehakt
     Am Wurzel-Div:  data-topics-fn="bubble_fn_uobTopics"

   WANN
     Genau einmal, beim Verlassen von Schritt 3 -- und nur, wenn sich die Auswahl seit dem letzten
     Mal geaendert hat. Steht dieselbe Auswahl noch, geht die Komponente ohne Ereignis weiter
     (sie hat die Prompts ja schon). DAS ist der Anstoss, aus dem die Prompts entstehen: der
     Workflow dahinter MUSS am Ende setOnboardingPrompts rufen, sonst haengt die zweite Uhr.

   GEMESSENE ANTWORT (zwei vorhandene Themen gewaehlt, kein eigenes getippt):
     {"topic_ids":"1defeb4e,ca0543ae","new_topics":"","count":2}

   Mit gesetztem Team steht team_id VORNE als erster Schluessel:
     {"team_id":"aea6e317","topic_ids":"1defeb4e,ca0543ae","new_topics":"","count":2}

   Mit zwei selbst getippten Themen:
     {"topic_ids":"1defeb4e","new_topics":"Waermepumpen,Klima-Wartung","count":3}
       topic_ids  Ids der ausgewaehlten VORHANDENEN Themen, komma-getrennt.
       new_topics NAMEN der selbst getippten -- die haben serverseitig noch keine Id. Dein
                  Workflow legt sie an und schickt sie beim naechsten setOnboardingTopics mit Id
                  zurueck. Leer, wenn keine getippt wurden.
       count      zaehlt beide zusammen (hier 1 + 2).

   EXTRAKTION (Bubble: :extract with regex)
     topic_ids    (?<="topic_ids":")[^"]*
     new_topics   (?<="new_topics":")(?:[^"\\]|\\.)*
     count        (?<="count":)\d+

   new_topics ist FREITEXT: ein Anfuehrungszeichen im Themennamen kommt als \" an, deshalb das
   escape-feste Muster und dahinter ein
     :find & replace   \"   ->   "
   Ein Komma IM Themennamen laesst sich nicht von einem Trenner unterscheiden -- die Zeichengrenze
   von 40 macht das unwahrscheinlich, ausschliessen kann sie es nicht.

   Der Workflow dahinter, in dieser Reihenfolge:
     1. topic_ids und new_topics extrahieren
     2. fuer jeden Namen in new_topics ein Topic anlegen
     3. Prompts erzeugen lassen
     4. setOnboardingPrompts rufen  ->  siehe [3]
     5. setOnboardingTopics erneut rufen, damit die neu angelegten Themen ihre Id bekommen
*/


/* ══════════════════════════════════════════════════════════════════════════════════════════════
   [2] STATUS WAEHREND DES LADENS   -->   setOnboardingStatus(instanceId, payload)
   ══════════════════════════════════════════════════════════════════════════════════════════════

   Bewegt die Ladeanzeige. Vier Abschnitte:
     1 Setting up your workspace    2 Reading your website
     3 Mapping your market          4 Preparing your insights

   ALLE diese Formen wirken -- gemessen, jede einzeln:
     {"status_phase":3}                                            -> Abschnitt 3
     {"status":"processing","progress_percent":55}                 -> Abschnitt 3 (55% von 4)
     {"progress_percent":80}                                       -> Abschnitt 4
     {"record":{"status":"processing","status_phase":2}}           -> Abschnitt 2   (Supabase-Form)
     {"new":{"status":"processing","status_phase":4}}              -> Abschnitt 4   (Supabase-Form)
     "processing"                                                  -> Abschnitt 1   (nacktes Wort)
     "3"                                                           -> Abschnitt 3   (nackte Zahl)
     {"status":"ready"}                                            -> fertig, Ladebild geht weg
     {"status":"failed","last_error":"..."}                        -> Fehlermeldung, Formular zurueck

   FERTIG ist es bei status ready/done/complete/completed ODER status_phase >= 5 ODER
   progress_percent >= 100. Eines davon genuegt -- du musst nicht alle drei schicken.

   Ohne status_phase, aber mit progress_percent, rechnet die Komponente den Abschnitt selbst aus
   (vier Abschnitte, also je 25%). status_label wird angezeigt, wenn es da ist.

   ── DER SCHRITT ──────────────────────────────────────────────────────────────────────────────
   Aus dem Realtime-Trigger oder aus dem Polling-Workflow. EIN Backtick, kein Objektliteral
   (§46): ein leerer Bubble-Ausdruck darin toetet den ganzen Schritt beim Parsen.
*/
(function () {
  var ROH = `{
    "status": "",
    "status_phase": ,
    "progress_percent": ,
    "status_label": ""
  }`
    .replace(/:\s*([,}\]])/g, ": null$1")
    .replace(/:\s*(yes|no)\s*([,}\]])/g, function (_, v, t) { return ": " + (v === "yes") + t; });
  try { if (window.setOnboardingStatus) window.setOnboardingStatus("INSTANCE_ID", ROH); } catch (e) {}
})();

/* Dasselbe mit echten Werten, zum Ausprobieren in der Konsole: */
// window.setOnboardingStatus("INSTANCE_ID", '{"status":"processing","status_phase":3,"progress_percent":62,"status_label":"Mapping your market"}');
// window.setOnboardingStatus("INSTANCE_ID", '{"status":"ready"}');


/* ══════════════════════════════════════════════════════════════════════════════════════════════
   [3] PROMPTS HEREINGEBEN   -->   setOnboardingPrompts(instanceId, payload)
   ══════════════════════════════════════════════════════════════════════════════════════════════

   Eine LISTE. Gelesen werden vier Felder, alles andere wird ignoriert:
     id            Pflicht in der Praxis -- fehlt sie, vergibt die Komponente prompts-0, prompts-1,
                   und dann kann dein Workflow die Auswahl nicht mehr zuordnen.
     prompt_text   der Text, der in der Zeile steht
     market        Marktkuerzel, z.B. "DE" -- zeigt die Flagge
     topic_ids     Komma-getrennter Text ODER eine Liste. Beides wird angenommen.
     selected      optional. yes/true/1 markiert die Zeile als vorausgewaehlt; die Auswahl
                   ueberlebt damit ein Neuladen.

   GEMESSEN mit zwei Zeilen: Rueckgabe true, die Liste steht, die Kopfzeile sagt "1 selected".

   Der Aufruf beendet die zweite Uhr (die nach uobTopics laeuft). Kommt er nie, haengt sie --
   deshalb gehoert er ans ENDE des Workflows hinter uobTopics, auch wenn keine Prompts entstanden
   sind: dann eben mit einer leeren Liste.

   ── DER SCHRITT ──────────────────────────────────────────────────────────────────────────────
*/
(function () {
  var ROH = `[BUBBLE: Ergebnis des Prompt-RPC -- id, prompt_text, market, topic_ids, selected]`
    .replace(/:\s*([,}\]])/g, ": null$1")
    .replace(/:\s*(yes|no)\s*([,}\]])/g, function (_, v, t) { return ": " + (v === "yes") + t; });
  try { if (window.setOnboardingPrompts) window.setOnboardingPrompts("INSTANCE_ID", ROH); } catch (e) {}
})();

/* Dasselbe mit echten Werten, zum Ausprobieren in der Konsole: */
// window.setOnboardingPrompts("INSTANCE_ID", JSON.stringify([
//   { id:"p1", prompt_text:"Welche Split-Klimaanlage ist die beste fuer 40 qm?", market:"DE", topic_ids:"1defeb4e", selected:true },
//   { id:"p2", prompt_text:"Was kostet die Montage einer Multi-Split-Anlage?",   market:"DE", topic_ids:"ca0543ae" }
// ]));


/* ══════════════════════════════════════════════════════════════════════════════════════════════
   DREI SACHEN, DIE ERFAHRUNGSGEMAESS SCHIEFGEHEN
   ══════════════════════════════════════════════════════════════════════════════════════════════
   1. Jeder Bubble-Parameter ist Typ TEXT. Nie yes/no und nie Zahl: ein yes/no-Parameter schreibt
      ein nacktes yes in den JSON, und das ist kein gueltiges JSON mehr.
   2. Der Workflow hinter uobTopics MUSS mit setOnboardingPrompts enden -- auch bei null Prompts.
      Sonst dreht die zweite Uhr weiter, und der Nutzer sieht ein Ladebild ohne Ende.
   3. window.<name> statt des nackten Namens, und jeder Aufruf in seinem eigenen try. Haengt das
      Element noch an einem aelteren Pin, ist der Name undefined statt ein ReferenceError, der den
      ganzen Schritt mitnimmt.
   ============================================================================================== */


/* ══════════════════════════════════════════════════════════════════════════════════════════════
   NACHTRAG: WIE WAEHLT DER NUTZER COMPETITORS UND TOPICS AUS?
   ══════════════════════════════════════════════════════════════════════════════════════════════

   Die kurze Antwort auf "sollte uobTopics nicht noch mehr tun, es schliesst die Bereiche doch ab?"
   -- nein, und zwar weil es nichts abzuschliessen gibt. Gespeichert wird LAUFEND, bei jedem Klick.
   uobTopics ist kein Speichern-Ereignis, sondern der ANSTOSS fuer die Prompt-Erzeugung: das ist das
   einzige, was dort dauert und deshalb einen eigenen Workflow braucht.

   Drei Ereignisse, drei verschiedene Aufgaben:

     uobSelect   bei JEDEM Klick auf eine Karte. Traegt die VOLLSTAENDIGE Auswahl danach.
                 --> hier speicherst du. Nach jedem Klick, nicht am Ende.
     uobStep     bei jedem Schrittwechsel. Nur der Name des Schritts, als reiner Text.
                 --> hier merkst du dir, wo der Nutzer steht (fuer den Wiedereinstieg).
     uobTopics   nur beim VERLASSEN von Topics, und nur wenn sich die Auswahl geaendert hat.
                 --> hier erzeugst du die Prompts.

   ── uobSelect ─────────────────────────────────────────────────────────────────────────────────
     Toolbox-Element "JavaScript to Bubble", Suffix  uobSelect
       Value type    : text
       Trigger event : angehakt
     Am Wurzel-Div:  data-select-fn="bubble_fn_uobSelect"

   GEMESSEN, Klick auf einen Competitor (Auswahl weggenommen):
     {"kind":"brands","ids":"","count":0,"changed":"c1","on":false}
   GEMESSEN, derselbe Competitor wieder angeklickt:
     {"kind":"brands","ids":"c1","count":1,"changed":"c1","on":true}
   GEMESSEN, Klick auf ein Topic:
     {"kind":"topics","ids":"ca0543ae","count":1,"changed":"1defeb4e","on":false}
   GEMESSEN, "Select all" bei den Topics:
     {"kind":"topics","ids":"ca0543ae,1defeb4e","count":2,"changed":"","on":true}
   Bei den Prompts im Schritt danach genauso, mit kind "prompts".

     kind     "brands" | "topics" | "prompts".  ACHTUNG: intern heissen die Competitors "brands" --
              in der Oberflaeche steht "Competitors", im Ereignis steht "brands".
     ids      die IDs ALLER gerade gewaehlten Elemente dieser Art, komma-getrennt. Nicht das
              angeklickte Element, sondern der ganze Stand DANACH.
     count    wie viele. Bei den Topics zaehlen die selbst getippten mit.
     changed  das angeklickte Element. Beim Alle-Knopf leer -- dort gibt es kein einzelnes.
     on       true, wenn es jetzt gewaehlt IST; false, wenn es weggenommen wurde.

   ── WARUM ids DIE GANZE AUSWAHL TRAEGT UND NICHT NUR DEN KLICK ────────────────────────────────
   Die Frage lag nahe. Drei Gruende, und der zweite ist der eigentliche:

     1. Der Workflow schreibt EINMAL die Liste, statt hinzufuegen und entfernen zu unterscheiden.
        Eine Verzweigung weniger ist eine Fehlerquelle weniger.
     2. Es heilt sich selbst. Bubble verwirft und stapelt Ereignisse unter Last -- geht eines
        verloren, steht die Wahrheit beim naechsten Klick wieder KOMPLETT da. Mit einer Differenz
        waere der Server ab da dauerhaft daneben, und niemand merkt es: die Oberflaeche zeigt ja
        das Richtige.
     3. Zwei schnelle Klicks koennen in falscher Reihenfolge ankommen. Mit der Vollmenge gewinnt
        der letzte und das Ergebnis stimmt. Mit einer Differenz stimmt es nicht.

   Was es KOSTET: eine komma-getrennte Id-Liste. Bei den Groessen hier (bis ein paar Dutzend
   Themen) sind das ein paar hundert Zeichen. Lohnen wuerde sich eine Differenz erst bei Listen in
   der Tausenderordnung oder bei einem teuren Workflow pro Klick -- beides ist hier nicht der Fall.

   Und weil die Frage berechtigt war: changed und on sind neu dazugekommen. Wer den Klick selbst
   braucht -- etwas protokollieren, eine Empfehlung nachladen, eine Animation -- hat ihn jetzt,
   OHNE dass das stumpfe Ueberschreiben seine Verlaesslichkeit verliert. Speichern aus ids,
   reagieren auf changed.

   EXTRAKTION
     kind     (?<="kind":")[^"]*
     ids      (?<="ids":")[^"]*
     count    (?<="count":)\d+
     changed  (?<="changed":")[^"]*
     on       (?<="on":)\w+          -> Text "true" oder "false"

   Mit gesetztem Team steht team_id VORNE als erster Schluessel -- die Muster oben treffen
   trotzdem, weil sie nach ihrem eigenen Schluessel suchen und nicht nach der Position.

   ── uobStep ───────────────────────────────────────────────────────────────────────────────────
     Suffix uobStep, Value type text, Trigger event an. data-step-fn="bubble_fn_uobStep"
   KEIN JSON, nur der Name des Schritts:
     brand | competitors | topics | prompts | plan
   GEMESSEN beim Weiterklicken von Competitors: zwei Aufrufe, "competitors" und "topics" --
   der erste ist der Schritt, der verlassen wird, der zweite der neue. Keine Extraktion noetig.

   ── WORAUF DU ACHTEN MUSST ────────────────────────────────────────────────────────────────────
   1. uobSelect feuert oft -- bei jedem Klick. Der Workflow dahinter sollte deshalb billig sein:
      ein Ueberschreiben der Auswahl, kein RPC-Gewitter.
   2. Speichere aus uobSelect, NICHT aus uobTopics. uobTopics feuert nicht, wenn die Auswahl
      unveraendert ist -- wer dort speichert, verliert die Auswahl in genau dem Fall, in dem der
      Nutzer nichts geaendert hat.
   3. Die selbst getippten Themen haben in uobSelect noch KEINE serverseitige Id. Sie tauchen dort
      nur in count auf. Ihre Namen kommen erst mit uobTopics (new_topics) -- das ist auch der
      Moment, in dem du sie anlegen kannst.
   ============================================================================================== */
