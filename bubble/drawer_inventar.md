# Drawer: Bestand (Stand 11.10.2026)

Grundlage für den Umbau der Detail-Drawer zu Komponenten, die ihre Daten selbst laden (wie die
Seiten). Erster Drawer: **Response Detail**. Danach URL, Domain, Prompt, Brand, Brand Editor.

---

## 1. Das Drawer-System heute (Kopf-Skript, „DRAWER-SYSTEM v4“)

Steht nicht im Repo, sondern im Kopf der Bubble-Seite (vom Nutzer am 11.10. geschickt).

- **DOM je Drawer:** Bubble-Floating-Groups `#drawer-<art>` (Klasse `open`), `#backdrop-<art>`,
  `#content-<art>` (Klasse `ready`, sonst unsichtbar). Reusable darin.
- **Ebenen:** `brand 1, prompt 1, domain 1, url 2, response 2, mention 2, companysettings 3`.
  `openDrawer` schließt jeden offenen Drawer derselben oder einer höheren Ebene. z-index
  Drawer 9910/9920/9930, Schleier 9905/9915/9925.
- **Bewegung (CSS mit !important):** zu `translateX(110%)`, 180 ms ease-in; auf 220 ms
  `cubic-bezier(.32,.72,0,1)`. Schleier 160/200 ms, Unschärfe 1,5 px. Inhalt 230 ms nach dem
  Slide: Deckkraft und 6 px von unten, 180 ms.
- **Adresse:** `?detail=name:id,name:id` (Reihenfolge = Ebene). Zurück schließt den obersten,
  ein Link öffnet den Zustand, Neuladen stellt ihn wieder her, sobald Bubble `drawersReady()` ruft
  (Notfallnetz 30 s).
- **Scroll-Sperre:** `#main.drawer-locked`, Position wird gemerkt.
- **Escape** schließt den obersten. `closeDrawer(art)` schließt diesen und alles darüber,
  `closeAllDrawers()` alle.
- **Bubble-Meldungen:** beim Öffnen `bubble_fn_drawer_<art>(id)` (wartet bis 10 s auf das
  Element), 200 ms nach dem Schließen `bubble_fn_drawer_closed_<art>()`.

core hängt sich daran an (`onDrawerOpen`/`onDrawerClose`, `drawerRiegel`, `OFFENE_DRAWER`,
`drawerOeffnen`, `closeAllDrawers`, `anMira`), dazu das Tor des Kalenders an
`bubble_fn_drawer_<art>` (date-range.js 1943–2240). Eigene Drawer-Hülle in core:
`makeSeitenDrawer` (nur Ads, Ebene 9904 unter den App-Drawern, ohne Adresse und Ebenen).

## 2. Die Drawer

| Drawer (art, Kennung) | Baustein | Daten heute | RPC heute |
|---|---|---|---|
| response (`prompt_run_id`) | `response-detail.js` (urd) + `drawer-topbar.js` (utb) | Workflow „drawer_response“ → `setResponseDetail` | `get_mention_detail_v8` |
| url (Adresse) | `url-detail.js` (uud) + Kalender + topbar | Workflow → `setUrlDetail`, `…Conversion`, `…Summary` | nicht dokumentiert (`get_url_bundle_v7`?) |
| domain (Name) | `domain-detail.js` (udd) + urls-table + Kalender + topbar | Workflow → `setDomainDetail`, `…Urls` | nicht dokumentiert |
| prompt (`prompt_id`) | reine Bubble-Komposition, Filter und Kalender `*_promptspotlight` | Workflows | nicht dokumentiert |
| brand (`company_id`) | `brand-detail.js` (ubd) + Kalender + topbar (+ responses-table?) | Workflows → `setBrandDetail*` | `get_company_detailed_overview_v4`, `…chart_v4`, Variationen |
| companysettings (`company_id`) | `brand-editor.js` (ube) + topbar | Workflow → `setBrandEditor`; Schreiben über ube*-Ereignisse | `get_company_edit_v2` und sechs Schreib-RPCs |

Kein Baustein lädt selbst; keiner kennt den lokalen Modus. `mention` steht in den Ebenen, wird
aber nirgends geöffnet.

## 3. Response Detail im Einzelnen

