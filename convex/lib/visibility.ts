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

export async function getVisibleCaseIds(
  db: any,
  role: string,
  userId: string,
  organisationId: string
): Promise<Set<string>> {
  const caseIds = new Set<string>();

  // case_manager: directly assigned cases + cases with assigned tasks
  if (role === "case_manager") {
    const myCases = await db
      .query("cases")
      .withIndex("by_assigned", (q: any) => q.eq("assignedTo", userId))
      .collect();
    for (const c of myCases) {
      if (c.organisationId === organisationId) caseIds.add(c._id);
    }
  }

  // both roles: cases containing their assigned tasks
  const myTasks = await db
    .query("tasks")
    .withIndex("by_assigned", (q: any) => q.eq("assignedTo", userId))
    .collect();
  for (const task of myTasks) {
    if (task.caseId) caseIds.add(task.caseId);
  }
  return caseIds;
}

export async function getVisibleClientIds(
  db: any,
  role: string,
  userId: string,
  organisationId: string
): Promise<Set<string>> {
  const caseIds = await getVisibleCaseIds(db, role, userId, organisationId);
  const clientIds = new Set<string>();
  for (const caseId of caseIds) {
    const c = await db.get(caseId);
    if (c && c.organisationId === organisationId) clientIds.add(c.clientId);
  }
  return clientIds;
}
