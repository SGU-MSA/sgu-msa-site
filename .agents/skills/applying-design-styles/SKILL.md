---
name: applying-design-styles
description: Describes 43 named frontend design styles (claymorphism, glassmorphism, neo-brutalism, bento grid, Swiss, Y2K, cyberpunk, Art Deco, wabi-sabi and more) with each style's signature moves, type, palette, brand fit and a CSS recipe. Use when choosing a visual direction for a UI, matching a look to a brand, building in a style the user names, or showing and comparing style options. Not for the end-to-end workflow of building or restyling a page, section, admin screen or component (use designing-ui-components, which calls this skill for its style shortlist).
license: Unlicense (see NOTICE)
metadata:
  vendored: "true"
  source: maintainer-authored (claude.ai skill)
---

# Applying design styles

A catalog of 43 visual styles. Each entry gives the look, the moves that make it recognizable, type and palette, brand fit, and a recipe: the few declarations that produce the effect.

## Workflow

1. **Read the brand.** State in one line who the product is for and how it should feel. An existing brand, design system or site overrides this catalog; a style only fills what is undecided.
2. **Pick the style.**
   - User named a style: go to its entry. If it is not in the catalog, write an entry for it in the same five fields first.
   - No style named: shortlist two or three from the chooser and offer them with one line of reasoning each.
3. **Build from the entry.** Apply the moves, type and palette; start from the recipe. Keep the brand's own color as the accent and its own words and imagery as the content.
4. **Check.** Run the guardrails below. Fix and re-check until all pass.
5. **Say what was chosen.** Name the style and the two or three moves used, so the user can redirect.

## Chooser

| The brand should feel | Reach for | Usually wrong |
|---|---|---|
| Friendly, playful | Claymorphism, Bento grid, Kawaii, Corporate Memphis | Victorian, Cybercore |
| Premium, calm | Minimalism, Luxury typography, Glassmorphism | Maximalism, Pixel art |
| Trustworthy, institutional | Swiss design, Material Design, Flat design | Y2K, Grunge zine |
| Modern tech product | Dark-mode SaaS, Aurora gradient, Bento grid, Isometric 3D | Victorian, Scrapbook |
| Bold, irreverent, youth-facing | Neo-brutalism, Maximalism, Y2K, Memphis | Wabi-sabi, Luxury typography |
| Technical, edgy | Cyberpunk, Cybercore, Terminal, Brutalism | Bohemian, Kawaii |
| Nostalgic, fun | Pixel art, Synthwave, Vaporwave, Frutiger Aero, 70s retro | Swiss design |
| Warm, personal, handmade | Scrapbook, Bohemian, Conceptual sketch | Cyberpunk, Neumorphism |
| Quiet, natural | Wabi-sabi, Ethereal, Minimalism | Maximalism, Neo-brutalism |
| Cultural, fashion, storytelling | Editorial design, Luxury typography, Surrealism | Neumorphism |
| Heritage, craft, ceremony | Victorian, Art Deco, Art Nouveau, Dark academia | Y2K, Cybercore |
| Retro-modern, design-led | Bauhaus, Mid-century modern, Swiss design | Grunge zine |

**Product UI and dashboards:** use Minimalism, Swiss, Flat, Material, Bento grid, Dark-mode SaaS, Glassmorphism, Claymorphism or Neo-brutalism. The other styles are for heroes, landing pages, covers and campaigns; keep the working UI under them simpler.

## Combining styles

- One lead style sets structure and surface. Add at most one supporting style as an accent.
- A layout style (Bento, Swiss, Editorial) combines well with a surface style (Glass, Clay, Aurora). Two surface styles compete.
- Works: Bento + Glassmorphism; Swiss + Minimalism; Editorial + Luxury typography; Dark-mode SaaS + Aurora gradient; Cyberpunk + Cybercore; Wabi-sabi + Minimalism.
- Fights: Neumorphism + Neo-brutalism; Minimalism + Maximalism; Swiss + Victorian.

## Guardrails

- **Contrast:** body text at 4.5:1 or better. Neumorphism, Glassmorphism, Ethereal, Kawaii and Luxury typography fail most often; darken the text or make the panel more opaque.
- **State:** every control has a visible focus ring and a clear pressed or selected state. Shadow alone is not enough.
- **Display faces stay large:** script, pixel, techno and condensed faces are for headings only. Body text uses a plain face.
- **Motion:** any blink, glitch, glow or color-cycle animation is switched off under `prefers-reduced-motion`.
- **Fonts:** entries name Google Fonts families. Load the ones used and keep a fallback stack.
- **Imagery:** Surrealism, Editorial, Scrapbook and Luxury typography need real photographs. Ask for them or say placeholders are in use.

## Showing a style and finding references

- **Demonstrate:** render a tile about 240px tall under one root class per style. To compare options, render two or three tiles with the same content.
- **Full working examples:** the user's "Design Style Specimens" artifact (https://claude.ai/artifact/LsXeoicarSPpmh84BywmK5) holds complete HTML, CSS and SVG for all 43 styles. Read it with the Artifact tool when that tool is available; otherwise build from the recipe.
- **Real-world references:** search images or the web for the style name plus the product type (for example "neo-brutalism fintech dashboard"). Tell the user which traits are being borrowed. Do not copy a specific site's layout, logo or artwork.
- **Drawing-led styles** (Art Nouveau, Mid-century modern, Corporate Memphis, Conceptual sketch, Wabi-sabi, Psychedelic 60s) are built as inline SVG. Isometric 3D uses CSS 3D transforms.

