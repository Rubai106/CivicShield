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
14. **Reopen request** for closed reports (request + approve/deny decision)
15. **Automatic assignment** to department using admin-defined mapping rules

### 📈 Analytics & Monitoring
16. **Monthly trend analytics** chart (reports per month, filterable)
17. **Compliance & Risk Dashboard** (Admin)
18. **Service Level Agreement Tracking** (Each incident category has a defined expected resolution time. Admin defines SLA rules)

### 🔒 Security & Verification
19. **Digital Evidence Integrity Verification**
20. **Authority onboarding and verification**
21. **Reopen request System [User]** (This includes request reopen within X days, limited attempts, timeline, authority review)
22. **Duplicate report detection system**
23. **Realtime Notification center** for status changes, new comments, and reopen decisions

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

## 📁 Project Structure

```
civicshield/
├── client/          # Sprint 1 Frontend (Features 1-6)
├── server/          # Sprint 1 Backend (Features 1-6)
├── backend/         # Full Backend (All Features)
├── frontend/        # Full Frontend (All Features)
└── README.md        # This file
```

---

## 🚀 Getting Started

### Sprint 1 Setup (Features 1-6)
```bash
# Backend (server/)
cd server
npm install
npm run dev

# Frontend (client/)
cd client
npm install
npm run dev
```

### Full Project Setup (All Features)
```bash
# Backend (backend/)
cd backend
npm install
npm run dev

# Frontend (frontend/)
cd frontend
npm install
npm run dev
```

---

## 🏷️ Branch Strategy

- **main**: Production-ready code
- **dev-rubai**: Development branch with feature-specific commits

### Commit Message Format
```
feature: [feature-name] - description
```

Example:
```
feature: incident-report-creation - add title and description fields
feature: category-selection - implement dropdown with system categories
feature: anonymous-reporting - add toggle for anonymous submission
```

---

## 📧 Contact

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
- Stripe account (for consultation payments, optional)

### 1. Clone & Install

```bash
# Backend
cd backend
npm install

# Frontend
cd frontend
npm install
```

### 2. Configure Environment

```bash
# Backend: copy and edit
cp .env.example .env
# Fill in DATABASE_URL, JWT_SECRET, CLOUDINARY_*, STRIPE_*

# Frontend: create
echo "VITE_API_URL=/api" > frontend/.env
```

### 3. Setup Database

```bash
# Create PostgreSQL database
createdb civicshield

# Run migration (creates tables + seeds data)
cd backend
npm run migrate
```

### 4. Run

```bash
# Backend (port 5000)
cd backend && npm run dev

# Frontend (port 5173) — in new terminal
cd frontend && npm run dev
```

### 5. Default Admin Login

```
Email:    admin@civicshield.gov
Password: admin123
```


## Project Structure

```
civicshield/
├── backend/
│   ├── config/
│   │   ├── db.js           # PostgreSQL pool
│   │   ├── cloudinary.js   # File upload config
│   │   ├── schema.sql      # Database schema + seed data
│   │   └── migrate.js      # Migration runner
│   ├── middleware/
│   │   ├── auth.js         # JWT authenticate + RBAC authorize
│   │   ├── upload.js       # Multer config
│   │   └── rateLimiter.js  # Rate limiting
│   ├── routes/
│   │   ├── auth.routes.js
│   │   ├── reports.routes.js
│   │   ├── categories.routes.js
│   │   ├── departments.routes.js
│   │   ├── comments.routes.js
│   │   ├── notifications.routes.js
│   │   ├── chat.routes.js
│   │   ├── consultations.routes.js
│   │   └── admin.routes.js
│   ├── utils/
│   │   ├── helpers.js      # Business logic utilities
│   │   └── notifications.js
│   ├── server.js           # Express + Socket.io server
│   └── package.json
│
└── frontend/
    ├── src/
    │   ├── pages/
    │   │   ├── LandingPage.jsx
    │   │   ├── Login.jsx
    │   │   ├── Register.jsx
    │   │   ├── ReporterDashboard.jsx
    │   │   ├── CreateReport.jsx
    │   │   ├── ReportDetail.jsx
    │   │   ├── AuthorityDashboard.jsx
    │   │   ├── AdminDashboard.jsx
    │   │   ├── ChatPage.jsx
    │   │   ├── ConsultationsPage.jsx
    │   │   ├── ProfilePage.jsx
    │   │   └── NotFoundPage.jsx
    │   ├── components/
    │   │   ├── Navbar.jsx
    │   │   ├── NotificationCenter.jsx
    │   │   └── ui.jsx
    │   ├── context/
    │   │   ├── AuthContext.jsx
    │   │   └── SocketContext.jsx
    │   ├── services/
    │   │   └── api.js
    │   ├── App.jsx
    │   ├── main.jsx
    │   └── index.css
    ├── tailwind.config.js
    ├── vite.config.js
    └── package.json
```

## API Endpoints

### Auth
| Method | Path | Description |
|--------|------|-------------|
| POST | /api/auth/register | Register new user |
| POST | /api/auth/login | Login |
| GET | /api/auth/me | Get current user |
| PUT | /api/auth/profile | Update profile |
| PUT | /api/auth/change-password | Change password |
| POST | /api/auth/authority/onboard | Submit authority credentials |

### Reports
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/reports | List reports (role-filtered) |
| POST | /api/reports | Create report (with evidence) |
| GET | /api/reports/:id | Get report + timeline + evidence |
| PUT | /api/reports/:id | Update draft |
| POST | /api/reports/:id/submit | Submit draft |
| PUT | /api/reports/:id/status | Update status (authority/admin) |
| PUT | /api/reports/:id/assign | Reassign department/authority |
| POST | /api/reports/:id/evidence | Upload more evidence |
| POST | /api/reports/:id/reopen | Request reopen (reporter) |
| PUT | /api/reports/:id/reopen/:requestId | Decide reopen (authority) |

### Admin
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/admin/stats | Dashboard analytics |
| GET/POST/PUT/DELETE | /api/admin/routing-rules | Manage routing rules |
| GET/POST/DELETE | /api/admin/sla-rules | Manage SLA rules |
| GET | /api/admin/users | List users |
| PUT | /api/admin/users/:id/verify-authority | Verify authority |
| GET | /api/admin/sla-monitoring | SLA compliance report |

