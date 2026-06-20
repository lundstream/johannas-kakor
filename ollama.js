// Shared server-side Ollama client. The browser never calls Ollama — all inference
// is server-side against the operator's local GPU box. Native /api/chat only
// (the OpenAI-compat endpoint silently ignores num_ctx). Thinking disabled.

const BASE_URL = (process.env.OLLAMA_BASE_URL || 'http://192.168.1.100:11434').replace(/\/$/, '');
const MODEL = process.env.OLLAMA_MODEL || 'gemma4:e4b';
const NUM_CTX = Number(process.env.OLLAMA_NUM_CTX || 8192);
const TIMEOUT_MS = Number(process.env.OLLAMA_TIMEOUT_MS || 45000);

/** Quick reachability check for UI status (short timeout). */
export async function ollamaAvailable() {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4000);
    const r = await fetch(`${BASE_URL}/api/tags`, { signal: ctrl.signal });
    clearTimeout(t);
    return r.ok;
  } catch {
    return false;
  }
}

/** Best-effort JSON extraction (format=schema yields pure JSON; this is a backstop). */
function extractJSON(content) {
  let txt = String(content ?? '').trim();
  txt = txt.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  try {
    return JSON.parse(txt);
  } catch {
    /* fall through */
  }
  const o1 = txt.indexOf('{');
  const o2 = txt.lastIndexOf('}');
  const a1 = txt.indexOf('[');
  const a2 = txt.lastIndexOf(']');
  let cand = null;
  if (a1 !== -1 && a2 > a1 && (o1 === -1 || a1 < o1)) cand = txt.slice(a1, a2 + 1);
  else if (o1 !== -1 && o2 > o1) cand = txt.slice(o1, o2 + 1);
  if (cand) {
    try {
      return JSON.parse(cand);
    } catch {
      /* fall through */
    }
  }
  throw new Error('ollama_bad_json');
}

/**
 * One structured chat turn. `schema` is a JSON schema passed to Ollama's `format`.
 * Thinking is disabled so the model emits the object directly. Returns parsed JSON
 * (caller MUST schema-validate again, e.g. with zod). Throws 'ollama_unreachable'
 * on network/timeout, 'ollama_error' on HTTP error, 'ollama_bad_json' on garbage.
 */
export async function chatJSON({ system, user, schema }) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  let res;
  try {
    res = await fetch(`${BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: ctrl.signal,
      body: JSON.stringify({
        model: MODEL,
        stream: false,
        think: false, // gemma4 is a thinking model — emit JSON directly
        format: schema,
        options: { num_ctx: NUM_CTX, temperature: 0 },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    });
  } catch {
    clearTimeout(t);
    throw new Error('ollama_unreachable');
  }
  clearTimeout(t);
  if (!res.ok) throw new Error('ollama_error');
  const data = await res.json();
  return extractJSON(data?.message?.content);
}

export const ollamaConfig = { BASE_URL, MODEL, NUM_CTX };