Aliases: neo-brutalism = new brutalism = neubrutalism; neumorphism = soft UI; Swiss design = International Typographic Style; synthwave = outrun = retrowave; Corporate Memphis = Alegria style; Art Nouveau = Jugendstil.

## Catalog: depth and surface

The interface is made of a material; light and shadow do the work.

### Claymorphism
- **Look:** puffy, inflated shapes like soft clay; friendly and toy-like.
- **Moves:** radii of 24-40px; one outer shadow plus two inset shadows (light top-left, dark bottom-right); pastel surface with one saturated accent; chunky rounded type.
- **Type and palette:** Nunito or Baloo 2 at 800. #e9e4f5 ground, #f4f0ff surface, #7c6cf0 primary, #ff8a7a accent.
- **Fit:** kids' and learning apps, onboarding, playful SaaS. **Avoid:** dense data, enterprise or legal tools.
- **Recipe:** `border-radius:32px; background:#f4f0ff; box-shadow:12px 12px 28px #b9b0d6, inset -6px -6px 12px #cfc6ea, inset 6px 6px 12px #fff`

### Glassmorphism
- **Look:** frosted translucent panels over a colorful blurred background.
- **Moves:** backdrop blur on a semi-transparent fill; 1px light border; vivid gradient or color orbs behind; two or three depth layers at most.
- **Type and palette:** Plus Jakarta Sans or Manrope. #a8c0ff, #f5c6ec, #b8f1e0 background; #1f2340 text.
- **Fit:** health and weather dashboards, overlays, media players. **Avoid:** long text on glass, low-end devices, busy photo backgrounds.
- **Recipe:** `background:rgba(255,255,255,.28); backdrop-filter:blur(16px) saturate(160%); border:1px solid rgba(255,255,255,.6); border-radius:22px`

### Neumorphism
- **Look:** controls extruded from, or pressed into, the same surface as the background.
- **Moves:** element and background share one color; paired dark and light shadows; inset shadows for pressed states; one small color accent.
- **Type and palette:** Poppins 400-600 in mid-grey. #e4e8ee surface, #bcc3ce shadow, #fff highlight, #4a7dff accent.
- **Fit:** smart-home and device controls, music players, concept work. **Avoid:** accessibility-critical UI unless states also get color or a border.
- **Recipe:** `background:#e4e8ee; box-shadow:9px 9px 18px #bcc3ce, -9px -9px 18px #fff` (add `inset` to both shadows for pressed)

### Skeuomorphism
- **Look:** interfaces that imitate real objects: metal, leather, knobs, stitching.
- **Moves:** realistic textures and lighting; controls modelled on physical ones; layered gradients, bevels and cast shadows; engraved labels.
- **Type and palette:** Helvetica in small engraved caps. #3a2a20 leather, #d9d9d9 to #a9a9a9 metal, #2ecc40 LED.
- **Fit:** audio tools, instrument and calculator apps, games. **Avoid:** content-heavy apps; slow to build and keep consistent.
- **Recipe:** `background:conic-gradient(#f5f5f5,#8c8c8c,#f5f5f5,#8c8c8c,#f5f5f5); border-radius:50%; box-shadow:0 5px 9px rgba(0,0,0,.55), inset 0 0 0 4px #c4c4c4` (brushed-metal knob); labels `text-shadow:0 1px 0 #fff`

### Material Design
- **Look:** Google's paper-like surfaces stacked at set elevations, with bold color.
- **Moves:** elevation shown by soft shadow or tonal color; a floating action button for the main action; rounded shapes and large touch targets; color roles from one seed color.
- **Type and palette:** Roboto 400-500. #f3edf7 surface, #6750a4 primary, #eaddff container, #1d1b20 text.
- **Fit:** Android apps, productivity tools, admin panels. **Avoid:** brands needing a distinct identity; it looks like a Google product by default.
- **Recipe:** card `border-radius:12px; background:#fff; box-shadow:0 1px 2px rgba(0,0,0,.3), 0 1px 3px 1px rgba(0,0,0,.15)`; FAB `width:56px; height:56px; border-radius:16px; background:#eaddff`

### Frutiger Aero
- **Look:** the glossy, optimistic tech look of 2004-2013: sky, grass, water, bubbles.
- **Moves:** sky-blue and grass-green gradients; high-gloss buttons with a hard white highlight on the top half; transparent bubbles and lens flares; white humanist type with a soft shadow.
- **Type and palette:** Segoe UI, Frutiger. #1e8fe0 sky, #9be0ff haze, #8fd94f grass, #2f9e1c leaf.
- **Fit:** clean-energy and eco brands, nostalgic tech, playful retro campaigns. **Avoid:** brands that must look current.
- **Recipe:** `background:linear-gradient(rgba(255,255,255,.75),rgba(255,255,255,.12) 50%,transparent 50%), linear-gradient(#5cc72c,#2f9e1c); border-radius:99px; border:1px solid #1f7a12`

