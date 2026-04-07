import { Controller, Post, Get, HttpCode } from '@nestjs/common';

import { SyncService } from './sync.service';
import { JournalService } from '../journal/journal.service';


@Controller('sync')
export class SyncController {

  constructor(
    private readonly sync: SyncService,
    private readonly journal: JournalService,
  ) {}


  @Get('status')
  status(): unknown {

    return this.sync.status();
  }


  @Get('journal')
  listJournal(): unknown {

    return this.journal.all();
  }


  @Post('trigger')
  @HttpCode(200)
  async trigger(): Promise<unknown> {

    return this.sync.sync();
  }
}
