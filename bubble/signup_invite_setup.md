# Signup nur mit Einladung

Stand 25.09.2026. Ersetzt `signup_code_setup.md` (Registrierungscode — gestrichen).
Gehoert zu `auth-page.js` / `bubble/auth_page_bubble.html`.

**Die Regel:** Ein Konto entsteht nur, wenn jemand zu einem Team eingeladen wurde. Kein Code,
kein offener Signup. Google ist nur noch ein Weg zum **Anmelden**, nicht zum Anlegen.

---

## 0. Warum das in Supabase passieren muss und nicht auf der Seite

Der Publishable Key steht in jedem Browser. Damit kann jeder, ohne deine Seite und ohne Bubble,

```
POST https://tgdossbsevnonssyuewp.supabase.co/auth/v1/signup
apikey: <der oeffentliche Key>
{ "email": "...", "password": "..." }
```

schicken — und hat ein Konto. Was die Seite tut (kein Signup ohne Token, kein Google im Signup),
ist ein Schild. **Der Riegel ist Schritt 5: neue Konten in Supabase abschalten.** Danach kommt
nur noch hinein, wen die Edge Function aus Schritt 3 hineinlaesst — und die laesst nur
Eingeladene hinein.

Reihenfolge ist wichtig: **erst 1 bis 4 bauen, dann 5 umlegen.** Umgekehrt stehen alle offenen
Einladungen im Regen, weil ihr Signup heute noch ueber den normalen Client-Weg laeuft.

---

## 1. Nachsehen, wie deine Einladungen heissen

Im SQL-Editor. Nicht raten — die Namen unten sind Platzhalter.

```sql
-- a) Wo liegen die Einladungen?
select table_schema, table_name
  from information_schema.tables
 where table_name ilike '%invit%';

-- b) Welche Spalten hat sie? (Namen aus a einsetzen)
select column_name, data_type
  from information_schema.columns
 where table_name = 'team_invites'
 order by ordinal_position;

-- c) Gibt es schon eine Funktion, die eine Einladung ANNIMMT?
select routine_name
  from information_schema.routines
 where routine_schema = 'public' and routine_name ilike '%invit%';
```

Wichtig ist c): **Wenn es schon einen RPC gibt, der eine Einladung annimmt** (Mitgliedschaft
anlegen, Status auf accepted), dann benutzt Schritt 2b **den** — nicht nachbauen. Zwei Wege, eine
Einladung anzunehmen, laufen frueher oder spaeter auseinander.

---

## 2. Zwei Funktionen in Postgres

### 2a. Pruefen — gilt dieses Token fuer diese Adresse?

Tabellen- und Spaltennamen nach Schritt 1 anpassen.

```sql
create or replace function public.invite_pruefen(p_token text, p_email text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mail text := lower(btrim(coalesce(p_email, '')));
  v_ok   boolean;
begin
  select exists (
    select 1 from public.team_invites
     where token = btrim(coalesce(p_token, ''))
       and lower(invited_email) = v_mail
       and status = 'pending'
       and (expires_at is null or expires_at > now())
  ) into v_ok;

  -- EINE Meldung fuer alle Fehlfaelle. "Abgelaufen" oder "falsche Adresse" verriete, dass es
  -- das Token gibt.
  if not v_ok then
    return json_build_object('ok', false,
      'reason', 'This invitation is not valid anymore. Please ask your team for a new one.');
  end if;
  return json_build_object('ok', true, 'reason', '');
end $$;

revoke all on function public.invite_pruefen(text, text) from public, anon, authenticated;
-- Nur die Edge Function ruft sie, mit dem Service-Role-Key. Kein Client braucht sie.
```

### 2b. Einloesen — Mitglied werden, Einladung schliessen

**Nur schreiben, wenn Schritt 1c nichts gefunden hat.** Sonst den vorhandenen RPC nehmen.

```sql
create or replace function public.invite_einloesen(p_token text, p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare inv public.team_invites;
begin
  select * into inv from public.team_invites
   where token = btrim(coalesce(p_token, '')) and status = 'pending'
   for update;
  if not found then return; end if;

  insert into public.team_members (team_id, user_id, role)   -- Namen anpassen
  values (inv.team_id, p_user, inv.invited_role)
  on conflict do nothing;

  update public.team_invites
     set status = 'accepted', accepted_at = now()               -- Spalten anpassen
   where token = inv.token;
end $$;

revoke all on function public.invite_einloesen(text, uuid) from public, anon, authenticated;
```

---

## 3. Die Edge Function — die einzige Tuer

Der Service-Role-Key darf **nie** in den Browser. Deshalb eine Function und kein RPC: nur sie
kann trotz abgeschalteter Signups ein Konto anlegen.

```ts
// supabase/functions/signup-with-invite/index.ts
import { createClient } from "jsr:@supabase/supabase-js@2";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!    // steht NUR hier
);

Deno.serve(async (req) => {
  const { token, email, password, full_name } = await req.json();

  // Ohne Token kein Konto. Punkt.
  if (!token) return Response.json({ ok: false, reason: "An invitation is required." });

  const { data: pruef } = await admin.rpc("invite_pruefen", { p_token: token, p_email: email });
  if (!pruef?.ok) return Response.json({ ok: false, reason: pruef?.reason ?? "" });

  const { data: user, error } = await admin.auth.admin.createUser({
    email, password,
    // BESTAETIGT, weil die Einladung per Mail an genau diese Adresse ging: wer den Link hat,
    // hat das Postfach. Ohne das verknuepft Supabase eine spaetere Google-Anmeldung mit
    // derselben Adresse NICHT mit diesem Konto -- und der Nutzer scheitert an seiner eigenen
    // Anmeldung. Geht der Link auch anders raus als per Mail, hier auf false lassen.
    email_confirm: true,
    user_metadata: { full_name },
  });
  if (error) return Response.json({ ok: false, reason: "We could not create your account. Please try again." });

  await admin.rpc("invite_einloesen", { p_token: token, p_user: user.user.id });
  return Response.json({ ok: true, reason: "" });
});
```