### Aurora gradient
- **Look:** soft washes of color drifting into each other behind confident type.
- **Moves:** several large overlapping radial gradients; plain ground showing through; tight heavy sans headline directly on the color; pill buttons.
- **Type and palette:** Manrope or Sora at 600-800, tight tracking. #ffb3d9, #a5b4ff, #7ff0d6, #ffd89c, #1a1f36 ink.
- **Fit:** fintech and developer platforms, SaaS and AI landing pages. **Avoid:** dense interfaces; check contrast over every color.
- **Recipe:** `background:radial-gradient(at 12% 18%,#ffb3d9 0,transparent 46%), radial-gradient(at 88% 12%,#a5b4ff 0,transparent 52%), radial-gradient(at 72% 92%,#7ff0d6 0,transparent 50%), #fff`

### Isometric 3D
- **Look:** solid blocks seen from a fixed three-quarter angle with no perspective.
- **Moves:** everything on one isometric grid; three visible faces in light, mid and dark tones of one color; small scenes that explain a system; flat fills on a soft ground plane.
- **Type and palette:** Poppins or Sora, kept flat beside the scene. #eef1f8 ground, #5b6cff, #37d6a6, #ff7a59, each in three tones.
- **Fit:** SaaS and infrastructure explainers, fintech, onboarding illustrations. **Avoid:** photographic or editorial brands.
- **Recipe:** `.scene{transform:rotateX(54.7deg) rotateZ(45deg); transform-style:preserve-3d}` with no `perspective`; top face `transform:translateZ(var(--h))`; side faces as pseudo-elements hinged with `transform-origin:top; transform:rotateX(-90deg)` and `transform-origin:left; transform:rotateY(90deg)`

## Catalog: structure and type

The grid and the typeface carry the brand; decoration is nearly absent.

### Bento grid
- **Look:** content packed into a tidy grid of rounded tiles of different sizes.
- **Moves:** tiles spanning different rows and columns; uniform gap and radius; one idea per tile; one or two tiles in strong color.
- **Type and palette:** Outfit or Manrope with bold numerals. #f3f1ec ground, #1d1d1f hero tile, #c8b6ff, #ffd6a5.
- **Fit:** feature overviews, landing pages, portfolios, dashboards. **Avoid:** content whose order matters.
- **Recipe:** `display:grid; grid-template-columns:repeat(3,1fr); gap:10px`; tiles `border-radius:18px`; hero tile `grid-column:span 2; grid-row:span 2`

### Editorial design
- **Look:** a web page laid out like a magazine spread.
- **Moves:** oversized condensed headline mixed with an italic serif; masthead rules, issue numbers, drop caps; multi-column text; strong scale contrast.
- **Type and palette:** Anton or Bebas Neue with Newsreader or Playfair Display. #f1ece2 paper, #151515 ink, #c8321e accent.
- **Fit:** fashion, culture and music brands, long-form stories, lookbooks. **Avoid:** utility apps and forms.
- **Recipe:** headline `font:400 50px/.92 Anton`; body `columns:2; column-gap:16px`; `p::first-letter{float:left; font-size:34px; line-height:.85}`; masthead `border-bottom:2px solid`

### Swiss design
- **Look:** a strict grid with flush-left sans-serif type; objective and clear.
- **Moves:** visible mathematical grid, asymmetric and ragged-right; one grotesque typeface in a few sizes; white, black and one primary color; no decoration.
- **Type and palette:** Helvetica, Akzidenz-Grotesk or Inter Tight. #ececec ground, #111 text, #e30613 red.
- **Fit:** corporate identities, museums, architecture, studio portfolios. **Avoid:** brands needing warmth or play.
- **Recipe:** `display:grid; grid-template-columns:repeat(6,1fr)`; headline `grid-column:2/-1; font-weight:500; line-height:1; letter-spacing:-.03em`; footer `border-top:2px solid #111`

### Minimalism
- **Look:** only what is needed, with a great deal of space around it.
- **Moves:** generous whitespace and one focal element per screen; one typeface in two or three sizes; near-monochrome with at most one accent; hairlines and spacing instead of boxes.
- **Type and palette:** Instrument Sans or Geist at 400-500. #fff ground, #111 text, #8a8a8a secondary.
- **Fit:** premium products, portfolios, professional tools. **Avoid:** brands needing energy; weak content just looks empty.
- **Recipe:** `padding:52px 32px; background:#fff; letter-spacing:-.02em`; links `border-bottom:1px solid #111`; no fills, shadows or borders on containers

### Luxury typography
- **Look:** light serif capitals interlaced with a flowing script.
- **Moves:** thin high-contrast serif in wide-tracked capitals; script words overlapping at a much larger size; muted tonal palette; tiny widely spaced supporting text.
- **Type and palette:** Cormorant Garamond 300 with Pinyon Script. #dfe3dc ground, #4d5a3a text; or ivory, black and gold.
- **Fit:** fashion, fragrance, jewellery, weddings, boutique hotels. **Avoid:** body copy and UI labels.
- **Recipe:** caps `font:300 30px 'Cormorant Garamond'; letter-spacing:.06em`; script `font:400 58px/.5 'Pinyon Script'; margin:0 -6px`; caption `font-size:10px; letter-spacing:.42em`

### Flat design
- **Look:** no depth at all: solid color, simple shapes, clear icons.
- **Moves:** solid fills with no gradients, shadows or textures; bright limited palette with color blocks; simple geometric icons; hierarchy from size and color.
- **Type and palette:** Lato or Open Sans. #3498db, #e74c3c, #2ecc71, #f1c40f, #ecf0f1, #2c3e50.
- **Fit:** mobile apps, dashboards, infographics. **Avoid:** leaving clickable elements unmarked; add borders, underlines or hover states.
- **Recipe:** `background:#2ecc71; border:0; border-radius:4px; box-shadow:none; text-transform:uppercase; letter-spacing:.06em`

