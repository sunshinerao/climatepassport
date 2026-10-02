---
version: "superdesign-alpha"
name: "Deep Pine Civic Grid"
description: "An editorial, civic-institutional system built on a deep pine surface, a rationed gold accent, and a mosaic photo-grid hero — square geometry throughout, zero decorative radius except on pills."
colors:
  background: "#003030"
  surface-deep: "#042C2C"
  surface-alt: "#EDEDED"
  text-primary: "#102F2E"
  text-on-dark: "#FFFFFF"
  text-ink-secondary: "#0A0A0A"
  accent-gold: "#D4C057"
  border-hairline: "#195555"
typography:
  display-lg:
    fontFamily: "GT-America"
    fontSize: "68px"
    fontWeight: 700
    lineHeight: "1.04"
    letterSpacing: "-2px"
  headline-md:
    fontFamily: "GT-America"
    fontSize: "50px"
    fontWeight: 700
    lineHeight: "1.04"
    letterSpacing: "-2px"
  body-md:
    fontFamily: "GT-America"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: "1.7"
  label-md:
    fontFamily: "GT-America"
    fontSize: "36px"
    fontWeight: 700
    lineHeight: "1.06"
    letterSpacing: "-1px"
  accent-serif:
    fontFamily: "Times New Roman"
    fontStyle: "italic"
    note: "editorial serif reserved for rare accent moments, not body or display"
spacing:
  base: "16px"
  gap: "32px"
  section-padding: "80px"
rounded:
  control: "48px"
  card: "48px"
  pill: "48px"
components:
  button-primary-hero:
    background: "#D4C057"
    text-color: "#042C2B"
    radius: "48px"
    height: "56px"
    padding: "16px 48px"
    border: "2px solid rgb(212, 192, 87)"
    hover-background: "#042C2B"
    hover-text-color: "#D4C057"
  button-nav-cta:
    background: "#D4C057"
    text-color: "#042C2C"
    radius: "0px"
    height: "53px"
    padding: "0px 80px 0px 20px"
  button-ghost-midpage:
    background: "transparent"
    text-color: "#042C2C"
    radius: "0px"
    height: "76px"
    padding: "0px"
  card-mosaic-media:
    background: "transparent"
    radius: "0px"
    padding: "0px"
  card-panel-fullwidth:
    background: "#FFFFFF"
    radius: "0px"
    padding: "80px 0px 0px"
  card-stat-block:
    background: "transparent"
    radius: "0px"
    padding: "0px"
  card-earthshot-icon:
    background: "transparent"
    radius: "0px"
    padding: "0px 36px"
  footer-surface:
    background: "#042C2C"
    text-color: "#FFFFFF"
---
# Deep Pine Civic Grid
Source: https://earthshotprize.org/

