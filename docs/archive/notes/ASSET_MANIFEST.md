> Archived reference, not current operating instructions. Start with [the project README](../../../README.md).

# Production Asset Manifest

Historical audit of the selected files that were served from `public/` when this inventory was written. It is retained for provenance, not as an instruction to republish an asset.

**Provenance.** Almost everything here was extracted from the MSA's own Facebook
archive PDFs (403 images, with a `manifest.tsv` mapping each file back to its source page). The source PDFs and extracted archive are excluded from the clean public repository and retained in the private-history repository. The archive itself was **never served** — only the selected, cropped, converted assets listed here were included in the old site tree.

Two hard rules applied when selecting:

- **No Facebook UI.** The source archive contained post chrome, controls, and screenshot
  borders. Only selected underlying photographs were used.
- **No identifiable close-up portraits, no minors, no board headshots with real
  names.** Selection favoured back-facing, wide, and atmospheric compositions.
  This ruled out a large amount of otherwise usable material, including all of
  the banquet photography and the children's-home outreach set.

---

## Brand

| File | Source | Route | Purpose | Era | Focal |
| --- | --- | --- | --- | --- | --- |
| `brand/msa-logo.webp` | `photos-p01-007` — MSA crest | Nav, footer, favicon | Identity | Current | centre |
| `brand/geometric-pattern.svg` | Drawn for this project | Site-wide watermark | Decorative texture at ≤12% opacity | n/a | tiled |

## Home

| File | Source | Route | Purpose | Era | Focal |
| --- | --- | --- | --- | --- | --- |
| `home/hero-campus-dusk.webp` | `photos-p09-162` | `/` | Hero. MSA students gathered on the lawn at dusk above the True Blue campus, seated on mats, fully back-facing. | Current-era, undated | `62% 60%` |

The single most important image on the site. Chosen because it is authentic,
respectful, non-identifiable, and its warm campus lights against a blue dusk sky
match the palette without any grading.

## Prayer & Musallah

| File | Source | Route | Purpose | Era | Focal |
| --- | --- | --- | --- | --- | --- |
| `prayer/hero-musallah.webp` | Route video @ 2:32 | `/prayer` | Page hero — the prayer hall itself | Current | `50% 45%` |
| `prayer/musallah-route-poster.webp` | Route video @ 0:12 | `/prayer`, `/resources` | Video poster frame | Current | centre |
| `prayer/route-path.webp` | Route video @ 0:12 | `/prayer` | Route still — the open path | Current | centre |
| `prayer/route-st-john.webp` | Route video @ 0:40 | `/prayer` | Route still — St. John's Hall, the landmark before the first right | Current | centre |
| `prayer/musallah-interior.webp` | Route video @ 2:32 | `/prayer` | Route still — inside the Musallah | Current | centre |

All five are frames from the MSA's own route recording, which makes them the
most current and most verifiable imagery on the site.

## Ramadan

| File | Source | Route | Purpose | Era | Focal |
| --- | --- | --- | --- | --- | --- |
| `ramadan/hero-lanterns.webp` | `photos-p04-049` | `/ramadan`, `/` | Hero — "Ramadan Mubarak" sign by candlelight inside the Musallah, prayer rugs visible | **Historical** | `42% 50%` |
| `ramadan/gallery-mubarak-sign.webp` | `photos-p04-049` | `/ramadan` | Gallery | **Historical** | centre |
| `ramadan/gallery-isra-miraj.webp` | `photos-p08-140` | `/ramadan` | MSA halaqa graphic — Night of Al-Isra' Wal-Mi'raj | **Historical** | centre |
| `ramadan/gallery-halaqa.webp` | `photos-p04-064` | `/ramadan`, `/resources` | MSA graphic — Ramadan on the Island | **Historical** | centre |
| `ramadan/gallery-bake-sale.webp` | `photos-p08-137` | `/ramadan` | MSA bake sale graphic | **Historical** | centre |

Every Ramadan asset carries `historical: true` and renders behind an **Archive**
marker. None is dated, because no reliable year could be established from the
source — and a guessed year would be worse than none.

## Merch

| File | Source | Route | Purpose | Era | Focal |
| --- | --- | --- | --- | --- | --- |
| `merch/green-order-sheet.webp` | `photos-p06-103` | `/merch` | Archive 01 — Green order sheet, قلب سليم | **Historical** | centre |
| `merch/maroon-waterfront.webp` | `photos-p03-038` | `/merch` | Archive 02 lead — two students, back print visible | **Historical** | centre |
| `merch/maroon-order-sheet.webp` | `photos-p03-041` | `/merch` | Archive 02 — front and back | **Historical** | centre |
| `merch/maroon-back-detail.webp` | `photos-p03-035` | `/merch` | Archive 02 — arch and tree print detail | **Historical** | centre |
| `merch/maroon-full.webp` | `photos-p03-034` | `/merch` | Archive 02 — worn on campus | **Historical** | centre |
| `merch/shukr-back.webp` | `photos-p02-015` | `/merch`, `/` | **Current** lead — Shukr back print | Current | `50% 40%` |
| `merch/shukr-front.webp` | `photos-p02-012` | `/merch` | Current — front with crest | Current | centre |
| `merch/shukr-detail.webp` | `photos-p02-013` | `/merch` | Current — stamp panel detail | Current | centre |
| `merch/shukr-full.webp` | `photos-p02-016` | `/merch` | Current — worn on the field | Current | centre |
| `merch/shukr-pair.webp` | `photos-p02-011` | `/merch` | Current — two students | Current | centre |

