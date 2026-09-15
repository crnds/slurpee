# Design System: Slurpee Map Thailand

A web app that maps every 7-Eleven in Thailand serving Slurpee. The design language is
"brain-freeze joy, engineered" — playful, icy, and sugar-rush energetic on the surface,
disciplined and premium underneath. The fun comes from shape, motion, and the Cup Trio —
the three Slurpee cup-size colours — not from painting everything neon.

## 1. Visual Theme & Atmosphere

Think of a cup of frozen Coke on a Bangkok sidewalk at 35°C: the cup is white and clean,
the frozen swirl inside is where all the colour lives. The interface works the same way.

- **Canvas:** cool, near-neutral off-white. Not blue-tinted — blue is now a *meaning* in this
  system (see §2), so the neutrals stay out of its way. Air-conditioned 7-Eleven interior, not beach bar.
- **Fun is structural, not decorative:** oversized rounded corners, bouncy spring motion, wiggly micro-interactions, and playful flavour-name copy do the heavy lifting. Colour stays rationed.
- **Density:** 4/10 — Daily App Balanced. Generous whitespace around map chrome; the map itself carries the information density.
- **Variance:** 7/10 — Offset Asymmetric. Hero and panels lean left, float, and break the grid. Never a centered wall of content.
- **Motion:** 7/10 — Fluid CSS verging on cinematic. Springs everywhere, staggered reveals, perpetual gentle float on idle elements.

The vibe: a frozen-treat treasure hunt. Every screen should feel like opening the freezer
door — a little cold blast of delight.

## 2. Colour Palette & Roles

### The Ice Base (~88% of the UI)

- **Freezer Frost** (`#F5F6F8`) — Primary app background. Cool off-white, no hue. Never pure white pages, never warm gray.
- **Cup White** (`#FFFFFF`) — Cards, bottom sheets, popovers, the search bar. Clean cup plastic.
- **Slush Ink** (`#1B2029`) — Primary text. Deep charcoal (off-black, never `#000000`). Reads cold, prints friendly.
- **Melted Gray** (`#606973`) — Secondary text, metadata, distances, opening hours.
- **Frost Line** (`rgba(27, 32, 41, 0.08)`) — 1px borders, dividers, card outlines. Structural, nearly invisible.
- **Shadows** are ink-tinted, never hue-tinted: `0 8px 24px rgba(27, 32, 41, 0.07)`.

### The Cup Trio (~12% of the UI)

The three Slurpee cup sizes *are* the brand. S is pink, M is lime, L is blue — that is the
whole accent system. The 60/20/20 split below is a ratio **within** this 12%, not of the
screen. Pink leads; lime and blue are specialists that only show up when their meaning applies.

| | Name | Hex | Share | Owns |
|---|---|---|---|---|
| **S** | Shock Pink | `#FF009E` | 60% | Interaction and brand. CTAs, active state, focus rings, the "you are here" pulse, selected rows, one underline per headline max. Pink means *you did this*. |
| **M** | Sour Lime | `#99C915` | 20% | Availability. Slurpee confirmed, machine up, open now. Lime means *the world is good*. |
| **L** | Deep Freeze Blue | `#0FA4E2` | 20% | Data and place. Map layer, distance, coordinates, links, informational chrome. Blue means *here is a fact*. |

**Never put two of the three in the same component.** A card is a pink card or a lime card.
The trio reads as a system because each colour has one job, not because they appear together.

### Derived inks (required — the brand hexes are not text colours)

Against Cup White, the raw brand colours measure 3.65:1 (pink), 1.94:1 (lime) and 2.83:1
(blue). Only pink clears the 3:1 bar for UI components and large text; none clears AA 4.5:1
for body copy. So each hue carries a darkened ink twin, and the rule is mechanical:

| Token | Hex | On white | Use for |
|---|---|---|---|
| `--accent` | `#FF009E` | 3.65:1 | Surfaces only — fills, rings, dots, tints, the sonar pulse |
| `--accent-deep` | `#D6008A` | 5.0:1 | Any fill that carries white text (primary buttons) |
| `--accent-press` | `#B00072` | — | Pressed state |
| `--accent-ink` | `#C4007A` | 5.7:1 | Pink *text* on a light background |
| `--lime` | `#99C915` | 1.94:1 | Surfaces only — status fills, dots, 16% tints |
| `--lime-ink` | `#5C7A0D` | 5.0:1 | Lime *text* on a light background |
| `--blue` | `#0FA4E2` | 2.83:1 | Surfaces only — dots, map accents, 10% tints |
| `--blue-ink` | `#0A6E99` | 5.7:1 | Blue *text*, links, deep-blue category dots |

