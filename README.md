# Orbit

<img src="./logo.svg" alt="Orbit Logo" width="100" height="100">

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)

> **Special Thanks** — Orbit began as a fork of [**Butterski/homelab-builder**](https://github.com/Butterski/homelab-builder) by [Paweł Kręczewski](https://www.linkedin.com/in/pawe%C5%82-kr%C4%99czewski-a2a372242/). The original project laid the groundwork for the visual builder concept and its 3-layer structural logo. Orbit has since diverged significantly — narrowing the scope to a dedicated network topology visualizer while adding Tailscale VPN overlays, Kubernetes cluster modeling, and a reworked IP management engine — but the original vision and effort deserve recognition. Thank you, Paweł.

---

Orbit is an interactive network topology visualizer for homelab infrastructure. Drop in routers, switches, servers, NAS boxes, SBCs, and other hardware onto a visual canvas, wire them together, and watch the tool automatically assign IP addresses, map Tailscale mesh overlays, and model Kubernetes clusters — all in real time.

## Key Features

### Visual Network Builder

The core of Orbit is a drag-and-drop canvas powered by **ReactFlow**.

- Place hardware nodes (routers, switches, servers, NAS, Mini-PCs, SBCs, UPS, and more) and wire them into a topology graph.
- Define Virtual Machines directly on compute nodes with independent IP assignments.
- Real-time sync — every change on the canvas is persisted to PostgreSQL immediately.

### Automated IP Management (hlbIPAM)

A standalone Go microservice handles all IP address allocation:

- **Topology-aware BFS** — walks outward from each gateway router to assign addresses based on device role zones.
- **Shared offset maps** — multiple routers on the same `/24` subnet never produce duplicate IPs.
- **VM-aware pool sizing** — host and VM addresses are packed without collisions.
- **Custom IP preservation** — manually assigned addresses are respected during recalculation.

### Tailscale VPN Overlay

- Toggle Tailscale support per build and assign Tailscale IPs to any node or VM.
- A **Mesh Overlay View** draws dashed lines between all enrolled devices to visualize the full-mesh VPN topology on top of your physical layout.
- Tailscale IPs are user-managed — they are never overwritten by the IP assignment engine.

### Kubernetes Cluster Modeling

- Create Kubernetes clusters with configurable Pod CIDR, Service CIDR, CNI plugin (Flannel / Calico / Cilium), and API server port.
- Enroll physical nodes or VMs as master or worker members.
- Define workloads (deployments) with replica counts, resource requests, ports, and ingress settings.
- A **Cluster Overlay View** visualizes cluster topology with masters at the center and workers in orbit.

### Service Catalog & Hardware Recommendations

- Browse a catalog of popular homelab services with pre-defined resource requirements.
- Generate hardware profiles at three tiers — Minimal, Recommended, and Optimal.
- A live resource dashboard aggregates CPU, RAM, storage, and power draw across the build.

### Shopping List Generation

- Automatically generate an itemized shopping list from a build, including peripherals (RAM, NVMe, cables).
- Estimated pricing with direct purchase links based on your region.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, TypeScript, Vite, ReactFlow, TailwindCSS, Zustand |
| **Backend API** | Go 1.24+, Gin, GORM |
| **IPAM Microservice** | Go 1.24+, standard library REST |
| **Database** | PostgreSQL 17 |
| **Auth** | Google OAuth 2.0 + JWT (optional — runs without auth for self-hosting) |
| **Infrastructure** | Docker & Docker Compose |

---

## Quick Start

```bash
git clone <your-orbit-repo-url>
cd orbit

# Start all services (no .env needed — auth-disabled mode by default)
docker compose up -d

# Frontend: http://localhost:3000
# Backend:  http://localhost:8080
```

Without Google OAuth credentials, Orbit runs in **auth-disabled mode** — it automatically provisions a local admin user so you can start building immediately. See [Auth-Disabled Mode](#self-hosting-without-google-oauth) below for details.

---

## Architecture

For the full architecture reference — monorepo layout, backend layers, data model, IP assignment algorithm, testing infrastructure, and known pitfalls — see [AGENTS.md](./AGENTS.md).

```
orbit/
├── backend/           # Go API server (Gin + GORM)
├── hlbipam/           # Standalone IPAM microservice
├── frontend/          # React + TypeScript + ReactFlow
├── docker-compose.yml # Full stack orchestration
└── AGENTS.md          # Detailed architecture & agent reference
```

---

## Local Development

```bash
# Backend (requires Go 1.24+)
cd backend
go run ./cmd/server

# Frontend (requires Node 20+)
cd frontend
npm install
npm run dev
```

---

## Running Tests

```bash
# All tests (backend in Docker + frontend locally)
make test

# Backend only (runs against real PostgreSQL in Docker)
make test-backend

# Frontend only (Vitest, fully mocked — no backend needed)
make test-frontend
```

---

## Self-Hosting Without Google OAuth

Orbit ships with a built-in **auth-disabled mode** for local and trusted-network deployments. When `GOOGLE_CLIENT_ID` is unset, the backend bypasses JWT validation and auto-provisions a **Local Admin** user (`local@homelab.local`) with full access.

### How to enable

Just start the stack without providing Google/JWT variables — the default `docker-compose.yml` triggers auth-disabled mode when they are absent.

If running with `GIN_MODE=release`, either switch to `debug` or set `JWT_SECRET` to any random string:

```yaml
# docker-compose.override.yml
services:
  backend:
    environment:
      GIN_MODE: "debug"
```

### Environment variables (auth-related)

| Variable | Required for auth-disabled? | Description |
|---|---|---|
| `GOOGLE_CLIENT_ID` | No — leave unset | Enables auth-disabled mode when empty |
| `VITE_GOOGLE_CLIENT_ID` | No — leave unset | Frontend skips Google login and auto-authenticates |
| `JWT_SECRET` | No (unless `GIN_MODE=release`) | Unused in auth-disabled mode |
| `GIN_MODE` | No | Set to `debug` to skip JWT secret strength check |

### Dev login endpoint

When `GIN_MODE != release`, a development endpoint is available at `POST /auth/dev` — send `{"email": "any@example.com"}` to get a JWT for scripting and multi-user testing.

### Security note

Auth-disabled mode grants full admin access to anyone who can reach the instance. Do not expose it to the public internet without a VPN or reverse proxy with its own authentication layer.

---

## Environment Variables

### Backend

| Variable | Default | Description |
|---|---|---|
| `DB_HOST` | `postgres` | PostgreSQL hostname |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_USER` | `homelab` | PostgreSQL user |
| `DB_PASSWORD` | `homelab_password` | PostgreSQL password |
| `DB_NAME` | `homelab_builder` | Database name |
| `DB_SSLMODE` | `disable` | PostgreSQL SSL mode |
| `JWT_SECRET` | — | JWT signing secret |
| `GOOGLE_CLIENT_ID` | — | Google OAuth client ID |
| `SERVER_PORT` | `8080` | HTTP listen port |
| `IPAM_URL` | `http://hlbipam:8081` | hlbIPAM microservice URL |

### IPAM Microservice

| Variable | Default | Description |
|---|---|---|
| `PORT` | `8081` | HTTP listen port |

### Frontend (Vite build args)

| Variable | Description |
|---|---|
| `VITE_API_URL` | Backend base URL (default `http://localhost:8080`) |
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth client ID |

---

## License

This project is licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0)**. See the [LICENSE](./LICENSE) file for details.
