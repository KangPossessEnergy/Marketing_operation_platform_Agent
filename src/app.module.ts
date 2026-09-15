//AppModule管"基础设施"

import { Module } from '@nestjs/common';
import { AppService } from './app.service';
import { AppController } from './app.controller';
import { DomainModule } from './domain/domain.module';

@Module({
  imports: [DomainModule],
  controllers: [AppController],
  providers:[AppService]
})
export class AppModule {}
