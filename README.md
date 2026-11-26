# Clinic appointment data model

This design uses MongoDB for a clinic appointment portal and defines two collections:

- `patients`: minimal contact information and an active flag.
- `appointments`: scheduling metadata linked to a patient and a clinician.

The runnable schema and index setup is in [`mongo/setup.js`](./mongo/setup.js).

## Setup

Requirements: MongoDB 6.0+ and `mongosh`.

Start a local MongoDB server, then run:

```powershell
mongosh "mongodb://127.0.0.1:27017" --file mongo\setup.js
```

The script targets the `clinic_portal` database. It creates the collections with strict validators, or applies the validators to existing collections, and creates the two appointment indexes. Run it using a database account with permission to create/modify collections and indexes.

## Schema and relationship decisions

Patient documents contain only a preferred name and E.164 phone number needed for booking and contact. `active` supports deactivation without deleting a record that may have appointment history. Appointment documents store `patientId` and `clinicianId` as ObjectId references rather than embedding patient details, avoiding duplicated contact data and reducing its exposure in appointment reads.

MongoDB has no built-in foreign keys: the application must confirm that the referenced patient and clinician exist and that the patient is active when booking. The validators enforce BSON types, required fields, allowed appointment statuses, bounded names, and phone format; `additionalProperties: false` rejects accidental extra fields such as free-text clinical notes. Application logic must additionally enforce `startAt < endAt`, authorization, and any scheduling/overlap rules.

Keep authentication and authorization enabled, use least-privilege database credentials and TLS, and avoid logging patient documents or contact details. Define retention and access policies for the clinic's applicable privacy requirements; schema validation alone is not a privacy or authorization control.

## Indexes

1. `{ patientId: 1, startAt: -1 }` (`patient_appointment_history`) improves a patient's appointment-history query, e.g. `find({ patientId }).sort({ startAt: -1 })`. The patient equality prefix also scopes the descending time order. The trade-off is additional storage and write cost for each appointment, and queries without `patientId` cannot efficiently use this index for time ordering.
2. `{ clinicianId: 1, status: 1, startAt: 1 }` (`clinician_schedule_by_status_and_time`) improves schedule lookups such as `find({ clinicianId, status: "booked", startAt: { $gte: from, $lt: to } }).sort({ startAt: 1 })`. Equality keys precede the time range. The trade-off is extra index maintenance/storage and that the index is optimized for the clinician-and-status prefix, not general time-only queries. It does not by itself prevent overlapping bookings.

## Movie discovery Express prototype

The Express prototype in [`app.js`](./app.js) is independent of the clinic MongoDB example above. It uses an in-memory sample catalog and watchlists; restarting the process resets watchlist changes. It demonstrates recommendation ranking, discovery filters, watchlist writes, request-ID/logging middleware, input validation, and centralized JSON errors.

### Setup and tests

Requirements: Node.js 18+ and npm.

```powershell
npm install
npm test
npm start
```

The API listens on port 3000 by default; set `PORT` to choose another port. Tests use Node's built-in test runner and exercise actual HTTP requests against an ephemeral local port.

### Routes and assumptions

- `GET /api/movies` supports `genre` (lowercase slug), `year` (1888-2100), `minRating` (0-10, one decimal place maximum), and `watchlistId`. Unknown/repeated filters are rejected. Results are filtered first, then ranked by a demo score: 75% catalog rating and 25% normalized popularity.
- `POST /api/watchlists/:watchlistId/movies` accepts exactly `{ "movieId": "m1" }`. A watchlist is created when a movie is first added; duplicate additions return `409`.
- The catalog, ratings, popularity values, and watchlists are demonstration fixtures, not production recommendation signals or persistent/user-owned data. Authentication, authorization, a database, pagination, and production-grade ranking are intentionally out of scope.

The request-ID middleware assigns each request a UUID in `X-Request-Id` and logs the ID, method, path, status, and duration without logging query values or bodies. The centralized error handler gives clients a consistent JSON error and request ID; unexpected failures are logged and returned as a generic `500`.

### Request examples

Valid discovery/filter request:

```powershell
curl.exe "http://localhost:3000/api/movies?genre=drama&minRating=7.5"
```

Valid watchlist write:

```powershell
curl.exe -X POST "http://localhost:3000/api/watchlists/weekend/movies" -H "Content-Type: application/json" -d "{\"movieId\":\"m1\"}"
```

Invalid request (`minRating` is above the allowed maximum) returns `400` with a JSON error and `X-Request-Id`:

```powershell
curl.exe -i "http://localhost:3000/api/movies?minRating=11"
```

The focused failure case is an out-of-range rating filter. The HTTP test asserts the `400`, validation message, and matching response/header request ID. The test suite also verifies a valid ranked filter, watchlist addition/filtering, invalid watchlist input, and request logging.
