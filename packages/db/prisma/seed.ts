import {
  PrismaClient, UserRole, UserStatus, Gender, BloodGroup, Genotype,
  RelationshipType, PermissionScope, EncounterClass, EncounterStatus,
  PrescriptionStatus, RefillRequestStatus, TestResultStatus,
  NotificationChannel, NotificationStatus,
} from '@prisma/client';
import { hashPassword as sharedHashPassword } from '@kincare/shared';

const prisma = new PrismaClient();

const PEPPER = process.env.PASSWORD_PEPPER ?? '';
const TENANT = 'default';
const PASSWORD = 'ChangeMe!2026';

function hashPassword(password: string): string {
  return sharedHashPassword(password, PEPPER);
}

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);
const hoursAgo = (n: number) => new Date(Date.now() - n * 3_600_000);

async function main() {
  console.log('🌱 Seeding Kincare database…');

  // Default tenant — every existing row references this id by default.
  await prisma.tenant.upsert({
    where: { id: TENANT },
    update: {},
    create: { id: TENANT, slug: TENANT, name: 'Default Hospital' },
  });

  const superAdmin = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: TENANT, email: 'admin@kincare.health' } },
    update: { passwordHash: hashPassword(PASSWORD), failedLoginCount: 0, lockedUntil: null },
    create: {
      email: 'admin@kincare.health',
      passwordHash: hashPassword(PASSWORD),
      role: UserRole.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
      firstName: 'System',
      lastName: 'Administrator',
      emailVerifiedAt: new Date(),
    },
  });

  const doctorUser = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: TENANT, email: 'doctor@kincare.health' } },
    update: { passwordHash: hashPassword(PASSWORD), failedLoginCount: 0, lockedUntil: null },
    create: {
      email: 'doctor@kincare.health',
      passwordHash: hashPassword(PASSWORD),
      role: UserRole.DOCTOR,
      status: UserStatus.ACTIVE,
      firstName: 'Ada',
      lastName: 'Okeke',
      emailVerifiedAt: new Date(),
      practitioner: {
        create: {
          licenseNumber: 'MDCN-000001',
          specialty: 'Internal Medicine',
          department: 'General Medicine',
        },
      },
    },
    include: { practitioner: true },
  });

  const cardiologistUser = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: TENANT, email: 'cardio@kincare.health' } },
    update: { passwordHash: hashPassword(PASSWORD) },
    create: {
      email: 'cardio@kincare.health',
      passwordHash: hashPassword(PASSWORD),
      role: UserRole.DOCTOR,
      status: UserStatus.ACTIVE,
      firstName: 'Chinedu',
      lastName: 'Eze',
      emailVerifiedAt: new Date(),
      practitioner: {
        create: {
          licenseNumber: 'MDCN-000002',
          specialty: 'Cardiology',
          department: 'Cardiology',
        },
      },
    },
    include: { practitioner: true },
  });

  const nurseUser = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: TENANT, email: 'nurse@kincare.health' } },
    update: { passwordHash: hashPassword(PASSWORD) },
    create: {
      email: 'nurse@kincare.health',
      passwordHash: hashPassword(PASSWORD),
      role: UserRole.NURSE,
      status: UserStatus.ACTIVE,
      firstName: 'Grace',
      lastName: 'Adeyemi',
      emailVerifiedAt: new Date(),
      practitioner: {
        create: {
          licenseNumber: 'NMCN-000010',
          specialty: 'Registered Nurse',
          department: 'General Medicine',
        },
      },
    },
    include: { practitioner: true },
  });

  const pharmacistUser = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: TENANT, email: 'pharmacist@kincare.health' } },
    update: { passwordHash: hashPassword(PASSWORD) },
    create: {
      email: 'pharmacist@kincare.health',
      passwordHash: hashPassword(PASSWORD),
      role: UserRole.PHARMACIST,
      status: UserStatus.ACTIVE,
      firstName: 'Tunde',
      lastName: 'Bello',
      emailVerifiedAt: new Date(),
    },
  });

  const patientUser = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: TENANT, email: 'patient@kincare.health' } },
    update: { passwordHash: hashPassword(PASSWORD), failedLoginCount: 0, lockedUntil: null },
    create: {
      email: 'patient@kincare.health',
      passwordHash: hashPassword(PASSWORD),
      role: UserRole.PATIENT,
      status: UserStatus.ACTIVE,
      firstName: 'John',
      lastName: 'Doe',
      emailVerifiedAt: new Date(),
      patientProfile: {
        create: {
          mrn: 'MRN-000001',
          dateOfBirth: new Date('1990-01-01'),
          gender: Gender.MALE,
          bloodGroup: BloodGroup.O_POS,
          genotype: Genotype.AA,
        },
      },
    },
    include: { patientProfile: true },
  });

  const patient2User = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: TENANT, email: 'mary@kincare.health' } },
    update: { passwordHash: hashPassword(PASSWORD) },
    create: {
      email: 'mary@kincare.health',
      passwordHash: hashPassword(PASSWORD),
      role: UserRole.PATIENT,
      status: UserStatus.ACTIVE,
      firstName: 'Mary',
      lastName: 'Doe',
      emailVerifiedAt: new Date(),
      patientProfile: {
        create: {
          mrn: 'MRN-000002',
          dateOfBirth: new Date('1992-04-15'),
          gender: Gender.FEMALE,
          bloodGroup: BloodGroup.A_POS,
          genotype: Genotype.AS,
        },
      },
    },
    include: { patientProfile: true },
  });

  const familyUser = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: TENANT, email: 'family@kincare.health' } },
    update: { passwordHash: hashPassword(PASSWORD) },
    create: {
      email: 'family@kincare.health',
      passwordHash: hashPassword(PASSWORD),
      role: UserRole.FAMILY_DELEGATE,
      status: UserStatus.ACTIVE,
      firstName: 'Jane',
      lastName: 'Doe',
      emailVerifiedAt: new Date(),
    },
  });

  const johnPatient = patientUser.patientProfile!;
  const maryPatient = patient2User.patientProfile!;
  const doctor = doctorUser.practitioner!;
  const cardiologist = cardiologistUser.practitioner!;
  const nurse = nurseUser.practitioner!;

  // ── Family relationship + permission grants (Jane delegates for John) ──
  const relationship = await prisma.familyRelationship.upsert({
    where: { patientUserId_delegateUserId: { patientUserId: patientUser.id, delegateUserId: familyUser.id } },
    update: {},
    create: {
      patientUserId: patientUser.id,
      delegateUserId: familyUser.id,
      relation: RelationshipType.SPOUSE,
      isPrimary: true,
    },
  });

  const grantScopes: PermissionScope[] = [
    PermissionScope.VIEW_DEMOGRAPHICS,
    PermissionScope.VIEW_MEDICAL_HISTORY,
    PermissionScope.VIEW_PRESCRIPTIONS,
    PermissionScope.REQUEST_REFILL,
    PermissionScope.AUTHORIZE_PICKUP,
    PermissionScope.VIEW_TEST_RESULTS,
    PermissionScope.RECEIVE_PROGRESS_UPDATES,
  ];
  for (const scope of grantScopes) {
    await prisma.permissionGrant.upsert({
      where: { relationshipId_scope: { relationshipId: relationship.id, scope } },
      update: {},
      create: {
        relationshipId: relationship.id,
        grantorUserId: patientUser.id,
        granteeUserId: familyUser.id,
        scope,
      },
    });
  }

  // ── Idempotency guard for clinical history (only seed once per patient) ──
  const existingEncounters = await prisma.encounter.count({ where: { patientId: johnPatient.id } });
  if (existingEncounters === 0) {
    // Emergency contacts
    await prisma.emergencyContact.createMany({
      data: [
        { patientId: johnPatient.id, name: 'Jane Doe', relation: RelationshipType.SPOUSE, phone: '+2348012345678', email: 'family@kincare.health', priority: 1 },
        { patientId: johnPatient.id, name: 'Peter Doe', relation: RelationshipType.PARENT, phone: '+2348087654321', priority: 2 },
      ],
    });

    // Allergies
    await prisma.allergyIntolerance.createMany({
      data: [
        { patientId: johnPatient.id, substance: 'Penicillin', reaction: 'Hives, rash', severity: 'moderate' },
        { patientId: johnPatient.id, substance: 'Peanuts', reaction: 'Anaphylaxis', severity: 'severe' },
      ],
    });

    // Conditions
    await prisma.condition.createMany({
      data: [
        { patientId: johnPatient.id, recordedById: doctor.id, code: 'I10', display: 'Essential hypertension', clinicalStatus: 'active', onsetDate: daysAgo(400) },
        { patientId: johnPatient.id, recordedById: doctor.id, code: 'E11.9', display: 'Type 2 diabetes mellitus', clinicalStatus: 'active', onsetDate: daysAgo(700) },
        { patientId: johnPatient.id, recordedById: doctor.id, code: 'J45.909', display: 'Asthma, unspecified', clinicalStatus: 'inactive', onsetDate: daysAgo(2000), abatementDate: daysAgo(400) },
      ],
    });

    // Immunizations
    await prisma.immunization.createMany({
      data: [
        { patientId: johnPatient.id, vaccineCode: '208', vaccineName: 'COVID-19 mRNA', administeredAt: daysAgo(120), doseNumber: 3, lotNumber: 'PF-A1B2' },
        { patientId: johnPatient.id, vaccineCode: '141', vaccineName: 'Influenza, seasonal', administeredAt: daysAgo(60), doseNumber: 1 },
        { patientId: johnPatient.id, vaccineCode: '113', vaccineName: 'Tdap', administeredAt: daysAgo(900), doseNumber: 1 },
      ],
    });

    // Care team
    await prisma.careTeamMember.createMany({
      data: [
        { patientId: johnPatient.id, practitionerId: doctor.id, role: 'primary-care' },
        { patientId: johnPatient.id, practitionerId: cardiologist.id, role: 'consulting' },
        { patientId: johnPatient.id, practitionerId: nurse.id, role: 'nursing' },
      ],
    });

    // ── Encounter 1: routine visit 30 days ago (FINISHED) ──
    const enc1 = await prisma.encounter.create({
      data: {
        patientId: johnPatient.id,
        practitionerId: doctor.id,
        class: EncounterClass.AMBULATORY,
        status: EncounterStatus.FINISHED,
        reasonCode: 'Z00.00',
        reasonText: 'General adult medical exam',
        startAt: daysAgo(30),
        endAt: daysAgo(30),
        location: 'GenMed Clinic Room 3',
      },
    });

    // Vitals for enc1
    await prisma.observation.createMany({
      data: [
        { patientId: johnPatient.id, encounterId: enc1.id, performedById: nurse.id, code: '8480-6', display: 'Systolic BP', category: 'vital-signs', valueNumeric: 142, unit: 'mmHg', referenceLow: 90, referenceHigh: 120, effectiveAt: daysAgo(30) },
        { patientId: johnPatient.id, encounterId: enc1.id, performedById: nurse.id, code: '8462-4', display: 'Diastolic BP', category: 'vital-signs', valueNumeric: 92, unit: 'mmHg', referenceLow: 60, referenceHigh: 80, effectiveAt: daysAgo(30) },
        { patientId: johnPatient.id, encounterId: enc1.id, performedById: nurse.id, code: '8867-4', display: 'Heart rate', category: 'vital-signs', valueNumeric: 78, unit: 'bpm', referenceLow: 60, referenceHigh: 100, effectiveAt: daysAgo(30) },
        { patientId: johnPatient.id, encounterId: enc1.id, performedById: nurse.id, code: '8310-5', display: 'Body temperature', category: 'vital-signs', valueNumeric: 36.7, unit: 'Cel', referenceLow: 36.1, referenceHigh: 37.2, effectiveAt: daysAgo(30) },
        { patientId: johnPatient.id, encounterId: enc1.id, performedById: nurse.id, code: '29463-7', display: 'Body weight', category: 'vital-signs', valueNumeric: 84.5, unit: 'kg', effectiveAt: daysAgo(30) },
      ],
    });

    // Diagnostic report + lab results from enc1
    const cbcReport = await prisma.diagnosticReport.create({
      data: {
        patientId: johnPatient.id,
        encounterId: enc1.id,
        authorId: doctor.id,
        code: '58410-2',
        display: 'Complete blood count (CBC) panel',
        category: 'laboratory',
        status: TestResultStatus.FINAL,
        conclusion: 'All values within normal limits.',
        issuedAt: daysAgo(29),
      },
    });
    await prisma.testResult.createMany({
      data: [
        { patientId: johnPatient.id, reportId: cbcReport.id, testName: 'Hemoglobin', testCode: '718-7', resultValue: '14.2', unit: 'g/dL', referenceRange: '13.5-17.5', status: TestResultStatus.FINAL, performedAt: daysAgo(29) },
        { patientId: johnPatient.id, reportId: cbcReport.id, testName: 'White blood cells', testCode: '6690-2', resultValue: '6.8', unit: '10^9/L', referenceRange: '4.0-11.0', status: TestResultStatus.FINAL, performedAt: daysAgo(29) },
        { patientId: johnPatient.id, reportId: cbcReport.id, testName: 'Platelets', testCode: '777-3', resultValue: '245', unit: '10^9/L', referenceRange: '150-400', status: TestResultStatus.FINAL, performedAt: daysAgo(29) },
      ],
    });

    const lipidReport = await prisma.diagnosticReport.create({
      data: {
        patientId: johnPatient.id,
        encounterId: enc1.id,
        authorId: cardiologist.id,
        code: '57698-3',
        display: 'Lipid panel',
        category: 'laboratory',
        status: TestResultStatus.FINAL,
        conclusion: 'LDL elevated. Recommend statin therapy and lifestyle modification.',
        issuedAt: daysAgo(28),
      },
    });
    await prisma.testResult.createMany({
      data: [
        { patientId: johnPatient.id, reportId: lipidReport.id, testName: 'Total Cholesterol', testCode: '2093-3', resultValue: '232', unit: 'mg/dL', referenceRange: '<200', flag: 'H', status: TestResultStatus.FINAL, performedAt: daysAgo(28) },
        { patientId: johnPatient.id, reportId: lipidReport.id, testName: 'LDL', testCode: '2089-1', resultValue: '161', unit: 'mg/dL', referenceRange: '<100', flag: 'H', status: TestResultStatus.FINAL, performedAt: daysAgo(28) },
        { patientId: johnPatient.id, reportId: lipidReport.id, testName: 'HDL', testCode: '2085-9', resultValue: '42', unit: 'mg/dL', referenceRange: '>40', status: TestResultStatus.FINAL, performedAt: daysAgo(28) },
        { patientId: johnPatient.id, reportId: lipidReport.id, testName: 'Triglycerides', testCode: '2571-8', resultValue: '178', unit: 'mg/dL', referenceRange: '<150', flag: 'H', status: TestResultStatus.FINAL, performedAt: daysAgo(28) },
      ],
    });

    // ── Encounter 2: cardiology follow-up 7 days ago ──
    const enc2 = await prisma.encounter.create({
      data: {
        patientId: johnPatient.id,
        practitionerId: cardiologist.id,
        class: EncounterClass.OUTPATIENT,
        status: EncounterStatus.FINISHED,
        reasonCode: 'I10',
        reasonText: 'Hypertension follow-up',
        startAt: daysAgo(7),
        endAt: daysAgo(7),
        location: 'Cardiology Suite',
      },
    });
    await prisma.procedure.create({
      data: {
        patientId: johnPatient.id,
        encounterId: enc2.id,
        performedById: cardiologist.id,
        code: '93000',
        display: 'Electrocardiogram, complete',
        performedAt: daysAgo(7),
        outcome: 'Normal sinus rhythm. No acute ST changes.',
      },
    });
    await prisma.observation.createMany({
      data: [
        { patientId: johnPatient.id, encounterId: enc2.id, performedById: cardiologist.id, code: '8480-6', display: 'Systolic BP', category: 'vital-signs', valueNumeric: 138, unit: 'mmHg', referenceLow: 90, referenceHigh: 120, effectiveAt: daysAgo(7) },
        { patientId: johnPatient.id, encounterId: enc2.id, performedById: cardiologist.id, code: '8462-4', display: 'Diastolic BP', category: 'vital-signs', valueNumeric: 88, unit: 'mmHg', referenceLow: 60, referenceHigh: 80, effectiveAt: daysAgo(7) },
      ],
    });

    // ── Prescriptions ──
    const rxLisinopril = await prisma.prescription.create({
      data: {
        patientId: johnPatient.id,
        prescriberId: cardiologist.id,
        encounterId: enc2.id,
        medicationCode: '314076',
        medicationName: 'Lisinopril 10 mg tablet',
        dosage: '10 mg',
        route: 'oral',
        frequency: 'once daily',
        durationDays: 90,
        quantity: 90,
        refillsAllowed: 3,
        refillsUsed: 1,
        status: PrescriptionStatus.ACTIVE,
        notes: 'Take in the morning. Monitor BP weekly.',
        prescribedAt: daysAgo(7),
        expiresAt: daysAgo(-300),
      },
    });

    await prisma.prescription.create({
      data: {
        patientId: johnPatient.id,
        prescriberId: doctor.id,
        encounterId: enc1.id,
        medicationCode: '860975',
        medicationName: 'Metformin 500 mg tablet',
        dosage: '500 mg',
        route: 'oral',
        frequency: 'twice daily',
        durationDays: 90,
        quantity: 180,
        refillsAllowed: 5,
        refillsUsed: 2,
        status: PrescriptionStatus.ACTIVE,
        notes: 'Take with meals.',
        prescribedAt: daysAgo(30),
        expiresAt: daysAgo(-330),
      },
    });

    await prisma.prescription.create({
      data: {
        patientId: johnPatient.id,
        prescriberId: cardiologist.id,
        encounterId: enc2.id,
        medicationCode: '617312',
        medicationName: 'Atorvastatin 20 mg tablet',
        dosage: '20 mg',
        route: 'oral',
        frequency: 'once daily at bedtime',
        durationDays: 90,
        quantity: 90,
        refillsAllowed: 3,
        refillsUsed: 0,
        status: PrescriptionStatus.ACTIVE,
        prescribedAt: daysAgo(7),
      },
    });

    // Pending refill requested by family delegate
    await prisma.prescriptionRefillRequest.create({
      data: {
        prescriptionId: rxLisinopril.id,
        patientId: johnPatient.id,
        requestedByUserId: familyUser.id,
        status: RefillRequestStatus.PENDING,
        notes: 'Almost out — please refill.',
      },
    });

    // ── Progress updates ──
    await prisma.progressUpdate.createMany({
      data: [
        { patientId: johnPatient.id, encounterId: enc1.id, authorId: doctor.id, category: 'STATUS', title: 'Annual exam complete', message: 'Routine exam completed. Labs ordered.', notifyFamily: true, createdAt: daysAgo(30) },
        { patientId: johnPatient.id, encounterId: enc2.id, authorId: cardiologist.id, category: 'STATUS', title: 'Cardiology follow-up', message: 'BP improving. Continue Lisinopril; started Atorvastatin for elevated LDL.', notifyFamily: true, createdAt: daysAgo(7) },
      ],
    });

    // ── In-app notifications for the patient and family ──
    await prisma.notification.createMany({
      data: [
        { userId: patientUser.id, channel: NotificationChannel.IN_APP, status: NotificationStatus.DELIVERED, subject: 'Lab results available', body: 'Your lipid panel results are ready to view.', sentAt: daysAgo(28) },
        { userId: patientUser.id, channel: NotificationChannel.IN_APP, status: NotificationStatus.DELIVERED, subject: 'New prescription', body: 'Atorvastatin 20 mg has been prescribed.', sentAt: daysAgo(7) },
        { userId: familyUser.id, channel: NotificationChannel.IN_APP, status: NotificationStatus.DELIVERED, subject: 'Progress update for John', body: 'Cardiology follow-up: BP improving.', sentAt: daysAgo(7) },
        { userId: patientUser.id, channel: NotificationChannel.IN_APP, status: NotificationStatus.QUEUED, subject: 'Refill request submitted', body: 'Jane requested a refill of Lisinopril 10 mg.', sentAt: hoursAgo(2) },
      ],
    });

    // ── A bit of history for Mary too (lighter touch) ──
    await prisma.allergyIntolerance.create({
      data: { patientId: maryPatient.id, substance: 'Sulfa drugs', reaction: 'Rash', severity: 'mild' },
    });
    await prisma.careTeamMember.create({
      data: { patientId: maryPatient.id, practitionerId: doctor.id, role: 'primary-care' },
    });
    const encMary = await prisma.encounter.create({
      data: {
        patientId: maryPatient.id,
        practitionerId: doctor.id,
        class: EncounterClass.AMBULATORY,
        status: EncounterStatus.FINISHED,
        reasonText: 'Wellness visit',
        startAt: daysAgo(14),
        endAt: daysAgo(14),
      },
    });
    await prisma.observation.createMany({
      data: [
        { patientId: maryPatient.id, encounterId: encMary.id, performedById: nurse.id, code: '8480-6', display: 'Systolic BP', category: 'vital-signs', valueNumeric: 118, unit: 'mmHg', effectiveAt: daysAgo(14) },
        { patientId: maryPatient.id, encounterId: encMary.id, performedById: nurse.id, code: '8462-4', display: 'Diastolic BP', category: 'vital-signs', valueNumeric: 76, unit: 'mmHg', effectiveAt: daysAgo(14) },
      ],
    });
  }

  console.log('✅ Seed complete');
  console.table([
    { role: 'SUPER_ADMIN', email: superAdmin.email },
    { role: 'DOCTOR (GP)', email: doctorUser.email },
    { role: 'DOCTOR (Cardio)', email: cardiologistUser.email },
    { role: 'NURSE', email: nurseUser.email },
    { role: 'PHARMACIST', email: pharmacistUser.email },
    { role: 'PATIENT', email: patientUser.email },
    { role: 'PATIENT', email: patient2User.email },
    { role: 'FAMILY_DELEGATE', email: familyUser.email },
  ]);
  console.log(`All passwords: ${PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

