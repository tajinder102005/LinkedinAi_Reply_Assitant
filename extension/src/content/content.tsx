import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { LinkedInModal } from './LinkedInModal';
import { findActiveChatWindows, inspectChatContainer, inspectPageProfile, insertTextIntoLinkedInComposer, findLinkedInMessageComposer } from './linkedinHelper';
import './content.css';

const BUTTON_ATTR = 'data-linkedin-ai-injected';
const TRIGGER_ATTR = 'data-linkedin-ai-trigger-injected';
const PROFILE_BTN_ATTR = 'data-linkedin-ai-profile-injected';

let modalRootInstance: Root | null = null;
let modalContainerEl: HTMLElement | null = null;

function ensureModalContainer(): { container: HTMLElement; root: Root } {
  if (!modalContainerEl || !document.body.contains(modalContainerEl)) {
    modalContainerEl = document.createElement('div');
    modalContainerEl.id = 'linkedin-ai-assistant-modal-root';
    document.body.appendChild(modalContainerEl);
    modalRootInstance = createRoot(modalContainerEl);
  }
  return { container: modalContainerEl, root: modalRootInstance! };
}

function openAssistantModal(
  recipientName: string,
  recipientHeadline: string,
  threadSnippet: string,
  composerElement: HTMLElement | null
) {
  const { root } = ensureModalContainer();

  const handleClose = () => {
    root.render(null);
  };

  root.render(
    <LinkedInModal
      recipientName={recipientName}
      recipientHeadline={recipientHeadline}
      threadSnippet={threadSnippet}
      composerElement={composerElement}
      onClose={handleClose}
    />
  );
}

