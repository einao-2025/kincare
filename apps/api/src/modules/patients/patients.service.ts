import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { decryptField, encryptField, generateMRN, hashPassword, Permissions, type AuthPrincipal, Roles } from '@kincare/shared';
import { UserRole, UserStatus } from '@kincare/db';
import { PrismaService } from '../../common/prisma/prisma.module';
import type {
  CreateAllergyDto, CreateConditionDto, CreateEmergencyContactDto, CreatePatientDto, UpdatePatientProfileDto,
} from './dto';

@Injectable()
export class PatientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cfg: ConfigService,
  ) {}

  private get phiKey(): string { return this.cfg.getOrThrow('PHI_ENCRYPTION_KEY'); }

  /**
   * Admin-driven patient account provisioning. Creates a User + PatientProfile
   * in the acting admin's tenant using either the supplied password or the
   * configured `PATIENT_DEFAULT_PASSWORD`. The plaintext password used is
   * returned so the admin can deliver it to the patient out-of-band; the
   * patient should rotate it on first login.
   */
  async createPatient(dto: CreatePatientDto, actor: AuthPrincipal) {
    const admin = await this.prisma.user.findUniqueOrThrow({
      where: { id: actor.userId }, select: { tenantId: true },
    });
    const tenantId = admin.tenantId;
    const email = dto.email.toLowerCase();

    const existing = await this.prisma.user.findUnique({
      where: { tenantId_email: { tenantId, email } },
    });
    if (existing) throw new ConflictException('Email already registered');

    const password = dto.password ?? this.cfg.get<string>('PATIENT_DEFAULT_PASSWORD') ?? 'ChangeMe!1234';
    const passwordHash = hashPassword(password, this.cfg.get<string>('PASSWORD_PEPPER') ?? '');
    const seq = (await this.prisma.patientProfile.count({ where: { tenantId } })) + 1;

    const user = await this.prisma.user.create({
      data: {
        tenantId,
        email,
        phone: dto.phone,
        firstName: dto.firstName,
        lastName: dto.lastName,
        passwordHash,
        role: UserRole.PATIENT,
        status: UserStatus.PENDING_VERIFICATION,
        createdById: actor.userId,
        patientProfile: {
          create: {
            tenantId,
            mrn: generateMRN(seq),
            dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : new Date('1970-01-01'),
            gender: dto.gender,
          },
        },
      },
      include: { patientProfile: { select: { id: true, mrn: true } } },
    });

    return {
      id: user.patientProfile!.id,
      userId: user.id,
      mrn: user.patientProfile!.mrn,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      defaultPassword: password,
      passwordSource: dto.password ? ('custom' as const) : ('default' as const),
    };
  }

  /**
   * Resolves a patientProfile id from either:
   *   - "me" (the current patient)
   *   - an explicit profile id (requires staff role or a delegate grant)
   */
  async resolvePatientId(idOrMe: string, actor: AuthPrincipal, requiredScope?: string): Promise<string> {
    if (idOrMe === 'me') {
      const profile = await this.prisma.patientProfile.findUnique({ where: { userId: actor.userId } });
      if (!profile) throw new NotFoundException('No patient profile for current user');
      return profile.id;
    }
    const profile = await this.prisma.patientProfile.findUnique({
      where: { id: idOrMe }, select: { id: true, userId: true, deletedAt: true },
    });
    if (!profile || profile.deletedAt) throw new NotFoundException('Patient not found');

    // Patient can always access own.
    if (profile.userId === actor.userId) return profile.id;

    // Staff with PATIENT_READ_ANY (or stronger).
    if (actor.permissions.includes(Permissions.PATIENT_READ_ANY)) return profile.id;

    // Family delegate path — must hold an active grant of `requiredScope`.
    if (actor.role === Roles.FAMILY_DELEGATE && requiredScope) {
      const grant = await this.prisma.permissionGrant.findFirst({
        where: {
          granteeUserId: actor.userId,
          scope: requiredScope as never,
          revokedAt: null,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
          relationship: { patientUserId: profile.userId, revokedAt: null },
        },
      });
      if (grant) return profile.id;
    }
    throw new ForbiddenException('No access to this patient');
  }

  /**
   * Staff-only patient search. Matches against MRN (prefix) and the
   * unencrypted user.firstName/lastName/email fields. PHI-encrypted columns
   * (address, national id) are intentionally not searchable.
   */
  async search(query: string, take = 20) {
    const q = query.trim();
    const where = q
      ? {
          deletedAt: null,
          OR: [
            { mrn: { startsWith: q, mode: 'insensitive' as const } },
            { user: { firstName: { contains: q, mode: 'insensitive' as const } } },
            { user: { lastName:  { contains: q, mode: 'insensitive' as const } } },
            { user: { email:     { contains: q, mode: 'insensitive' as const } } },
          ],
        }
      : { deletedAt: null };

    const rows = await this.prisma.patientProfile.findMany({
      where,
      take,
      orderBy: [{ user: { lastName: 'asc' } }, { user: { firstName: 'asc' } }],
      select: {
        id: true,
        mrn: true,
        dateOfBirth: true,
        gender: true,
        user: { select: { firstName: true, lastName: true, email: true } },
      },
    });
    return rows;
  }

  async getProfile(patientId: string) {
    const p = await this.prisma.patientProfile.findUniqueOrThrow({
      where: { id: patientId },
      include: { user: { select: { id: true, email: true, phone: true, firstName: true, lastName: true } } },
    });
    const dec = (s?: string | null) => (s ? decryptField(s, this.phiKey) : null);
    return {
      id: p.id,
      mrn: p.mrn,
      dateOfBirth: p.dateOfBirth,
      gender: p.gender,
      bloodGroup: p.bloodGroup,
      genotype: p.genotype,
      user: p.user,
      address: {
        line1: dec(p.addressLine1Enc),
        line2: dec(p.addressLine2Enc),
        city: dec(p.cityEnc),
        state: dec(p.stateEnc),
        postalCode: dec(p.postalCodeEnc),
        country: dec(p.countryEnc),
      },
      nationalId: dec(p.nationalIdEnc),
    };
  }

  async updateProfile(patientId: string, dto: UpdatePatientProfileDto) {
    const enc = (s?: string) => (s ? encryptField(s, this.phiKey) : undefined);
    return this.prisma.patientProfile.update({
      where: { id: patientId },
      data: {
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
        gender: dto.gender,
        bloodGroup: dto.bloodGroup,
        genotype: dto.genotype,
        addressLine1Enc: enc(dto.addressLine1),
        addressLine2Enc: enc(dto.addressLine2),
        cityEnc: enc(dto.city),
        stateEnc: enc(dto.state),
        postalCodeEnc: enc(dto.postalCode),
        countryEnc: enc(dto.country),
        nationalIdEnc: enc(dto.nationalId),
      },
    });
  }

  // ── Emergency contacts ─────────────────────────────────────

  listEmergencyContacts(patientId: string) {
    return this.prisma.emergencyContact.findMany({
      where: { patientId }, orderBy: { priority: 'asc' },
    });
  }

  createEmergencyContact(patientId: string, dto: CreateEmergencyContactDto) {
    return this.prisma.emergencyContact.create({ data: { patientId, ...dto } });
  }

  // ── Medical history ────────────────────────────────────────

  listAllergies(patientId: string) {
    return this.prisma.allergyIntolerance.findMany({
      where: { patientId, deletedAt: null }, orderBy: { recordedAt: 'desc' },
    });
  }
  createAllergy(patientId: string, dto: CreateAllergyDto) {
    return this.prisma.allergyIntolerance.create({ data: { patientId, ...dto } });
  }

  listConditions(patientId: string) {
    return this.prisma.condition.findMany({
      where: { patientId, deletedAt: null }, orderBy: { onsetDate: 'desc' },
    });
  }
  createCondition(patientId: string, dto: CreateConditionDto, recordedById?: string) {
    return this.prisma.condition.create({
      data: {
        patientId,
        code: dto.code,
        display: dto.display,
        onsetDate: dto.onsetDate ? new Date(dto.onsetDate) : null,
        notes: dto.notes,
        recordedById,
      },
    });
  }

  listProcedures(patientId: string) {
    return this.prisma.procedure.findMany({
      where: { patientId, deletedAt: null }, orderBy: { performedAt: 'desc' },
    });
  }

  listImmunizations(patientId: string) {
    return this.prisma.immunization.findMany({
      where: { patientId, deletedAt: null }, orderBy: { administeredAt: 'desc' },
    });
  }

  listEncounters(patientId: string) {
    return this.prisma.encounter.findMany({
      where: { patientId, deletedAt: null }, orderBy: { startAt: 'desc' },
    });
  }
}
