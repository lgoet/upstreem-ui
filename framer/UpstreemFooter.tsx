/* upstreem -- der Fuss der Landingpage als Framer-Code-Komponente (01.10. angefordert).

   Einbau in Framer: Assets -> Code -> "+" -> New Component, den ganzen Inhalt dieser Datei
   einfuegen, speichern, auf die Seite ziehen und die Breite auf "Fill" stellen.

   Vorbild ist der Fuss aus landing-hero.js / landing-hero.css (fuss(), .ulh-fuss*), Wert fuer
   Wert: schwarz ueber die ganze Breite, links die Marke mit Satz und den zwei Netzwerken, rechts
   drei Spalten, unten die Zeile mit dem Jahr. Jahr aus dem Datum, wie dort.

   BREITE, NICHT FENSTER: die schmalen Fassungen haengen an der Breite der Komponente
   (ResizeObserver), nicht an einer Media Query -- im Framer-Editor ist das Fenster der Editor.
     unter 900px   16px Rand statt der Seitenspur, engere Luecke
     unter 560px   Marke und Spalten untereinander

   Die zwei Netzwerk-Zeichen sind die offiziellen Umrisse, als Pfad -- wie auf der Landingpage
   (FUSS_IC). core.js laeuft in Framer nicht, und Feather hat keine Markenzeichen. */
import * as React from "react"
import { useEffect, useRef, useState } from "react"
import { addPropertyControls, ControlType } from "framer"

type Verweis = { label: string; link: string }

const WORTMARKE =
    "https://tgdossbsevnonssyuewp.supabase.co/storage/v1/object/public/BRANDSTYLES/upstreem-lockup-1f1f1f.svg"
const EASE = "cubic-bezier(.4, 0, .2, 1)"

const IC_LINKEDIN = (
    <svg viewBox="0 0 24 24" fill="currentColor" width="17" height="17" aria-hidden="true">
        <path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9h4v12H3zM10 9h3.8v1.7h.05c.53-1 1.83-2.05 3.76-2.05 4.02 0 4.76 2.6 4.76 5.98V21h-4v-5.5c0-1.31-.02-3-1.85-3-1.85 0-2.13 1.43-2.13 2.9V21h-4z" />
    </svg>
)
const IC_YOUTUBE = (
    <svg viewBox="0 0 24 24" fill="currentColor" width="17" height="17" aria-hidden="true">
        <path d="M23 12s0-3.5-.45-5.17a2.9 2.9 0 0 0-2.04-2.05C18.85 4.33 12 4.33 12 4.33s-6.85 0-8.51.45A2.9 2.9 0 0 0 1.45 6.83C1 8.5 1 12 1 12s0 3.5.45 5.17a2.9 2.9 0 0 0 2.04 2.05c1.66.45 8.51.45 8.51.45s6.85 0 8.51-.45a2.9 2.9 0 0 0 2.04-2.05C23 15.5 23 12 23 12zM9.8 15.3V8.7l5.7 3.3z" />
    </svg>
)

const CSS = `
@import url("https://fonts.googleapis.com/css2?family=Geist:wght@400..700&display=swap");
.upx-fuss, .upx-fuss * { box-sizing: border-box; }
.upx-fuss a { text-decoration: none; }
.upx-fuss .upx-ic {
  width: 32px; height: 32px; border-radius: 9px; display: inline-flex; align-items: center;
  justify-content: center; color: #9a9a9a; background: rgba(255, 255, 255, .05);
  transition: color 160ms ${EASE}, background 160ms ${EASE};
}
.upx-fuss .upx-ic:hover { color: #ffffff; background: rgba(255, 255, 255, .1); }
.upx-fuss .upx-link { font-size: 13.5px; font-weight: 400; color: #cfcfcf; transition: color 160ms ${EASE}; }
.upx-fuss .upx-link:hover { color: #ffffff; }
.upx-fuss .upx-ic:focus-visible, .upx-fuss .upx-link:focus-visible { outline: 2px solid #ffffff; outline-offset: 2px; border-radius: 6px; }
`

/**
 * Breite frei (in Framer auf "Fill" stellen), Hoehe aus dem Inhalt.
 *
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight auto
 * @framerIntrinsicWidth 1200
 */
