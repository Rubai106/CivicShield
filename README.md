# CivicShield

## Features

- **Incident Reporting** — Create reports with title, description, category, location, and incident date
- **Anonymous Reporting** — Submit reports without revealing identity to authorities
- **Evidence Upload** — Attach images, PDFs, and videos with SHA-256 integrity verification
- **Smart Auto-Routing** — Reports auto-assigned to departments based on admin-defined mapping rules
- **Priority Scoring** — Rule-based priority (Low/Medium/High/Critical) using keywords and category rules
- **Status Lifecycle** — Draft → Submitted → Under Review → Investigating → Resolved → Closed
- **Draft Saving** — Save and resume reports before submission
- **Tracking ID** — Unique ID generated on submission for tracking
- **Comment Thread** — Real-time in-report communication between reporter and authority
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

