# Access Gate: das Schloss in Supabase

Stand 28.09.2026. Gehoert zu `access-gate.js` / `bubble/access_gate_bubble.html`.

**Die Regel:** Ob ein Team die App benutzen darf, entscheidet **eine** Funktion in Postgres:
`team_access(team_id)`. Jede RPC, die Daten eines Teams liefert oder aendert, fragt sie als
Erstes. Die Quota-RPC, die ohnehin auf jeder Seite beim Seitenaufbau laeuft, liefert ihr Urteil
mit, und das Gate zeigt es an.

---

## 0. Warum das in Supabase passieren muss und nicht auf der Seite

Das Gate ist ein Fenster im Browser. Wer die Entwicklerwerkzeuge oeffnet, nimmt es weg, und
die Seite dahinter laedt weiter ihre Daten. Die Daten muss die Datenbank verweigern, nicht die
Oberflaeche.

Damit Fenster und Datenbank nie verschiedener Meinung sind, gibt es das Urteil **genau
einmal**: in `team_access`. Die Quota-RPC reicht es an das Gate weiter, die Daten-RPCs fragen
dieselbe Funktion, und auch die Abo-RPC des Billing-Reiters soll `has_active_access` daraus
nehmen (Schritt 6).

Reihenfolge: **erst 1 bis 3 bauen und pruefen, dann 4.** Schritt 4 sperrt wirklich. Wer ihn
zuerst baut und sich im Urteil vertut, sperrt zahlende Kunden aus.

---

## 1. Nachsehen, wie Teams und Abos bei dir heissen

Im SQL-Editor. Nicht raten: die Namen in Schritt 2 sind Platzhalter, eingesetzt nach den Feldern,
die deine Abo-RPC am 28.09. geliefert hat.

```sql
-- a) Wo liegen Teams und Abos?
select table_schema, table_name
  from information_schema.tables
 where table_schema = 'public'
   and (table_name ilike '%team%' or table_name ilike '%billing%' or table_name ilike '%subscr%');

-- b) Welche Spalten haben sie? (Namen aus a einsetzen)
select table_name, column_name, data_type
  from information_schema.columns
 where table_schema = 'public'
   and table_name in ('teams', 'team_billing')
 order by table_name, ordinal_position;

-- c) Wie rechnet deine Abo-RPC has_active_access und can_manage_billing?
--    Den Namen der RPC aus Bubble nehmen (API Connector), hier einsetzen:
select pg_get_functiondef('public.get_team_billing'::regproc);
```

**Wichtig ist c):** Deine Abo-RPC rechnet `has_active_access` schon. **Genau dieser Ausdruck**
gehoert in Schritt 2, nicht der Vorschlag unten. Zwei Rechnungen fuer "hat Zugang" laufen
frueher oder spaeter auseinander, und dann zeigt der Billing-Reiter "aktiv", waehrend das Gate
sperrt.

---

## 2. Die eine Funktion: `team_access`

Sie liefert drei Werte:

| Spalte | Bedeutung |
|---|---|
| `has_access` | darf das Team die App benutzen |
| `access_state` | **warum nicht**: `deleted` · `past_due` · `trial_ended` · `no_plan` · `ended`, bei Zugang `active` |
| `access_ended_at` | seit wann nicht mehr (beim geloeschten Team: das Loeschdatum) |

Das Gate waehlt seinen Text nach `access_state`. Die Datenbank weiss, ob eine Testphase
auslief oder eine Zahlung offen ist; die Oberflaeche muesste es aus Datumswerten raten.

**Loeschdatum in der Zukunft:** Ein Team, dessen Loeschung erst spaeter wirksam wird, hat bis zu
diesem Datum Zugang. Deshalb prueft die Funktion `deleted_at <= now()` und nicht nur
`is_deleted`.

