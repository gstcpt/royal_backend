import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Req,
  Res,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Connexion utilisateur et émission de jetons JWT' })
  @ApiResponse({ status: 200, description: 'Connexion réussie' })
  @ApiResponse({ status: 401, description: 'Identifiants incorrects' })
  @ApiResponse({ status: 403, description: 'Compte inactif ou verrouillé' })
  async login(
    @Body() loginDto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.authService.validateUser(loginDto);
    const metadata = {
      ipAddress: req.ip || (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'] || 'Unknown',
      deviceInfo: (req.headers['x-device-info'] as string) || null,
    };

    const result = await this.authService.login(user, metadata);

    // Set secure httpOnly cookies for both access and refresh tokens
    res.cookie('royal_access_token', result.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000, // 15 mins
      path: '/',
    });

    res.cookie('royal_refresh_token', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/',
    });

    return result;
  }

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Inscription d’un nouveau client' })
  @ApiResponse({ status: 201, description: 'Compte créé avec succès' })
  @ApiResponse({ status: 409, description: 'Email déjà utilisé' })
  async register(
    @Body() registerDto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const metadata = {
      ipAddress: req.ip || (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'] || 'Unknown',
    };

    const result = await this.authService.register(registerDto, metadata);

    res.cookie('royal_access_token', result.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000,
      path: '/',
    });

    res.cookie('royal_refresh_token', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    return result;
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rafraîchissement du jeton d’accès avec rotation' })
  @ApiBody({ type: RefreshTokenDto, required: false })
  @ApiResponse({ status: 200, description: 'Nouveaux jetons émis' })
  @ApiResponse({ status: 401, description: 'Jeton révoqué ou expiré' })
  async refresh(
    @Body() body: Partial<RefreshTokenDto>,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = body.refreshToken || req.cookies?.royal_refresh_token;
    const metadata = {
      ipAddress: req.ip || (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'] || 'Unknown',
    };

    const result = await this.authService.refreshToken(token, metadata);

    res.cookie('royal_access_token', result.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000,
      path: '/',
    });

    res.cookie('royal_refresh_token', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    return result;
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Déconnexion de la session courante' })
  async logout(
    @CurrentUser('sessionId') sessionId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.logout(sessionId);

    res.clearCookie('royal_access_token', { path: '/' });
    res.clearCookie('royal_refresh_token', { path: '/' });

    return result;
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Déconnexion de toutes les sessions actives de l’utilisateur' })
  async logoutAll(
    @CurrentUser('id') userId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.logoutAll(userId);

    res.clearCookie('royal_access_token', { path: '/' });
    res.clearCookie('royal_refresh_token', { path: '/' });

    return result;
  }

  @Get('me')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Récupération du profil et des permissions de l’utilisateur connecté' })
  @ApiResponse({ status: 200, description: 'Profil récupéré avec succès' })
  async getMe(@CurrentUser('id') userId: string) {
    return this.authService.getMe(userId);
  }

  @Put('change-password')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Changement sécurisé du mot de passe' })
  async changePassword(
    @CurrentUser('id') userId: string,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(userId, changePasswordDto);
  }

  @Get('sessions')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Liste des sessions actives de l’utilisateur' })
  async getSessions(@CurrentUser('id') userId: string) {
    return this.authService.getUserSessions(userId);
  }

  @Delete('sessions/:id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Révocation d’une session spécifique' })
  async revokeSession(
    @CurrentUser('id') userId: string,
    @Param('id') sessionId: string,
  ) {
    return this.authService.revokeUserSession(userId, sessionId);
  }
}