function createInjectedButton(onClick: () => void, label = '✨ AI Reply'): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'linkedin-ai-btn linkedin-ai-btn-send';
  btn.title = 'AI Reply: Click to generate tailored responses';
  btn.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px;vertical-align:middle;margin-right:3px;">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
    </svg>
    <span style="font-weight:600;font-size:12px;letter-spacing:0.1px;">${label}</span>
  `;

  // Guaranteed inline styles that fit cleanly in both full /messaging and narrow 320px docked bubbles
  btn.style.display = 'inline-flex';
  btn.style.alignItems = 'center';
  btn.style.justifyContent = 'center';
  btn.style.height = '28px';
  btn.style.padding = '0 9px';
  btn.style.marginRight = '6px';
  btn.style.marginLeft = '2px';
  btn.style.background = 'linear-gradient(135deg, #0a66c2 0%, #004182 100%)';
  btn.style.color = '#ffffff';
  btn.style.borderRadius = '14px';
  btn.style.border = 'none';
  btn.style.cursor = 'pointer';
  btn.style.whiteSpace = 'nowrap';
  btn.style.flexShrink = '0';
  btn.style.boxShadow = '0 1px 3px rgba(0,0,0,0.2)';
  btn.style.zIndex = '9999';
  btn.style.visibility = 'visible';
  btn.style.opacity = '1';
  btn.style.fontFamily = '-apple-system, system-ui, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif';

  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    onClick();
  });

  return btn;
}

/**
 * Universally locates all actual Send buttons across LinkedIn's standard pages,
 * docked bubbles, and typeahead compose windows.
 * Specifically excludes the "..." overflow menu and dropdown options.
 */
function findSendButtons(): HTMLElement[] {
  // Scoped query: Only search INSIDE active chat containers to prevent scanning hundreds of page buttons
  const chatContainers = document.querySelectorAll<HTMLElement>(
    '.msg-form, .msg-overlay-conversation-bubble, .msg-convo-wrapper, .msg-thread, #msg-overlay'
  );
  if (chatContainers.length === 0) return [];

  const sendButtons: HTMLElement[] = [];
  const seen = new Set<HTMLElement>();

  chatContainers.forEach(container => {
    const candidateButtons = Array.from(container.querySelectorAll<HTMLElement>(
      'button.msg-form__send-button, button.msg-form__send-btn, button[data-control-name*="send"], button[type="submit"], footer button, .msg-form__right-actions button'
    ));

    candidateButtons.forEach(btn => {
      if (btn.classList.contains('linkedin-ai-btn') || seen.has(btn)) return;

      const txt = (btn.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
      const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
      const cls = (btn.className || '').toLowerCase();

      // 1. Explicitly REJECT dropdowns, overflow triggers, and the "..." button
      if (
        cls.includes('dropdown') ||
        cls.includes('overflow') ||
        cls.includes('options') ||
        cls.includes('chevron') ||
        aria.includes('more') ||
        aria.includes('option') ||
        txt === '...'
      ) {
        return;
      }

      // 2. Identify if this is the actual primary SEND button
      const isActualSend =
        txt === 'send' ||
        txt.startsWith('send') ||
        aria === 'send' ||
        aria.startsWith('send') ||
        cls.includes('msg-form__send-button') ||
        cls.includes('msg-form__send-btn') ||
        btn.getAttribute('data-control-name')?.includes('send') ||
        (btn.getAttribute('type') === 'submit' && !cls.includes('search'));

      // Discard feedback, invites, or non-chat actions
      if (isActualSend && !txt.includes('feedback') && !txt.includes('invite') && !txt.includes('search')) {
        seen.add(btn);
        sendButtons.push(btn);
      }
    });
  });

  return sendButtons;
}

/**
 * Injects the AI Reply button directly before every Send button.
 * Guarantees order is: [✨ AI Reply] [Send] [...] with ZERO duplicates.
 */
function injectBeforeSendButton() {
  try {
    const sendButtons = findSendButtons();
    if (sendButtons.length === 0) return;

    sendButtons.forEach(sendBtn => {
      // Find the direct parent toolbar (usually .msg-form__right-actions)
      const toolbar = sendBtn.closest<HTMLElement>(
        '.msg-form__right-actions, .msg-form__footer-actions, .msg-form__footer, footer, div[class*="right-actions"]'
      ) || sendBtn.parentElement;

      if (!toolbar) return;

      // Find the top-level element inside toolbar that contains sendBtn
      let target: HTMLElement = sendBtn;
      while (target.parentElement && target.parentElement !== toolbar) {
        target = target.parentElement;
      }

      // 1. If AI button is ALREADY directly before this target, exit
      if (target.previousElementSibling?.classList.contains('linkedin-ai-btn-send')) {
        return;
      }

      // 2. Remove any duplicate AI buttons inside this toolbar
      toolbar.querySelectorAll<HTMLElement>('.linkedin-ai-btn-send').forEach(b => b.remove());

      // 3. Find chat container for recipient/thread context
      const chatContainer = sendBtn.closest(
        '.msg-overlay-conversation-bubble, .msg-overlay-compose-bubble, .msg-overlay-list-bubble, .msg-form, .msg-convo-wrapper, .msg-thread, #msg-overlay, aside, form'
      ) || toolbar;

      const onOpen = () => {
        const context = chatContainer ? inspectChatContainer(chatContainer as HTMLElement) : inspectPageProfile();
        const composer = findLinkedInMessageComposer(chatContainer as HTMLElement);
        openAssistantModal(context.recipientName, context.recipientHeadline, context.threadSnippet, composer);
      };

      const aiBtn = createInjectedButton(onOpen, '✨ AI Reply');

      // Insert directly BEFORE target in toolbar without mutating toolbar.style (avoids layout thrashing)
      toolbar.insertBefore(aiBtn, target);
    });
  } catch (err) {
    console.warn('[LinkedIn AI Assistant] Error in send button injection:', err);
  }
}

/**
 * Universal Floating Action Button at the bottom-right corner of the screen.
 */
function ensureGlobalFloatingButton() {
  try {
    const existing = document.getElementById('linkedin-ai-global-floating-btn');
    if (existing) {
      if (existing.getAttribute('data-v') === '3') return;
      existing.remove();
    }

    const btn = document.createElement('button');
    btn.id = 'linkedin-ai-global-floating-btn';
    btn.setAttribute('data-v', '3');
    btn.type = 'button';
    btn.className = 'linkedin-ai-global-floating-btn';
    btn.title = 'Open LinkedIn AI Outreach & Reply Assistant';
    btn.innerHTML = `
      <span class="ai-floating-sparkle">✨</span>
      <span class="ai-floating-text">AI Reply / Outreach</span>
    `;

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      // Detect active chat or profile context
      const activeChats = findActiveChatWindows();
      let recipientName = '';
      let recipientHeadline = '';
      let threadSnippet = '';
      let composer: HTMLElement | null = null;

      if (activeChats.length > 0) {
        const chatCtx = inspectChatContainer(activeChats[0]);
        recipientName = chatCtx.recipientName;
        recipientHeadline = chatCtx.recipientHeadline;
        threadSnippet = chatCtx.threadSnippet;
        composer = chatCtx.composerElement;
      }

      if (!recipientName || recipientName === 'Colleague') {
        const profileData = inspectPageProfile();
        recipientName = profileData.recipientName;
        recipientHeadline = profileData.recipientHeadline;
        if (!threadSnippet) threadSnippet = profileData.threadSnippet;
      }

      openAssistantModal(recipientName, recipientHeadline, threadSnippet, composer);
    });

    document.body.appendChild(btn);
  } catch (err) {
    console.warn('[LinkedIn AI Assistant] Error injecting global floating button:', err);
  }
}

/**
 * Injects a high-visibility "✨ AI Message" button directly on the
 * profile action bar next to Message / More buttons on linkedin.com/in/* pages.
 * Zero-lag: 0ms synchronous click response without artificial sleeps or layout thrashing.
 */
function injectProfilePageButton() {
  try {
    // Only inject on profile pages
    if (!window.location.pathname.includes('/in/')) {
      document.querySelectorAll('.linkedin-ai-profile-btn').forEach(b => b.remove());
      return;
    }

    // Target the main profile top card
    const topCard = document.querySelector<HTMLElement>(
      'section.pv-top-card, .pv-top-card, .scaffold-layout__main section, [data-view-name="profile-card"]'
    ) || document.querySelector<HTMLElement>('main') || document.body;

    // Fast check: if button is already inside topCard, exit immediately
    if (topCard.querySelector('.linkedin-ai-profile-btn')) {
      return;
    }

    const nativeMsgBtn = Array.from(topCard.querySelectorAll<HTMLElement>('button, a')).find(el => {
      if (el.classList.contains('linkedin-ai-btn') || el.classList.contains('linkedin-ai-profile-btn')) return false;
      // Exclude right-rail "More profiles for you"
      if (el.closest('aside, .scaffold-layout__aside, [data-view-name="profile-card"]:not(.pv-top-card)')) return false;
      const t = (el.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
      const aria = (el.getAttribute('aria-label') || '').toLowerCase();
      return t === 'message' || t.startsWith('message ') || aria.startsWith('message');
    });

    if (!nativeMsgBtn) return;

    const ctaRow = nativeMsgBtn.closest<HTMLElement>(
      '.pvs-profile-actions, .pv-top-card-v2-ctas, .pv-top-card--list-bullet, div.ph5.pb5, div[class*="profile-actions"], div.display-flex'
    ) || nativeMsgBtn.parentElement;

    if (!ctaRow) return;

    // Clean any detached or stale profile buttons from previous profile visits
    document.querySelectorAll<HTMLElement>('.linkedin-ai-profile-btn').forEach(b => {
      if (!ctaRow.contains(b)) b.remove();
    });

    // Skip if already in this ctaRow
    if (ctaRow.querySelector('.linkedin-ai-profile-btn')) {
      return;
    }

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'linkedin-ai-profile-btn';
    btn.setAttribute('data-linkedin-ai-profile-btn', 'true');
    btn.title = 'AI Message: Open tailored outreach assistant';
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;vertical-align:middle;margin-right:4px;">
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
      </svg>
      <span>✨ AI Message</span>
    `;

    // 0ms INSTANT RESPONSE: synchronous open, ZERO async delay, ZERO blocking loops
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      const profileData = inspectPageProfile();
      const composer = findLinkedInMessageComposer();
      openAssistantModal(profileData.recipientName, profileData.recipientHeadline, profileData.threadSnippet, composer);
    });

    // Ensure ctaRow and button container have straight-line flex alignment
    ctaRow.style.display = 'inline-flex';
    ctaRow.style.alignItems = 'center';
    ctaRow.style.verticalAlign = 'middle';
    if (nativeMsgBtn.parentElement && nativeMsgBtn.parentElement !== ctaRow) {
      nativeMsgBtn.parentElement.style.display = 'inline-flex';
      nativeMsgBtn.parentElement.style.alignItems = 'center';
      nativeMsgBtn.parentElement.style.verticalAlign = 'middle';
    }

    // Insert directly next to Message button in straight line as immediate sibling
    nativeMsgBtn.parentNode?.insertBefore(btn, nativeMsgBtn.nextSibling);
  } catch (err) {
    console.warn('[LinkedIn AI Assistant] Error injecting profile page button:', err);
  }
}

