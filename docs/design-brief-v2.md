# Design brief v2: modern, crafted, trustworthy

Paste this at the start of any build: a web app, a site, a dashboard, a form, a mobile screen, an email, a deck. It works for any product and any audience. Fill in the brand layer (section 14) once. Everything else is fixed unless the person overrides a rule by naming it.

---

## 1. The target

The screen should feel like a product from a sharp, well-funded team in its second or third year: **confident, crafted, alive, and calm.** Think of the feeling of Linear, Stripe, Vercel, Raycast or Notion, without copying any of them.

The first brief made things trustworthy but flat. This one keeps the trust and adds **craft**: depth that explains hierarchy, a type system with real contrast, one signature moment per screen, and small details that reward attention.

The test a stranger should pass in five seconds:
1. "This looks expensive to build." (craft)
2. "I know what to do here." (clarity)
3. "I'd give these people my data." (trust)

## 2. Why the first version looked boring, and the fix

| Boring | Modern |
|---|---|
| Everything at the same visual weight | A clear hero on every screen: a big title, a big number, or a rich preview. Everything else steps back. |
| Flat white page with hairlines only | Three surface layers (canvas, surface, raised) so panels, popovers and focus areas sit at different depths. |
| Type scale too tight (22px titles, 14px body) | Big contrast between levels: 28 to 40px titles, 14px UI, 12px meta. Titles with tight tracking and heavy weight. |
| Grey on grey on grey | Neutrals with a slight cool tint, one confident accent, and semantic colour used for real meaning. |
| Plain tables and forms | Tables with avatars, inline status, sparklines, hover actions and a sticky header. Forms grouped into sections with side descriptions. |
| No motion | Short, physical motion that shows cause and effect: panels slide, rows highlight, numbers tick. |
| Empty states that say "No data" | Empty states that teach, with an icon, a sentence and a primary action. |
| Generic icons at random sizes | One icon family (Fluent), consistent size and weight, filled only for "selected". |

## 3. Principles

1. **One hero per screen.** Decide what the screen is for and make that thing the biggest, richest element. Everything else is supporting cast.
2. **Depth explains hierarchy.** Canvas is furthest back, content surfaces sit on it, popovers and dialogs float above. Never use depth as decoration.
3. **Contrast in type, calm in colour.** Personality comes from scale, weight and spacing, not from many colours.
4. **One accent, used with intent.** The accent marks the primary action, the current location, selection, focus and the single signature moment. Nothing else.
5. **Density is a choice.** Tight where people scan (tables, lists), generous where people read or decide (forms, pricing, empty states).
6. **Details are the brand.** Keyboard hints, live counts, relative times, hover actions, smooth focus. These are what make a product feel cared for.
7. **Familiar patterns, crafted well.** Never invent navigation to look new. Make standard patterns feel premium.
8. **Every state designed.** Default, hover, focus, active, selected, disabled, loading, empty, error, success, offline.
9. **Honest by default.** Real numbers, visible consequences, no dark patterns, no hype.

## 4. Foundations

### 4.1 Colour

Neutrals carry a slight cool tint so the interface feels intentional, not default grey. Contrast is measured on white (W) and on canvas (C).

```css
:root{
  /* Surfaces: three depth layers */
  --canvas:#f6f7f9;          /* app background, sidebars */
  --surface:#ffffff;         /* main content panels, cards, fields */
  --raised:#ffffff;          /* popovers, menus, dialogs (plus shadow) */
  --sunken:#eef1f4;          /* wells, code, segmented-control tracks, skeletons */

  /* Text */
  --ink:#0e1726;             /* 18.0:1 W */
  --ink-2:#3a4557;           /* 9.7:1 W */
  --muted:#5b6678;           /* 5.8:1 W, 5.4:1 C. Also placeholders */

  /* Lines */
  --border:#e4e7ec;          /* dividers and card edges, decorative */
  --border-strong:#d3d8e0;   /* table header rule, panel edge */
  --control:#7d8898;         /* input and secondary-button borders, 3.6:1 W */

  /* Accent (brand layer). Default: ultramarine */
  --accent:#2f5be0;          /* 5.7:1 W, white text on it 5.7:1 */
  --accent-strong:#2446b8;   /* hover, pressed, accent text on tinted bg */
  --accent-soft:#ebf0fd;     /* selected rows, active nav fill, soft badges */
  --accent-ring:rgba(47,91,224,.22);

  /* Semantic: text-safe on white */
  --ok:#16794a;   --ok-soft:#e8f5ee;
  --warn:#8a5300; --warn-soft:#fdf3e1;
  --danger:#c0281c; --danger-soft:#fdeceb;
  --info:#0e6a96; --info-soft:#e6f2f8;
}

[data-theme="dark"]{
  --canvas:#0b0d11; --surface:#13161c; --raised:#1a1e26; --sunken:#0f1216;
  --ink:#eceff4; --ink-2:#b8c0cc; --muted:#8d97a6;
  --border:#232833; --border-strong:#2d3340; --control:#626d80;
  --accent:#7c9bff; --accent-strong:#a3b8ff; --accent-soft:#1b2440; --accent-ring:rgba(124,155,255,.3);
  /* text on accent buttons in dark: #0b1330 */
  --ok:#4ccf8f; --warn:#f0b44c; --danger:#ff8d80; --info:#6cc4ef;
}
```

