import {
  Global,
  Module,
  OnModuleInit,
  OnApplicationShutdown,
  Inject,
} from "@nestjs/common";
import { PrismaClient } from "@roadboard/database";


const PRISMA_TOKEN = "PRISMA";


const prismaProvider = {
  provide: PRISMA_TOKEN,
  useValue: new PrismaClient(),
};


@Global()
@Module({
  providers: [prismaProvider],
  exports: [PRISMA_TOKEN],
})
export class PrismaModule implements OnModuleInit, OnApplicationShutdown {

  constructor(@Inject(PRISMA_TOKEN) private readonly prisma: PrismaClient) {}


  async onModuleInit(): Promise<void> {

    await this.prisma.$connect();
  }


  async onApplicationShutdown(): Promise<void> {

    await this.prisma.$disconnect();
  }
}
