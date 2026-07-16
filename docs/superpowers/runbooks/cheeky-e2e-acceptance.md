# Cheeky Social — E2E acceptance checklist

Prerequisites before running:

- [ ] Docker Desktop installed and running
- [ ] `.env` copied from `.env.cheeky.example` (use `STORAGE_PROVIDER=local` for laptop)
- [ ] Firebase Console → Authentication → Google sign-in enabled for `cheeky-b0098`
- [ ] `localhost` added to Firebase authorized domains
- [ ] Firebase Admin service account fields set (`FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`)
- [ ] `pnpm install` + `pnpm prisma-db-push` against local Postgres

## Local E2E

1. [ ] `pnpm dev:docker` (Postgres, Redis, Temporal)
2. [ ] `pnpm prisma-db-push`
3. [ ] `pnpm dev` or `pnpm dev-backend`
4. [ ] Open `http://localhost:4200/auth/login` — Cheeky Social branding visible
5. [ ] Continue with Google → workspace created (`providerName=FIREBASE`)
6. [ ] Connect at least one social (test app)
7. [ ] Upload media; schedule a post; Temporal worker processes it

## Staging GCP E2E

1. [ ] Deploy per `deploy/gcp/README.md`
2. [ ] Sign in with Google on staging domain
3. [ ] Confirm media lands in GCS
4. [ ] Confirm scheduled post publishes
5. [ ] Staff `isSuperAdmin` can impersonate a seller workspace (see `cheeky-staff-superadmin.md`)

## Status

E2E execution on the development machine was deferred until Docker + Firebase Admin credentials are available.