Rules:
- Neutrals about 90% of any screen, accent under 10%, semantic colour only where it means something.
- Text is only `--ink`, `--ink-2` or `--muted`.
- Anything that defines a control's edge uses `--control` (3:1 or better). Dividers use `--border`.
- Status is never colour alone: always an icon or dot plus a word.
- Accent alternatives (all at least 4.5:1 on white): teal `#0b5d7f`, indigo `#4f46e5`, emerald `#047857`, violet `#6d3fd4`, graphite `#1f2937`. Derive strong (about 20% darker) and soft (about 92% white).
- Dark mode is first-class, not an afterthought. Depth in dark comes from lighter surfaces, not shadows.

**Data colours** (charts only, in this order): `#2f5be0`, `#12a594`, `#e5913a`, `#d6409f`, `#7c66dc`, `#5b6678`. One series in accent, the rest neutral where possible.

### 4.2 Typography

**Family.** One modern grotesque with a variable weight axis. Default **Geist**. Alternatives: Inter Display plus Inter, Instrument Sans, Onest, or Segoe UI Variable when the product is Microsoft-adjacent (it pairs naturally with Fluent icons). Add a monospace (Geist Mono or JetBrains Mono) only for code, IDs and keyboard keys.

**Scale** (desktop / phone):

| Role | Size / line | Weight | Tracking |
|---|---|---|---|
| Display | 56 / 1.05 (36) | 600 | -0.035em |
| Title 1 (page) | 32 / 1.15 (26) | 600 | -0.025em |
| Title 2 (section) | 22 / 1.25 (20) | 600 | -0.015em |
| Title 3 (card, dialog) | 16 / 1.35 | 600 | -0.005em |
| Body large (reading) | 16 / 1.6 | 400 | 0 |
| Body (UI) | 14 / 1.5 | 400 / 500 | 0 |
| Small | 13 / 1.45 | 400 / 500 | 0 |
| Meta | 12 / 1.4 | 500 | 0.005em |
| Big number | 40 / 1 (32) | 600 | -0.03em, tabular |

Rules:
- Titles are heavy and tight. Body is relaxed. The gap between them is what makes it feel modern.
- Sentence case everywhere. No all-caps eyebrows, no tracked-out labels.
- Tabular numerals for any number that aligns or changes.
- Reading text 60 to 75 characters wide. Left-aligned.
- At most four sizes in any one region.
- Never colour or italicise one word of a headline for effect.

### 4.3 Spacing, grid, density

- 4px base. Steps: 2, 4, 6, 8, 12, 16, 20, 24, 32, 40, 48, 64, 96, 128.
- Proximity: inner gaps at most half of outer gaps.
- Containers: reading 720, content 1120, wide 1280, max 1440. Gutters 16 / 24 / 32.

| Density | Control | Row | Body | Use |
|---|---|---|---|---|
| Compact | 28 | 36 | 13 | Pro tools, data |
| Default | 32 | 44 | 14 | Most products |
| Comfortable | 40 | 52 | 15 | Public, touch, novices |

Touch targets at least 44px on touch devices regardless of density.

### 4.4 Shape

- Controls (buttons, inputs, chips): **8px**.
- Cards, panels, popovers: **12px**.
- Dialogs, sheets, large media: **16px**.
- Pills, avatars, switches: full.
- Nested radius = outer radius minus padding. Never mix in a 0px or 24px+ "bubble" style.

### 4.5 Depth and elevation

Modern depth is a crisp 1px edge plus soft, layered shadow. Never one heavy blur.

