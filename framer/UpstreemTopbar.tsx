/* upstreem -- die Leiste der STARTSEITE als eigene Framer-Code-Komponente, fuer alle anderen
   Seiten (Blog, Preise, Rechtliches). Neu gebaut am 13.10.

   WARUM NEU: die Fassung vom 01.10. war ein Nachbau mit eigenen Werten in React -- und sah anders
   aus als die Leiste der Startseite (13.10. abgelehnt). Jetzt ist es DIESELBE Leiste:
     - Markup und jeder Text: leiste() aus landing-hero.js, von .landing_ssr.js unten eingesetzt
       (LEISTE). Nichts davon wird hier von Hand gepflegt.
     - Form: landing-hero.css aus dem Pin, dieselbe Datei wie auf der Startseite.
     - Verhalten (das eine Panel, das dem Zeiger folgt): landing-teile.js aus dem Pin, dieselbe
       Funktion, die auf der Startseite laeuft. Sonst nichts -- die Startseite selbst (rund 540 KB
       landing-hero.js) laedt hier nicht.
   Die Leiste ist vorgerendert: Links und Texte stehen im HTML der Seite, auch fuer Crawler ohne
   JavaScript. Beim Rendern greift nichts auf window/document zu (alles in useEffect).

   EINBAU: Assets -> Code -> die vorhandene Datei "UpstreemTopbar" oeffnen, den GANZEN Inhalt durch
   diesen ersetzen, speichern -- die Instanzen auf allen Seiten ziehen mit. Rechts unter "Pin" den
   Commit eintragen. An der INSTANZ: Breite "Fill", Position "Sticky", Top 0, Z-Index 100 -- die
   Komponente klebt nicht selbst, Framer laesst die Instanz kleben (auf der Startseite klebt sie
   in der Seite selbst, dort steht diese Komponente NICHT, die Startseite bringt ihre Leiste mit).

   Schmale Fassungen wie auf der Startseite, nach der FENSTERBREITE (landing-hero.css):
     unter 900px   die Mitte (Platform, Resources, Pricing) faellt weg
     unter 560px   "Log in" faellt weg
   Ein eigenes Mobil-Menue hat die Startseite nicht, also auch diese Leiste nicht. */
import * as React from "react"
import { useEffect } from "react"
import { addPropertyControls, ControlType } from "framer"

