# An Claude Code: Onboarding (13.10.2026)

**Gilt jetzt:** `ONBOARDING_V1_VERTRAG.md` mit echten Antworten in `onboarding_v1_echte_antworten.json`.

- Die Komponente lädt selbst über die v1-RPCs.
- Sie startet Läufe und Kasse über die Edge Functions `onboarding-start`, `onboarding-prompts`, `onboarding-checkout` und `onboarding-checkout-status`.
- Status kommt über den Broadcast `onboarding:<id>`.

Die frühere Zwischenfassung dieser Datei (heutige Bubble-Form, `onboarding_get_bundle`) ist überholt. Die alte Form steht nur noch zum Vergleich in `onboarding_get_bundle_echte_antworten.json`.
