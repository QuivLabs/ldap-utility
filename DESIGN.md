# LDIF Builder design system v3: Soft studio

The interface follows the Soft studio brief: a tinted frame (the space) holds a white sheet that floats inside it. The previous v2 design is preserved in Git history.

## Brand layer

| Item | Decision |
| --- | --- |
| Product | LDIF Builder, browser tools for preparing directory data |
| Colour | One colour. Green accent (light #2f8f2f, dark #66ff00) on a neutral frame (light #eef1f5, dark #080808), taken from the earlier themed design. No space switching |
| Font | Self-hosted Figtree variable (OFL, `assets/fonts`), with Inter, system sans and Noto Sans fallbacks. System monospace for code only |
| Logo | Fluent Document, 16px, white on a 26px accent tile |
| Theme default | Follow system. Light, Dark and System controls save only the UI preference |
| Language and direction | English, LTR. Logical CSS properties are used for spacing |
| Domain | Directory data preparation. No LDAP connectivity, server validation or compliance claims |
| Voice | Warm, plain, specific. Sentence case, no exclamation marks |

## How the brief is applied

- **Frame and sheet.** `body` uses `--frame`. The sidebar has no background of its own. `.main` is the 14px-radius sheet, inset 8px, with the sheet shadow. Under 900px the sidebar moves behind a menu button and the sheet goes full bleed.
- **One colour.** `--frame`, `--frame-deep`, `--accent` and `--accent-soft` are fixed per theme. The frame is neutral, and green is used only for actions, selection, focus, progress and the page-icon tile.
- **Bold titles and pages.** `theme.js` adds the 60px page-icon tile and a properties list (Input, Output, Processing) to each tool page, so every view reads as icon, title, one-line description, properties, then blocks. Workflow steps are stacked sections with 20px/700 titles.
- **Tags.** `.tag-green|amber|rose|gray` are the only tag colours; blue and violet were removed. Error-fixer statuses map fixed to green and unresolved to rose, always with a word.
- **Components.** Buttons (primary, soft default, ghost, danger), 36px inputs, rounded-square checkboxes whose tick draws in, segmented view switch for tool modes, pill progress, properties list, callouts on the space colour, key caps, command palette, toast.
- **Icons.** Fluent UI System Icons only, Regular by default and Filled when selected, at native sizes (16 in tags and properties, 20 in the UI, 32 inside page tiles). SVGs are vendored in `assets/icons` with their MIT licence and mirrored in `icons.js`.
- **Motion.** One easing, `cubic-bezier(.2,.8,.2,1)`. Reduced motion removes animation.

## Scope notes

- Collaboration avatars, sharing, favourites and edited-at times are not shown. This is a local file tool and those would imply features that do not exist.
- Toasts are used for copy confirmation. Reset actions clear in-memory state and cannot be restored, so they do not show an Undo toast. Errors stay inline.
- Tool pages keep an 820px reading column. Wide mapping editors stack below 1024px.

## Verification

Checked in headless Edge on 19 Nov 2026: Overview and tool pages in light and dark, the Lilac space, the command palette, the toast, and a 390px layout. Conversion modules (`app.js`, `ldif-to-csv.js`, `ldif-cleaner.js`, `ldif-error-fixer.js`) are unchanged. This does not establish a complete WCAG or performance certification.
