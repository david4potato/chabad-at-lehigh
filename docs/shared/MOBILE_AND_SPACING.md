# Mobile and spacing standard (shared by every site)

The project owner, 20 October 2026: "eveyrthing needs to work on mobile and be spaced right too for all sites
you can be consitent everywher too".

Every site follows these numbers, so all our sites feel alike on a phone and on a laptop. Each
site keeps its own colors, type and look. Only the spacing and the mobile rules are shared.

## 1. Widths we check

| Device | Width | Must look right |
|---|---|---|
| Small phone | 320 px | Yes |
| Phone | 375 px and 390 px | Yes (the main target) |
| Tablet | 768 px | Yes |
| Laptop | 1280 px | Yes |
| Wide screen | 1440 px | Content stays centered and readable |

## 2. Layout

- **Mobile first.** Write the phone layout first, then add wider layouts at 640, 768 and 1024 px.
- **Side gutters:**
  - 16 px on phones;
  - 24 px from 640 px;
  - 32 px from 768 px.
- **Content width.** Page content sits in a centered column at most 1152 px wide (Tailwind
  `max-w-6xl`). Long text stays at most 70 characters wide (about `max-w-prose`).
- **No sideways scroll** at any width. Tables scroll inside their own box, and nothing else
  overflows the page.
- **Grids.** Cards are one column on phones, two from 640 px and three from 1024 px, with a 16 px
  gap on phones and 24 px wider.
- **Sticky headers** take at most 64 px on phones. The site works in landscape and with the
  phone's safe areas (`env(safe-area-inset-*)`).

## 3. Spacing scale

Use only these steps: 4, 8, 12, 16, 24, 32, 48 and 64 px (Tailwind 1, 2, 3, 4, 6, 8, 12, 16).

| Space | Phone | From 768 px |
|---|---|---|
| Between page sections | 48 px | 64 px |
| Heading to its text | 12 px | 16 px |
| Between paragraphs | 16 px | 16 px |
| Inside cards | 16 px | 24 px |
| Between form fields | 16 px | 16 px |

## 4. Text

- Body text is at least 16 px, with a line height of 1.5 to 1.6. Small print is at least 14 px.
- Headings scale down on phones: the page title is about 28–32 px on a phone and 40–48 px on a
  laptop. Nothing breaks mid-word, and long words or URLs wrap (`overflow-wrap: anywhere`).
- Form inputs use 16 px text, so phones don't zoom in when someone taps them.

## 5. Touch and controls

- Buttons, links in menus, and form controls are at least 44 by 44 px, with at least 8 px between
  neighbors. Links inside sentences are exempt.
- Navigation collapses into a menu button under 768 px. The menu opens and closes with the
  keyboard, and Escape closes it.
- Focus rings are always visible. Color is never the only signal.

## 6. Images, visuals and documents

- Images and SVG visuals scale to the column (`max-width: 100%; height: auto`). They carry `alt`
  text, or `alt=""` if they're only decorative.
- Large visuals open full size on tap. One-page PDFs and PNGs have a link that says the file type
  and size.
- Hero images never push the page's first words below the fold on a 375 px phone.

## 7. Status line and footer

- The planning-phase line sits in small text (14 px) under the page title or in the footer, never
  as a top banner.
- The footer stacks into one column on phones, with 16 px between groups.

## 8. Check it before calling a site done

Run the shared check (Node 18+, with Playwright installed):

```bash
node docs/shared/mobile-check.mjs http://localhost:3000 / /summary /brief
```

It loads each page at 320, 375, 390, 768 and 1280 px and reports:

- sideways scroll;
- elements wider than the screen;
- buttons and menu links smaller than 44 px;
- body text under 14 px;
- inputs under 16 px;
- images without `alt`.

It saves a screenshot of each page at each width in `mobile-check/`, for a quick look by eye. Fix
everything it reports, look at the 375 px and 1280 px screenshots, and then the site is ready.

Copy this file and `mobile-check.mjs` into any project's `docs/shared/` unchanged. The Project OS
repository owns the master copy.
