# NEXORA — Complete Core Release (v2.0.0)

## Files
- `index.html` — responsive application shell and visual design
- `app.js` — authentication, dashboard, business modules, CRUD, workspaces, CSV import/export, JSON backup
- `firebase.js` — your Firebase project configuration
- `firestore.rules` — per-account Firestore access rules

## Setup / deploy
1. Replace the repository's `index.html`, `app.js`, and `firebase.js` with these files.
2. In Firebase Console → Authentication → Sign-in method, enable Email/Password.
3. In Firebase Console → Firestore Database → Rules, paste `firestore.rules` and publish.
4. In Firebase Console → Authentication → Settings → Authorized domains, ensure your Vercel domain is listed.
5. Commit/push to GitHub; Vercel redeploys automatically.

## Important honest scope
This is a functional core release, not a claim that every enterprise feature is implemented. Implemented modules include account login/register/reset, per-account records, dashboard cashflow view, transactions, customers/leads, suppliers, inventory, projects/tasks, invoices/quotes, bills/purchases, appointments, branches, workspaces, settings, CSV export/import, and JSON backup.

Workspace separation is currently logical/client-side within a single user's own data. It does not implement shared team members, server-enforced workspace ACLs, subscription payments, scheduled server jobs, email/SMS sending, AI, third-party integrations, customer portals, or a full PDF invoice/document designer. Those require additional server-side services/provider configuration and must not be marketed as already live.

## Security note
Never add Firebase service-account credentials to frontend files. The client Firebase config is public by design; the Firestore rules and Authentication provide access control. Review rules before production and test with a separate account.
