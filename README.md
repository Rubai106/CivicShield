# CivicShield

Secure incident reporting system for communities.

## 🚀 Completed Features (Sprint 1)

### ✅ Core Features Implemented
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

## 📋 Complete Feature List (All Features)

### 🏛️ Reporting & Core Features
1. **Incident report creation** with title and detailed description
2. **Category selection** from system-defined categories
3. **Report lifecycle and timeline**:
   - Anonymous-to-authority reporting option (authority sees "Anonymous Reporter" label)
   - Evidence upload (image/PDF/video) with evidence list/preview
   - Location tagging via manual address + map pin
   - Incident date & time selection
4. **Draft saving** and later submission
5. **Tracking ID receipt** + Status workflow tracking (Submitted → Under Review → Investigating → Resolved → Closed)

### 📊 Dashboards & Interfaces
6. **Reporter dashboard** (listing submitted reports with filters, Report detail page showing full report, evidence, status, and assigned department)
7. **Authority Dashboard** (example: police, law, cyber, fire department etc)
8. **Comment thread** between authority and reporter (realtime, in-app)
9. **Private chatting** (one to one)
10. **Consultation & Payment Module**

### 🔧 Advanced Features
11. **Inter-Department Transfer** (authority)
12. **Priority scoring** (Low/Medium/High/Critical) based on rule-based logic
13. **Admin configuration Management**
    -Reopen request** for closed reports (request + approve/deny decision)
    -Automatic assignment** to department using admin-defined mapping rules

### 📈 Analytics & Monitoring
14. **Monthly trend analytics** chart (reports per month, filterable)
15. **Compliance & Risk Dashboard** (Admin)
16. **Service Level Agreement Tracking** (Each incident category has a defined expected resolution time. Admin defines SLA rules)

### 🔒 Security & Verification
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


---

CivicShield - Secure Community Incident Reporting 
   - Anonymous-to-authority reporting option (authority sees "Anonymous Reporter" label)
   - Evidence upload (image/PDF/video) with evidence list/preview
   - Location tagging via manual address + map pin
   - Incident date & time selection
4. **Draft saving and later submission**
5. **Tracking ID receipt** + status workflow tracking (Submitted → Under Review → Investigating → Resolved → Closed)
6. **Reporter dashboard** (listing submitted reports with filters, Report detail page showing full report, evidence, status, and assigned department)

### Authority Features
7. **Authority Dashboard** (example: police, law, cyber, fire department etc.)
8. **Comment thread** between authority and reporter (realtime, in-app)

### Premium Features (Future Sprints)
9. **Private chatting** (one to one)
10. **Consultation & Payment Module**
11. **Inter-Department Transfer** (authority)
12. **Priority scoring** (Low/Medium/High/Critical) based on rule-based logic
13. **Admin configuration Management**

### Advanced Features (Future Sprints)
14. **Reopen request System** (User request reopen within X days, limited attempts, timeline, authority review)
15. **Service Level Agreement Tracking** (Each incident category has defined expected resolution time. Admin defines SLA rules)
16. **Monthly trend analytics chart** (reports per month, filterable)
17. **Compliance & Risk Dashboard** (Admin)
18. **Authority onboarding and verification**
19. **Duplicate report detection system**
20. **Realtime Notification center** for status changes, new comments, and reopen decisions

### Technical Stack
- **Frontend**: React + Vite + TailwindCSS
- **Backend**: Node.js + Express + PostgreSQL
- **Authentication**: JWT-based auth system
- **File Upload**: Multipart form data with evidence support

## Setup
1. Clone repository
2. Install dependencies in `client/` and `server/`
3. Configure database
4. Run development servers

## Branch Structure
- `main`: Production-ready code
- `dev-*`: Individual developer branches

## Development Workflow
1. Create feature branch from `main`
2. Implement feature
3. Test thoroughly
4. Create pull request to `main`
5. Code review and merge
- **Private Chat** — One-to-one real-time messaging via Socket.io
- **Reopen Requests** — Reporters can request case reopening with reason; authority approves/denies
- **Notifications** — Real-time in-app notifications for status changes, comments, reopen decisions
- **Admin Dashboard** — Category/rule management, analytics charts, SLA configuration
- **Reporter Dashboard** — Report list with filters, stats, and status tracking
- **Authority Dashboard** — Department-filtered reports, status updates
- **Consultation & Payment** — Book consultations with authorities (Stripe integration)
- **Inter-Department Transfer** — Authorities can reassign reports to other departments
- **SLA Tracking** — Each category has a configurable resolution deadline
- **Duplicate Detection** — Detects similar reports submitted within 24 hours
- **Authority Onboarding** — Authorities submit credentials for admin verification
- **Monthly Trend Analytics** — Admin analytics charts (area + bar charts)
- **Compliance/Risk Dashboard** — SLA monitoring for admin

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, Tailwind CSS, Socket.io-client, Recharts |
| Backend | Node.js, Express.js, Socket.io |
| Database | PostgreSQL |
| File Storage | Cloudinary |
| Payments | Stripe |
| Auth | JWT + bcrypt |

## Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Cloudinary account (for evidence uploads)


