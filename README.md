# LinkedIn AI Outreach & Reply Assistant 🚀

> **Smart AI Reply, Verified Personalization & Outreach Playbooks for LinkedIn.**  
> Built with **React**, **TypeScript**, **Chrome Extension Manifest V3**, and an optional **Java Spring Boot** backend.

---

## 🌟 Key Features

- **🎯 5 Tailored Outreach Playbooks**:
  - **Job Referral Request**: Concise elevator pitch, role & Job ID hook, and portfolio/resume reference.
  - **Coffee Chat / Mentorship**: Low-pressure, genuine questions about career paths and leadership.
  - **Founder / B2B Outreach**: Highlights real pain points, presents value, and offers a soft call-to-action (e.g. 2-minute demo).
  - **Warm Follow-Up**: Zero-pressure bump for conversations that went quiet after 3–5 days.
  - **Smart Contextual Reply**: Analyzes incoming messages and crafts context-aware replies.
- **🛡️ Anti-Cliché Personalization**: Eliminates generic spam greetings (*"Hope this email finds you well"*, *"I came across your profile"*).
- **⚡ 3 Variations Per Generation**: Direct, Value-Add, and Low-Pressure drafts with live character & word counters.
- **🖱️ 1-Click Native UI Injection**: Injects an **`✨ AI Reply`** button directly into LinkedIn messaging and docked chat bubbles.
- **🔌 Multi-Engine AI Support**:
  - Direct in-browser inference with free **Groq** (sub-second Llama 3 / Mixtral inference), **Google Gemini Flash**, or **OpenAI**.
  - **Fast Mode**: Instant offline high-converting templates.
  - Optional enterprise **Spring Boot microservice** with automatic multi-model fallback.

---

## 📦 Installation & Setup

### Option 1: Load Pre-Built Extension in Chrome (Fastest)
1. Download or clone this repository:
   ```bash
   git clone https://github.com/tajinder102005/LinkedinAi_Reply_Assitant.git
   ```
2. Build the extension bundle:
   ```bash
   cd extension
   npm install
   npm run build
   ```
3. Open your browser and navigate to `chrome://extensions/` (or `edge://extensions/`).
4. Enable **Developer mode** in the top-right corner.
5. Click **Load unpacked** and select the `extension/dist` folder.
6. Pin the extension to your toolbar.

---

## ⚙️ Configuration (AI API Keys)

1. Click the **LinkedIn AI Outreach** extension icon in your browser toolbar.
2. Click **⚙️ AI Keys / Settings**.
3. Select your provider:
   - **Groq (Recommended - Free & Fast)**: Get a free key at [console.groq.com](https://console.groq.com).
   - **Gemini**: Get a free key from [Google AI Studio](https://aistudio.google.com).
   - **OpenAI**: Use your standard API key.
4. Click **Save Settings**. (Or check **⚡ Fast Mode** for instant template generation without an API key).

---

## 🚀 How to Use

### 1. In LinkedIn Direct Messages & Chat
- Open any chat on LinkedIn.
- Notice the **`✨ AI Reply`** button next to the Send button.
- Click it to open the in-situ assistant modal. The recipient's name and message context will automatically pre-populate.
- Select your **Playbook**, **Tone**, and **Length**.
- Click **Generate Message**, review the 3 draft variations, make any quick edits, and click **Insert into Chat**.

### 2. When Visiting a Profile
- Open any LinkedIn profile (recruiter, founder, or hiring manager).
- Click the extension icon in your toolbar to auto-sync their name, headline, and current company.
- Select your playbook (e.g. *Job Referral*), add notes (e.g. *Job ID 12345*), and generate your outreach note!

---

## 🛠️ Project Structure

```
├── extension/                          # Chrome Extension (Manifest V3)
│   ├── public/manifest.json            # Extension manifest
│   ├── src/
│   │   ├── content/                    # Content script & DOM injectors
│   │   ├── popup/                      # Extension popup UI
│   │   ├── services/                   # LLM connectors (Groq, Gemini, OpenAI)
│   │   └── components/                 # Reusable UI components
│   └── package.json
└── backend/                            # Optional Spring Boot Java Microservice
    ├── pom.xml
    └── src/main/java/com/linkedin/ai/outreach/
```

---

## ☕ Optional: Running the Spring Boot Backend

If you want to run the enterprise fallback microservice:
```bash
cd backend
mvn spring-boot:run
```
The backend starts on port `8085` with endpoints:
- `GET /api/linkedin/health`
- `GET /api/linkedin/playbooks`
- `POST /api/linkedin/generate`

---

## 💖 Support the Developer

If this extension helped you save time, land an interview referral, or close a client on LinkedIn, consider supporting future development and maintenance!

<div align="center">

### Option 1: 🇮🇳 India (UPI / PhonePe / Google Pay / Navi / Paytm)
Scan with any UPI app:

<img src="./extension/public/phone_pay_recieve_money.png" width="220" alt="Scan & Pay via PhonePe / UPI" style="border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.1);" />

*Supports PhonePe, Google Pay, Navi, Paytm, Cred & BHIM*

<br/>

### Option 2: 🌍 International / Cards (Buy Me a Coffee)
For international supporters, debit/credit cards, Apple Pay, and PayPal:

[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-ffdd00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/tajinder102005)

**Direct Link:** [buymeacoffee.com/tajinder102005](https://buymeacoffee.com/tajinder102005)

</div>

---

## 📄 License
MIT License. Feel free to use, modify, and distribute!
