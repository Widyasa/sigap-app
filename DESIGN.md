---
name: Amanah Civic
colors:
  surface: '#f8f9ff'
  surface-dim: '#ccdbf3'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e6eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d5e3fc'
  on-surface: '#0d1c2e'
  on-surface-variant: '#40484b'
  inverse-surface: '#233144'
  inverse-on-surface: '#eaf1ff'
  outline: '#70787c'
  outline-variant: '#c0c8cb'
  surface-tint: '#306576'
  primary: '#003441'
  on-primary: '#ffffff'
  primary-container: '#0f4c5c'
  on-primary-container: '#87bbce'
  inverse-primary: '#9acee1'
  secondary: '#006b5f'
  on-secondary: '#ffffff'
  secondary-container: '#6df5e1'
  on-secondary-container: '#006f64'
  tertiary: '#452900'
  on-tertiary: '#ffffff'
  tertiary-container: '#643d00'
  on-tertiary-container: '#f8a110'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#b6ebfe'
  primary-fixed-dim: '#9acee1'
  on-primary-fixed: '#001f28'
  on-primary-fixed-variant: '#114d5d'
  secondary-fixed: '#71f8e4'
  secondary-fixed-dim: '#4fdbc8'
  on-secondary-fixed: '#00201c'
  on-secondary-fixed-variant: '#005048'
  tertiary-fixed: '#ffddb8'
  tertiary-fixed-dim: '#ffb95f'
  on-tertiary-fixed: '#2a1700'
  on-tertiary-fixed-variant: '#653e00'
  background: '#f8f9ff'
  on-background: '#0d1c2e'
  surface-variant: '#d5e3fc'
  primary-pressed: '#0A3644'
  primary-surface: '#E6F2F5'
  accent-surface: '#CCFBF1'
  text-primary: '#0F172A'
  text-muted: '#94A3B8'
  border: '#E2E8F0'
  background-alt: '#F8FAFC'
  status-emergency: '#DC2626'
  status-important: '#EA580C'
  status-normal: '#0284C7'
  status-progress: '#CA8A04'
  status-resolved: '#16A34A'
typography:
  display:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: '800'
    lineHeight: 34px
  headline-h1:
    fontFamily: Plus Jakarta Sans
    fontSize: 22px
    fontWeight: '700'
    lineHeight: 28px
  headline-h2:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md-bold:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
  label-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-xs:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  touch-target: 44px
  button-height: 48px
---

## Brand & Style

The design system is anchored in a **Corporate / Modern** aesthetic with a strong emphasis on **Civic Integrity**. It is designed to feel professional, transparent, and human-centric, moving away from traditional bureaucratic clutter toward a "technical-civic" language that prioritizes clarity and evidence.

The visual direction is guided by the philosophy of "Bukti di atas janji" (Evidence over promises). This is achieved through a high-contrast interface, rigorous alignment, and a focus on real-time data visualization. The style is intentional and utilitarian, ensuring that citizens—including seniors (50+)—feel a sense of stability and urgency when interacting with public services.

### Key Principles
- **Clarity & Trust:** Every UI element must pass WCAG AAA contrast requirements to ensure accessibility for all demographics.
- **Evidence-Driven:** Layouts prioritize maps, timestamps, and photographic evidence over decorative elements.
- **Urgency & Action:** Critical paths, such as SOS triggers, utilize distinct interaction patterns (long-press, haptics) to differentiate them from standard navigation.

## Colors

The color palette is divided into three functional tiers: **Brand**, **Civic**, and **Semantic**.

