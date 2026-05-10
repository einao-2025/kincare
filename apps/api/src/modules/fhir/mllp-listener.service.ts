import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { buildAck, MllpFramer } from '@kincare/hl7';
import { createServer, type Server, type Socket } from 'node:net';
import { HL7Ingestor } from './hl7-ingestor.service';
import { FlowsProducer } from '../../common/flows/flows.producer';

/**
 * MLLP TCP listener — accepts HL7 v2 messages from EHR/LIS systems.
 *
 * Two execution modes (`HL7_FLOW_ASYNC`):
 *   - `false` (default): synchronous — invoke the ingestor inline and reflect
 *     the real outcome (AA/AE) in the ACK.
 *   - `true`: enqueue a 2-step BullMQ flow (`hl7-pipeline`) and return AA
 *     immediately. The worker handles parse → persist → notify-family with
 *     per-step retries; failures land in the BullMQ failed set for replay.
 */
@Injectable()
export class MllpListenerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MllpListenerService.name);
  private server?: Server;

  constructor(
    private readonly cfg: ConfigService,
    private readonly ingestor: HL7Ingestor,
    private readonly flows: FlowsProducer,
  ) {}

  onModuleInit(): void {
    if (this.cfg.get('HL7_MLLP_ENABLED') !== 'true') return;
    const port = Number(this.cfg.get('HL7_MLLP_PORT') ?? 2575);
    const async = this.cfg.get('HL7_FLOW_ASYNC') === 'true';

    this.server = createServer((socket: Socket) => {
      const peer = `${socket.remoteAddress}:${socket.remotePort}`;
      this.logger.log(`MLLP connection from ${peer} (mode=${async ? 'async-flow' : 'sync'})`);
      const framer = new MllpFramer({
        onMessage: (raw) => {
          if (async) {
            this.flows.dispatchHl7(raw, 'mllp')
              .then(() => socket.write(buildAck('', 'KINCARE', 'KINCARE', 'AA', 'queued')))
              .catch((err) => {
                this.logger.error(`Flow enqueue error: ${err}`);
                socket.write(buildAck('', 'KINCARE', 'KINCARE', 'AE', String(err)));
              });
            return;
          }
          this.ingestor.ingest(raw)
            .then((outcome) => {
              const code = outcome.processed ? 'AA' : 'AE';
              const text = outcome.error ?? outcome.effects.join('; ');
              socket.write(buildAck(outcome.controlId, 'KINCARE', 'KINCARE', code, text));
            })
            .catch((err) => {
              this.logger.error(`Ingest error: ${err}`);
              socket.write(buildAck('', 'KINCARE', 'KINCARE', 'AE', String(err)));
            });
        },
        onError: (err) => this.logger.error(`Framer error: ${err.message}`),
      });

      socket.on('data', (chunk) => framer.push(chunk));
      socket.on('error', (err) => this.logger.warn(`MLLP socket error: ${err.message}`));
      socket.on('close', () => this.logger.log(`MLLP closed ${peer}`));
    });

    this.server.listen(port, () => {
      this.logger.log(`🔌 MLLP listener ready on tcp://0.0.0.0:${port}`);
    });
  }

  onModuleDestroy(): void {
    this.server?.close();
  }
}
