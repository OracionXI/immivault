/**
 * Role-visibility helpers (case-scoped access model).
 *
 * Rule: a user can see only the specific cases they are directly connected to,
 * plus ALL tasks and documents within those cases.
 *
 * getVisibleCaseIds — the set of cases the caller can see:
 *   case_manager → cases directly assigned to them
 *                  UNION cases containing tasks assigned to them
 *   staff        → cases containing tasks assigned to them
 *
 * getVisibleClientIds — clients of those visible cases (for the clients list).
 */

import type { DatabaseReader } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

export async function getVisibleCaseIds(
  db: DatabaseReader,
  role: string,
  userId: Id<"users">,
  organisationId: Id<"organisations">
): Promise<Set<Id<"cases">>> {
  const caseIds = new Set<Id<"cases">>();

  // case_manager: directly assigned cases + cases with assigned tasks
  if (role === "case_manager") {
    const myCases = await db
      .query("cases")
      .withIndex("by_assigned", (q) => q.eq("assignedTo", userId))
      .collect();
    for (const c of myCases) {
      if (c.organisationId === organisationId) caseIds.add(c._id);
    }
  }

  // both roles: cases containing their assigned tasks (scoped to this org)
  const myTasks = await db
    .query("tasks")
    .withIndex("by_assigned", (q) => q.eq("assignedTo", userId))
    .collect();
  for (const task of myTasks) {
    if (task.caseId && task.organisationId === organisationId) caseIds.add(task.caseId);
  }
  return caseIds;
}

export async function getVisibleClientIds(
  db: DatabaseReader,
  role: string,
  userId: Id<"users">,
  organisationId: Id<"organisations">
): Promise<Set<Id<"clients">>> {
  const caseIds = await getVisibleCaseIds(db, role, userId, organisationId);
  const cases = await Promise.all([...caseIds].map((id) => db.get(id)));
  const clientIds = new Set<Id<"clients">>();
  for (const c of cases) {
    if (c && c.organisationId === organisationId) clientIds.add(c.clientId);
  }
  return clientIds;
}
