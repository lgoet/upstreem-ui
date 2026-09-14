# Nachtrag zur Power-Dashboard-Datenspezifikation

Gehört zu `power_dashboard_daten.md` (Stand 14.09.) und ergänzt sie um das, was dort fehlte:
**zwei der fünf Blöcke laufen nicht über den Dashboard-RPC**, brauchen aber trotzdem eine
Abfrage. Wer nur die drei RPC-Abschnitte baut, bekommt ein Dashboard mit zwei leeren Kästen.

Am RPC aus der Hauptdatei ändert sich dadurch **nichts**.

---

## Die zwei Listen neben dem Dashboard-RPC

Diese zwei füttern **nicht** das Dashboard, sondern Mira und das Opportunities-Brett. Das
Dashboard leiht sich beide Elemente und zeigt, was darin steht. Zu holen sind sie trotzdem — und
zwar **im Workflow "When page is loaded"**, nicht an der Sichtbarkeit der jeweiligen Gruppe.

Der Grund ist gemessen, nicht vermutet: Hängt der Workflow an der Sichtbarkeit, läuft er nie,
solange der Nutzer diese Ansicht nicht besucht hat — und wer direkt auf dem Power Dashboard
landet, sieht dann zwei leere Kästen. Die Oberfläche selbst wartet beliebig lange: schickt man die
Listen neun Sekunden nach dem Laden, nimmt sie sie an und zeigt sie sofort.

### 1. Die Chatliste → `askMiraSetPreviousChats`

Abfrage: die Chats des angemeldeten Nutzers, neueste zuerst. Für das Dashboard reichen **drei**,
Miras eigene Chatleiste zeigt mehr — eine Abfrage für beide, die Menge bestimmst du.

| Feld | Pflicht | Wofür |
|---|---|---|
| `id` | ja | Kennung; ein Klick im Dashboard öffnet genau diesen Chat |
| `title` | ja | der angezeigte Text |
| `updated_at` | nein, aber empfohlen | Reihenfolge **und** die Spalte rechts: "Today", "Yesterday" oder das Datum |

Statt `updated_at` werden auch `last_message_at`, `modified_date` und `created_at` gelesen — der
erste, der da ist, zählt. Ohne jeden Zeitstempel gilt die Reihenfolge, in der du die Liste
schickst, und rechts steht nichts.

```json
[ { "id": "1712…", "title": "Wettbewerber aufholen", "updated_at": "2026-09-14T10:00:00Z" } ]
```

Eine **leere** Liste beendet den Ladezustand absichtlich nicht — Bubble schickt regelmäßig eine
leere, bevor die Suche zurück ist. Der echte Leerfall fällt nach sechs Sekunden von selbst auf
"No chats yet".

### 2. Die Opportunities → `opportunitiesSetItems`

Dieselbe Liste, die das Opportunities-Brett ohnehin bekommt — es gibt **keine** zweite Abfrage und
keinen zweiten Setter für das Dashboard. Nur der Auslöser muss "When page is loaded" sein.

Das Feldschema steht vollständig in `opportunities_bubble.html`; Pflicht sind dort nur `id` und
`headline`, alles andere ist abgestuft freiwillig. Standardmäßig zeigt das Brett die Spuren
**Pending** und **In Progress**; "Done" und "Ignored" liegen hinter dem Schalter in den
Brett-Einstellungen. Liefere trotzdem alle vier Zustände — der Nutzer kann sie einblenden.

### 3. Was das für die Reihenfolge heißt

Beim Seitenladen laufen also **drei** Dinge nebeneinander:

1. der Dashboard-RPC mit `overview, brands, citations_domain` → `renderPowerDashboard`
2. die Chatliste → `askMiraSetPreviousChats`
3. die Opportunities → `opportunitiesSetItems`

Keines wartet auf ein anderes. Jeder Setter hat eine Boot-Warteschlange: Kommt ein Aufruf, bevor
das zugehörige Skript geladen ist, wird er abgelegt und beim Start nachgespielt. Du darfst alle
drei sofort abfeuern.
