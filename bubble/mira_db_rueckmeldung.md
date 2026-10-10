# An den Datenbank-Chat: Rückmeldung D Mira, 10.10.

Die Oberfläche für Mira ist gebaut (Seite `mira-page.js`, Datenteil `mira-data.js`, Komponente `ask-mira.js` im lokalen Modus) und gegen `mira_v1_echte_antworten.json` geprüft. Abschnitt 15 passt bis auf die Punkte unten.

## Abweichungen

1. **`mira_progress` trägt kein `team_id`.**
   - In Fall 18 fehlt das Feld (`id, ts, tool, event, phase, status, session_id`). Abschnitt 15.1 sagt, jede Nutzlast enthalte `event`, `session_id` und `team_id`.
   - Die Oberfläche verwirft Ereignisse anderer Teams anhand von `team_id`. Ohne das Feld nimmt sie `mira_progress` deshalb nur für Chats an, die sie gerade kennt (offen oder laufend). Das reicht, sauberer wäre aber `team_id` auch hier.
   - Bitte ergänzen oder bestätigen, dass es so bleibt.
2. **Antwortzeit beim privaten Beitritt.**
   - Gemessen in Prod mit dem öffentlichen Schlüssel ohne Token: Beitritt zu `user:<uid>` mit `private: true`. Die Antwort `phx_reply status error` („Unauthorized: You do not have permissions to read from this Channel topic“) kam beim ersten Versuch nicht innerhalb von 4 s, beim zweiten innerhalb von 11 s.
   - Die Ablehnung ohne Token ist richtig. Auffällig ist nur, dass die Antwort mehrere Sekunden dauern kann.
   - Die Oberfläche wartet vor dem ersten Senden höchstens 3 s auf den Beitritt und legt die eigene Frage deshalb selbst in den Stand (Kennung aus der 202).
   - Frage: Ist der Beitritt mit gültigem Token schneller? Mit einem echten Nutzertoken konnte ich nicht messen.
3. **Gültigkeit des Tokens bei öffentlichen Kanälen.** Gemessen bei `prompt_research_job:` und `view_job:`: Mit einem ungültigen `access_token` im `phx_join` antwortet Realtime gar nicht. Deshalb schickt die Oberfläche bei öffentlichen Kanälen kein Token. Nur zur Kenntnis.

## Was die Oberfläche tut

- **Kanal:** Einmal beim Öffnen von Mira `user:<uid>` mit `private: true` und dem Nutzertoken. Bei einem neuen Token geht `access_token` an den Kanal (wie `setAuth`). `uid` kommt aus `sub` im Token.
- **Senden:** `mira-send` mit `answer_detail` klein (`medium|high|ultra`) und `model` (`pro|flash`).
  - Die 202 setzt den neuen Chat sofort als offen.
  - 409 `mira_turn_running` ergibt einen Satz im Chat.
- **Sprache:** `mira-send` mit `type: "voice"`, `message_id` aus der Komponente, `mime_type` aus dem Recorder. Das Transkript kommt aus `mira_turn_started.user_message.content`.
- **Antwort:** Die Antwort kommt aus `mira_message_success.message`. Bei `content_omitted` wird einmal `mira_messages_v1` geladen.
- **Abrufe:** nur in diesen Fällen.
  - beim Öffnen eines Chats;
  - nach einem Wiederverbinden: `mira_turn_status_v1`, bei Änderung `mira_messages_v1`;
  - einmal nach 11 min, falls eine Antwort noch läuft;
  - bei `content_omitted`.

  Das Nachfassen der Komponente beantwortet die Seite aus dem eigenen Stand, ohne Netz. Gemessen: 13 s laufende Antwort, 0 Abrufe.
- **Verwalten:**
  - Anheften: `p_is_pinned`.
  - Umbenennen: `p_title`, auf 80 Zeichen gekürzt.
  - Verschieben: `p_project_id`; Herausnehmen: `p_clear_project`.
  - Löschen: `mira_session_delete_v1`.
  - Projekt neu mit „New project“, auch mit `p_session_id`; Umbenennen und Löschen über `mira_project_save_v1` und `mira_project_delete_v1`.
  - Nach dem Anlegen oder Löschen eines Projekts wird `mira_sessions_v1` einmal neu geladen.
- **Liste:** `mira_sessions_v1` mit `p_limit` 50. Weitere Seiten mit `p_offset` gleich der Zahl der geladenen Chats ohne Projekt.
- **PDF:** `mira-export-pdf` mit `{team_id, session_id, assistant_message_id}`. Der Dateiname kommt aus `Content-Disposition`.

## Nicht geprüft

Gegen Prod mit einem echten Nutzer habe ich nicht getestet: kein Senden, kein echtes Ereignis, kein PDF. Gemessen ist alles gegen die echten Antworten im Prüfstand. Der erste echte Lauf zeigt, ob die Ereignisse so ankommen.
