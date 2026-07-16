# Cheeky Social Media Portal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn this Postiz fork into CheekySocialMediaPortal — Firebase Google sign-in, per-seller workspaces, GCS media, Cheeky branding — deployable on GCP (Cloud Run + Cloud SQL + Memorystore + GCS + GKE Temporal) with Firebase Hosting/Auth (`cheeky-b0098`).

**Architecture:** Keep Postiz’s NestJS API + Next.js UI + Temporal orchestrator. Add a `FIREBASE` auth provider that verifies Google ID tokens via Firebase Admin, then reuses `loginOrRegisterProvider` → `createOrgAndUser` (one workspace per seller). Add a `gcs` `IUploadProvider`. Front Firebase Hosting/Auth; run app services on Cloud Run; run Temporal + workers on GKE.

**Tech Stack:** NestJS 11, Next.js 16, Prisma/Postgres, Redis, Temporal, Firebase Auth + Admin SDK, `@google-cloud/storage`, pnpm, GCP (Cloud Run, Cloud SQL, Memorystore, GCS, GKE, Secret Manager), Firebase project `cheeky-b0098`.

**Spec:** `docs/superpowers/specs/2026-07-16-cheeky-social-gcp-design.md`

## Global Constraints

- Product name in seller-facing UI: **Cheeky Social** / CheekySocialMediaPortal (not Postiz).
- Auth v1: Firebase Google only (email/password de-emphasized when Cheeky mode on).
- Storage production: `STORAGE_PROVIDER=gcs` only (no Cloudflare R2).
- Data plane: GCP only (Cloud SQL, Memorystore, GCS, Cloud Run, GKE).
- Temporal: self-hosted on GKE (not Temporal Cloud).
- Stripe / Chrome extension / UI rewrite: out of scope.
- Package manager: **pnpm only**.
- Backend layers: Controller → Service → Repository (no shortcuts).
- Do not commit secrets; Firebase web config and Admin JSON via env / Secret Manager.
- Node: `>=22.12.0 <23` per root `package.json`.

## File structure (create / modify)

| Path | Responsibility |
|------|----------------|
| `libraries/nestjs-libraries/src/database/prisma/schema.prisma` | Add `FIREBASE` to `Provider` enum |
| `apps/backend/src/services/auth/providers/firebase.provider.ts` | Verify Firebase ID token → `{ id, email }` |
| `apps/backend/src/api/api.module.ts` | Register `FirebaseProvider` |
| `apps/frontend/src/lib/firebase.client.ts` | Initialize Firebase app from public env |
| `apps/frontend/src/components/auth/providers/firebase-google.provider.tsx` | Google sign-in via Firebase → API login/register |
| `apps/frontend/src/components/auth/login.tsx` | Prefer Firebase Google; hide LOCAL when Cheeky |
| `apps/frontend/src/components/auth/register.tsx` | Same for signup + company/workspace name |
| `libraries/react-shared-libraries/src/helpers/variable.context.tsx` (or backend variables endpoint) | Expose `cheekyMode` / Firebase public flags |
| `libraries/nestjs-libraries/src/upload/gcs.storage.ts` | GCS `IUploadProvider` |
| `libraries/nestjs-libraries/src/upload/upload.factory.ts` | `case 'gcs'` |
| `libraries/helpers/src/configuration/configuration.checker.ts` | Validate GCS + Firebase Admin env when selected |
| `apps/frontend/src/app/(app)/auth/layout.tsx` (+ login/register metadata) | Cheeky branding copy |
| `deploy/gcp/` | Cloud Run, GKE Temporal, env templates (infra) |
| `firebase.json` / `.firebaserc` | Hosting rewrite to Cloud Run |

---

### Task 1: Add `FIREBASE` to Prisma Provider enum

**Files:**
- Modify: `libraries/nestjs-libraries/src/database/prisma/schema.prisma` (`enum Provider`)
- Test: manual `pnpm prisma-generate` success

**Interfaces:**
- Consumes: existing `Provider` enum usage in auth
- Produces: `Provider.FIREBASE` available to TypeScript after generate

- [ ] **Step 1: Update enum**

In `schema.prisma`, change:

```prisma
enum Provider {
  LOCAL
  GITHUB
  GOOGLE
  FARCASTER
  WALLET
  GENERIC
  FIREBASE
}
```

- [ ] **Step 2: Generate client**

Run: `pnpm prisma-generate`  
Expected: exits 0; no Prisma errors.

- [ ] **Step 3: Push schema to local DB** (dev only)

