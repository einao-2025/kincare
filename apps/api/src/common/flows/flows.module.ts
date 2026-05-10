import { Global, Module } from '@nestjs/common';
import { FlowsProducer } from './flows.producer';

@Global()
@Module({
  providers: [FlowsProducer],
  exports: [FlowsProducer],
})
export class FlowsModule {}
