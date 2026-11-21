import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Post,
  Put,
  Req,
} from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CartService } from './cart.service';
import { AddToCartDto, UpdateCartItemDto } from './dto/cart.dto';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Panier (Cart)')
@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  private extractIdentities(headers: any, req: any) {
    const sessionId = (headers['x-session-id'] || headers['x-guest-session'] || 'guest_default_session') as string;
    const customerId = req.user?.id || req.user?.customerId || undefined;
    return { sessionId, customerId };
  }

  @Public()
  @Get()
  @ApiHeader({ name: 'x-session-id', required: false, description: 'ID de session pour invités' })
  @ApiOperation({ summary: 'Récupérer le contenu et les totaux du panier' })
  @ApiResponse({ status: 200, description: 'Panier retourné avec calculs en temps réel' })
  getCart(@Headers() headers: any, @Req() req: any) {
    const { sessionId, customerId } = this.extractIdentities(headers, req);
    return this.cartService.getCart(sessionId, customerId);
  }

  @Public()
  @Post('items')
  @ApiHeader({ name: 'x-session-id', required: false })
  @ApiOperation({ summary: 'Ajouter un article au panier' })
  addItem(@Body() dto: AddToCartDto, @Headers() headers: any, @Req() req: any) {
    const { sessionId, customerId } = this.extractIdentities(headers, req);
    return this.cartService.addItem(dto, sessionId, customerId);
  }

  @Public()
  @Put('items/:id')
  @ApiHeader({ name: 'x-session-id', required: false })
  @ApiOperation({ summary: 'Mettre à jour la quantité d’un article' })
  updateItem(
    @Param('id') itemId: string,
    @Body() dto: UpdateCartItemDto,
    @Headers() headers: any,
    @Req() req: any,
  ) {
    const { sessionId, customerId } = this.extractIdentities(headers, req);
    return this.cartService.updateItem(itemId, dto, sessionId, customerId);
  }

  @Public()
  @Delete('items/:id')
  @ApiHeader({ name: 'x-session-id', required: false })
  @ApiOperation({ summary: 'Supprimer un article du panier' })
  removeItem(@Param('id') itemId: string, @Headers() headers: any, @Req() req: any) {
    const { sessionId, customerId } = this.extractIdentities(headers, req);
    return this.cartService.removeItem(itemId, sessionId, customerId);
  }

  @Public()
  @Delete()
  @ApiHeader({ name: 'x-session-id', required: false })
  @ApiOperation({ summary: 'Vider intégralement le panier' })
  clearCart(@Headers() headers: any, @Req() req: any) {
    const { sessionId, customerId } = this.extractIdentities(headers, req);
    return this.cartService.clearCart(sessionId, customerId);
  }

  @Public()
  @Post('validate')
  @ApiHeader({ name: 'x-session-id', required: false })
  @ApiOperation({ summary: 'Vérifier la disponibilité des stocks pour tous les articles du panier' })
  validateCart(@Headers() headers: any, @Req() req: any) {
    const { sessionId, customerId } = this.extractIdentities(headers, req);
    return this.cartService.validateCart(sessionId, customerId);
  }
}