### Dark-mode SaaS
- **Look:** the polished dark look of modern developer tools.
- **Moves:** near-black ground with one soft colored glow from the top; 1px low-opacity white borders instead of shadows; tight medium-weight sans with a white-to-grey gradient headline; keyboard-shortcut chips.
- **Type and palette:** Inter or Geist at 500-600. #08090a ground, #f7f8f8 text, #8a8f98 muted, #7877ff glow.
- **Fit:** developer tools, productivity software, AI products. **Avoid:** warm consumer brands; add one distinctive detail, since the look is very common.
- **Recipe:** `background:radial-gradient(70% 55% at 50% 0,rgba(120,119,255,.38),transparent),#08090a; border:1px solid rgba(255,255,255,.14)`; headline `background:linear-gradient(#fff,#9a9ca5); background-clip:text; color:transparent; letter-spacing:-.03em`

## Catalog: loud and graphic

High contrast, flat color, deliberate rule-breaking.

### Neo-brutalism
- **Look:** thick black outlines, hard offset shadows, flat saturated color.
- **Moves:** 2-4px black borders on everything; drop shadows with zero blur; clashing brights; buttons that shift into their shadow when pressed.
- **Type and palette:** Archivo Black or Space Grotesk with DM Sans. #ffe14d, #ff6bd6, #7df9c0, #5b8cff, #111.
- **Fit:** creator tools, startups with attitude, portfolios, event pages. **Avoid:** healthcare, finance, calm or premium brands.
- **Recipe:** `border:3px solid #111; border-radius:8px; box-shadow:5px 5px 0 #111`; hover `transform:translate(3px,3px); box-shadow:2px 2px 0 #111`

### Maximalism
- **Look:** layered collage, clashing patterns and colors, every corner filled.
- **Moves:** overlapping stickers, windows and cut-outs; several typefaces and many saturated colors; rotation and overlap; one dominant element as the entry point.
- **Type and palette:** Rubik Mono One, Bungee, a pixel face and a script together. #ff00a8, #00e5ff, #f7ff00, #7a00ff, #111.
- **Fit:** music, art and fashion drops, festivals. **Avoid:** task-focused UI.
- **Recipe:** `background:conic-gradient(#111 25%,#7a00ff 0 50%,#111 0 75%,#7a00ff 0) 0 0/36px 36px`; headline `text-shadow:3px 3px 0 #ff00a8, 6px 6px 0 #00e5ff`; layers `position:absolute; transform:rotate(5deg)`

### Y2K aesthetic
- **Look:** turn-of-the-millennium optimism: chrome lettering, glossy blobs, grids, sparkles.
- **Moves:** liquid-chrome gradient text, often skewed; glossy pills with a white highlight; graph-paper grid, stars and soft 3D blobs; icy blue, silver and hot pink.
- **Type and palette:** Bowlby One or a techno display face. #f2f4fb ground, #c9cfe6 grid, #ff3dbb, #19d3a8, #2b3350.
- **Fit:** fashion and beauty for a young audience, music releases, parties. **Avoid:** formal or long-lived brands.
- **Recipe:** `background:linear-gradient(180deg,#eef2ff,#7f8fb8 40%,#1b2240 50%,#aab8e0 58%,#f6f8ff); background-clip:text; color:transparent; -webkit-text-stroke:1px #2b3350; transform:skew(-8deg) rotate(-5deg)`

### Pixel art
- **Look:** 8-bit and 16-bit game graphics.
- **Moves:** bitmap typeface and no border radius; stepped borders built from box-shadow; palette of 4-16 colors; frame-by-frame animation and game HUD motifs.
- **Type and palette:** Press Start 2P, VT323. #1a1c2c, #29366f, #41a6f6, #ef7d57, #a7f070, #f4f4f4.
- **Fit:** games, dev tools with personality, 404 pages. **Avoid:** long text in bitmap fonts.
- **Recipe:** `font-family:'Press Start 2P'; border-radius:0; box-shadow:0 -4px 0 #f4f4f4, 0 4px 0 #f4f4f4, -4px 0 0 #f4f4f4, 4px 0 0 #f4f4f4; animation:blink 1s steps(2) infinite`; images `image-rendering:pixelated`

### Brutalism
- **Look:** the original web brutalism: unstyled, default and blunt.
- **Moves:** browser defaults on show (Times, Courier, blue underlined links); no radius, shadow or gradient; raw lists, tables and file-index layouts; black on white with one harsh highlight.
- **Type and palette:** Times New Roman, Courier New. #fff, #000, #0000ee.
- **Fit:** art portfolios, galleries, manifestos, independent publishers. **Avoid:** commerce and onboarding; use Neo-brutalism for a friendlier version.
- **Recipe:** `font:16px 'Times New Roman'; background:#fff; color:#000`; links `color:#0000ee; text-decoration:underline`; headings `font:700 21px 'Courier New'; border-bottom:4px solid #000`

