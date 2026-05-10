import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrthancClient } from '@kincare/dicom';
import { DicomController } from './dicom.controller';
import { DicomService } from './dicom.service';
import { PatientsModule } from '../patients/patients.module';
import { ORTHANC } from './dicom.tokens';

export { ORTHANC };

@Module({
  imports: [PatientsModule],
  controllers: [DicomController],
  providers: [
    DicomService,
    {
      provide: ORTHANC,
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => new OrthancClient({
        baseUrl: cfg.get('ORTHANC_URL') ?? 'http://localhost:8042',
        username: cfg.get('ORTHANC_USERNAME'),
        password: cfg.get('ORTHANC_PASSWORD'),
      }),
    },
  ],
  exports: [DicomService],
})
export class DicomModule {}