function cleanupUnusedButtons() {
  // Remove deprecated overlay triggers from previous versions
  document.querySelectorAll('.linkedin-ai-topbar-btn, .linkedin-ai-composer-trigger').forEach(el => el.remove());
}

let isInjecting = false;

function runAllInjections() {
  if (isInjecting) return;
  isInjecting = true;
  try {
    injectProfilePageButton();
    injectBeforeSendButton();
    ensureGlobalFloatingButton();
  } catch (err) {
    console.debug('[LinkedIn AI Assistant] Injection pass error:', err);
  } finally {
    isInjecting = false;
  }
}

// Global Message Listener for Toolbar Popup communication
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action === 'GET_CHAT_CONTEXT') {
    const profileData = inspectPageProfile();
    const chatWindows = findActiveChatWindows();

    let threadContext = '';
    let hasChat = false;

    if (chatWindows.length > 0) {
      const chatCtx = inspectChatContainer(chatWindows[0]);
      threadContext = chatCtx.threadSnippet;
      hasChat = Boolean(chatCtx.composerElement);
      if (chatCtx.recipientName && chatCtx.recipientName !== 'Colleague') {
        profileData.recipientName = chatCtx.recipientName;
      }
      if (chatCtx.recipientHeadline) {
        profileData.recipientHeadline = chatCtx.recipientHeadline;
      }
      if (chatCtx.recipientCompany) {
        profileData.recipientCompany = chatCtx.recipientCompany;
      }
    }

    sendResponse({
      success: true,
      context: {
        recipientName: profileData.recipientName,
        recipientHeadline: profileData.recipientHeadline,
        recipientCompany: profileData.recipientCompany,
        threadSnippet: threadContext || profileData.threadSnippet,
        hasActiveChat: hasChat,
      },
    });
    return true;
  }

  if (request.action === 'INSERT_DRAFT') {
    const composer = findLinkedInMessageComposer();
    if (composer) {
      const ok = insertTextIntoLinkedInComposer(composer, request.text);
      sendResponse({ success: ok });
    } else {
      sendResponse({ success: false, error: 'No active chat composer detected.' });
    }
    return true;
  }

  return true;
});