Yes, this means the primary button is `#D6008A` rather than `#FF009E`. A 15px semibold
label on the brand hex is a real accessibility failure, and a 4% hue shift nobody will
consciously notice is the right price to pay. The brand hex still does the loud work
everywhere it isn't sitting under text.

### The five-swatch ladder (category dots and product pills only)

Five product categories, three hues — so the dots ladder through the trio rather than
inventing new colours. Reserved for pin-base dots and the detail panel's product pills.
Never for buttons, links, backgrounds, or body text.

`AC` All Café → `--blue-ink` · `KS` Kudsan → `--accent-deep` · `BS` bakery → `--accent` ·
`VF` fresh produce → `--lime` · `FP` Food Place → `--blue`

### Status

- **Slurpee confirmed / open** → Sour Lime fill, `--lime-ink` text.
- **Unconfirmed / machine down** → Melted Gray. Never red — red is not in this palette.
- **There is no fourth hue.** Warnings and errors are carried by icon plus copy in Slush Ink
  or `--accent-ink`, not by an amber that isn't in the brand. If a state seems to need a new
  colour, it needs better copy instead.

Status is always paired with text, never colour alone.

### The cup-art exception

`assets/cups/cup_*.png` — sixteen coloured cup sprites, hash-assigned per branch so a given
7-Eleven always gets the same cup — are **product imagery, not chrome**. They are the one
place in this system where colour runs completely free, and that is the whole point: the
interface around them is near-monochrome *precisely so* the cups carry the colour. Keep
everything within roughly one pin-radius of the art neutral — no coloured halos, no tinted
cluster backgrounds, no coloured labels touching a cup.

### Banned

Purple-to-blue gradients, neon glows, rainbow backgrounds, any fourth hue, the brand pink
under white text, a full-bleed background in any of the three, and two of the three inside
one component.

## 3. Typography Rules

All six families are vendored into `assets/fonts/` and declared in `assets/fonts.css`. The
page makes **no external font request at runtime** — not on GitHub Pages, not over `file://`.
Adding a `<link>` to `fonts.googleapis.com` is a regression, not a shortcut.

- **English headers:** `Chango` — the poster voice. Fat, slab-ish, unapologetic; the word on the cup, not the word in the manual. Scoped to headers whose content is English: the sidebar logotype and empty-state headlines. Token: `--font-display-en`.
  - Ships **one weight (400)**. Never set 500/600 on it — the browser will synthesise a fake bold and the counters fill in.
  - **No negative tracking.** Fredoka wants `-0.01em`; Chango at `-0.01em` closes its own counters. Set `letter-spacing: 0`.
  - Runs visually heavier than Fredoka at equal size — step the size *down* roughly one notch when converting a heading (the sidebar `h1` went `1.5rem → 1.375rem`).
  - **Latin-only.** It has no Thai glyphs, so it must never be the face for a Thai header. Any header carrying `.th` opts back out to `--font-display-th` — that rule lives in `style.css` and is not optional.
- **Thai headers:** `Itim` — Chango's Thai counterpart. Same poster job, same single weight (400), same "word on the cup" energy, but with real Thai glyphs. Scoped via the `.th` class on the same headers that would otherwise carry `--font-display-en`: the sidebar logotype when the language switch is set to Thai, and Thai empty-state headlines. Token: `--font-display-th`. Carries Latin glyphs too, so a mixed-script header falls through cleanly rather than tofu-ing.
- **Thai & mixed body headlines, display accents:** `Fredoka` — the Slurpee voice. Soft, rounded, chunky; looks like it was piped out of the machine. Weights 500–600 only (700 gets blobby). Track slightly tight (`-0.01em`). Still owns the store-name headings (real 7-Eleven branch names, always Thai, never a page header), the search placeholder, the loader copy, and flavour callouts. Token: `--font-display`.
- **Body / UI:** `Outfit` — clean geometric sans that shares Fredoka's roundness without competing. Weight 400 for body, 500 for labels, 600 for button text. Line height 1.6, max 65 characters per line.
- **Mono / Data:** `Geist Mono` — distances (`1.2 km`), store counts, coordinates, machine status codes. Tabular numerals on. High-density map sidebar data always in mono.
- **Thai support:** pair `Fredoka`/`Outfit` with `IBM Plex Sans Thai` as the fallback stack. Same weights, generous line height (1.7) — Thai diacritics need the breathing room. Chango sits ahead of Fredoka in `--font-display-en` purely as a per-glyph safety net; if Thai ever lands in an English header, it falls through cleanly rather than tofu-ing.
- **Scale:** `clamp()`-driven — Display `clamp(2.25rem, 5vw, 4rem)`, H2 `clamp(1.5rem, 3vw, 2.25rem)`, Body `1rem`, Caption/Mono `0.8125rem`.
- **Banned:** Inter, system-ui defaults, generic serifs, ALL-CAPS Fredoka (turns into shouting bubble letters), faux-bold Chango, Chango anywhere in body copy or on a Thai string.

