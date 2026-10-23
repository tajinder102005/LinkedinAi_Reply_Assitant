import React, { useState } from 'react';
import './SupportCard.css';

interface SupportCardProps {
  onClose?: () => void;
}

export const SupportCard: React.FC<SupportCardProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<'upi' | 'bmc'>('upi');

  const qrImageUrl =
    typeof chrome !== 'undefined' && chrome.runtime?.getURL
      ? chrome.runtime.getURL('phone_pay_recieve_money.png')
      : 'phone_pay_recieve_money.png';

  const bmcUrl = 'https://buymeacoffee.com/tajinder102005';

  return (
    <div className="support-card-backdrop" onClick={onClose}>
      <div className="support-card-container" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="support-card-header">
          <div className="support-card-title-group">
            <span className="support-heart-icon">💖</span>
            <div>
              <h3 className="support-card-title">Support the Developer</h3>
              <p className="support-card-subtitle">
                Built with love! If this tool helped you save time or get replies, your support keeps it free & updated.
              </p>
            </div>
          </div>
          {onClose && (
            <button
              type="button"
              className="support-close-btn"
              onClick={onClose}
              title="Close"
              aria-label="Close"
            >
              ✕
            </button>
          )}
        </div>

        {/* Payment Tabs */}
        <div className="support-tabs">
          <button
            type="button"
            className={`support-tab-btn ${activeTab === 'upi' ? 'active' : ''}`}
            onClick={() => setActiveTab('upi')}
          >
            🇮🇳 UPI / PhonePe / GPay
          </button>
          <button
            type="button"
            className={`support-tab-btn ${activeTab === 'bmc' ? 'active' : ''}`}
            onClick={() => setActiveTab('bmc')}
          >
            ☕ Buy Me a Coffee (Global)
          </button>
        </div>

        {/* Tab 1: UPI QR Code */}
        {activeTab === 'upi' && (
          <div className="support-tab-content upi-content">
            <div className="upi-qr-wrapper">
              <img
                src={qrImageUrl}
                alt="PhonePe / UPI QR Code"
                className="upi-qr-image"
                onError={(e) => {
                  // Fallback relative path if getURL failed
                  const target = e.target as HTMLImageElement;
                  if (!target.src.includes('phone_pay_recieve_money.png')) {
                    target.src = 'phone_pay_recieve_money.png';
                  }
                }}
              />
            </div>
            <div className="upi-badge-list">
              <span className="upi-badge">PhonePe</span>
              <span className="upi-badge">Google Pay</span>
              <span className="upi-badge">Navi</span>
              <span className="upi-badge">Paytm</span>
              <span className="upi-badge">BHIM</span>
            </div>
            <p className="upi-helper-text">
              Scan with <strong>PhonePe, Google Pay, Navi</strong>, or any UPI app to send love directly!
            </p>
          </div>
        )}

        {/* Tab 2: Buy Me a Coffee */}
        {activeTab === 'bmc' && (
          <div className="support-tab-content bmc-content">
            <div className="bmc-promo-box">
              <div className="bmc-cup-icon">☕</div>
              <h4 className="bmc-heading">Buy Me a Coffee</h4>
              <p className="bmc-desc">
                For international supporters & cards (Credit/Debit, Apple Pay, PayPal).
              </p>
              <a
                href={bmcUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="bmc-action-btn"
              >
                <span>☕</span>
                <span>Support on Buy Me a Coffee</span>
                <span>↗</span>
              </a>
              <span className="bmc-handle">buymeacoffee.com/tajinder102005</span>
            </div>
          </div>
        )}

        {/* Footer Note */}
        <div className="support-card-footer">
          <span>Thank you for being part of this journey! 🙏</span>
        </div>
      </div>
    </div>
  );
};
