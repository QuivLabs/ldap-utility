# LDIF Builder design system v2

The shared interface follows [Design brief v2](docs/design-brief-v2.md). The previous design is preserved in Git commit `f003be0`.

## Brand layer

| Item | Decision |
| --- | --- |
| Product | LDIF Builder — browser tools for preparing directory data |
| Audience and density | Directory administrators and operations teams; Default density, 32px controls, 44px touch targets |
| Accent | Ultramarine #2f5be0; dark #7c9bff |
| Typography | Self-hosted Geist variable; Segoe UI Variable, system sans, Noto Sans fallbacks; system monospace for code and keys |
| Logo | Fluent Document, native 32px; navigation label supplies the product name |
| Theme default | Follow system; Light, Dark, and System controls save only the UI preference |
| Language and direction | English, LTR; logical spacing properties support future RTL work |
| Locale and time | Browser locale and device time zone; file-read times are local and have exact-time tooltips |
| Domain | Directory data preparation; no LDAP connectivity, server validation, or compliance claims |
| Voice | Calm and exact |

## Foundations

`style.css` owns shared colours, typography, spacing, radii, layered shadows, control dimensions, and motion. Canvas, surface, sunken, and raised layers work together in both themes. Panels use 12px radii; controls 8px; dialogs 16px. Dark overlays use lighter surfaces and an explicit edge. Focus, control edges, and text use the brief's contrast tokens.

`appearance.js` applies the saved appearance before paint and follows OS changes when System is selected. Storage failures fall back safely. Only appearance and navigation preferences are persisted; source files, mappings, pasted text, and outputs remain in memory.

All SVGs, including dynamically rendered operation actions, are Microsoft Fluent UI System Icons, vendored with their MIT license in `assets/icons`. Selected navigation and mode tabs use Filled variants; other icons use Regular. Geist and its OFL license are in `assets/fonts`. No runtime CDN or font-service requests are needed.

## Screen hierarchy

| Screen | Hero and layout |
| --- | --- |
| Overview | Large directory-data headline paired with a clearly labelled sample conversion preview; a single tool list supports it |
| CSV to LDIF | File-to-output workflow; source/configuration sections use side descriptions, with full-width mapping where the editor needs room |
| LDIF to CSV | Attribute selection and generated CSV preview |
| LDIF cleaner | Attribute-update output or comparison results, according to the selected mode |
| Error fixer | Matched errors, fixed/unresolved counts, and the proposed LDIF |

The shared shell has a 240px navigation sidebar, inset content surface, breadcrumb, command search, and appearance controls. Desktop navigation collapses to a 56px rail with accessible names and tooltips. Mobile navigation retains visible tool names.

## Signature details and states

- Searchable Ctrl/Cmd+K command palette, grouped actions, shortcut hints, arrow-key selection, Enter, Escape, native dialog focus containment and focus return.
- Copy actions show a Fluent checkmark for 1.5 seconds, announce success beside the output, and keep clipboard errors inline.
- Successfully read files show a relative read time with an exact timestamp tooltip, including files added through drag and drop.
- Tool-row actions and icon wells respond on hover and keyboard focus. Essential labels remain visible.
- Empty editors explain the next step and offer file selection and help. Real file-read progress is shown when the browser reports it; delayed reads also show a skeleton.
- Shared hover, pressed, focus, selected, disabled, empty, loading, error, success, offline, and reduced-motion states. Reduced motion removes animation and movement.

## Scope and brief exceptions

This is a local file-preparation tool. Collaboration avatars, fabricated activity, chart deltas, publishing, and account/security controls would imply capabilities or data it does not have, so they are omitted. Inline editing remains in the actual mapping and operation fields. Output stays directly selectable and downloadable.

The logo is a Fluent document mark rather than an invented brand asset; the compact sidebar does not apply a full logo-height clear space. Native selects and checkboxes retain browser semantics, with a Fluent select chevron. Existing workflow step numbers are retained because they describe the sequence. Empty-state file buttons use secondary styling so each workflow keeps one primary generation action. Input validation and directory-schema limitations remain those documented in the user guide.

## Verification

Checked in headless Edge on 19 Nov 2026:

- All five pages in light and dark at 320, 375, 768, 1024, and 1440px: 50 layouts without horizontal overflow.
- Loaded CSV mapping and output in both themes at 320, 375, 768, and 1440px.
- CSV uploads, field mappings, create/modify LDIF output; LDIF paste, attribute selection, CSV conversion and download; cleaner updates; LDAP error matching and generated modify output.
- Clipboard success and checkmark confirmation; split-rule validation and dynamic Fluent action icons.
- Persisted light/dark themes and 56px navigation rail; command search, empty search, Enter, Escape, and focus return.
- OS theme changes, reduced motion, self-hosted font loading, and 44px touch controls at 320px.
- No page exceptions or external requests in the exercised workflows.

These checks exercise the design and representative conversion workflows; they do not establish a complete WCAG or performance certification.
