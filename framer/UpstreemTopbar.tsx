/* upstreem -- die Leiste der Landingpage als Framer-Code-Komponente (01.10. angefordert).

   Einbau in Framer: Assets -> Code -> "+" -> New Component, den ganzen Inhalt dieser Datei
   einfuegen, speichern. Die Komponente erscheint unter Assets und wird wie jede andere auf die
   Seite gezogen. Oben kleben lassen: an der INSTANZ in Framer "Position: Sticky, Top 0" setzen --
   die Komponente selbst klebt nicht, weil sie in einem fremden Scrollkasten steht und nicht
   wissen kann, welcher scrollt.

   Vorbild ist die Leiste aus landing-hero.js / landing-hero.css (leiste(), .ulh-nav*), Wert fuer
   Wert: 62px hoch, Logo 20px, drei Punkte in der Mitte (14px, --ulh-sub), zwei Knoepfe rechts
   (36px, Radius 10), das EINE Panel, das beim Wechsel zwischen den Punkten wandert statt zu
   schliessen. Was dort an der Seite hing, ist hier eine Einstellung: die Eintraege unter
   "Platform" scrollten dort zu Sektionen derselben Seite -- in Framer kennt die Komponente die
   Seite nicht, also traegt jeder Eintrag einen Link (z.B. "#overview" auf eine Sektion mit
   dieser ID, oder eine Seite).

   BREITE, NICHT FENSTER: die schmalen Fassungen haengen an der Breite der Komponente selbst
   (ResizeObserver), nicht an einer Media Query. Im Framer-Editor ist das Fenster der Editor, und
   eine Media Query saehe dort nie die Breite, die man gerade einstellt.
     unter 900px   die Mitte faellt weg, die Schienen auch (wie die Landingpage mobil)
     unter 560px   "Log in" faellt weg

   Keine Zeichen aus core (UC.icon): core.js laeuft in Framer nicht. Die Leiste braucht aber auch
   keins -- das Logo ist die Bilddatei der Wortmarke. */
import * as React from "react"
import { useEffect, useRef, useState } from "react"
import { addPropertyControls, ControlType } from "framer"

type Eintrag = { title: string; subtitle: string; link: string }
type MenueKey = "platform" | "resources"

const WORTMARKE =
    "https://tgdossbsevnonssyuewp.supabase.co/storage/v1/object/public/BRANDSTYLES/upstreem-lockup-1f1f1f.svg"

/* Die Farben der Landingpage (.ulh-root in landing-hero.css), unter denselben Namen. */
const F = {
    text: "#1f1f1b",
    sub: "#767a82",
    third: "#9e9e9e",
    border: "#e7e9ec",
    schiene: "#ededf0",
    kasten: "#F6F6F7",
    grund: "#FFFFFFF2",
}
const EASE = "cubic-bezier(.4, 0, .2, 1)"
const WEICH = "cubic-bezier(.65, 0, .35, 1)"

/* Hover und Fokus gehen nicht als Inline-Stil -- also ein kleines Stylesheet, alles unter
   .upx-nav, damit nichts auf der Framer-Seite getroffen wird. Die Schrift kommt von Google Fonts
   wie in core.css (Geist, variable Achse 400..700). */
