# LDIF Builder design system

This design replaces the former dark/neon interface. `style.css` is the only
stylesheet; `theme.js` provides shared interface behavior, with no accent picker,
stored theme preference, decorative animation, external fonts, or theme overrides.

## Brand layer

| Item | Decision |
| --- | --- |
| Product | LDIF Builder — browser-based tools for preparing directory data |
| Audience | Directory administrators and operations teams; precise language, keyboard and pointer support |
| Density | Default: 14px UI text, 36px controls; 44px controls on touch devices |
| Accent | Deep teal, #0b5d7f; strong #094963; soft #e7eff2 |
| Font | Inter when installed, with system sans and Noto Sans fallbacks; no font download |
| Logo | Neutral outline document mark, 32px in the navigation rail |
| Language | English, left-to-right; logical CSS properties support future RTL work |
| Locale and time | Browser locale; these screens do not request dates or times |
| Domain | Directory data preparation; no new regulated-domain or certification claims |
| Voice | Exact and plain-spoken |

## Screens and states

| Screen | Required states |
| --- | --- |
| Overview | Tool navigation, clearly labeled sample preview, help/privacy/security dialogs |
| CSV to LDIF | Empty upload, reading/error, loaded file, create/modify selection, group operations, field mapping, custom-attribute dialog, validation, output, copy confirmation/error, download, reset |
| LDIF to CSV | Empty/upload/paste, reading/error, attribute selection, optional split editing and validation, preview, copy confirmation/error, download, reset |
| LDIF cleaner | Attribute-update and comparison modes, empty/upload/reading/error, operation editor, duplicate/no-match results, generated output, downloads, reset |
| Error fixer | Empty/upload/reading/error, error-log input, analysis, missing-value input, fixed/unresolved results with text labels, output, reports, reset |
| Shared | Hover/focus/active/disabled controls, keyboard file selection, keyboard mapping, offline notice retaining work, responsive navigation, native dialog focus trapping and return, reduced motion |

## Foundations and components

All colour, typography, space, shape, elevation, and motion tokens live at the
start of `style.css`. Main sections use whitespace and hairlines. Navigation,
buttons, forms, upload targets, output previews, result rows, and dialogs share
one implementation across the product.

New composed components are the workspace rail/header/footer, overview tool row,
explicitly labeled sample conversion preview, and data-handling/help dialogs.
File reading uses a delayed progress indicator. Validation and errors stay inline;
copy feedback appears beside the preview action. No product data is sent externally.

## Intentional limits and brief exceptions

- The brief requires company contact, Terms, and Status links. No company identity,
  contact address, legal documents, or status service was supplied. These have not
  been fabricated. The footer provides the real guide and factual Privacy and
  Security information; company destinations can be added when available.
- Existing conversion, schema-validation, and persistence limits still apply.
  The redesign does not claim server validation, saved work, or LDAP connectivity.
- There is no arbitrary file-size limit in the existing tool. Upload guidance states
  accepted extensions and the actual constraint: available browser memory.
- The filled product logo is replaced by a neutral outline mark. System fonts avoid
  external requests and webfont layout shifts when Inter is not installed.

The sample preview uses reserved example.com addresses and is explicitly marked
as sample data. Version 1.0.0 is retained from the existing interface.

## Verification

Checked in headless Chromium on 19 Nov 2026:

- All five pages reflow at 320, 360, 375, 720, 768, 1024, and 1440px.
- Sample CSV mapping and LDIF generation, including modify mode and downloads.
- LDIF paste, attribute selection, CSV downloads, and split-rule validation.
- Cleaner attribute updates, duplicate comparison, and resulting counts.
- Error matching, generated modify records, and fixed/unresolved results.
- Custom-attribute validation, Escape, help-dialog focus return, keyboard uploads,
  mapping focus retention, dynamically named fields, and loaded mobile editors.
- Copy success and denied-clipboard feedback, offline notices, and reduced motion.
- No page exceptions or external network requests in the exercised workflows.

These checks establish the exercised browser behavior; they are not a complete
accessibility, performance, or directory-schema certification.
