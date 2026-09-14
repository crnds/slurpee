# Design System: Slurpee Map Thailand

A web app that maps every 7-Eleven in Thailand serving Slurpee. The design language is
"brain-freeze joy, engineered" — playful, icy, and sugar-rush energetic on the surface,
disciplined and premium underneath. The fun comes from shape, motion, and one confident
hit of Slurpee Red — not from painting everything neon.

## 1. Visual Theme & Atmosphere

Think of a cup of frozen Coke on a Bangkok sidewalk at 35°C: the cup is white and clean,
the frozen swirl inside is where all the color lives. The interface works the same way.

- **Canvas:** cool, frosty, mostly-white with a faint ice-blue tint — air-conditioned 7-Eleven interior, not beach bar.
- **Fun is structural, not decorative:** oversized rounded corners, bouncy spring motion, wiggly micro-interactions, and playful flavor-name copy do the heavy lifting. Color stays rationed.
- **Density:** 4/10 — Daily App Balanced. Generous whitespace around map chrome; the map itself carries the information density.
- **Variance:** 7/10 — Offset Asymmetric. Hero and panels lean left, float, and break the grid. Never a centered wall of content.
- **Motion:** 7/10 — Fluid CSS verging on cinematic. Springs everywhere, staggered reveals, perpetual gentle float on idle elements.

The vibe: a frozen-treat treasure hunt. Every screen should feel like opening the freezer
door — a little cold blast of delight.

## 2. Color Palette & Roles

**The Ice Base (90% of the UI):**

- **Freezer Frost** (`#F4F8FB`) — Primary app background. Cool off-white with a whisper of ice blue. Never pure white pages, never pure gray.
- **Cup White** (`#FFFFFF`) — Cards, bottom sheets, popovers, the search bar. Clean cup plastic.
- **Slush Ink** (`#1B2733`) — Primary text. Deep blue-charcoal (off-black, never `#000000`). Reads cold, prints friendly.
- **Melted Gray** (`#5C6B7A`) — Secondary text, metadata, distances, opening hours.
- **Frost Line** (`rgba(27, 39, 51, 0.08)`) — 1px borders, dividers, card outlines. Structural, nearly invisible.

**The One Accent (used sparingly, ~8% of the UI):**

- **Slurpee Red** (`#E8402A`) — THE brand hit. Primary CTA buttons, the "You are here" pulse, active nav state, focus rings, one underline per headline max. Saturation held at ~78% so it feels like cherry syrup, not an alarm. This red should be earned — if a screen has more than 3 red elements, remove some.

**Flavor Swirl Palette (map layer + data only, ~2% of the UI):**

Reserved EXCLUSIVELY for map pins, flavor tags, and availability indicators. Never for
buttons, links, backgrounds, or body text.

- **Cola Freeze** (`#3E2C23`) — deep cola brown
- **Blue Raspberry** (`#3D8BFD`) — electric slush blue
- **Green Apple** (`#5FBF4A`) — sour-apple green
- **Strawberry Swirl** (`#F2768F`) — soft pink
- **Mango Tango** (`#F5A623`) — Thai mango amber (a nod to local flavors)

**Status colors:** Open = Green Apple, Closing soon = Mango Tango, Machine down = Melted
Gray. Status is always paired with text, never color alone.

**Banned:** purple-to-blue gradients, neon glows, rainbow backgrounds, Slurpee Red on
full-bleed backgrounds, more than one accent hue in the chrome layer.

## 3. Typography Rules

- **Display / Headlines:** `Fredoka` (Google Fonts) — the Slurpee voice. Soft, rounded, chunky; looks like it was piped out of the machine. Weights 500–600 only (700 gets blobby). Track slightly tight (`-0.01em`). Used for page titles, empty-state headlines, and flavor callouts — NOT body text.
- **Body / UI:** `Outfit` — clean geometric sans that shares Fredoka's roundness without competing. Weight 400 for body, 500 for labels, 600 for button text. Line height 1.6, max 65 characters per line.
- **Mono / Data:** `Geist Mono` — distances (`1.2 km`), store counts, coordinates, machine status codes. Tabular numerals on. High-density map sidebar data always in mono.
- **Thai support:** pair `Fredoka`/`Outfit` with `IBM Plex Sans Thai` as the fallback stack. Same weights, generous line height (1.7) — Thai diacritics need the breathing room.
- **Scale:** `clamp()`-driven — Display `clamp(2.25rem, 5vw, 4rem)`, H2 `clamp(1.5rem, 3vw, 2.25rem)`, Body `1rem`, Caption/Mono `0.8125rem`.
- **Banned:** Inter, system-ui defaults, generic serifs, ALL-CAPS Fredoka (turns into shouting bubble letters).