```css
--shadow-xs: 0 1px 2px rgba(14,23,38,.06);
--shadow-sm: 0 1px 2px rgba(14,23,38,.06), 0 2px 6px -1px rgba(14,23,38,.06);
--shadow-md: 0 0 0 1px rgba(14,23,38,.05), 0 4px 10px -2px rgba(14,23,38,.08), 0 12px 24px -6px rgba(14,23,38,.10);
--shadow-lg: 0 0 0 1px rgba(14,23,38,.06), 0 8px 16px -4px rgba(14,23,38,.10), 0 24px 48px -12px rgba(14,23,38,.18);
--highlight: inset 0 1px 0 rgba(255,255,255,.16);   /* top edge on filled buttons */
```

| Layer | Use | Style |
|---|---|---|
| 0 Canvas | App background | `--canvas` |
| 1 Surface | Main panel, cards | `--surface`, 1px `--border`, `--shadow-xs` |
| 2 Raised | Dropdowns, menus, hover cards, toasts | `--raised`, `--shadow-md` |
| 3 Overlay | Dialogs, sheets, command palette | `--raised`, `--shadow-lg`, scrim `rgba(14,23,38,.4)` with 4px backdrop blur |

Sticky bars may use `rgba(255,255,255,.8)` with a 12px backdrop blur and a bottom border. No other glass, no glows, no coloured shadows.

### 4.6 Icons: Fluent UI System Icons only

Use **Microsoft Fluent UI System Icons** for every icon. No other set, no emoji, no hand-drawn SVGs unless the icon does not exist in Fluent (then draw it to match: 1.5px optical stroke, rounded joins, same grid).

Source:
- React: `@fluentui/react-icons` (for example `<Add20Regular />`, `<Search20Regular />`, `bundleIcon(HomeFilled, HomeRegular)` for nav).
- Plain HTML or other frameworks: the SVGs from `microsoft/fluentui-system-icons`, or Iconify with the `fluent:` prefix (for example `fluent:add-20-regular`).

Rules:
- **Regular** style by default. **Filled** only for the selected or active state (current nav item, selected tab, toggled favourite).
- Sizes: **20** in standard UI, **16** in dense rows, chips and inline text, **24** for nav on touch and empty-state icons, **32 or 48** only for empty states and feature tiles. Use the icon's native size variant, never scale a 20 to 22.
- Colour: `currentColor`. Default `--muted`, `--ink` on hover or when it is the only content, accent when selected.
- Icons sit on the text's cap height, with 6 to 8px gap to the label.
- Icon-only buttons are 32px square (28 compact), have an accessible name and a tooltip with the shortcut if there is one.
- Use the same icon for the same concept everywhere.

Standard mapping:

| Concept | Fluent icon | Concept | Fluent icon |
|---|---|---|---|
| Add / new | Add | Close | Dismiss |
| Search | Search | Confirm / done | Checkmark |
| Filter | Filter | More actions | MoreHorizontal |
| Sort | ArrowSort | Expand | ChevronDown / ChevronRight |
| Edit | Edit | Back | ArrowLeft |
| Delete | Delete | External link | Open |
| Copy | Copy | Link | Link |
| Share | Share | Upload / download | ArrowUpload / ArrowDownload |
| Settings | Settings | Home | Home |
| User | Person | Team | People |
| Notifications | Alert | Calendar / date | Calendar |
| Info | Info | Warning | Warning |
| Error | ErrorCircle | Success | CheckmarkCircle |
| View / preview | Eye | Hide | EyeOff |
| File | Document | PDF | DocumentPdf |
| Image | Image | Lock / security | LockClosed |
| Sign out | SignOut | Menu | Navigation |

### 4.7 Motion

Motion shows cause and effect. It is fast and physical.

| Use | Duration | Easing |
|---|---|---|
| Hover, press, colour | 100 to 150ms | ease-out |
| Popover, menu, tooltip | 150ms, scale 0.97 to 1 plus fade, from the trigger | `cubic-bezier(.2,.8,.2,1)` |
| Sheet, drawer, dialog | 220ms, slide 8 to 16px plus fade | `cubic-bezier(.2,.8,.2,1)` |
| Layout change, list reorder | 200 to 250ms | ease-in-out |
| Number change | count up over 400ms | ease-out |

