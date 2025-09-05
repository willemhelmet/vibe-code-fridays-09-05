 // Basic DOM helpers
const $ = (sel) => document.querySelector(sel);
const logEl = $("#log");
const statsEl = $("#stats");

function log(msg = "") { logEl.textContent += (msg + "\n"); logEl.scrollTop = logEl.scrollHeight; }
function clearLog() { logEl.textContent = ""; }
// Global error logging to UI
window.addEventListener("error", (e) => { try { log("Error: " + (e.error?.stack || e.message)); } catch {} });
window.addEventListener("unhandledrejection", (e) => { try { log("Unhandled rejection: " + (e.reason?.stack || e.reason)); } catch {} });

 // Persistent UI state
const savedProvider = localStorage.getItem("cg_provider") || "openai";
if ($("#provider")) $("#provider").value = savedProvider;
function loadKeyFor(p){ return localStorage.getItem(`cg_api_key_${p}`)||""; }
function saveKeyFor(p,v){ localStorage.setItem(`cg_api_key_${p}`, v); localStorage.setItem("cg_provider", p); }
const initKey = loadKeyFor(savedProvider);
if ($("#apiKey")) $("#apiKey").value = initKey;
$("#provider")?.addEventListener("change", e => {
  const p = e.target.value;
  localStorage.setItem("cg_provider", p);
  $("#apiKey").value = loadKeyFor(p);
});
$("#apiKey").addEventListener("change", e => {
  const p = $("#provider") ? $("#provider").value : "openai";
  saveKeyFor(p, e.target.value);
});

// Lazy globals
let pyodideReadyPromise = null;
let pyMinifierReady = false;

// Init Pyodide on demand
async function ensurePyodide() {
  if (!pyodideReadyPromise) {
    log("Loading Pyodide...");
    pyodideReadyPromise = self.loadPyodide({ indexURL: "https://cdn.jsdelivr.net/pyodide/v0.25.1/full/" });
  }
  const py = await pyodideReadyPromise;
  if (!pyMinifierReady) {
    log("Installing python-minifier in Pyodide (first run only)...");
    await py.loadPackage('micropip');
    await py.runPythonAsync(`
import micropip
try:
    import python_minifier
except Exception:
    await micropip.install('python-minifier')
    import python_minifier
    print('python-minifier installed')
`);
    pyMinifierReady = true;
  }
  return py;
}