## 4. Component Stylings

**Buttons** — the "pull the lever" moment:
- Primary: `--accent-deep` fill, Cup White text, fully rounded (`999px` pill — like a dome lid), no shadow at rest. On press: tactile `-1px` translate + darken to `--accent-press`, like pushing the machine's dispense button. No glows, no gradients.
- Secondary: Cup White fill, 1.5px Frost Line border, Slush Ink text. Same press physics.
- Destructive/quiet: ghost, Melted Gray text, underline on hover.
- All buttons minimum `44px` tall. Icon + text, never icon-only in primary actions.
- One pink CTA per screen. Two is the absolute ceiling, and the second had better be in a sheet.

**Map Pins** — the stars of the show:
- Store pins are the **cup art**: a `cup_*.png` sprite with an ink drop-shadow, no coloured ring, no tint. The sprite is the colour; the pin adds none.
- Active/selected pin: Shock Pink glow (`drop-shadow(0 0 5px)`) and a spring pop from `1 → 1.15`. Pink marks *your* selection, which is exactly its job.
- Unconfirmed store: same cup, Melted Gray glow, reduced opacity. Grayed out, never recoloured.
- Category dots: 3px dots tucked at the pin's base, up to five, from the ladder in §2. This and the product pills are the only places the ladder appears.
- Low-zoom dots (canvas layer, below the cup threshold): Cup White fill, 2px ring. The ring encodes *availability*, so it belongs to lime, not pink — `--lime-ink` when Slurpee is confirmed, Melted Gray when not. Use the ink twin, not raw `--lime`: a 2px ring at 1.9:1 disappears on a pale basemap, and at national zoom this layer is 2,600 dots — the single largest colour surface in the app. Pink here would flood the map and strip the accent of its meaning.

**Cards & Panels:**
- Store cards (map sidebar / bottom sheet): Cup White, `1.5rem` corner radius, Frost Line border, ink-tinted shadow (`0 8px 24px rgba(27, 32, 41, 0.07)`) — never a hue-tinted shadow, that was the old blue-shadow habit and it fights the blue accent.
- Distance + open status in Geist Mono at the card's top edge; availability tags as small pills — 16% lime tint with `--lime-ink` text (`.tag-yes`), or 10% gray tint with Melted Gray text (`.tag-no`).
- Product-category pills carry their ladder hue as a **14% tint background only**; the label stays Slush Ink. Five readable ink-grade swatches do not exist across three hues, and three near-identical pinks in 13px type is worse than no hue at all. The word is the information; the tint is reinforcement.
- High-density lists: skip cards entirely — Frost Line top dividers + negative space instead. Selected row gets an 8% Shock Pink tint, nothing more.

**Search Bar** — "Find your freeze":
- Floating over the map, Cup White, full pill radius, soft ink-tinted shadow. Prefix straw icon in Shock Pink. Placeholder copy in Fredoka 500: "Where's your nearest Slurpee?"
- Focus: border goes Shock Pink, shadow deepens. Suggestions drop down as a Cup White sheet with staggered 40ms-per-row entrance.

**Language Switch** — top-right corner, alongside the zoom controls: a two-segment pill (`EN` / `TH`) in the same Cup White + Frost Line chrome as `.ctl`. The active segment gets the `--accent-deep` fill with white text (same physics as a primary button); the inactive segment is Melted Gray on Cup White. No third state, no flag icons — text only. Switching re-renders the sidebar logotype (Chango ⇄ Itim, DESIGN.md §3) and every chrome string; branch data (names, addresses, product labels) is already authentically Thai and never re-translates.

**Inputs:** label above, Frost Line border, focus ring in Shock Pink (2px, offset 2px). Error text below in `--accent-ink`, never toast-only.

**Links:** Slush Ink at rest, `--blue-ink` on hover — a link is a fact you're going to go read, so it belongs to blue, not to pink.

