# CivicShield

Secure incident reporting system for communities.

##  Completed Features (Sprint 1)

###  Core Features Implemented
1. **Incident report creation** with title and detailed description
2. **Category selection** from system-defined categories  
3. **Report lifecycle and timeline**:
   - Anonymous-to-authority reporting option (authority sees "Anonymous Reporter" label)
   - Evidence upload (image/PDF/video) with evidence list/preview
   - Location tagging via manual address + map pin
   - Incident date & time selection
4. **Draft saving** and later submission
5. **Tracking ID receipt** + Status workflow tracking (Submitted → Under Review → Investigating → Resolved → Closed)
6. **Reporter dashboard** (listing submitted reports with filters, Report detail page showing full report, evidence, status, and assigned department)

---

##  Complete Feature List (All Features)

1. **Incident report creation** with title and detailed description
2. **Category selection** from system-defined categories
3. **Report lifecycle and timeline**:
   - Anonymous-to-authority reporting option (authority sees "Anonymous Reporter" label)
   - Evidence upload (image/PDF/video) with evidence list/preview
   - Location tagging via manual address + map pin
   - Incident date & time selection
4. **Draft saving** and later submission
5. **Tracking ID receipt** + Status workflow tracking (Submitted → Under Review → Investigating → Resolved → Closed)

6. **Reporter dashboard** (listing submitted reports with filters, Report detail page showing full report, evidence, status, and assigned department)
7. **Authority Dashboard** (example: police, law, cyber, fire department etc)
8. **Comment thread** between authority and reporter (realtime, in-app)
9. **Private chatting** (one to one)
10. **Consultation & Payment Module**

###  Advanced Features
11. **Inter-Department Transfer** (authority)
12. **Priority scoring** (Low/Medium/High/Critical) based on rule-based logic
13. **Admin configuration Management**
    -Reopen request** for closed reports (request + approve/deny decision)
    -Automatic assignment** to department using admin-defined mapping rules
14. **Monthly trend analytics** chart (reports per month, filterable)
15. **Compliance & Risk Dashboard** (Admin)
16. **Service Level Agreement Tracking** (Each incident category has a defined expected resolution time. Admin defines SLA rules)

17. **Digital Evidence Integrity Verification**
18. **Authority onboarding and verification**
19. **Reopen request System [User]** (This includes request reopen within X days, limited attempts, timeline, authority review)
20. **Duplicate report detection system**
21. **Realtime Notification center** for status changes, new comments, and reopen decisions

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, Tailwind CSS, Socket.io-client, Recharts |
| Backend | Node.js, Express.js, Socket.io |
| Database | PostgreSQL |
| File Storage | Cloudinary |
| Payments | Stripe |
| Auth | JWT + bcrypt |



### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Cloudinary account (for evidence uploads)
- Stripe account (for consultation payments)

---

## ⚙️ Setup

### 1. Clone & install dependencies
```bash
git clone <repo-url>
cd CivicShield

# Install server dependencies
cd server && npm install

# Install client dependencies
cd ../client && npm install
```

### 2. Configure environment variables
```bash
cp server/.env.example server/.env
```
Edit `server/.env` and fill in your values (see each section below).

### 3. Database
Create a PostgreSQL database and set `DATABASE_URL` in `.env`, then run migrations:
```bash
cd server
node config/migrate_full.js
```

### 4. Cloudinary
Sign up at [cloudinary.com](https://cloudinary.com), copy your **Cloud name**, **API Key**, and **API Secret** into `.env`.

### 5. Stripe (Consultation Payments)

**a) Get your API keys**
1. Sign up / log in at [dashboard.stripe.com](https://dashboard.stripe.com)
2. Go to **Developers → API keys**
3. Copy the **Secret key** (`sk_test_...`) → paste as `STRIPE_SECRET_KEY` in `.env`

**b) Set up the webhook (local dev)**
1. Install Stripe CLI: `winget install Stripe.StripeCLI` (Windows) or follow [stripe.com/docs/stripe-cli](https://stripe.com/docs/stripe-cli)
2. Login: `stripe login`
3. Start forwarding: `stripe listen --forward-to localhost:5000/api/webhooks/stripe`
4. Copy the printed `whsec_...` secret → paste as `STRIPE_WEBHOOK_SECRET` in `.env`
5. Keep this terminal running while testing

> **For production:** Create a webhook endpoint in the Stripe dashboard pointing to `https://yourdomain.com/api/webhooks/stripe`, listening for `checkout.session.completed`. Use the signing secret shown there as `STRIPE_WEBHOOK_SECRET`.

### 6. Run the app
```bash
# Terminal 1 — backend
cd server && npm run dev

# Terminal 2 — frontend
cd client && npm run dev
```

App runs at **http://localhost:5173**

---


