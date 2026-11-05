# Assembled

A concept portfolio unpacked from a single idea box, built by a crew of collaborators while the page scrolls itself. Built with Vite, React, TypeScript, GSAP and original inline SVG artwork.

## Run

Requires Node.js 22.23+, 24.22+, or 26.12+ for the Cloudflare CLI.

```sh
npm install
npm run dev
```

The development server starts at http://localhost:5173. `npm run build` creates the static `dist/` site; `npm run preview` previews the production build.

## Behavior

- A crisp idea box fills and opens. Two collaborators carry a desk and chair into the bottom-left corner, then the working crew immediately sets off from that station. It remains the source and handoff point for later assignments.
- The page automatically scrolls through the construction sequence. Pause/resume and replay controls remain available; manual wheel, touch and keyboard input let the visitor take over.
- Collaborators work in pairs on frames, text boxes, copy, typography, colors, components and alignment. A twelve-person detail crew handles copy, artwork and small shapes in parallel. Collaborators return to the box after each assignment before departing for the next. Images are inserted in place with a simulated right-click and Paste selection.
- Every technology chip is built as a background, pasted icon, and written label. Twelve rectangle builders and twelve colorists cooperate on the demonstration activity grid: drag a rectangle, place a neutral square, click to select, then apply its color. Crews return between short groups of cells. Decorative menus follow their operating cursor and share collision-aware viewport placement.
- The project grid assembles one row at a time. Projects, toolkit and demonstration activity are a passive canvas; the simulated collaborators do the editing.
- The bottom dock pauses/resumes the automatic tour, replays the composition, switches motion off/on, and reports scroll progress.
- OS reduced-motion preference shows the completed layout immediately. Normal text and links remain semantic HTML.

## Personalize

This is explicitly a **fictional concept portfolio**, not a real profile. Change the Alex Morgan profile and `hello@example.com` placeholders in `src/App.tsx` and `src/components/PortfolioSections.tsx` before using it as a personal site. The projects, experience and contribution activity are demonstration content. All illustrations are original SVG code in `src/components/Illustrations.tsx`.

- `src/App.tsx`: navigation, profile, About and controls.
- `src/styles.css`: overall composition, typography and responsive rules.
- `src/components/PortfolioSections.tsx`: projects, case studies, experience, toolkit, demonstration activity and contact.
- `src/components/portfolio-sections.css`: section styling.
- `src/motion/useAssembly.ts`: GSAP timelines, scroll boundaries and lifecycle cleanup.
- `src/motion/assembly.css`: cursors, selection frames, handles and emission bursts.
- `src/components/CreationBox.tsx`: opening sequence and persistent creation source.
- `src/motion/useAutoTour.ts`: independent automatic scroll camera and playback control.

Google Fonts supplies Manrope, DM Sans and IBM Plex Mono; system fallbacks are configured. The site needs no backend or API key. Cursors simulate collaboration; they are not live users.

## Build and preview

```sh
npm run build
npm run preview
```

Automated tests are intentionally absent. They will only be added after the finished site is approved by its owner.

## Deploy to Cloudflare

The site uses Workers Static Assets, configured in `cloudflare.config.ts` for the `sites-test` Worker and `sites-test.krishang.dev`. A separate Vite configuration produces Cloudflare Build Output while preserving the regular local preview commands.

```sh
npx cf auth login
npm run deploy
```

For a build and deployment check without publishing:

```sh
npm run build:cloudflare
npx cf deploy --prebuilt --mode production --dry-run
```

`npm run deploy` builds and publishes the site and its configured custom domain. For CI, provide `CLOUDFLARE_API_TOKEN` through the CI secret store. Credentials, local Cloudflare output, and environment files are excluded from Git.

The optional `node scripts/cloudflare-assets.cjs manifest` command describes the built assets for the [Cloudflare direct-upload API](https://developers.cloudflare.com/workers/static-assets/direct-upload/). Its `upload` mode reads one JSON object `{ "jwt": "...", "buckets": [], "accountId": "..." }` from standard input and returns JSON containing a completion `jwt` and an upload report. Capture its output securely; it contains a short-lived credential. The helper never stores credentials and does not create or deploy a Worker.
