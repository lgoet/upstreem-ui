# Nachtrag zur Power-Dashboard-Datenspezifikation

Gehört zu `power_dashboard_daten.md` und ergänzt sie um zwei Dinge, die dort fehlten:

1. **Zwei weitere Blöcke brauchen Daten** — "Recent chats" und das Opportunities-Brett. Sie gehen
   an eigene Setter, aber sie kommen aus **demselben RPC**. Es bleibt bei **einem** Aufruf.
2. **Zwei Abschnitte werden nur auf Anforderung geladen** — `citations_url` und `opportunities`.
   Die Oberfläche sagt selbst, wann sie gebraucht werden.

Am Schnitt des RPC aus der Hauptdatei ändert sich nichts, es kommen nur Abschnitte dazu.

---

## 1. Der RPC bekommt zwei Abschnitte mehr

```
power_dashboard(team_id, user_id, range, sections[])
```

`user_id` ist neu — die Chatliste hängt am Nutzer, nicht am Team.

| Abschnitt | Antwortfeld | Geht an | Wann laden |
|---|---|---|---|
| `overview` | `overview` | `renderPowerDashboard` | immer |
| `brands` | `brands` | `renderPowerDashboard` | immer |
| `citations_domain` | `top_domains`, `totalCountDomain` | `renderPowerDashboard` | immer |
| `citations_url` | `top_urls`, `totalCountUrl` | `renderPowerDashboard` | **auf Anforderung** |
| `chats` | `chats` | `askMiraSetPreviousChats` | immer |
| `opportunities` | `opportunities` | `opportunitiesSetItems` | **auf Anforderung** |

Beim Seitenladen also **ein** Aufruf mit vier Abschnitten:

```
sections = [overview, brands, citations_domain, chats]
```

Die Antwort wird in **einem** Run-JS-Schritt auf die drei Setter verteilt — Kapitel 4.

---

## 2. Die zwei neuen Abschnitte

### 2.1 `chats` → `askMiraSetPreviousChats`

Die Chats des angemeldeten Nutzers, neueste zuerst. Fürs Dashboard reichen drei, Miras eigene
Chatleiste zeigt mehr — die Menge bestimmst du, ein Abschnitt für beide.

| Feld | Pflicht | Wofür |
|---|---|---|
| `id` | ja | Kennung; ein Klick im Dashboard öffnet genau diesen Chat |
| `title` | ja | der angezeigte Text |
| `updated_at` | empfohlen | Reihenfolge **und** die Spalte rechts: "Today", "Yesterday" oder das Datum |

Statt `updated_at` werden auch `last_message_at`, `modified_date`, `created_at` gelesen — der
erste, der da ist, zählt. Ohne Zeitstempel gilt deine Reihenfolge, und rechts steht nichts.

```json
[ { "id": "1712…", "title": "Wettbewerber aufholen", "updated_at": "2026-09-14T10:00:00Z" } ]
```

Eine **leere** Liste beendet den Ladezustand absichtlich nicht — Bubble schickt regelmäßig eine
leere, bevor die Suche zurück ist. Der echte Leerfall fällt nach sechs Sekunden auf "No chats yet".

### 2.2 `opportunities` → `opportunitiesSetItems`

Dieselbe Liste, die das Opportunities-Brett ohnehin bekommt. Feldschema vollständig in
`opportunities_bubble.html`; Pflicht sind nur `id` und `headline`.

Standardmäßig zeigt das Brett **Pending** und **In Progress**; "Done" und "Ignored" liegen hinter
dem Schalter in den Brett-Einstellungen. Liefere trotzdem alle vier Zustände — der Nutzer kann sie
einblenden, und ein Nachladen dafür gibt es nicht.

---

## 3. Was "auf Anforderung" heißt

Die Oberfläche merkt sich den zuletzt gewählten Reiter im Browser. Bubble kann das nicht wissen —
deshalb **sagt die Oberfläche es selbst**, über ein Ereignis:

```
data-needs-fn = "bubble_fn_upwNeeds_[dynamic id]"
Nutzlast: { "tab": "brands" | "citations" | "opportunities",
            "needs": "brands" | "citations_domain" | "citations_url" | "opportunities" }
```

Es feuert:

* **einmal beim Aufbau**, mit dem wiederhergestellten Reiter — wer zuletzt auf "Opportunities"
  stand, sieht diesen Reiter sofort beim Laden, und das Ereignis sagt es;
