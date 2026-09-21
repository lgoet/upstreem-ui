# Signup sperren: Registrierungscode oder Einladungslink

Stand 21.09.2026. Gehoert zu `auth-page.js` / `bubble/auth_page_bubble.html`.

Ziel: **Ein neues Konto entsteht nur noch auf zwei Wegen** -- ueber einen Einladungslink
(`?token=`, gibt es schon) oder ueber einen Registrierungscode, den du vergibst. Alles andere
wird abgewiesen.

---

## 0. Die wichtigste Zeile zuerst

**Das Feld auf der Anmeldeseite ist keine Sperre.** `auth-page.js` laeuft im Browser des
Nutzers -- wer die Datei liest, kann sie umgehen. Das Feld sorgt dafuer, dass der Nutzer nicht
erst auf eine Serverrunde warten muss, um zu erfahren, dass er nichts eingetippt hat.

Gesperrt wird in **drei** Lagen, und die dritte ist die, auf die es ankommt:

| Lage | Wo | Faengt ab |
|---|---|---|
| 1 | Seite (`data-code-required="yes"`) | Leeres Feld -- reine Bequemlichkeit |
| 2 | Signup-Workflow mit serverseitiger Pruefung | Falscher, abgelaufener, verbrauchter Code |
| 3 | **Datenbank-Ausloeser "User is created"** | **Jeden anderen Weg** -- Google im Login-Modus, Plugins, direkte Workflow-Aufrufe |

Ohne Lage 3 ist die Sperre ein Vorhang. Lage 3 allein waere hart, aber sicher.

---

## 1. Datentyp `signup_code`

| Feld | Typ | Bedeutung |
|---|---|---|
| `code` | text | GROSS, ohne Leerzeichen. Die Seite schickt ihn so, vergleiche mit `:uppercase` |
| `active` | yes/no | Der Aus-Schalter fuer einen einzelnen Code |
| `max_uses` | number | 0 = unbegrenzt |
| `used_count` | number | zaehlt hoch, Vorgabe 0 |
| `expires_at` | date | leer = laeuft nicht ab |
| `note` | text | fuer dich: an wen ging der Code |

### Privacy Rules -- NICHT ueberspringen

Auf `signup_code`, Regel **"Everyone else"** (also auch ausgeloggte Besucher):

- `Find this in searches` **aus**
- **alle** Feld-Haken **aus**

Damit kann kein Client die Codes durchsuchen oder auslesen. Genau deshalb muss die Pruefung in
einem Backend-Workflow mit *Ignore privacy rules* stehen -- die Seite kann sie gar nicht
durchfuehren, und das ist der Punkt.

### Felder am Typ `User`

| Feld | Typ | Bedeutung |
|---|---|---|
| `signup_authorized` | yes/no | **Die Eintrittskarte.** Vorgabe `no` |
| `signup_code_used` | signup_code | womit er hereinkam (leer bei Einladung) |

---

## 2. Codes erzeugen

Lang und zufaellig, nicht sprechend. Ein Code wie `BETA2026` ist in einer Minute geraten, und
gegen Raten hilft hier nichts anderes als Laenge: Bubble drosselt API-Workflows nicht von selbst.

Empfehlung: **12 Zeichen** aus einem Alphabet ohne `0/O` und `1/I/L`, in Dreiergruppen. Dieser
Schnipsel erzeugt dir welche (Browserkonsole, egal wo):

```js
(function(n){ var A="ABCDEFGHJKMNPQRSTUVWXYZ23456789", o=[];
  for (var i=0;i<(n||10);i++){ var s=""; for (var j=0;j<12;j++){
    s += A[Math.floor(Math.random()*A.length)]; if (j%4===3 && j<11) s += "-"; } o.push(s); }
  return o.join("\n"); })(10)
```

Ergibt z.B. `KQ7F-MN2P-XR9D`. Bindestriche sind Kosmetik -- die Seite entfernt Leerzeichen, nicht
Bindestriche, also **speichere sie mit**.

---

## 3. Backend-Workflow `signup_pruefen` (die Pruefung)

