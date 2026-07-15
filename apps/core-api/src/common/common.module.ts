import { Global, Module } from '@nestjs/common';
import { AuthGuard } from './auth.guard';
import { AdminGuard } from './admin.guard';
import { GrantCheckGuard } from './grant-check.guard';


@Global()
@Module({
  providers: [AuthGuard, AdminGuard, GrantCheckGuard],
  exports: [AuthGuard, AdminGuard, GrantCheckGuard],
})
export class CommonModule {}
