# Signup sperren: Registrierungscode oder Einladung

Stand 21.09.2026. Gehoert zu `auth-page.js` / `bubble/auth_page_bubble.html`.

Ziel: **Ein neues Konto entsteht nur noch auf zwei Wegen** — ueber eine Einladung (gibt es schon)
oder ueber einen Registrierungscode, den du vergibst.

---

## 0. Wo die Sperre hingehoert — und wo sie NICHTS nuetzt

Die Datenbank ist **Supabase** (Postgres), Auth ist **Supabase Auth / GoTrue**. Bubble ist die
Huelle: es haelt Token und Publishable Key und ruft RPCs auf. `core.js` sagt es selbst:

> „Das Token IST fuer den Browser gedacht — Supabase ist so gebaut, und die Grenze ist die RLS,
> nicht die Geheimhaltung." (`core.js`, Abschnitt Bild-Upload)
>
> „Der anon key … **ist oeffentlich** (er steckt in jedem Supabase-Client)."

Daraus folgt der ganze Rest dieser Datei:

**Der Publishable Key steht in jedem Browser. Jeder kann damit direkt**

```
POST https://tgdossbsevnonssyuewp.supabase.co/auth/v1/signup
apikey: <der oeffentliche key>
{ "email": "...", "password": "..." }
```

**schicken und hat ein Konto** — ohne deine Seite, ohne Bubble, ohne Codefeld. Eine Sperre in der
Oberflaeche oder in einem Bubble-Workflow ist deshalb kein Riegel, sondern ein Schild. Der Riegel
muss in **GoTrue oder Postgres** sitzen. Alles andere ist Bequemlichkeit.

| Lage | Wo | Faengt ab |
|---|---|---|
| 1 | Seite (`data-code-required="yes"`) | leeres Feld — Bequemlichkeit |
| 2 | RPC `signup_code_pruefen` | falscher/abgelaufener/verbrauchter Code, mit lesbarer Meldung |
| 3 | **GoTrue: Signups aus** *oder* **Trigger auf `auth.users`** | **alles andere** — direkter API-Aufruf, Google-OAuth, jedes Plugin |

Nur Lage 3 ist die Sperre.

---

## 1. Tabellen

```sql
create table public.signup_codes (
  code        text primary key,                 -- GROSS, ohne Leerzeichen
  active      boolean     not null default true,
  max_uses    integer     not null default 1,   -- 0 = unbegrenzt
  used_count  integer     not null default 0,
  expires_at  timestamptz,                      -- null = laeuft nicht ab
  note        text,                             -- an wen ging er
  created_at  timestamptz not null default now()
);

create table public.signup_code_reservierungen (
  id          uuid primary key default gen_random_uuid(),
  code        text        not null references public.signup_codes(code),
  email       text        not null,
  reserved_at timestamptz not null default now(),
  used_at     timestamptz,
  user_id     uuid
);
create index on public.signup_code_reservierungen (lower(email));

-- RLS AN, und KEINE EINZIGE POLICY.
-- Bei aktivem RLS ohne Policy ist alles verboten -- ausser fuer service_role und fuer
-- SECURITY DEFINER-Funktionen. Genau das ist hier gewollt: kein Client darf Codes
-- lesen, zaehlen oder durchprobieren, auch kein eingeloggter.
alter table public.signup_codes                enable row level security;
alter table public.signup_code_reservierungen  enable row level security;
revoke all on public.signup_codes               from anon, authenticated;
revoke all on public.signup_code_reservierungen from anon, authenticated;
```

### Codes erzeugen

Lang und zufaellig, nicht sprechend. `BETA2026` ist geraten, bevor du davon erfaehrst.
12 Zeichen aus einem Alphabet ohne `0/O` und `1/I/L` sind rund **59 Bit** — dagegen hilft kein
Ratelimit, weil es kein Raten mehr gibt.

```sql
insert into public.signup_codes (code, max_uses, note)
values (upper('KQ7F-MN2P-XR9D'), 1, 'Alex, Erstkontakt Messe');
```

Generator fuer die Browserkonsole:

