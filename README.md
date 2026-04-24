# 🌾 VeriFarm — USSD Server

> The farmer-facing access layer for VeriFarm enabling 
> smallholder farmers in East Africa to apply for loans, 
> check status, and repay via any basic phone.
> No smartphone. No internet. Just dial.

![Node](https://img.shields.io/badge/Node.js-Express-green)
![Database](https://img.shields.io/badge/PostgreSQL-18-blue)
![Gateway](https://img.shields.io/badge/Africa's%20Talking-USSD-orange)
![Deployed](https://img.shields.io/badge/Render-Live-brightgreen)
![Tests](https://img.shields.io/badge/Anchor%20Tests-36%20Passing-brightgreen)

---

## 📱 How Farmers Access VeriFarm

```
Farmer dials *384*26730#
        ↓
Africa's Talking receives session
        ↓
Routes to VeriFarm USSD server on Render
        ↓
Node/Express handles menu logic
        ↓
PostgreSQL stores session + farmer responses
        ↓
Oracle webhook submits AI scores on-chain
        ↓
SSE broadcasts activity to lender dashboard
        ↓
SMS confirmation sent to farmer
```

---

## 📋 Menu Flows

Available in **English and Swahili**:

```
Welcome to VeriFarm / Karibu VeriFarm
*384*26730#

1. Apply for Loan      / Omba Mkopo
2. Check Status        / Angalia Hali
3. Why This Amount?    / Kwa Nini Kiasi Hiki?
4. Improve My Score    / Boresha Alama Zangu
5. Repay Loan          / Lipa Mkopo
```

---

## 🔄 Loan Application Flow

```
Step 1: Language selection (English / Swahili)
Step 2: Farm size in acres
Step 3: Livestock count
Step 4: Active loan check
Step 5: Confirmation + SMS receipt
```

---

## 💸 M-Pesa Integration

When a farmer selects **Repay Loan:**
- M-Pesa STK push triggers automatically
- Payment confirmation recorded on server
- Oracle webhook updates repayment on-chain
- SMS confirmation sent to farmer

---

## 📡 Live Dashboard Feed

Every farmer USSD interaction broadcasts to the 
lender dashboard via **Server-Sent Events (SSE)**:

```
Farmer dials in Tanzania
        ↓
USSD server processes session
        ↓
SSE broadcasts to lender dashboard
        ↓
Lender sees activity in real time
```

---

## 🤖 Oracle Webhook

```
POST /oracle/score
```

Receives AI risk scores from the scoring engine and 
submits them directly on-chain to the VeriFarm 
Anchor program.

---

## 🛠️ Tech Stack

- **Node.js + Express** — server framework
- **Africa's Talking** — USSD gateway
- **PostgreSQL 18** — session and farmer data
- **Render** — deployment
- **Keep-alive ping** — every 10 minutes, prevents 
  Render free tier from sleeping

---

## 🚀 Running Locally

```bash
git clone https://github.com/yvonne-byte-crypto/verifarm-ussd.git
cd verifarm-ussd
npm install
cp .env.example .env
# Add your Africa's Talking credentials and database URL
npm run dev
```

---

## 🔐 Privacy & Compliance

Farmer phone numbers are stored in hashed form. 
Session data is encrypted in transit. Farmer consent 
is logged during the first USSD interaction in 
compliance with Kenya's Data Protection Act 2019 
and Tanzania's PDPA framework.

---

## 🌱 Roadmap

- [x] 5 complete menu flows — English + Swahili
- [x] M-Pesa STK push on repayment
- [x] Oracle webhook — on-chain score submission
- [x] SSE live feed to lender dashboard
- [x] Keep-alive ping
- [x] Session state tracking
- [ ] Africa's Talking production number
- [ ] Real phone testing in Tanzania
- [ ] WhatsApp integration for smartphone users

---

## 🔗 Related Repos

- **Anchor Program:** [Verifarm-backend](https://github.com/yvonne-byte-crypto/Verifarm-backend)
- **Lender Dashboard:** [verifarm-frontend](https://github.com/yvonne-byte-crypto/verifarm-frontend)
- **Live Dashboard:** [verifarm-frontend.vercel.app](https://verifarm-frontend.vercel.app)

---

*Built for the Colosseum Hackathon 2026 — for the 
farmers back home in Tanzania who deserve access to 
the financial system they've always been excluded 
from.* 🌍🌾
