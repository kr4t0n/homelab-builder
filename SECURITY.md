# Security Policy

## Supported Versions

Currently only the `master` version of Orbit is actively supported for security updates.

| Version | Supported          |
| ------- | ------------------ |
| v1.0.x  | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability within Orbit, please do NOT post it on the public GitHub issue tracker. 

Instead, please send an e-mail to the repository owner directly or use GitHub's private vulnerability reporting feature on this repository. We will attempt to address and resolve the vulnerability as quickly as possible.

Common vulnerabilities include:
- SQL Injections
- Authentication/Authorization bypasses
- Cross-Site Scripting (XSS)
- Exposure of sensitive backend environment variables or secrets

We appreciate your effort in responsibly disclosing vulnerabilities to keep the homelab community safe!

## Authentication

Orbit uses **email/password authentication** with bcrypt password hashing and JWT tokens.

**Requirements for production:**
- `JWT_SECRET` — **must** be set to a strong, unique, random value (minimum 32 characters recommended). The backend **refuses to start** in release mode (`GIN_MODE=release`) if `JWT_SECRET` is missing, empty, or set to the default dev value.
- `GIN_MODE=release` — enforces the JWT secret strength check.

**Checklist for production:**
- [ ] Set `JWT_SECRET` to a cryptographically random string (e.g., `openssl rand -base64 48`)
- [ ] Set `GIN_MODE=release`
- [ ] Ensure the frontend is served over HTTPS (via reverse proxy)

### Endpoints

- `POST /auth/register` — create account with email, password (min 8 chars), and name
- `POST /auth/login` — authenticate with email and password, returns JWT

## Security Architecture

### JWT Handling

- JWTs are signed with HMAC-SHA256 using the `JWT_SECRET`.
- Token claims include `user_id`, `email`, and standard registered claims (expiry, issuer).
- The backend validates tokens on every protected request via the `AuthMiddleware`.
- In release mode, the backend **panics on startup** if `JWT_SECRET` is weak or default — this is an intentional fail-safe.

### Rate Limiting

- The `/auth/login` endpoint is protected by per-IP rate limiting.
- After repeated failed login attempts, the IP is temporarily locked out.
- Rate limiting uses `c.ClientIP()` with trusted proxy configuration to prevent IP spoofing via `X-Forwarded-For`.

### Trusted Proxies

The backend explicitly configures trusted proxy ranges (`127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`) to ensure `c.ClientIP()` only trusts `X-Forwarded-For` headers from internal Docker/reverse-proxy networks.

### Security Headers

All responses include standard security headers via the `SecurityHeaders()` middleware (e.g., `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`).

### CORS

- In release mode (`GIN_MODE=release`): CORS `Access-Control-Allow-Origin` is locked to `https://hlbldr.com`.
- In debug mode: CORS allows `*` for local development convenience.

### Database

- All primary keys use PostgreSQL-native UUID v4 generation — IDs are non-sequential and non-guessable.
- The database is not exposed externally in the default Docker Compose configuration (no host port mapping for the `postgres` service).