Run: `pnpm prisma-db-push`  
Expected: enum value `FIREBASE` applied (backup Cloud SQL before doing this in prod).

- [ ] **Step 4: Commit**

```bash
git add libraries/nestjs-libraries/src/database/prisma/schema.prisma
git commit -m "feat: add FIREBASE provider enum for Cheeky Auth"
```

---

### Task 2: Backend Firebase Auth provider

**Files:**
- Create: `apps/backend/src/services/auth/providers/firebase.provider.ts`
- Modify: `apps/backend/src/api/api.module.ts` (register provider)
- Create: `apps/backend/src/services/auth/providers/firebase.provider.spec.ts`
- Root: add `firebase-admin` with `pnpm add firebase-admin -w`

**Interfaces:**
- Consumes: `AuthProviderAbstract` (`generateLink`, `getToken`, `getUser`)
- Produces: `@AuthProvider({ provider: 'FIREBASE' })` class; `getUser(idToken)` → `{ id: firebaseUid, email }`
- Reuses: `AuthService.loginOrRegisterProvider` / `routeAuth` unchanged

- [ ] **Step 1: Add dependency**

Run: `pnpm add firebase-admin -w`  
Expected: `firebase-admin` in root `package.json`.

- [ ] **Step 2: Write failing unit test**

Create `apps/backend/src/services/auth/providers/firebase.provider.spec.ts`:

```typescript
jest.mock('firebase-admin', () => {
  const verifyIdToken = jest.fn();
  return {
    apps: [],
    initializeApp: jest.fn(),
    credential: { cert: jest.fn(() => ({})) },
    auth: () => ({ verifyIdToken }),
    __mock: { verifyIdToken },
  };
});

import * as admin from 'firebase-admin';
import { FirebaseProvider } from './firebase.provider';

describe('FirebaseProvider', () => {
  const provider = new FirebaseProvider();

  it('returns uid and email from a valid ID token', async () => {
    (admin as any).__mock.verifyIdToken.mockResolvedValue({
      uid: 'firebase-uid-1',
      email: 'seller@cheeky.test',
    });

    const user = await provider.getUser('fake-id-token');
    expect(user).toEqual({
      id: 'firebase-uid-1',
      email: 'seller@cheeky.test',
    });
  });

  it('returns false when token has no email', async () => {
    (admin as any).__mock.verifyIdToken.mockResolvedValue({
      uid: 'firebase-uid-2',
    });
    await expect(provider.getUser('tok')).resolves.toBe(false);
  });
});
```

- [ ] **Step 3: Run test — expect FAIL**

Run: `pnpm exec jest apps/backend/src/services/auth/providers/firebase.provider.spec.ts -v`  
Expected: FAIL (module not found / class missing).

- [ ] **Step 4: Implement provider**

Create `apps/backend/src/services/auth/providers/firebase.provider.ts`:

```typescript
import * as admin from 'firebase-admin';
import {
  AuthProvider,
  AuthProviderAbstract,
} from '@gitroom/backend/services/auth/providers.interface';

function ensureFirebaseApp() {
  if (admin.apps.length) {
    return admin.app();
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY are required'
    );
  }

  return admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
}

@AuthProvider({ provider: 'FIREBASE' })
export class FirebaseProvider extends AuthProviderAbstract {
  generateLink() {
    // Client-side Firebase Google popup; no server authorize URL.
    return '';
  }

  async getToken() {
    // Frontend already sends the ID token as providerToken.
    return '';
  }

  async getUser(providerToken: string) {
    try {
      ensureFirebaseApp();
      const decoded = await admin.auth().verifyIdToken(providerToken);
      if (!decoded?.uid || !decoded?.email) {
        return false;
      }
      return { id: decoded.uid, email: decoded.email.toLowerCase() };
    } catch {
      return false;
    }
  }
}
```

- [ ] **Step 5: Register in ApiModule**

In `apps/backend/src/api/api.module.ts`, import and add `FirebaseProvider` next to `GoogleProvider` in the `providers` array.

- [ ] **Step 6: Run test — expect PASS**