const CSS = `
@import url("https://fonts.googleapis.com/css2?family=Geist:wght@400..700&display=swap");
.upx-nav, .upx-nav * { box-sizing: border-box; }
.upx-nav a { text-decoration: none; }
.upx-nav .upx-punkt {
  appearance: none; border: 0; background: transparent; cursor: pointer; font-family: inherit;
  font-size: 14px; font-weight: 400; letter-spacing: -0.01em; color: ${F.sub};
  height: 34px; padding: 0 12px; border-radius: 9px; display: inline-flex; align-items: center;
  transition: color 160ms ${EASE}, background 160ms ${EASE};
}
.upx-nav .upx-punkt:hover, .upx-nav .upx-punkt.is-aktiv { color: ${F.text}; background: ${F.kasten}; }
.upx-nav .upx-btn {
  display: inline-flex; align-items: center; height: 36px; padding: 0 12px; border-radius: 10px;
  font-family: inherit; font-size: 14px; font-weight: 500; white-space: nowrap; cursor: pointer;
  transition: background 140ms ease, border-color 140ms ease;
}
.upx-nav .upx-btn-sec { border: 1px solid ${F.border}; background: ${F.grund}; color: ${F.text}; }
.upx-nav .upx-btn-sec:hover { background: #f5f5f5; border-color: #6f6f6f; }
.upx-nav .upx-btn-pri { border: 1px solid ${F.text}; background: ${F.text}; color: #ffffff; }
.upx-nav .upx-btn-pri:hover { background: #33332e; border-color: #33332e; }
.upx-nav .upx-eintrag {
  display: flex; flex-direction: column; gap: 1px; padding: 9px 10px; border-radius: 10px;
  min-width: 232px; transition: background 160ms ${EASE};
}
.upx-nav .upx-eintrag:hover { background: ${F.kasten}; }
.upx-nav .upx-punkt:focus-visible, .upx-nav .upx-btn:focus-visible, .upx-nav .upx-eintrag:focus-visible {
  outline: 2px solid ${F.text}; outline-offset: 1px;
}
`

/**
 * Breite frei (in Framer auf "Fill" stellen), Hoehe aus dem Inhalt.
 *
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight auto
 * @framerIntrinsicWidth 1200
 */
