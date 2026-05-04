import { Controller, Get } from '@nestjs/common';
import { Public } from './common/decorators/public.decorator';

@Public()
@Controller()
export class RootController {
  @Get()
  getRoot() {
    return { message: 'Majestan API is running...' };
  }
}
