# Nachtrag 1 an den Datenbank-Chat: Abschluss nach der Kasse (13.10.2026)

Diesen Text in den Datenbank-Chat geben. **Vorrang vor dem Rest des Onboarding-Auftrags:** Das
ist ein Fehler, der heute live ist.

## Der Fehler

Lukas: Nach dem Onboarding wird bei Stripe bezahlt, Stripe leitet mit korrektem Billing auf die
Bubble-Seite `onboarding-success` weiter. **Das Onboarding wird aber nie als abgeschlossen
markiert.** Auf der Seite soll `get_onboarding_completion_status_v1` laufen. Ob diese Funktion den
Abschluss setzen soll oder nur liest, weiß Lukas selbst nicht mehr sicher.

Im Repo gibt es zu `onboarding-success` nichts: keine Komponente, keinen Aufruf dieser Funktion.
Die Seite ist reines Bubble. Was sie genau ruft, schickt Lukas als Screenshot nach.

## Bitte klären (nur lesen, nichts ändern)

1. **`get_onboarding_completion_status_v1`:**
   - Definition, Parameter, Rechte, md5.
   - Liest sie nur, oder schreibt sie (Status, Phase, Team anlegen)?
   - Aufrufe in den letzten 30 Tagen (`pg_stat_statements`, Rolle).
   - Antwort für ein Onboarding, das bezahlt ist, und für eines, das es nicht ist.
2. **Wer setzt den Abschluss wirklich?** Laut Phasentabelle setzt eine Finalize-Funktion Phase 95
   (`finalizing`) und 100 (`completed`).
   - Welche Funktion ist das, und wer ruft sie auf? Den Stripe-Webhook (welche Edge Function,
     welches Ereignis: `checkout.session.completed`, `customer.subscription.created`,
     `invoice.paid`)? Die Erfolgsseite? Beide?
   - Trägt die Kassen-Sitzung aus `create-onboarding-checkout` die Angaben, die der Webhook dafür
     braucht (`metadata.onboarding_id`, `user_id`, `client_reference_id`)?
   - Ist der Webhook-Endpunkt in Stripe für **dieses** Ereignis eingerichtet, und für Live und
     Test?
3. **Was ist bei den letzten echten Fällen passiert?** Je bezahltem Onboarding der letzten 30
   Tage (oder den letzten 10):
   - Status und Phase des Onboardings;
   - ob ein Team angelegt wurde und ob das Abo am Team hängt;
   - die Logs der Webhook-Function zu dieser Sitzung (kam das Ereignis an, Signatur gültig,
     Fehler?);
   - wo es stehen bleibt.
4. **`create-onboarding-checkout`:** `success_url` und `cancel_url` genau so, wie sie gebaut
   werden (mit `{CHECKOUT_SESSION_ID}`?). Dazu: Unterscheidet sich `version-test` von Live?
5. **Missbrauch:** Falls der Abschluss heute von der Seite aus gesetzt wird oder werden soll: Kann
   ein Nutzer ihn auslösen, ohne bezahlt zu haben? Das wäre ein Team mit Zugang ohne Abo. Bitte
   im Rollback testen.

## Vorschlag (noch nicht bauen, erst nach deinem Befund)

- **Abgeschlossen wird nur auf dem Server:**
  - Der Stripe-Webhook ruft Finalize.
  - Finalize ist idempotent je Kassen-Sitzung, denn Stripe schickt Ereignisse mehrfach.
  - Es legt nur an, was zum Onboarding gehört, und hält die Grenzen des Plans ein.
  - Keine Seite und kein Browser-Aufruf setzt den Abschluss.
- **Rückfall, falls der Webhook ausbleibt oder hinterherhängt:**
  - Eine Edge Function `onboarding-checkout-status` mit `{session_id}` fragt Stripe selbst nach
    der Sitzung.
  - Ist sie bezahlt (bzw. die Testphase angelegt) und gehört sie zum Onboarding des Nutzers,
    ruft sie dasselbe idempotente Finalize.
  - Antwort `{status, status_phase, team_id}`.
- **Keine eigene Erfolgsseite.** Stripe führt zurück auf die Onboarding-Seite mit
  `?checkout=success&session_id={CHECKOUT_SESSION_ID}`. Die Komponente kennt die Phasen 95
  („Creating Workspace“) und 100 schon:
  - Sie zeigt ein Ladebild und hört auf den Broadcast `onboarding:<id>`.
  - Bleibt der aus, fragt sie einmal `onboarding-checkout-status`.
  - Bei 100 geht es ins Dashboard des neuen Teams.
  - `?checkout=cancelled` führt zurück auf den Plan-Schritt, die Auswahl bleibt.
- Ob `get_onboarding_completion_status_v1` danach noch gebraucht wird, gehört in die Aufräumliste
  aus Abschnitt 2 des Auftrags.

**Falls der Befund einen schnellen Hotfix nahelegt** (z. B. fehlende Metadaten in der Kasse oder
ein Webhook-Ereignis, das nicht abonniert ist): bitte als eigenen, kleinen Schritt mit Rückweg
vorschlagen. Lukas entscheidet, ob er vor dem Umbau eingespielt wird. Bezahlte Onboardings, die
heute hängen, bitte auflisten. Sie nachträglich abzuschließen, ist ein eigener Schritt.
