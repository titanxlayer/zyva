# DESIGN.md

A design system for AI agents to generate consistent, high-quality UI.

## 1. Visual Theme & Atmosphere

Modern, clean, developer-focused. Dark-first with a calm, low-noise surface and a
single vivid accent. Generous spacing, sharp typography, subtle depth. The feel is
precise and premium — never cluttered, never playful.

## 2. Color Palette & Roles

| Semantic name | Hex | Role |
|---|---|---|
| Background | `#0d0e12` | Page background |
| Surface | `#16171d` | Cards, panels |
| Surface raised | `#1c1d26` | Hover / elevated surfaces |
| Border | `rgba(255,255,255,.07)` | Dividers, card borders |
| Accent | `#7c3aed` | Primary actions, focus, links |
| Accent 2 | `#3b82f6` | Secondary accent, gradients |
| Text primary | `#e8e8ea` | Headings, body |
| Text muted | `#8a8f98` | Secondary text, captions |
| Success | `#22c55e` | Positive / secure status |
| Warning | `#f59e0b` | Warnings, badges |
| Danger | `#ef4444` | Errors, destructive actions |

Gradient: `linear-gradient(135deg, #7c3aed, #3b82f6)` for hero CTAs and highlights.

## 3. Typography

| Element | Style |
|---|---|
| Font family | `Inter, system-ui, -apple-system, sans-serif` |
| Mono | `ui-monospace, "SF Mono", monospace` (code, terminals) |
| H1 | 900 weight, clamp(30px, 5vw, 54px), line-height 1.1 |
| H2 | 800 weight, 26px |
| H3 | 700 weight, 15-18px |
| Body | 400-450 weight, 15-17px, line-height 1.6 |
| Caption | 12-13px, muted color |

## 4. Component Stylings

**Buttons**
- Primary: gradient bg, white text, `border-radius: 10px`, padding `10px 18px`, weight 700-800
- Secondary: surface bg, 1px border, muted-to-white text on hover
- Hover: slight lift (`translateY(-1px)`) + opacity/brightness shift
- Focus: visible ring in accent color

**Cards**
- Surface bg, 1px border, `border-radius: 14px`, padding `20px`
- Hover (if interactive): border brightens to accent, bg to surface-raised

**Inputs**
- Surface bg, 1px border, `border-radius: 10px`, padding `10px 14px`
- Focus: accent border + subtle glow

**Navigation**
- Sticky, blurred backdrop (`backdrop-filter: blur(12px)`), bottom border

## 5. Layout Principles

- Max content width: ~1040px, centered, 24px horizontal padding
- Spacing scale: 4 / 8 / 12 / 16 / 24 / 32 / 50px
- Generous whitespace between sections (50px+ vertical)
- Grid for cards: `repeat(auto-fit, minmax(0, 1fr))`, 16px gap

## 6. Depth & Elevation

- Flat by default; depth comes from subtle borders, not heavy shadows
- Large shadows reserved for floating elements: `0 24px 80px rgba(0,0,0,.5)`
- Layering: background → surface → surface-raised

## 7. Do's and Don'ts

**Do**
- Use one accent color consistently
- Keep contrast high (text on dark surfaces)
- Use muted text for secondary info
- Round corners consistently (10-16px)

**Don't**
- Don't mix multiple bright accent colors
- Don't use pure black (`#000`) or pure white (`#fff`) for large surfaces
- Don't add heavy drop shadows everywhere
- Don't crowd elements — respect the spacing scale

## 8. Responsive Behavior

- Breakpoints: 560px, 760px, 900px
- Multi-column grids collapse to single column on mobile
- Touch targets minimum 44px
- Navigation collapses to a menu under 760px

## 9. Agent Prompt Guide

Quick reference when generating UI:
- Background `#0d0e12`, cards `#16171d`, accent `#7c3aed`
- Inter font, rounded corners 10-16px, generous spacing
- Dark, clean, premium developer-tool aesthetic
- One accent color, high contrast, subtle borders over shadows
