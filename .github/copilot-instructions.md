# Copilot instructions — jasonycw.github.io

Purpose
- All files in this folder power the GitHub Pages site. Any change must remain runnable on GitHub Pages (static hosting only).

Commit standards:
- All commits must be iterative, never do multiple thing in one commit. For example, if you need to change the layout and add animation, you should first commit the layout change, make sure it's correct, then commit the animation change.
- All commits must be atomic and self-contained, meaning each commit should represent a single logical change that can be understood and tested independently. Avoid bundling multiple unrelated changes into a single commit.
- Every git commit message must be human-readable and use actual newlines to separate subject, body, and trailers. Do NOT include the two-character escape sequence "\\n" anywhere in the commit message.
- Must append the required Co-authored-by trailer as a separate line exactly like this (trailer must be the last Co-authored-by line):
  Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
- Must append a model trailer on its own line indicating the LLM used, for example:
  LLM-Model: gpt-5-mini (GPT-5 mini)
- Trailers must be real newlines-separated lines at the end of the message (not escaped). The commit message must avoid control or escape characters used for formatting (no backtick-escaping, no literal "\\t", "\\xNN", etc.).
- Example valid commit message (three lines):
  Fix menu layout on mobile
  Improve spacing for small screens
  LLM-Model: gpt-5-mini (GPT-5 mini)
  Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>

Preview / build
- Install dependencies and run the dev server: `cd jasonycw.github.io && npm install && npm run test` (this repo uses `webpack-dev-server` under the `test` script).
- To validate the final static output, serve the site locally with a static server: `npx http-server . -p 8080` or `python -m http.server 8080` from the published root. Open `http://localhost:8080/`.

GitHub PR standards:
- Must clearly document the change in the PR description
- Must include screenshots or screen recordings for any visual changes
- Description must be human-readable. Do NOT include the two-character escape sequence "\n" anywhere
- Must include the model trailer and coauthor trailers. The coauthor trailers must be properly formatted with the LLM provider's GitHub username and email when possible.

GitHub Pages constraints (must follow)
- No server-side code or server-only runtime dependencies.
- Use only relative URLs for scripts, styles, and assets so the site works when published at `https://<user>.github.io/<repo>/` or repository root.
- If the project produces a build output (e.g., `dist/`), document whether the site publishes from the repository root or a `gh-pages` branch and include exact publish steps.

Testing changes
- Verify locally with `npx http-server` and test the site using the same base path it will have on GitHub Pages (project pages often run under a subpath).
- Check common breakpoints and resource loading in DevTools. Ensure assets load when the site is served from a subpath.

Notes
- Do not assume any CI will run — include explicit publish instructions here when adding build steps.
- Commit work iteratively in logical slices. Do not accumulate unrelated gameplay, UI, screenshot, and documentation changes into one large commit. Commit after each completed logical change set, and continue remaining work in later commits.
