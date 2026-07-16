# Cheeky Social — GCP hybrid deploy

Deploy path for CheekySocialMediaPortal on GCP (Design §2): Firebase Hosting + Auth, Cloud Run (API + SSR), Cloud SQL, Memorystore, GCS, and Temporal on GKE.

**Image source:** build from `Dockerfile.dev` (combined nginx + API + frontend) or split Dockerfiles per service. Push to Artifact Registry before Cloud Run deploy.

## Provisioning order

1. **Enable APIs:** Cloud Run, Cloud SQL, Memorystore, GKE, Secret Manager, Artifact Registry.
2. **Cloud SQL:** PostgreSQL 17 instance + app DB user; store `DATABASE_URL` in Secret Manager.
3. **Memorystore:** Redis instance; store `REDIS_URL` in Secret Manager.
4. **GCS:** bucket with uniform bucket-level access; set `GCS_BUCKET`, `GCS_PUBLIC_URL`, `GCS_PROJECT_ID` (see `.env.cheeky.example`).
5. **GKE:** cluster for Temporal + orchestrator workers; install Temporal per [`gke/temporal-namespace.md`](./gke/temporal-namespace.md); set `TEMPORAL_ADDRESS`.
6. **Artifact Registry:** build and push container image(s).
7. **Cloud Run:** deploy backend + frontend (or a single combined nginx image); inject secrets from Secret Manager.
8. **Firebase Hosting:** configure rewrites in `firebase.json` (root) to Cloud Run services.
9. **Firebase Auth:** add production host to **Authorized domains** in Firebase Console.
10. **Schema:** run `pnpm prisma-db-push` against Cloud SQL once (Cloud Build job or secure jump host).

## Placeholders to fill at deploy time

Do **not** commit real Cloud Run service names until services exist. Replace these placeholders when deploying:

| Placeholder | Where | Action |
|-------------|-------|--------|
| `BACKEND_CLOUD_RUN_SERVICE` | `firebase.json` → `hosting.rewrites` (`/api/**`) | Set to your backend Cloud Run **service ID** (e.g. `cheeky-backend`) |
| `FRONTEND_CLOUD_RUN_SERVICE` | `firebase.json` → `hosting.rewrites` (`**`) | Set to your frontend Cloud Run **service ID** (e.g. `cheeky-frontend`) |
| `PLACEHOLDER_BACKEND_SERVICE_NAME` | `cloud-run-backend.yaml` → `metadata.name` | Match backend service name |
| `PLACEHOLDER_FRONTEND_SERVICE_NAME` | `cloud-run-frontend.yaml` → `metadata.name` | Match frontend service name |
| `PLACEHOLDER_ARTIFACT_REGISTRY_IMAGE_BACKEND` | `cloud-run-backend.yaml` → `containers[].image` | e.g. `REGION-docker.pkg.dev/PROJECT/REPO/backend:TAG` |
| `PLACEHOLDER_ARTIFACT_REGISTRY_IMAGE_FRONTEND` | `cloud-run-frontend.yaml` → `containers[].image` | e.g. `REGION-docker.pkg.dev/PROJECT/REPO/frontend:TAG` |
| `PLACEHOLDER_REGION` | `firebase.json`, YAML annotations | GCP region (e.g. `us-central1`) |
| `PLACEHOLDER_GCP_PROJECT_ID` | YAML annotations | GCP project ID |

After creating Cloud Run services, link them to Firebase Hosting:

```bash
# Example — replace service names and region
firebase deploy --only hosting
```

See [Firebase Hosting + Cloud Run](https://firebase.google.com/docs/hosting/cloud-run) for IAM and `run.serviceId` requirements.

## Cloud Run manifests

| File | Purpose |
|------|---------|
| [`cloud-run-backend.yaml`](./cloud-run-backend.yaml) | NestJS API (port 3000) |
| [`cloud-run-frontend.yaml`](./cloud-run-frontend.yaml) | Next.js SSR (port 4200) |

Deploy (after replacing placeholders):

```bash
gcloud run services replace deploy/gcp/cloud-run-backend.yaml --region=PLACEHOLDER_REGION
gcloud run services replace deploy/gcp/cloud-run-frontend.yaml --region=PLACEHOLDER_REGION
```

## Environment

Copy `.env.cheeky.example` and populate secrets via Secret Manager; reference secrets in Cloud Run YAML `valueFrom.secretKeyRef` blocks.

## Combined vs split deploy

`Dockerfile.dev` runs nginx (5000) proxying `/api/` → 3000 and `/` → 4200. For hybrid Firebase Hosting:

- **Split (recommended):** separate backend + frontend Cloud Run services; Hosting rewrites route traffic.
- **Combined:** single Cloud Run service on port 5000; point both rewrites at one service (simpler, less granular scaling).
