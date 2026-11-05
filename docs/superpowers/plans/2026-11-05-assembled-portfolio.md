# Assembled Portfolio Implementation Plan

> **For agentic workers:** Use parallel subagent development with disjoint file ownership and parent integration.

**Goal:** Recreate the reference's collaborative scroll-assembly feel with original portfolio artwork and content.

**Architecture:** Semantic React sections in a centered column. One GSAP hook owns transient cursor/selection overlays and reversible assembly timelines; original inline SVG components render illustration assets.

**Tech Stack:** Vite, React, TypeScript, GSAP/ScrollTrigger, Lucide, CSS.

**Spec:** ../specs/2026-11-05-assembled-portfolio-design.md

## Global constraints
- Original fonts/art; reference layout and assembly mechanism.
- Honor reduced motion, motion off, responsive design and semantic links.
- Demonstration profile/content visibly identified.

## Review focus
- Transform cleanup after disabling/replaying motion.
- Accurate cursor coordinates at different widths.
- Keyboard dialog close and focus return.
- Mobile horizontal overflow and tap target sizes.
- Deep navigation and reverse scrolling leave content readable.

## Tasks
- [ ] 1. Parent: scaffold Vite React TS, app shell, hero/profile/About, global styles and controls.
- [ ] 2. Illustration agent: HeroArt, AvatarArt, ProjectArt and StickerArt SVG components.
- [ ] 3. Content agent: work/experience/toolkit/activity/contact and project dialogs; scoped CSS.
- [ ] 4. Motion agent: useAssembly(root,enabled,replayKey), scroll timelines, cursor overlays and CSS.
- [ ] 5. Parent: integrate, production build, browser checks desktop/mobile/motion/dialog/filter; repair observed issues.
- [ ] 6. Fresh review: requirements/accessibility/motion cleanup; finalize documentation and preview.

## Execution notes
Work in a new isolated portfolio/ project directory; surrounding workspace has no Git repository. No existing application to alter. User has already selected the stack and directed implementation; proceed without an additional design approval interruption.
