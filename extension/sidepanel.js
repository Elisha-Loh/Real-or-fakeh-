import { BACKEND_URL } from './config.js';

const claimEl = document.getElementById('claim');
const checkBtn = document.getElementById('checkBtn');
const clearBtn = document.getElementById('clearBtn');

const metaEl = document.getElementById('meta');
const statusCard = document.getElementById('statusCard');
const statusEl = document.getElementById('status');

const resultCard = document.getElementById('resultCard');
const verdictPill = document.getElementById('verdictPill');
const confidenceEl = document.getElementById('confidence');
const explanationEl = document.getElementById('explanation');
const sourcesEl = document.getElementById('sources');
const rawBox = document.getElementById('rawBox');
const rawEl = document.getElementById('raw');

function setStatus(msg) {
  statusCard.hidden = !msg;
  statusEl.textContent = msg || '';
}

function setVerdictStyle(verdict) {
  // Minimal styling cues without being too “judgy”.
  const v = (verdict || '').toLowerCase();
  verdictPill.style.borderColor = 'var(--border)';
  verdictPill.style.background = 'rgba(255,255,255,0.04)';

  if (['true', 'accurate', 'supported'].some(k => v.includes(k))) {
    verdictPill.style.borderColor = 'rgba(52, 211, 153, 0.55)';
    verdictPill.style.background = 'rgba(52, 211, 153, 0.12)';
  } else if (['false', 'fabricated', 'hoax'].some(k => v.includes(k))) {
    verdictPill.style.borderColor = 'rgba(248, 113, 113, 0.55)';
    verdictPill.style.background = 'rgba(248, 113, 113, 0.12)';
  } else if (['misleading', 'missing context', 'partly'].some(k => v.includes(k))) {
    verdictPill.style.borderColor = 'rgba(251, 191, 36, 0.55)';
    verdictPill.style.background = 'rgba(251, 191, 36, 0.12)';
  }
}

function clearResult() {
  resultCard.hidden = true;
  verdictPill.textContent = '—';
  confidenceEl.textContent = '—';
  explanationEl.textContent = '';
  sourcesEl.innerHTML = '';
  rawBox.hidden = true;
  rawEl.textContent = '';
}

function setMeta({ url, updatedAt } = {}) {
  const bits = [];
  if (url) bits.push(`From: ${url}`);
  if (updatedAt) {
    const d = new Date(updatedAt);
    bits.push(`Captured: ${d.toLocaleString()}`);
  }
  metaEl.textContent = bits.join(' • ');
}

async function loadLastClaim() {
  const { lastClaim, lastUrl, lastUpdatedAt } = await chrome.storage.session.get([
    'lastClaim',
    'lastUrl',
    'lastUpdatedAt'
  ]);

  if (lastClaim && !claimEl.value.trim()) {
    claimEl.value = lastClaim;
    setMeta({ url: lastUrl, updatedAt: lastUpdatedAt });

    // Auto-run when it comes from a highlight.
    await runCheck({ claim: lastClaim, url: lastUrl });
  }
}

async function runCheck({ claim, url } = {}) {
  const text = (claim ?? claimEl.value).trim();
  if (!text) {
    setStatus('Please enter or highlight a claim first.');
    return;
  }

  clearResult();
  setStatus('Checking…');

  // Save in session storage so panel refresh keeps it.
  await chrome.storage.session.set({
    lastClaim: text,
    lastUrl: url || null,
    lastUpdatedAt: Date.now()
  });

  try {
    const res = await fetch(`${BACKEND_URL}/factcheck`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ claim: text, url: url || null })
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Backend error (${res.status}): ${body || res.statusText}`);
    }

    const data = await res.json();

    // Render
    resultCard.hidden = false;
    setStatus('');

    const verdict = data.verdict || 'Unclear';
    verdictPill.textContent = verdict;
    setVerdictStyle(verdict);

    confidenceEl.textContent = data.confidence ? `Confidence: ${data.confidence}` : 'Confidence: —';
    explanationEl.textContent = data.explanation || '(No explanation returned.)';

    const sources = Array.isArray(data.sources) ? data.sources : [];
    sourcesEl.innerHTML = '';
    for (const s of sources) {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = s.url;
      a.target = '_blank';
      a.rel = 'noreferrer noopener';
      a.textContent = s.title || s.url;
      li.appendChild(a);
      const tail = document.createElement('span');
      const pub = s.publisher ? ` — ${s.publisher}` : '';
      const date = s.date ? ` (${s.date})` : '';
      tail.textContent = `${pub}${date}`;
      li.appendChild(tail);
      sourcesEl.appendChild(li);
    }

  } catch (err) {
    setStatus(String(err?.message || err));
    resultCard.hidden = true;
  }
}

checkBtn.addEventListener('click', () => runCheck());
clearBtn.addEventListener('click', async () => {
  claimEl.value = '';
  setMeta({});
  setStatus('');
  clearResult();
  await chrome.storage.session.remove(['lastClaim', 'lastUrl', 'lastUpdatedAt']);
});

// Receive pushed highlights from the service worker.
chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === 'NEW_CLAIM') {
    claimEl.value = msg.claim || '';
    setMeta({ url: msg.url, updatedAt: Date.now() });
    runCheck({ claim: msg.claim, url: msg.url });
  }
});

loadLastClaim();
