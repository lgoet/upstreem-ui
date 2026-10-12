# App-Start: Bestand und Plan auf der Seite der Oberfläche (13.10.2026)

Gegenstück zu `app_start_db_auftrag.md` (Datenbank). Dieses Papier beschreibt den Kopf der Bubble-App und den Pageload-Workflow und legt fest, was nach dem Umbau bleibt.

**Quellen:**
- `bubble/kopf_skript_stand_13_10.html`: das Kopf-Skript, wie es in Bubble steht.
- `bubble/ladebild_udl_stand_13_10.html`: der Seiten-Loader.
- Die Screenshots des Pageload-Workflows (31 Schritte, Tabelle im DB-Auftrag, Abschnitt 0).

## 1. Das Kopf-Skript, Teil für Teil

| Teil | Was es tut | Heute nötig? | Nach dem Umbau | Next.js |
|---|---|---|---|---|
| `__framePainter` | Gemeinsamer Bild-Takt, solange ein Filepond-Upload (`.filepond--root`) auf der Seite steht. Fragt alle 500 ms das DOM ab. | Nur für Filepond. Bitte prüfen, ob Filepond noch irgendwo verwendet wird; sonst raus. | weg, wenn kein Filepond | weg |
| Thema und Dashboard-Art vorab (`data-up-pagetheme`, `data-up-dashboard`) | Setzt das Thema vor dem ersten Bild aus `localStorage.pref_theme`. | ja | ja. **Steht im Kopf ZWEIMAL wortgleich**, der zweite Block kann raus. | im Layout (Server liest das Cookie) |
| Asset-Lader (Pin) | Lädt core und die Komponenten vom CDN. | ja | ja | entfällt (gebündelt) |
| Seitengrund-Farben (`<style>`) | Kein weißer Blitz im Dunkelmodus. | ja | ja | ins globale CSS |
| Favicon-Skript | Tauscht das Favicon je nach System-Thema. **Beide Adressen sind dieselbe Datei**, das Skript tut also nichts. | nein | durch ein `<link rel="icon">` ersetzen | statisch |
| Leeren `#` entfernen | Räumt `https://app…/#` nach dem Login des Plugins auf. | ja, solange das Plugin anmeldet | ja | entfällt (eigene Anmeldung) |
| Drawer-CSS und DRAWER-SYSTEM v4 | Ebenen, URL-Zustand (`?detail=`), Scroll-Sperre, Zurück-Taste, `openDrawer`/`closeDrawer`/`closeAllDrawers`, `drawersReady()`, `bubble_fn_drawer_<name>`. Die sechs Drawer baut inzwischen core (`KERN_DRAWER`), Öffnen, Schließen und URL laufen aber weiter über dieses System. | ja | bleibt vorerst. `drawersReady()` ruft künftig core am Ende des Starts statt Bubble. `bubble_fn_drawer_<name>` wird für die core-Drawer nicht mehr gebraucht. | nach core (eine Datei) |
| `.bad-revision`, `apple-touch-icon` | Bubble-Hinweisleiste, Homescreen-Symbol | ja | ja | Symbol ins Layout |
| VIEW-SYSTEM v7 | Ansichten (`?view=`), `showView`, `mountIn`, `bubble_fn_view_first_<name>`/`view_changed` | ja | bleibt. Die Seiten laden selbst; `view_first_*` braucht nur noch, was noch an Bubble hängt. | Routing |
| `#up-glass-group` | Glas-Kopf | ja | ja | ins CSS |
| `#page-loader`, `hideLoader`/`showLoader` | Blendet den Loader aus, sobald die aktive Ansicht stabil steht (Notaus 20 s). | ja | bleibt; core ruft beim Start `startLoaderAnimation()` | eigenes Ladebild |

## 2. Der Pageload-Workflow nach dem Umbau

core führt den Start selbst aus, auf der Hauptseite (dort, wo die Seitenleiste `.usn-root` steht):
1. `startLoaderAnimation()`, falls vorhanden.
2. `app_start_v1(p_team_hint aus ?teamid=)`:
   - Nicht angemeldet: zur Anmeldung (wie im Onboarding).
   - Kein Team: `/onboarding` (`/version-test/onboarding` auf Test).
3. Aus der Antwort, in dieser Reihenfolge:
   - `setUpstreemTheme`, `setUpstreemTeam`, `setUpstreemDefaultMarket`;
   - Zugang: `setAccessGate`, VOR `drawersReady`, damit die Drawer-Sperre greift;
   - `setUpstreemQuota`;
   - `setSidebarTeams` / `setSidebarUser`;
   - Benachrichtigung: `setUpstreemNotifications`;
   - `?teamid=` aus der Adresse entfernen.
