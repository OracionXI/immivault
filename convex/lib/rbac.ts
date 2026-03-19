import { ConvexError } from "convex/values";

// ─── Role & Permission Definitions ────────────────────────────────────────────

type Role = "admin" | "case_manager" | "staff" | "accountant";
type Resource =
  | "clients"
  | "cases"
  | "tasks"
  | "documents"
  | "appointments"
  | "billing"
  | "staff"
  | "settings";
type Action = "create" | "read" | "update" | "delete" | "assign";

const PERMISSIONS: Record<Role, Record<Resource, Action[]>> = {
  admin: {
    clients:      ["create", "read", "update", "delete"],
    cases:        ["create", "read", "update", "delete", "assign"],
    tasks:        ["create", "read", "update", "delete", "assign"],
    documents:    ["create", "read", "update", "delete"],
    appointments: ["create", "read", "update", "delete"],
    billing:      ["create", "read", "update", "delete"],
    staff:        ["create", "read", "update", "delete"],
    settings:     ["create", "read", "update", "delete"],
  },
  case_manager: {
    clients:      ["read"],
    cases:        ["read", "update"],    // own assigned cases; cannot delete
    tasks:        ["create", "read", "update", "delete", "assign"],
    documents:    ["create", "read", "delete"],
    appointments: ["create", "read", "update", "delete"],
    billing:      [],
    staff:        ["read"],              // for task assignment picker
    settings:     [],
  },
  staff: {
    clients:      ["read"],
    cases:        ["read"],
    tasks:        ["read", "update"],   // own assigned tasks; full edit on assigned tasks
    documents:    ["read", "create"],   // can upload to cases where they have assigned tasks
    appointments: ["read"],
    billing:      [],
    staff:        [],
    settings:     [],
  },
  accountant: {
    clients:      [],
    cases:        [],
    tasks:        [],
    documents:    [],
    appointments: ["create", "read", "update"],  // general meetings only; delete is admin-only
    billing:      ["create", "read", "update", "delete"],
    staff:        ["read", "update"],
    settings:     [],
  },
};

// ─── Permission Helpers ────────────────────────────────────────────────────────

export function hasPermission(
  role: Role,
  resource: Resource,
  action: Action
): boolean {
  return PERMISSIONS[role]?.[resource]?.includes(action) ?? false;
}

/**
 * Throws ConvexError FORBIDDEN if the user's role lacks the requested permission.
 * `ctx` must have a `user` property with a `role` field (authenticatedQuery/Mutation ctx).
 */
export function requirePermission(
  ctx: { user: { role: string } },
  resource: Resource,
  action: Action
): void {
  const role = ctx.user.role as Role;
  if (!hasPermission(role, resource, action)) {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: `Your role (${role}) does not have ${action} access to ${resource}.`,
    });
  }
}

/** Shorthand: throws if caller is not admin. */
export function requireAdmin(ctx: { user: { role: string } }): void {
  if (ctx.user.role !== "admin") {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: "Admin privileges required.",
    });
  }
}

/** Shorthand: throws if caller is staff or accountant (allows admin + case_manager only). */
export function requireAtLeastCaseManager(ctx: { user: { role: string } }): void {
  if (ctx.user.role === "staff" || ctx.user.role === "accountant") {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: "Case manager or admin privileges required.",
    });
  }
}
