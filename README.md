# Library Lending System: Express Middleware, Validation & Error Handling

An Express API built specifically for a library lending system supporting **book availability checks**, **placing holds**, and **overdue reminder dispatches**.

The system demonstrates:
- **Custom Middleware**: Request ID generation and tracing (`X-Request-Id`) combined with structured JSON latency and access logging.
- **Route Input Validation**: Parameter and request body validation rejecting malformed inputs before reaching business logic.
- **Centralized Error Handling**: A unified four-argument Express error middleware (`(err, req, res, next)`) returning predictable, standardized JSON error responses.
- **Demonstration**: Suite of unit/integration tests and an interactive demonstration runner showcasing valid and invalid scenarios.

---

## Architecture & Endpoints

| Method | Endpoint | Description | Validation Highlights |
|---|---|---|---|
| `GET` | `/books/:bookId/availability` | Checks real-time stock, hold count, and checkout eligibility | `bookId` parameter format (`book-<id>`) |
| `POST` | `/holds` | Reserves a copy for a patron | `bookId`, `patronId` format, `pickupLocation` whitelist, duplicate hold checks |
| `POST` | `/reminders/overdue` | Triggers batch overdue reminder notices | `daysOverdueMin` (positive integer 1–365), `notificationChannel` (`email`, `sms`, `in-app`) |
| `GET` | `/health` | Health check probe | None |

---

## Design Decisions

1. **Request Tracking & Structured Logging Middleware**:
   - Every request is tagged with an `X-Request-Id` header. If a client forwards an `X-Request-Id` (e.g. from an API gateway), it is preserved; otherwise, a cryptographic UUID (`crypto.randomUUID()`) is generated.
   - The response completion event (`res.on('finish')`) measures nanosecond-precision execution duration and prints a structured JSON log entry containing timestamp, request ID, method, path, HTTP status, and duration.
   - The `requestId` is propagated into every successful and error JSON response body to enable end-to-end tracing.

2. **Layered Validation Middleware**:
   - Each route is protected by a dedicated validation middleware before business handlers execute.
   - Validation checks formats (e.g. `book-101`, `patron-42`), enum domains (e.g. allowed pickup locations, supported notification channels), and numeric ranges (`daysOverdueMin`).
   - If invalid, the validator stops execution and forwards a formatted error object to `next(err)` containing an HTTP `400` status, error code, and detailed field-by-field validation failure reasons.

3. **Centralized Error Handling**:
   - Single four-parameter error handling middleware `(err, req, res, next)` at the bottom of the middleware chain.
   - Handles operational business errors (400 Bad Request, 404 Not Found, 409 Conflict) and technical errors (malformed JSON syntax, 500 internal errors) identically.
   - Sanitizes production responses while logging structured error stacks for observability.

4. **In-Memory Lending Domain**:
   - Implements business logic including stock availability checks, hold queue management with priority ranking, duplicate hold rejection (409 Conflict), and overdue loan filtering based on loan due dates.

---

## Setup & Running

### Requirements
- Node.js `v18+` (tested on `v22.15.0`)
- Express 5.x (installed in dependencies)

### Installation
Dependencies are already configured. If needed:
```bash
npm install
```

### Run Server
```bash
npm start
```
The server will listen at `http://localhost:3000`.

### Run Automated Tests
```bash
npm test
```
Executes the 12 integration test scenarios verifying validation rules, error handling, custom middleware, and business constraints.

### Run Demonstration Script
```bash
npm run demo
```
Runs an end-to-end demonstration script executing valid and invalid requests against all endpoints with formatted console output.

---

## Valid and Invalid Request Demonstrations

### 1. Book Availability
#### Valid Request
```bash
curl -i -X GET http://localhost:3000/books/book-101/availability \
  -H "X-Request-Id: client-trace-001"
```
**Response (200 OK):**
```json
{
  "success": true,
  "requestId": "client-trace-001",
  "data": {
    "bookId": "book-101",
    "title": "Design Patterns",
    "author": "Gang of Four",
    "totalCopies": 3,
    "availableCopies": 2,
    "activeHoldCount": 0,
    "isAvailableForCheckout": true,
    "recommendation": "Available for immediate checkout."
  }
}
```

#### Invalid Request (Malformed Book ID)
```bash
curl -i -X GET http://localhost:3000/books/invalid!id/availability
```
**Response (400 Bad Request):**
```json
{
  "success": false,
  "requestId": "a9564214-f574-4d20-a338-9566babdbb61",
  "error": {
    "code": "INVALID_BOOK_ID",
    "message": "Invalid or missing 'bookId' parameter. Expected format: 'book-<id>' (e.g. 'book-101')."
  }
}
```

