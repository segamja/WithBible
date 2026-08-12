---
name: Luminous Fellowship
colors:
  surface: '#FFFFFF'
  surface-dim: '#dbdad7'
  surface-bright: '#faf9f6'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f4f3f1'
  surface-container: '#efeeeb'
  surface-container-high: '#e9e8e5'
  surface-container-highest: '#e3e2e0'
  on-surface: '#1a1c1a'
  on-surface-variant: '#45474c'
  inverse-surface: '#2f312f'
  inverse-on-surface: '#f2f1ee'
  outline: '#76777d'
  outline-variant: '#c6c6cd'
  surface-tint: '#555e74'
  primary: '#01081a'
  on-primary: '#ffffff'
  primary-container: '#172033'
  on-primary-container: '#7f879f'
  inverse-primary: '#bdc6e0'
  secondary: '#44617d'
  on-secondary: '#ffffff'
  secondary-container: '#bfddfe'
  on-secondary-container: '#45627e'
  tertiary: '#000b05'
  on-tertiary: '#ffffff'
  tertiary-container: '#002618'
  on-tertiary-container: '#5d9378'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d9e2fc'
  primary-fixed-dim: '#bdc6e0'
  on-primary-fixed: '#121b2e'
  on-primary-fixed-variant: '#3e475b'
  secondary-fixed: '#cee5ff'
  secondary-fixed-dim: '#acc9ea'
  on-secondary-fixed: '#001d33'
  on-secondary-fixed-variant: '#2c4964'
  tertiary-fixed: '#b6efd1'
  tertiary-fixed-dim: '#9bd3b5'
  on-tertiary-fixed: '#002114'
  on-tertiary-fixed-variant: '#19503a'
  background: '#faf9f6'
  on-background: '#1a1c1a'
  surface-variant: '#e3e2e0'
  streak-yellow: '#F2C86B'
  alert-coral: '#D98282'
  status-inactive: '#E2E8F0'
typography:
  display-lg:
    fontFamily: Pretendard
    fontSize: 40px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Pretendard
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.2'
  headline-md:
    fontFamily: Pretendard
    fontSize: 24px
    fontWeight: '700'
    lineHeight: '1.3'
  section-title:
    fontFamily: Pretendard
    fontSize: 18px
    fontWeight: '600'
    lineHeight: '1.4'
  body-main:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  caption-caps:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: 0.05em
  data-stat:
    fontFamily: Pretendard
    fontSize: 36px
    fontWeight: '700'
    lineHeight: '1'
    letterSpacing: -0.01em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 32px
  container-margin: 20px
  gutter: 16px
---

## Brand & Style

The design system embodies a **Modern Christian Youth** aesthetic that is **Warm, Calm, and Premium**. It intentionally moves away from traditional, heavy ecclesiastical imagery (gold, ornate textures, dark woods) in favor of a lifestyle-oriented approach that feels like a supportive habit-building companion.

The chosen style is **Minimalist with Tactile Layers**. It utilizes heavy whitespace, a sophisticated "Warm White" canvas, and soft, card-based containers to create a burden-free environment. The emotional goal is to provide a "sacred pause" in a noisy digital world—fostering community growth ("togetherness") over individual competition.

**Key visual principles:**
- **Warmth:** Softening every "cold" digital edge with generous rounding and organic tones.
- **Calmness:** Reducing cognitive load through a "3-click" rule and purposeful whitespace.
- **Youthful Vitality:** Using "Soft Sage" and "Warm Yellow" to signal life, growth, and energy.

## Colors