- **urd** (1782 Zeilen): Kopf (Prompt als Titel, Modell, Zeit, Market, Topics, „Mentioned“),
  Products (Shopping-Karten), Ads (Ad-Karten), Full Response (Text über `UC.respBody`:
  Absätze, Tabellen, nummerierte Zitat-Chips, Markenauszeichnung, Produkte im Text), Citations
  (Kacheln/Liste, Marken-Filter). Menü „Highlights“: Marken *All / First only / Your brand only /
  Off*, Zitat-Chips an/aus, benachbarte gruppieren — im localStorage je Team.
- Setter `setResponseDetail(id, json, fehler)`, `setResponseDetailFrom`, `…Loading`, `reset…`.
  Füllt die Kopfleiste selbst (`setDrawerTopbar`: Typ response, „Modell, Datum“, `prompt_id`
  für den Blitz).
- Ereignisse `urdPrompt/Brand/Url/Domain/View/Product/Ad`; ohne Empfänger öffnet urd die Drawer
  selbst (`fireOderDrawer`) bzw. wechselt zu Shopping/Ads.
- **utb** (727 Zeilen): eine Zeile 32 px — Zurück, „TYP / Bild / Name“, je Typ ein Knopf (Stift,
  Globus, Blitz), AI, Mira, Pin, X. Kennt den Stapel nicht; Zurück und X schließen beide.

## 4. Wo Drawer geöffnet werden (Einstiege)

`UC.drawerOeffnen`/`openDrawer`: ads, shopping, url-detail, response-detail, drawer-topbar,
events, prompts-page, dashboard-page, brands-page, settings-page, performance-page,
citations-page, opportunities-page, power-dashboard, ask-mira. Indirekt über Bubble:
quick-actions, Pins der Seitenleiste, Zeilenklicks nicht-lokaler Tabellen, Mira-Belege,
`?detail=` beim Laden. Diese Einstiege bleiben: der Umbau ändert, WAS aufgeht, nicht WIE man
es öffnet.

## 5. Was der Umbau ändert (Kurzfassung)

- Ein Drawer wird eine Komponente, die beim Öffnen ihre Daten selbst holt (`UC.rpc`, Nutzer-JWT),
  statt auf einen Bubble-Workflow zu warten.
- Die Hülle (Bewegung, Kopf, Ebenen, Adresse, Scroll-Sperre, Escape, Fokus) stellt core; sie
  hält den Vertrag des Kopf-Skripts ein (`openDrawer`, `?detail=`, Ebenen), damit alle Einstiege
  unverändert bleiben und die noch nicht umgebauten Bubble-Drawer daneben weiterlaufen.
- Neues Layout nach dem Designvorschlag (aufgeräumter, eigene Mobilfassung), Farben, Radien und
  Maße aus dem Styleguide. Hervorhebungen im Antworttext bleiben exakt wie sie sind.

## 6. Stand Response Detail (11.10., gebaut)

- **Hülle aus core** (`core.js`, `KERN_DRAWER`): `#drawer-response` und `#backdrop-response` mit den
  Ids des Kopf-Skripts. Gebaut wird sie bei `drawersReady()` und bei jedem Öffnen, aber **nur, wenn
  Bubble keine Floating Group mit dieser Id mehr hat**. Ebenen, `?detail=`, Zurück-Taste,
  Scroll-Sperre und Escape bleiben beim Kopf-Skript.
- Ohne `#content-response`: der Inhalt fährt mit der Fläche herein statt 230 ms danach.
- Kopf 56 px: Zurück (nur wenn darunter ein Drawer liegt), „Response / Modell, Datum“, Blitz zum
  Prompt, Schließen. Schwebend 8 px vom Rand, Radius 12, bis 840 px breit, Spalte 720. Unter
  768 px ganze Seite, Kopf mittig „Response“.
- **Daten:** `response-detail.js` ruft beim Öffnen `get_mention_detail_v8` selbst (vor dem
  Hereinfahren), Zwischenspeicher 20 Antworten, Frist 20 s, Fehler mit „Try again“ (nicht bei
  „nicht gefunden“ und „kein Zugang“). `response_detail_v1` ({meta, row}) wird schon gelesen.