## 4. Component Stylings

**Buttons** — the "pull the lever" moment:
- Primary: Slurpee Red fill, Cup White text, fully rounded (`999px` pill — like a dome lid), no shadow at rest. On press: tactile `-1px` translate + slight darkening (`#D13320`), like pushing the machine's dispense button. No glows, no gradients.
- Secondary: Cup White fill, 1.5px Frost Line border, Slush Ink text. Same press physics.
- Destructive/quiet: ghost, Melted Gray text, underline on hover.
- All buttons minimum `44px` tall. Icon + text, never icon-only in primary actions.

**Map Pins** — the stars of the show:
- Store pins: Cup White circle with 2px Slurpee Red ring, tiny straw icon inside. Active/selected pin: fills with Slurpee Red, scales `1 → 1.15` with a spring pop.
- Flavor availability: 3px flavor-swirl dots tucked at the pin's base — up to 4, in Flavor Palette colors. This is where the rainbow is allowed to live, and ONLY here.
- Cluster pins: Slurpee Red circle, Cup White Geist Mono count, gentle idle pulse (`scale 1 → 1.04 → 1`, 3s loop) so the map always feels alive.

**Cards & Panels:**
- Store cards (map sidebar / bottom sheet): Cup White, `1.5rem` corner radius, Frost Line border, shadow tinted ice-blue (`0 8px 24px rgba(61, 139, 253, 0.08)`), never gray-black shadows.
- Distance + open status in Geist Mono at the card's top edge; flavor tags as small pills with 8% flavor-color tint backgrounds.
- High-density lists: skip cards entirely — Frost Line top dividers + negative space instead.

**Search Bar** — "Find your freeze":
- Floating over the map, Cup White, full pill radius, soft ice-tinted shadow. Prefix straw icon. Placeholder copy in Fredoka 500: "Where's your nearest Slurpee?"
- Suggestions drop down as a Cup White sheet with staggered 40ms-per-row entrance.

**Inputs:** label above, Frost Line border, focus ring in Slurpee Red (2px, offset 2px). Error text below in Slurpee Red, never toast-only.

**Loaders:** skeletal shimmer shaped exactly like store cards/pins — a slushy shimmer gradient sweeping left-to-right (Frost → Cup White → Frost). No circular spinners anywhere. Map tiles loading: subtle Frost-colored pulse.

**Empty States:** composed, not text-only. Example — no stores nearby: a Fredoka headline ("Brain freeze drought!"), a melting-cup illustration in Flavor Swirl colors, one Slurpee Red CTA ("Widen the search"). Always give the user a next action.

**Bottom Sheet (mobile):** draggable, Cup White, `1.5rem` top radius, pill grab handle in Frost Line color. Snaps to peek / half / full. Store details live here.

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
- **Perpetual micro-life:** cluster pins pulse softly; the "You are here" dot emits a slow Slurpee Red sonar ring; the search bar straw icon does a 6s idle wiggle. Motion amplitude stays tiny — alive, not distracting.
- **Flavor tag hover:** tags do a 2° tilt-and-bounce, like they're jiggling in syrup.
- **Performance:** animate `transform` and `opacity` only. Never `top/left/width/height`. Map markers animate via transforms on a dedicated layer.
- **Reduced motion:** honor `prefers-reduced-motion` — springs become 150ms fades, perpetual loops stop.

## 7. Anti-Patterns (Banned)

- No emojis anywhere in UI copy — the flavor names carry the fun
- No Inter font; no generic system sans for display type
- No pure black (`#000000`) — Slush Ink is as dark as it gets
- No neon glows, outer-glow shadows, or purple/blue neon gradients
- No rainbow chrome — Flavor Swirl colors are quarantined to pins, tags, and status
- No Slurpee Red used decoratively or on more than 3 elements per screen
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
- Thai flavor names get top billing where they exist (Mango Tango > Mango)

One accent. One voice. A brain freeze of joy in every interaction — but a freezer, not a
fireworks factory.
