# AtomQuest 2026: Enterprise Goal Management Portal
> A high-performance, audit-ready compliance engine for organizational goal tracking.

## 🔗 Deployment Links
- **Live Frontend:** [https://atomberg-portal-ten.vercel.app/](https://atomberg-portal-ten.vercel.app/)
- **Live API:** [https://atomberg-portal.onrender.com/docs](https://atomberg-portal.onrender.com/docs)

## 🏗️ Architecture
- **Frontend:** React 19 + Tailwind CSS (Vite)
- **Backend:** FastAPI (Python 3.14) with Asynchronous SQLAlchemy
- **Database:** PostgreSQL (Neon Serverless)
- **Deployment:** Vercel (UI) & Render (API)

## 🛡️ Key Technical Features
- **JSONB Audit Trail:** Every manager review and admin override is logged with immutable snapshots.
- **Cycle Enforcement:** Logic-based gating for May/July/Oct windows to prevent off-cycle data entry.
- **Relational Integrity:** 1:M cascading goal structures with departmental KPI synchronization.
- **Asynchronous Execution:** Optimized DB transactions to handle high-concurrency performance updates.

## 👤 Test Credentials
| Role | Email | Password |
| :--- | :--- | :--- |
| **Admin** | admin1@atomberg.com | [See official submission PDF] |
| **Manager** | manager1@atomberg.com | [See official submission PDF] |
| **Employee** | employee1@atomberg.com | [See official submission PDF] |
