import { Module } from '@nestjs/common';
import { FhirController } from './fhir.controller';
import { FhirService } from './fhir.service';
import { Hl7Controller } from './hl7.controller';
import { Hl7Service } from './hl7.service';
import { HL7Ingestor } from './hl7-ingestor.service';
import { MllpListenerService } from './mllp-listener.service';

@Module({
  controllers: [FhirController, Hl7Controller],
  providers: [FhirService, Hl7Service, HL7Ingestor, MllpListenerService],
  exports: [FhirService, Hl7Service, HL7Ingestor],
})
export class FhirModule {}
