import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { generateToken } from '@kincare/shared';
import { InviteStatus } from '@kincare/db';
import { PrismaService } from '../../common/prisma/prisma.module';
import type { InviteDelegateDto, UpdateGrantsDto } from './dto';

const INVITE_TTL_DAYS = 7;

@Injectable()
export class FamilyService {
  constructor(private readonly prisma: PrismaService) {}

  async invite(patientUserId: string, dto: InviteDelegateDto) {
    const { token, hash } = generateToken(32);
    const invite = await this.prisma.familyInvite.create({
      data: {
        fromUserId: patientUserId,
        inviteEmail: dto.email.toLowerCase(),
        invitePhone: dto.phone,
        relation: dto.relation,
        proposedScopes: dto.scopes,
        tokenHash: hash,
        expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 86_400_000),
      },
    });
    // Token is shown once and emailed to invitee.
    return { id: invite.id, token, expiresAt: invite.expiresAt };
  }

  async listInvitesFor(patientUserId: string) {
    return this.prisma.familyInvite.findMany({
      where: { fromUserId: patientUserId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async acceptInvite(acceptingUserId: string, tokenHash: string) {
    const invite = await this.prisma.familyInvite.findUnique({ where: { tokenHash } });
    if (!invite || invite.status !== InviteStatus.PENDING) throw new NotFoundException('Invite not found');
    if (invite.expiresAt < new Date()) {
      await this.prisma.familyInvite.update({
        where: { id: invite.id }, data: { status: InviteStatus.EXPIRED },
      });
      throw new BadRequestException('Invite expired');
    }

    return this.prisma.$transaction(async (tx) => {
      const accepted = await tx.familyInvite.update({
        where: { id: invite.id },
        data: { status: InviteStatus.ACCEPTED, acceptedAt: new Date(), toUserId: acceptingUserId },
      });
      const rel = await tx.familyRelationship.upsert({
        where: {
          patientUserId_delegateUserId: {
            patientUserId: invite.fromUserId,
            delegateUserId: acceptingUserId,
          },
        },
        update: { revokedAt: null, relation: invite.relation },
        create: {
          patientUserId: invite.fromUserId,
          delegateUserId: acceptingUserId,
          relation: invite.relation,
        },
      });
      // Materialize granted scopes
      await tx.permissionGrant.deleteMany({ where: { relationshipId: rel.id } });
      await tx.permissionGrant.createMany({
        data: invite.proposedScopes.map((scope) => ({
          relationshipId: rel.id,
          grantorUserId: invite.fromUserId,
          granteeUserId: acceptingUserId,
          scope,
        })),
      });
      return { invite: accepted, relationshipId: rel.id };
    });
  }

  async listDelegatesOf(patientUserId: string) {
    return this.prisma.familyRelationship.findMany({
      where: { patientUserId, revokedAt: null },
      include: {
        delegate: { select: { id: true, email: true, firstName: true, lastName: true } },
        grants: { where: { revokedAt: null } },
      },
    });
  }

  async listAccessibleOf(delegateUserId: string) {
    return this.prisma.familyRelationship.findMany({
      where: { delegateUserId, revokedAt: null },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true } },
        grants: { where: { revokedAt: null } },
      },
    });
  }

  async updateGrants(patientUserId: string, relationshipId: string, dto: UpdateGrantsDto) {
    const rel = await this.prisma.familyRelationship.findFirst({
      where: { id: relationshipId, patientUserId },
    });
    if (!rel) throw new NotFoundException('Relationship not found');
    return this.prisma.$transaction(async (tx) => {
      await tx.permissionGrant.updateMany({
        where: { relationshipId, scope: { notIn: dto.scopes }, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      for (const scope of dto.scopes) {
        await tx.permissionGrant.upsert({
          where: { relationshipId_scope: { relationshipId, scope } },
          update: { revokedAt: null },
          create: {
            relationshipId,
            scope,
            grantorUserId: patientUserId,
            granteeUserId: rel.delegateUserId,
          },
        });
      }
      return tx.permissionGrant.findMany({ where: { relationshipId, revokedAt: null } });
    });
  }

  async revoke(patientUserId: string, relationshipId: string) {
    const rel = await this.prisma.familyRelationship.findFirst({
      where: { id: relationshipId, patientUserId },
    });
    if (!rel) throw new NotFoundException('Relationship not found');
    await this.prisma.$transaction([
      this.prisma.permissionGrant.updateMany({
        where: { relationshipId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      this.prisma.familyRelationship.update({
        where: { id: relationshipId }, data: { revokedAt: new Date() },
      }),
    ]);
  }
}
