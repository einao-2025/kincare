import { Injectable } from '@nestjs/common';
import { HL7Ingestor } from './hl7-ingestor.service';

@Injectable()
export class Hl7Service {
  constructor(private readonly ingestor: HL7Ingestor) {}

  /** Parse, persist, and dispatch an HL7 v2 message; returns ingestion outcome. */
  ingest(raw: string) {
    return this.ingestor.ingest(raw);
  }
}
