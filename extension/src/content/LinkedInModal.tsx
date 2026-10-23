import React, { useState } from 'react';
import { generateOutreach, OutreachResponse, DraftVariation } from '../services/api';
import { insertTextIntoLinkedInComposer, findLinkedInMessageComposer } from './linkedinHelper';
import { AISettingsCard } from '../components/AISettingsCard';
import { SupportCard } from '../components/SupportCard';

interface LinkedInModalProps {
  recipientName: string;
  recipientHeadline: string;
  threadSnippet: string;
  composerElement: HTMLElement | null;
  onClose: () => void;
}

export const LinkedInModal: React.FC<LinkedInModalProps> = ({
  recipientName,
  recipientHeadline,
  threadSnippet,
  composerElement,
  onClose,
}) => {
  const [intentMode, setIntentMode] = useState<string>(
    threadSnippet && threadSnippet.trim().length > 0 ? 'contextual_reply' : 'referral'
  );
  const [tone, setTone] = useState<string>('Professional');
  const [messageLength, setMessageLength] = useState<string>('auto');
  const [userNotes, setUserNotes] = useState<string>('');
  const [useMock, setUseMock] = useState<boolean>(false);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [showSupport, setShowSupport] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<OutreachResponse | null>(null);

  // Active editable draft state
  const [selectedVariationIndex, setSelectedVariationIndex] = useState<number>(0);
  const [editedDraftText, setEditedDraftText] = useState<string>('');
  const [isCopied, setIsCopied] = useState<boolean>(false);

  const playbooks = [
    { id: 'referral', name: 'Job Referral', hint: 'Role & Job ID hook' },
    { id: 'coffee_chat', name: 'Coffee Chat', hint: '10-min career advice' },
    { id: 'founder_b2b', name: 'B2B Pitch', hint: 'Pain point & 2-min demo' },
    { id: 'follow_up', name: 'Warm Follow-Up', hint: '3-5 day zero-pressure bump' },
    { id: 'contextual_reply', name: 'Smart Reply', hint: 'Direct response to DMs' },
  ];

  const tones = ['Professional', 'Casual', 'Friendly', 'Concise', 'Sarcastic'];
  const lengths = [
    { id: 'auto', label: 'Auto' },
    { id: '50w', label: '50w' },
    { id: '100w', label: '100w' },
    { id: '200w', label: '200w' },
    { id: '300w', label: '300w' },
    { id: '500w', label: '500w' },
  ];

  const handleGenerate = async () => {
    setIsLoading(true);
    setError(null);
    setIsCopied(false);

    try {
      const res = await generateOutreach({
        recipientName,
        recipientHeadline,
        threadContext: intentMode === 'contextual_reply' ? threadSnippet : undefined,
        intentMode,
        tone,
        messageLength,
        userNotes: userNotes.trim() || undefined,
        mock: useMock,
      });

      if (res.success && res.drafts?.length > 0) {
        setResponse(res);
        setSelectedVariationIndex(0);
        setEditedDraftText(res.drafts[0].text);
      } else {
        setError(res.error || 'Failed to generate message. Please try again.');
      }
    } catch (err: any) {
      if (err.message?.includes('NO_KEY_SAVED')) {
        setShowSettings(true);
        setError('Please enter your free Groq or Gemini API key in ⚙️ AI Keys (or check Fast Mode).');
      } else {
        setError(err.message || 'An unexpected error occurred contacting AI.');
      }
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

  const handleInsert = async () => {
    const textToInsert = editedDraftText.trim();
    if (!textToInsert) return;

    let editor = findLinkedInMessageComposer(composerElement);

    // If chat composer is not found yet, check if there's an existing conversation bubble that is minimized
    if (!editor) {
      const minHeader = document.querySelector<HTMLElement>(
        '.msg-overlay-conversation-bubble--is-minimized .msg-overlay-bubble-header, .msg-overlay-bubble-header[data-control-name="overlay.minimize_conversation_bar"]'
      );
      if (minHeader) {
        minHeader.click();
        await new Promise(r => setTimeout(r, 200));
        editor = findLinkedInMessageComposer();
      }
    }

    // Only click the native Message button if NO conversation bubble exists at all in the DOM
    if (!editor) {
      const hasAnyBubble = Boolean(document.querySelector('.msg-overlay-conversation-bubble, .msg-convo-wrapper'));
      if (!hasAnyBubble) {
        const nativeMsgBtn = Array.from(document.querySelectorAll<HTMLElement>('button, a')).find(el => {
          if (el.classList.contains('linkedin-ai-btn')) return false;
          if (el.closest('aside, .scaffold-layout__aside')) return false;
          const t = (el.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
          const aria = (el.getAttribute('aria-label') || '').toLowerCase();
          return t === 'message' || t.startsWith('message ') || aria.startsWith('message');
        });

        if (nativeMsgBtn) {
          nativeMsgBtn.click();
          for (let i = 0; i < 12; i++) {
            await new Promise(r => setTimeout(r, 150));
            editor = findLinkedInMessageComposer();
            if (editor) break;
          }
        }
      }
    }

    if (!editor) {
      handleCopy();
      setError('Could not find active chat box. Draft copied to clipboard — press Ctrl+V in the message box to paste!');
      return;
    }

    const success = insertTextIntoLinkedInComposer(editor, textToInsert);
    if (success) {
      onClose();
    } else {
      handleCopy();
      setError('Failed to paste directly. Copied to clipboard instead!');
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(editedDraftText);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const currentWordCount = editedDraftText.trim().length > 0
    ? editedDraftText.trim().split(/\s+/).length
    : 0;

  const isProfilePage = typeof window !== 'undefined' && window.location.pathname.includes('/in/');

  return (
    <div className="lk-modal-backdrop" onClick={onClose}>
      <div className="lk-modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="lk-modal-header">
          <div className="lk-header-left">
            <div className="lk-logo-badge">inAI</div>
            <div>
              <h3 className="lk-title">LinkedIn AI Outreach Assistant</h3>
              <span className="lk-subtitle">
                Target: <strong>{recipientName}</strong> {recipientHeadline ? `• ${recipientHeadline.slice(0, 45)}...` : ''}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              className="lk-settings-toggle-btn"
              onClick={() => setShowSupport(!showSupport)}
              title="Support the Developer with Love"
              style={{ color: '#db2777', borderColor: '#fbcfe8', background: '#fdf2f8' }}
            >
              💖 <span>Support</span>
            </button>
            <button
              type="button"
              className={`lk-settings-toggle-btn ${showSettings ? 'active' : ''}`}
              onClick={() => setShowSettings(!showSettings)}
              title="AI Provider & API Key Settings"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 13, height: 13, verticalAlign: 'middle', marginRight: 4 }}>
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              <span>AI Settings</span>
            </button>
            <button className="lk-close-btn" onClick={onClose} title="Close">✕</button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="lk-modal-body">
          {showSupport && <SupportCard onClose={() => setShowSupport(false)} />}
          {showSettings && (
            <AISettingsCard onClose={() => setShowSettings(false)} onKeySaved={() => setError(null)} />
          )}

          {/* Intent Playbook Mode */}
          <div className="lk-field-group">
            <label className="lk-field-label">Select Playbook Objective:</label>
            <div className="lk-playbook-pills">
              {playbooks.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`lk-playbook-pill ${intentMode === p.id ? 'active' : ''}`}
                  onClick={() => setIntentMode(p.id)}
                >
                  <span className="pill-name">{p.name}</span>
                  <span className="pill-desc">{p.hint}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Tone Selector */}
          <div className="lk-field-group">
            <label className="lk-field-label">Tone:</label>
            <div className="lk-pill-row">
              {tones.map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`lk-filter-pill ${tone === t ? 'active' : ''}`}
                  onClick={() => setTone(t)}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Length Selector */}
          <div className="lk-field-group">
            <div className="lk-field-header-row">
              <label className="lk-field-label">Length:</label>
              <span className="lk-length-indicator">
                {messageLength === 'auto' ? 'Auto' : messageLength}
              </span>
            </div>
            <div className="lk-pill-row">
              {lengths.map((len) => (
                <button
                  key={len.id}
                  type="button"
                  className={`lk-filter-pill ${messageLength === len.id ? 'active' : ''}`}
                  onClick={() => setMessageLength(len.id)}
                >
                  {len.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Notes / Specific job specs to include */}
          <div className="lk-field-group">
            <div className="lk-field-header-row">
              <label className="lk-field-label">Job Specs / Extra Lines to Include (Optional):</label>
              <span className="lk-field-hint">e.g. Job ID, Role, Location, Tech stack</span>
            </div>
            <textarea
              className="lk-textarea"
              rows={5}
              placeholder="e.g.&#10;Software Engineer&#10;Location: Bangalore, India (Hybrid)&#10;Job ID: 2028048"
              value={userNotes}
              onChange={(e) => setUserNotes(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  handleGenerate();
                }
              }}
            />
          </div>

          {/* Action Row */}
          <div className="lk-action-bar">
            <label className="lk-checkbox-label">
              <input
                type="checkbox"
                checked={useMock}
                onChange={(e) => setUseMock(e.target.checked)}
              />
              <span>Fast Mode</span>
            </label>

            <button
              type="button"
              className="lk-btn-primary"
              disabled={isLoading}
              onClick={handleGenerate}
            >
              {isLoading ? (
                <>
                  <span className="lk-spinner" /> Generating Best Message...
                </>
              ) : response ? (
                '🔄 Refine & Regenerate'
              ) : (
                '⚡ Generate Best Message'
              )}
            </button>
          </div>

          {error && <div className="lk-alert lk-alert-error">{error}</div>}

          {/* Generated Result: Single Best Message Card */}
          {response && (
            <div className="lk-result-section">
              {/* Grounded Signal Notice */}
              <div className="lk-signal-card">
                <div className="signal-badge">
                  {response.hasMeaningfulSignal ? 'VERIFIED CONTEXT APPLIED' : 'PROFILE NOTICE'}
                </div>
                <div className="signal-text">{response.verifiedSignal}</div>
                <div className="signal-reason">{response.relevanceReason}</div>
              </div>

              {/* Variation Switcher Pills if >1 draft */}
              {response.drafts?.length > 1 && (
                <div className="lk-variation-tabs">
                  {response.drafts.map((draft: DraftVariation, idx: number) => (
                    <button
                      key={draft.id}
                      type="button"
                      className={`lk-variation-tab ${selectedVariationIndex === idx ? 'active' : ''}`}
                      onClick={() => handleSelectVariation(idx)}
                    >
                      {draft.tag || (idx === 0 ? 'Best Message' : 'Short Note')}
                    </button>
                  ))}
                </div>
              )}

              {/* Editable Single Draft Card */}
              <div className="lk-single-draft-card">
                <div className="draft-header">
                  <div className="draft-title-group">
                    <span className="draft-title">
                      {response.drafts[selectedVariationIndex]?.title || 'Best Tailored Message'}
                    </span>
                    <span className="draft-tag">
                      {response.drafts[selectedVariationIndex]?.tag || 'Recommended'}
                    </span>
                  </div>
                  <span className="char-badge">
                    <span className={editedDraftText.length <= 300 ? 'char-safe' : ''}>
                      {editedDraftText.length} chars
                    </span>
                    {' • '}{currentWordCount} words
                  </span>
                </div>

                {/* Direct Editable Text Area */}
                <textarea
                  className="lk-editable-draft-textarea"
                  value={editedDraftText}
                  onChange={(e) => setEditedDraftText(e.target.value)}
                  rows={6}
                  placeholder="Generated message will appear here..."
                />

                <div className="draft-footer">
                  {isProfilePage ? (
                    <button type="button" className="lk-btn-insert" onClick={handleCopy}>
                      {isCopied ? '✓ Copied!' : 'Copy'}
                    </button>
                  ) : (
                    <>
                      <button type="button" className="lk-btn-secondary" onClick={handleCopy}>
                        {isCopied ? 'Copied!' : 'Copy'}
                      </button>
                      <button type="button" className="lk-btn-insert" onClick={handleInsert}>
                        Insert into Chat
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
