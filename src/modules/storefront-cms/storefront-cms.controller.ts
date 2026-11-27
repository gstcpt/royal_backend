import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { StorefrontCmsService } from './storefront-cms.service';
import {
  AiGenerateDto,
  ApplyStockLifecycleDto,
  CarrierWebhookDto,
  CreateContactDto,
  CreateProductReviewDto,
  CreateSupportMessageDto,
  FlouciInitDto,
  ModerateReviewDto,
  PreviewEmailTemplateDto,
  ReorderFaqDto,
  ReplyContactEmailDto,
  ReplySupportThreadDto,
  ResetCmsDefaultsDto,
  SendDeliveryDocumentsDto,
  SendNewsletterCampaignDto,
  SendTestEmailTemplateDto,
  SmtpTestDto,
  SubscribeNewsletterDto,
  TestMediaStorageDto,
  ToggleReactionDto,
  ToggleWishlistDto,
  TrackTelemetryDto,
  UpdateCmsIdentityDto,
  UpdateCmsLayoutDto,
  UpdateCmsPageDto,
  UpdateCmsViewsDto,
  UpdateContactDto,
  UpdateMyProfileDto,
  UpdateShippingConfigDto,
  UpdateSupportStatusDto,
  UpdateSysConfigDto,
  UpsertCuratedTestimonialDto,
  UpsertCustomViewDto,
  UpsertEmailTemplateDto,
  UpsertFaqDto,
  UpsertShowroomDto,
} from './dto/storefront-cms.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RootOnlyGuard } from '../../common/guards/root-only.guard';

@ApiTags('Storefront CMS & Contact')
@Controller('storefront-cms')
export class StorefrontCmsController {
  constructor(private readonly service: StorefrontCmsService) {}

  @Public()
  @Get('config')
  @ApiOperation({ summary: 'Configuration publique boutique (Seuil livraison, Contact Royal)' })
  getConfig() {
    return this.service.getPublicConfig();
  }

  @Patch('shipping-config')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permissions('coupons:update')
  @ApiOperation({ summary: 'Modifier le seuil de livraison gratuite et frais standards' })
  updateShipping(@Body() dto: UpdateShippingConfigDto, @Req() req: any) {
    return this.service.updateShippingConfig(dto, req.user?.email);
  }

  @Public()
  @Get('faq')
  @ApiOperation({ summary: 'Questions fréquentes actives (FAQ)' })
  getFaq() {
    return this.service.getFaq(false);
  }

  @Post('faq')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permissions('settings:update')
  createFaq(@Body() dto: UpsertFaqDto) {
    return this.service.createFaq(dto);
  }

  @Patch('faq/reorder')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permissions('settings:update')
  reorderFaq(@Body() dto: ReorderFaqDto) {
    return this.service.reorderFaq(dto.orderedIds || []);
  }

