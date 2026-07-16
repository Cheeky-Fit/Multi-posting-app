# Cheeky staff cross-workspace access

**Purpose:** Grant Cheeky support/ops staff the ability to enter any seller workspace without a formal invite.

**Mechanism:** Existing Postiz `isSuperAdmin` flag + built-in **Impersonate** bar and **Organization selector** UI. No schema migration required.

---

## Prerequisites

- Cheeky Social portal deployed (Cloud SQL reachable by operators).
- Staff member has a **@cheeky** (or approved) Google account.
- Firebase Google sign-in enabled (`cheeky-b0098`).

---

## 1. Staff first sign-in (creates their workspace)

1. Staff opens the Cheeky portal and signs in with **Google**.
2. Backend creates a `User` row and an associated organization/workspace (same flow as any seller).
3. Note the staff email address — it is required for the SQL step below.

Staff can complete this step themselves; no operator action needed until step 2.

---

## 2. Operator grants super-admin in Cloud SQL

Connect to the production Cloud SQL instance (PostgreSQL) and run:

```sql
UPDATE "User"
SET "isSuperAdmin" = true
WHERE email = 'staff@cheeky.example';
```

### Schema reference (verified in `libraries/nestjs-libraries/src/database/prisma/schema.prisma`)

| Prisma field     | PostgreSQL table | PostgreSQL column  |
|------------------|------------------|--------------------|
| `User`           | `"User"`         | —                  |
| `isSuperAdmin`   | `"User"`         | `"isSuperAdmin"`   |

Prisma uses the model name as the table name and preserves camelCase column names; both must be double-quoted in raw SQL.

### Verify the update

```sql
SELECT id, email, "isSuperAdmin"
FROM "User"
WHERE email = 'staff@cheeky.example';
```

Expected: one row with `"isSuperAdmin" = true`.

### Revoke access

```sql
UPDATE "User"
SET "isSuperAdmin" = false
WHERE email = 'staff@cheeky.example';
```

---

## 3. Staff uses in-app cross-workspace tools

After the flag is set, staff must **sign out and sign back in** (or hard-refresh) so the session reflects `admin: true`.

### Impersonate bar (primary — any workspace)

Visible at the top of the app when `user.admin` is true (`isSuperAdmin` on the `User` row).

1. Type a seller name or email fragment in the search field.
2. Select the matching organization/user from results (`GET /user/impersonate?name=…`).
3. App sets the `impersonate` cookie via `POST /user/impersonate` and reloads.
4. Staff now operates inside that seller's workspace (calendar, channels, posts, etc.).
5. Click **X** on the red banner to stop impersonating (`POST /user/impersonate` with empty id).

Backend guard: `auth.middleware.ts` only swaps org context when `user.isSuperAdmin && impersonate` cookie/header is present.

### Organization selector (staff's own memberships)

If staff belongs to multiple orgs (invited workspaces), the org icon in the header lists them. Clicking an org calls `POST /user/change-org` and reloads. This only covers orgs the user is a member of — use **Impersonate** for arbitrary seller workspaces.

---

## 4. Local verification (dev / staging)

1. Start the stack locally (`pnpm` dev workflow).
2. Sign in as a test user, then set super-admin in local Postgres:

   ```sql
   UPDATE "User" SET "isSuperAdmin" = true WHERE email = 'your-test@example.com';
   ```

3. Re-authenticate; confirm the **Impersonate** search bar appears at the top.
4. Search for another test user's org name; impersonate and confirm you see their workspace data.
5. Stop impersonating and confirm you return to your own workspace.

---

## Security notes

- Treat `isSuperAdmin` like root access — grant only to vetted Cheeky staff.
- Audit grants periodically; revoke when staff leave.
- Impersonation is logged server-side via existing request context; do not share super-admin accounts.
- Production cookies are `httpOnly` + `secure` unless `NOT_SECURED` is set (local only).

---

## Related code

| Concern              | Location |
|----------------------|----------|
| Prisma `User` model  | `libraries/nestjs-libraries/src/database/prisma/schema.prisma` |
| Impersonate UI       | `apps/frontend/src/components/layout/impersonate.tsx` |
| Org switcher         | `apps/frontend/src/components/layout/organization.selector.tsx` |
| API: impersonate     | `apps/backend/src/api/routes/users.controller.ts` |
| Auth middleware swap | `apps/backend/src/services/auth/auth.middleware.ts` |