**Loaders:** skeletal shimmer shaped exactly like store cards/pins — a slushy shimmer gradient sweeping left-to-right (Frost → Cup White → Frost). No circular spinners anywhere. The loader cup icon is Shock Pink. Map tiles loading: subtle Frost-coloured pulse.

**Empty States:** composed, not text-only. Example — no stores nearby: a Fredoka headline ("Brain freeze drought!"), a line-drawn cup with a 10% blue slush fill, a pink straw, and three trio-coloured bubbles, then one pink CTA ("Widen the search"). Always give the user a next action.

**Bottom Sheet (mobile):** draggable, Cup White, `1.5rem` top radius, pill grab handle in Frost Line colour. Snaps to peek / half / full. Store details live here.

## 5. Layout Principles

- **The map is the app.** Full-viewport map (`min-h-[100dvh]` — never `h-screen`, iOS Safari will jump). All chrome floats above it: search bar top-center, sidebar left on desktop, bottom sheet on mobile.
- **Desktop:** 380px floating sidebar on the left (offset `1.5rem` from edges, not flush-docked), map fills the rest. Asymmetric by construction.
- **Mobile (< 768px):** sidebar collapses to the draggable bottom sheet. Search bar full-width with `1rem` gutters. Zero horizontal overflow — critical failure if present.
- **Hero / landing (if used):** left-aligned split — Fredoka headline with an inline cup image embedded at type-height between words, map teaser on the right. Never centered.
- **Grid:** CSS Grid only, `1400px` max-width containment for any non-map pages, `clamp(3rem, 8vw, 6rem)` vertical section rhythm.
- **Banned:** 3-equal-card feature rows, overlapping absolute-positioned content stacks, `calc()` percentage hacks.

## 6. Motion & Interaction

- **Spring physics everywhere:** `stiffness: 100, damping: 20` default. Pins pop, sheets slide, buttons compress — everything has weight and bounce, like slush settling in a cup. No linear easing, ever.
- **Staggered orchestration:** sidebar store lists cascade in with 40ms delays. Never mount a list instantly.
- **Perpetual micro-life:** the "You are here" dot emits a slow Shock Pink sonar ring; the search bar straw icon does a 6s idle wiggle; the hero cup turns forever. Motion amplitude stays tiny — alive, not distracting.
- **Product pill hover:** pills do a 2° tilt-and-bounce, like they're jiggling in syrup.
- **Performance:** animate `transform` and `opacity` only. Never `top/left/width/height`. Map markers animate via transforms on a dedicated layer.
- **Reduced motion:** honour `prefers-reduced-motion` — springs become 150ms fades, perpetual loops stop, the three.js hero never loads at all.

## 7. Anti-Patterns (Banned)

- No emojis anywhere in UI copy — the flavour names carry the fun
- No Inter font; no generic system sans for display type
- No pure black (`#000000`) — Slush Ink is as dark as it gets
- No neon glows, outer-glow shadows, or purple/blue neon gradients
- **No fourth hue.** Three colours, three meanings. A new state gets better copy, not a new swatch
- **Pink is the only CTA colour**, and at most two pink elements live on a screen at once
- **Never two of the trio in one component** — no pink button with a lime icon, no blue card with a pink border
- **Never the raw brand hexes as text.** `#FF009E`, `#99C915` and `#0FA4E2` are surface colours; use the `-ink` twins
- No hue-tinted shadows — shadows are ink, always
- The cup sprites are the **only** sanctioned rainbow; the ladder in §2 is quarantined to pin dots and product pills
- No centered Hero layouts, no 3-column equal card grids
- No overlapping elements — every element owns its spatial zone
- No AI copywriting clichés ("Elevate", "Seamless", "Unleash") — write like a Slurpee: "Brain freeze, incoming."
- No filler UI ("Scroll to explore", bouncing chevrons, scroll arrows)
- No generic placeholder names or fake stats — real 7-Eleven branch data, real Thai province names
- No circular spinners, no floating labels, no custom mouse cursors
- No broken stock-photo links — illustrations or `picsum.photos` only

## 8. Brand Voice Quick Reference

Copy should sound like the cup talks: short, cold, cheeky.

- Button: "Find my freeze" — not "Search locations"
- Empty: "Machine's napping" — not "Currently unavailable"
- Success: "Slurpee locked in" — not "Location saved"
- Thai flavour names get top billing where they exist (Mango Tango > Mango)
- Sizes are S, M and L — and they're pink, lime and blue. If you're naming a colour in copy, name the cup

Three colours. Three jobs. A brain freeze of joy in every interaction — but a freezer, not a
fireworks factory.