* **bei jedem Reiterwechsel**;
* **beim Umschalten Domains ↔ URLs**.

Der Workflow darauf: `needs` lesen, prüfen ob dieser Abschnitt schon geladen wurde, und wenn
nicht, den RPC mit genau diesem einen Abschnitt nachladen und an den passenden Setter geben.
Ist er schon da, nichts tun — das Ereignis kommt bei jedem Wechsel, auch beim Zurückwechseln.

`brands` steht mit in der Liste, obwohl es ohnehin immer geladen wird: so muss der Workflow keine
Sonderfälle kennen, sondern nur "habe ich das schon?".

---

## 4. Der Run-JS-Schritt verteilt auf drei Setter

Ein Aufruf, eine Antwort, drei Setter. Jeder in **eigenem** try, sonst reißt ein kaputter Teil die
anderen mit.

```javascript
(function () {
  var ROH = `[RPC-Ergebnis als JSON]`
    .replace(/:\s*([,}\]])/g, ": null$1")
    .replace(/:\s*(yes|no)\s*([,}\]])/g, function (_, v, t) { return ": " + (v === "yes") + t; });
  var D = {};
  try { D = JSON.parse(ROH); } catch (e) { D = {}; }

  /* 1. Dashboard: instanceId zuerst, damit die Kennung auch bei abgeschnittener Nutzlast steht */
  try {
    if (window.renderPowerDashboard) window.renderPowerDashboard(JSON.stringify({
      instanceId: "INSTANCE_ID",
      overview: D.overview, brands: D.brands,
      top_domains: D.top_domains, top_urls: D.top_urls,
      citations_label: D.citations_label,
      totalCountDomain: D.totalCountDomain, totalCountUrl: D.totalCountUrl
    }));
  } catch (e) {}

  /* 2. Miras Chatliste -- nur wenn der Abschnitt dabei war */
  try {
    if (D.chats && window.askMiraSetPreviousChats) window.askMiraSetPreviousChats(D.chats);
  } catch (e) {}

  /* 3. Das Opportunities-Brett -- dito */
  try {
    if (D.opportunities && window.opportunitiesSetItems) window.opportunitiesSetItems(D.opportunities);
  } catch (e) {}
})();
```

Die `if (D.x && …)`-Prüfungen sind wichtig: Beim Nachladen eines einzelnen Abschnitts sind die
anderen Felder nicht dabei, und ein Setter mit `undefined` würde eine gefüllte Liste leeren.

Keiner der drei wartet auf einen anderen. Jeder Setter hat eine Boot-Warteschlange — kommt ein
Aufruf, bevor sein Skript geladen ist, wird er abgelegt und beim Start nachgespielt.

---

## 5. Cache

Die vier Abschnitte aus der Hauptdatei hängen am nächtlichen Auswertungslauf. **`chats` nicht** —
die ändern sich, sobald der Nutzer etwas tut.

| Abschnitt | Schlüssel | Fällt, wenn |
|---|---|---|
| `overview`, `brands`, `citations_domain`, `citations_url` | `team_id + range + section + last_run_at` | ein neuer Auswertungslauf durch ist |
| `opportunities` | `team_id + last_run_at` **und** jede Statusänderung | eine Karte die Spur wechselt, erstellt oder ignoriert wird |
| `chats` | `user_id` | siehe unten |

### Der Chat-Cache

Pro Nutzer, und er fällt bei **jeder** Änderung an dessen Chats:

* Chat erstellt
* umbenannt
* gelöscht
* in ein Projekt verschoben oder herausgenommen
* angepinnt / losgelöst
* **neue Nachricht in einem Chat** — sie ändert `updated_at` und damit die Reihenfolge

Der letzte Punkt ist der, den man leicht vergisst, und er ist der häufigste: Jede gesendete
Nachricht macht die Liste veraltet. Am einfachsten ist es, den Schlüssel an einen Zeitstempel zu
hängen, den all diese Vorgänge ohnehin schreiben — etwa das jüngste `updated_at` über die Chats
des Nutzers: `user_id + max(updated_at)`. Dann fällt der Cache von selbst, ohne dass irgendein
Workflow ans Invalidieren denken muss.

Das Opportunities-Brett hat dieselbe Eigenheit: Es schreibt Statusänderungen **sofort** in seine
eigene Anzeige und meldet sie danach an Bubble. Der Cache muss also auch dort auf die Mutationen
hören, sonst kommt beim nächsten Laden der alte Stand zurück und schiebt die Karte sichtbar
zurück.
