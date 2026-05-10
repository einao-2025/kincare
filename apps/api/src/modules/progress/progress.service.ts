import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.module';
import { NotificationsService } from '../notifications/notifications.service';
import type { CreateProgressUpdateDto } from './dto';

@Injectable()
export class ProgressService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notif: NotificationsService,
  ) {}

  async create(authorUserId: string, dto: CreateProgressUpdateDto) {
    const practitioner = await this.prisma.practitioner.findUnique({ where: { userId: authorUserId } });
    if (!practitioner) throw new ForbiddenException('Only practitioners can publish progress updates');

    const patient = await this.prisma.patientProfile.findUnique({
      where: { id: dto.patientId },
      include: { user: true },
    });
    if (!patient) throw new NotFoundException('Patient not found');

    const update = await this.prisma.progressUpdate.create({
      data: {
        patientId: patient.id,
        encounterId: dto.encounterId,
        authorId: practitioner.id,
        category: dto.category,
        title: dto.title,
        message: dto.message,
        notifyFamily: dto.notifyFamily ?? true,
      },
    });

    // Notify the patient themselves (in-app).
    await this.notif.enqueue({
      userId: patient.userId,
      channel: 'IN_APP',
      subject: dto.title,
      body: dto.message,
      metadata: { progressUpdateId: update.id, category: dto.category },
    });

    // Fan-out to authorized family delegates.
    if (update.notifyFamily) {
      await this.notif.notifyFamilyOfProgress(patient.userId, {
        subject: `[${patient.user.firstName}] ${dto.title}`,
        body: dto.message,
      });
    }
    return update;
  }

  list(patientId: string) {
    return this.prisma.progressUpdate.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
      include: {
        author: { include: { user: { select: { firstName: true, lastName: true } } } },
      },
    });
  }
}
