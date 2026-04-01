# TEMPLATE: Convex Backend Architecture

## Architecture Positioning

Convex is the reactive application backend layer.
It is NOT the core domain engine.

---

## Layering Model

Frontend  
↓  
Convex Functions (Application Layer)  
↓  
Domain Services (Pure Business Logic)  
↓  
Data Model (Convex DB)

---

## Folder Structure

/convex
  /functions        → Thin query/mutation handlers
/domain             → Framework-agnostic business logic
/application        → Use-case orchestration
/types              → Shared contracts

---

## Design Rules

- Keep Convex functions thin
- Domain logic must be portable
- Validate at boundaries
- Enforce schema strictness
- Avoid fat mutations
- Use indexes intentionally

---

## Performance Strategy

- Index high-cardinality fields
- Avoid N+1 query patterns
- Use pagination by default
- Monitor reactive re-renders

---

## Scaling Guidance

Convex works best for:
- Real-time apps
- Collaborative tools
- SaaS dashboards
- MVP → mid-scale growth

Plan exit strategy for:
- Heavy analytics workloads
- Complex distributed orchestration
- Extreme multi-region compliance
