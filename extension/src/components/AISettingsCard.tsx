import React, { useState, useEffect } from 'react';
import { AIProvider, AISettings, getAISettings, saveAISettings } from '../services/aiEngine';
import './AISettingsCard.css';

interface AISettingsCardProps {
  onClose?: () => void;
  onKeySaved?: () => void;
}

export const AISettingsCard: React.FC<AISettingsCardProps> = ({ onClose, onKeySaved }) => {
  const [provider, setProvider] = useState<AIProvider>('groq');
  const [groqKey, setGroqKey] = useState<string>('');
  const [geminiKey, setGeminiKey] = useState<string>('');
  const [openaiKey, setOpenaiKey] = useState<string>('');
  const [showKey, setShowKey] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const s = await getAISettings();
    setProvider(s.provider || 'groq');
    setGroqKey(s.groqKey || '');
    setGeminiKey(s.geminiKey || '');
    setOpenaiKey(s.openaiKey || '');
  };

  const currentKey = provider === 'groq' ? groqKey : provider === 'gemini' ? geminiKey : openaiKey;
  const isKeySaved = Boolean(currentKey && currentKey.trim().length > 5);

  const handleKeyChange = (val: string) => {
    if (provider === 'groq') setGroqKey(val);
    else if (provider === 'gemini') setGeminiKey(val);
    else setOpenaiKey(val);
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        handleKeyChange(text.trim());
      }
    } catch {
      // Fallback
    }
  };

  const handleSave = async () => {
    await saveAISettings({
      provider,
      groqKey,
      geminiKey,
      openaiKey,
    });
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2200);
    if (onKeySaved) onKeySaved();
  };

  const getPlaceholder = () => {
    if (provider === 'groq') return 'gsk_...';
    if (provider === 'gemini') return 'AIzaSy...';
    return 'sk-...';
  };

  const getHelpLink = () => {
    if (provider === 'groq') {
      return {
        label: 'Get a free key at Groq Console (console.groq.com)',
        url: 'https://console.groq.com/keys',
      };
    }
    if (provider === 'gemini') {
      return {
        label: 'Get a free key at Google AI Studio (aistudio.google.com)',
        url: 'https://aistudio.google.com/',
      };
    }
    return {
      label: 'Get an API key at OpenAI Platform (platform.openai.com)',
      url: 'https://platform.openai.com/api-keys',
    };
  };

  const help = getHelpLink();

  return (
    <div className="ai-settings-card">
      <div className="ai-settings-header">
        <span className="ai-settings-title">AI Settings (Gemini / GPT / Groq)</span>
        <div className="ai-settings-badge-row">
          <span className={`ai-status-pill ${isKeySaved ? 'saved' : 'empty'}`}>
            <span className="status-dot">{isKeySaved ? '●' : '○'}</span>
            <span>{isKeySaved ? 'Key saved' : 'No key saved'}</span>
          </span>
          {onClose && (
            <button type="button" className="ai-settings-close" onClick={onClose} title="Close settings">
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Explicit User Instruction */}
      <div className="ai-instruction-box">
        <span className="ai-instruction-icon">💡</span>
        <span className="ai-instruction-text">
          Kindly add your own AI model API key below to enable personalized AI message generation. <strong>Groq is recommended</strong> (it is 100% free with zero credit card required).
        </span>
      </div>

      {/* Provider Selector Tabs */}
      <div className="ai-provider-tabs">
        <button
          type="button"
          className={`ai-provider-tab ${provider === 'groq' ? 'active' : ''}`}
          onClick={() => {
            setProvider('groq');
            saveAISettings({ provider: 'groq' });
          }}
        >
          Groq (Free)
        </button>
        <button
          type="button"
          className={`ai-provider-tab ${provider === 'gemini' ? 'active' : ''}`}
          onClick={() => {
            setProvider('gemini');
            saveAISettings({ provider: 'gemini' });
          }}
        >
          Gemini
        </button>
        <button
          type="button"
          className={`ai-provider-tab ${provider === 'openai' ? 'active' : ''}`}
          onClick={() => {
            setProvider('openai');
            saveAISettings({ provider: 'openai' });
          }}
        >
          OpenAI
        </button>
      </div>

      {/* Key Input Section */}
      <div className="ai-key-section">
        <label className="ai-key-label">
          {provider === 'groq' ? 'Groq API Key' : provider === 'gemini' ? 'Gemini API Key' : 'OpenAI API Key'}
        </label>
        <div className="ai-input-row">
          <div className="ai-input-wrap">
            <input
              type={showKey ? 'text' : 'password'}
              className="ai-key-input"
              placeholder={getPlaceholder()}
              value={currentKey}
              onChange={(e) => handleKeyChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSave();
                }
              }}
            />
            <button
              type="button"
              className="ai-eye-btn"
              onClick={() => setShowKey(!showKey)}
              title={showKey ? 'Hide key' : 'Show key'}
            >
              {showKey ? '👁️' : '👁️‍🗨️'}
            </button>
          </div>
          <button type="button" className="ai-paste-btn" onClick={handlePaste} title="Paste from clipboard">
            Paste
          </button>
          <button type="button" className={`ai-save-btn ${saveSuccess ? 'saved' : ''}`} onClick={handleSave}>
            {saveSuccess ? '✓ Saved' : 'Save'}
          </button>
        </div>
      </div>

      {/* Helper Link */}
      <div className="ai-settings-footer">
        <a href={help.url} target="_blank" rel="noopener noreferrer" className="ai-helper-link">
          {help.label}
        </a>
      </div>
    </div>
  );
};
