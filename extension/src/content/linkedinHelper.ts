/**
 * Robust DOM helper for detecting LinkedIn messaging components and extracting profile/chat signals.
 */

export interface LinkedInChatContext {
  recipientName: string;
  recipientHeadline: string;
  recipientCompany: string;
  threadSnippet: string;
  composerElement: HTMLElement | null;
  actionsContainer: HTMLElement | null;
  sendButton: HTMLElement | null;
  formElement: HTMLElement | null;
}

/**
 * Finds all active message composer containers on LinkedIn (both full /messaging page and docked pop-up windows).
 */
export function findActiveChatWindows(): HTMLElement[] {
  const candidateElements: HTMLElement[] = [];

  // Primary: standard messaging form or docked overlay
  const forms = Array.from(document.querySelectorAll<HTMLElement>(
    '.msg-form, form.msg-form, .msg-thread__form, .msg-overlay-conversation-bubble, div[data-view-name="message-overlay"]'
  ));
  forms.forEach(f => candidateElements.push(f));

  // Secondary: composer wrapper container
  const contentContainers = Array.from(document.querySelectorAll<HTMLElement>(
    '.msg-form__msg-content-container, .msg-convo-wrapper, .msg-thread'
  ));
  contentContainers.forEach(c => candidateElements.push(c));

  // Tertiary: any contenteditable with message attributes
  const editables = Array.from(document.querySelectorAll<HTMLElement>(
    '.msg-form__contenteditable, div[role="textbox"][aria-label*="message" i], div[role="textbox"][aria-label*="Write" i]'
  ));
  editables.forEach(ed => {
    const parentForm = ed.closest('form, .msg-form, .msg-convo-wrapper, .msg-thread, .msg-overlay-conversation-bubble');
    if (parentForm && !candidateElements.includes(parentForm as HTMLElement)) {
      candidateElements.push(parentForm as HTMLElement);
    } else if (ed.parentElement && !candidateElements.includes(ed.parentElement)) {
      candidateElements.push(ed.parentElement);
    }
  });

  return Array.from(new Set(candidateElements)).filter(el => document.body.contains(el));
}

