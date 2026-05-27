import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Controller('auth')
export class AuthController {
  constructor(private readonly jwtService: JwtService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() body: { email: string }) {
    const email = body.email || 'developer@pulseai.dev';
    const payload = { email, sub: 'dev_user_1' };
    const token = await this.jwtService.signAsync(payload);

    return {
      success: true,
      data: {
        token,
        user: { email },
      },
      error: null,
      meta: {},
    };
  }
}
