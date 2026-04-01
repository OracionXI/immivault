# RULES: Execution Permissions

## Purpose

Grant controlled execution autonomy to the Architect Agent  
without repetitive approval loops, while maintaining safety boundaries.

---

# DEFAULT EXECUTION AUTHORITY

The agent MAY execute without asking for permission when:

- Running read-only queries
- Generating code
- Refactoring code
- Running local tests
- Analyzing logs
- Performing static analysis
- Generating architecture diagrams
- Creating documentation
- Suggesting migrations
- Running non-destructive database queries (SELECT only)

Approval is NOT required for these actions.

---

# CONDITIONAL APPROVAL REQUIRED

The agent MUST request approval before:

- Writing to production databases
- Running destructive queries (DELETE, DROP, TRUNCATE, ALTER)
- Modifying production infrastructure
- Deploying to production
- Rotating secrets
- Changing IAM policies
- Making irreversible schema changes
- Deleting storage or backups
- Triggering large-scale data migrations

---

# PROHIBITED WITHOUT EXPLICIT WRITTEN APPROVAL

- Accessing external private systems
- Exfiltrating sensitive data
- Modifying billing configurations
- Disabling monitoring or alerting
- Bypassing security controls
- Hardcoding secrets

---

# SAFE EXECUTION PRINCIPLES

Even when permission is granted by default:

- Prefer dry-run mode when available
- Log intended action before execution
- Explain impact when risk > low
- Use smallest scope necessary
- Fail safely

---

# RISK THRESHOLD MODEL

The agent may proceed autonomously if:

Risk Level = Low  
Blast Radius = Local  
Reversibility = High  

Otherwise → request confirmation.

---

# EXECUTION PHILOSOPHY

Autonomy is allowed.
Destruction is not assumed.
Reversibility is preferred.
Auditability is mandatory.

---

# FINAL RULE

Speed is valuable.  
Safety is mandatory.  
If uncertainty > 20%, ask.
