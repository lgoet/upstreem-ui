# Event-Pins: drei Beispiel-Schritte fuer die Diagramme (03.10.)

Jeder Schritt ersetzt die Events der Seite (`setUpstreemEvents`) -- danach zeigt JEDES Liniendiagramm die Pins, die in seinen Zeitraum fallen, und die Events-Uebersicht dieselben Karten. Die Daten sind Zeilen in der Form von `list_impact_events_v1` (Namen und Typen aus dem Vertrag und der Design-Vorgabe); die Tage stehen relativ zu heute.

## 1. Ein Event (vor 5 Tagen)

```javascript
/* Ein Event */
(function () {
  var ROH = `[
  {
    "id": "5e1d0c3b-aaaa-4f6e-9a7b-0000000000a1",
    "event_date": "T-5",
    "name": "Website Relaunch",
    "event_type": "website_relaunch",
    "icon": null,
    "color": null,
    "scope_mode": "topics",
    "selected_topic_count": 3,
    "affected_prompt_count": 24,
    "comparison_prompt_count": 38,
    "affected_url_count": 2,
    "can_delete": true
  }
]`
    .replace(/:\s*([,}\]])/g, ": null$1")
    .replace(/:\s*(yes|no)\s*([,}\]])/g, function (_, v, t) { return ": " + (v === "yes") + t; })
    /* Nur fuer die Vorfuehrung: "T-5" heisst "vor fuenf Tagen", damit die Pins in jedem Zeitraum
       ab sieben Tagen zu sehen sind, egal an welchem Tag der Schritt laeuft. */
    .replace(/"T-(\d+)"/g, function (_, n) {
      var d = new Date(); d.setDate(d.getDate() - Number(n));
      return '"' + d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0") + '"';
    });
  try { if (window.setUpstreemEvents) window.setUpstreemEvents(ROH); } catch (e) {}
})();
```

## 2. Mehrere Events, verteilt (vor 25, 14 und 4 Tagen)

Im 7-Tage-Zeitraum ist nur das juengste zu sehen, ab 30 Tagen alle drei.

```javascript
/* Mehrere Events */
(function () {
  var ROH = `[
  {
    "id": "5e1d0c3b-aaaa-4f6e-9a7b-0000000000a1",
    "event_date": "T-25",
    "name": "Website Relaunch",
    "event_type": "website_relaunch",
    "icon": null,
    "color": null,
    "scope_mode": "topics",
    "selected_topic_count": 3,
    "affected_prompt_count": 24,
    "comparison_prompt_count": 38,
    "affected_url_count": 2,
    "can_delete": true
  },
  {
    "id": "8b4a3f6e-dddd-4c91-8dae-0000000000d4",
    "event_date": "T-14",
    "name": "PR-Kampagne Herbst",
    "event_type": "pr_campaign",
    "icon": null,
    "color": null,
    "scope_mode": "topics",
    "selected_topic_count": 2,
    "affected_prompt_count": 14,
    "comparison_prompt_count": 38,
    "affected_url_count": 3,
    "can_delete": true
  },
  {
    "id": "7a3f2e5d-cccc-4b80-9c9d-0000000000c3",
    "event_date": "T-4",
    "name": "Produktlaunch Speicher X",
    "event_type": "product_launch",
    "icon": null,
    "color": null,
    "scope_mode": "topics",
    "selected_topic_count": 1,
    "affected_prompt_count": 9,
    "comparison_prompt_count": 38,
    "affected_url_count": 1,
    "can_delete": true
  }
]`
    .replace(/:\s*([,}\]])/g, ": null$1")
    .replace(/:\s*(yes|no)\s*([,}\]])/g, function (_, v, t) { return ": " + (v === "yes") + t; })
    /* Nur fuer die Vorfuehrung: "T-5" heisst "vor fuenf Tagen", damit die Pins in jedem Zeitraum
       ab sieben Tagen zu sehen sind, egal an welchem Tag der Schritt laeuft. */
    .replace(/"T-(\d+)"/g, function (_, n) {
      var d = new Date(); d.setDate(d.getDate() - Number(n));
      return '"' + d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0") + '"';
    });
  try { if (window.setUpstreemEvents) window.setUpstreemEvents(ROH); } catch (e) {}
})();
```

## 3. Mehrere Events eng beieinander (zwei am selben Tag, eins am Tag danach)

Steht als Stapel mit Gruppenkarte, sobald die Pins naeher als 24px stehen -- zwei am selben Tag immer, der dritte je nach Zeitraum.

```javascript
/* Eng beieinander */
(function () {
  var ROH = `[
  {
    "id": "d0000000-0000-4000-8000-000000000001",
    "event_date": "T-3",
    "name": "Newsletter-Versand",
    "event_type": "brand_campaign",
    "icon": null,
    "color": null,
    "scope_mode": "all",
    "selected_topic_count": null,
    "affected_prompt_count": 61,
    "comparison_prompt_count": 0,
    "affected_url_count": 0,
    "can_delete": true
  },
  {
    "id": "d0000000-0000-4000-8000-000000000002",
    "event_date": "T-3",
    "name": "Preisänderung",
    "event_type": "pricing_change",
    "icon": null,
    "color": null,
    "scope_mode": "topics",
    "selected_topic_count": 1,
    "affected_prompt_count": 9,
    "comparison_prompt_count": 38,
    "affected_url_count": 1,
    "can_delete": true
  },
  {
    "id": "d0000000-0000-4000-8000-000000000003",
    "event_date": "T-2",
    "name": "Website-Relaunch",
    "event_type": "website_relaunch",
    "icon": null,
    "color": null,
    "scope_mode": "topics",
    "selected_topic_count": 3,
    "affected_prompt_count": 24,
    "comparison_prompt_count": 38,
    "affected_url_count": 2,
    "can_delete": true
  }
]`
    .replace(/:\s*([,}\]])/g, ": null$1")
    .replace(/:\s*(yes|no)\s*([,}\]])/g, function (_, v, t) { return ": " + (v === "yes") + t; })
    /* Nur fuer die Vorfuehrung: "T-5" heisst "vor fuenf Tagen", damit die Pins in jedem Zeitraum
       ab sieben Tagen zu sehen sind, egal an welchem Tag der Schritt laeuft. */
    .replace(/"T-(\d+)"/g, function (_, n) {
      var d = new Date(); d.setDate(d.getDate() - Number(n));
      return '"' + d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0") + '"';
    });
  try { if (window.setUpstreemEvents) window.setUpstreemEvents(ROH); } catch (e) {}
})();
```

## Zuruecksetzen

```javascript
(function () {
  try { if (window.setUpstreemEvents) window.setUpstreemEvents(`[]`); } catch (e) {}
})();
```
