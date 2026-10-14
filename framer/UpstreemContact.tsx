/* upstreem -- der Inhalt der Seite upstreem.ai/contact als Framer-Code-Komponente (14.10.).
   Ziel von "Talk to Sales" im Hero und "Talk to sales" am Ende der Startseite.

   WAS DRIN IST: Ueberschrift, Satz, die Mailadresse und der Kalender (Cal.com, Inline -- derselbe
   Termintyp auf /demo und /contact). Leiste und Fuss NICHT: die kommen wie auf jeder anderen Seite
   als UpstreemTopbar und UpstreemFooter darueber und darunter.
     - Markup und jeder Text: termin("kontakt") aus landing-hero.js, von .landing_ssr.js unten
       eingesetzt (TERMIN). Nichts davon wird hier von Hand gepflegt.
     - Form: landing-hero.css aus dem Pin, dieselbe Datei wie auf der Startseite.
     - Verhalten (Kalender einsetzen, Balken bis er steht, Satz mit Link, wenn er nicht kommt):
       landing-teile.js aus dem Pin -- dieselbe Datei, die Leiste und Fuss binden.
   Vorgerendert: Ueberschrift, Satz und der direkte Link zu Cal.com stehen im HTML der Seite, auch
   fuer Crawler ohne JavaScript. Der Kalender selbst ist ein Rahmen von Cal.com und kommt erst im
   Browser. Beim Rendern greift nichts auf window/document zu (alles in useEffect).

   EINBAU: Assets -> Code -> "+" -> New Component, Name "UpstreemContact", den ganzen Inhalt einfuegen,
   speichern. Neue Seite mit dem Pfad /contact: oben UpstreemTopbar, darunter diese Komponente,
   unten UpstreemFooter. An der Instanz Breite "Fill", Hoehe "Auto", rechts unter "Pin" denselben
   Commit wie bei Leiste und Fuss. */
import * as React from "react"
import { useEffect } from "react"
import { addPropertyControls, ControlType } from "framer"

/* ---- SSR ANFANG (erzeugt von .landing_ssr.js -- nicht von Hand aendern) ---- */
const TERMIN = "<div class=\"ulh-root ulh-teil\" data-ulh-teil=\"termin\"><section class=\"ulh-termin\" data-art=\"kontakt\"><div class=\"ulh-seitenkopf\"><div class=\"ulh-spur ulh-seitenkopf-in\"><span class=\"ulh-feat-chip\">Contact</span><h1 class=\"ulh-seitenkopf-h\">Talk to sales</h1><p class=\"ulh-seitenkopf-sub\">Questions about plans, onboarding or a custom setup? Book a call with us, or write to us directly.</p></div></div><div class=\"ulh-spur\"><div class=\"ulh-cards-box ulh-termin-box\"><div class=\"ulh-cards\"><div class=\"ulh-cards-row\"><article class=\"ulh-card ulh-termin-info\" style=\"--ulh-w:32\"><h2 class=\"ulh-termin-h\">Write to us</h2><p class=\"ulh-termin-t\">Plans, onboarding, agencies or a custom setup: tell us what you need.</p><a class=\"ulh-termin-mailgross\" href=\"mailto:lukas@upstreem.ai\">lukas@upstreem.ai</a><p class=\"ulh-termin-alt ulh-termin-alt-kal\">Or book a call</p></article><article class=\"ulh-card ulh-termin-kalkarte\" style=\"--ulh-w:68\"><div class=\"ulh-termin-kal\" data-ulh-cal=\"upstreem/upstreem-demo\" data-ulh-cal-ns=\"upstreem-demo\"><div class=\"ulh-termin-ziel\"></div><div class=\"ulh-termin-zustimmung\" hidden><p class=\"ulh-termin-z-h\">The calendar is provided by Cal.com</p><p class=\"ulh-termin-z-t\">Loading it shares your IP address and browser data with Cal.com, which may set cookies. You can also book directly on cal.com.</p><div class=\"ulh-termin-z-knoepfe\"><button class=\"ulh-btn ulh-btn-pri\" type=\"button\" data-ulh-cal-erlauben>Load calendar</button> <a class=\"ulh-btn ulh-btn-sec\" href=\"https://cal.com/upstreem/upstreem-demo\" target=\"_blank\" rel=\"noopener\">Open cal.com</a></div></div><p class=\"ulh-termin-fehler\">The calendar could not load. <a href=\"https://cal.com/upstreem/upstreem-demo\" target=\"_blank\" rel=\"noopener\">Book on cal.com</a> or write to <a href=\"mailto:lukas@upstreem.ai\">lukas@upstreem.ai</a>.</p></div></article></div></div></div></div></section></div>"
/* ---- SSR ENDE ---- */

const CDN = "https://cdn.jsdelivr.net/gh/lgoet/upstreem-ui@"
const SCHRIFT = "https://fonts.googleapis.com/css2?family=Geist:wght@400..700&display=swap"

function pinAus(v: any): string {
    const t = String(v || "").trim()
    return !t || t === "CDN_PIN" || t === "PIN_HIER" ? "main" : t
}

/* Wie in UpstreemTopbar.tsx: landing-teile.js einmal je Seite. Ist sie schon da (Leiste auf
   derselben Seite, oder ein Seitenwechsel ohne Neuladen), bindet binden() die neue Instanz. */
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
 * Breite "Fill", Hoehe aus dem Inhalt.
 *
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight auto
 * @framerIntrinsicWidth 1440
 */
export default function UpstreemContact(props: any) {
    const { pin, style } = props
    const p = pinAus(pin)
    useEffect(() => { teileLaden(p) }, [])
    return (
        <div style={{ width: "100%", ...style }}>
            <link rel="stylesheet" href={SCHRIFT} />
            <link rel="stylesheet" href={CDN + p + "/landing-hero.css"} />
            <div dangerouslySetInnerHTML={{ __html: TERMIN }} />
        </div>
    )
}

UpstreemContact.defaultProps = {
    pin: "",
}

addPropertyControls(UpstreemContact, {
    pin: { type: ControlType.String, title: "Pin", placeholder: "commit, e.g. 5ae33d2" },
})