function cleanName(raw: string): string {
  if (!raw) return '';
  const lines = raw.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const firstLine = lines.length > 0 ? lines[0] : raw.trim();
  return firstLine
    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
    .replace(/•.*$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extracts recipient name from available LinkedIn DOM elements.
 */
function extractRecipientName(scope: HTMLElement): string {
  // 1. Check docked bubble header title
  const dockedTitle = scope.querySelector('.msg-overlay-bubble-header__title, .msg-overlay-conversation-bubble__header h2, a[href*="/in/"]');
  if (dockedTitle && dockedTitle.textContent) {
    const c = cleanName(dockedTitle.textContent);
    if (c.length > 1 && !c.toLowerCase().includes('messaging') && !c.toLowerCase().includes('new message')) {
      return c;
    }
  }

  // 2. Check full thread headers and new message recipient pills
  const nameSelectors = [
    '.msg-connections-typeahead__pill',
    '.artdeco-pill',
    '.msg-entity-lockup__entity-title',
    'h2.msg-entity-lockup__entity-title',
    '.msg-title-bar__title',
    '.msg-conversation-header__title',
    '.msg-conversation-topbar__name',
    '.artdeco-entity-lockup__title',
    '.msg-thread__link-to-profile',
    '.msg-thread__topbar-title',
    '.msg-conversation-listitem--is-active .msg-conversation-listitem__participant-names',
    '.msg-conversation-card--active .msg-conversation-card__participant-names',
    'a.msg-conversation-listitem__link--is-active h3',
    'h1'
  ];

  for (const selector of nameSelectors) {
    const el = scope.querySelector(selector) || document.querySelector(selector);
    const text = el?.textContent?.trim();
    if (text && text.length > 1 && !text.toLowerCase().includes('messaging') && !text.toLowerCase().includes('write a message')) {
      const c = cleanName(text);
      if (c.length > 1) return c;
    }
  }

  // 3. Fallback to main profile h1
  const mainH1 = document.querySelector('h1');
  if (mainH1 && mainH1.textContent) {
    const c = cleanName(mainH1.textContent);
    if (c.length > 1 && !c.toLowerCase().includes('messaging')) return c;
  }

  return '';
}

/**
 * Extracts recipient headline and parses company.
 */
function extractRecipientDetails(scope: HTMLElement): { headline: string; company: string } {
  let headline = '';
  let company = '';

  const subtitleSelectors = [
    '.text-body-medium.break-words',
    '.pv-text-details__left-panel .text-body-medium',
    '.msg-entity-lockup__entity-subtitle',
    '.artdeco-entity-lockup__subtitle',
    '.msg-conversation-topbar__sub-text',
    '[data-field="headline"]'
  ];

  for (const selector of subtitleSelectors) {
    const el = scope.querySelector(selector) || document.querySelector(selector);
    if (el?.textContent) {
      headline = el.textContent.trim().split('\n')[0].trim();
      break;
    }
  }

  if (headline.includes(' @ ')) {
    company = headline.split(' @ ')[1].split('|')[0].trim();
  } else if (headline.includes(' at ')) {
    company = headline.split(' at ')[1].split('|')[0].trim();
  }

  return { headline, company };
}

/**
 * Extracts the last few messages in the active thread.
 */
function extractThreadMessages(scope: HTMLElement): string {
  const parentConvo = scope.closest('.msg-convo-wrapper, .msg-thread, .msg-overlay-conversation-bubble, .scaffold-layout__main') || document;
  const messageNodes = Array.from(parentConvo.querySelectorAll(
    '.msg-s-event-listitem__body, .msg-s-message-group__bubble, .msg-s-event-listitem'
  ));

  if (messageNodes.length === 0) return '';

  return messageNodes
    .slice(-4)
    .map(node => node.textContent?.replace(/\s+/g, ' ').trim() || '')
    .filter(t => t.length > 2 && !t.startsWith('You:'))
    .join(' | ')
    .slice(0, 500);
}

/**
 * Inspects a chat container and identifies all critical anchor elements.
 */
export function inspectChatContainer(container: HTMLElement): LinkedInChatContext {
  const composer = container.querySelector<HTMLElement>(
    '.msg-form__contenteditable, div[role="textbox"][contenteditable="true"], div[contenteditable="true"]'
  ) || (container.getAttribute('contenteditable') === 'true' ? container : null);

  const actionsContainer = container.querySelector<HTMLElement>(
    '.msg-form__right-actions, .msg-form__footer, .msg-form__left-actions, footer'
  ) || (container.querySelector('footer') as HTMLElement);

  const sendBtn = container.querySelector<HTMLElement>(
    'button.msg-form__send-button, button.msg-form__send-btn, button[type="submit"], button[data-control-name="send"]'
  ) || (actionsContainer?.querySelector('button[type="submit"], button.artdeco-button--primary') as HTMLElement);

  const recipientName = extractRecipientName(container);
  const { headline, company } = extractRecipientDetails(container);
  const threadSnippet = extractThreadMessages(container);

  return {
    recipientName,
    recipientHeadline: headline,
    recipientCompany: company,
    threadSnippet,
    composerElement: composer,
    actionsContainer,
    sendButton: sendBtn,
    formElement: container.closest('form, .msg-form') as HTMLElement || container
  };
}

/**
 * Inspects the current page if on a LinkedIn profile page (linkedin.com/in/...).
 */
export function inspectPageProfile(): { recipientName: string; recipientHeadline: string; recipientCompany: string; threadSnippet: string; hasActiveChat: boolean } {
  // 1. Primary Name from page
  let name = '';
  const h1El = document.querySelector('h1, .pv-top-card h1, .pv-text-details__left-panel h1, [data-anonymize="person-name"]');
  if (h1El && h1El.textContent) {
    name = cleanName(h1El.textContent);
  }

  // Fallback to document.title if h1 was not found or was a generic word
  if (!name || name.toLowerCase().includes('messaging') || name.toLowerCase().includes('feed')) {
    const rawTitle = document.title || '';
    const cleanTitle = rawTitle.replace(/^\(\d+\)\s*/, '').split('|')[0].trim();
    if (cleanTitle && cleanTitle.length > 1 && !cleanTitle.toLowerCase().includes('messaging') && !cleanTitle.toLowerCase().includes('linkedin')) {
      name = cleanName(cleanTitle);
    }
  }

  // 2. Headline
  let headline = '';
  const headlineEl = document.querySelector('.text-body-medium.break-words, .pv-text-details__left-panel .text-body-medium, [data-field="headline"]');
  if (headlineEl && headlineEl.textContent) {
    headline = headlineEl.textContent.trim().split('\n')[0].trim();
  }

  // 3. Company
  let company = '';
  if (headline.includes(' @ ')) {
    company = headline.split(' @ ')[1].split('|')[0].trim();
  } else if (headline.includes(' at ')) {
    company = headline.split(' at ')[1].split('|')[0].trim();
  }

  if (!company) {
    const compEl = document.querySelector('.pv-text-details__right-panel .inline-show-more-text, button[aria-label*="Current company" i], .pv-top-card--experience-list');
    if (compEl && compEl.textContent) {
      company = cleanName(compEl.textContent);
    }
  }

  const aboutEl = document.querySelector('#about ~ .display-flex .visually-hidden, section[data-section="about"] .inline-show-more-text');

  const hasChat = Boolean(document.querySelector('.msg-form__contenteditable, div[role="textbox"]'));

  return {
    recipientName: name || '',
    recipientHeadline: headline,
    recipientCompany: company,
    threadSnippet: aboutEl?.textContent?.trim() || '',
    hasActiveChat: hasChat
  };
}

/**
 * Locates the active message composer across docked bubbles, full messaging pages,
 * and popup conversation forms using multiple fallback strategies.
 */
export function findLinkedInMessageComposer(preferred?: HTMLElement | null): HTMLElement | null {
  // Strategy 1: If preferred element is provided and still in the DOM
  if (preferred && document.body.contains(preferred)) {
    if (preferred.isContentEditable || preferred.hasAttribute('contenteditable')) {
      return preferred;
    }
    const inner = preferred.querySelector<HTMLElement>(
      '.msg-form__contenteditable, [contenteditable]:not([contenteditable="false"]), div[role="textbox"], textarea, p'
    );
    if (inner) return inner;
  }

  // Strategy 2: Direct query for LinkedIn message form contenteditable or paragraph
  const primarySelectors = [
    '.msg-overlay-conversation-bubble--is-active .msg-form__contenteditable',
    '.msg-overlay-conversation-bubble .msg-form__contenteditable',
    '.msg-convo-wrapper .msg-form__contenteditable',
    '.msg-thread .msg-form__contenteditable',
    'form.msg-form .msg-form__contenteditable',
    '.msg-form__contenteditable',
    'div.msg-form__contenteditable',
    '.msg-form__msg-content-container [contenteditable]',
    '.msg-form__contenteditable p',
    'div[role="textbox"][aria-label*="message" i]',
    'div[role="textbox"][aria-label*="Write" i]',
    'div[data-placeholder*="message" i]'
  ];

  for (const sel of primarySelectors) {
    const list = Array.from(document.querySelectorAll<HTMLElement>(sel));
    for (const el of list) {
      if (el.closest('#linkedin-ai-assistant-modal-root, #linkedin-ai-global-floating-btn')) continue;
      if (el.closest('.global-nav__search, .search-global-typeahead')) continue;
      if (el.getAttribute('role') === 'combobox') continue;
      if (document.body.contains(el)) return el;
    }
  }

  // Strategy 3: Locate any conversation bubble or message list container in the DOM
  const messageBubbles = Array.from(document.querySelectorAll<HTMLElement>(
    '.msg-overlay-conversation-bubble, .msg-overlay-compose-bubble, .msg-convo-wrapper, [data-view-name="message-overlay"]'
  ));
  for (const bubble of messageBubbles) {
    // Look inside bubble for any editable element or paragraph
    const ed = bubble.querySelector<HTMLElement>(
      '.msg-form__contenteditable, [contenteditable]:not([contenteditable="false"]), div[role="textbox"], p[contenteditable], .msg-form__msg-content-container p, textarea'
    );
    if (ed && document.body.contains(ed)) return ed;
  }

  // Strategy 4: Locate from message Send buttons in chat forms
  const sendBtns = Array.from(document.querySelectorAll<HTMLElement>(
    'button.msg-form__send-button, button.msg-form__send-btn, button[data-control-name="send"]'
  ));
  for (const btn of sendBtns) {
    if (!document.body.contains(btn)) continue;
    const form = btn.closest('form, .msg-form, .msg-overlay-conversation-bubble, .msg-convo-wrapper');
    if (form) {
      const ed = form.querySelector<HTMLElement>(
        '.msg-form__contenteditable, [contenteditable]:not([contenteditable="false"]), div[role="textbox"], p'
      );
      if (ed && document.body.contains(ed)) return ed;
    }
  }

  // Strategy 5: Universal contenteditable scan across document (strictly outside modal & search)
  const allEditables = Array.from(document.querySelectorAll<HTMLElement>(
    '[contenteditable]:not([contenteditable="false"]), div[role="textbox"]'
  ));
  for (const el of allEditables) {
    if (el.closest('#linkedin-ai-assistant-modal-root, #linkedin-ai-global-floating-btn')) continue;
    if (el.closest('.global-nav__search, .search-global-typeahead')) continue;
    if (el.getAttribute('role') === 'combobox') continue;
    if (document.body.contains(el)) return el;
  }

  return null;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Inserts generated text cleanly into LinkedIn's DraftJS / contenteditable message composer.
 */
export function insertTextIntoLinkedInComposer(editor: HTMLElement, text: string): boolean {
  try {
    // 1. If it's a textarea or input element
    if (editor instanceof HTMLTextAreaElement || editor instanceof HTMLInputElement) {
      editor.focus();
      editor.value = text;
      editor.dispatchEvent(new Event('input', { bubbles: true }));
      editor.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }

    // 2. Identify target contenteditable container
    let container = editor;
    if (!container.isContentEditable && container.parentElement?.isContentEditable) {
      container = container.parentElement;
    }

    container.focus();

    // Place cursor/selection range inside container
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(container);
    selection?.removeAllRanges();
    selection?.addRange(range);

    // Primary: execCommand
    let success = false;
    try {
      success = document.execCommand('insertText', false, text);
    } catch {
      success = false;
    }

    const currentText = container.textContent || '';
    const verifySnippet = text.trim().slice(0, 15);
    const hasText = verifySnippet.length > 0 && currentText.includes(verifySnippet);

    // Secondary fallback: Direct paragraph assignment and InputEvent dispatch
    if (!success || !hasText) {
      let pTag = container.querySelector('p');
      if (!pTag) {
        pTag = document.createElement('p');
        container.appendChild(pTag);
      }

      // Format multiline text as paragraphs or br tags
      const formattedHTML = text
        .split('\n')
        .map(line => line.trim().length > 0 ? `<p>${escapeHtml(line)}</p>` : '<p><br></p>')
        .join('');

      container.innerHTML = formattedHTML;

      // Dispatch native InputEvent so LinkedIn's React/DraftJS state updates
      const inputEvt = new InputEvent('input', {
        bubbles: true,
        cancelable: true,
        inputType: 'insertText',
        data: text,
      });
      container.dispatchEvent(inputEvt);
      container.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
      container.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
      container.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: ' ' }));
      container.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: ' ' }));

      const innerP = container.querySelector('p');
      if (innerP) {
        innerP.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'insertText', data: text }));
      }
    }

    container.scrollTop = container.scrollHeight;

    // Clean up any remaining placeholder in the form
    const form = container.closest('form, .msg-form, .msg-overlay-conversation-bubble, .msg-convo-wrapper, .msg-thread');
    if (form) {
      form.querySelectorAll('.msg-form__placeholder').forEach(ph => ph.remove());
    }

    // Enable Send button immediately
    const sendBtn = form?.querySelector<HTMLButtonElement>(
      'button.msg-form__send-button, button.msg-form__send-btn, button[type="submit"]'
    ) || document.querySelector<HTMLButtonElement>('button.msg-form__send-button, button[type="submit"]');

    if (sendBtn) {
      sendBtn.disabled = false;
      sendBtn.removeAttribute('disabled');
      sendBtn.classList.remove('artdeco-button--disabled');
    }

    return true;
  } catch (err) {
    console.error('[LinkedIn AI Assistant] Failed to insert text into composer:', err);
    return false;
  }
}
