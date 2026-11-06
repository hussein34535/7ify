# Product

## Register

product

## Users

Arabic-speaking music listeners on desktop and phone who want a premium, Spotify-grade listening surface in their own language. They are in a task — find something, start it, keep it playing — usually in a dim room, one-handed on mobile, for long unattended sessions. Secondary: designers and developers reviewing the interface as a front-end study.

## Product Purpose

A single-file, offline-capable music app shell for the fictional studio **نَغَم / NAGHAM**. It demonstrates a complete listening workflow: browse, search (Arabic-aware), queue, like, organize playlists, read time-synced lyrics, and personalize the look. Audio is generated live by a Web Audio synthesis engine, plus real local-file playback. Success: every control does what it promises, nothing stalls, and the interface holds up in both Arabic RTL and English LTR on a 390px phone and a 1440px desktop.

## Brand Personality

Nocturnal, precise, quietly luxurious. A late-night studio: dark glass, warm lamp light, nothing shouting. Voice is calm and direct in both languages — no exclamation marks, no marketing filler. Arabic is the primary voice, English is a peer, not a translation afterthought.

## Anti-references

- The "AI dashboard" look: gray-on-gray cards, identical card grids for every section, gradient text, glass everywhere.
- Loud gradient-heavy crypto/SaaS landing pages.
- Fake "loading" theater, dead controls, and demo badges that pretend to be real features.
- Machine-translated Arabic, Latin-only typography with Arabic crammed in, Arabic letter-spacing.

## Design Principles

1. **Every affordance is real.** If it is on screen, it works, or it is visibly marked as a demo.
2. **The music stays in front.** Chrome recedes; artwork and typography carry the emotion.
3. **Arabic is the default, not a skin.** RTL geometry, Arabic type metrics, and Arabic search normalization are designed first; English is the mirror image.
4. **State is always legible.** Playing, queued, liked, selected, and disabled are distinct at a glance.
5. **Calm surfaces, one signal.** Neutral ink surfaces, exactly one accent doing the pointing.

## Accessibility & Inclusion

WCAG 2.2 AA: 4.5:1 body text, 3:1 large text and UI boundaries, visible focus, full keyboard operation (space/seek/next/prev/mute/shuffle/repeat/search), native `<dialog>` focus handling, `aria-live` announcements, reduced-motion honoring both by OS setting and an in-app toggle.