- Escape mit offenem Menü schließt erst das Menü. Fokus beim Öffnen auf die Fläche, beim
  Schließen zurück auf den Auslöser. Zu ist die Fläche `inert`.

## 7. Vorschlag für das Kopf-Skript (optional, gilt für ALLE Drawer)

Recherche 11.10. (vaul, shadcn, Primer, Geist): herein unter 300 ms, hinaus etwas schneller, nie
ease-in; keine Unschärfe am Schleier (kostet Bildrate auf großen Flächen); reduzierte Bewegung
beachten. Im DRAWER-CSS des Kopf-Skripts diese Werte ersetzen bzw. ergänzen:

```css
[id^="drawer-"] {
  transform: translateX(110%) !important;
  transition: transform 200ms cubic-bezier(0.32, 0.72, 0, 1) !important;
  box-shadow: -12px 0 32px rgba(0,0,0,0.15);
  will-change: transform;
  backface-visibility: hidden;
}
[id^="drawer-"].open {
  transform: translateX(0) !important;
  transition: transform 260ms cubic-bezier(0.32, 0.72, 0, 1) !important;
}
[id^="backdrop-"].open {
  opacity: 1 !important;
  pointer-events: auto !important;
  transition: opacity 200ms ease !important;
}
@media (prefers-reduced-motion: reduce) {
  [id^="drawer-"], [id^="drawer-"].open,
  [id^="backdrop-"], [id^="backdrop-"].open,
  [id^="content-"], [id^="content-"].ready { transition: opacity 120ms ease !important; }
}
```

(Die zwei `backdrop-filter`-Zeilen in `[id^="backdrop-"].open` fallen dabei weg.)

## 8. Stand URL Detail (12.10., gebaut gegen den Vorschlag)

- **Drawer aus core** wie Response Detail (`KERN_DRAWER.url`, 80 % breit). Inhalt von oben:
  Kalender (lokal, nimmt am geteilten Zeitraum teil), die Seite (`url-detail.js`, neuer Kopf),
  die Responses-Tabelle (`responses-table.js`, lokaler Modus, Markup aus `.url_markup.py`).
- **Kopfleiste:** „URL / Titel“, Globus (Domain-Drawer), Create with AI, Ask Mira, Anheften
  (nur, wenn die Seitenleiste auf der Seite ist), Schließen.
- **Daten:** `url_detail_v1(p_team, p_url, p_date_from, p_date_to)` → `{meta, row}` und
  `cached_dashboard_responses_v1` mit `p_url`. Beides ist der Vorschlag an den DB-Chat
  (`bubble/url_detail_db_auftrag.md`), noch nicht gebaut.
- Neuer Zeitraum für dieselbe Seite: gedimmt statt Skelett. Zwischenspeicher je Adresse und
  Zeitraum (20).
- **Export der Tabelle im Drawer ausgeblendet**, bis der Export `p_url` kennt (Frage C im Auftrag).
- Der Detail-Kopf (Meta-Zeile, Titel, Leisten, Abschnittsköpfe) liegt jetzt in core (`.up-dk-*`)
  und wird von Response Detail und URL Detail gemeinsam benutzt.

## 9. Stand Prompt Detail (12.10., gebaut gegen den Vorschlag)

- **Drawer aus core** (`KERN_DRAWER.prompt`, erste Ebene, 88 % breit), Datei `prompt-detail.js`
  (Präfix `uprd`), Markup der Bausteine aus `.prompt_detail_markup.py`.
- Kopf: „Prompt / Text“, Ask Mira, Anheften. Meta-Zeile: Market, Topics, letzter Lauf. Titel:
  der Prompt. Filterzeile: Kalender und Filterleiste nur mit Modellen.
- Darunter Visibility Chart, Top Citations, Responses: dieselben Anfragen wie das Dashboard
  (`dashboard-data.js`), dazu `p_prompt_id`. Kopf über `prompt_detail_v1`. Beides ist der
  Vorschlag an den DB-Chat (`bubble/prompt_detail_db_auftrag.md`).
- Export aus dem Drawer gibt `prompt_id` in der Nutzlast an Bubble weiter.
- Neue Datei im Vorlade-Snippet: `css("prompt-detail.css"); js("prompt-detail.js");`.
