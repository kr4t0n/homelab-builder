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

### Automated IP Management (IPAM)

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
| **Auth** | Email/password + JWT |
| **Infrastructure** | Docker & Docker Compose |

---

## Quick Start

```bash
git clone https://github.com/kr4t0n/orbit.git
cd orbit

# Start all services
docker compose up -d

# Frontend: http://localhost:3000
# Backend:  http://localhost:8080
```

Create an account via the registration form to get started.

---

## Architecture

For the full architecture reference — monorepo layout, backend layers, data model, IP assignment algorithm, testing infrastructure, and known pitfalls — see [AGENTS.md](./AGENTS.md).

```
orbit/
├── backend/           # Go API server (Gin + GORM)
├── ipam/           # Standalone IPAM microservice
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

## Authentication

Orbit uses traditional **email/password authentication** with bcrypt password hashing and JWT tokens.

- **Register** at `POST /auth/register` with `email`, `password` (min 8 chars), and `name`.
- **Login** at `POST /auth/login` with `email` and `password`.
- Both endpoints return a JWT token (7-day expiry) to use as `Authorization: Bearer <token>`.
- Rate limiting protects the login endpoint (6 failed attempts = 15-minute lockout).

In production (`GIN_MODE=release`), `JWT_SECRET` must be set to a strong, unique value.

---

## Environment Variables

### Backend

| Variable | Default | Description |
|---|---|---|
| `DB_HOST` | `postgres` | PostgreSQL hostname |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_USER` | `orbit` | PostgreSQL user |
| `DB_PASSWORD` | `orbit_password` | PostgreSQL password |
| `DB_NAME` | `orbit` | Database name |
| `DB_SSLMODE` | `disable` | PostgreSQL SSL mode |
| `JWT_SECRET` | — | JWT signing secret |
| `SERVER_PORT` | `8080` | HTTP listen port |
| `IPAM_URL` | `http://ipam:8081` | IPAM microservice URL |

### IPAM Microservice

| Variable | Default | Description |
|---|---|---|
| `PORT` | `8081` | HTTP listen port |

### Frontend (Vite build args)

| Variable | Description |
|---|---|
| `VITE_API_URL` | Backend base URL (default `http://localhost:8080`) |

---

## License

This project is licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0)**. See the [LICENSE](./LICENSE) file for details.