  @Patch('faq/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permissions('settings:update')
  updateFaq(@Param('id') id: string, @Body() dto: Partial<UpsertFaqDto>) {
    return this.service.updateFaq(id, dto);
  }

  @Delete('faq/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permissions('settings:update')
  deleteFaq(@Param('id') id: string) {
    return this.service.deleteFaq(id);
  }

  @Public()
  @Get('pages/:slug')
  @ApiOperation({ summary: 'Pages légales CMS (terms, privacy)' })
  getPage(@Param('slug') slug: string) {
    return this.service.getPage(slug);
  }

  @Patch('pages/:slug')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permissions('settings:update')
  updatePage(@Param('slug') slug: string, @Body() dto: UpdateCmsPageDto, @Req() req: any) {
    return this.service.updatePage(slug, dto, req.user?.email);
  }

  @Public()
  @Throttle({ default: { limit: 15, ttl: 60000 } })
  @Post('contact')
  @ApiOperation({ summary: 'Envoyer un message de contact au Super Admin / Équipe Royal' })
  submitContact(@Body() dto: CreateContactDto) {
    return this.service.submitContact(dto);
  }

  @Get('contacts')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permissions('contacts:read')
  @ApiOperation({ summary: 'Lister les messages de contact (Dashboard)' })
  listContacts(@Query('limit') limit?: string) {
    const parsedLimit = limit !== undefined ? Number(limit) : undefined;
    return this.service.listContacts(
      Number.isFinite(parsedLimit) && (parsedLimit as number) > 0 ? parsedLimit : undefined,
    );
  }

  @Patch('contacts/read-all')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permissions('contacts:update')
  @ApiOperation({ summary: 'Marquer tous les messages de contact comme lus' })
  markAllContactsRead() {
    return this.service.markAllContactsRead();
  }

  @Patch('contacts/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permissions('contacts:update')
  updateContact(@Param('id') id: string, @Body() dto: UpdateContactDto) {
    return this.service.updateContact(id, dto);
  }

  @Post('contacts/:id/reply')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permissions('contacts:update')
  @ApiOperation({ summary: 'Répondre à un contact avec modèle e-mail FR/AR et envoi SMTP' })
  replyContactEmail(
    @Param('id') id: string,
    @Body() dto: ReplyContactEmailDto,
    @Req() req: any,
  ) {
    return this.service.replyContactWithEmail(id, dto, req.user?.email || 'STAFF');
  }

  @Delete('contacts/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permissions('contacts:delete')
  deleteContact(@Param('id') id: string) {
    return this.service.deleteContact(id);
  }

  @Post('contacts/bulk-action')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permissions('contacts:update')
  @ApiOperation({ summary: 'Action groupée sur les messages de contact (lu, non lu, corbeille, suppression)' })
  bulkActionContacts(
    @Body() body: { ids: string[]; action: 'MARK_READ' | 'MARK_UNREAD' | 'TRASH' | 'RESTORE' | 'DELETE' },
  ) {
    return this.service.bulkActionContacts(body.ids || [], body.action);
  }

  @Public()
  @Post('newsletter')
  @ApiOperation({ summary: 'Inscription à la newsletter boutique' })
  subscribeNewsletter(@Body() dto: SubscribeNewsletterDto) {
    return this.service.subscribeNewsletter(dto);
  }

  @Public()
  @Post('telemetry/track')
  @ApiOperation({ summary: 'Enregistrer un événement réel de navigation ou conversion Storefront (TrafficEvent)' })
  trackTelemetry(@Body() dto: TrackTelemetryDto, @Req() req?: any) {
    const ua = String(req?.headers?.['user-agent'] || '');
    return this.service.recordTelemetryEvent(dto, ua);
  }

  @Get('dashboard-kpis')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permissions('products:read')
  @ApiOperation({ summary: 'Statistiques temps réel (articles, catégories, utilisateurs, commandes, ventes)' })
  getDashboardKpis() {
    return this.service.getDashboardKpis();
  }

  @Get('user-dashboard')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Analytiques, graphiques, calendrier et 5 derniers messages non lus selon le rôle connecté' })
  getUserDashboard(@CurrentUser() user: any) {
    return this.service.getUserDashboard(user?.id, user?.roles || []);
  }

  @Public()
  @Get('reviews/:productId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Avis approuvés pour un article (+ avis du client connecté)' })
  getReviews(@Param('productId') productId: string, @CurrentUser() user?: any) {
    return this.service.getProductReviews(productId, user?.id);
  }

  @Public()
  @Post('reviews/:productId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Publier ou modifier un avis et une note sur un article' })
  createReview(
    @Param('productId') productId: string,
    @Body() dto: CreateProductReviewDto,
    @CurrentUser() user: any,
  ) {
    return this.service.createProductReview(productId, dto, user);
  }

  @Get('newsletters')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permissions('newsletters:read')
  @ApiOperation({ summary: 'Lister les abonnés newsletter depuis PostgreSQL' })
  listNewsletterSubscribers() {
    return this.service.listNewsletterSubscribers();
  }

  @Patch('newsletters/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permissions('newsletters:update')
  @ApiOperation({ summary: 'Activer / désactiver un abonné newsletter' })
  toggleNewsletterSubscriber(@Param('id') id: string) {
    return this.service.toggleNewsletterSubscriber(id);
  }

  @Delete('newsletters/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permissions('newsletters:delete')
  @ApiOperation({ summary: 'Supprimer un abonné newsletter' })
  deleteNewsletterSubscriber(@Param('id') id: string) {
    return this.service.deleteNewsletterSubscriber(id);
  }

  @Post('newsletters/send-campaign')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permissions('newsletters:update')
  @ApiOperation({ summary: 'Envoyer une campagne newsletter HTML (FR/AR) via SMTP' })
  sendNewsletterCampaign(@Body() dto: SendNewsletterCampaignDto, @Req() req: any) {
    return this.service.sendNewsletterCampaign(dto, req.user?.email || 'STAFF');
  }

  @Get('sales-report')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permissions('reports_sales:read')
  @ApiOperation({ summary: 'Rapport financier des ventes et marges depuis PostgreSQL' })
  getSalesReport() {
    return this.service.getSalesReport();
  }

  @Get('analytics-report')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permissions('reports:read')
  @ApiOperation({ summary: 'Rapport d’audience et de consultation Storefront depuis PostgreSQL' })
  getAnalyticsReport() {
    return this.service.getAnalyticsReport();
  }

  @Get('interactions-report')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permissions('interactions:read')
  @ApiOperation({ summary: 'Télémétrie complète des interactions clients (likes, dislikes, favoris, avis, vues)' })
  getInteractionsReport() {
    return this.service.getInteractionsReport();
  }

  @Get('treasury-report')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permissions('treasury:read|reports:read')
  @ApiOperation({ summary: 'Rapport temps réel des caisses, encaissements, décaissements et couverture trésorerie' })
  getTreasuryReport() {
    return this.service.getTreasuryReport();
  }

  @Get('admin/reviews')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permissions('reviews:read')
  @ApiOperation({ summary: 'Lister tous les avis & commentaires pour modération (ROOT/Super Admin/Website Manager)' })
  listAdminReviews() {
    return this.service.listAdminReviews();
  }

  @Patch('admin/reviews/:id/status')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permissions('reviews:update')
  moderateReview(
    @Param('id') id: string,
    @Body() dto: ModerateReviewDto,
    @CurrentUser('email') email?: string,
  ) {
    return this.service.moderateReview(id, dto, email);
  }

  @Delete('admin/reviews/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permissions('reviews:delete')
  deleteAdminReview(@Param('id') id: string) {
    return this.service.deleteAdminReview(id);
  }

  @Post('admin/reviews/bulk-action')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permissions('reviews:update')
  @ApiOperation({ summary: 'Modération ou suppression groupée des avis clients' })
  bulkActionReviews(
    @Body() body: { ids: string[]; action: 'STATUS' | 'DELETE'; status?: 'APPROVED' | 'REJECTED' | 'PENDING' },
    @CurrentUser('email') email?: string,
  ) {
    return this.service.bulkActionReviews(body.ids || [], body.action, body.status, email);
  }

  @Get('notifications')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permissions('notifications:read')
  listNotifications(@CurrentUser('id') userId: string, @Query() query: any) {
    return this.service.listNotifications(userId, query);
  }

  @Post('notifications/bulk-action')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permissions('notifications:update')
  @ApiOperation({ summary: 'Marquer lu/non lu ou supprimer plusieurs notifications' })
  bulkActionNotifications(
    @Body() body: { ids: string[]; action: 'MARK_READ' | 'MARK_UNREAD' | 'DELETE' },
  ) {
    return this.service.bulkActionNotifications(body.ids || [], body.action);
  }

  @Patch('notifications/:id/read')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permissions('notifications:update')
  toggleNotificationRead(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.service.toggleNotificationRead(id, userId);
  }

  @Patch('notifications/read-all')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permissions('notifications:update')
  markAllNotificationsRead(@CurrentUser('id') userId: string) {
    return this.service.markAllNotificationsRead(userId);
  }

  @Delete('notifications/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permissions('notifications:delete')
  deleteNotification(@Param('id') id: string) {
    return this.service.deleteNotification(id);
  }

  @Get('my-profile')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Récupérer le profil personnel connecté' })
  getMyProfile(@CurrentUser('id') userId: string) {
    return this.service.getMyProfile(userId);
  }

  @Patch('my-profile')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Mettre à jour le profil personnel connecté' })
  updateMyProfile(@CurrentUser('id') userId: string, @Body() dto: UpdateMyProfileDto) {
    return this.service.updateMyProfile(userId, dto);
  }

  @Get('my-timeline')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Fil d’actualité / Chronologie des activités client VIP' })
  getMyTimeline(@CurrentUser('id') userId: string) {
    return this.service.getMyTimeline(userId);
  }

  @Get('my-interactions')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Articles et commandes interagis par le client (Like, Dislike, Avis, Favoris, Commandes)' })
  getMyInteractions(@CurrentUser('id') userId: string) {
    return this.service.getMyInteractions(userId);
  }

  @Get('my-wishlist')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Liste des articles dans la wishlist du client connecté' })
  getMyWishlist(@CurrentUser('id') userId: string) {
    return this.service.getMyWishlistProducts(userId);
  }

  @Post('wishlist/toggle')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Ajouter ou retirer un article de la liste d’envies (Wishlist uniquement)' })
  toggleWishlist(@CurrentUser('id') userId: string, @Body() dto: ToggleWishlistDto) {
    return this.service.toggleCustomerWishlist(userId, dto);
  }

  @Get('my-reactions')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Récupérer les likes et dislikes du client connecté' })
  getMyReactions(@CurrentUser('id') userId: string) {
    return this.service.getMyReactions(userId);
  }

  @Get('my-reviews')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Récupérer les avis laissés par le client connecté' })
  getMyReviews(@CurrentUser('id') userId: string) {
    return this.service.getMyReviews(userId);
  }

  @Get('my-notifications')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Notifications personnelles + flux promos/nouveautés/commandes pour le client connecté' })
  getMyClientNotifications(@CurrentUser('id') userId: string, @Query() query: any) {
    return this.service.getClientNotificationsFeed(userId, query);
  }

  @Post('my-notifications/bulk-action')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Marquer lu/non lu ou supprimer plusieurs notifications client' })
  bulkActionMyNotifications(
    @Body() body: { ids: string[]; action: 'MARK_READ' | 'MARK_UNREAD' | 'DELETE' },
    @CurrentUser('id') userId: string,
  ) {
    return this.service.bulkActionNotifications(body.ids || [], body.action, userId);
  }

  @Patch('my-notifications/:id/read')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  toggleMyNotificationRead(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.service.toggleNotificationRead(id, userId, true);
  }

  @Patch('my-notifications/read-all')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  markAllMyNotificationsRead(@CurrentUser('id') userId: string) {
    return this.service.markAllNotificationsRead(userId, true);
  }

  @Delete('my-notifications/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  deleteMyNotification(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.service.deleteNotification(id, userId);
  }

  @Get('support/my-threads')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Discussions du client avec Royal Support (ROOT, SuperAdmin, Website Manager)' })
  getMySupportThreads(@CurrentUser('id') userId: string) {
    return this.service.getMySupportThreads(userId);
  }

  @Post('support/messages')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Envoyer un message au Support Royal (visible par ROOT, SuperAdmin, Website Manager)' })
  sendClientSupportMessage(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateSupportMessageDto,
  ) {
    return this.service.sendClientSupportMessage(userId, dto);
  }

  @Get('support/admin/threads')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permissions('support:read')
  @ApiOperation({ summary: 'Toutes les discussions Support Client visibles par ROOT / SuperAdmin / Website Manager' })
  listAdminSupportThreads() {
    return this.service.listAdminSupportThreads();
  }

  @Post('support/admin/threads/:id/reply')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permissions('support:create')
  @ApiOperation({ summary: 'Répondre dans une discussion client en tant que ROOT / SuperAdmin / Website Manager' })
  replyAdminSupportThread(
    @Param('id') threadId: string,
    @CurrentUser('id') adminUserId: string,
    @Body() dto: ReplySupportThreadDto,
  ) {
    return this.service.replyAdminSupportThread(threadId, adminUserId, dto);
  }

  @Patch('support/admin/threads/:id/status')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permissions('support:update')
  updateSupportThreadStatus(@Param('id') id: string, @Body() dto: UpdateSupportStatusDto) {
    return this.service.updateSupportThreadStatus(id, dto);
  }

  @Post('support/admin/threads/bulk-action')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permissions('support:update')
  @ApiOperation({ summary: 'Changer statut ou supprimer plusieurs fils de discussion Support' })
  bulkActionSupportThreads(
    @Body() body: { ids: string[]; action: 'STATUS' | 'DELETE'; status?: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' },
  ) {
    return this.service.bulkActionSupportThreads(body.ids || [], body.action, body.status);
  }

  @Post('reactions/toggle')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Aimer (LIKE) ou ne pas aimer (DISLIKE) un article' })
  toggleReaction(@CurrentUser('id') userId: string, @Body() dto: ToggleReactionDto) {
    return this.service.toggleProductReaction(userId, dto);
  }

  @Get('admin/faq-all')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permissions('settings:read')
  getAllFaqAdmin() {
    return this.service.getFaq(true);
  }

  @Patch('cms/identity')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RootOnlyGuard)
  updateCmsIdentity(@Body() dto: UpdateCmsIdentityDto, @Req() req: any) {
    return this.service.updateCmsIdentity(dto, req.user?.email);
  }

  @Patch('cms/layout')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RootOnlyGuard)
  updateCmsLayout(@Body() dto: UpdateCmsLayoutDto, @Req() req: any) {
    return this.service.updateCmsLayout(dto, req.user?.email);
  }

  @Patch('cms/views')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RootOnlyGuard)
  updateCmsViews(@Body() dto: UpdateCmsViewsDto, @Req() req: any) {
    return this.service.updateCmsViews(dto, req.user?.email);
  }

  @Post('cms/reset-defaults')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RootOnlyGuard)
  resetCmsDefaults(@Req() req: any, @Body() dto?: ResetCmsDefaultsDto) {
    return this.service.resetCmsDefaults(req.user?.email, dto?.scope, dto?.viewKey);
  }

  @Get('cms/custom-views')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RootOnlyGuard)
  listCustomViewsAdmin() {
    return this.service.listCustomViews(true);
  }

  @Public()
  @Get('cms/custom-views/public/:slug')
  getPublicCustomView(@Param('slug') slug: string) {
    return this.service.getPublicCustomViewBySlug(slug);
  }

  @Post('cms/custom-views')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RootOnlyGuard)
  createCustomView(@Body() dto: UpsertCustomViewDto, @Req() req: any) {
    return this.service.upsertCustomView(null, dto, req.user?.email);
  }

  @Patch('cms/custom-views/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RootOnlyGuard)
  updateCustomView(@Param('id') id: string, @Body() dto: UpsertCustomViewDto, @Req() req: any) {
    return this.service.upsertCustomView(id, dto, req.user?.email);
  }

  @Delete('cms/custom-views/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RootOnlyGuard)
  deleteCustomView(@Param('id') id: string, @Req() req: any) {
    return this.service.deleteCustomView(id, req.user?.email);
  }

  @Public()
  @Get('visibility-config')
  getVisibilityConfig() {
    return this.service.getSysConfig('visibility');
  }

  @Get('role-views-config')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Matrice dynamique des vues Dashboard autorisées par rôle' })
  getRoleViewsConfig(@Req() req: any) {
    this.ensureStaff(req);
    return this.service.getSysConfig('roleViews');
  }

  @Get('cms/testimonials')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permissions('reviews:read')
  listCuratedTestimonials() {
    return this.service.listCuratedTestimonials();
  }

  @Post('cms/testimonials')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permissions('reviews:update')
  createCuratedTestimonial(@Body() dto: UpsertCuratedTestimonialDto, @Req() req: any) {
    return this.service.createCuratedTestimonial(dto, req.user?.email);
  }

  @Patch('cms/testimonials/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permissions('reviews:update')
  updateCuratedTestimonial(@Param('id') id: string, @Body() dto: Partial<UpsertCuratedTestimonialDto>, @Req() req: any) {
    return this.service.updateCuratedTestimonial(id, dto, req.user?.email);
  }

  @Delete('cms/testimonials/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permissions('reviews:delete')
  deleteCuratedTestimonial(@Param('id') id: string, @Req() req: any) {
    return this.service.deleteCuratedTestimonial(id, req.user?.email);
  }

  @Get('cms/email-templates')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Lister les modèles d’e-mails HTML (FR / AR) pour console et composition' })
  listEmailTemplates(@Req() req: any) {
    this.ensureStaff(req);
    return this.service.listEmailTemplates();
  }

  @Post('cms/email-templates/preview')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Compiler un aperçu HTML Light Luxury (FR ou AR RTL) côté serveur' })
  previewEmailTemplate(@Body() dto: PreviewEmailTemplateDto, @Req() req: any) {
    this.ensureStaff(req);
    return this.service.previewEmailTemplate(dto);
  }

  @Post('cms/email-templates/send-test')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RootOnlyGuard)
  @ApiOperation({ summary: 'Envoyer un e-mail de test HTML (FR ou AR) via SMTP' })
  sendTestEmailTemplate(@Body() dto: SendTestEmailTemplateDto, @Req() req: any) {
    return this.service.sendTestEmailTemplate(dto, req.user?.email || 'ROOT');
  }

  @Post('cms/email-templates/:id/reset-default')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RootOnlyGuard)
  @ApiOperation({ summary: 'Restaurer un modèle par défaut FR/AR Light Luxury' })
  resetEmailTemplateDefault(@Param('id') id: string) {
    return this.service.resetEmailTemplateDefault(id);
  }

  @Get('cms/email-logs')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RootOnlyGuard)
  @ApiOperation({ summary: 'Historique récent des envois e-mail SMTP (email_logs)' })
  listEmailLogs(@Query('limit') limit?: string) {
    return this.service.listEmailLogs(limit ? Number(limit) : 50);
  }

  @Post('cms/email-templates')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RootOnlyGuard)
  createEmailTemplate(@Body() dto: UpsertEmailTemplateDto) {
    return this.service.upsertEmailTemplate(null, dto);
  }

  @Patch('cms/email-templates/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RootOnlyGuard)
  updateEmailTemplate(@Param('id') id: string, @Body() dto: Partial<UpsertEmailTemplateDto>) {
    return this.service.upsertEmailTemplate(id, dto);
  }

  @Delete('cms/email-templates/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RootOnlyGuard)
  deleteEmailTemplate(@Param('id') id: string) {
    return this.service.deleteEmailTemplate(id);
  }

  @Get('section-dashboard/:section')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  getSectionDashboard(@Param('section') section: string, @Req() req: any) {
    this.ensureStaff(req);
    return this.service.getSectionDashboard(section);
  }

  @Get('cms/prospects')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permissions('suppliers:read')
  listProspects() {
    return this.service.listProspects();
  }

  @Post('cms/prospects')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permissions('suppliers:create')
  saveProspects(@Body() body: { prospects: any[] }, @Req() req: any) {
    return this.service.saveProspects(body.prospects || [], req.user?.email);
  }

  @Get('cms/showrooms')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permissions('pos:read')
  listShowrooms() {
    return this.service.listShowrooms();
  }

  @Post('cms/showrooms')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permissions('pos:create')
  createShowroom(@Body() dto: UpsertShowroomDto) {
    return this.service.createShowroom(dto);
  }

  @Patch('cms/showrooms/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permissions('pos:update')
  updateShowroom(@Param('id') id: string, @Body() dto: Partial<UpsertShowroomDto>) {
    return this.service.updateShowroom(id, dto);
  }

  @Delete('cms/showrooms/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permissions('pos:delete')
  deleteShowroom(@Param('id') id: string) {
    return this.service.deleteShowroom(id);
  }

  @Post('cms/showrooms/bulk-action')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permissions('pos:update')
  bulkActionShowrooms(@Body() body: { ids: string[]; action: 'ACTIVATE' | 'DEACTIVATE' | 'DELETE' }) {
    return this.service.bulkActionShowrooms(body?.ids || [], body?.action || 'ACTIVATE');
  }

  @Post('cms/upload-image')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permissions('settings:update')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  uploadBrandingImage(@UploadedFile() file: any) {
    if (!file) {
      throw new BadRequestException('Aucun fichier image fourni.');
    }
    return this.service.saveBrandingImage(file);
  }

  @Public()
  @Get('media/:filename')
  async serveMedia(@Param('filename') filename: string, @Res() res: Response) {
    const { buffer, contentType } = await this.service.readBrandingImage(filename);
    res.setHeader('Content-Type', contentType);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "sandbox; default-src 'none'; img-src 'self'");
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(buffer);
  }

  private getRequestRoles(req: any): string[] {
    const userRoles: string[] = Array.isArray(req.user?.roles)
      ? req.user.roles.map((r: any) => (typeof r === 'string' ? r : r?.role || r?.name)).filter(Boolean)
      : [req.user?.role].filter(Boolean);
    return userRoles.map((r) => String(r).toUpperCase());
  }

  private isRootRequest(req: any): boolean {
    return this.getRequestRoles(req).includes('ROOT');
  }

  private ensureStaff(req: any): void {
    const roles = this.getRequestRoles(req);
    if (roles.length === 0 || roles.every((r) => r === 'CLIENT')) {
      throw new ForbiddenException('Accès réservé au personnel administratif Royal.');
    }
  }

  @Get('sys-config/:key')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  getSysConfig(@Param('key') key: string, @Req() req: any) {
    return this.service.getSysConfigAuthorized(key, req.user);
  }

  @Put('sys-config/:key')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async updateSysConfig(@Param('key') key: string, @Body() dto: UpdateSysConfigDto, @Req() req: any) {
    await this.service.assertSysConfigAccess(req.user, key, true);
    return this.service.updateSysConfig(key, dto.value, req.user?.email);
  }

  @Post('smtp-test')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RootOnlyGuard)
  testSmtp(@Body() dto: SmtpTestDto) {
    return this.service.testSmtpConnection(dto);
  }

  @Post('media/test-storage')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permissions('settings:update')
  testMediaStorage(@Body() dto: TestMediaStorageDto, @Req() req: any) {
    if (!this.isRootRequest(req)) {
      throw new ForbiddenException('Seul le compte ROOT peut tester le stockage médias.');
    }
    return this.service.testMediaStorage(dto?.config);
  }

  @Public()
  @Get('public-payment-gateways')
  @ApiOperation({ summary: 'Passerelles de paiement publiques visibles sur le checkout' })
  getPublicPaymentGateways() {
    return this.service.getPublicPaymentGateways();
  }

  @Public()
  @Throttle({ default: { limit: 15, ttl: 60000 } })
  @Post('payments/flouci/init')
  @ApiOperation({ summary: 'Initialiser un paiement Flouci TND pour une commande' })
  initFlouciPayment(@Body() dto: FlouciInitDto) {
    return this.service.initFlouciPayment(dto);
  }

  @Public()
  @Post('webhooks/carrier/:carrierCode')
  @ApiOperation({ summary: 'Webhook transporteur tunisien (Aramex, First Delivery, Intigo)' })
  receiveCarrierWebhook(
    @Param('carrierCode') carrierCode: string,
    @Body() dto: CarrierWebhookDto,
    @Req() req: any,
  ) {
    const headerSecret = req.headers?.['x-webhook-secret'] || req.headers?.['x-api-key'];
    return this.service.processCarrierWebhook(carrierCode, dto, String(headerSecret || ''), false);
  }

  @Post('webhooks/carrier-test/:carrierCode')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permissions('orders:update')
  testCarrierWebhook(@Param('carrierCode') carrierCode: string, @Body() dto: CarrierWebhookDto) {
    return this.service.processCarrierWebhook(carrierCode, dto, undefined, true);
  }

  @Post('orders/:id/send-delivery-documents')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permissions('orders:update')
  sendOrderDeliveryDocuments(
    @Param('id') id: string,
    @Body() dto: SendDeliveryDocumentsDto,
    @Req() req: any,
  ) {
    return this.service.sendOrderDeliveryDocuments(id, dto, req.user?.email || 'STAFF');
  }

  @Get('ai/availability')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  getAiAvailability(@Req() req: any) {
    this.ensureStaff(req);
    return this.service.getAiAvailability();
  }

  @Post('ai/jobs')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  startAiJob(@Body() dto: AiGenerateDto, @Req() req: any) {
    this.ensureStaff(req);
    if (dto.mode === 'TEST' && !this.isRootRequest(req)) {
      throw new ForbiddenException('Seul le compte ROOT peut lancer un test fournisseur IA.');
    }
    return this.service.startAiJob(dto, dto.mode === 'TEST' && this.isRootRequest(req));
  }

  @Get('ai/jobs/:jobId')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  getAiJobStatus(@Param('jobId') jobId: string, @Req() req: any) {
    this.ensureStaff(req);
    return this.service.getAiJobStatus(jobId);
  }

  @Post('ai/jobs/:jobId/cancel')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  cancelAiJob(@Param('jobId') jobId: string, @Req() req: any) {
    this.ensureStaff(req);
    return this.service.cancelAiJob(jobId);
  }

  @Post('ai/generate')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  generateAiContent(@Body() dto: AiGenerateDto, @Req() req: any) {
    this.ensureStaff(req);
    return this.service.generateAiContent(dto, false);
  }

  @Post('ai/test')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permissions('settings:update')
  testAiConnection(@Body() dto: AiGenerateDto, @Req() req: any) {
    if (!this.isRootRequest(req)) {
      throw new ForbiddenException('Seul le compte ROOT peut tester le fournisseur IA.');
    }
    return this.service.generateAiContent({ ...dto, mode: 'TEST' }, true);
  }

  @Post('ai/models')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permissions('settings:update')
  listAiModels(@Body() body: { provider?: string; apiKey?: string }, @Req() req: any) {
    if (!this.isRootRequest(req)) {
      throw new ForbiddenException('Seul le compte ROOT peut consulter les modèles IA.');
    }
    return this.service.listAiProviderModels(body?.provider, body?.apiKey);
  }

  @Get('pos-printers')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async getPosPrinters(@Req() req: any) {
    this.ensureStaff(req);
    const res = await this.service.getSysConfig('printers');
    return Array.isArray(res?.value) ? res.value : [];
  }

  @Public()
  @Get('public-print-config')
  getPublicPrintConfig() {
    return this.service.getPublicPrintConfig();
  }

  @Public()
  @Get('public-marketing-pixels')
  @ApiOperation({ summary: 'Configuration publique des Pixels Marketing et méta-données SEO' })
  async getPublicMarketingPixels() {
    const res = await this.service.getSysConfig('marketingPixels');
    return res?.value || {};
  }

  @Post('stock-lifecycle/apply')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permissions('inventory:adjust|inventory:update|inventory:manage|deliveries:update|invoices:update|returns:update|stock_in:update|stock_out:update')
  applyStockLifecycle(@Body() dto: ApplyStockLifecycleDto, @Req() req: any) {
    return this.service.applyStockLifecycle(dto, req.user?.email || req.user?.id || 'SYSTEM');
  }
}
