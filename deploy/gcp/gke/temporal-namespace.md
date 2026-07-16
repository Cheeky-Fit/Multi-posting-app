# Temporal on GKE — Cheeky Social

Self-hosted Temporal server + orchestrator workers on GKE (Design §2). Workers stay always-on; do not run Temporal on Cloud Run.

## Prerequisites

- GKE cluster (regional or zonal) in the same VPC as Cloud SQL / Memorystore where possible.
- `kubectl` and `helm` configured for the cluster.
- Dedicated PostgreSQL for Temporal (separate from app Cloud SQL, or a second database on the same instance).

## 1. Namespace

```bash
kubectl create namespace temporal
kubectl config set-context --current --namespace=temporal
```

## 2. Install Temporal (Helm)

Official chart: [`temporalio/temporal`](https://github.com/temporalio/helm-charts).

```bash
helm repo add temporalio https://go.temporal.io/helm-charts
helm repo update

# Minimal install — customize values for production (persistence, replicas, resources)
helm install temporal temporalio/temporal \
  --namespace temporal \
  --set server.replicaCount=1 \
  --set cassandra.enabled=false \
  --set elasticsearch.enabled=false \
  --set prometheus.enabled=false \
  --set grafana.enabled=false
```

For production, provide a `values.yaml` with:

- PostgreSQL persistence (not Cassandra) for Temporal history
- Resource requests/limits per component (frontend, history, matching, worker)
- Pod disruption budgets and multiple replicas where required

See [Temporal self-hosted production](https://docs.temporal.io/self-hosted-guide) and the Helm chart README.

## 3. Expose Temporal frontend (gRPC)

Orchestrator workers and the NestJS API need `TEMPORAL_ADDRESS` (host:port, typically `7233`).

Options:

- **Internal only (recommended):** ClusterIP service; workers run in GKE; Cloud Run backend uses [VPC connector](https://cloud.google.com/vpc/docs/configure-serverless-vpc-access) to reach `temporal-frontend.temporal.svc.cluster.local:7233` or an internal load balancer IP.
- **Internal HTTP(S) load balancer:** for cross-environment access with strict firewall rules.

Store the resolved address in Secret Manager as `TEMPORAL_ADDRESS`.

## 4. Deploy orchestrator workers

Build a worker image from `apps/orchestrator` (or the monorepo `Dockerfile.dev` worker target when split).

```bash
# Example Deployment skeleton — replace image and env
kubectl apply -f - <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: cheeky-orchestrator
  namespace: temporal
spec:
  replicas: 2
  selector:
    matchLabels:
      app: cheeky-orchestrator
  template:
    metadata:
      labels:
        app: cheeky-orchestrator
    spec:
      containers:
        - name: orchestrator
          image: PLACEHOLDER_ARTIFACT_REGISTRY_IMAGE_ORCHESTRATOR
          env:
            - name: TEMPORAL_ADDRESS
              valueFrom:
                secretKeyRef:
                  name: temporal-address
                  key: address
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: app-database-url
                  key: url
          resources:
            requests:
              cpu: "500m"
              memory: 512Mi
EOF
```

Workers must use the same task queues and namespace configuration as the backend Temporal client.

## 5. Health and operations

- Verify Temporal Web UI or `tctl`/`temporal` CLI against the frontend service.
- Monitor pod restarts, DB connections, and workflow backlog.
- Document backup/restore for Temporal’s PostgreSQL.
- Keep Temporal version aligned with SDK version in `apps/orchestrator`.

## 6. Wire app env

Set in Secret Manager / `.env.cheeky.example`:

- `TEMPORAL_ADDRESS` — reachable from Cloud Run (via VPC connector) and from worker pods.

Do not point production at a local `localhost:7233`.