### Grunge zine
- **Look:** photocopied punk flyers: cut-out letters, rough black and white, stamps.
- **Moves:** ransom-note lettering with each letter in a different face, size and tilt; black and white plus one spot red; photocopy noise and scan lines; crooked stamps.
- **Type and palette:** Impact, Courier and a serif mixed. #e8e4dc paper, #111, #fff, #c1121f.
- **Fit:** bands and venues, skate and streetwear, zines, event posters. **Avoid:** products that must feel reliable; keep real information in plain text.
- **Recipe:** per letter `padding:2px 8px; background:#111; color:#fff; transform:rotate(-5deg)`, varying face, colors and angle with `:nth-child`; stamp `border:3px solid #c1121f; color:#c1121f; transform:rotate(9deg)`

### Kawaii
- **Look:** Japanese cute: pastels, round shapes, friendly little faces.
- **Moves:** pastel pink, mint and lavender with almost no black; fully rounded shapes and thick soft outlines; dot eyes, tiny smile, blush cheeks; hearts, stars and polka dots.
- **Type and palette:** Fredoka or M PLUS Rounded 1c. #ffe5f1, #ffb3d1, #b8f0d8, #d9c8ff, #d9488b text.
- **Fit:** stationery and gift shops, casual games, sticker and messaging products. **Avoid:** professional contexts; pastel text needs a darker color.
- **Recipe:** `border-radius:99px; border:3px solid #fff; background:#b8f0d8; box-shadow:0 4px 0 #8fdcbb`; dots `background:radial-gradient(#fff 3px,transparent 4px) 0 0/22px 22px,#ffe5f1`

### Corporate Memphis
- **Look:** the flat illustration style of tech companies: bendy figures with tiny heads and huge limbs.
- **Moves:** small heads and long rubbery limbs; flat color with no outlines or shading; skin in blue, purple or orange; figures interacting with floating interface cards over soft blobs.
- **Type and palette:** DM Sans or Circular. #ffd9c7 blob, #5b5bd6 violet, #7fb4ff skin, #2b2b6b navy, #ffb020 amber.
- **Fit:** SaaS onboarding and empty states, collaboration tools, explainers. **Avoid:** brands that need to stand out; it reads as generic tech.
- **Recipe:** inline SVG; limbs as open paths with `fill:none; stroke-linecap:round; stroke-width:14` (arms) and `20` (legs); head circle about one third of torso width; flat fills only

## Catalog: retro-future

Technology as it was imagined in different decades.

### Cybercore
- **Look:** cold, technical, monochrome layouts with distorted techno type and data debris.
- **Moves:** greyscale base with one alarm color; wide or warped lowercase techno type; halftone imagery, crosshairs, coordinates and tiny monospace labels; hairline rules.
- **Type and palette:** Michroma or Syncopate with Space Mono. #e6e6e6 ground, #0a0a0a ink, #ff2d2d accent.
- **Fit:** techwear, electronic music, hardware concepts, experimental portfolios. **Avoid:** mainstream consumer products.
- **Recipe:** halftone `background:radial-gradient(#0a0a0a 1.3px,transparent 1.7px) 0 0/6px 6px; mask-image:linear-gradient(90deg,transparent,#000)`; headline `text-shadow:2px 0 #ff2d2d; transform:scaleY(1.25)`

### Synthwave
- **Look:** the 1980s in neon: a striped sunset over a glowing grid.
- **Moves:** perspective grid floor; sun with horizontal cut-out stripes; neon glow on deep purple; chrome or brush-script lettering.
- **Type and palette:** Mr Dafoe with Audiowide or Orbitron. #0d0221, #2d0b59, #ff2975, #ffd319, #00f0ff.
- **Fit:** music, gaming, retro events. **Avoid:** corporate or current-feeling brands; glow text needs large sizes.
- **Recipe:** floor `background:linear-gradient(#ff2975 2px,transparent 2px) 0 0/100% 26px, linear-gradient(90deg,#ff2975 2px,transparent 2px) 0 0/44px 100%; transform:perspective(180px) rotateX(62deg)`; glow `text-shadow:0 0 6px #ff2975, 0 0 22px #ff2975`

### Cyberpunk
- **Look:** a neon HUD on a dark screen, with glitches and clipped corners.
- **Moves:** dark ground with neon cyan, magenta and warning yellow; clipped corners and thin HUD lines; glitch offsets and scanlines; monospace status text.
- **Type and palette:** Rajdhani or Orbitron with Share Tech Mono. #07060f, #00f0ff, #ff2a6d, #fcee0a.
- **Fit:** games, esports, security tooling, sci-fi campaigns. **Avoid:** general audiences and long sessions.
- **Recipe:** `clip-path:polygon(0 0,calc(100% - 12px) 0,100% 12px,100% 100%,12px 100%,0 calc(100% - 12px))`; scanlines `repeating-linear-gradient(rgba(255,255,255,.05) 0 1px,transparent 1px 3px)`; glitch `::after{content:attr(data-t); color:#ff2a6d; clip-path:inset(42% 0 34% 0)}`

### Vaporwave
- **Look:** a dreamy, ironic remix of 1990s computing in pastel pink and cyan.
- **Moves:** pink-to-cyan gradients; Windows 95 dialogs and old web elements; wide-spaced capitals and Japanese text; statues, palms and checkerboard floors.
- **Type and palette:** Times New Roman and MS Sans Serif on purpose. #ff71ce, #01cdfe, #b967ff, #05ffa1, #fffb96.
- **Fit:** music and art projects, merch, nostalgic campaigns. **Avoid:** sincere or corporate messaging.
- **Recipe:** `background:linear-gradient(#ff9ad5,#b28dff 50%,#7de2f2)`; window `background:#c0c0c0; border:2px solid; border-color:#fff #555 #555 #fff`; title `letter-spacing:.35em; text-shadow:2px 2px 0 #ff71ce`