The palette is centered on a high-contrast foundation of **Deep Navy (#172033)** on a **Warm White (#FAF9F6)** background. This ensures premium readability while maintaining a soft, approachable atmosphere.

- **Primary (Deep Navy):** Used for typography, navigation icons, and primary action buttons to convey authority and grounding.
- **Secondary (Soft Sky):** Applied to informational badges and secondary actions, providing a breath of "air" to the UI.
- **Tertiary (Soft Sage):** The "growth" color. Reserved for success states, progress bars, and "Completed" indicators.
- **Warm Yellow:** Specifically for "Streaks" and achievements to evoke light and joy.
- **Surface:** Pure white is used exclusively for cards and interactive inputs to lift them off the warm background.

## Typography

This system uses a dual-font strategy: **Pretendard** handles Korean script with exceptional clarity and modern proportions, while **Inter** provides a clean, neutral fallback for English and functional metadata.

The typographic scale emphasizes **large data points** and **confident headers**. Progress percentages and streak numbers (D-Day) are treated as "Display" elements to celebrate daily consistency. Body text uses a generous 1.6 line height to ensure reading reflections and Bible verses feels comfortable and unhurried.

## Layout & Spacing

The layout follows a **fluid grid** model optimized for mobile-first consumption (390x844). Content is organized into a vertical stack of high-radius cards.

**Rhythm & Rules:**
- **Vertical Hierarchy:** Generous 32px (xl) spacing between major sections (e.g., Today's Word vs. Community Feed) to prevent a "cluttered" feel.
- **Safe Zones:** A standard 20px margin on mobile ensures content doesn't feel cramped against screen edges.
- **Touch Targets:** All interactive elements (reactions, navigation, buttons) must maintain a minimum area of 44x44px.
- **Desktop Reflow:** On larger screens, the content centers in a fixed 600px container to maintain the intimacy of the mobile reading experience.

## Elevation & Depth

Visual hierarchy is conveyed through **Tonal Layering** and **Subtle Ambient Shadows**. 

The background is `#FAF9F6`. Surfaces (cards) are `#FFFFFF`. To separate them, we use a custom shadow: `0px 4px 20px rgba(23, 32, 51, 0.04)`. This shadow is extremely diffused and low-opacity, making the cards appear as if they are resting softly on the surface rather than floating high above it.

**Layering Logic:**
1. **Level 0 (Base):** Warm White background.
2. **Level 1 (Content):** White cards containing the main feed and progress.
3. **Level 2 (Interaction):** Modals and bottom sheets, which use a slightly darker backdrop overlay (20% Deep Navy) to focus attention.

## Shapes

The shape language is extremely soft and approachable. 
- **Main Cards:** Use a **20px to 24px** radius (represented by `rounded-xl` and above) to create a friendly, "pill-like" container feel.
- **Buttons:** Follow a full-pill shape (radius 999px) for primary actions to distinguish them from content cards.
- **Progress Bars:** Feature fully rounded caps on both the track and the fill.
- **Avatars:** Always circular, emphasizing the "personhood" of the community.

## Components

### Buttons & Actions
- **Primary Button:** Deep Navy background, white text, pill-shaped. Used for "Certify Reading."
- **Secondary Button:** Soft Sky background (15% opacity) with Deep Navy text. Used for "View Details."
- **Reaction Icons:** Lucide-based line icons. Upon tapping, they trigger a "bounce" micro-interaction and fill with Soft Sage (for encouragement) or Soft Sky.

### Cards
- **Hero Card:** Houses "Today's Word." Uses a larger 24px radius and carries the primary progress indicator.
- **Feed Card:** Contains user-uploaded photos of Bible text. Photos should have a 12px internal radius to nest comfortably within the 20px card.

### Progress Indicators
- **Horizontal Gauge:** A thick track (12px height) with a Soft Sage fill.
- **Circular Rings:** Used for individual daily goals; the stroke should be 4px thick with rounded ends.

### Inputs
- **Reflection Field:** A soft-bordered textarea with a 16px radius. Focus state uses a 2px Deep Navy border.

### Community Elements
- **Avatar Stacks:** Overlapping circles with a 2px white border between them, used to show "who is reading right now."
- **Streak Flame:** Uses Warm Yellow. When a streak is broken, it reverts to a "Sprout" (🌱) icon in Sage to encourage a fresh start rather than signifying failure.