```js
(function(n){ var A="ABCDEFGHJKMNPQRSTUVWXYZ23456789", o=[];
  for (var i=0;i<(n||10);i++){ var s=""; for (var j=0;j<12;j++){
    s += A[Math.floor(Math.random()*A.length)]; if (j%4===3 && j<11) s += "-"; } o.push(s); }
  return o.join("\n"); })(10)
```

Bindestriche mit abspeichern: die Seite entfernt **Leerzeichen**, keine Bindestriche.

---

## 2. Lage 2 — der RPC fuer die Meldung an den Nutzer

`SECURITY DEFINER`, damit er trotz RLS lesen darf. Er aendert **nichts** und reserviert nur.

```sql
create or replace function public.signup_code_pruefen(p_code text, p_email text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.signup_codes;
  v_code  text := upper(regexp_replace(coalesce(p_code, ''), '\s', '', 'g'));
  v_mail  text := lower(btrim(coalesce(p_email, '')));
begin
  select * into c from public.signup_codes where code = v_code and active;

  -- EINE Meldung fuer alle Fehlfaelle. "Abgelaufen" verriete, dass es den Code gibt,
  -- und macht Durchprobieren billiger.
  if not found
     or (c.expires_at is not null and c.expires_at <= now())
     or (c.max_uses > 0 and c.used_count >= c.max_uses) then
    return json_build_object('ok', false,
      'reason', 'This code is not valid. Please check it or ask us for a new one.');
  end if;

  -- Reservierung: sie ist es, die der Trigger in Lage 3 spaeter sieht. 30 Minuten
  -- Gueltigkeit -- lang genug fuer einen Signup, kurz genug, dass ein abgebrochener
  -- Versuch keine Hintertuer offen laesst.
  delete from public.signup_code_reservierungen
   where lower(email) = v_mail and used_at is null and reserved_at < now() - interval '30 minutes';
  insert into public.signup_code_reservierungen (code, email) values (c.code, v_mail);

  return json_build_object('ok', true, 'reason', '');
end $$;

revoke all on function public.signup_code_pruefen(text, text) from public;
grant execute on function public.signup_code_pruefen(text, text) to anon;
```

Aufruf aus Bubble (API Connector, **Action**):

```
POST https://tgdossbsevnonssyuewp.supabase.co/rest/v1/rpc/signup_code_pruefen
apikey:        <publishable key>
Authorization: Bearer <publishable key>
Content-Type:  application/json

{ "p_code": "<code>", "p_email": "<email>" }
```

Antwort: `{"ok":true,"reason":""}` bzw. `ok:false` mit Text.

---

## 3. Lage 3 — der Riegel. Zwei Wege, einer reicht

### Weg A (empfohlen): Signups global aus

**Dashboard → Authentication → Sign In / Providers → Email → „Allow new users to sign up" AUS.**

Ab da kann **niemand** mehr ein Konto anlegen — nicht ueber die Seite, nicht ueber den direkten
API-Aufruf, und **auch nicht ueber Google**: GoTrue legt bei abgeschalteten Signups keine neue
Identitaet an, bestehende Nutzer melden sich weiter an. Damit ist der Fall „im Login-Modus auf
Google geklickt, ohne Konto" ohne jede weitere Zeile erledigt.

Das ist **fail-closed**: geht irgendetwas an deinem Code-Weg kaputt, bleibt die App zu statt
offen. Genau richtig herum fuer eine Sperre.

Der Weg zurueck hinein ist dann **eine Edge Function mit dem Service-Role-Key** —
`signup-with-code`. Der Service-Role-Key darf **niemals** in den Browser, deshalb eine Function
und kein RPC:

```ts
// supabase/functions/signup-with-code/index.ts
import { createClient } from "jsr:@supabase/supabase-js@2";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!   // steht NUR hier, nie im Client
);

Deno.serve(async (req) => {
  const { code, email, password, full_name } = await req.json();

  // 1. Pruefen -- dieselbe Funktion wie oben, damit es EINE Wahrheit gibt
  const { data: pruef } = await admin.rpc("signup_code_pruefen",
    { p_code: code, p_email: email });
  if (!pruef?.ok) {
    return Response.json({ ok: false, reason: pruef?.reason ?? "invalid" }, { status: 200 });
  }

  // 2. Konto anlegen -- mit dem Service Role Key geht das trotz abgeschalteter Signups
  const { data: user, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: false,
    user_metadata: { full_name },
  });
  if (error) return Response.json({ ok: false, reason: "signup_failed" }, { status: 200 });

  // 3. Einloesen
  await admin.rpc("signup_code_einloesen",
    { p_code: code, p_email: email, p_user: user.user.id });

  return Response.json({ ok: true });
});
```