**Backend workflows** → *New API workflow*, Name `signup_pruefen`.

Einstellungen:
- `Expose as a public API workflow` **an**
- `This workflow can be run without authentication` **an** (der Besucher ist noch niemand)
- `Ignore privacy rules when running the workflow` **an** ← ohne das findet die Suche nichts

Parameter: `code` (text), `email` (text)

Schritt 1 -- *Return data from API workflow*:

| Rueckgabe | Wert |
|---|---|
| `ok` | `yes`, wenn der Treffer unten existiert und gueltig ist, sonst `no` |
| `reason` | Text fuer den Nutzer |

Die Suche als Ausdruck:

```
Search for signup_codes
  code = code:uppercase
  active = yes
:first item
```

Gueltig ist der Treffer, wenn **alle** drei stimmen:

```
Treffer is not empty
(Treffer's expires_at is empty  OR  Treffer's expires_at > Current date/time)
(Treffer's max_uses = 0         OR  Treffer's used_count < Treffer's max_uses)
```

Ein Tipp zu `reason`: **eine** Meldung fuer alle drei Fehlfaelle. "Dieser Code ist abgelaufen"
verraet, dass es ihn gibt, und macht Raten billiger. Nimm durchgaengig:

> `This code is not valid. Please check it or ask us for a new one.`

---

## 4. API-Connector-Aufruf auf der Seite

*Plugins* → **API Connector** → neue API `upstreem-intern`, Call `signup_pruefen`:

- `Use as`: **Action**
- Methode `POST`
- URL: `https://DEINE-APP.bubbleapps.io/version-live/api/1.1/wf/signup_pruefen`
  (im Testmodus `version-test`; nimm am besten eine Bubble-Konstante fuer den Teil vor `/api`)
- Body (JSON), beide Werte als **dynamic**:

```json
{ "code": "<code>", "email": "<email>" }
```

- `Initialize call` mit einem echten Code, damit Bubble `ok` und `reason` als Felder kennt.

---

## 5. Page-Workflow `uauSubmit`

Am Event `bubble_fn_uauSubmit`. Der Signup-Zweig, in dieser Reihenfolge:

**Nur wenn** `mode = "signup"` **und** `token is empty` (mit Token laeuft dein bestehender
Einladungs-Zweig, der braucht keinen Code):

1. **`signup_pruefen`** (API-Connector-Action)
   `code` = `uauSubmit's value :extract with Regex "code":"([^"]*)" :first item`
   `email` = dasselbe mit `"email"`
2. **Sign the user up** -- *Only when* `Result of step 1's ok is "yes"`
   email/password wie bisher aus den States
3. **Schedule API workflow `code_einloesen`** -- *Only when* `Result of step 1's ok is "yes"`
   `user` = `Result of step 2's user`, `code` = derselbe Ausdruck wie in Schritt 1
4. **Run JavaScript** -- *Only when* `Result of step 1's ok is "no"`

