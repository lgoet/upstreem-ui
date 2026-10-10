# Prompt Insights: was nur in Bubble steht (Stand 10.10.2026)

Wozu: Die neue Seite übernimmt **alles**, was die Workflows der Prompts-Ansicht heute tun, auch
Nebenwirkungen, die nirgends dokumentiert sind. Den Code der Komponenten kenne ich vollständig.
Was ich nicht sehen kann, steht nur in Bubble. Darum einmal durch die Workflows unten gehen und
zu jedem **einen Screenshot der Schrittliste** (mit aufgeklappten „Only when“). Wo nur der
RPC-Aufruf und der Setter danach stehen, reicht „nur RPC + Setter“.

Wichtig sind vor allem Schritte, die **etwas anderes** anfassen: anderer RPC, n8n, E-Mail,
Custom State einer anderen Gruppe, `setUpstreem*`, Toast, Kontingent.

## 1. Workflows hinter den Ereignissen

| Element | Ereignis (Name ohne `_<id>`) | Was ich wissen muss |
|---|---|---|
| Seitenkopf | `pphNav`, `pphRefresh`, `pphAdd` | Was passiert beim Wechsel der Unterseite (States, Sichtbarkeit)? Was tut „Aktualisieren“ (welche RPCs, Cache)? |
| Kalender (`dates_v2_prompts`) | `udr_date_range`, `udr_date_boot_prompts` (bzw. eure Namen) | Welche RPCs laufen danach neu, für welche Unterseite? |
| Filter | `utfTopics_topics_prompts`, `umfModels_prompts`, `umfApply_prompts`, `umkMarkets_prompts`, `umkApply_prompts`, dazu `umfModels_responses`, `umfApply_responses`, `umkMarkets_responses`, `umkApply_responses` | Dasselbe. Haben Prompts und Responses heute wirklich getrennte Filter? |
| Prompt-Tabelle | `uptSearch`, `uptSort`, `uptPage`, `uptStatus`, `uptBrand`, `uptMentioned` | nur RPC + Setter, oder mehr? |
| Prompt-Tabelle | `uptGroups`, `uptGroupOpen` | dasselbe |
| Prompt-Tabelle | `uptRowClick` | Öffnet es nur den Prompt-Drawer, oder setzt es noch etwas? |
| Prompt-Tabelle | `uptEditTopics`, `uptApplyBulkTopics`, `uptAddTopics` | Welcher RPC? Was danach (Topics neu laden, `setUpstreemTopics`, Toast)? |
| Prompt-Tabelle | `uptBulkStatus`, `uptBulkDelete` | Welcher RPC? Prüft der Workflow das Planlimit? Kontingent danach neu? Toast? |
| Prompt-Tabelle | `uptSelect` | Nutzt irgendein Workflow die Auswahl (z. B. ein Knopf außerhalb der Tabelle)? |
| Response-Tabelle | `urtSearch`, `urtSort`, `urtPage`, `urtView`, `urtFilter`, `urtBrand`, `urtMentioned` | Welcher RPC (Name)? Dieselbe Funktion wie im Dashboard? |
| Response-Tabelle | `urtRowClick` | nur Response-Drawer? |
| Topic-Verwaltung | `utmAdd`, `utmEdit`, `utmDelete` | Welche RPCs? Was danach (`renderTopicsManager`, `setUpstreemTopics`, Prompt-Tabelle neu)? |
| Anlage-Dialog | `uapAddPrompts` | Welcher RPC? Startet etwas danach (erster Lauf, n8n, E-Mail)? Kontingent neu? |
| Sidebar | `usnNav` | Außer `resetPromptsTable("prompts_table")` noch etwas für die Prompts-Ansicht? |

## 2. Was nicht an einem Ereignis hängt

- [ ] **Page is loaded** bzw. erstes Öffnen der Prompts-Ansicht: welche Schritte, in welcher
  Reihenfolge (Prompts, Gruppen, Responses, Topics, Kontingent, Marken)?
- [ ] **„Do when condition is true“**-Workflows, die Elemente dieser Ansicht betreffen.
- [ ] **Custom States** der Ansicht (Unterseite, Grouping an/aus, Zeitraum, Filter, Seite, Sortierung …).
- [ ] **Bedingungen an den Elementen** (Tab „Conditional“): sichtbar wenn …, Daten aus …
- [ ] **Teamwechsel:** was passiert mit der Ansicht?
- [ ] **Tarif:** gibt es irgendwo eine Sperre oder einen Upgrade-Hinweis (Prompts, Topics)?
- [ ] **Andere Ansichten,** die die Prompts-Ansicht mit Vorauswahl öffnen (Dashboard, Quick
  Actions, Mira, Prompt Research).

## 3. Zurück an mich

Screenshots oder Notizen in den Chat. Daraus mache ich die Liste „alt → neu“. Kein Workflow wird
gelöscht, bevor er in der neuen Seite einen Platz hat.
