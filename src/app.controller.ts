import { AppService } from './app.service.js';
import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  
  constructor(private readonly appService: AppService) {}


  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}