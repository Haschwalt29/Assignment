const clinicDb = db.getSiblingDB("clinic_portal");

const patientValidator = {
  $jsonSchema: {
    bsonType: "object",
    required: ["preferredName", "phone", "active", "createdAt", "updatedAt"],
    additionalProperties: false,
    properties: {
      _id: { bsonType: "objectId" },
      preferredName: { bsonType: "string", minLength: 1, maxLength: 120 },
      phone: {
        bsonType: "string",
        pattern: "^\\+[1-9][0-9]{7,14}$",
        description: "Required phone number in E.164 format"
      },
      active: { bsonType: "bool" },
      createdAt: { bsonType: "date" },
      updatedAt: { bsonType: "date" }
    }
  }
};

const appointmentValidator = {
  $jsonSchema: {
    bsonType: "object",
    required: [
      "patientId",
      "clinicianId",
      "startAt",
      "endAt",
      "status",
      "createdAt",
      "updatedAt"
    ],
    additionalProperties: false,
    properties: {
      _id: { bsonType: "objectId" },
      patientId: { bsonType: "objectId" },
      clinicianId: { bsonType: "objectId" },
      startAt: { bsonType: "date" },
      endAt: { bsonType: "date" },
      status: {
        bsonType: "string",
        enum: ["booked", "cancelled", "completed", "no_show"]
      },
      createdAt: { bsonType: "date" },
      updatedAt: { bsonType: "date" }
    }
  }
};

function ensureValidatedCollection(name, validator) {
  const existing = clinicDb.getCollectionInfos({ name });

  if (existing.length === 0) {
    clinicDb.createCollection(name, {
      validator,
      validationLevel: "strict",
      validationAction: "error"
    });
    return;
  }

  assert.commandWorked(clinicDb.runCommand({
    collMod: name,
    validator,
    validationLevel: "strict",
    validationAction: "error"
  }));
}

ensureValidatedCollection("patients", patientValidator);
ensureValidatedCollection("appointments", appointmentValidator);

const appointments = clinicDb.collection("appointments");
appointments.createIndex(
  { patientId: 1, startAt: -1 },
  { name: "patient_appointment_history" }
);
appointments.createIndex(
  { clinicianId: 1, status: 1, startAt: 1 },
  { name: "clinician_schedule_by_status_and_time" }
);