/* ---- SSR ANFANG (erzeugt von .landing_ssr.js -- nicht von Hand aendern) ---- */
const LEISTE = "<div class=\"ulh-root ulh-teil\" data-ulh-teil=\"leiste\"><header class=\"ulh-nav\"><div class=\"ulh-spur ulh-nav-in\"><a class=\"ulh-nav-logo\" href=\"https://upstreem.ai/\" aria-label=\"upstreem\"><img src=\"https://tgdossbsevnonssyuewp.supabase.co/storage/v1/object/public/BRANDSTYLES/upstreem-lockup-1f1f1f.svg\" alt=\"upstreem\" width=\"141\" height=\"20\"/></a><nav class=\"ulh-nav-mitte\"><button class=\"ulh-nav-punkt\" type=\"button\" data-menue=\"platform\">Platform</button> <button class=\"ulh-nav-punkt\" type=\"button\" data-menue=\"resources\">Resources</button> <a class=\"ulh-nav-punkt\" href=\"https://upstreem.ai/pricing\" target=\"_blank\" rel=\"noopener\">Pricing</a></nav><div class=\"ulh-nav-rechts\"><a class=\"ulh-btn ulh-btn-sec\" target=\"_blank\" rel=\"noopener\" href=\"https://app.upstreem.ai/signup?mode=login\">Log in</a> <a class=\"ulh-btn ulh-btn-pri\" target=\"_blank\" rel=\"noopener\" href=\"https://app.upstreem.ai/signup\">Start for free</a> <button class=\"ulh-nav-menue\" type=\"button\" aria-expanded=\"false\" aria-label=\"Menu\"><svg class=\"ulh-nav-menue-auf\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" aria-hidden=\"true\"><line x1=\"4\" y1=\"8\" x2=\"20\" y2=\"8\"></line><line x1=\"4\" y1=\"16\" x2=\"20\" y2=\"16\"></line></svg><svg class=\"ulh-nav-menue-zu\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" aria-hidden=\"true\"><line x1=\"18\" y1=\"6\" x2=\"6\" y2=\"18\"></line><line x1=\"6\" y1=\"6\" x2=\"18\" y2=\"18\"></line></svg></button></div><div class=\"ulh-nav-pop\" aria-hidden=\"true\"><div class=\"ulh-nav-karte\" data-menue=\"platform\"><span class=\"ulh-nav-spalte\">Platform</span> <a class=\"ulh-nav-eintrag\" href=\"https://upstreem.ai/#overview\" data-ziel=\".ulh-feat\"><span class=\"ulh-nav-e-t\">Overview</span> <span class=\"ulh-nav-e-s\">What upstreem shows you</span></a> <a class=\"ulh-nav-eintrag\" href=\"https://upstreem.ai/#sources\" data-ziel=\".ulh-quell\"><span class=\"ulh-nav-e-t\">Source Insights</span> <span class=\"ulh-nav-e-s\">Which pages answers are built from</span></a> <a class=\"ulh-nav-eintrag\" href=\"https://upstreem.ai/#mira\" data-ziel=\".ulh-msc\"><span class=\"ulh-nav-e-t\">Agentic AEO</span> <span class=\"ulh-nav-e-s\">Mira does the work for you</span></a></div><div class=\"ulh-nav-karte\" data-menue=\"resources\"><span class=\"ulh-nav-spalte\">Resources</span> <a class=\"ulh-nav-eintrag\" href=\"https://upstreem.ai/blog\" target=\"_blank\" rel=\"noopener\"><span class=\"ulh-nav-e-t\">Blog</span> <span class=\"ulh-nav-e-s\">Notes on AI search</span></a> <a class=\"ulh-nav-eintrag\" href=\"https://docs.upstreem.ai/welcome\" target=\"_blank\" rel=\"noopener\"><span class=\"ulh-nav-e-t\">Documentation</span> <span class=\"ulh-nav-e-s\">How everything works</span></a></div></div></div><div class=\"ulh-nav-mobil\"><div class=\"ulh-nm-in\"><div class=\"ulh-nm-gruppe\"><span class=\"ulh-nm-spalte\">Platform</span> <a class=\"ulh-nm-eintrag\" href=\"https://upstreem.ai/#overview\" data-ziel=\".ulh-feat\"><span class=\"ulh-nav-e-t\">Overview</span> <span class=\"ulh-nav-e-s\">What upstreem shows you</span></a> <a class=\"ulh-nm-eintrag\" href=\"https://upstreem.ai/#sources\" data-ziel=\".ulh-quell\"><span class=\"ulh-nav-e-t\">Source Insights</span> <span class=\"ulh-nav-e-s\">Which pages answers are built from</span></a> <a class=\"ulh-nm-eintrag\" href=\"https://upstreem.ai/#mira\" data-ziel=\".ulh-msc\"><span class=\"ulh-nav-e-t\">Agentic AEO</span> <span class=\"ulh-nav-e-s\">Mira does the work for you</span></a></div> <div class=\"ulh-nm-gruppe\"><span class=\"ulh-nm-spalte\">Resources</span> <a class=\"ulh-nm-eintrag\" href=\"https://upstreem.ai/blog\" target=\"_blank\" rel=\"noopener\"><span class=\"ulh-nav-e-t\">Blog</span> <span class=\"ulh-nav-e-s\">Notes on AI search</span></a> <a class=\"ulh-nm-eintrag\" href=\"https://docs.upstreem.ai/welcome\" target=\"_blank\" rel=\"noopener\"><span class=\"ulh-nav-e-t\">Documentation</span> <span class=\"ulh-nav-e-s\">How everything works</span></a></div> <a class=\"ulh-nm-eintrag ulh-nm-einzeln\" href=\"https://upstreem.ai/pricing\" target=\"_blank\" rel=\"noopener\"><span class=\"ulh-nav-e-t\">Pricing</span></a> <div class=\"ulh-nm-knoepfe\"><a class=\"ulh-btn ulh-btn-sec\" target=\"_blank\" rel=\"noopener\" href=\"https://app.upstreem.ai/signup?mode=login\">Log in</a> <a class=\"ulh-btn ulh-btn-pri\" target=\"_blank\" rel=\"noopener\" href=\"https://app.upstreem.ai/signup\">Start for free</a></div></div></div></header></div>"
/* ---- SSR ENDE ---- */

const CDN = "https://cdn.jsdelivr.net/gh/lgoet/upstreem-ui@"
const SCHRIFT = "https://fonts.googleapis.com/css2?family=Geist:wght@400..700&display=swap"

function pinAus(v: any): string {
    const t = String(v || "").trim()
    return !t || t === "CDN_PIN" || t === "PIN_HIER" ? "main" : t
}

/* landing-teile.js einmal je Seite. Dieselbe Buchfuehrung wie landing-boot.js (Dateiname in
   window.__upAssetsLoaded) -- so laedt die Datei auch dann nur einmal, wenn Leiste und Fuss auf
   derselben Seite stehen. Ist sie schon da, bindet binden() die neue Instanz. */
function teileLaden(pin: string) {
    const w = window as any
    if (w.UpstreemLandingTeile) { w.UpstreemLandingTeile.binden(); return }
    const L = w.__upAssetsLoaded || (w.__upAssetsLoaded = {})
    if (L["landing-teile.js"]) return
    const s = document.createElement("script")
    s.src = CDN + pin + "/landing-teile.js"
    L["landing-teile.js"] = s.src
    s.async = false
    document.head.appendChild(s)
}

/**
 * Breite "Fill", Hoehe aus dem Inhalt (63px).
 *
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight auto
 * @framerIntrinsicWidth 1440
 */
export default function UpstreemTopbar(props: any) {
    const { pin, style } = props
    const p = pinAus(pin)
    useEffect(() => { teileLaden(p) }, [])
    return (
        <div style={{ width: "100%", ...style }}>
            <link rel="stylesheet" href={SCHRIFT} />
            <link rel="stylesheet" href={CDN + p + "/landing-hero.css"} />
            <div dangerouslySetInnerHTML={{ __html: LEISTE }} />
        </div>
    )
}

UpstreemTopbar.defaultProps = {
    pin: "",
}

addPropertyControls(UpstreemTopbar, {
    pin: { type: ControlType.String, title: "Pin", placeholder: "commit, e.g. 5ae33d2" },
})
