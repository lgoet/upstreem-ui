/* upstreem -- der Fuss der STARTSEITE als eigene Framer-Code-Komponente, fuer alle anderen Seiten
   (Blog, Preise, Rechtliches). Neu gebaut am 13.10.

   WARUM NEU: die Fassung vom 01.10. war ein Nachbau mit eigenen Werten in React und sah anders aus
   als der Fuss der Startseite (13.10. abgelehnt). Jetzt ist es DERSELBE Fuss:
     - Markup und jeder Text (Spalten, Netzwerke, Bildnachweis): fuss() aus landing-hero.js, von
       .landing_ssr.js unten eingesetzt (FUSS).
     - Form: landing-hero.css aus dem Pin.
     - Verhalten (Bildnachweis auf- und zuklappen, das laufende Jahr): landing-teile.js aus dem Pin.
   Vorgerendert: alle Links stehen im HTML der Seite, auch fuer Crawler ohne JavaScript. Das Jahr
   im vorgerenderten Markup ist das seiner Erzeugung; landing-teile.js stellt es auf das laufende.

   EINBAU: Assets -> Code -> die vorhandene Datei "UpstreemFooter" oeffnen, den GANZEN Inhalt durch
   diesen ersetzen, speichern -- die Instanzen auf allen Seiten ziehen mit. Rechts unter "Pin" den
   Commit eintragen, an der Instanz Breite "Fill". Auf der Startseite steht er NICHT (die bringt
   ihren Fuss mit). */
import * as React from "react"
import { useEffect } from "react"
import { addPropertyControls, ControlType } from "framer"