// Language detection (lightweight heuristics)
function detectLanguage(code, selected) {
  if (selected && selected !== "auto") return selected;
  const trimmed = code.trim();
  if (/^\s*(?:\/\/|function|let|const|var|class|=>|\(\)|import\s|\(|console\.log|document\.|Math\.)/m.test(trimmed)) return "js";
  if (/^\s*(?:#|def\s|class\s|import\s|print\(|from\s|lambda\b)/m.test(trimmed)) return "python";
  return "other";
}

// Core: Minify JS via Terser with aggressive options
async function golfJS_Terser(code) {
  const result = await Terser.minify(code, {
    compress: {
      passes: 3,
      toplevel: true,
      unsafe: true,
      unsafe_math: true,
      booleans_as_integers: true,
      drop_console: false, // keep console.log output semantics
      drop_debugger: true,
      hoist_funs: true,
      hoist_vars: true,
      keep_fargs: false,
      keep_infinity: true,
      side_effects: true,
      defaults: true
    },
    mangle: { toplevel: true, keep_classnames: false, keep_fnames: false },
    format: { semicolons: false, beautify: false }
  });
  if (result.error) throw result.error;
  return result.code || "";
}

// Optional extra micro-tweaks for JS (try both and keep shorter)
function jsHeuristicTweaks(src) {
  let variants = [];
  const t1 = src
    .replace(/\btrue\b/g, "!0")
    .replace(/\bfalse\b/g, "!1");
  variants.push(t1);
  const t2 = t1
    .replace(/;+/g, ";")
    .replace(/;+$/g, "");
  variants.push(t2);
  const t3 = t2.replace(/\s*;\s*/g, ";").replace(/\s*,\s*/g, ",");
  variants.push(t3);
  return [src, ...Array.from(new Set(variants))];
}

// Run JS in an isolated worker to capture output
function runJSInWorker(code, stdinText) {
  return new Promise((resolve) => {
    const workerCode = `
      self.onmessage = (e) => {
        let out=[];
        const lines = String(e.data?.stdin || "").split(/\\r?\\n/);
        let i=0;
        const prompt = ()=> (i<lines.length? lines[i++] : "");
        const console = { log: (...a)=> out.push(a.join(" ")) };
        try {
          self.prompt = prompt;
          self.console = console;
          eval(String(e.data?.code || ""));
          self.postMessage({ ok: true, out: out.join("\\n") });
        } catch (err) {
          self.postMessage({ ok: false, out: out.join("\\n"), err: String(err) });
        }
      };
    `;
    const blob = new Blob([workerCode], { type: "text/javascript" });
    const url = URL.createObjectURL(blob);
    const w = new Worker(url);
    let done = false;
    const timeout = setTimeout(() => {
      if (done) return;
      done = true;
      URL.revokeObjectURL(url);
      try { w.terminate(); } catch {}
      resolve({ ok: false, out: "", err: "Timeout" });
    }, 3000); // 3s safety timeout
    w.onmessage = (e) => {
      if (done) return;
      done = true;
      clearTimeout(timeout);
      URL.revokeObjectURL(url);
      w.terminate();
      resolve(e.data);
    };
    w.postMessage({ code, stdin: stdinText || "" });
  });
}

// Python minify via python-minifier in Pyodide
async function golfPy_Minifier(code) {
  const py = await ensurePyodide();
  py.globals.set("SRC_CODE", code);
  const out = await py.runPythonAsync(`
from python_minifier import minify
minify(SRC_CODE,
  remove_annotations=True,
  remove_pass=True,
  remove_literal_statements=True,
  combine_imports=True,
  hoist_literals=False,
  rename_locals=True,
  rename_globals=False,
  convert_posargs_to_args=True,
  preserve_shebang=False)
`);
  return out || "";
}

// Run Python in Pyodide, capture stdout, emulate input()
async function runPython(code, stdinText) {
  const py = await ensurePyodide();
  py.globals.set("SRC_CODE", code);
  py.globals.set("STDIN_TEXT", stdinText || "");
  const res = await py.runPythonAsync(`
import sys, io, builtins
out = io.StringIO()
old_out, old_in = sys.stdout, builtins.input
sys.stdout = out
_lines = iter(STDIN_TEXT.splitlines())
def _inp(prompt=None):
    try: return next(_lines)
    except StopIteration: return ''
builtins.input = _inp
err = None
try:
    exec(SRC_CODE, {})
except SystemExit:
    pass
except Exception as e:
    err = str(e)
sys.stdout = old_out
builtins.input = old_in
(out.getvalue(), err)
`);
  return { out: res[0], ok: !res[1], err: res[1] || null };
}

// Generic fallback (very conservative)
function genericStrip(code) {
  let s = code;
  s = s.replace(/(^|\s)#.*$/gm, "$1");
  s = s.replace(/\/\*[\s\S]*?\*\//g, "");
  s = s.replace(/(^|[^:])\/\/.*$/gm, "$1");
  s = s.replace(/[ \t]+/g, " ");
  s = s.replace(/\s*\n\s*/g, "\n");
  s = s.trim();
  return s;
}

// Orchestrator: generate candidates, verify, keep shortest
async function golf(code, lang, stdinText, useLLM, llmPasses, apiKey, model, provider) {
  const baselineOut = { candidatesTried: 0, candidatesPassed: 0, best: null, bestBytes: Infinity, logs: [] };
  const tryCandidate = async (label, src, runner) => {
    baselineOut.candidatesTried++;
    baselineOut.logs.push(`Trying ${label} (${new Blob([src]).size} bytes)`);
    const orig = await runner(code, stdinText);
    const cand = await runner(src, stdinText);
    if (!orig.ok) {
      baselineOut.logs.push(`Original program error: ${orig.err || "unknown"}`);
      return null;
    }
    if (!cand.ok) {
      baselineOut.logs.push(`Rejected ${label}: runtime error: ${cand.err}`);
      return null;
    }
    if (cand.out !== orig.out) {
      baselineOut.logs.push(`Rejected ${label}: output mismatch`);
      return null;
    }
    baselineOut.candidatesPassed++;
    const bytes = new Blob([src]).size;
    if (bytes < baselineOut.bestBytes) {
      baselineOut.best = src;
      baselineOut.bestBytes = bytes;
      baselineOut.logs.push(`Accepted ${label}: NEW BEST (${bytes} bytes)`);
    } else {
      baselineOut.logs.push(`Accepted ${label} (${bytes} bytes)`);
    }
  };

  if (lang === "js") {
    const run = (src, stdin) => runJSInWorker(src, stdin);
    const terserMin = await golfJS_Terser(code).catch(e => { log(`Terser error: ${e}`); return null; });
    if (terserMin) {
      await tryCandidate("Terser", terserMin, run);
      for (const variant of jsHeuristicTweaks(terserMin)) {
        await tryCandidate("JS tweak", variant, run);
      }
    }
    await tryCandidate("Generic strip", genericStrip(code), run);

  } else if (lang === "python") {
    const run = (src, stdin) => runPython(src, stdin);
    let pyMin = null;
    try { pyMin = await golfPy_Minifier(code); } catch (e) { log(`python-minifier error: ${e}`); }
    if (pyMin) {
      await tryCandidate("python-minifier", pyMin, run);
      const t = pyMin.replace(/\bTrue\b/g, "1").replace(/\bFalse\b/g, "0");
      if (t !== pyMin) await tryCandidate("Py tweak", t, run);
    }
    await tryCandidate("Generic strip", genericStrip(code), run);

  } else {
    const run = async (src, stdin) => ({ ok: true, out: src, err: null });
    await tryCandidate("Generic strip", genericStrip(code), run);
  }

  if (useLLM && apiKey && llmPasses > 0) {
    for (let i = 0; i < llmPasses; i++) {
      const promptBase = `You are a code-golf assistant. Rewrite the following PROGRAM in ${lang.toUpperCase()} to produce IDENTICAL stdout when executed in a clean environment, given the provided stdin (lines). Target minimal byte length. Avoid imports other than built-ins, avoid I/O side effects besides printing. Return ONLY the code, no explanations.`;
      const llmResp = await llmGolf(code, lang, $("#stdin").value, apiKey, model, promptBase, provider).catch(e => { baselineOut.logs.push(`LLM error: ${e}`); return null; });
      if (llmResp && llmResp.trim()) {
        const cleaned = stripCodeFence(llmResp.trim());
        if (lang === "js") {
          let llmMin = cleaned;
          try { llmMin = await golfJS_Terser(cleaned); } catch {}
          await tryCandidate("LLM (minified)", llmMin, (src, s) => runJSInWorker(src, s));
        } else if (lang === "python") {
          let llmMin = cleaned;
          try { llmMin = await golfPy_Minifier(cleaned); } catch {}
          await tryCandidate("LLM (minified)", llmMin, (src, s) => runPython(src, s));
        } else {
          const run = async (src, stdin) => ({ ok: true, out: src, err: null });
          await tryCandidate("LLM", cleaned, run);
        }
      }
    }
  }

  return baselineOut;
}

// LLM integration (OpenAI Chat Completions)
async function llmGolf(code, lang, stdinText, apiKey, model, systemPrompt, provider) {
  const body = {
    model: model || (provider === "openrouter" ? "openrouter/auto" : "gpt-4o-mini"),
    temperature: 0.2,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content:
`LANGUAGE: ${lang}
STDIN:
${stdinText || "(none)"}

PROGRAM:
${code}
` }
    ]
  };
  const endpoint = provider === "openrouter"
    ? "https://openrouter.ai/api/v1/chat/completions"
    : "https://api.openai.com/v1/chat/completions";
  const headers = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${apiKey}`
  };
  if (provider === "openrouter") {
    try {
      headers["HTTP-Referer"] = location.origin;
      headers["X-Title"] = document.title || "Code Golf Assistant";
    } catch {}
  }
  const res = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`${provider === "openrouter" ? "OpenRouter" : "OpenAI"} API ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

// Utility to extract code from fenced blocks if present
function stripCodeFence(s) {
  const m = s.match(/```[\s\S]*?\n([\s\S]*?)```/);
  return m ? m[1].trim() : s.trim();
}

// Wire up UI
$("#btnTest").addEventListener("click", async () => {
  clearLog();
  const code = $("#inputCode").value;
  const selected = $("#language").value;
  const lang = detectLanguage(code, selected);
  const stdinText = $("#stdin").value;
  log(`Detected language: ${lang.toUpperCase()}`);
  if (lang === "js") {
    const orig = await runJSInWorker(code, stdinText);
    log(`JS run: ${orig.ok ? "OK" : "ERROR"}\nOutput:\n${orig.out}${orig.err ? `\nError: ${orig.err}` : ""}`);
  } else if (lang === "python") {
    const orig = await runPython(code, stdinText);
    log(`Python run: ${orig.ok ? "OK" : "ERROR"}\nOutput:\n${orig.out}${orig.err ? `\nError: ${orig.err}` : ""}`);
  } else {
    log("Test: unknown language; no execution harness.");
  }
});

$("#btnGolf").addEventListener("click", async () => {
  clearLog();
  const code = $("#inputCode").value;
  if (!code.trim()) { log("Please paste some code."); return; }
  const selected = $("#language").value;
  const lang = detectLanguage(code, selected);
  const stdinText = $("#stdin").value;

  const useLLM = $("#useLLM").checked;
  const apiKey = $("#apiKey").value.trim();
  const model = $("#model").value.trim();
  const llmPasses = parseInt($("#llmPasses").value, 10) || 0;
  const provider = $("#provider") ? $("#provider").value : "openai";
  if (useLLM && !apiKey) { log("LLM checked but no API key provided."); }

  log(`Detected language: ${lang.toUpperCase()}`);
  const res = await golf(code, lang, stdinText, useLLM, llmPasses, apiKey, model, provider);

  const originalBytes = new Blob([code]).size;
  const bestCode = res.best ? res.best : code;
  const bestBytes = new Blob([bestCode]).size;

  $("#outputCode").value = bestCode;
  statsEl.innerHTML = `
    Original: ${originalBytes} bytes<br/>
    Best: ${bestBytes} bytes<br/>
    Saved: ${originalBytes - bestBytes} bytes<br/>
    Candidates tried: ${res.candidatesTried}, passed: ${res.candidatesPassed}
  `.trim();

  res.logs.forEach(l => log(l));
});
