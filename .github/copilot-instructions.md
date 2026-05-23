# Copilot instructions — jasonycw.github.io

Purpose
- All files in this folder power the GitHub Pages site. Any change must remain runnable on GitHub Pages (static hosting only).

Commit standards:
- All commits must be iterative, never do multiple thing in one commit. For example, if you need to change the layout and add animation, you should first commit the layout change, make sure it's correct, then commit the animation change.
- All commits must be atomic and self-contained, meaning each commit should represent a single logical change that can be understood and tested independently. Avoid bundling multiple unrelated changes into a single commit.
- All commits must be human-readable and use actual newlines to separate subject, body, and trailers. Do NOT include the two-character escape sequence "\n" anywhere in the commit message.

Preview / build
- Install dependencies and run the dev server: `cd jasonycw.github.io && npm install && npm run test` (this repo uses `webpack-dev-server` under the `test` script).
- To validate the final static output, serve the site locally with a static server: `npx http-server . -p 8080` or `python -m http.server 8080` from the published root. Open `http://localhost:8080/`.

GitHub Pages constraints (must follow)
- No server-side code or server-only runtime dependencies.
- Use only relative URLs for scripts, styles, and assets so the site works when published at `https://<user>.github.io/<repo>/` or repository root.
- If the project produces a build output (e.g., `dist/`), document whether the site publishes from the repository root or a `gh-pages` branch and include exact publish steps.

Testing changes
- Verify locally with `npx http-server` and test the site using the same base path it will have on GitHub Pages (project pages often run under a subpath).
- Check common breakpoints and resource loading in DevTools. Ensure assets load when the site is served from a subpath.

Notes
- Do not assume any CI will run — include explicit publish instructions here when adding build steps.
