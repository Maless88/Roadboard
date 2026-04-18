import { Global, Module } from '@nestjs/common';
import { AuthGuard } from './auth.guard';
import { GrantCheckGuard } from './grant-check.guard';


@Global()
@Module({
  providers: [AuthGuard, GrantCheckGuard],
  exports: [AuthGuard, GrantCheckGuard],
})
export class CommonModule {}