Run: `pnpm exec jest apps/backend/src/services/auth/providers/firebase.provider.spec.ts -v`  
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add package.json pnpm-lock.yaml apps/backend/src/services/auth/providers/firebase.provider.ts apps/backend/src/services/auth/providers/firebase.provider.spec.ts apps/backend/src/api/api.module.ts
git commit -m "feat: verify Firebase ID tokens as FIREBASE auth provider"
```

---

### Task 3: Frontend Firebase client + Google button

**Files:**
- Create: `apps/frontend/src/lib/firebase.client.ts`
- Create: `apps/frontend/src/components/auth/providers/firebase-google.provider.tsx`
- Modify: `apps/frontend/src/components/auth/login.tsx`
- Modify: `apps/frontend/src/components/auth/register.tsx`
- Root: `pnpm add firebase -w` (or filter frontend if workspace prefers app-level — use root per monorepo convention)

**Interfaces:**
- Consumes: `POST /auth/login` and `POST /auth/register` with `{ provider: 'FIREBASE', providerToken, company?, email? }`
- Produces: UI control that obtains Google credential via Firebase and completes session cookie flow

Env (public, Firebase web app CheekySocialMediaPortal):

```
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=cheeky-b0098.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=cheeky-b0098
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=cheeky-b0098.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=1024449009049
NEXT_PUBLIC_FIREBASE_APP_ID=1:1024449009049:web:4b0a356e7d58a9a8c82f08
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-LWX58PZ8C2
NEXT_PUBLIC_CHEEKY_MODE=true
```

- [ ] **Step 1: Add firebase client SDK**

Run: `pnpm add firebase -w`

- [ ] **Step 2: Create Firebase initializer**

`apps/frontend/src/lib/firebase.client.ts`:

```typescript
import { FirebaseApp, getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

export function getFirebaseApp(): FirebaseApp {
  if (getApps().length) {
    return getApp();
  }
  return initializeApp(firebaseConfig);
}

export function getFirebaseAuth(): Auth {
  return getAuth(getFirebaseApp());
}
```

- [ ] **Step 3: Create Firebase Google provider button**

`apps/frontend/src/components/auth/providers/firebase-google.provider.tsx`:

```tsx
'use client';

import { useCallback, useState } from 'react';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { getFirebaseAuth } from '@gitroom/frontend/lib/firebase.client';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useT } from '@gitroom/react/translation/get.transation.service.client';

type Props = {
  mode: 'login' | 'register';
  company?: string;
};