### Terminal
- **Look:** the command line as a design: monospace, a prompt and a blinking cursor.
- **Moves:** one monospace face on a dark ground; prompts, paths and command output as structure; phosphor green or amber with a faint glow; ASCII rules instead of drawn borders.
- **Type and palette:** JetBrains Mono or IBM Plex Mono. #0c0f0a ground, #7dff8a phosphor, #4c9a57 dim; amber #ffb000 as an alternative.
- **Fit:** developer portfolios, CLI tools and docs, technical blogs. **Avoid:** non-technical audiences and long prose.
- **Recipe:** `background:#0c0f0a; color:#7dff8a; font:13px/1.7 'JetBrains Mono'; text-shadow:0 0 6px rgba(125,255,138,.5)`; cursor `display:inline-block; width:8px; height:15px; animation:blink 1s steps(2) infinite`

## Catalog: handmade and organic

Evidence of a hand: paper, ink, pencil, cloth.

### Scrapbook
- **Look:** a personal journal page: torn paper, tape, polaroids, handwriting.
- **Moves:** kraft ground with layered, slightly rotated pieces; torn edges, washi tape and soft paper shadows; handwriting with typewriter text; polaroid frames and doodles.
- **Type and palette:** Caveat with Special Elite. #cdb594 kraft, #f6efe0 paper, #3b2f25 ink, #f2d76b tape.
- **Fit:** travel and food blogs, personal sites, indie musicians, photo products. **Avoid:** corporate tools; handwriting is for accents only.
- **Recipe:** `clip-path:polygon(0 4%,9% 0,22% 3%,38% 0,55% 4%,71% 1%,88% 4%,100% 0,100% 100%,0 100%); transform:rotate(-3deg); filter:drop-shadow(2px 4px 4px rgba(60,40,20,.3))`; tape `background:rgba(242,215,107,.8)`

### Conceptual sketch
- **Look:** an architect's working drawing: pencil line, watercolor wash, dimension notes.
- **Moves:** thin wobbly strokes with no solid fills; loose translucent washes that spill past the lines; dimension lines and handwritten labels; off-white paper and empty space.
- **Type and palette:** Architects Daughter. #fbfaf6 paper, #3a3a3a graphite, #c4785a and #8aa58c washes.
- **Fit:** architecture and interior studios, early product concepts. **Avoid:** finished-product marketing; it signals work in progress.
- **Recipe:** SVG `<filter><feTurbulence baseFrequency='.03' numOctaves='2'/><feDisplacementMap in='SourceGraphic' scale='4'/></filter>` on paths with `fill:none; stroke-width:1.2`; wash `fill:rgba(196,120,90,.32); filter:blur(7px)`

### Bohemian
- **Look:** earthy, relaxed and handmade: arches, suns, sun-baked colors.
- **Moves:** terracotta, sand, sage and mustard on cream; arch shapes, sun and moon motifs, botanical line art; scalloped or wavy edges; soft classical display type.
- **Type and palette:** Forum or Cormorant with Jost. #e8dcc8 sand, #c9764f terracotta, #8a9a78 sage, #f0d9a8 sun, #5b4636 bark.
- **Fit:** wellness, yoga, handmade goods, cafes, boutique travel. **Avoid:** tech and finance; too many motifs become clip art.
- **Recipe:** arch `border-radius:99px 99px 0 0; background:#c9764f`; scalloped edge `background:radial-gradient(circle at 11px 13px,#c9764f 10px,transparent 11px) 0 0/22px 12px repeat-x`

### Wabi-sabi
- **Look:** beauty in the imperfect and incomplete: quiet, asymmetric, natural.
- **Moves:** large empty space with one off-center focal object; irregular ink or wood-grain marks; unbleached paper tones and sumi black; one small vermilion seal.
- **Type and palette:** Shippori Mincho or Zen Old Mincho. #efe9dc washi, #1c1a17 sumi, #8a8172 stone, #b3261e seal.
- **Fit:** ceramics, tea, craft, architecture, hospitality. **Avoid:** busy catalogues; the emptiness is the design.
- **Recipe:** SVG circles `fill:none; stroke-width:3.5; stroke-dasharray:90 7 160 4` through `<feTurbulence baseFrequency='.05' numOctaves='3'/><feDisplacementMap scale='14'/>`; seal `width:14px; height:14px; border-radius:50%; background:#b3261e`

## Catalog: dreamlike and ornate

Atmosphere first; the page is a scene or an object more than a layout.

### Surrealism
- **Look:** dream logic: familiar objects at impossible scales and places.
- **Moves:** photo collage with wrong scale relationships; floating and misplaced objects; type woven into the scene and partly hidden; film grain and a muted retro grade.
- **Type and palette:** Anton, sometimes with an italic serif. #2f6f8f sky, #9cc7d1 haze, #e8d9b8 sand, #c2452d accent.
- **Fit:** campaign heroes, album and book covers, creative agencies. **Avoid:** product UI; needs real cut-out imagery.
- **Recipe:** scale clash: a `width:170px` moon beside a `width:20px; height:38px` door; cloud from one element `border-radius:99px; box-shadow:38px -16px 0 8px #fff, 84px 2px 0 2px #fff; filter:blur(2px)`