Deployen: `supabase functions deploy signup-with-invite`. Den Service-Role-Key setzt Supabase
fuer Functions selbst, du musst ihn nirgends eintragen.

---

## 4. Bubble

### 4a. Der Signup-Workflow

Am Workflow auf `bubble_fn_uauSubmit`, Zweig **`mode = "signup"`**:

1. **Statt** der „Sign up"-Aktion des Supabase-Plugins: API Connector →
   `POST https://tgdossbsevnonssyuewp.supabase.co/functions/v1/signup-with-invite`
   mit `token`, `email`, `password`, `full_name` (Passwort und Name kommen aus
   `bubble_fn_uauPassword` / `bubble_fn_uauName`, wie bisher).
2. *Only when* `ok is "yes"` → die normale **Anmeldung** des Plugins (signInWithPassword) mit
   derselben Adresse und demselben Passwort — das Konto gibt es jetzt, er hat das Passwort
   gerade vergeben. Danach `setAuthPageDone`, wie bisher.
3. *Only when* `ok is "no"` → Run JavaScript:

```javascript
(function () {
  var TXT = `Result of step 1's reason`;
  try { if (window.setAuthPageError) window.setAuthPageError("DEINE_INSTANCE", "form", TXT); } catch (e) {}
})();
```

Ohne Schritt 3 dreht der Knopf 20 Sekunden und faellt dann mit einer allgemeinen Meldung zurueck.

### 4b. Am Element

`data-code-required="yes"` **entfernen** — der Code ist gestrichen. (Die Seite fragt ohnehin
nicht mehr danach: ohne Einladung gibt es keinen Signup, und mit Einladung wurde der Code nie
verlangt.)

### 4c. Der Einladungslink

In der Einladungsmail auf **`/signup?token=<token>&email=<adresse>`** zeigen. Die Seite liest
beides: Signup-Modus, Adresse fest, kein Google, kein Codefeld. Wer schon ein Konto hat, klickt
unten „Sign in" — das Token faehrt mit, und der Login-Workflow nimmt die Einladung an (wie
heute).

---

## 5. ERST JETZT: neue Konten abschalten

**Supabase Dashboard → Authentication → Sign In / Providers → Email → „Allow new users to sign
up" AUS.**

Ab da:

| | |
|---|---|
| Login mit Passwort, bestehendes Konto | geht |
| **Login mit Google, bestehendes Konto** | **geht** |
| **Google, unbekannte Adresse** | **abgewiesen** — Supabase legt kein Konto an |
| `POST /auth/v1/signup` mit dem oeffentlichen Key | 422 |
| Einladungslink → Signup | geht — ueber die Edge Function |

„Google nur noch zum Anmelden" ist damit **keine eigene Einstellung**, sondern die Folge dieses
Schalters. Das ist der richtige Weg herum: fail-closed. Geht an der Einladung etwas kaputt,
bleibt die App zu statt offen.

---

## 6. Abnahme

| # | Fall | Erwartung |
|---|---|---|
| 1 | `/signup` ohne Token | Login-Formular, unten „No account yet? Ask your team for an invite." |
| 2 | `/login` | Login mit Google, kein „Sign up"-Link |
| 3 | Einladungslink | Signup, Adresse fest, **kein** Google-Knopf |
| 4 | Einladungslink → Konto anlegen | Konto da, Team-Mitglied, Einladung `accepted` |
| 5 | Denselben Einladungslink noch einmal | Meldung „This invitation is not valid anymore" |
| 6 | Einladungslink, Adresse im Feld von Hand geaendert | geht nicht (Feld ist fest) — und serverseitig abgewiesen |
| 7 | **Google-Login mit einer Adresse ohne Konto** | **abgewiesen, kein Konto** |
| 8 | **`curl` unten** | **422, niemals 200** |
| 9 | Per Einladung angelegt, danach „Continue with Google" mit derselben Adresse | meldet sich am bestehenden Konto an |

```bash
curl -s -o /dev/null -w "%{http_code}\n" \
  -X POST "https://tgdossbsevnonssyuewp.supabase.co/auth/v1/signup" \
  -H "apikey: DEIN_PUBLISHABLE_KEY" -H "Content-Type: application/json" \
  -d '{"email":"probe-'$RANDOM'@example.com","password":"Test12345!"}'
```

**7 und 8 sind die einzigen Tests, die den Riegel pruefen.** 1 bis 6 pruefen das Schild.

---

## 7. Aufraeumen

Die Tabellen `signup_codes` / `signup_code_reservierungen` und die Funktionen
`signup_code_pruefen` / `signup_code_einloesen` aus der alten Anleitung werden nicht mehr
gebraucht. Wenn du sie angelegt hast: loeschen oder liegen lassen, sie tun ohne Aufrufer nichts.
Einen Trigger `signup_gate` auf `auth.users` (Weg B der alten Anleitung) **musst** du loeschen,
falls er existiert — er wuerde Einladungen ohne Code-Reservierung sonst ablehnen:

```sql
drop trigger if exists signup_gate on auth.users;
drop trigger if exists signup_gate_after on auth.users;
```