export const FirebaseGoogleProvider = ({ mode, company }: Props) => {
  const fetch = useFetch();
  const t = useT();
  const [loading, setLoading] = useState(false);

  const onClick = useCallback(async () => {
    setLoading(true);
    try {
      const auth = getFirebaseAuth();
      const result = await signInWithPopup(auth, new GoogleAuthProvider());
      const idToken = await result.user.getIdToken();
      const email = result.user.email || '';
      const workspace =
        company?.trim() ||
        result.user.displayName?.trim() ||
        email.split('@')[0] ||
        'My workspace';

      const path = mode === 'register' ? '/auth/register' : '/auth/login';
      const body =
        mode === 'register'
          ? {
              provider: 'FIREBASE',
              providerToken: idToken,
              email,
              company: workspace,
              password: '',
            }
          : {
              provider: 'FIREBASE',
              providerToken: idToken,
              email,
              password: '',
            };

      const res = await fetch(path, {
        method: 'POST',
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || 'Auth failed');
      }

      // Existing auth flows set cookie via response; hard navigate home.
      window.location.href = '/';
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  }, [company, fetch, mode]);

  return (
    <div
      onClick={loading ? undefined : onClick}
      className="cursor-pointer flex-1 bg-white h-[52px] rounded-[10px] flex justify-center items-center text-[#0E0E0E] gap-[10px]"
    >
      <span>{t('continue_with_google', 'Continue with Google')}</span>
    </div>
  );
};
```

- [ ] **Step 4: Wire login UI**

In `login.tsx`, when `process.env.NEXT_PUBLIC_CHEEKY_MODE === 'true'` (or `useVariables().cheekyMode` once exposed):

- Render `<FirebaseGoogleProvider mode="login" />` as primary CTA.
- Hide email/password block and the old `GoogleProvider` (YouTube OAuth login).

Mirror on `register.tsx` with optional company field defaulting as above; use `mode="register"`.

- [ ] **Step 5: Manual smoke test (local)**

1. Enable Google provider in Firebase Console for `cheeky-b0098`.
2. Add localhost to authorized domains.
3. Set Admin + public env in `.env`.
4. `pnpm dev` → open register → Continue with Google → new org + session.

Expected: user row with `providerName=FIREBASE`, new organization, redirected to app.

- [ ] **Step 6: Commit**

```bash
git add apps/frontend/src/lib/firebase.client.ts apps/frontend/src/components/auth/providers/firebase-google.provider.tsx apps/frontend/src/components/auth/login.tsx apps/frontend/src/components/auth/register.tsx package.json pnpm-lock.yaml
git commit -m "feat: Firebase Google sign-in for Cheeky Social"
```

---

### Task 4: Align login/register API path for FIREBASE

**Files:**
- Modify: `apps/backend/src/api/routes/auth.controller.ts` (only if DTOs reject unknown provider)
- Modify: `libraries/nestjs-libraries/src/dtos/auth/login.user.dto.ts` and `create.org.user.dto.ts` if provider is an enum that must include `FIREBASE`
- Modify: `apps/backend/src/services/auth/auth.service.ts` if `Provider` cast fails for FIREBASE

**Interfaces:**
- Consumes: `Provider.FIREBASE` from Task 1; `FirebaseProvider.getUser` from Task 2
- Produces: `POST /auth/login` and `POST /auth/register` accept `provider: 'FIREBASE'` + `providerToken`

- [ ] **Step 1: Inspect DTOs**

Ensure `provider` field allows `FIREBASE` (string or enum). If using class-validator `@IsEnum(Provider)`, regenerate/import Prisma `Provider` so `FIREBASE` is valid.

- [ ] **Step 2: Ensure register with empty password works for OAuth**

Confirm `routeAuth` for non-LOCAL skips password hashing (existing OAuth path). If FIREBASE hits LOCAL branch, fix controller to pass `Provider.FIREBASE`.

- [ ] **Step 3: Manual API test**

With a real ID token from Firebase (or emulator):

```bash
curl -X POST "$NEXT_PUBLIC_BACKEND_URL/auth/register" -H "Content-Type: application/json" -d "{\"provider\":\"FIREBASE\",\"providerToken\":\"<idToken>\",\"email\":\"a@b.com\",\"company\":\"Seller Co\",\"password\":\"\"}"
```

Expected: 200 + `auth` cookie / JWT; org created.

- [ ] **Step 4: Commit** if any DTO/controller changes were required.

---

### Task 5: GCS upload provider

**Files:**
- Create: `libraries/nestjs-libraries/src/upload/gcs.storage.ts`
- Create: `libraries/nestjs-libraries/src/upload/gcs.storage.spec.ts`
- Modify: `libraries/nestjs-libraries/src/upload/upload.factory.ts`
- Modify: `libraries/helpers/src/configuration/configuration.checker.ts`
- Root: `pnpm add @google-cloud/storage -w`

**Interfaces:**
- Consumes: `IUploadProvider` (`uploadSimple`, `uploadFile`, `removeFile`)
- Produces: `UploadFactory` supports `STORAGE_PROVIDER=gcs`
- Env: `GCS_BUCKET`, `GCS_PROJECT_ID` (optional if ADC), public base URL `GCS_PUBLIC_URL` or object ACL via uniform bucket + CDN URL

- [ ] **Step 1: Add dependency**

Run: `pnpm add @google-cloud/storage -w`

- [ ] **Step 2: Write failing test**

```typescript
jest.mock('@google-cloud/storage', () => {
  const save = jest.fn().mockResolvedValue(undefined);
  const deleteFn = jest.fn().mockResolvedValue(undefined);
  const file = jest.fn(() => ({ save, delete: deleteFn }));
  const bucket = jest.fn(() => ({ file }));
  return { Storage: jest.fn().mockImplementation(() => ({ bucket })) };
});

import { GcsStorage } from './gcs.storage';

describe('GcsStorage', () => {
  it('uploadFile returns a public URL under the bucket base', async () => {
    const storage = new GcsStorage('my-bucket', 'https://storage.googleapis.com/my-bucket');
    const result = await storage.uploadFile({
      buffer: Buffer.from('hello'),
      mimetype: 'image/png',
      originalname: 'x.png',
      size: 5,
    } as Express.Multer.File);
    expect(result.path).toMatch(/^https:\/\/storage\.googleapis\.com\/my-bucket\//);
  });
});
```

- [ ] **Step 3: Implement `gcs.storage.ts`**

Implement `IUploadProvider` mirroring `cloudflare.storage.ts` behavior:

- `uploadFile`: generate id + extension, `bucket.file(name).save(buffer, { contentType, resumable: false })`, return `{ path: `${publicBase}/${name}` }` (match shape returned by CloudflareStorage — read that file’s return value and copy fields exactly).
- `uploadSimple(url)`: fetch remote (SSRF-safe like Cloudflare) then upload buffer.
- `removeFile(filePath)`: delete object by key parsed from URL.

- [ ] **Step 4: Factory case**

In `upload.factory.ts`:

```typescript
case 'gcs':
  return new GcsStorage(
    process.env.GCS_BUCKET!,
    process.env.GCS_PUBLIC_URL || `https://storage.googleapis.com/${process.env.GCS_BUCKET}`
  );
```

- [ ] **Step 5: Config checker**

When `STORAGE_PROVIDER === 'gcs'`, require non-empty `GCS_BUCKET`.

- [ ] **Step 6: Run unit test**

Run: `pnpm exec jest libraries/nestjs-libraries/src/upload/gcs.storage.spec.ts -v`  
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add libraries/nestjs-libraries/src/upload/gcs.storage.ts libraries/nestjs-libraries/src/upload/gcs.storage.spec.ts libraries/nestjs-libraries/src/upload/upload.factory.ts libraries/helpers/src/configuration/configuration.checker.ts package.json pnpm-lock.yaml
git commit -m "feat: add GCS storage provider for Cheeky media"
```

---

### Task 6: Cheeky branding (auth surfaces)

**Files:**
- Modify: `apps/frontend/src/app/(app)/auth/layout.tsx`
- Modify: `apps/frontend/src/app/(app)/auth/login/page.tsx`
- Modify: `apps/frontend/src/app/(app)/auth/page.tsx`
- Modify: `apps/frontend/src/components/ui/logo-text.component.tsx` (or replace with Cheeky wordmark asset under `apps/frontend/public/`)

**Interfaces:**
- Consumes: `NEXT_PUBLIC_CHEEKY_MODE=true`
- Produces: seller-facing auth pages say Cheeky Social

- [ ] **Step 1: Copy changes**

When Cheeky mode:

- Title/metadata: `Cheeky Social` instead of `Postiz` / `Gitroom`
- Auth layout headline: e.g. `Cheeky Social — promote your brand everywhere`
- Keep existing layout structure; swap strings and logo asset only

- [ ] **Step 2: Visual check**

Run frontend, open `/auth/login` and `/auth`.  
Expected: no “Postiz” in primary auth chrome when Cheeky mode is on.

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/app/(app)/auth apps/frontend/src/components/ui/logo-text.component.tsx apps/frontend/public
git commit -m "feat: brand auth UI as Cheeky Social"
```

---

### Task 7: Staff cross-workspace access (runbook + verification)

**Files:**
- Create: `docs/superpowers/runbooks/cheeky-staff-superadmin.md`
- No schema change if `user.isSuperAdmin` already exists (confirmed)

**Interfaces:**
- Consumes: existing `isSuperAdmin`, `Impersonate` UI, `OrganizationSelector`, `changeOrg`
- Produces: documented way to grant Cheeky staff cross-workspace access

- [ ] **Step 1: Document staff bootstrap**

Write runbook:

1. Staff signs in once with Google (creates their workspace).
2. Operator sets `isSuperAdmin = true` on that user in Cloud SQL:

```sql
UPDATE "User" SET "isSuperAdmin" = true WHERE email = 'staff@cheeky.example';
```

(Use actual Prisma table/column quoting from schema — verify table name in `schema.prisma` before running.)

3. Staff uses Impersonate / org tools already in the app to enter seller workspaces.

- [ ] **Step 2: Verify locally**

Set `isSuperAdmin` on a test user; confirm Impersonate UI appears and can open another org.

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/runbooks/cheeky-staff-superadmin.md
git commit -m "docs: Cheeky staff superadmin workspace access runbook"
```

---

### Task 8: Env templates for Cheeky

**Files:**
- Create: `.env.cheeky.example` (or `deploy/gcp/.env.example`)
- Modify: `.env.example` with a short pointer comment at top

**Required keys (document all):**

```bash
# Core
DATABASE_URL=
REDIS_URL=
JWT_SECRET=
MAIN_URL=
FRONTEND_URL=
NEXT_PUBLIC_BACKEND_URL=
BACKEND_INTERNAL_URL=
TEMPORAL_ADDRESS=
STORAGE_PROVIDER=gcs
GCS_BUCKET=
GCS_PUBLIC_URL=
GCS_PROJECT_ID=

# Firebase Admin (backend)
FIREBASE_PROJECT_ID=cheeky-b0098
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=

# Firebase web (frontend)
NEXT_PUBLIC_CHEEKY_MODE=true
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=cheeky-b0098.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=cheeky-b0098
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=cheeky-b0098.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=1024449009049
NEXT_PUBLIC_FIREBASE_APP_ID=1:1024449009049:web:4b0a356e7d58a9a8c82f08
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-LWX58PZ8C2

IS_GENERAL=true
DISABLE_REGISTRATION=false
```

- [ ] **Step 1: Write template file**
- [ ] **Step 2: Commit**

```bash
git add .env.cheeky.example
git commit -m "docs: Cheeky GCP/Firebase environment template"
```

---

### Task 9: GCP deploy skeleton (hybrid)

**Files:**
- Create: `deploy/gcp/README.md`
- Create: `deploy/gcp/cloud-run-backend.yaml` (service skeleton)
- Create: `deploy/gcp/cloud-run-frontend.yaml`
- Create: `deploy/gcp/gke/temporal-namespace.md` (steps to install Temporal on GKE)
- Create: `firebase.json`, `.firebaserc`

**Interfaces:**
- Consumes: container image built from `Dockerfile.dev` or split Dockerfiles
- Produces: documented deploy path matching Design §2

- [ ] **Step 1: Document provisioning order**

In `deploy/gcp/README.md`:

1. Enable APIs: Cloud Run, Cloud SQL, Memorystore, GKE, Secret Manager, Artifact Registry.
2. Create Cloud SQL Postgres 17 + DB user; set `DATABASE_URL`.
3. Create Memorystore Redis; set `REDIS_URL`.
4. Create GCS bucket; set uniform access + `GCS_*`.
5. Create GKE cluster; install Temporal (Helm `temporalio/temporal` or official quickstart); set `TEMPORAL_ADDRESS`.
6. Build/push image to Artifact Registry.
7. Deploy Cloud Run backend + frontend (or combined nginx image); inject secrets.
8. Firebase Hosting rewrites `/` and `/api/**` to Cloud Run URLs.
9. Set Firebase authorized domains to production host.
10. Run `pnpm prisma-db-push` against Cloud SQL once (from a secure jump / Cloud Build job).

- [ ] **Step 2: `.firebaserc`**

```json
{
  "projects": {
    "default": "cheeky-b0098"
  }
}
```

- [ ] **Step 3: `firebase.json` Hosting rewrites**

Point Hosting to Cloud Run services (exact service names filled when created). Use Firebase Hosting + Cloud Run integration docs; do not invent fake service IDs — leave placeholders `BACKEND_CLOUD_RUN_SERVICE` / `FRONTEND_CLOUD_RUN_SERVICE` in README and fill during deploy.

- [ ] **Step 4: Commit**

```bash
git add deploy/gcp firebase.json .firebaserc
git commit -m "docs: GCP hybrid deploy skeleton for Cheeky Social"
```

---

### Task 10: End-to-end acceptance checklist

**Files:** none (checklist execution)

- [ ] **Step 1: Local E2E**

1. Infra: `pnpm dev:docker` (Postgres, Redis, Temporal).
2. `.env` from `.env.cheeky.example` with Firebase + `STORAGE_PROVIDER=local` for laptop (GCS optional locally).
3. Google sign-up → workspace created.
4. Connect one social (sandbox/test app).
5. Upload media; schedule post; confirm Temporal worker picks it up.

- [ ] **Step 2: Staging GCP E2E**

1. Deploy per Task 9.
2. Sign in at production/staging domain with Google.
3. Confirm media in GCS bucket.
4. Confirm scheduled post publishes.
5. Staff `isSuperAdmin` can impersonate seller workspace.

- [ ] **Step 3: Mark spec status Approved → Implemented (partial/complete)** in design doc when done.

---

## Self-review (plan vs spec)

| Spec requirement | Task |
|------------------|------|
| Firebase Google sign-in/sign-up | 2, 3, 4 |
| Workspace per seller/brand | 3–4 via `createOrgAndUser`; 7 staff |
| Staff cross-workspace | 7 (`isSuperAdmin` + impersonate) |
| GCS storage | 5 |
| Rebrand Cheeky Social | 6 |
| Firebase Hosting + Cloud Run + Cloud SQL + Memorystore + GKE Temporal | 9 |
| No Cloudflare / Stripe v1 | Global constraints; Task 5/8 |
| Env / secrets not hardcoded | 3, 8 |
| E2E success criteria | 10 |

**Placeholder scan:** none intentional; Cloud Run service names are filled at deploy time and called out in Task 9.

**Type consistency:** provider string is always `FIREBASE`; storage key is always `gcs`; public flag `NEXT_PUBLIC_CHEEKY_MODE`.
```
