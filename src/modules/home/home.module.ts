import { Module } from '@nestjs/common';
import { HomeController } from './home.controller';
import { HomeService } from './home.service';
import { ShowcasesModule } from '../showcases/showcases.module';

@Module({
  imports: [ShowcasesModule],
  controllers: [HomeController],
  providers: [HomeService],
})
export class HomeModule {}