**Every garment shown is long-sleeve**, verified image by image. No short-sleeve
mockup was introduced at any point. The Shukr shirts are navy and carry
"Ramadan 1447" on the back print, which is what dates the collection.

## Community

| File | Source | Route | Purpose | Era | Focal |
| --- | --- | --- | --- | --- | --- |
| `community/gathering-dusk.webp` | `photos-p09-162` | `/get-involved` | Volunteer pathway | **Historical** | centre |
| `community/campus-aerial.webp` | `photos-p10-181` | `/about` | True Blue campus aerial | **Historical** | centre |
| `community/island-landscape.webp` | `photos-p11-193` | `/` | Newsletter feature panel | **Historical** | `50% 55%` |

`gathering-dusk` is a different crop of the same source as the homepage hero.
This is the only intentional reuse on the site; the crops differ enough that the
two do not read as the same picture, and both uses are a good fit.

## Resources

| File | Source | Route | Purpose | Era |
| --- | --- | --- | --- | --- |
| `resources/quran-classes.webp` | `photos-p09-149` | `/resources` | Quran classes announcement | **Historical** |
| `resources/musallah-construction-notice.webp` | `photos-p07-116` | `/resources` | Musallah access notice | **Historical** |
| `resources/ramadan-schedule.webp` | `photos-p04-050` | `/resources` | Daily Ramadan schedule table | **Historical** |
| `resources/jumuah-notice.webp` | `photos-p07-114` | `/resources` | Jumu'ah notice | **Historical** |
| `resources/basketball-tournament.webp` | `photos-p09-160` | `/resources` | Basketball tournament | **Historical** |

These are MSA-designed graphics rather than photographs, which is why 800×800 is
adequate — they are shown at card size and contain no fine detail that fails.

## Placeholders

| File | Purpose |
| --- | --- |
| `placeholder/editorial.svg` | 1200×800 geometric fallback for any missing image |
| `placeholder/garment.svg` | 800×800 long-sleeve silhouette, used for the Shukr full-collection slot |

Vector, so they scale without cost, and unmistakably not photography — which is
the point. A branded placeholder is honest; a stock photograph standing in for
MSA material is not.

## Media & documents

| File | Size | Route | Notes |
| --- | --- | --- | --- |
| `video/musallah-route.mp4` | 12.6 MB | `/prayer` | **Removed from the current tree in the 2026 clean-up** (no page played it; historical bytes remain in the private-history repository only). Was 480×848 portrait, 2:32, H.264/AAC, re-encoded from the 27.8 MB original. |
| `documents/msa-newsletter-april-2026.pdf` | 2.2 MB | `/resources` | Edition 7. Labelled ARCHIVE. |

---

## Audit results

**Total public assets: 35 images + 1 video + 1 PDF ≈ 17 MB.**

Removed in Pass 4:

| File | Reason |
| --- | --- |
| `images/placeholder/portrait.svg` | Never referenced. Board members render as text; no headshot slot exists. |
| `images/resources/bake-sale-poster.webp` | Never referenced. Duplicated the subject of `ramadan/gallery-bake-sale.webp`. |
| `images/prayer/hero-route.webp` | Superseded in Pass 3 by `hero-musallah.webp` (already deleted). |

**Duplicates:** none, after the removal above.
**Facebook UI screenshots:** none — verified per file.
**Accidental source scans:** none.
**Unoptimised thumbnails used at hero scale:** none. See the note below.

## Resolution honesty

The archived Facebook source was mostly 414×414 thumbnails. In the historical site tree, assets derived from it were upscaled with Lanczos plus a light unsharp mask and used **only at sizes those sources could carry**:

- Gallery tiles, card covers, and merch secondary images sit at 800–1200 px and
  hold up well.
- The two 1900 px heroes (`home/hero-campus-dusk`, `ramadan/hero-lanterns`) are
  the exception. Both are 4× upscales, and both are viewed through a near-opaque
  gradient covering most of the frame, which is why they read acceptably. They
  are the first assets to replace if higher-resolution originals surface.
- Merch and prayer imagery needed no meaningful upscale — the merch photos came
  from a higher-quality section of the archive, and the prayer stills come from
  the video at native resolution.

**Original photography at 2000 px or wider would improve the homepage and Ramadan
heroes more than any other single change to this site.**

## Considered and excluded

| Source | Why not used |
| --- | --- |
| `photos-p09-163` — annotated campus route map | Genuinely useful, but it is a Google Maps screenshot. Republishing satellite imagery needs licensing clearance. Available if cleared. |
| `photos-p07-108`–`p07-113` — board headshots with names | Real students, named. Not published without individual consent and board confirmation. |
| `photos-p20-382`–`p21-400` — children's home outreach | Contains minors. Excluded on principle. |
| ~250 banquet photographs | Identifiable close-up portraits of individuals. |
| Facebook post collages | Post chrome and layout, not usable imagery. |

The original archive and source briefs are excluded from the clean public repository. They remain only in the private-history repository. This manifest records historical selection decisions; it does not grant reuse rights or replace consent and ownership review.
