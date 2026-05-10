import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { OrthancClient } from '@kincare/dicom';
import { PrismaService } from '../../common/prisma/prisma.module';
import { ORTHANC } from './dicom.tokens';

@Injectable()
export class DicomService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(ORTHANC) private readonly orthanc: OrthancClient,
  ) {}

  /**
   * Uploads a DICOM instance to Orthanc and indexes its
   * Study/Series/Instance hierarchy in our DB linked to a patient.
   */
  async uploadInstance(patientId: string, dicomBytes: Buffer) {
    const upload = await this.orthanc.uploadInstance(dicomBytes);
    const study = await this.orthanc.getStudy(upload.ParentStudy);
    const series = await this.orthanc.getSeries(upload.ParentSeries);
    const instance = await this.orthanc.getInstance(upload.ID);

    return this.prisma.$transaction(async (tx) => {
      const dbStudy = await tx.dICOMStudy.upsert({
        where: { studyInstanceUID: study.MainDicomTags.StudyInstanceUID },
        create: {
          patientId,
          studyInstanceUID: study.MainDicomTags.StudyInstanceUID,
          accessionNumber: study.MainDicomTags.AccessionNumber,
          studyDate: study.MainDicomTags.StudyDate ? new Date(study.MainDicomTags.StudyDate) : null,
          studyDescription: study.MainDicomTags.StudyDescription,
          referringPhysician: study.MainDicomTags.ReferringPhysicianName,
          orthancStudyId: study.ID,
        },
        update: { orthancStudyId: study.ID },
      });
      const dbSeries = await tx.dICOMSeries.upsert({
        where: { seriesInstanceUID: series.MainDicomTags.SeriesInstanceUID },
        create: {
          studyId: dbStudy.id,
          seriesInstanceUID: series.MainDicomTags.SeriesInstanceUID,
          seriesNumber: series.MainDicomTags.SeriesNumber ? Number(series.MainDicomTags.SeriesNumber) : null,
          modality: series.MainDicomTags.Modality,
          bodyPart: series.MainDicomTags.BodyPartExamined,
          description: series.MainDicomTags.SeriesDescription,
          orthancSeriesId: series.ID,
        },
        update: { orthancSeriesId: series.ID },
      });
      const dbInstance = await tx.dICOMInstance.upsert({
        where: { sopInstanceUID: instance.MainDicomTags.SOPInstanceUID },
        create: {
          seriesId: dbSeries.id,
          sopInstanceUID: instance.MainDicomTags.SOPInstanceUID,
          instanceNumber: instance.MainDicomTags.InstanceNumber ? Number(instance.MainDicomTags.InstanceNumber) : null,
          orthancInstanceId: instance.ID,
        },
        update: { orthancInstanceId: instance.ID },
      });
      return { study: dbStudy, series: dbSeries, instance: dbInstance };
    });
  }

  listStudies(patientId: string) {
    return this.prisma.dICOMStudy.findMany({
      where: { patientId, deletedAt: null },
      orderBy: { studyDate: 'desc' },
      include: { series: { include: { instances: true } } },
    });
  }

  async getStudyViewerUrls(studyId: string) {
    const study = await this.prisma.dICOMStudy.findUnique({
      where: { id: studyId },
      include: { series: { include: { instances: true } } },
    });
    if (!study) throw new NotFoundException('Study not found');
    return {
      study: {
        studyInstanceUID: study.studyInstanceUID,
        wadoRsRoot: this.orthanc.wadoRsStudyUrl(study.studyInstanceUID),
      },
      series: study.series.map((s) => ({
        seriesInstanceUID: s.seriesInstanceUID,
        modality: s.modality,
        instances: s.instances.map((i) => ({
          sopInstanceUID: i.sopInstanceUID,
          previewUrl: i.orthancInstanceId ? this.orthanc.wadoFrameUrl(i.orthancInstanceId) : null,
        })),
      })),
    };
  }
}
