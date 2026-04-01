# STRATEGY: Convex + Microservices Hybrid

## When to Use Hybrid

Use Convex for:
- Realtime UX
- User state
- Collaborative updates
- Low-latency interactions

Use Microservices for:
- Heavy compute
- Event processing
- ML workloads
- Cross-domain orchestration
- High-scale APIs

---

## Architecture Pattern

Frontend
   ↓
Convex (Reactive Layer)
   ↓
API Gateway
   ↓
Microservices
   ↓
Independent Datastores

---

## Integration Model

- Convex triggers events
- Microservices consume asynchronously
- Results pushed back via event sync
- Avoid synchronous chains > 2 hops

---

## Rules

- No shared databases
- Event-driven integration preferred
- Keep Convex decoupled from internal service contracts
- Use message broker between layers

---

## Scaling Philosophy

Convex handles UX scale.
Microservices handle compute scale.
Separation prevents lock-in risk.