## Overview
This is an editorial, civic-institutional design language — closer to Swiss/International rigor than to soft SaaS marketing. Every container is square (0px radius) except interactive pills, which jump to a fully-rounded 48px. The palette is deep pine (#042C2C/#102F2E) against off-white paper surfaces (#F7F7F7/#EDEDED/#FFFFFF), with a single mustard-gold (#D4C057) accent rationed to buttons, underlines, and small iconography. Oversized, tight-tracked GT-America display type (negative letter-spacing, near-1.0 line-height) carries the voice; photography appears only as a dense mosaic grid, never as a hero wash.

## Composition
The first screen splits into an asymmetric two-column hero: a fixed-width pine-green text panel (headline + single gold pill CTA) on the left, and a 5-column photographic mosaic bleeding to the right edge and off-frame. Below the fold, sections alternate pine-dark and paper-light bands in a strict rhythm: white statement band → light-gray scrolling-rail band (nominator logos) → pine band (five-icon Earthshot grid) → light stat band → pine newsletter band → light footer. This alternation is the deliberate structural device: color blocks mark section boundaries instead of dividers or shadows. The rejected alternative is a continuous single-background scroll — here, every section change is a hard color-field cut, reinforcing an institutional, almost government-report pacing over a seamless marketing flow.

## Colors
Pine (#042C2C, declared area ~45%) is the dominant structural color, used for the hero panel, the Earthshot-grid band, and the footer/newsletter band — it is the system's "ink" surface. White (#FFFFFF, ~24%) and near-white (#F7F7F7, ~19%) alternate as paper bands for statement and stat sections. The pixel field confirms this: #003030-family dark ~37% combined with #FFFFFF ~29% and #F0F0F0 ~22% account for nearly the entire page — this is a two-tone pine/paper system, not a multicolor one. Gold (#D4C057) is heavily rationed — under 1% of declared area — appearing only on CTA pills, a top hairline rule, underline ticks beneath stat numerals, and the Earthshot pictograms; it never fills a background. Borders are hairline pine (#195555) or gold (#D4C057) at 2px, used only on button strokes. Text ink is #102F2E on light surfaces and #FFFFFF on pine surfaces — no gray or muted tier is used for secondary text; hierarchy comes from size and weight, not color dilution.

## Typography
A single sans family, GT-America, carries the entire system at four roles: display-lg (68px/700, -2px tracking) for the hero headline; headline-md (50px/700, -2px tracking) for mid-page section titles; label-md (36px/700, -1px tracking) for stat numerals; and body-md (16px/400, 1.7 line-height) for all paragraph copy and form labels. The negative tracking on every bold weight produces a condensed, dense headline texture against very open body leading (1.7) — a deliberate high-contrast rhythm. An italic Times New Roman is reserved as a rare editorial accent, never for primary hierarchy. There is no secondary muted-text tier; weight and size alone establish the scale.

## Layout
Content is capped at a 1280px max-width with 80px section padding top-to-bottom. The hero mosaic is a true grid of uniform square tiles (5 columns × 3 visible rows), full-bleed to the viewport edge — a photographic mosaic pattern, not masonry (all cells equal size, dense packing, no variable spans). The nominator-logos band is a horizontal scrolling rail of wordmarks separated by pipe characters. The five-icon Earthshot band is a bento-light arrangement: row of 3 icon+label pairs, then a shorter row of 2 — an asymmetric 3-then-2 composition, each icon a dot-matrix circular glyph. The stat band is a simple horizontal cluster of 3 numeral blocks beside a heading. The newsletter form is a 2-column input grid (first/last name, org/country+email stacked in pairs) capped narrower than the main container, flanked by generous pine padding.

## Components
- **Navbar**: edge-to-edge square bar, 140px tall, 100% viewport width, all four corners 0px radius (sharp rectangle, not inset/capsule), static (non-sticky observed), background #FFFFFF, single visible primary nav row plus a right-aligned gold CTA block (height 53px, padding `0px 80px 0px 20px`, text #042C2C, 0px radius) sitting flush against the bar's right edge — not a floating pill. Logo is a stacked three-line wordmark lockup in pine ink at the far left.
- **Hero primary CTA**: a solid gold pill, #D4C057 fill, text #042C2B, radius 48px, height 56px, padding `16px 48px`, 2px solid gold-matched border; hover inverts to pine fill (#042C2B) with gold text (#D4C057). This is the single most emphasized control on the first screen, sitting directly under the hero headline in the dark pine panel.
- **Ghost text-link button**: transparent fill, text #042C2C, 0px radius, tall 76px hit-area, no padding — used mid-page as an inline emphasized link (e.g. beside body copy), not a filled button.
- **Mosaic media card**: appears in the hero's right-hand photo grid; ×5+ repeating uniform tiles, transparent/no-radius frame, each cell is 100% photographic fill with no text overlay, arranged in dense equal rows (left-bleed photography, no caption).
- **Full-width statement panel**: appears directly below the hero; ×5 stacked rows each spanning 100% of the container, white background, 0px radius, top padding `80px 0px 0px`; anatomy is heading-then-body-text, centered, one per scroll section (composition: rows [100 | 100 | 100 | 100 | 100]).
- **Scrolling logo rail**: a horizontal marquee of nominator wordmarks separated by gold pipe dividers on the #F7F7F7 band, feeding into a centered gold CTA pill below it.
- **Earthshot icon-label grid**: on the pine band; 5 items arranged 3-over-2 (rows [3][2]), each a dot-matrix circular pictogram in gold beside a bold white two-line label — composition rows: 3-wide top row, 2-wide second row, centered.
- **Stat numeral row**: light-gray band; 3 oversized gold-underlined numerals (label-md scale) each with a small caption beneath, laid beside a two-line pine headline — flex cluster, not a grid.
- **Newsletter capture band**: full-bleed pine background; centered white headline + body, below it a 2-column input grid (white rectangular fields, 0px radius, placeholder gray text) pairing first/last name and org/country+email, a centered gold pill submit button (same spec as hero primary CTA, smaller), and fine-print legal links beneath in muted white.
- **List/checklist card**: transparent cards, 0px radius, no padding, anatomy icon+list+body-text; appears ×3 in a row (rows [67|67|67] as % width) mid-page, and ×2 near page end as heading+list+body stacked at 97% width each (rows [97|97]).
- **Footer**: pine background #042C2C, centered dot-matrix globe glyph, row of 5 circular social icons, stacked wordmark logo, and a 5-link legal row plus registration fine print — no card chrome, pure flat color band.

## Graphics & Effects
All decorative iconography (Earthshot pictograms, footer globe) is rendered as dot-matrix/stippled circular compositions in gold-on-pine or pine-on-gray — a signature granular-dot texture rather than line icons, consistent across every pictogram instance. No gradients or mesh backgrounds are used anywhere; every section is a flat color fill. Two shadows are used sparingly and functionally, not decoratively: `rgba(10, 10, 10, 0.1) 0px 1px 2px 0px inset` (a subtle inset on form fields) and `rgb(128, 128, 128) 0px 0px 5px 0px` (a soft ambient glow, likely on focus/hover of inputs or the CTA). Photography in the hero mosaic is documentary/candid in style, uncropped-feeling, with no scrim or color treatment applied — full saturation, natural light, presented edge-to-edge in equal-size tiles.

## Motion
Interactions are restrained and functional: border transitions at `border 0.2s ease`, transform shifts at `transform 0.3s ease` (likely button/card hover lift), combined color/border transitions at `border-color, color 0.2s, 0.2s ease, ease`, and a slower compound shadow/border transition at `box-shadow, border-color 0.5s, 0.25s ease, ease-in-out` for emphasis states like focus rings. Keyframe names (fadeOut, fade_in/mmfadeIn/mmfadeOut, pulse1, spinner) indicate simple opacity-fade entrances for scroll-triggered content and a pulsing or spinner treatment for loading/async states — no spring-overshoot or playful bounce; all motion reads as measured and institutional.

## Guardrails
- Never round a card or panel corner — 0px is structural to this system; only buttons/pills take 48px or 9999px radius.
- Never expand the gold accent beyond controls, underlines, and icon glyphs — it must never become a background fill or large color block.
- Never substitute the nav's gold utility CTA for the hero's primary pill CTA — they share a hue but differ in radius (0px vs 48px) and shape role.
- Keep section transitions as hard pine/paper color-field cuts, not gradients or soft fades between bands.
- Preserve the mosaic hero as uniform equal-size photo tiles — do not convert it to masonry or variable-span bento spans.
- Keep all body and display type in GT-America; reserve the italic serif strictly as a rare accent, never for headlines or body hierarchy.