```sql
create or replace function public.team_access(p_team_id uuid)
returns table (has_access boolean, access_state text, access_ended_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  with
  t as (                                          -- ANPASSEN: eure Team-Tabelle
    select tm.id, tm.deleted_at
      from public.teams tm
     where tm.id = p_team_id
  ),
  b as (                                          -- ANPASSEN: die Tabelle hinter eurer Abo-RPC
    select tb.*
      from public.team_billing tb
     where tb.team_id = p_team_id
     order by tb.created_at desc                  -- die juengste Zeile, falls es mehrere gibt
     limit 1
  ),
  z as (
    select
      t.id is not null                                          as team_da,
      t.deleted_at is not null and t.deleted_at <= now()        as geloescht,
      t.deleted_at,
      b.team_id is not null                                     as abo_da,
      b.status, b.trial_ends_at, b.access_ends_at, b.ended_at, b.canceled_at,
      -- ======================================================================================
      -- HIER DEN AUSDRUCK AUS DEINER ABO-RPC EINSETZEN (Schritt 1c). Der Vorschlag darunter
      -- ist die Stripe-Lesart: laufend, in der Testphase, oder gekuendigt, aber noch bis zum
      -- Ende der bezahlten Zeit.
      coalesce(
        b.status in ('active', 'trialing')
        or (b.access_ends_at is not null and b.access_ends_at > now()),
        false)                                                  as abo_ok
      -- ======================================================================================
    from (select 1) x
    left join t on true
    left join b on true
  )
  select
    -- das Urteil
    (z.team_da and not z.geloescht and z.abo_ok),
    -- der Grund
    case
      when not z.team_da or z.geloescht                   then 'deleted'
      when z.team_da and not z.geloescht and z.abo_ok     then 'active'
      when not z.abo_da                                   then 'no_plan'
      when z.status in ('past_due', 'unpaid')             then 'past_due'
      -- Die Testphase lief aus, ohne dass je bezahlt wurde: das Abo endete mit ihr (ein Tag
      -- Spielraum, Stripe schreibt die Kuendigung Sekunden bis Stunden danach). Ein Abo, das
      -- nach der Testphase bezahlt lief und spaeter endete, endete deutlich NACH ihr.
      when z.trial_ends_at is not null and z.trial_ends_at <= now()
       and coalesce(z.access_ends_at, z.ended_at, z.canceled_at, z.trial_ends_at)
             <= z.trial_ends_at + interval '1 day'                then 'trial_ended'
      else                                                     'ended'
    end,
    -- seit wann
    case
      when z.geloescht then z.deleted_at
      when z.abo_ok    then null
      else coalesce(z.access_ends_at, z.ended_at, z.canceled_at, z.trial_ends_at)
    end
  from z;
$$;

-- Kurzform fuer die Wachen in Schritt 4.
create or replace function public.team_has_access(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select a.has_access from public.team_access(p_team_id) a), false);
$$;
```

Rechte wie bei deinen anderen RPCs (Bubble ruft mit demselben Schluessel):

```sql
grant execute on function public.team_access(uuid)     to authenticated, service_role;
grant execute on function public.team_has_access(uuid) to authenticated, service_role;
```

**Pruefen**, bevor irgendetwas gesperrt wird:

```sql
-- das Testkonto (geloescht am 30.07.): erwartet false | deleted | 2026-07-30 ...
select * from public.team_access('2735aac6-d2cb-4110-976c-f6ac4dec8d5a');

-- alle Teams auf einen Blick. Jede Zeile mit false ansehen: stimmt das?
select tm.id, tm.name, a.*
  from public.teams tm
  cross join lateral public.team_access(tm.id) a
 order by a.has_access, tm.name;
```

Die zweite Abfrage ist der eigentliche Test: jedes Team mit `false` muss eines sein, das du
wirklich sperren willst. Ein zahlender Kunde in dieser Liste heisst, der Ausdruck aus 1c ist
noch nicht der richtige.

---

## 3. Die Quota-RPC erweitern: das Urteil kommt mit

`get_team_plan_quota` laeuft schon beim Seitenaufbau. Sie bekommt **sieben Spalten** dazu (die
acht vorhandenen bleiben unveraendert):

| Spalte | Typ | Woher |
|---|---|---|
| `team_id` | uuid | der Parameter |
| `team_name` | text | Team-Tabelle |
| `has_access` | boolean | `team_access` |
| `access_state` | text | `team_access` |
| `access_ended_at` | timestamptz | `team_access` |
| `can_manage_billing` | boolean | derselbe Ausdruck wie `can_manage_billing` in deiner Abo-RPC (darf DIESER Nutzer buchen) |
| `billing_interval` | text | Takt des letzten Abos, `monthly` oder `yearly` |

Freiwillig: `monthly_price_eur`, `yearly_price_eur`. Dann traegt das Ereignis zur Kasse nach
"Reactivate" auch den Preis, wie ein Klick auf eine Tarifkarte.

Im Rumpf der RPC ist es ein Join mehr:

```sql
-- in der Spaltenliste von RETURNS TABLE(...) die sieben Spalten ergaenzen, dann im SELECT:
select
  -- ... die acht vorhandenen Spalten wie bisher ...
  p_team_id                         as team_id,
  tm.name                           as team_name,
  a.has_access,
  a.access_state,
  a.access_ended_at,
  <ausdruck aus der abo-rpc>        as can_manage_billing,
  tb.billing_interval
from public.teams tm                                  -- ANPASSEN
cross join lateral public.team_access(p_team_id) a
left join lateral (                                   -- ANPASSEN: letzte Abo-Zeile
  select b.billing_interval from public.team_billing b
   where b.team_id = p_team_id order by b.created_at desc limit 1
) tb on true
-- ... die vorhandenen Joins fuer Tarif und Zaehler, als LEFT JOIN ...
where tm.id = p_team_id;
```

**Zwei Dinge, an denen das Gate haengt:**

1. **Die RPC liefert IMMER genau eine Zeile**, auch fuer ein Team ohne Tarif: dann
   `plan_id` null, `has_access` false, `access_state` `no_plan`. Steht der Tarif heute mit
   `JOIN` statt `LEFT JOIN` im Rumpf, faellt die Zeile ohne Tarif weg. Keine Zeile heisst fuer das
   Gate "kein Urteil", und die App bleibt offen.