Der Bubble-Signup-Workflow ruft dann **diese Function** statt der „Sign up"-Aktion des Plugins,
und meldet den Nutzer danach ganz normal an (`signInWithPassword`) — das Passwort hat er ja
gerade vergeben.

> **Vorsicht, das trifft auch deinen Einladungsweg.** Laeuft der heute ueber den normalen
> Client-Signup, hoert er mit dem Abschalten auf zu funktionieren. Er muss dann entweder ueber
> dieselbe Function laufen (Token statt Code pruefen) oder ueber
> `auth.admin.inviteUserByEmail` — Supabase legt das Konto dann selbst an und verschickt die
> Mail. Das **vor** dem Umlegen des Schalters klaeren, sonst stehen deine offenen Einladungen
> im Regen.

### Weg B: Signups an, aber ein Trigger auf `auth.users`

Ohne Edge Function, ohne Aenderung am Bubble-Workflow — dafuer fasst du `auth.users` an.
Der Trigger laeuft **vor** dem Einfuegen; wirft er, wird die ganze Transaktion verworfen und es
entsteht **kein** Konto. Kein „nachtraeglich loeschen", kein Zeitfenster.

```sql
create or replace function auth.signup_gate()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_mail text := lower(btrim(new.email));
  v_ok   boolean := false;
begin
  -- a) frische Reservierung aus signup_code_pruefen
  select exists (
    select 1 from public.signup_code_reservierungen
     where lower(email) = v_mail and used_at is null
       and reserved_at > now() - interval '30 minutes'
  ) into v_ok;

  -- b) oder eine offene Einladung auf dieselbe Adresse
  --    TABELLENNAME ANPASSEN -- siehe die Abfrage in Kapitel 6.
  if not v_ok then
    select exists (
      select 1 from public.team_invites
       where lower(invited_email) = v_mail
         and status = 'pending'
         and (expires_at is null or expires_at > now())
    ) into v_ok;
  end if;

  if not v_ok then
    raise exception 'signup_not_allowed'
      using errcode = '42501', hint = 'A registration code or invitation is required.';
  end if;
  return new;
end $$;

create trigger signup_gate
  before insert on auth.users
  for each row execute function auth.signup_gate();
```

Das deckt Google mit ab: bei OAuth steht kein Code im Spiel, also kommt nur durch, wer eine
offene Einladung auf dieselbe Adresse hat.

**Der Preis:** GoTrue reicht die Ausnahme als generisches `Database error saving new user`
durch — die Meldung aus dem `hint` sieht der Nutzer nicht. Deshalb bleibt Lage 2 auch bei Weg B
noetig: sie sagt ihm vorher, was los ist. Der Trigger ist nur das Netz darunter.

---

## 4. Einloesen

```sql
create or replace function public.signup_code_einloesen(p_code text, p_email text, p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_code text := upper(regexp_replace(coalesce(p_code,''), '\s', '', 'g'));
        v_mail text := lower(btrim(coalesce(p_email,'')));
begin
  update public.signup_code_reservierungen
     set used_at = now(), user_id = p_user
   where code = v_code and lower(email) = v_mail and used_at is null;

  update public.signup_codes
     set used_count = used_count + 1
   where code = v_code;
end $$;

revoke all on function public.signup_code_einloesen(text, text, uuid) from public;
-- NICHT an anon geben. Bei Weg A ruft die Edge Function sie mit dem Service Role Key;
-- bei Weg B haeng sie an einen AFTER INSERT-Trigger auf auth.users.
```

Bei **Weg B** direkt hinterher, damit die Reservierung nicht zweimal zieht:

```sql
create or replace function auth.signup_gate_after()
returns trigger language plpgsql security definer set search_path = public, auth as $$
declare v_code text;
begin
  select code into v_code from public.signup_code_reservierungen
   where lower(email) = lower(new.email) and used_at is null
   order by reserved_at desc limit 1;
  if v_code is not null then
    perform public.signup_code_einloesen(v_code, new.email, new.id);
  end if;
  return new;
end $$;

create trigger signup_gate_after
  after insert on auth.users
  for each row execute function auth.signup_gate_after();
```

---

## 5. Die Seite

Am `uau-root` auf der Anmeldeseite:

```
data-code-required="yes"
```

Der Workflow an `bubble_fn_uauSubmit`, Zweig `mode = "signup"` und `token` leer:

1. **API Connector → `signup_code_pruefen`** mit `code` und `email` aus dem Payload
   (`:extract with Regex "code":"([^"]*)"` bzw. `"email"`)
2. *Only when* `ok is "yes"` → Signup (Weg A: die Edge Function; Weg B: wie bisher)
3. *Only when* `ok is "no"` → Run JavaScript:

```javascript
(function () {
  var TXT = `Result of step 1's reason`;
  try { if (window.setAuthPageError) window.setAuthPageError("DEINE_INSTANCE", "code", TXT); } catch (e) {}
})();
```

> Ohne Schritt 3 dreht sich der Knopf 20 Sekunden und faellt dann mit einer allgemeinen Meldung
> zurueck — der Ladezustand endet **nur** durch `setAuthPageError` oder `setAuthPageDone`.

Optional: Links der Form `…/signup?code=KQ7F-MN2P-XR9D` fuellen das Feld vor.

---

## 6. Vorher nachsehen, nicht raten

Diese Abfrage im SQL-Editor sagt dir, wie deine Einladungen wirklich heissen und ob Signups
gerade offen sind:

```sql
-- a) Wo liegen die Einladungen?
select table_schema, table_name
  from information_schema.tables
 where table_name ilike '%invit%' or table_name ilike '%einladung%';

-- b) Welche Spalten hat die Tabelle?
select column_name, data_type
  from information_schema.columns
 where table_name = 'team_invites'   -- den Namen aus (a) einsetzen
 order by ordinal_position;

-- c) Wie viele Konten gibt es, und wie sind sie entstanden?
select p.provider, count(*) from auth.identities p group by 1;
```

Und der Test, ob Signups wirklich zu sind — von irgendwo, ohne Login:

```bash
curl -s -o /dev/null -w "%{http_code}\n" \
  -X POST "https://tgdossbsevnonssyuewp.supabase.co/auth/v1/signup" \
  -H "apikey: DEIN_PUBLISHABLE_KEY" -H "Content-Type: application/json" \
  -d '{"email":"probe-'$RANDOM'@example.com","password":"Test12345!"}'
```

**200/201 = die Anmeldung ist offen.** Erwartet ist `422` („Signups not allowed for this
instance", Weg A) bzw. `500` (Trigger, Weg B). Das ist der einzige Test, der die Sperre wirklich
prueft — alles auf der Seite testet nur das Schild.

---

## 7. Abnahme

| # | Fall | Erwartung |
|---|---|---|
| 1 | Signup, Feld leer | roter Hinweis am Feld, kein Aufruf geht raus |
| 2 | Signup, Code falsch | `reason` am Feld, kein Eintrag in `auth.users` |
| 3 | Signup, Code gueltig | Konto da, `used_count` +1, Reservierung `used_at` gesetzt |
| 4 | Code abgelaufen / verbraucht / `active = false` | wie 2 |
| 5 | Einladungslink `?token=` | kein Codefeld, Signup geht durch |
| 6 | „Continue with Google" im **Signup** ohne Code | roter Hinweis, OAuth startet nicht |
| 7 | „Continue with Google" im **Login**, unbekannte Adresse | **abgewiesen** — kein Konto |
| 8 | `curl` aus Kapitel 6 | 422 bzw. 500, **niemals** 200 |

Faelle 7 und 8 sind die einzigen, die die Sperre selbst pruefen. Wer nur 1 bis 6 testet, hat das
Schild getestet.