```javascript
(function () {
  var TXT = `Result of step 1's reason`;
  try { if (window.setAuthPageError) window.setAuthPageError("DEINE_INSTANCE", "code", TXT); } catch (e) {}
})();
```

> Der Ladezustand der Seite endet **nur** durch `setAuthPageError` oder `setAuthPageDone`.
> Fehlt Schritt 4, dreht sich der Knopf 20 Sekunden und faellt dann mit einer allgemeinen
> Meldung zurueck -- der Nutzer erfaehrt nie, dass sein Code falsch war.

Und im Erfolgszweig wie bisher weiterleiten oder `setAuthPageDone` rufen.

---

## 6. Backend-Workflow `code_einloesen`

*New API workflow*, Name `code_einloesen`, `Ignore privacy rules` **an**, NICHT oeffentlich
(er wird nur geplant, nicht von aussen gerufen).

Parameter: `user` (User), `code` (text)

1. *Make changes to a thing* -- `user`:
   `signup_authorized = yes`
   `signup_code_used = Search for signup_codes (code = code:uppercase) :first item`
2. *Make changes to a thing* -- derselbe `signup_code`:
   `used_count = used_count + 1`

Zwischen Pruefung (Schritt 5.1) und Einloesung liegen Millisekunden. Theoretisch koennen zwei
Leute denselben Einmalcode in genau diesem Fenster einloesen -- die Folge ist ein Konto zu viel
auf einem Code, kein offener Signup. Fuer eine Beta ist das in Ordnung; wer es ausschliessen
will, laesst `signup_pruefen` selbst hochzaehlen und nimmt dafuer in Kauf, dass ein
abgebrochener Signup einen Code verbraucht.

---

## 7. Der Einladungsweg

Dein bestehender Token-Zweig aendert sich nur um **eine** Zeile: setze am neuen Nutzer
`signup_authorized = yes`, sobald der Token geprueft ist. Sonst raeumt Lage 3 die per Einladung
angelegten Konten wieder weg.

---

## 8. Lage 3: der Ausloeser, der alles andere abfaengt

*Backend workflows* → **New database trigger event**

- Type: `User`
- Trigger on: **Creation**
- Aktion: *Schedule API workflow* `signup_nachpruefen`, **Scheduled date: Current date/time + 60 seconds**, `user` = das neue Thing

Und `signup_nachpruefen` (`Ignore privacy rules` an):

- *Only when* `user's signup_authorized is not yes`
- Aktion: *Delete a thing* → `user`

**Warum 60 Sekunden und nicht sofort:** der Ausloeser feuert in derselben Sekunde, in der
"Sign the user up" das Konto anlegt -- `signup_authorized` steht da noch auf `no`, weil
`code_einloesen` erst danach laeuft. Sofort geloescht wuerde also auch jeder *richtige* Signup.
Die Minute ist der Abstand zwischen "wird gerade berechtigt" und "war nie berechtigt".

**Und damit die Minute nicht ausreicht:** eine Bedingung auf jeder eingeloggten Seite --

> *When Page is loaded* · *Only when* `Current User is logged in` **und**
> `Current User's signup_authorized is not yes` → **Log the user out** → *Go to page* `login`

Damit ist ein unberechtigtes Konto zwar 60 Sekunden lang vorhanden, sieht aber keine einzige
Seite. Setze zusaetzlich die Privacy Rules deiner Datentypen auf
`This User's signup_authorized is yes` -- dann sieht es auch keine Daten.

---

## 9. Das Element umstellen

Am `uau-root` auf der Anmeldeseite:

```
data-code-required="yes"
```

Das ist die **einzige** Aenderung am Markup. Fehlt sie, fragt die Seite nicht nach einem Code --
die Sperre in Bubble greift trotzdem, der Nutzer bekommt dann aber eine Absage, ohne je die
Gelegenheit gehabt zu haben, einen Code einzutippen.

Optional: verschicke Links der Form `https://deine-app.de/signup?code=KQ7F-MN2P-XR9D`. Die Seite
fuellt das Feld vor, und der Empfaenger muss nichts abtippen.

---

## 10. Abnahme -- diese sieben Faelle durchgehen

| # | Fall | Erwartung |
|---|---|---|
| 1 | Signup, Feld leer | roter Hinweis am Feld, **kein** Workflow laeuft |
| 2 | Signup, Code falsch | `reason` am Feld, kein Konto in der Datenbank |
| 3 | Signup, Code gueltig | Konto da, `signup_authorized = yes`, `used_count` +1 |
| 4 | Signup, Code abgelaufen / verbraucht / `active = no` | wie 2 |
| 5 | Einladungslink `?token=` | **kein** Codefeld, Signup geht durch, `signup_authorized = yes` |
| 6 | "Continue with Google" im **Signup** ohne Code | roter Hinweis, OAuth startet gar nicht |
| 7 | "Continue with Google" im **Login** ohne Konto | Konto entsteht kurz und ist nach 60s weg; der Nutzer wird sofort ausgeloggt |

Fall 7 ist der, den nur Lage 3 abfaengt. Wenn du ihn nicht testest, hast du die Sperre nicht
getestet.
