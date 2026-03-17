# Orbit Roadmap & Ideas

This document outlines the original Minimum Viable Product (MVP) goals and future ideas for Orbit, translated from the initial planning phases.

## 1. Fast Start & Easy Onboarding
Users may be overwhelmed by the number of services and hardware components.
- **Fast start wizard** to help quickly create a basic homelab based on simple questions.
- **Interactive onboarding** offering a tour and 2-3 predefined example templates using real hardware components from the catalog.

## 2. Real Data Integration
Currently, prices and specs are mostly mocked or estimated.
- Implement real prices, availability, and specs by integrating with external APIs.
- Scan popular sites (e.g., Ceneo/Allegro for Poland, Amazon PA API / eBay internationally).

## 3. Emulation, Testing & Validation
Help users verify their designs before they buy hardware.
- Implement tests to validate the homelab configuration (e.g., resource exhaustion warnings, network bottleneck simulations).
- Pre-flight checks summarizing all hardware and logical constraints.

## 4. Security, Scalability, & Architecture
- Enforce strict token validation on the backend using OAuth2.
- Implement rate limiting and security headers.
- Optimize the database with proper indexes on key relational fields to speed up queries.
- Ensure strict access control for the Admin Dashboard (prevent API/UI privilege escalation).

## 5. Affiliate Links & Monetization
- Generate functional affiliate links in the shopping list to support development.
- Build an admin UI to manage retailers, priorities, and affiliate mappings globally.

## 6. IPAM as a Standalone Microservice
(Currently Implemented as `ipam`)
We separated the automated IP assignment logic into a standalone, stateless Go REST service. This makes the logic faster, easier to test, and enables future potential as a standalone open-source tool.
- Supports graph-based BFS topology resolution, shared subnets, and contiguous DHCP-safe packing.

---

### Original MVP Assumptions
- Define services with estimated resource hits (CPU/RAM/Storage).
- Receive generic or specific hardware recommendations.
- Generate a shopping list and basic topology map (ReactFlow).
- Save configurations via Google OAuth.

*MVP explicitly excluded advanced AI, live external API integrations, and complex caching (Redis) initially to focus on core functionality.*
