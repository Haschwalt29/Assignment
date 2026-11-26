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