/* ---- SSR ANFANG (erzeugt von .landing_ssr.js -- nicht von Hand aendern) ---- */
const FUSS = "<div class=\"ulh-root ulh-teil\" data-ulh-teil=\"fuss\"><footer class=\"ulh-fuss\"><div class=\"ulh-spur ulh-fuss-in\"><div class=\"ulh-fuss-marke\"><a class=\"ulh-fuss-logo\" href=\"https://upstreem.ai/\" aria-label=\"upstreem\"><img src=\"https://tgdossbsevnonssyuewp.supabase.co/storage/v1/object/public/BRANDSTYLES/upstreem-lockup-1f1f1f.svg\" alt=\"upstreem\" width=\"218\" height=\"31\"/></a><p class=\"ulh-fuss-satz\">See how AI answers talk about your brand.</p><div class=\"ulh-fuss-netz\"><a class=\"ulh-fuss-ic\" href=\"https://www.linkedin.com/company/upstreem\" target=\"_blank\" rel=\"noopener\" aria-label=\"LinkedIn\"><svg viewBox=\"0 0 24 24\" fill=\"currentColor\"><path d=\"M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9h4v12H3zM10 9h3.8v1.7h.05c.53-1 1.83-2.05 3.76-2.05 4.02 0 4.76 2.6 4.76 5.98V21h-4v-5.5c0-1.31-.02-3-1.85-3-1.85 0-2.13 1.43-2.13 2.9V21h-4z\"/></svg></a><a class=\"ulh-fuss-ic\" href=\"https://www.youtube.com/@upstreem\" target=\"_blank\" rel=\"noopener\" aria-label=\"YouTube\"><svg viewBox=\"0 0 24 24\" fill=\"currentColor\"><path d=\"M23 12s0-3.5-.45-5.17a2.9 2.9 0 0 0-2.04-2.05C18.85 4.33 12 4.33 12 4.33s-6.85 0-8.51.45A2.9 2.9 0 0 0 1.45 6.83C1 8.5 1 12 1 12s0 3.5.45 5.17a2.9 2.9 0 0 0 2.04 2.05c1.66.45 8.51.45 8.51.45s6.85 0 8.51-.45a2.9 2.9 0 0 0 2.04-2.05C23 15.5 23 12 23 12zM9.8 15.3V8.7l5.7 3.3z\"/></svg></a></div></div><div class=\"ulh-fuss-spalten\"><div class=\"ulh-fuss-spalte\"><span class=\"ulh-fuss-kopf\">Product</span> <a class=\"ulh-fuss-link\" href=\"https://upstreem.ai/\" target=\"_blank\" rel=\"noopener\">Overview</a> <a class=\"ulh-fuss-link\" href=\"https://upstreem.ai/#pricing\" target=\"_blank\" rel=\"noopener\">Pricing</a> <a class=\"ulh-fuss-link\" href=\"https://app.upstreem.ai/signup?mode=login\" target=\"_blank\" rel=\"noopener\">Log in</a></div> <div class=\"ulh-fuss-spalte\"><span class=\"ulh-fuss-kopf\">Resources</span> <a class=\"ulh-fuss-link\" href=\"https://upstreem.ai/blog\" target=\"_blank\" rel=\"noopener\">Blog</a> <a class=\"ulh-fuss-link\" href=\"https://docs.upstreem.ai/welcome\" target=\"_blank\" rel=\"noopener\">Documentation</a></div> <div class=\"ulh-fuss-spalte\"><span class=\"ulh-fuss-kopf\">Legal</span> <a class=\"ulh-fuss-link\" href=\"https://upstreem.ai/terms-of-service\" target=\"_blank\" rel=\"noopener\">Terms of service</a> <a class=\"ulh-fuss-link\" href=\"https://upstreem.ai/privacy-policy\" target=\"_blank\" rel=\"noopener\">Privacy policy</a> <a class=\"ulh-fuss-link\" href=\"https://upstreem.ai/imprint\" target=\"_blank\" rel=\"noopener\">Imprint</a></div></div></div><div class=\"ulh-spur ulh-fuss-unten\"><span>© <span data-ulh-jahr>2026</span> upstreem. All rights reserved.</span><button class=\"ulh-fuss-link ulh-fuss-nachweis-knopf\" type=\"button\" data-ulh-nachweis aria-expanded=\"false\" aria-controls=\"ulh-bildnachweis\">Image credits</button></div><div class=\"ulh-spur ulh-fuss-nachweis\" id=\"ulh-bildnachweis\" hidden><p>Product photos from Wikimedia Commons: <a href=\"https://commons.wikimedia.org/wiki/File:Tesla_Model_Y_Premium_(Facelift)_%E2%80%93_f_05052026.jpg\" target=\"_blank\" rel=\"noopener\">“Tesla Model Y Premium (Facelift) – f 05052026”</a> by M 93 (<a href=\"https://creativecommons.org/licenses/by-sa/3.0/de/\" target=\"_blank\" rel=\"noopener\">CC BY-SA 3.0 de</a>), <a href=\"https://commons.wikimedia.org/wiki/File:Delta_Electronics_EVPT3215MWE_20190601.jpg\" target=\"_blank\" rel=\"noopener\">“Delta Electronics EVPT3215MWE 20190601”</a> by Solomon203 (<a href=\"https://creativecommons.org/licenses/by-sa/4.0/\" target=\"_blank\" rel=\"noopener\">CC BY-SA 4.0</a>), <a href=\"https://commons.wikimedia.org/wiki/File:TeslaDestinationCharger.jpg\" target=\"_blank\" rel=\"noopener\">“TeslaDestinationCharger”</a> by Raysonho (<a href=\"https://creativecommons.org/publicdomain/zero/1.0/\" target=\"_blank\" rel=\"noopener\">CC0</a>), <a href=\"https://commons.wikimedia.org/wiki/File:Front_vom_BMW_iX_xDrive_60_in_der_BMW_Welt_M%C3%BCnchen_2025-04-15.jpg\" target=\"_blank\" rel=\"noopener\">“Front vom BMW iX xDrive 60 in der BMW Welt München 2025-04-15”</a> by Strubbl (<a href=\"https://creativecommons.org/licenses/by-sa/4.0/\" target=\"_blank\" rel=\"noopener\">CC BY-SA 4.0</a>), <a href=\"https://commons.wikimedia.org/wiki/File:Audi_Q4_e-tron_50_quattro_%E2%80%93_f_22012023.jpg\" target=\"_blank\" rel=\"noopener\">“Audi Q4 e-tron 50 quattro – f 22012023”</a> by M 93 (<a href=\"https://creativecommons.org/licenses/by-sa/3.0/de/\" target=\"_blank\" rel=\"noopener\">CC BY-SA 3.0 de</a>), <a href=\"https://commons.wikimedia.org/wiki/File:Thule_Dynamic_roof_box_(11726731603).jpg\" target=\"_blank\" rel=\"noopener\">“Thule Dynamic roof box (11726731603)”</a> by EHRENBERG Kommunikation (<a href=\"https://creativecommons.org/licenses/by-sa/2.0/\" target=\"_blank\" rel=\"noopener\">CC BY-SA 2.0</a>), <a href=\"https://commons.wikimedia.org/wiki/File:Tailored-rubber-mats-moulded-car-mats.jpg\" target=\"_blank\" rel=\"noopener\">“Tailored-rubber-mats-moulded-car-mats”</a> by Keystones (<a href=\"https://creativecommons.org/licenses/by-sa/3.0/\" target=\"_blank\" rel=\"noopener\">CC BY-SA 3.0</a>), <a href=\"https://commons.wikimedia.org/wiki/File:Volvo_EX30_1X7A2493.jpg\" target=\"_blank\" rel=\"noopener\">“Volvo EX30 1X7A2493”</a> by Alexander Migl (<a href=\"https://creativecommons.org/licenses/by-sa/4.0/\" target=\"_blank\" rel=\"noopener\">CC BY-SA 4.0</a>), <a href=\"https://commons.wikimedia.org/wiki/File:2015-12-23_Typ-2-Ladestecker.jpg\" target=\"_blank\" rel=\"noopener\">“2015-12-23 Typ-2-Ladestecker”</a> by Hadhuey (<a href=\"https://creativecommons.org/licenses/by-sa/4.0/\" target=\"_blank\" rel=\"noopener\">CC BY-SA 4.0</a>), <a href=\"https://commons.wikimedia.org/wiki/File:Porsche_Taycan_4S_IMG_3526.jpg\" target=\"_blank\" rel=\"noopener\">“Porsche Taycan 4S IMG 3526”</a> by Alexander Migl (<a href=\"https://creativecommons.org/licenses/by-sa/4.0/\" target=\"_blank\" rel=\"noopener\">CC BY-SA 4.0</a>).</p><p>Ad illustrations: US Environmental Protection Agency, public domain, via <a href=\"https://openclipart.org\" target=\"_blank\" rel=\"noopener\">Openclipart</a>.</p></div></footer></div>"
/* ---- SSR ENDE ---- */

const CDN = "https://cdn.jsdelivr.net/gh/lgoet/upstreem-ui@"
const SCHRIFT = "https://fonts.googleapis.com/css2?family=Geist:wght@400..700&display=swap"

function pinAus(v: any): string {
    const t = String(v || "").trim()
    return !t || t === "CDN_PIN" || t === "PIN_HIER" ? "main" : t
}

/* Wie in UpstreemTopbar.tsx: landing-teile.js einmal je Seite. */
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
export default function UpstreemFooter(props: any) {
    const { pin, style } = props
    const p = pinAus(pin)
    useEffect(() => { teileLaden(p) }, [])
    return (
        <div style={{ width: "100%", ...style }}>
            <link rel="stylesheet" href={SCHRIFT} />
            <link rel="stylesheet" href={CDN + p + "/landing-hero.css"} />
            <div dangerouslySetInnerHTML={{ __html: FUSS }} />
        </div>
    )
}

UpstreemFooter.defaultProps = {
    pin: "",
}

addPropertyControls(UpstreemFooter, {
    pin: { type: ControlType.String, title: "Pin", placeholder: "commit, e.g. 5ae33d2" },
})
