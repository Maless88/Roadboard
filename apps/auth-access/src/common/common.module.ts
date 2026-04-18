import { Global, Module } from '@nestjs/common';
import { AuthGuard } from './auth.guard';
import { AdminGuard } from './admin.guard';
import { SelfOrAdminGuard } from './self-or-admin.guard';


@Global()
@Module({
  providers: [AuthGuard, AdminGuard, SelfOrAdminGuard],
  exports: [AuthGuard, AdminGuard, SelfOrAdminGuard],
})
export class CommonModule {}