### Ethereal
- **Look:** weightless and luminous: soft light, blur and glow.
- **Moves:** blurred radial gradients and light rays around a bright core; thin italic serif with a soft glow; prismatic or pearlescent color; very slow motion if any.
- **Type and palette:** Cormorant italic 300. #0b2a24, #2f7d5b, #b9f2c0, #fdfff0; or pearl, lilac and blush.
- **Fit:** wellness, meditation, fragrance, skincare, ambient music. **Avoid:** information-dense pages; check contrast.
- **Recipe:** `background:radial-gradient(circle,#fdfff0 0,#b9f2c0 10%,#2f7d5b 38%,#0b2a24 78%)`; rays `background:repeating-conic-gradient(from 8deg,rgba(255,255,255,.28) 0 5deg,transparent 5deg 17deg); filter:blur(5px); mix-blend-mode:screen`

### Victorian
- **Look:** nineteenth-century ornament: framed, symmetrical, gilded, dense.
- **Moves:** centered composition inside ornamental frames; double rules, flourishes and fleurons; several display faces in one lockup; deep jewel colors with gold.
- **Type and palette:** Great Vibes, IM Fell English SC, Playfair Display. #6d0f1b crimson, #e8c98a gold, #c9a35a antique gold.
- **Fit:** spirits, apothecary and barber brands, tattoo studios, museums. **Avoid:** modern software; scripts fail below about 24px.
- **Recipe:** `border:1px solid #c9a35a; outline:3px double #c9a35a; outline-offset:5px; text-align:center`; headline `font:400 46px 'Great Vibes'`; labels `letter-spacing:.22em`

## Catalog: era revivals

Looks named after a decade or an art movement.

### Bauhaus
- **Look:** circle, square and triangle in red, yellow and blue with geometric type.
- **Moves:** primary shapes as the whole visual language; red, yellow, blue and black on off-white; geometric sans, often lowercase; heavy rules and functional asymmetry.
- **Type and palette:** Jost, Futura. #f1e9d6 paper, #d62828, #f2b705, #1d4e9e, #1a1a1a.
- **Fit:** design schools and studios, architecture, furniture, museums. **Avoid:** soft or luxurious brands.
- **Recipe:** shapes `border-radius:50%`, a plain square, and `clip-path:polygon(50% 0,100% 100%,0 100%)`; rule `border-top:6px solid #1a1a1a`; `text-transform:lowercase`

### Art Deco
- **Look:** 1920s glamour: gold on black, sunbursts, tall elegant capitals.
- **Moves:** strict symmetry with sunburst, fan and chevron motifs; metallic gold lines on black, navy or deep green; tall thin wide-spaced capitals; double rules and stepped borders.
- **Type and palette:** Poiret One, Limelight. #0f1a17 night green, #d4af6a gold, #f3e9d2 cream.
- **Fit:** hotels, cocktail bars, theatres, jewellery, formal events. **Avoid:** casual or budget brands.
- **Recipe:** fan `border-radius:150px 150px 0 0; background:repeating-conic-gradient(from -90deg at 50% 100%,#d4af6a 0 6deg,transparent 6deg 12deg)`; title `letter-spacing:.3em; border-block:3px double #d4af6a`

### Art Nouveau
- **Look:** ornament drawn from plants: whiplash curves, flowers, flowing symmetrical frames.
- **Moves:** sinuous S-curves instead of straight edges; stylised flowers, leaves and vines; arched frames and mirrored compositions; muted natural colors with gold line work.
- **Type and palette:** Federo with a plain serif. #26342b deep green, #d9b56d gold, #c97b84 rose, #7f9a6b sage, #f0e6cf cream.
- **Fit:** florists, perfume and cosmetics, tea and chocolate, heritage brands. **Avoid:** dense interfaces; the ornament must be drawn as vector art.
- **Recipe:** inline SVG; curves as cubic Bezier paths with `fill:none; stroke:#d9b56d; stroke-width:2.2; stroke-linecap:round`; draw one side in a `<g id>` and mirror it with `<use transform='translate(320 0) scale(-1 1)'>`

### Mid-century modern
- **Look:** 1950s optimism: atomic starbursts, boomerangs and kidney shapes.
- **Moves:** organic kidney and boomerang shapes beside thin starbursts; teal, mustard, burnt orange and walnut on cream; flat slightly off-register shapes; geometric sans with a casual script accent.
- **Type and palette:** Josefin Sans, Futura. #f2ead8 cream, #2a7f86 teal, #e0a526 mustard, #d9582b orange, #5b3a29 walnut.
- **Fit:** furniture and homeware, cafes and diners, retro packaging. **Avoid:** cutting-edge tech brands; keep shapes few.
- **Recipe:** inline SVG; starburst `<path d='M0-18V18M-18 0H18M-10-10 10 10M-10 10 10-10'>` with `fill:none; stroke-width:1.6`, reused by `<use transform='translate(x y) scale(s)'>`; blobs as closed curved paths with flat fills