// SPA URL change detector
let lastTrackedUrl = window.location.href;
function checkUrlNavigation() {
  if (window.location.href !== lastTrackedUrl) {
    lastTrackedUrl = window.location.href;
    runAllInjections();
  }
}

// Low-overhead debounced MutationObserver with zero-lag filtering
let debounceTimer: any = null;
const observer = new MutationObserver((mutations) => {
  if (isInjecting) return;

  checkUrlNavigation();

  // Fast check: only trigger if external elements were added or removed
  let hasRelevantChange = false;
  for (let i = 0; i < mutations.length; i++) {
    const m = mutations[i];
    if (m.type === 'childList' && (m.addedNodes.length > 0 || m.removedNodes.length > 0)) {
      for (let j = 0; j < m.addedNodes.length; j++) {
        const node = m.addedNodes[j];
        if (node.nodeType === 1) {
          const el = node as HTMLElement;
          if (el.id !== 'linkedin-ai-assistant-modal-root' && !el.classList?.contains('linkedin-ai-btn')) {
            hasRelevantChange = true;
            break;
          }
        }
      }
    }
    if (hasRelevantChange) break;
  }

  if (!hasRelevantChange) return;

  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    runAllInjections();
  }, 200);
});

// Startup initialization
cleanupUnusedButtons();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    runAllInjections();
    observer.observe(document.body, { childList: true, subtree: true });
  });
} else {
  runAllInjections();
  observer.observe(document.body, { childList: true, subtree: true });
}

window.addEventListener('popstate', checkUrlNavigation);

console.log('%c[LinkedIn AI Assistant] Running in zero-overhead high-performance mode.', 'color: #0a66c2; font-weight: bold; font-size: 13px;');