4. `team_context_v1(team)`: `setUpstreemBrands`, `…Topics`, `…Markets`, `…AllMarkets`, `…Models`, `…Events`.
5. `drawersReady()`, `setSidebarReady()`.

**Nachladen statt Custom Events:** `upstreemTopicsChanged`, `…MarketsChanged`, `…BrandsChanged` und `…EventsChanged` laden in core den Teil selbst über `team_context_v1(team, [teil])` nach. Wie `markenNachladen` es für Marken schon tut. Die Bubble-Elemente `bubble_fn_up*Changed` und die REFRESH-Workflows entfallen.

**Teamwechsel:** `usnTeam` und der Gate-Knopf „Switch team“ rufen `team_switch_v1` und laden danach neu (Schritte 3 und 4). Kein Seitenneuladen über Bubble.

**Das Nutzer-Token (`setUpstreemAuth`, Schritt 24):**
- **Wofür es gebraucht wird:**
  - die Export-Workflows in Bubble (Lukas, 13.10.);
  - in core das Profil (Name über GoTrue, Avatar über Storage, `preferences.js`).
- **Die RPCs der Komponenten brauchen es nicht:** core liest die Sitzung des Plugins selbst (`sb-<ref>-auth-token`) und frischt nie selbst auf.
- **Plan:** core setzt `AUTH.token` künftig selbst aus genau dieser Sitzung, statt es als Text aus einem Bubble-Schritt zu bekommen. Und es liest es bei jedem Gebrauch frisch, damit ein abgelaufenes Token nicht hängen bleibt. Damit entfällt Schritt 24, und das Token steht nicht mehr in einem Run-JS-Schritt.
- **Die Exporte selbst** sind eine eigene Runde: der Export-Workflow in Bubble wird ein Aufruf aus `export-data.js` mit derselben Sitzung.

## 3. Was in Bubble danach übrig bleibt

- das Kopf-Skript, wie in Abschnitt 1 bereinigt;
- die Elemente: Seitenleiste, Ansichten mit ihren Seiten, Loader, Quick Actions, Benachrichtigung, Gate;
- vorerst Bubble-Workflows für: Logout (Plugin), „New Team“ (Onboarding), Quick-Actions-Suche und Einstellungen (eigene Runden), Export (eigene Runde).

## 4. Gebaut (13.10.): was Bubble danach noch tut

core startet die Hauptseite selbst, sobald die Seitenleiste steht (`.usn-root`), gegen `APP_START_V1_VERTRAG.md`.

- **Aus dem alten Pageload-Workflow entfällt alles bis auf die Bubble-Zustände.** Ersatz ist ein Toolbox-Element „JavaScript to Bubble“ namens **`appStart`**, mit Trigger event und Publish value (Text).
  - core feuert es einmal am Ende des Starts, vor `drawersReady`.
  - Nutzlast: `{"team_id":"…","role":"owner|admin|member","has_access":true,"access_state":"active"}`.
  - Sein Workflow setzt, was nur Bubble kennt: State `role` (Regex `(?<="role":")[^"]*`), `content_hide`, `app_ready`, Loader ausblenden (heutige Schritte 13, 26–28, 31).
- **Seitenleiste:** Teamwechsel (`usnTeam`) macht core (`team_switch_v1`, Neuladen mit `?teamid=`). Der Bubble-Workflow `usnTeam` wird nicht mehr ausgelöst. „New Team“, Logout und Navigation bleiben Bubble.
- **Gate:** „Switch team“ (`uagTeam`) macht core. Tarife (`uagPlans`), Billing (`uagManage`), New Team und Logout bleiben Bubble.
- **Benachrichtigung:** Wegklicken macht core (`user_notification_dismiss_v1`). Der Workflow `uncDismiss` wird nicht mehr ausgelöst.
- **Thema:** Wechsel speichert core (`user_settings_set_v1`). `bubble_fn_theme_pref` feuert weiter, falls Bubble daran einen State hängt. Der REST-Schreibschritt auf `user_settings` darin muss weg.
- **REFRESH-Custom-Events:** Die vier Changed-Signale laden selbst nach. Die Elemente `upTopicsChanged`, `upMarketsChanged`, `upBrandsChanged`, `upEventsChanged` werden nicht mehr ausgelöst.
- **Profilbild und Name:** Das Token kommt aus der Sitzung des Plugins, „Set Internal AUTH“ entfällt.
