# Recipe Planning App: Authentication & Authorization (JWT)

A production-grade authentication and authorization prototype for a **Recipe Planning & Grocery List Management** service.

The implementation specifically models:
1. **Ingredient Substitutions**: Members can customize substitutions in their private grocery lists (e.g. replacing buttermilk with milk + lemon juice, or heavy cream with coconut cream); master substitutions can only be curated by verified `chef` roles.
2. **Grocery Lists**: Private grocery lists tied to individual member accounts, protected by ownership checks (IDOR protection).
3. **JWT Authentication & Authorization Flow**: Secure login, password hashing with salt, token expiration, role-based access control (RBAC), and resource ownership verification.

---

## Architecture & Endpoints

| Method | Endpoint | Protection | Description |
|---|---|---|---|
| `POST` | `/api/auth/login` | Public | Validates email/password against salted PBKDF2 hash, issues signed JWT (1-hour expiry). |
| `GET` | `/api/grocery-lists/:listId` | Authenticated + Ownership / Chef | Fetches grocery list with ingredients and substitutions. Restricted to list owner or `chef` role. |
| `POST` | `/api/grocery-lists/:listId/substitute` | Authenticated + Owner Only | Replaces or substitutes an ingredient in the user's personal grocery list. |
| `POST` | `/api/substitutions/curate` | Authenticated + Role: `chef` | Adds a verified culinary ingredient substitution to the global master catalog. |

---

## Implementation Details

### 1. Password Hashing
- File: [`src/recipeAuthUtils.js`](./src/recipeAuthUtils.js)
- Implemented using **PBKDF2** with a 16-byte cryptographically secure random salt, 100,000 iterations, and SHA-512 digest (`crypto.pbkdf2Sync`).
- Verification uses `crypto.timingSafeEqual` to eliminate timing attacks.

### 2. JWT Generation & Expiry
- Standard HMAC SHA-256 (`HS256`) signed tokens.
- **Never commits secrets**: Loaded exclusively from `process.env.JWT_SECRET`. Falls back to an isolated ephemeral string strictly during non-production automated testing.
- Configured default token lifetime of 3600 seconds (`exp = iat + 3600`).
- Validates token signature with constant-time equality check and rejects tokens where `exp < now`.

### 3. Role & Ownership Checks
- **Role Check** (`requireRole(['chef'])`): Validates that `req.user.role` matches required roles before allowing mutations to global culinary data.
- **Ownership Check** (`requireListOwnershipOrChef`): Verifies `req.user.id === groceryList.ownerId` before allowing read or mutation of grocery lists, preventing Insecure Direct Object References (IDOR). Certified chefs can read lists for culinary guidance but cannot tamper with a user's items.

---

## Edge Case Demonstrations

### Edge Case 1: Token Expiration (`401 TOKEN_EXPIRED`)
- When a user's session token crosses the `exp` timestamp, the auth middleware catches it and immediately returns a clean, structured `401` response:
```json
{
  "success": false,
  "error": {
    "code": "TOKEN_EXPIRED",
    "message": "Authentication token has expired. Please log in again."
  }
}
```
*Tested in test #10: A token issued with negative validity (`-10s`) is rejected.*

### Edge Case 2: Tampered Token Signature / Privilege Escalation (`401 INVALID_TOKEN`)
- If an attacker tampers with the base64url payload to escalate their role from `member` to `chef`, the signature check fails via `timingSafeEqual`:
```json
{
  "success": false,
  "error": {
    "code": "INVALID_TOKEN",
    "message": "Token signature or structure is invalid."
  }
}
```
*Tested in test #11: Alice's valid token payload modified to `role: "chef"` fails signature verification.*

### Edge Case 3: Insecure Direct Object Reference (IDOR) (`403 FORBIDDEN_RESOURCE`)
- If User A (Alice) attempts to view or mutate User B's (Bob) grocery list (`/api/grocery-lists/list-102`), the ownership check blocks it with `403 FORBIDDEN_RESOURCE`.

---

## Threat Note

1. **Secret Storage & Leakage (CWE-798)**:
   - *Threat*: Hardcoding JWT signing keys in code or source control allows attackers to forge administrative tokens (`role: 'chef'`) and take over all user accounts.
   - *Mitigation*: The app reads `process.env.JWT_SECRET`. In production, this must be injected via a secret manager (e.g. AWS Secrets Manager, GCP Secret Manager, or Doppler) and rotated periodically.
2. **Cross-User Data Access (IDOR / BOLA - OWASP API1:2023)**:
   - *Threat*: In recipe planning and grocery lists, guessing sequential list IDs (`list-101`, `list-102`) could expose personal dietary restrictions, allergies, and household items.
   - *Mitigation*: The `requireListOwnershipOrChef` middleware inspects the resource owner ID against `req.user.id` on every operation.
3. **Client-Side Token Storage**:
   - *Threat*: Storing JWTs in browser `localStorage` exposes them to Cross-Site Scripting (XSS) extraction.
   - *Mitigation*: For web frontends, tokens should be transported via `HttpOnly`, `Secure`, `SameSite=Strict` cookies with CSRF protection, or in-memory state with short lifetimes.

---

## Running Automated Tests

Run the test suite with:
```powershell
npm test
```

### Verified Test Output
```text
> recipe-planning-auth@1.0.0 test
> node test/recipe-auth.test.js

--- Recipe App Authentication & Authorization Test Suite ---

✔ Passed: Valid login returns JWT with 1h expiry
✔ Passed: Login rejects incorrect password (401 INVALID_CREDENTIALS)
✔ Passed: Protected route rejects missing token (401 UNAUTHORIZED)
✔ Passed: Owner accesses own grocery list (200 OK)
✔ Passed: Ownership check blocks cross-account access (403 FORBIDDEN_RESOURCE)
✔ Passed: Chef role can inspect grocery list for culinary advice (200 OK)
✔ Passed: Member role blocked from curating master substitutions (403 FORBIDDEN_ROLE)
✔ Passed: Chef role successfully curates master substitutions (201 Created)
✔ Passed: Member adds substitution to own grocery list (201 Created)
✔ Passed (Edge Case): Expired JWT token strictly rejected (401 TOKEN_EXPIRED)
✔ Passed (Edge Case): Tampered token signature fails verification (401 INVALID_TOKEN)

All 11 test scenarios passed successfully!
```
