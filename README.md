# Plates & Psyche — Issue No. 01

A continuous-scroll web magazine rebuilt from the group-project PDF (*Comfort Food & Emotional Eating*), with the client's photographs placed into the PDF's photo placeholders, scroll-driven animation, and a downloadable PDF of the finished issue.

- **Live site:** https://suryakasyap.github.io/Chef/
- **PDF of the issue:** [`assets/pdf/Plates_and_Psyche_Magazine.pdf`](assets/pdf/Plates_and_Psyche_Magazine.pdf) (also linked from the site's top bar)
- **Original reference PDF:** `assets/pdf/reference/Plates_and_Psyche_Magazine_original.pdf`

## Stack

| Layer | Choice | Why |
| --- | --- | --- |
| Site | [Jekyll 4.4](https://jekyllrb.com) (Liquid includes + `_data`) | Static, builds on GitHub Pages, no bundler |
| Type | Playfair Display + Inter (Google Fonts) | Matches the PDF's bold serif / neutral sans pairing |
| Motion | [GSAP 3.13](https://gsap.com) + ScrollTrigger + SplitText, [Lenis](https://lenis.darkroom.engineering) smooth scroll | Line-masked text reveals, image curtain reveals with parallax, SVG loop drawing, chart growth, count-ups, dark-theme crossfade into the closing spread |
| WebGL | [three.js](https://threejs.org) r180, custom GLSL | The cover system: the gold orb (the psyche) inside a thin plate-like ring that carries the four stress-eating-loop nodes, orbiting with floating labels; it breathes on a slow pulse, tilts toward the pointer, loads lazily and renders only while on screen |
| Deploy | GitHub Actions → GitHub Pages (`.github/workflows/pages.yml`) | Builds with the same Jekyll version as local |

A hamburger menu (top right, on every screen size) lists every spread by chapter for quick access. The stress-eating loop and the donut chart draw as one continuous sweep when scrolled into view.

Everything degrades: with `prefers-reduced-motion`, without WebGL, with a blocked CDN, or with `?static=1` appended to the URL, the page simply shows all content. `?static=1` is also what the PDF exporter renders.

## Repository layout

```
_config.yml                  site config, CDN versions, baseurl (/Chef)
index.html                   the magazine: one include per PDF spread
_layouts/default.html
_includes/                   head, nav (progress + chapter label), picture (responsive <picture>), sections/*.html
_data/images.yml             generated image manifest (sizes, alt, credit, LQIP)
assets/css/main.css          design system + motion states + print stylesheet
assets/js/main.js            GSAP / ScrollTrigger / Lenis choreography (+ no-motion fallback)
assets/js/cover.js           three.js cover orb (ES module via importmap)
assets/img/originals/        the 15 client-supplied photos, untouched (excluded from the build)
assets/img/magazine/         processed photos: cropped to slot aspect, 2–3 widths, JPEG + WebP
assets/pdf/                  exported issue PDF; reference/ holds the original
scripts/build_images.py      image pipeline (reads scripts/images.json)
scripts/export_pdf.mjs       Playwright print → PDF
scripts/qa_shots.mjs         Playwright screenshots + console/network error capture
```

## Image selection

The PDF contained nine bracketed photo placeholders and no images. Three independent Claude judges (editorial, literal-match, reader) scored the 15 supplied photos against each placeholder; a fourth merged the votes. Result, with the slug used in `scripts/images.json`:

| Placeholder (PDF) | Photo | Notes |
| --- | --- | --- |
| Steaming bowl of ramen, overhead | `ramen-overhead` (Michele Blackwell) | unanimous |
| Khichdi | `khichdi-bowl` (Mario Raj) | unanimous |
| Creamy polenta bowl | `polenta-plate` (Arne Buss) | unanimous |
| Ochazuke | `ochazuke-bowl` (Kouji Tsuru) | unanimous |
| Mac and cheese | `mac-and-cheese-dish` (images.jpg) | unanimous; only 674 px wide, so it lives in a half-width card |
| Home cooked soup bowl | `home-table-soup` (Comfort-Food-Dinners.jpg) | editor's call: the judges' 2–1 pick was the baked casserole (David Trinks), dropped because it duplicated the mac & cheese subject; the client's soup photo is 1024 px so it sits half-width |
| Homemade comfort food plate on table | `pizza-tray` (Nik) | unanimous |
| Burger and fries fast food | `burgers-fries-overhead` (John Fornander) | editor's call for literal fidelity; judges' 2–1 pick was the burger close-up |
| Cauliflower mac and cheese | `cauliflower-mac` (cauli mac.jpg) | unanimous; 640 px, kept half-width |
| *(added)* Editor's note "2am maggi" | `instant-noodles-egg` (Joshua Ryder) | unanimous |
| *(added)* Why sugar and fat always win | `grilled-cheese-pull` (Jay Gajjar) | resolved 3-way split |

Not used: `1000_F_962778494_…jpg` is an **Adobe Stock watermarked comp** and cannot be published (renamed `adobe-stock-comp-…-WATERMARKED.jpg` in `assets/img/originals/`); `david-trinks-…jpg` (baked casserole), `mario--s27nY8mZUE-unsplash.jpg` (burger close-up) and `llio-angharad-…jpg` (grilled cheese stack) are kept as alternates.

## Working locally

```bash
bundle install
bundle exec jekyll serve --livereload          # http://127.0.0.1:4000/Chef/

python3 -m pip install pillow
python3 scripts/build_images.py                # regenerate assets/img/magazine + _data/images.yml

# PDF + visual QA need Playwright (npm i -g playwright && npx playwright install chromium)
bundle exec jekyll build && npx http-server . -p 4173   # then, in another shell:
node scripts/export_pdf.mjs http://127.0.0.1:4173/_site/ assets/pdf/Plates_and_Psyche_Magazine.pdf
node scripts/qa_shots.mjs http://127.0.0.1:4173/_site/ ./qa-out
```

## Deploying

Pushing to `main` runs `.github/workflows/pages.yml`: it builds the site with Jekyll and publishes `_site` to the `gh-pages` branch, which GitHub Pages serves at https://suryakasyap.github.io/Chef/. No repository settings are required for that; if Pages ever shows as disabled, set **Settings → Pages → Source → Deploy from a branch → `gh-pages` / `(root)`**.

## Content notes

Text is reproduced from the PDF verbatim, with two web adaptations: page-number cross-references ("page 6", "page 30") became in-page links, and a photography credit line was added to the references spread.