### Brand Tier
- **Primary Teal (#0F4C5C):** Used for core branding, headers, and primary actions. It represents stability and technical sophistication.
- **Accent Turquoise (#14B8A6):** Used for secondary actions and progress indicators. It provides a modern, approachable lift to the deeper teal.

### Civic & Semantic Tier
- **Civic Amber (#F59E0B):** Specifically reserved for gamification, point systems, and leaderboard elements to drive engagement.
- **Semantic Colors:** These are strictly functional. Red is reserved for P0 (Emergency), Orange for P1 (Important), and Blue for P2 (Normal). Success states use a vibrant Green to signal resolution.

The default mode is **Light**, optimized for outdoor legibility. A **Dark** mode implementation is provided for power users and low-light environments, swapping the background to a deep navy (#0B1620) while maintaining brand recognition.

## Typography

This design system employs a dual-font strategy to balance character with utility. 

**Plus Jakarta Sans** is used for headings and display numbers to provide a warm, optimistic, and authoritative presence. **Inter** is used for all functional UI and body text due to its exceptional legibility and neutral, professional tone.

### Implementation Rules
- **Minimum Font Size:** Body text must never drop below 16px to accommodate senior users.
- **Tabular Numerals:** For budget data, point values, and timestamps, Inter must be set to `tabular-nums` to ensure columns align perfectly.
- **Accessibility:** Ensure high contrast for all text levels, particularly `label-xs` used in timestamps and metadata.

## Layout & Spacing

The layout follows a strict **4px rhythm** and a **Fluid Grid** model. This ensures that content stretches efficiently across various mobile devices while maintaining safe margins.

### Grid & Margins
- **Margins:** Use a minimum of 16px (`spacing.md`) for side margins on mobile.
- **Gutters:** Use 12px or 16px between grid items.
- **Touch Targets:** A mandatory minimum of 44x44px for all interactive elements to ensure accessibility for elderly users and users in motion.

### Responsive Behavior
- **Mobile:** Single column focus. Primary CTA remains at the bottom of the viewport or floats (SOS).
- **Tablet:** Content is centered in a maximum-width container of 768px.
- **Desktop:** Dashboard layouts may utilize a 12-column grid with a fixed side-navigation rail.

## Elevation & Depth

Hierarchy is conveyed through **Tonal Layers** and **Low-Contrast Outlines** rather than heavy shadows. This maintains a clean, "civic" look that feels reliable rather than commercial.

### Depth Levels
- **Level 0 (Surface):** The global background (`#F8FAFC`).
- **Level 1 (Cards/Containers):** Flat white surfaces with a 1px border (`#E2E8F0`).
- **Level 2 (Active Sheets/Modals):** Slight elevation using an ambient, low-opacity shadow (4px blur, 5% opacity) to separate the sheet from the base layer.
- **Floating Action Buttons (FAB):** The SOS button uses a distinct shadow to ensure it is the most visible element on the z-axis.

Glassmorphism and backdrop blurs are reserved exclusively for the persistent Bottom Bar and Top Navigation to maintain context of underlying map content.

## Shapes

The shape language is consistently **Rounded**, striking a balance between professional structure and human-centric softness.

- **Standard Elements:** Cards, Buttons, and Input Fields utilize a 12px (`spacing(3)`) radius.
- **Secondary Elements:** Bottom sheets utilize a larger 20px radius on the top corners to feel more approachable.
- **Avatars & Icons:** Always circular or pill-shaped to differentiate human and status elements from structural UI components.

## Components

### Buttons
- **Primary:** Filled (`primary_color_hex`), 48px height, 12px radius. 
- **Secondary:** Filled (`secondary_color_hex`) or Ghost with border.
- **Loading State:** Must include a spinner; double-tap prevention is mandatory.

### SOS Button (Critical)
- **Floating Action:** Positioned bottom-right.
- **Interaction:** 3-second long-press requirement with a circular progress stroke and haptic feedback intervals.

### Cards
- **Structure:** 1px border (`#E2E8F0`), no shadow, 12px padding.
- **Content:** Prioritize "Evidence" (Photos/Maps) over large marketing copy.

### Input Fields
- **OTP:** Individual boxes at 44x44px minimum. 
- **Validation:** Error states must use `status-emergency` for borders and helper text.
- **Accessibility:** Every input requires an Indonesian `accessibilityLabel`.

### Bottom Sheets
- Used for Map Feed lists and detail views. They must snap to predefined heights (30%, 60%, 95%) to ensure the map remains partially visible.