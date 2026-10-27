# Koll on Kubernetes (kind, on your Mac)

The same `koll-agent` image as Docker Compose, running on a local Kubernetes cluster.

| File | What it creates |
|---|---|
| `namespace.yaml` | The `koll` namespace (a folder inside the cluster) |
| `config.yaml` | ConfigMap with settings that aren't secret |
| `db.yaml` | Postgres: disk (PersistentVolumeClaim), Deployment, Service `db` |
| `categorizer.yaml` | Categorizer agent: Deployment + Service `categorizer:4001` |
| `analyst.yaml` | Analyst agent: Deployment + Service `analyst:4002` |
| `orchestrator.yaml` | A waiting pod you run the orchestrator in with `kubectl exec` |

Secrets (passwords, Google login) are created with `kubectl` from your local files, never stored in git.

## First time
```bash
kind create cluster --name koll
docker compose build
kind load docker-image koll-agent:latest --name koll

kubectl apply -f k8s/namespace.yaml
kubectl create secret generic koll-secrets -n koll --from-env-file=.env
kubectl create secret generic gcloud-adc -n koll \
  --from-file=adc.json=$HOME/.config/gcloud/application_default_credentials.json
kubectl create configmap db-init -n koll --from-file=db/init/

kubectl apply -f k8s/
kubectl get pods -n koll -w
```

## Copy your data from Docker Compose
```bash
docker compose up -d db
docker compose exec -T db pg_dump -U koll -d koll -t transactions --no-owner \
  | kubectl exec -i -n koll deploy/db -- psql -U koll -d koll
```

## Use it
```bash
kubectl exec -n koll deploy/orchestrator -- npx tsx agents/orchestrator/src/index.ts "Hur mycket la jag på mat i september?"
kubectl logs -n koll deploy/analyst
kubectl port-forward -n koll svc/categorizer 14001:4001   # then open http://localhost:14001/.well-known/agent-card.json
```

## After a code change
```bash
docker compose build
kind load docker-image koll-agent:latest --name koll
kubectl rollout restart deployment -n koll
```

## Stop / remove
```bash
kind delete cluster --name koll   # removes everything, including the database copy
```
