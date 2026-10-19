import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import type { Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import {
  assertSeoOrigin,
  SEO_COOKIE,
  SeoAuthService,
  SeoSessionGuard,
} from './seo-auth';
import type { SeoRequest } from './seo-auth';
import { SeoEngineService } from './seo-engine.service';

class SeoLoginDto {
  @IsEmail() @MaxLength(255) email: string;
  @IsString() @MinLength(6) @MaxLength(1024) password: string;
}

// Intentionally separate from all /admin sync controllers and legacy JWTs.
@Public()
@Controller('seo-admin')
export class SeoAdminController {
  constructor(
    private readonly seo: SeoEngineService,
    private readonly auth: SeoAuthService,
  ) {}
  @Post('auth/login')
  @HttpCode(200)
  async login(
    @Body() body: SeoLoginDto,
    @Req() req: SeoRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    assertSeoOrigin(req);
    const { actor, token } = await this.auth.login(body.email, body.password);
    res.cookie(SEO_COOKIE, token, {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 8 * 60 * 60 * 1000,
    });
    res.setHeader('Cache-Control', 'no-store');
    return actor;
  }
  @Post('auth/logout')
  @HttpCode(200)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(SEO_COOKIE, {
      path: '/',
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
    });
    return { loggedOut: true };
  }
  @Get('auth/me')
  @UseGuards(SeoSessionGuard)
  me(@Req() req: SeoRequest) {
    return req.seoActor;
  }
  @Get('options')
  @UseGuards(SeoSessionGuard)
  options() {
    return this.seo.options();
  }
  @Get('inventory/:scope')
  @UseGuards(SeoSessionGuard)
  inventory(
    @Param('scope') scope: string,
    @Query() query: Record<string, string>,
  ) {
    return this.seo.inventory(scope, query);
  }
  @Get('inventory/:scope/:id')
  @UseGuards(SeoSessionGuard)
  inventoryConfig(
    @Param('scope') scope: string,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.seo.inventoryConfig(scope, id);
  }
  @Get('configs')
  @UseGuards(SeoSessionGuard)
  configs(@Query('scope') scope: string) {
    return this.seo.configs(scope);
  }
  @Put('configs/:key')
  @UseGuards(SeoSessionGuard)
  save(
    @Param('key') key: string,
    @Body() body: Record<string, unknown>,
    @Req() req: SeoRequest,
  ) {
    return this.seo.saveConfig(key, body, req.seoActor.id);
  }
  @Get('listing-pages')
  @UseGuards(SeoSessionGuard)
  listings() {
    return this.seo.listingPages();
  }
  @Post('listing-pages')
  @UseGuards(SeoSessionGuard)
  saveListing(@Body() body: Record<string, unknown>, @Req() req: SeoRequest) {
    return this.seo.saveListing(body, req.seoActor.id);
  }
  @Delete('listing-pages/:id')
  @UseGuards(SeoSessionGuard)
  removeListing(@Param('id', ParseIntPipe) id: number) {
    return this.seo.removeListing(id);
  }
  @Get('redirects')
  @UseGuards(SeoSessionGuard)
  redirects() {
    return this.seo.redirects();
  }
  @Post('redirects')
  @UseGuards(SeoSessionGuard)
  redirect(@Body() body: Record<string, unknown>, @Req() req: SeoRequest) {
    return this.seo.saveRedirect(body, req.seoActor.id);
  }
  @Delete('redirects/:id')
  @UseGuards(SeoSessionGuard)
  removeRedirect(@Param('id', ParseIntPipe) id: number) {
    return this.seo.removeRedirect(id);
  }
  @Get('technical')
  @UseGuards(SeoSessionGuard)
  technical() {
    return this.seo.technical();
  }
  @Get('sitemap/:group')
  @UseGuards(SeoSessionGuard)
  sitemap(@Param('group') group: string) {
    return this.seo.sitemap(group);
  }
}

@Public()
@Controller('seo-engine')
export class PublicSeoEngineController {
  constructor(private readonly seo: SeoEngineService) {}
  @Get('resolve') resolve(@Query('path') path: string) {
    return this.seo.resolve(path);
  }
  @Get('listing-page') listing(@Query('path') path: string) {
    return this.seo.resolve(path);
  }
  @Get('organization') organization() {
    return this.seo.organization();
  }
  @Get('robots') async robots() {
    return { text: (await this.seo.technical())?.settings?.robots_txt };
  }
  @Get('llms') async llms() {
    return { text: await this.seo.llms() };
  }
  @Get('sitemap/:group') async sitemap(
    @Param('group') group: string,
    @Res() res: Response,
  ) {
    res.type('application/xml').send(await this.seo.sitemap(group));
  }
  @Get('routing') routing() {
    return this.seo.routing();
  }
}
