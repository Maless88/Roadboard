import { Module, Global } from '@nestjs/common';

import { JournalService } from './journal.service';


@Global()
@Module({
  providers: [JournalService],
  exports: [JournalService],
})
export class JournalModule {}
