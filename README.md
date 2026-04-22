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


