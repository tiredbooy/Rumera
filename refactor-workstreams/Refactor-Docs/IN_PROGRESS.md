# Active Refactor Task

**Workstream ID:** `gpt56-domain-refactor-20260713`
**Rule:** This file contains at most one active task.

## Task 060a - Align Admin Authorization, Users, Roles, And Permissions

**Started:** 2026-07-27

Resolve the backend `admin`-only middleware versus frontend
`admin`/`manager`/`support` mismatch before exposing controls. Replace static role
and member data with a supported, auditable backend contract and real user,
role/permission, status, and deletion operations.