- Pressed buttons scale to 0.98.
- New or changed rows flash `--accent-soft` for 1.2s, then fade.
- Skeletons have a slow, low-contrast shimmer (1.6s).
- One orchestrated moment per page at most (for example a dashboard's numbers counting up on first load). No staggered entrance on every section, no parallax, no looping animation, no confetti.
- `prefers-reduced-motion`: remove movement, keep instant state changes.

## 5. Signature details

These small things are what make a product feel modern and cared for. Use them throughout.

- **Command palette** on Ctrl/Cmd+K: search plus actions, grouped, with icons and shortcut hints.
- **Keyboard hints** in menus and tooltips (`kbd` chips: 11px, 1px border, 4px radius, `--sunken`).
- **Hover actions** on rows and cards: icon buttons appear on the right on hover and focus, and are always reachable by keyboard.
- **Inline editing** of titles and simple fields, with Enter to save and Esc to cancel.
- **Live, relative time** ("2 min ago") with the exact time in a tooltip.
- **Avatars and avatar stacks** for ownership and collaboration (24px, 2px surface ring, overlap -6px, "+3" overflow).
- **Sparklines and deltas** next to key numbers ("+12.4% vs last month", arrow icon, green or red text with a word, not colour alone).
- **Split buttons** when a primary action has variants (Publish / Schedule).
- **Optimistic updates with Undo** in a toast.
- **Sticky contextual toolbar** that appears when rows are selected ("3 selected", actions, clear).
- **Copy-to-clipboard** on IDs, links and codes, with the icon turning to a checkmark for 1.5s.
- **Progress that tells the truth**: a determinate bar with a count when progress is known.
- **Thoughtful empty states**: a 48px Fluent icon in a soft accent circle, a title, one sentence, a primary action and a secondary "Learn more".

## 6. Layout patterns

Pick the pattern that fits the screen. These are compositions, not boxes to fill.

**App shell**
```
┌────────┬──────────────────────────────────────────────┐
│ Sidebar│ Top bar: breadcrumb · search (⌘K) · actions  │
│ 240px  ├──────────────────────────────────────────────┤
│ canvas │  Surface panel (12px radius, 8px inset from  │
│        │  canvas on desktop) holding the page          │
│        │                                               │
└────────┴──────────────────────────────────────────────┘
```
The main content sits on a white surface panel inset into the canvas, so the app reads as layered rather than flat.

**Page header** (every page)
```
Title 1                                     [Secondary] [Primary ▾]
One line of context: owner avatar, count, last updated 2 min ago
[Tab] [Tab] [Tab]                           (optional view tabs)
```

**Dashboard: asymmetric, not a card grid**
```
┌───────────────────────────────┬──────────────┐
│ HERO: the one metric that     │ Needs        │
│ matters, big number + chart   │ attention    │
│ (spans 2/3)                   │ (list, 1/3)  │
├──────────┬──────────┬─────────┴──────────────┤
│ metric   │ metric   │ Recent activity        │
│ + spark  │ + spark  │ (feed with avatars)    │
└──────────┴──────────┴────────────────────────┘
```
Tiles differ in size because their content differs in importance. Never a grid of identical cards.

**List and detail**
```
┌ Toolbar: search · filter chips · view toggle ──── [New] ┐
│ Table (sticky header, hover actions, row status)       │──▶ Detail opens in a
│                                                        │    right sheet (480px)
└ Pagination or "Load more" with counts ─────────────────┘    without leaving the list
```

**Editor / form**
```
Section title          ┃  Field
Short description of   ┃  Field   Field
what this group is     ┃  Field
for (1/3 width)        ┃  (2/3 width)
──────────────────────────────────────────────
Sticky footer: unsaved changes · [Discard] [Save changes]
```

**Settings**: left sub-nav, right content in sections with the same 1/3 + 2/3 description pattern. Destructive settings in a final "Danger zone" section with a danger border.

**Marketing or landing**: a hero with a real product screenshot (12px radius, `--shadow-lg`, slight perspective allowed), one headline, one supporting line, one primary call to action. Then proof (specific numbers with sources, permitted customer logos), then three to five feature sections that alternate text and real UI crops, then pricing, then FAQ.

## 7. Components

Sizes are for Default density.

**Buttons** (32px high, 8px radius, 13 to 14px, weight 500, 12px padding, 6px icon gap, 20px icon)
- Primary: accent fill, white text, `--highlight` plus `--shadow-xs`. Hover `--accent-strong`. Pressed scale 0.98.
- Secondary: `--surface`, 1px `--control` border, `--shadow-xs`. Hover `--sunken`.
- Ghost: no border, `--ink-2`. Hover `--sunken`. Used in toolbars.
- Danger: `--danger` fill, only in confirmations. Elsewhere a ghost button with danger text.
- Loading: spinner replaces the icon, label stays, width stays.
- One primary per view.

**Inputs** (32px, 8px radius, 1px `--control`, `--surface`, `--shadow-xs`)
- Focus: accent border plus 3px `--accent-ring`.
- Leading icon (Search, Calendar), trailing affordance (clear, unit, kbd hint).
- Label above (13px, 500, `--ink-2`), hint below (12px, `--muted`), error below in `--danger` with an ErrorCircle icon.
- Never grey-filled, never placeholder-as-label.

**Selection**: checkbox and radio 16px with accent fill and a smooth check; switch 32 x 18 for instant settings; segmented control on a `--sunken` track with the selected segment raised (`--surface`, `--shadow-sm`); dropdowns and comboboxes as raised popovers with icons, descriptions and checkmarks; multi-select shows chips with a Dismiss icon.

**Tables**
- Sit inside a surface panel with a 12px radius.
- Sticky header, 12px/500 `--muted`, `--border-strong` underline.
- 44px rows, `--border` dividers, hover `--canvas`, selected `--accent-soft` with a 2px accent bar on the leading edge.
- First column carries identity (avatar or file icon, name, secondary line). Numbers right-aligned, tabular.
- Status as a soft badge. Hover actions on the right. Checkbox column for bulk actions, which reveal the sticky contextual toolbar.
- Column sorting with ArrowSort icons. Empty and loading states in place.

**Badges and status**: 22px, full radius, soft tinted background (`--ok-soft` etc.) with matching text, a 6px dot or 12px Fluent icon, plain words. Neutral badge on `--sunken`.

**Cards**: only for discrete objects with their own actions. `--surface`, 1px `--border`, 12px radius, `--shadow-xs`, 16 to 20px padding. Hover raises to `--shadow-sm` and darkens the border; the whole card is clickable with a visible focus ring. Never nested.

**Navigation**
- Sidebar items 32px, 8px radius, 20px Regular icon. Active: `--accent-soft` fill, `--accent-strong` text, **Filled** icon.
- Section labels 12px/500 `--muted`, sentence case.
- Collapsible to a 56px icon rail with tooltips.
- Tabs: 2px accent underline, Filled icon on the selected tab if tabs have icons.
- Breadcrumbs with ChevronRight separators.

**Overlays**
- Popover and menu: `--raised`, `--shadow-md`, 12px radius, 4px padding, 32px items with icon, label and shortcut.
- Sheet (side panel): 480px, 16px radius on the inner edge, `--shadow-lg`, header with title and Dismiss, sticky footer actions.
- Dialog: 440px (560 for forms), 16px radius, `--shadow-lg`, title with a 20px icon for destructive or important actions, one or two sentences, actions right-aligned.
- Tooltip: `--ink` background, white 12px text, 6px radius, 400ms delay, includes a shortcut chip when one exists.
- Toast: bottom-right, `--raised`, `--shadow-lg`, icon, one line, optional Undo, auto-dismiss after 5s. Errors never go in toasts.

**Feedback states**
- Skeleton: `--sunken` blocks in the real layout, shimmer.
- Inline alert: soft semantic background, 12px radius, icon, title, one sentence, optional action.
- Banner: full width at the top of the content for system conditions.
- Empty state: see section 5.

**Charts**: no chart junk. Thin gridlines in `--border`, axis text 12px `--muted`, the focus series in accent with a soft gradient area fill (accent at 16% fading to 0%), the rest in neutrals, direct labels, a crosshair tooltip on `--raised`. Always units and "as of".

## 8. Content and voice

Calm, exact, friendly, brief. A capable colleague, never a salesperson.

- Sentence case everywhere.
- Buttons name the outcome ("Send invoice", "Delete project"). The same action keeps the same name through its flow ("Publish" becomes "Published").
- Numbers and specifics instead of adjectives ("Synced 1,204 records in 3s", not "Lightning-fast sync").
- Errors: what happened, why if known, what to do. No apology, no blame, no "Oops".
- Confirmations name the object and the consequence ("Delete 3 files? This can't be undone.").
- Empty states teach and invite.
- Avoid: revolutionary, seamless, effortless, cutting-edge, supercharge, unlock, game-changing, world-class, "AI-powered" as a label, exclamation marks, emoji.
- One name per concept across the product.
- Formats: "19 Nov 2026", locale-aware numbers and currency, 24-hour or locale time, relative time only within 7 days.

## 9. Trust moments

| Moment | Rule |
|---|---|
| Money | Total, fees, currency and date shown before commit. Receipt immediately. No pre-ticked add-ons. |
| Destructive actions | Name the object, state the consequence, specific verb on the button, Undo where possible, type-to-confirm only for irreversible high-impact actions. |
| Sharing and access | Show who can see it, with avatars. Default to private. |
| Security | Last sign-in, active sessions, two-step status. Plain explanation of data use. Export and delete easy to find. |
| Consent | Accept and decline with equal weight. No confirm-shaming. |
| Outages | Keep the user's input, say what is affected, link to status, say when to retry. |
| AI output | Labelled, with sources where there are any, editable, undoable, no human persona. |
| Proof | Specific, sourced numbers and permitted logos. Never "Trusted by thousands". |

## 10. Accessibility and performance

- WCAG 2.2 AA minimum: text 4.5:1, large text and control edges 3:1, visible focus everywhere (2px accent outline with 2px offset, or the input ring).
- Full keyboard support, logical focus order, focus trapped in overlays and returned after.
- Labels on every input, errors tied with `aria-describedby`, `role="status"` for live updates.
- Targets at least 24px (44px on touch). Reflow at 400% zoom.
- Colour never the only signal.
- Logical CSS properties throughout so right-to-left works. Leave 30 to 40% room for translation.
- Performance: LCP under 2.5s, CLS under 0.1, INP under 200ms. Reserve space for media, swap fonts without layout shift.

## 11. Never

- Gradient meshes, blobs, purple-to-pink gradients, neon on black, glowing borders, 3D renders as decoration.
- A grid of identical cards with identical shadows to present features or metrics.
- The giant gradient number with three tiny stats as a hero.
- All-caps tracked eyebrows, middle-dot meta strings ("A · B · C"), an arrow on every link, one coloured word in each headline, monospace for ordinary labels.
- Mixed icon sets, emoji as icons, icons scaled off their native sizes.
- Stock photos, AI-generated faces, device mock-ups with fake data, lorem ipsum, "John Doe".
- Fake testimonials or numbers, countdowns, fake scarcity.
- Modals on page load, autoplay with sound, disabled paste or zoom, hover-only essential actions, errors in toasts.
- Spinners where a skeleton fits, layout shift while loading.

## 12. How to apply

1. Fill in section 14.
2. Put every token (colour, type, space, radius, shadow, motion) in one place. Nothing in the product hard-codes a value.
3. For each screen, write one line: "The hero of this screen is ___." Build around that.
4. Choose a layout pattern from section 6 and a density from 4.3.
5. Build only from the components in section 7. If a new one is needed, specify it in the same terms first.
6. Add at least three signature details from section 5 to every product.
7. Use realistic content. Mark sample data as sample.
8. Design light and dark together.
9. Check the scorecard, then list any rule you broke and why.

## 13. Scorecard

- **Five-second test:** a stranger says it looks crafted, clear and trustworthy.
- **Hero test:** you can point to the one thing each screen is about.
- **Squint test:** the hierarchy holds with the screen blurred.
- **Depth test:** canvas, surface and raised layers are distinguishable in both themes.
- **Icon test:** every icon is Fluent, Regular unless selected, at a native size.
- **Detail test:** at least three signature details are present.
- **State test:** loading, empty, error and selected states exist for every list and form.
- **Keyboard test:** everything works without a mouse, focus always visible.
- **Greyscale test:** nothing depends on colour alone.
- **Copy test:** no hype, no exclamation marks, every button names its outcome.
- **Consistency test:** any two screens side by side share identical components.

## 14. Brand layer (fill in once)

| Item | Value |
|---|---|
| Product name and one-line purpose | |
| Audience and density (Compact / Default / Comfortable) | |
| Accent colour (default ultramarine `#2f5be0`, or an alternative from 4.1) | |
| Font (default Geist) and script fallbacks for your languages | |
| Logo (clear space equal to its height, minimum 24px high) | |
| Theme default (light, dark, or follow system) | |
| Languages, direction, locale, time zone | |
| Regulated domain notes (finance, health, public sector) | |
| Two voice words within "calm, exact, friendly" | |

Fixed regardless of brand: Fluent UI icons, the neutral and surface structure, type scale, spacing, radii, elevation, motion, components, state coverage, accessibility baseline and the Never list.