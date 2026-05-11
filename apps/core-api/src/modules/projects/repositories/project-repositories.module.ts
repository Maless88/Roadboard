import { Module } from '@nestjs/common';
import { ProjectRepositoriesController } from './project-repositories.controller';
import { ProjectRepositoriesService } from './project-repositories.service';


@Module({
  controllers: [ProjectRepositoriesController],
  providers: [ProjectRepositoriesService],
})
export class ProjectRepositoriesModule {}
