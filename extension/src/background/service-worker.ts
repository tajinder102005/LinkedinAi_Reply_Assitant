// Manifest V3 Background Service Worker for LinkedIn AI Outreach Assistant
const BACKEND_BASE_URL = 'http://localhost:8085/api/linkedin';

chrome.runtime.onInstalled.addListener(() => {
  console.log('[LinkedIn AI Assistant] Background worker initialized.');
});

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.type === 'PING') {
    sendResponse({ status: 'PONG', time: Date.now() });
    return true;
  }

  if (request.action === 'GENERATE_OUTREACH') {
    fetch(`${BACKEND_BASE_URL}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request.payload),
    })
      .then(async (res) => {
        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`HTTP ${res.status}: ${errText || res.statusText}`);
        }
        return res.json();
      })
      .then((data) => sendResponse({ success: true, data }))
      .catch((err) => sendResponse({ success: false, error: err.message || 'Network error' }));

    return true;
  }

  if (request.action === 'CHECK_HEALTH') {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    fetch(`${BACKEND_BASE_URL}/health`, { signal: controller.signal })
      .then((res) => {
        clearTimeout(timeout);
        return res.ok;
      })
      .then((online) => sendResponse({ success: true, online }))
      .catch(() => sendResponse({ success: true, online: false }));

    return true;
  }

  return true;
});
