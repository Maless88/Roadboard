import { Controller, Get } from '@nestjs/common';

import { SyncService } from '../sync/sync.service';


@Controller('health')
export class HealthController {

  constructor(private readonly sync: SyncService) {}


  @Get()
  health(): unknown {

    return {
      status: 'ok',
      service: 'local-sync-bridge',
      sync: this.sync.status(),
    };
  }
}
