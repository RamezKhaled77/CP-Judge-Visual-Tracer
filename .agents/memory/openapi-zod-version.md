---
name: OpenAPI integer schema compatibility
description: A generator/runtime mismatch affects integer fields in generated Zod output.
---

The current Orval/Zod workspace combination emits `zod.int()` for OpenAPI integer fields, but the installed Zod runtime does not expose that method.

**Why:** Code generation succeeds but the required library typecheck fails afterward, blocking the frontend client build.

**How to apply:** For new API contracts in this workspace, prefer numeric schemas unless the generator/runtime versions are upgraded together and verified.