export default function UpstreemFooter(props: any) {
    const {
        logo, logoLink, tagline, linkedin, youtube, col1Title, col1, col2Title, col2,
        col3Title, col3, copyright, newTab, maxWidth, sidePadding, style,
    } = props

    const wurzel = useRef<HTMLDivElement>(null)
    const [breite, setBreite] = useState(1200)
    useEffect(() => {
        const el = wurzel.current
        if (!el || typeof ResizeObserver === "undefined") return
        const ro = new ResizeObserver((e) => setBreite(e[0].contentRect.width))
        ro.observe(el)
        return () => ro.disconnect()
    }, [])
    const schmal = breite < 900
    const sehrSchmal = breite < 560
    const ziel = newTab ? { target: "_blank", rel: "noopener" } : {}
    const jahr = new Date().getFullYear()
    /* "{year}" im Text wird durch das Jahr ersetzt -- so bleibt die Zeile einstellbar, ohne dass
       sie jedes Jahr von Hand nachgezogen werden muss. */
    const unten = String(copyright || "").split("{year}").join(String(jahr))

    const spur: React.CSSProperties = { maxWidth, margin: "0 auto", width: "100%" }
    const spalte = (titel: string, links: Verweis[]) => (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 128 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: "#6f6f6f", marginBottom: 2 }}>{titel}</span>
            {(links || []).map((l, i) => (
                <a key={i} className="upx-link" href={l.link || "#"} {...ziel}>{l.label}</a>
            ))}
        </div>
    )

    return (
        <footer
            ref={wurzel as any}
            className="upx-fuss"
            style={{
                ...style,
                width: "100%",
                background: "#0b0b0b",
                color: "#e0e0e0",
                fontFamily: 'Geist, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif',
                padding: `clamp(84px, 12vh, 132px) ${schmal ? 16 : sidePadding}px 0`,
            }}
        >
            <style>{CSS}</style>
            <div
                style={{
                    ...spur,
                    display: "flex", gap: schmal ? 32 : 48, alignItems: "flex-start", flexWrap: "wrap",
                    flexDirection: sehrSchmal ? "column" : "row",
                    paddingBottom: "clamp(72px, 10vh, 114px)",
                }}
            >
                <div style={{ display: "flex", flexDirection: "column", gap: 14, marginRight: sehrSchmal ? 0 : "auto", maxWidth: 300 }}>
                    <a href={logoLink || "#"} aria-label="upstreem" style={{ display: "inline-flex", alignItems: "center" }}>
                        {/* Die Wortmarke ist dunkle Tinte -- auf Schwarz umgedreht, wie auf der Landingpage. */}
                        <img src={(logo && logo.src) || logo || WORTMARKE} alt="upstreem" style={{ display: "block", height: 31, width: "auto", filter: "invert(1)" }} />
                    </a>
                    <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.5, color: "#9a9a9a", maxWidth: "30ch" }}>{tagline}</p>
                    <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                        {linkedin && <a className="upx-ic" href={linkedin} {...ziel} aria-label="LinkedIn">{IC_LINKEDIN}</a>}
                        {youtube && <a className="upx-ic" href={youtube} {...ziel} aria-label="YouTube">{IC_YOUTUBE}</a>}
                    </div>
                </div>
                <div style={{ display: "flex", gap: "clamp(40px, 6vw, 88px)", flexWrap: "wrap" }}>
                    {spalte(col1Title, col1)}
                    {spalte(col2Title, col2)}
                    {spalte(col3Title, col3)}
                </div>
            </div>
            <div style={{ ...spur, borderTop: "1px solid rgba(255, 255, 255, .08)", padding: "26px 0 34px", fontSize: 12.5, color: "#6f6f6f" }}>
                <span>{unten}</span>
            </div>
        </footer>
    )
}

const VERWEIS = {
    type: ControlType.Object,
    controls: {
        label: { type: ControlType.String, title: "Label" },
        link: { type: ControlType.Link, title: "Link" },
    },
}

UpstreemFooter.defaultProps = {
    logo: WORTMARKE,
    logoLink: "https://upstreem.ai",
    tagline: "See how AI answers talk about your brand.",
    linkedin: "https://www.linkedin.com/company/upstreem",
    youtube: "https://www.youtube.com/@upstreem",
    col1Title: "Product",
    col1: [
        { label: "Overview", link: "https://upstreem.ai" },
        { label: "Pricing", link: "https://upstreem.ai/pricing" },
        { label: "Log in", link: "https://app.upstreem.ai/signup?mode=login" },
    ],
    col2Title: "Resources",
    col2: [
        { label: "Blog", link: "https://upstreem.ai/blog" },
        { label: "Documentation", link: "https://docs.upstreem.ai/welcome" },
    ],
    col3Title: "Legal",
    col3: [
        { label: "Terms of service", link: "https://upstreem.ai/terms-of-service" },
        { label: "Privacy policy", link: "https://upstreem.ai/privacy-policy" },
        { label: "Imprint", link: "https://upstreem.ai/imprint" },
    ],
    copyright: "© {year} upstreem. All rights reserved.",
    newTab: true,
    maxWidth: 1440,
    sidePadding: 64,
}

addPropertyControls(UpstreemFooter, {
    logo: { type: ControlType.Image, title: "Logo" },
    logoLink: { type: ControlType.Link, title: "Logo link" },
    tagline: { type: ControlType.String, title: "Tagline", displayTextArea: true },
    linkedin: { type: ControlType.Link, title: "LinkedIn" },
    youtube: { type: ControlType.Link, title: "YouTube" },
    col1Title: { type: ControlType.String, title: "Column 1" },
    col1: { type: ControlType.Array, title: "Column 1 links", control: VERWEIS },
    col2Title: { type: ControlType.String, title: "Column 2" },
    col2: { type: ControlType.Array, title: "Column 2 links", control: VERWEIS },
    col3Title: { type: ControlType.String, title: "Column 3" },
    col3: { type: ControlType.Array, title: "Column 3 links", control: VERWEIS },
    copyright: { type: ControlType.String, title: "Bottom line" },
    newTab: { type: ControlType.Boolean, title: "New tab", enabledTitle: "Yes", disabledTitle: "No" },
    maxWidth: { type: ControlType.Number, title: "Max width", min: 600, max: 2000, step: 10, unit: "px" },
    sidePadding: { type: ControlType.Number, title: "Side padding", min: 0, max: 200, step: 1, unit: "px" },
})
