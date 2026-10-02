---
name: ptn-payroll-guidelines
description: Core execution rules and constraints for PTN Payroll and PTN Time
trigger: always_on
---

# PTN Payroll & PTN Time Project Guidelines

1. **Database Access Constraint**:
   - DO NOT run `wrangler d1 execute --remote`. It will fail with Error 7403 (unauthorized account).
   - To inspect database state or execute actions, make HTTP requests to the Production API:
     `https://master.ptn-payroll.pages.dev/api` with valid JSON payloads.

2. **Git & Sandbox Operations**:
   - Git operations (commit, push, lock management) in this repository must use `BypassSandbox: true`.
   - Deployment is triggered automatically via `git push origin master`.

3. **Shared Database & Architecture**:
   - PTN Payroll (`/Users/poolsak/Documents/Sarary`) and PTN Time (`/Users/poolsak/Documents/ptntime`) share the exact same Cloudflare D1 database (`ptn_payroll_db`).
   - When modifying schemas in `functions/api.js`, ensure compatibility with both applications.