### Psychedelic 60s
- **Look:** concert-poster style: melting warped lettering over vibrating rings of clashing color.
- **Moves:** lettering that bends and melts to fill its shape; concentric or swirling saturated bands; complementary colors edge to edge; slow color cycling.
- **Type and palette:** Titan One or Bagel Fat One, then warped. #ff2e93, #ff8a00, #ffe600, #00c853, #2962ff, #8e24aa.
- **Fit:** festivals and gig posters, record labels, vintage clothing. **Avoid:** anything read quickly; provide a still version.
- **Recipe:** concentric SVG circles through `<feTurbulence type='fractalNoise' baseFrequency='.012' numOctaves='2'/><feDisplacementMap scale='46'/>`; text through a second filter at `scale='12'` with `paint-order:stroke; stroke-width:5`; `animation` on `filter:hue-rotate(360deg)`

### Memphis
- **Look:** the 1980s Memphis Group: squiggles, triangles and dots in candy colors.
- **Moves:** scattered triangles, circles and zigzags; polka-dot, stripe and terrazzo fills; pink, teal, yellow and black together; black outlines with hard offset shadows.
- **Type and palette:** Archivo Black or Rubik. #fdf0e2 ground, #ff5fa2, #00c2b2, #ffd23f, #111.
- **Fit:** kids' brands, party and event graphics, creative agencies. **Avoid:** calm or premium brands.
- **Recipe:** dots `background:radial-gradient(#111 2.5px,transparent 3px) 0 0/12px 12px`; shape `border:4px solid #111; box-shadow:6px 6px 0 #111`; zigzag from four `linear-gradient(<135|225|315|45>deg,#ff5fa2 25%,transparent 25%)` layers at `background-size:16px 16px`

### 70s retro
- **Look:** warm 1970s nostalgia: sunset stripes, concentric arcs, fat friendly lettering.
- **Moves:** orange, mustard, brown and cream; concentric rainbow arcs and wavy stripes; heavy rounded display type with a drop shadow; slightly faded color.
- **Type and palette:** Shrikhand, Cooper Black. #f4e3c1 cream, #c8451b orange, #f0b429 mustard, #8a3b12 brown.
- **Fit:** record shops, coffee and food brands, festivals, vintage clothing. **Avoid:** tech and finance.
- **Recipe:** arcs `border-radius:50%; background:radial-gradient(circle,#f4e3c1 0 28%,#c8451b 28% 40%,#f4e3c1 40% 44%,#f0b429 44% 56%,#f4e3c1 56% 60%,#8a3b12 60% 71%,transparent 71%)`; headline `font-family:Shrikhand; text-shadow:3px 3px 0 #f0b429`

### Dark academia
- **Look:** an old university library at night: dark wood, aged paper, classical serif.
- **Moves:** deep brown, oxblood and forest green with parchment text; old-style serif with italics and small caps; Latin phrases, volume numbers and thin rules; vignette lighting.
- **Type and palette:** EB Garamond, Cormorant. #17130e shadow, #3a2e22 walnut, #d8c7a3 parchment, #a8946c brass.
- **Fit:** bookshops and publishers, literary journals, podcasts, universities. **Avoid:** fast transactional products; keep body text large.
- **Recipe:** `background:radial-gradient(circle at 50% 30%,#3a2e22,#17130e); color:#d8c7a3; font-family:'EB Garamond'`; labels `font-variant:small-caps; letter-spacing:.16em`

## Project notes

Local additions for the SGU MSA site; everything above is the maintainer's original skill (see `NOTICE`).

- **License note.** The original `NOTICE` refers to the root license as it existed when this skill was added. Its Unlicense terms are preserved in `LICENSE-UNLICENSE-ORIGINAL.txt`; the current root MIT license covers project-authored code and does not replace this skill's original terms. Keep the vendored text and `NOTICE` unchanged.

- **Brand.** The site belongs to a university mosque and its Muslim Students' Association: calm, welcoming, dignified and readable, for students, first-time visitors and board members. Treat this as step 1 ("Read the brand") of the workflow.
- **Chosen direction.** The site has one design, Quiet Paper (wabi-sabi + minimalism), in light and dark ([ADR 0018](../../../docs/adr/0018-design-direction-quiet-paper.md)); its values are in `src/styles/tokens.css` and its pieces in Storybook (`npm run storybook`). The old six `data-design` themes are retired. Quiet Paper and `tokens.css` override this catalog; a style only fills what is undecided.
- **Founder's proposal.** The original Coastal Heritage proposal and source artwork remain in the private-history repository and are not part of the public code release. The `coastal` theme is a historical refinement; the final direction remains open ([roadmap](../../../docs/roadmap.md)).
- **The user decides.** Never pick a style. Offer 2-3 options with a recommendation, shown as pictures (Claude Design artboards, or screenshots of HTML mockups), following step 2 of `designing-ui-components`. Step 5 above means naming what the user chose; record it in the feature contract's Decisions.
- **Build with tokens.** Recipe hex values are references: map colors, radii and shadows onto tokens; no raw hex in components. The site self-hosts fonts through `@fontsource-variable/*` packages instead of Google Fonts links. A new font package is a new dependency: record it in the feature contract's Decisions (an ADR only if it affects several features or is hard to reverse). Free tools only ([ADR 0009](../../../docs/adr/0009-free-tools-only.md)).
- **Specimens link.** The "Design Style Specimens" artifact belongs to the maintainer's claude.ai account; if you cannot open it, build from the recipes.