---

### 2. Place Hold
#### Valid Request
```bash
curl -i -X POST http://localhost:3000/holds \
  -H "Content-Type: application/json" \
  -d '{
    "bookId": "book-102",
    "patronId": "patron-202",
    "pickupLocation": "Curbside Locker"
  }'
```
**Response (201 Created):**
```json
{
  "success": true,
  "requestId": "fd201c13-8321-4716-a8cd-7349b408f9e9",
  "message": "Hold placed successfully.",
  "data": {
    "holdId": "hold-1795761225837",
    "bookTitle": "Clean Architecture",
    "patronId": "patron-202",
    "pickupLocation": "Curbside Locker",
    "queuePosition": 2,
    "createdAt": "2026-11-27T06:33:45.837Z"
  }
}
```

#### Invalid Request (Validation Failures)
```bash
curl -i -X POST http://localhost:3000/holds \
  -H "Content-Type: application/json" \
  -d '{
    "bookId": "invalid-book-code",
    "patronId": "",
    "pickupLocation": "Downtown Coffee Shop"
  }'
```
**Response (400 Bad Request):**
```json
{
  "success": false,
  "requestId": "cec8a270-ded9-4ff5-8720-330fb4672c8e",
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed for hold request.",
    "details": [
      { "field": "bookId", "message": "Must be a valid book ID string in format 'book-<id>'." },
      { "field": "patronId", "message": "Must be a valid patron ID string in format 'patron-<id>'." },
      { "field": "pickupLocation", "message": "Must be one of the permitted pickup locations: Main Desk, North Branch, South Branch, Curbside Locker." }
    ]
  }
}
```

#### Duplicate Hold Conflict
```bash
curl -i -X POST http://localhost:3000/holds \
  -H "Content-Type: application/json" \
  -d '{
    "bookId": "book-102",
    "patronId": "patron-202",
    "pickupLocation": "Curbside Locker"
  }'
```
**Response (409 Conflict):**
```json
{
  "success": false,
  "requestId": "3387afb3-b6ff-474a-8731-0dc5b879f377",
  "error": {
    "code": "HOLD_ALREADY_EXISTS",
    "message": "Patron 'patron-202' already has an active hold for 'book-102'.",
    "details": {
      "existingHoldId": "hold-1795761225837",
      "queuePosition": 2
    }
  }
}
```

---

### 3. Overdue Reminders
#### Valid Request
```bash
curl -i -X POST http://localhost:3000/reminders/overdue \
  -H "Content-Type: application/json" \
  -d '{
    "daysOverdueMin": 5,
    "notificationChannel": "email"
  }'
```
**Response (200 OK):**
```json
{
  "success": true,
  "requestId": "a632785e-e454-499e-a0a2-58b0c6788bbd",
  "message": "Overdue reminders dispatched to 2 patron(s).",
  "data": {
    "criteria": {
      "daysOverdueMin": 5,
      "notificationChannel": "email",
      "evaluatedAt": "2026-11-27T12:00:00.000Z"
    },
    "dispatchedCount": 2,
    "dispatchedReminders": [
      {
        "loanId": "loan-1",
        "patronId": "patron-12",
        "patronEmail": "patron12@example.com",
        "daysOverdue": 12,
        "channel": "email",
        "reminderSequence": 2,
        "dispatchedAt": "2026-11-27T12:00:00.000Z"
      },
      {
        "loanId": "loan-2",
        "patronId": "patron-34",
        "patronEmail": "patron34@example.com",
        "daysOverdue": 7,
        "channel": "email",
        "reminderSequence": 1,
        "dispatchedAt": "2026-11-27T12:00:00.000Z"
      }
    ]
  }
}
```

#### Invalid Request
```bash
curl -i -X POST http://localhost:3000/reminders/overdue \
  -H "Content-Type: application/json" \
  -d '{
    "daysOverdueMin": -2,
    "notificationChannel": "fax"
  }'
```
**Response (400 Bad Request):**
```json
{
  "success": false,
  "requestId": "cb7ecceb-d70a-4ad2-81b2-3f15711af053",
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed for overdue reminder dispatch.",
    "details": [
      { "field": "daysOverdueMin", "message": "Must be an integer between 1 and 365." },
      { "field": "notificationChannel", "message": "Must be one of allowed notification channels: email, sms, in-app." }
    ]
  }
}
```
