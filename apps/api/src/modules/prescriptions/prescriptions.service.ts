import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  DispenseStatus, PrescriptionStatus, RefillRequestStatus,
} from '@kincare/db';
import { generatePickupCode, Roles, type AuthPrincipal } from '@kincare/shared';
import { PrismaService } from '../../common/prisma/prisma.module';
import { PatientsService } from '../patients/patients.service';
import type {
  ApproveRefillDto, AuthorizePickupDto, ConfirmPickupDto,
  CreatePrescriptionDto, CreateRefillRequestDto, DenyRefillDto, DispenseDto,
} from './dto';

const PICKUP_TTL_HOURS = 72;

@Injectable()
export class PrescriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly patients: PatientsService,
  ) {}

  // ── Doctor: prescribe ──────────────────────────────────────

  async create(actor: AuthPrincipal, dto: CreatePrescriptionDto) {
    const practitioner = await this.prisma.practitioner.findUnique({ where: { userId: actor.userId } });
    if (!practitioner) throw new ForbiddenException('Only registered practitioners can prescribe');

    return this.prisma.prescription.create({
      data: {
        patientId: dto.patientId,
        prescriberId: practitioner.id,
        medicationCode: dto.medicationCode,
        medicationName: dto.medicationName,
        dosage: dto.dosage,
        route: dto.route,
        frequency: dto.frequency,
        durationDays: dto.durationDays,
        quantity: dto.quantity,
        refillsAllowed: dto.refillsAllowed ?? 0,
        notes: dto.notes,
        status: PrescriptionStatus.ACTIVE,
        prescribedAt: new Date(),
      },
    });
  }

  // ── Patient: list / refill request ─────────────────────────

  async listForPatient(patientId: string) {
    return this.prisma.prescription.findMany({
      where: { patientId, deletedAt: null },
      orderBy: { prescribedAt: 'desc' },
      include: {
        prescriber: { include: { user: { select: { firstName: true, lastName: true } } } },
        refillRequests: { orderBy: { createdAt: 'desc' }, take: 5 },
      },
    });
  }

  async createRefillRequest(actor: AuthPrincipal, dto: CreateRefillRequestDto) {
    const rx = await this.prisma.prescription.findUnique({
      where: { id: dto.prescriptionId },
      include: { patient: true },
    });
    if (!rx || rx.deletedAt) throw new NotFoundException('Prescription not found');

    // Patient or authorized delegate (REQUEST_REFILL)
    await this.patients.resolvePatientId(rx.patientId, actor, 'REQUEST_REFILL');

    if (rx.status !== PrescriptionStatus.ACTIVE) throw new BadRequestException('Prescription is not active');
    if (rx.refillsUsed >= rx.refillsAllowed) {
      throw new BadRequestException('No refills remaining');
    }
    return this.prisma.prescriptionRefillRequest.create({
      data: {
        prescriptionId: rx.id,
        patientId: rx.patientId,
        requestedByUserId: actor.userId,
        status: RefillRequestStatus.PENDING,
        notes: dto.notes,
      },
    });
  }

  // ── Doctor / Pharmacist approval ───────────────────────────

  async approveRefill(actor: AuthPrincipal, dto: ApproveRefillDto) {
    const req = await this.prisma.prescriptionRefillRequest.findUnique({
      where: { id: dto.refillRequestId },
      include: { prescription: true },
    });
    if (!req) throw new NotFoundException('Refill request not found');
    if (req.status !== RefillRequestStatus.PENDING) {
      throw new BadRequestException('Refill request is not pending');
    }
    const code = generatePickupCode();
    const updated = await this.prisma.prescriptionRefillRequest.update({
      where: { id: req.id },
      data: {
        status: RefillRequestStatus.APPROVED,
        approvedAt: new Date(),
        approvedByUserId: actor.userId,
        pickupCode: code,
        pickupCodeExpiresAt: new Date(Date.now() + PICKUP_TTL_HOURS * 3_600_000),
      },
    });
    await this.prisma.prescription.update({
      where: { id: req.prescriptionId },
      data: { refillsUsed: { increment: 1 } },
    });
    return updated;
  }

  async denyRefill(actor: AuthPrincipal, dto: DenyRefillDto) {
    return this.prisma.prescriptionRefillRequest.update({
      where: { id: dto.refillRequestId },
      data: {
        status: RefillRequestStatus.DENIED,
        approvedByUserId: actor.userId,
        deniedReason: dto.reason,
      },
    });
  }

  // ── Patient: authorize a delegate to pick up ───────────────

  async authorizePickup(actor: AuthPrincipal, dto: AuthorizePickupDto) {
    const req = await this.prisma.prescriptionRefillRequest.findUnique({ where: { id: dto.refillRequestId } });
    if (!req) throw new NotFoundException('Refill request not found');

    // Only the patient (or staff) can authorize a delegate
    await this.patients.resolvePatientId(req.patientId, actor);
    if (actor.role === Roles.FAMILY_DELEGATE) throw new ForbiddenException('Delegates cannot re-authorize');

    if (dto.delegateUserId) {
      // Verify the delegate has an active relationship + AUTHORIZE_PICKUP scope
      const grant = await this.prisma.permissionGrant.findFirst({
        where: {
          granteeUserId: dto.delegateUserId,
          scope: 'AUTHORIZE_PICKUP',
          revokedAt: null,
          relationship: { patientUserId: actor.userId, revokedAt: null },
        },
      });
      if (!grant) throw new ForbiddenException('Delegate is not authorized for pickup');
    }

    return this.prisma.prescriptionRefillRequest.update({
      where: { id: req.id },
      data: { authorizedPickupUserId: dto.delegateUserId },
    });
  }

  // ── Pharmacist: dispense + confirm pickup ──────────────────

  async dispense(actor: AuthPrincipal, dto: DispenseDto) {
    const req = await this.prisma.prescriptionRefillRequest.findUnique({
      where: { id: dto.refillRequestId },
    });
    if (!req || req.status !== RefillRequestStatus.APPROVED) {
      throw new BadRequestException('Request is not approved');
    }
    return this.prisma.$transaction(async (tx) => {
      const dispense = await tx.medicationDispense.create({
        data: {
          prescriptionId: req.prescriptionId,
          refillRequestId: req.id,
          pharmacistUserId: actor.userId,
          status: DispenseStatus.READY_FOR_PICKUP,
          quantityDispensed: dto.quantityDispensed,
          lotNumber: dto.lotNumber,
        },
      });
      await tx.prescriptionRefillRequest.update({
        where: { id: req.id },
        data: { status: RefillRequestStatus.DISPENSED },
      });
      return dispense;
    });
  }

  async confirmPickup(actor: AuthPrincipal, dto: ConfirmPickupDto) {
    const req = await this.prisma.prescriptionRefillRequest.findFirst({
      where: { pickupCode: dto.pickupCode },
      include: { dispense: true },
    });
    if (!req) throw new NotFoundException('Invalid pickup code');
    if (req.status !== RefillRequestStatus.DISPENSED) throw new BadRequestException('Not ready for pickup');
    if (req.pickupCodeExpiresAt && req.pickupCodeExpiresAt < new Date()) {
      throw new BadRequestException('Pickup code expired');
    }
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.prescriptionRefillRequest.update({
        where: { id: req.id },
        data: {
          status: RefillRequestStatus.PICKED_UP,
          pickedUpAt: new Date(),
          pickedUpByName: dto.pickedUpByName,
          pickedUpByIdRef: dto.pickedUpByIdRef,
          pickupCode: null,
        },
      });
      if (req.dispense) {
        await tx.medicationDispense.update({
          where: { id: req.dispense.id },
          data: { status: DispenseStatus.DISPENSED, dispensedAt: new Date() },
        });
      }
      return updated;
    });
  }

  // ── Pharmacist queue ───────────────────────────────────────

  pendingApprovals() {
    return this.prisma.prescriptionRefillRequest.findMany({
      where: { status: RefillRequestStatus.PENDING },
      orderBy: { createdAt: 'asc' },
      include: { prescription: true, patient: { include: { user: true } } },
    });
  }
}