2. **Diese RPC bekommt keine Wache aus Schritt 4.** Das Gate braucht sie gerade dann, wenn es
   keinen Zugang gibt.

So sieht die Zeile fuer das Testkonto danach aus (Werte aus seiner Abo-Nutzlast vom 28.09.):

```json
[{ "plan_id": "a980c741-807e-43dd-9617-8e06b82999ba", "plan_name": "Enterprise",
   "prompts_per_day": 350, "active_prompts": 45, "remaining_by_active": 305,
   "competitors_max_active": 15, "competitors_active": 10, "competitors_remaining": 5,
   "team_id": "2735aac6-d2cb-4110-976c-f6ac4dec8d5a", "team_name": "upstreem",
   "has_access": false, "access_state": "deleted",
   "access_ended_at": "2026-07-30T10:18:31.669+00:00",
   "can_manage_billing": true, "billing_interval": "yearly" }]
```

---

## 4. Die Wache vor jeder Daten-RPC

**a) Alle RPCs finden, die ein Team als Parameter nehmen:**

```sql
select p.oid::regprocedure             as funktion,
       l.lanname                       as sprache,
       pg_get_function_result(p.oid)   as rueckgabe
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  join pg_language  l on l.oid = p.prolang
 where n.nspname = 'public'
   and pg_get_function_arguments(p.oid) ilike '%team%'
 order by 1;
```

**b) Welche davon KEINE Wache bekommen.** Alles, was das Gate, das Anmelden oder den Weg hinaus
braucht:

- `team_access`, `team_has_access`
- `get_team_plan_quota` (Schritt 3)
- die Abo-RPC des Billing-Reiters und die Tarif-RPC (Tarifliste im Gate)
- was die Kasse und das Portal anlegt (Checkout- und Portal-Sitzung)
- die Teamliste der Seitenleiste (`setSidebarTeams`), Nutzerprofil, Team anlegen, Teamwechsel
- Einladungen und Signup (`invite_pruefen`, `invite_einloesen`, ...)

**c) In jede andere eine Zeile als Erstes.** Nach Rueckgabetyp:

```sql
-- plpgsql, RETURNS json / jsonb -- die Form, die die Komponenten als "kaputt" lesen:
if not public.team_has_access(p_team_id) then
  return json_build_object('ok', false, 'error', 'no_access');
end if;

-- plpgsql, RETURNS TABLE(...) / SETOF ... -- keine Zeilen:
if not public.team_has_access(p_team_id) then
  return;
end if;

-- plpgsql, RETURNS void (Schreib-RPCs: Prompts anlegen, Marken aendern, ...):
if not public.team_has_access(p_team_id) then
  return;
end if;
```

```sql
-- language sql: die Bedingung in das WHERE der letzten Abfrage
... where <bisherige Bedingung>
      and public.team_has_access(p_team_id)
```

**Kein `raise exception`.** Bubble zeigt bei einem Fehler aus dem API Connector jedem Nutzer ein
Fehler-Popup, und das bei jedem Seitenaufbau. Eine leere Antwort tut das nicht: die Komponenten
hinter dem Gate zeigen ihren Lesefehler, und den sieht niemand, er liegt unter der Sperre.

Der Parameter heisst nicht ueberall `p_team_id`: den Namen aus der Liste in a) nehmen.

---

## 5. Die taeglichen Prompt-Laeufe

Der Lauf, der die Prompts eines Teams bei den Modellen abfragt (Cron, Edge Function), nimmt nur
noch Teams mit Zugang:

```sql
... where public.team_has_access(t.id)
```

Sonst kostet ein ausgelaufenes oder geloeschtes Team jeden Tag weiter Modellaufrufe.

---

## 6. Die Abo-RPC des Billing-Reiters auf dasselbe Urteil stellen

In der Abo-RPC `has_active_access` aus derselben Funktion nehmen:

```sql
(select a.has_access from public.team_access(p_team_id) a)   as has_active_access
```

Dann koennen Billing-Reiter ("No active billing plan") und Gate nicht verschiedener Meinung
sein.

---

## 7. Geloeschte Teams beim Anmelden

Ist das gespeicherte Team eines Nutzers geloescht, gehoert er gar nicht erst auf die App-Seite,
sondern ins Onboarding oder in ein anderes Team. Das ist ein Schritt im Login-Workflow in Bubble
(nach dem Anmelden `team_access` bzw. die Quota-RPC fragen und bei `access_state = deleted`
umleiten). Das Gate faengt nur ab, was trotzdem durchkommt.

---

## 8. Nach der Kasse

Kommt der Nutzer aus der Stripe-Kasse zurueck, kann der Webhook ein paar Sekunden hinter der
Seite liegen. Dann sagt `team_access` noch `false`, und das Gate steht wieder da. Auf der
Rueckkehr-Seite die Quota-RPC nach einer kurzen Pause noch einmal rufen und Schritt 1 der
Vorlage wiederholen. Das Gate geht von selbst weg, sobald `has_access` true ist.
