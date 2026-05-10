import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FlowProducer } from 'bullmq';
import IORedis from 'ioredis';

/**
 * Wraps a single shared BullMQ {@link FlowProducer} so multi-step pipelines
 * can be enqueued as a parent job with one or more children. Children always
 * complete before the parent — perfect for fan-out where the parent must wait
 * (e.g. acknowledge an external system) until downstream work is durably
 * recorded.
 *
 * Today's flows:
 *   - hl7-pipeline: parent `hl7.ingest` → child `hl7.notify-family`
 *   - progress-update: parent `progress.persist` → child `progress.fan-out`
 */
@Injectable()
export class FlowsProducer {
  readonly producer: FlowProducer;

  constructor(@Inject(ConfigService) cfg: ConfigService) {
    this.producer = new FlowProducer({
      connection: new IORedis(cfg.getOrThrow('REDIS_URL'), { maxRetriesPerRequest: null }),
      prefix: cfg.get('REDIS_QUEUE_PREFIX') ?? 'kincare',
    });
  }

  /**
   * Enqueue an asynchronous HL7 ingest pipeline. The MLLP listener uses this
   * when `HL7_FLOW_ASYNC=true` so the TCP ACK can be sent immediately while
   * persistence + family notification happen in the worker.
   */
  async dispatchHl7(raw: string, source: 'mllp' | 'http') {
    return this.producer.add({
      name: 'hl7.ingest',
      queueName: 'hl7-pipeline',
      data: { raw, source, enqueuedAt: new Date().toISOString() },
      opts: { attempts: 5, backoff: { type: 'exponential', delay: 1500 }, removeOnComplete: 1000 },
      children: [
        {
          name: 'hl7.notify-family',
          queueName: 'hl7-pipeline',
          data: { source },
          opts: { attempts: 3, backoff: { type: 'exponential', delay: 2000 } },
        },
      ],
    });
  }
}
