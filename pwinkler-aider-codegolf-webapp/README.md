# vibe-code-fridays-09-05

## Code Golf Assistant (web app)

This repository includes a static, client-only web app that code-golfs JavaScript and Python. It:
- Minimizes JS using Terser, and Python using python-minifier running under Pyodide (in-browser).
- Optionally asks an LLM (OpenAI) to propose a shorter equivalent; your API key is entered client-side and stored locally.
- Verifies equivalence by executing both the original and the candidate with the same stdin and comparing stdout.

How to run:
- Open index.html directly in a browser, or serve the folder with any static server.
- Paste your program, select language (or Auto), optionally provide stdin, and click Golf.
- If using LLM, check the box and paste your OpenAI API key.

Notes:
- Execution is sandboxed in-browser: JS runs in a Web Worker (with a 3s timeout); Python runs in Pyodide.
- For non-JS/Python languages, only conservative whitespace/comment stripping is applied and no execution-based verification is performed.

## Moving the repo into a subdirectory

The error happens because the wildcard `*` includes the destination directory, so `git mv * pwinkler-aider-codegolf-webapp/` tries to move `pwinkler-aider-codegolf-webapp/` into itself.

Fix (Bash on macOS, run from the repo root):

```bash
shopt -s extglob dotglob
git mv -- !(pwinkler-aider-codegolf-webapp|.git) pwinkler-aider-codegolf-webapp/
```

Alternative using tracked files only:

```bash
git ls-files -z | grep -zv '^pwinkler-aider-codegolf-webapp/' | xargs -0 -I{} git mv -v "{}" pwinkler-aider-codegolf-webapp/
```
