# Cursor interpolation experiment

This preview uses the `experiment/cursor-lerp` branch and the isolated `sites-test-cursor-lerp` Cloudflare Worker at `sites-test-cursor-lerp.krishangzinzuwadia.workers.dev`. Its deployment configuration has no custom production domain.

Free cursor travel uses a shared straight-line interpolation helper with a bounded damping curve. It accelerates gently, converges toward the work point and reaches the exact endpoint before the next scheduled action. Helper cursors use a slightly softer response. Progress comes from the existing timeline, keeping reverse scrolling, pause and replay deterministic without another animation loop.

Drawing, text carets, pasted-image clicks, cell painting and moving-element grips still follow their exact targets. All workers, tasks and timeline durations are retained. The preview also includes the production initialization fix for scroll triggers whose end boundary is not yet available.

This is an experiment for visual comparison. Promote the motion changes only after the owner reviews the preview. No automated tests are included.
