# Citations-Seite: Bestandsliste der Bubble-Workflows (Stand 08.10.2026)

Wozu: Die neue Seiten-Komponente muss **alles** übernehmen, was die Bubble-Workflows heute tun,
auch das, was nirgends dokumentiert ist (Bedingungen, Custom States, Schritte, die andere Elemente
anfassen). Was hier fehlt, fehlt nach dem Umbau still. Darum vor dem Bau einmal vollständig.

**So am einfachsten:** In Bubble die Citations-Ansicht öffnen, im Workflow-Editor jeden der
Workflows unten anklicken und **einen Screenshot der Schrittliste** machen (mit aufgeklappten
Bedingungen „Only when“). Screenshots reichen, abtippen ist nicht nötig. Was du zusätzlich
weißt, eine Zeile dazu.

---

## 1. Ereignisse der Komponenten (Namen aus den Vorlagen; bei euch evtl. mit Zusatz `_<id>`)

| Element | Ereignis | Was ich wissen muss |
|---|---|---|
| Seitenkopf | `bubble_fn_cphNav` | Was passiert beim Wechsel Domains ↔ URLs? Welche Elemente werden sichtbar/unsichtbar, welche Custom States gesetzt? |
| Seitenkopf | `bubble_fn_cphRefresh` | Was tut „Aktualisieren“ (welche RPCs, Cache)? |
| Kalender | `bubble_fn_udr_date_boot`, `_date_from`, `_date_to`, `_date_range`, `_apply_dashboard` | Wo wird der Zeitraum gespeichert (Custom State auf der Seite? in der URL?) und welche RPCs laufen danach neu? Gilt er auch für andere Ansichten? |
| Filterleiste | Models, Markets, Topics (je Auswahl + Apply), `bubble_fn_ufbReset` | Dasselbe: wo gespeichert, was läuft neu, gilt es seitenübergreifend? |
| Combo-Chart | `bubble_fn_comboGranularity` | Welcher RPC, welcher Parameter? |
| Domains-Tabelle | `bubble_fn_udtSearch`, `udtSort`, `udtFilter`, `udtBrand`, `udtMentioned`, `udtPage` | Welcher RPC, welche Parameter aus welchem Ereignis? Läuft danach auch das Chart neu? |
| Domains-Tabelle | `bubble_fn_udtShowPages` | Drilldown: welcher RPC? |
| Domains-Tabelle | `bubble_fn_udtRowClick`, `udtOpenUrl` | Was öffnet sich (Drawer, Seite), mit welchen Werten? |
| URL-Tabelle | `bubble_fn_uutSearch`, `uutSort`, `uutFilter`, `uutBrand`, `uutMentioned`, `uutPage` | wie Domains |
| URL-Tabelle | `bubble_fn_uutRowClick` | Was öffnet sich? |
| Export | Export-Knopf der Tabellen (Popup `export_citations`) | Welcher RPC erzeugt die Datei, mit welchen Filtern? |

## 2. Was nicht an einem Ereignis hängt

- [ ] **Page is loaded** / Aufruf der Ansicht: welche Schritte laufen beim ersten Öffnen der
  Citations-Ansicht, in welcher Reihenfolge?
- [ ] **„Do when condition is true“**-Workflows, die die Citations-Elemente betreffen.
- [ ] **Custom States** auf Seite oder Gruppen, die die Citations-Ansicht liest oder schreibt
  (Unterseite, Zeitraum, Filter, Seite, Sortierung …).
- [ ] **Bedingungen an den Elementen** selbst (Tab „Conditional“): sichtbar wenn …, Daten aus …
- [ ] **Teamwechsel:** was passiert mit der Citations-Ansicht, wenn das Team gewechselt wird?
- [ ] **Tarif/Paywall:** gibt es Einschränkungen (Zeitraum, Anzahl, gesperrte Funktionen)?
- [ ] **Andere Ansichten:** öffnet irgendetwas von woanders die Citations-Ansicht mit Vorauswahl
  (z. B. aus dem Dashboard „alle Domains anzeigen“, aus Quick Actions)?

## 3. Zurück an mich

Die Screenshots (oder Notizen) in den Chat. Ich mache daraus die Liste „alt → neu“: für jeden
heutigen Workflow, wo seine Aufgabe in der neuen Komponente landet. Kein Workflow wird gelöscht,
bevor er dort einen Platz hat und die neue Seite gegen die alte abgeglichen ist.
