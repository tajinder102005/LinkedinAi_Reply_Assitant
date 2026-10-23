import React, { useState, useEffect } from 'react';
import { checkBackendHealth, generateOutreach, OutreachResponse, DraftVariation } from '../services/api';
import { AISettingsCard } from '../components/AISettingsCard';
import './popup.css';

export const Popup: React.FC = () => {
  const [backendStatus, setBackendStatus] = useState<{ online: boolean; message: string }>({
    online: false,
    message: 'Checking port 8085...',
  });

  const [isLinkedInTab, setIsLinkedInTab] = useState<boolean>(false);
  const [syncedContact, setSyncedContact] = useState<string | null>(null);

  const [name, setName] = useState<string>('');
  const [company, setCompany] = useState<string>('');
  const [role, setRole] = useState<string>('');
  const [activity, setActivity] = useState<string>('');
  const [intentMode, setIntentMode] = useState<string>('referral');
  const [useMock, setUseMock] = useState<boolean>(false);
  const [showSettings, setShowSettings] = useState<boolean>(false);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [response, setResponse] = useState<OutreachResponse | null>(null);
  const [selectedVariationIndex, setSelectedVariationIndex] = useState<number>(0);
  const [editedDraftText, setEditedDraftText] = useState<string>('');
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [insertStatus, setInsertStatus] = useState<string | null>(null);

  useEffect(() => {
    checkHealth();
    syncWithActiveTab();
  }, []);

  const checkHealth = async () => {
    const health = await checkBackendHealth();
    setBackendStatus(health);
  };

  const populateFromContext = (ctx: any) => {
    if (!ctx) return;
    if (ctx.recipientName && ctx.recipientName !== 'Colleague' && ctx.recipientName.length > 1) {
      setName(ctx.recipientName);
      setSyncedContact(ctx.recipientName);
    }
    if (ctx.recipientCompany) {
      setCompany(ctx.recipientCompany);
    }
    if (ctx.recipientHeadline) {
      setRole(ctx.recipientHeadline);
    }
    if (ctx.threadSnippet) {
      setActivity(ctx.threadSnippet);
    }
    if (ctx.hasActiveChat) {
      setIntentMode('contextual_reply');
    } else {
      setIntentMode('referral');
    }
  };

  const syncWithActiveTab = () => {
    if (typeof chrome === 'undefined' || !chrome.tabs || !chrome.tabs.query) {
      return;
    }

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0];
      if (!activeTab || !activeTab.id || !activeTab.url) return;

      const isLk = activeTab.url.includes('linkedin.com');
      setIsLinkedInTab(isLk);

      if (isLk) {
        // Strategy 1: Message Content Script
        chrome.tabs.sendMessage(activeTab.id, { action: 'GET_CHAT_CONTEXT' }, (res) => {
          if (!chrome.runtime.lastError && res?.success && res?.context) {
            populateFromContext(res.context);
            return;
          }

          // Strategy 2: Direct Script Execution Fallback (Works even without page refresh)
          if (chrome.scripting && chrome.scripting.executeScript) {
            chrome.scripting.executeScript(
              {
                target: { tabId: activeTab.id! },
                func: () => {
                  const nameEl = document.querySelector(
                    'h1, .msg-overlay-bubble-header__title, .msg-entity-lockup__entity-title, .msg-title-bar__title, .msg-conversation-topbar__name'
                  );
                  const headlineEl = document.querySelector(
                    '.text-body-medium.break-words, .pv-text-details__left-panel div.text-body-medium, [data-field="headline"], .pv-text-details__left-panel div:nth-child(2)'
                  );
                  const aboutEl = document.querySelector(
                    'section[data-section="about"] .inline-show-more-text, #about ~ .display-flex .visually-hidden'
                  );
                  const recentMsgEl = document.querySelector(
                    '.msg-s-event-listitem__body, .msg-s-message-group__bubble'
                  );

                  const rawName = nameEl?.textContent?.trim() || '';
                  const clean = rawName
                    .split('\n')[0]
                    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
                    .replace(/•.*$/g, '')
                    .trim();

                  const headline = headlineEl?.textContent?.trim() || '';
                  let company = '';
                  if (headline.includes(' at ')) company = headline.split(' at ').pop()?.trim() || '';
                  else if (headline.includes(' @ ')) company = headline.split(' @ ').pop()?.trim() || '';

                  const chatActive = Boolean(document.querySelector('.msg-form__contenteditable, div[role="textbox"]'));

                  return {
                    recipientName: clean,
                    recipientHeadline: headline,
                    recipientCompany: company,
                    threadSnippet: recentMsgEl?.textContent?.trim() || aboutEl?.textContent?.trim() || '',
                    hasActiveChat: chatActive,
                  };
                },
              },
              (results) => {
                if (results && results[0] && results[0].result) {
                  populateFromContext(results[0].result);
                }
              }
            );
          }
        });
      }
    });
  };

  const handleGenerate = async () => {
    setIsLoading(true);
    setResponse(null);
    setInsertStatus(null);
    setIsCopied(false);

    try {
      const res = await generateOutreach({
        recipientName: name.trim() || undefined,
        currentCompany: company.trim() || undefined,
        currentRole: role.trim() || undefined,
        recentActivity: activity.trim() || undefined,
        intentMode,
        userNotes: activity.trim() || undefined,
        mock: useMock,
      });

      if (res.success && res.drafts?.length > 0) {
        setResponse(res);
        setSelectedVariationIndex(0);
        setEditedDraftText(res.drafts[0].text);
      }
    } catch (err: any) {
      if (err.message?.includes('NO_KEY_SAVED')) {
        setShowSettings(true);
        setInsertStatus('Please enter your free Groq or Gemini API key in Settings ⚙️ (or check Fast Mode).');
      } else {
        setInsertStatus(`Error: ${err.message || 'Generation failed'}`);
      }
      console.warn('Generation error:', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectVariation = (index: number) => {
    if (!response || !response.drafts[index]) return;
    setSelectedVariationIndex(index);
    setEditedDraftText(response.drafts[index].text);
    setIsCopied(false);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(editedDraftText);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleInsertIntoLinkedIn = () => {
    const textToInsert = editedDraftText.trim();
    if (!textToInsert) return;

    if (typeof chrome === 'undefined' || !chrome.tabs || !chrome.tabs.query) {
      handleCopy();
      return;
    }

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0];
      if (!activeTab || !activeTab.id) return;

      chrome.tabs.sendMessage(activeTab.id, { action: 'INSERT_DRAFT', text: textToInsert }, (res) => {
        if (!chrome.runtime.lastError && res?.success) {
          setInsertStatus('Inserted directly into LinkedIn message box!');
          setTimeout(() => setInsertStatus(null), 3000);
          return;
        }

        // Direct DOM insertion fallback via executeScript
        if (chrome.scripting && chrome.scripting.executeScript) {
          chrome.scripting.executeScript(
            {
              target: { tabId: activeTab.id! },
              args: [textToInsert],
              func: (str: string) => {
                const editor = document.querySelector<HTMLElement>(
                  '.msg-form__contenteditable, div[role="textbox"][contenteditable="true"], div[contenteditable="true"]'
                );
                if (!editor) return false;

                editor.focus();
                const selection = window.getSelection();
                if (selection && selection.rangeCount > 0) {
                  const range = selection.getRangeAt(0);
                  range.deleteContents();
                }

                const success = document.execCommand('insertText', false, str);
                if (!success) {
                  editor.innerHTML = `<p>${str.replace(/\n/g, '<br>')}</p>`;
                  editor.dispatchEvent(new Event('input', { bubbles: true }));
                  editor.dispatchEvent(new Event('change', { bubbles: true }));
                }

                const sendBtn = document.querySelector<HTMLButtonElement>('button.msg-form__send-button, button[type="submit"]');
                if (sendBtn && sendBtn.disabled) {
                  sendBtn.disabled = false;
                  sendBtn.removeAttribute('disabled');
                }

                return true;
              },
            },
            (results) => {
              const ok = results && results[0] && results[0].result;
              if (ok) {
                setInsertStatus('Inserted directly into LinkedIn message box!');
              } else {
                setInsertStatus('Copied to clipboard!');
                navigator.clipboard.writeText(textToInsert);
              }
              setTimeout(() => setInsertStatus(null), 3000);
            }
          );
        } else {
          setInsertStatus('Copied to clipboard!');
          navigator.clipboard.writeText(textToInsert);
          setTimeout(() => setInsertStatus(null), 3000);
        }
      });
    });
  };

  const playbooks = [
    { id: 'referral', name: 'Job Referral' },
    { id: 'coffee_chat', name: 'Coffee Chat' },
    { id: 'founder_b2b', name: 'B2B Pitch' },
    { id: 'follow_up', name: 'Warm Follow-Up' },
    { id: 'contextual_reply', name: 'Smart Reply' },
  ];

  const currentWordCount = editedDraftText.trim().length > 0
    ? editedDraftText.trim().split(/\s+/).length
    : 0;

  return (
    <div className="popup-container">
      {/* Header */}
      <div className="popup-header">
        <div className="popup-header-left">
          <div className="popup-logo-icon">inAI</div>
          <div>
            <h1 className="popup-title">LinkedIn AI Assistant</h1>
            <div className="popup-subtitle">Direct Client AI & Grounded Generator</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            type="button"
            className={`popup-settings-btn ${showSettings ? 'active' : ''}`}
            title="Configure AI API Key Settings"
            onClick={() => setShowSettings(!showSettings)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 13, height: 13, verticalAlign: 'middle', marginRight: 4 }}>
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            <span>Settings</span>
          </button>
          <button
            className="popup-refresh-btn"
            title="Sync with Active LinkedIn Page"
            onClick={syncWithActiveTab}
          >
            🔄
          </button>
        </div>
      </div>

      {/* Explicit User Guidance Banner (Shown when no key is configured yet) */}
      {!backendStatus.online && !showSettings && (
        <div className="ai-setup-guide-card">
          <div className="ai-setup-guide-text">
            <span className="ai-setup-guide-icon">💡</span>
            <span>Kindly add your own AI model API key here to start generating messages.</span>
          </div>
          <button
            type="button"
            className="ai-setup-guide-btn"
            onClick={() => setShowSettings(true)}
          >
            ⚙️ Set Key
          </button>
        </div>
      )}

      {/* AI Model & Page Status */}
      <div className="popup-status-bar">
        <div
          className="status-indicator"
          onClick={() => setShowSettings(true)}
          style={{ cursor: 'pointer' }}
          title="Click to configure AI API key"
        >
          <span className={`status-dot ${backendStatus.online ? 'online' : 'offline'}`} />
          <span>{backendStatus.message}</span>
        </div>
        {syncedContact ? (
          <div className="status-synced">
            Target: <strong>{syncedContact}</strong>
          </div>
        ) : isLinkedInTab ? (
          <div className="status-synced">LinkedIn Page Active</div>
        ) : null}
      </div>

      {/* Settings Drawer */}
      {showSettings && (
        <div style={{ padding: '10px 14px 0 14px' }}>
          <AISettingsCard
            onClose={() => setShowSettings(false)}
            onKeySaved={() => {
              checkHealth();
            }}
          />
        </div>
      )}

      {/* Scrollable Form Body */}
      <div className="popup-body">
        {/* Playbook Mode Selector */}
        <div className="popup-section">
          <label className="section-label">SELECT PLAYBOOK OBJECTIVE:</label>
          <div className="playbook-chips">
            {playbooks.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`playbook-chip ${intentMode === p.id ? 'active' : ''}`}
                onClick={() => setIntentMode(p.id)}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>

        {/* Target Details Form */}
        <div className="popup-form-grid">
          <div className="form-group">
            <label>TARGET NAME:</label>
            <input
              type="text"
              placeholder="e.g. shivansh kumar"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>COMPANY:</label>
            <input
              type="text"
              placeholder="e.g. EPAM, Stripe"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
            />
          </div>
        </div>

        <div className="form-group">
          <label>CURRENT ROLE / HEADLINE:</label>
          <input
            type="text"
            placeholder="e.g. Junior SWE @ EPAM | CSE'27"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label>JOB SPECS / DETAILS TO INCLUDE (OPTIONAL):</label>
          <textarea
            rows={5}
            placeholder="e.g.&#10;Software Engineer&#10;Location: Bangalore, India (Hybrid)&#10;Job ID: 2028048"
            value={activity}
            onChange={(e) => setActivity(e.target.value)}
          />
        </div>

        {/* Action Row */}
        <div className="popup-action-row">
          <label className="checkbox-container">
            <input
              type="checkbox"
              checked={useMock}
              onChange={(e) => setUseMock(e.target.checked)}
            />
            <span>Fast Mode</span>
          </label>

          <button
            type="button"
            className="btn-generate"
            disabled={isLoading}
            onClick={handleGenerate}
          >
            {isLoading ? 'Generating Best Message...' : response ? '🔄 Refine & Regenerate' : '⚡ Generate Best Message'}
          </button>
        </div>

        {insertStatus && (
          <div className="insert-notification">{insertStatus}</div>
        )}

        {/* Results Area: Single Best Message Card */}
        {response && (
          <div className="popup-results">
            {/* Verified Signal Banner */}
            <div className="signal-box">
              <div className="signal-title">
                {response.hasMeaningfulSignal ? 'VERIFIED CONTEXT APPLIED' : 'PROFILE NOTICE'}
              </div>
              <div className="signal-body">{response.verifiedSignal}</div>
              <div className="signal-sub">{response.relevanceReason}</div>
            </div>

            {/* Variation Switcher if available */}
            {response.drafts?.length > 1 && (
              <div className="playbook-chips">
                {response.drafts.map((d: DraftVariation, idx: number) => (
                  <button
                    key={d.id}
                    type="button"
                    className={`playbook-chip ${selectedVariationIndex === idx ? 'active' : ''}`}
                    onClick={() => handleSelectVariation(idx)}
                  >
                    {d.tag || (idx === 0 ? 'Best Message' : 'Short Note')}
                  </button>
                ))}
              </div>
            )}

            {/* Editable Single Draft Card */}
            <div className="draft-item">
              <div className="draft-meta">
                <span className="draft-title-text">
                  {response.drafts[selectedVariationIndex]?.title || 'Best Tailored Message'}
                </span>
                <span className="draft-char-count">
                  <span className={editedDraftText.length <= 300 ? 'char-safe' : ''}>
                    {editedDraftText.length} chars
                  </span>
                  {' • '}{currentWordCount} words
                </span>
              </div>

              {/* Editable Textarea in Popup */}
              <textarea
                className="popup-editable-textarea"
                value={editedDraftText}
                onChange={(e) => setEditedDraftText(e.target.value)}
                rows={6}
              />

              <div className="draft-action-btns">
                {isLinkedInTab && (
                  <button
                    type="button"
                    className="btn-insert-direct"
                    onClick={handleInsertIntoLinkedIn}
                  >
                    Insert into Chat
                  </button>
                )}
                <button
                  type="button"
                  className="btn-copy-draft"
                  onClick={handleCopy}
                >
                  {isCopied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="popup-footer">
        Look for the blue <strong>AI Reply</strong> button right inside the chat box or on profile pages.
      </div>
    </div>
  );
};