export default function UpstreemTopbar(props: any) {
    const {
        logo, logoLink, platformLabel, platform, resourcesLabel, resources, pricingLabel,
        pricingLink, loginLabel, loginLink, signupLabel, signupLink, newTab, maxWidth,
        sidePadding, rails, style,
    } = props

    const wurzel = useRef<HTMLDivElement>(null)
    const flaeche = useRef<HTMLDivElement>(null)
    const karteP = useRef<HTMLDivElement>(null)
    const karteR = useRef<HTMLDivElement>(null)
    const uhr = useRef<any>(null)
    const [breite, setBreite] = useState(1200)
    const [offen, setOffen] = useState<MenueKey | null>(null)
    /* sprung: das ERSTE Oeffnen setzt Lage und Groesse ohne Uebergang -- sonst faehrt das Panel
       von der linken Kante herueber, waehrend es aufblendet. Danach wandert es. */
    const [pop, setPop] = useState({ w: 0, h: 0, x: 0, sprung: true })

    useEffect(() => {
        const el = wurzel.current
        if (!el || typeof ResizeObserver === "undefined") return
        const ro = new ResizeObserver((e) => setBreite(e[0].contentRect.width))
        ro.observe(el)
        return () => ro.disconnect()
    }, [])
    useEffect(() => () => clearTimeout(uhr.current), [])

    const schmal = breite < 900
    const sehrSchmal = breite < 560
    const ziel = newTab ? { target: "_blank", rel: "noopener" } : {}

    function zeigen(k: MenueKey, knopf: HTMLElement) {
        clearTimeout(uhr.current)
        const karte = (k === "platform" ? karteP : karteR).current
        const fl = flaeche.current
        if (!karte || !fl) return
        /* Die Lage aus Bildschirm-Rechtecken, die Groesse aus dem Layout. Im Framer-Editor ist die
           Flaeche gezoomt -- darum geteilt durch den Massstab, sonst stuende das Panel bei 50%
           Zoom um die Haelfte daneben. */
        const innen = fl.getBoundingClientRect()
        const r = knopf.getBoundingClientRect()
        const mass = fl.offsetWidth ? innen.width / fl.offsetWidth : 1
        let x = (r.left - innen.left) / mass - 20
        const max = fl.offsetWidth - karte.offsetWidth
        if (x > max) x = max
        if (x < 0) x = 0
        setPop({ w: karte.offsetWidth, h: karte.offsetHeight, x: Math.round(x), sprung: offen === null })
        setOffen(k)
    }
    function schliessen() {
        clearTimeout(uhr.current)
        /* Nachfrist: der Weg vom Punkt ins Panel fuehrt ueber ein paar Pixel Nichts. */
        uhr.current = setTimeout(() => setOffen(null), 140)
    }

    function karte(k: MenueKey, titel: string, eintraege: Eintrag[], ref: React.RefObject<HTMLDivElement>) {
        const da = offen === k
        return (
            <div
                ref={ref}
                style={{
                    position: "absolute", top: 0, left: 0, width: "max-content",
                    display: "flex", flexDirection: "column", gap: 2, padding: 14,
                    opacity: da ? 1 : 0, pointerEvents: da ? "auto" : "none",
                    transition: `opacity 200ms ${EASE}`,
                }}
            >
                <span style={{ padding: "4px 10px 8px", fontSize: 11, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", color: F.third }}>
                    {titel}
                </span>
                {(eintraege || []).map((e, i) => (
                    <a key={i} className="upx-eintrag" href={e.link || "#"} {...(/^https?:/.test(e.link || "") ? ziel : {})} onClick={() => setOffen(null)}>
                        <span style={{ fontSize: 14, fontWeight: 500, letterSpacing: "-0.01em", color: F.text }}>{e.title}</span>
                        <span style={{ fontSize: 12.5, fontWeight: 400, color: F.sub }}>{e.subtitle}</span>
                    </a>
                ))}
            </div>
        )
    }

    const auf = offen !== null
    return (
        <div
            ref={wurzel}
            className="upx-nav"
            onMouseLeave={schliessen}
            style={{
                /* Ueber dem, was nach ihr kommt -- sonst malt die naechste Sektion ueber das offene
                   Panel (im Pruefstand gesehen). Wie .ulh-nav (z-index 40). VOR style: setzt Framer
                   Lage oder Ebene selbst (Sticky), gewinnt Framer. */
                position: "relative",
                zIndex: 40,
                width: "100%",
                ...style,
                fontFamily: 'Geist, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif',
                background: auf ? "rgba(255, 255, 255, .94)" : "rgba(255, 255, 255, .82)",
                WebkitBackdropFilter: "saturate(180%) blur(14px)",
                backdropFilter: "saturate(180%) blur(14px)",
                borderBottom: `1px solid ${F.border}`,
                transition: `background 200ms ${EASE}`,
                padding: `0 ${schmal ? 16 : sidePadding}px`,
            }}
        >
            <style>{CSS}</style>
            <div
                ref={flaeche}
                style={{
                    position: "relative", maxWidth, margin: "0 auto", height: 62,
                    display: "flex", alignItems: "center", gap: schmal ? 12 : 24,
                    padding: "0 16px",
                    /* Die zwei Schienen des Seitengitters laufen durch die Leiste. Mobil ohne:
                       dort gibt es auf der Landingpage auch keine (30.09.). */
                    borderLeft: rails && !schmal ? `1px solid ${F.schiene}` : "none",
                    borderRight: rails && !schmal ? `1px solid ${F.schiene}` : "none",
                }}
            >
                <a href={logoLink || "#"} aria-label="upstreem" style={{ display: "inline-flex", alignItems: "center" }}>
                    <img src={(logo && logo.src) || logo || WORTMARKE} alt="upstreem" style={{ display: "block", height: 20, width: "auto" }} />
                </a>
                {!schmal && (
                    <nav style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", display: "flex", alignItems: "center", gap: 14 }}>
                        <button type="button" className={"upx-punkt" + (offen === "platform" ? " is-aktiv" : "")}
                            onMouseEnter={(e) => zeigen("platform", e.currentTarget)} onFocus={(e) => zeigen("platform", e.currentTarget)}>
                            {platformLabel}
                        </button>
                        <button type="button" className={"upx-punkt" + (offen === "resources" ? " is-aktiv" : "")}
                            onMouseEnter={(e) => zeigen("resources", e.currentTarget)} onFocus={(e) => zeigen("resources", e.currentTarget)}>
                            {resourcesLabel}
                        </button>
                        <a className="upx-punkt" href={pricingLink || "#"} {...ziel} onMouseEnter={schliessen}>
                            {pricingLabel}
                        </a>
                    </nav>
                )}
                <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
                    {!sehrSchmal && (
                        <a className="upx-btn upx-btn-sec" href={loginLink || "#"} {...ziel} style={schmal ? { padding: "0 10px" } : undefined}>
                            {loginLabel}
                        </a>
                    )}
                    <a className="upx-btn upx-btn-pri" href={signupLink || "#"} {...ziel} style={schmal ? { padding: "0 10px" } : undefined}>
                        {signupLabel}
                    </a>
                </div>
                {!schmal && (
                    <div
                        aria-hidden={!auf}
                        onMouseEnter={() => clearTimeout(uhr.current)}
                        style={{
                            position: "absolute", top: "calc(100% - 6px)", left: 0,
                            width: pop.w, height: pop.h, overflow: "hidden", zIndex: 10,
                            background: "#ffffff", border: `1px solid ${F.border}`, borderRadius: 14,
                            boxShadow: "0 1px 2px rgba(11, 13, 24, .04), 0 18px 44px rgba(11, 13, 24, .12)",
                            opacity: auf ? 1 : 0, pointerEvents: auf ? "auto" : "none",
                            transform: `translateX(${pop.x}px) translateY(${auf ? 0 : -10}px)`,
                            transition: pop.sprung
                                ? `opacity 200ms ${EASE}`
                                : `width 320ms ${WEICH}, height 320ms ${WEICH}, transform 320ms ${WEICH}, opacity 200ms ${EASE}`,
                        }}
                    >
                        {karte("platform", platformLabel, platform, karteP)}
                        {karte("resources", resourcesLabel, resources, karteR)}
                    </div>
                )}
            </div>
        </div>
    )
}

const EINTRAG = {
    type: ControlType.Object,
    controls: {
        title: { type: ControlType.String, title: "Title" },
        subtitle: { type: ControlType.String, title: "Subtitle" },
        link: { type: ControlType.Link, title: "Link" },
    },
}

UpstreemTopbar.defaultProps = {
    logo: WORTMARKE,
    logoLink: "https://upstreem.ai",
    platformLabel: "Platform",
    platform: [
        { title: "Overview", subtitle: "What upstreem shows you", link: "#overview" },
        { title: "Source Insights", subtitle: "Which pages answers are built from", link: "#sources" },
        { title: "Agentic AEO", subtitle: "Mira does the work for you", link: "#mira" },
    ],
    resourcesLabel: "Resources",
    resources: [
        { title: "Blog", subtitle: "Notes on AI search", link: "https://upstreem.ai/blog" },
        { title: "Documentation", subtitle: "How everything works", link: "https://docs.upstreem.ai/welcome" },
    ],
    pricingLabel: "Pricing",
    pricingLink: "https://upstreem.ai/pricing",
    loginLabel: "Log in",
    loginLink: "https://app.upstreem.ai/signup?mode=login",
    signupLabel: "Start for free",
    signupLink: "https://app.upstreem.ai/signup",
    newTab: true,
    maxWidth: 1440,
    sidePadding: 64,
    rails: true,
}

addPropertyControls(UpstreemTopbar, {
    logo: { type: ControlType.Image, title: "Logo" },
    logoLink: { type: ControlType.Link, title: "Logo link" },
    platformLabel: { type: ControlType.String, title: "Menu 1" },
    platform: { type: ControlType.Array, title: "Menu 1 items", control: EINTRAG },
    resourcesLabel: { type: ControlType.String, title: "Menu 2" },
    resources: { type: ControlType.Array, title: "Menu 2 items", control: EINTRAG },
    pricingLabel: { type: ControlType.String, title: "Link label" },
    pricingLink: { type: ControlType.Link, title: "Link" },
    loginLabel: { type: ControlType.String, title: "Login label" },
    loginLink: { type: ControlType.Link, title: "Login link" },
    signupLabel: { type: ControlType.String, title: "CTA label" },
    signupLink: { type: ControlType.Link, title: "CTA link" },
    newTab: { type: ControlType.Boolean, title: "New tab", enabledTitle: "Yes", disabledTitle: "No" },
    maxWidth: { type: ControlType.Number, title: "Max width", min: 600, max: 2000, step: 10, unit: "px" },
    sidePadding: { type: ControlType.Number, title: "Side padding", min: 0, max: 200, step: 1, unit: "px" },
    rails: { type: ControlType.Boolean, title: "Grid lines", enabledTitle: "Show", disabledTitle: "Hide" },
})
