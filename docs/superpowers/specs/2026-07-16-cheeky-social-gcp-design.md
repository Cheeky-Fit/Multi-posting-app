# Cheeky Social Media Portal — GCP + Firebase Design

**Date:** 2026-07-16  
**Status:** Approved (2026-07-16). App foundation on `feat/cheeky-social-portal`. E2E pending — see `docs/superpowers/runbooks/cheeky-e2e-acceptance.md`.  
**Codebase:** Postiz fork (`Cheeky-Fit/Multi-posting-app`) rebranded as CheekySocialMediaPortal  
**Firebase:** project `cheeky-b0098`, web app CheekySocialMediaPortal (`1:1024449009049:web:4b0a356e7d58a9a8c82f08`)

---

## 1. Product goal

Self-hosted **social media management platform** for Cheeky sellers and brands:

- Link social accounts in one portal
- Schedule and publish promotional content
- Each seller/brand has an isolated workspace
- Cheeky staff can operate across workspaces

This is **not** a greenfield rewrite. We rebrand and extend the existing Postiz monorepo (NestJS + Next.js/React) and host it on Google infrastructure.

---

## 2. Decisions (locked)

| Topic | Decision |
|-------|----------|
| Product shell | Approach A — rebrand/ship this app as the Cheeky web app |
| Tenancy | Each seller/brand = own workspace/org; staff cross-workspace |
| Auth | Firebase Auth with Google sign-in/sign-up |
| Frontend delivery | Firebase Hosting (CDN) + Cloud Run for Next.js SSR |
| Data & compute | All on GCP (Cloud SQL, Memorystore, GCS, Cloud Run, GKE) |
| Job runner | Temporal self-hosted on GKE (not Temporal Cloud) |
| Storage | GCS (new provider; no Cloudflare R2 in production) |
| Billing | Stripe out of scope for v1 |
| Wrapper rewrite | Out of scope — no separate shell or rebuilt UI |

---

## 3. Auth & workspaces

### 3.1 Login

1. User opens CheekySocialMediaPortal.
2. Frontend uses Firebase JS SDK → **Sign in with Google**.
3. Frontend sends Firebase **ID token** to NestJS API.
4. Backend verifies token with **Firebase Admin SDK**.
5. Backend creates or links a Postiz user and issues the existing app session (JWT cookie/session as today).

Email/password auth is disabled or de-emphasized for v1. Any Google account can sign up (sellers/brands); invite-only or domain allowlists can be added later.

### 3.2 Workspaces

- First successful Google login creates (or associates) an **organization/workspace** for that seller/brand.
- Users invited into a workspace only see that workspace’s socials, calendar, media, and posts.
- **Cheeky staff** get an elevated role (super-admin / support) to switch into or manage any workspace.

### 3.3 Firebase project binding

| Field | Value |
|-------|--------|
| Project ID | `cheeky-b0098` |
| Auth domain | `cheeky-b0098.firebaseapp.com` |
| Web app | CheekySocialMediaPortal |
| App ID | `1:1024449009049:web:4b0a356e7d58a9a8c82f08` |

Client Firebase config and Admin credentials are supplied via environment variables / Secret Manager — never hardcoded in source.

Prerequisite in Firebase Console: enable **Google** sign-in provider for this project.

---

## 4. GCP architecture (hybrid)

```
Seller / brand browser
        │
        ▼
Firebase Hosting (UI assets + CDN) + Firebase Auth (Google)
        │
        ▼
Cloud Run
  ├── Next.js frontend (SSR)
  └── NestJS API (Temporal client)
        │
        ├── Cloud SQL (PostgreSQL)     — app data
        ├── Memorystore (Redis)        — cache / rate limits
        ├── Cloud Storage (GCS)        — media / avatars
        └── GKE
              ├── Temporal server (+ Temporal’s Postgres)
              └── Orchestrator workers (schedule & publish)
```

### 4.1 Service map

| Concern | Google / in-project service |
|---------|-----------------------------|
| Identity | Firebase Auth (Google) |
| Web CDN / Hosting | Firebase Hosting → Cloud Run |
| API + SSR | Cloud Run |
| App database | Cloud SQL for PostgreSQL |
| Cache | Memorystore for Redis |
| Media | Cloud Storage (GCS) |
| Secrets | Secret Manager |
| Schedulers / workers | GKE (Temporal + orchestrator) |
| Public HTTPS | Custom domain (e.g. `social.cheeky…`) via Firebase Hosting / Load Balancer |

### 4.2 Constraints

- No Cloudflare R2, no external managed Postgres/Redis.
- Orchestrator / Temporal workers stay **always-on** (not scale-to-zero).
- OAuth callback URLs for social networks must use the stable public HTTPS domain.

---

## 5. Application changes

### 5.1 Rebrand

- Product name, logo, copy, and public URLs presented as **Cheeky Social** / CheekySocialMediaPortal.
- Sellers should not see “Postiz” in the primary UI.

### 5.2 Firebase Auth bridge

- Frontend: Firebase JS SDK Google sign-in.
- Backend: Firebase Admin token verification → user provisioning → existing session JWT.
- Configuration via env (web config + Admin service account).

### 5.3 GCS storage provider

- Add `STORAGE_PROVIDER=gcs` (or equivalent) alongside existing `local` / `cloudflare`.
- Production Cheeky deploy uses GCS only.

### 5.4 Multi-workspace staff access

- Ensure org-per-seller/brand on signup.
- Implement or extend staff role for cross-workspace access (switch/manage).

### 5.5 Social integrations

- Enable OAuth apps only for networks Cheeky needs in v1 (configured via env).
- Exact network list is an implementation/config step, not a blocker for infra design.

---

## 6. Out of scope (v1)

- Stripe / paid plans
- Chrome extension packaging
- Temporal Cloud
- Non-Google identity providers
- Separate Node/React shell wrapping Postiz in an iframe
- Full UI rewrite against Postiz as API-only

---

## 7. Implementation phases (high level)

1. **Identity** — Firebase Google sign-in + Admin verification + session bridge  
2. **Tenancy** — workspace-per-seller, invites, staff cross-workspace  
3. **Storage** — GCS provider  
4. **Rebrand** — CheekySocialMediaPortal naming/UI  
5. **GCP deploy** — Cloud SQL, Memorystore, GCS, Cloud Run, GKE Temporal, Firebase Hosting, secrets, domain  
6. **Social OAuth** — connect priority networks and smoke-test publish flow  

Detailed task breakdown comes after this spec is approved (implementation plan).

---

## 8. Risks & mitigations

| Risk | Mitigation |
|------|------------|
| Postiz uses `prisma db push` (no migration history) | Backups on Cloud SQL; careful schema changes; consider introducing migrations before heavy prod use |
| Firebase Auth ≠ native Postiz auth | Explicit bridge layer; keep one session model after login |
| Temporal ops on GKE | Dedicated namespace, documented runbooks, health checks |
| Next.js SSR on Firebase Hosting alone is insufficient | Hosting fronts Cloud Run for SSR/API |
| AGPL-3.0 on Postiz fork | Legal/compliance review for Cheeky’s distribution obligations |

---

## 9. Success criteria

- Seller/brand can Google sign-in and land in their own workspace  
- They can connect at least one social account and schedule a post  
- Media uploads land in GCS  
- Scheduled posts execute via Temporal on GKE  
- Cheeky staff can access/manage other workspaces  
- No required dependency on Cloudflare or non-GCP data stores for production
```
