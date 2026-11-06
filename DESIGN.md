# Design System — NAGHAM STUDIO

## Theme

Nocturnal product UI. Near-black canvas (`#07080A`), layered neutral panels, one vivid accent. Themes: Ink (default), OLED, Plum, Ocean, Dusk (warm), Paper (light). Density: Comfortable / Compact. Motion can be disabled in-app.

Scene: 11pm, a dim room, headphones on. Dark is not a style choice here; it is the ambient light.

## Color

- Canvas `#07080A`; panel `#0E1013`; raised `#15181D`; hover `#1B1F26`.
- Ink `#EEF1F5`; muted `#9BA4B0`; faint `#6C7683`; hairline `rgba(255,255,255,.07)`.
- Accent default `#1ED760`; presets violet `#A78BFA`, blue `#60A5FA`, pink `#F472B6`, amber `#FBBF24`, coral `#FB7185`, teal `#2DD4BF`.
- `--accent-contrast` is computed from accent luminance (black text on bright accents, white on dark) so pills always pass contrast.
- In Paper theme accent text uses a darkened accent (`--accent-text`) to hold 4.5:1 on light surfaces.
- Track art carries the only other color: per-track three-stop gradient sets supply glow, never UI chrome.

## Typography

- Arabic UI + Latin: **IBM Plex Sans Arabic** (300/400/500/600/700). English UI: **Inter** (400–700). Numerals: **JetBrains Mono** for timestamps only.
- Fixed rem scale, ratio ~1.2: 11 / 12 / 13 / 14 / 16 / 20 / 24 / 30 / 38 px.
- Arabic: line-height 1.65, no letter-spacing, no uppercase transforms.
- Latin labels may use weight + slight tracking; never on Arabic.
- Prose capped 68ch.

## Layout

- App grid: 60px top bar · fluid shell · 86px player. Shell columns: 276px rail · content · 336px now-panel; hides at 1240 / 980.
- Panels are 14px-radius surfaces separated by 10px gutters, 1px hairline borders, no soft drop shadows except floating overlays.
- Mobile: 56px header, single column, 62px floating player above a 60px nav row; 12px gutters.
- Content rhythm: 32px between sections, 12–16px within.

## Components

- Buttons: pill (`9999px`) for primary and chips; 36px icon buttons (radius 50%); one vocabulary everywhere.
- Play: 40px accent circle with black glyph; 52px in now-playing.
- Cards: cover 1:1, 10px radius, title 13px/600, meta 12px muted, play FAB on hover/focus; press state scales .98.
- Rows: 52px, index → play swap, equalizer on current, 8% hover wash.
- Seek: 4px track, accent fill, 12px thumb that grows on hover/focus; LTR always; `role="slider"`.
- Dialogs: native `<dialog>`, no arbitrary modals; inline creation preferred (new playlist is an inline rail row).
- Toasts: single 320px surface above player, `aria-live="polite"`, auto-dismiss 2.6s.

## Motion

- 120–220ms, `cubic-bezier(.16,1,.3,1)` (ease-out-quint); opacity/transform only.
- Equalizer bars run only on the playing row; sheet slides 24px + fade.
- No page-load choreography. Reduced motion → instant states, bars frozen.

## Artwork

Procedural: three-stop gradient + one of four abstract motifs (rings, beam, dot-field, arcs) + fine vignette. Deterministic per track, no image requests, no illustrations of objects.

## Accessibility

Focus ring 2px accent at 2px offset, skip link, labelled icon buttons, `aria-pressed` on toggles, slider semantics with keyboard steps, 44px minimum touch targets, contrast verified per theme.
