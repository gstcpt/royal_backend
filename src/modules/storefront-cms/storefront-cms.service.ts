import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as net from 'net';
import { PrismaService } from '../../database/prisma.service';
import { storeMediaAsset } from './utils/media-storage.helper';
import { buildDocumentPdfBuffer, sendSmtpMailWithAttachments } from './utils/pdf-smtp.helper';
import {
  generateAiCompletion,
  runResilientAiFailoverLoop,
  AiProgressEvent,
  AiQuotaExhaustedError,
  AiProviderConfig,
  extractJsonBlock,
  listGroqChatModels,
  GEMINI_DEFAULT_MODELS,
  GROQ_PREFERRED_CHAT_MODELS,
} from './utils/ai-provider.helper';
import {
  CreateContactDto,
  CreateProductReviewDto,
  CreateSupportMessageDto,
  ModerateReviewDto,
  ReplySupportThreadDto,
  SmtpTestDto,
  SubscribeNewsletterDto,
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
  UpsertCuratedTestimonialDto,
  UpsertEmailTemplateDto,
  UpsertFaqDto,
  UpsertShowroomDto,
} from './dto/storefront-cms.dto';

export const ROYAL_CONTACT_INFO = {
  companyName: 'Royal — Electro de Maison',
  address: 'Mahdia 5100, Tunisia',
  email: 'royaltn24@gmail.com',
  phone: '48 091 914',
  whatsapp: '48091914',
  tiktok: 'https://www.tiktok.com/@electrome1',
  instagram: 'https://www.instagram.com/royal_electr',
  facebook: 'https://www.facebook.com/people/Royaltn/61584896805901',
};

const DEFAULT_THEME = {
  primaryHex: '#C59B27',
  primaryHoverHex: '#A67C1E',
  primaryTextHex: '#FFFFFF',
  inkHex: '#1D232E',
  goldHex: '#C59B27',
  goldDarkHex: '#9A7414',
  goldLightHex: '#FBF6E8',
  silverHex: '#CBD5E1',
  silverLightHex: '#F4F5F7',
  backgroundHex: '#FDFCF9',
  cardHex: '#FFFFFF',
  borderHex: '#E6E1D6',
  headingFont: 'Poppins',
  bodyFont: 'Poppins',
  arabicFont: 'Cairo',
};

const DEFAULT_HEADER = {
  announcementText: 'Livraison 24–48h partout en Tunisie',
  showSearch: true,
  showLanguageSwitch: true,
  showCompare: true,
  showWishlist: true,
  showTrackOrder: true,
};

const DEFAULT_FOOTER = {
  aboutDescription:
    'Boutique spécialisée en petit et gros électroménager de qualité, arts de la table et équipements culinaires modernes en Tunisie.',
  col1Title: 'À Propos',
  col1Links: [
    { label: 'À propos de Royal', href: '/about' },
    { label: 'Nos Showrooms Tunisie', href: '/showrooms' },
    { label: 'Engagement Qualité', href: '/contact' },
  ],
  col2Title: 'Rayons & Articles',
  col2Links: [
    { label: 'Tous les Articles', href: '/articles' },
    { label: 'Nouveautés Catalogue', href: '/articles?sortBy=newest' },
    { label: 'Promotions TND', href: '/articles?sortBy=promo' },
    { label: 'Comparateur Produits', href: '/compare' },
  ],
  col3Title: 'Informations & Aide',
  col3Links: [
    { label: 'Suivre ma Commande', href: '/track-order' },
    { label: 'Foire Aux Questions (FAQ)', href: '/faq' },
    { label: 'Conditions Générales', href: '/terms' },
    { label: 'Confidentialité & Données', href: '/privacy' },
  ],
  col4Title: 'Contact & Coordonnées',
  copyrightText: 'Royal — Électro de Maison (Mahdia, Tunisie). Tous droits réservés.',
};

const DEFAULT_VIEWS = {
  home: {
    showHeroSlider: true,
    heroAutoplayMs: 6000,
    heroHeightPx: 720,
    cardImageHeightPx: 280,
    sectionOrder: [
      'hero',
      'categories',
      'valueProps',
      'newArrivals',
      'editorialBanner',
      'topRated',
      'lifestyle',
      'promotions',
      'featuredVideo',
      'testimonials',
      'newsletter',
    ],
    showCategoriesCarousel: true,
    showValueProps: true,
    showNewArrivals: true,
    showFeaturedVideo: true,
    showTopRated: true,
    showEditorialBanner: true,
    showPromotions: true,
    showLifestyleGallery: true,
    showTestimonials: true,
    showNewsletter: true,
  },
  articles: {
    defaultColumns: '3',
    defaultItemsPerPage: 12,
    paginationMode: 'PAGINATION' as 'PAGINATION' | 'LOAD_MORE',
    cardImageHeightPx: 260,
    showCompareButton: true,
    showWishlistButton: true,
    showQuickViewButton: true,
    showBuyButton: true,
    showLikeDislike: true,
    showSidebarFiltersByDefault: true,
  },
  productDetail: {
    showReviews: true,
    showRatings: true,
    showSpecs: true,
    showRelatedProducts: true,
    showShareButton: true,
    showWishlist: true,
    showCompare: true,
    showLikeDislike: true,
    enableImageZoom: true,
    enableImageAutoplay: true,
    mediaColumnSpan: 7,
    galleryHeightPx: 540,
  },
  contact: {
    showMap: true,
    mapHeightPx: 380,
    mapEmbedUrl:
      'https://www.openstreetmap.org/export/embed.html?bbox=11.028%2C35.485%2C11.088%2C35.525&layer=mapnik&marker=35.5047%2C11.0622',
    showInfoCards: true,
    phoneRequired: true,
    emailRequired: false,
    subjectRequired: true,
  },
  faq: {
    title: 'Foire Aux Questions',
    subtitle: 'Trouvez rapidement les réponses à vos questions sur la livraison, la garantie et nos produits.',
    showSearch: true,
  },
  showrooms: {
    enabled: false,
    layoutStyle: 'grid',
    showMap: true,
    showHours: true,
    showPhone: true,
    sectionOrder: ['hero', 'cards', 'map'],
  },
  terms: {
    sectionOrder: ['header', 'document', 'footerNote'],
    showBackLink: true,
    badgeText: 'Informations Légales Royal',
    showFooterNote: true,
    footerNoteText: 'Document mis à jour conformément à la réglementation tunisienne du commerce électronique.',
  },
  privacy: {
    sectionOrder: ['header', 'document', 'footerNote'],
    showBackLink: true,
    badgeText: 'Protection des Données',
    showFooterNote: true,
    footerNoteText: 'Pour toute demande relative à vos données personnelles, contactez notre support à royaltn24@gmail.com.',
  },
};

@Injectable()
export class StorefrontCmsService {
  constructor(private readonly prisma: PrismaService) {}

  private parseJsonSetting<T>(raw: string | undefined, fallback: T): T {
    if (!raw) return fallback;
    try {
      const parsed = JSON.parse(raw);
      return typeof parsed === 'object' && parsed !== null
        ? Array.isArray(fallback)
          ? (parsed as T)
          : ({ ...fallback, ...parsed } as T)
        : fallback;
    } catch {
      return fallback;
    }
  }

  private defaultsSnapshotCache: any = null;
  private publicConfigCache: { value: any; expiresAt: number } | null = null;
  private sysConfigCache = new Map<string, { value: any; expiresAt: number }>();

  private invalidateCaches(key?: string) {
    this.publicConfigCache = null;
    if (key) {
      this.sysConfigCache.delete(key);
    } else {
      this.sysConfigCache.clear();
    }
  }

  private async upsertSetting(key: string, value: string, group: string, updatedBy?: string) {
    const res = await this.prisma.settings.upsert({
      where: { key },
      update: { value, group, updatedBy: updatedBy || 'ROOT' },
      create: { key, value, group, isSecret: false, updatedBy: updatedBy || 'ROOT' },
    });
    const sysKey = key.startsWith('sys.') ? key.slice(4) : undefined;
    this.invalidateCaches(sysKey);
    return res;
  }

  private getDefaultsSnapshot(): any {
    if (this.defaultsSnapshotCache) {
      return this.defaultsSnapshotCache;
    }
    const candidates = [
      path.join(__dirname, 'cms-defaults.json'),
      path.resolve(process.cwd(), 'src', 'modules', 'storefront-cms', 'cms-defaults.json'),
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) {
        try {
          this.defaultsSnapshotCache = JSON.parse(fs.readFileSync(p, 'utf8'));
          return this.defaultsSnapshotCache;
        } catch {
          // ignore parse error
        }
      }
    }
    this.defaultsSnapshotCache = {
      identity: { ...ROYAL_CONTACT_INFO, appName: 'Royal', logoUrl: '/images/royal-logo.jpg', faviconUrl: '/icon.png' },
      theme: DEFAULT_THEME,
      header: DEFAULT_HEADER,
      footer: DEFAULT_FOOTER,
      views: DEFAULT_VIEWS,
      heroSlides: [],
    };
    return this.defaultsSnapshotCache;
  }

  private sanitizeHeroSlides(raw: any, fallback: any[]): any[] {
    const builtinFallback = [
      {
        id: 'slide-1',
        tagline: 'INNOVATION CULINAIRE & CONFORT',
        title: 'L’Art de Vivre.',
        highlightText: 'La Précision Culinaire.',
        subtitle:
          'Découvrez notre collection exclusive d’équipements culinaires, friteuses sans huile, robots pétrins et appareils conçus pour durer.',
        primaryCtaText: 'Explorer la Collection',
        primaryCtaLink: '/articles',
        imageUrl:
          'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=1920&q=90',
      },
      {
        id: 'slide-2',
        tagline: 'GROS ÉLECTROMÉNAGER & CUISSON',
        title: 'Fours & Plaques.',
        highlightText: 'Ingénierie & Performance.',
        subtitle:
          'Chaleur tournante, foyers haute puissance et finitions inox brossé. Équipez votre cuisine avec les références les plus fiables.',
        primaryCtaText: 'Voir les Nouveautés',
        primaryCtaLink: '/articles?sortBy=newest',
        imageUrl:
          'https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=1920&q=90',
      },
      {
        id: 'slide-3',
        tagline: 'OFFRES PRIVILÈGES ROYAL',
        title: 'Équipez Votre Maison.',
        highlightText: 'Qualité & Prix Directs.',
        subtitle:
          'Profitez de nos promotions actives avec garantie constructeur et livraison rapide partout dans les 24 gouvernorats de Tunisie.',
        primaryCtaText: 'Voir les Promotions',
        primaryCtaLink: '/articles?sortBy=promo',
        imageUrl:
          'https://images.unsplash.com/photo-1565538810643-b5bdb714032a?auto=format&fit=crop&w=1920&q=90',
      },
    ];
    const cleanFallback =
      Array.isArray(fallback) &&
      fallback.some(
        (s) => s && typeof s === 'object' && !Array.isArray(s) && (s.title || s.imageUrl),
      )
        ? fallback
        : builtinFallback;

    const list = Array.isArray(raw) ? raw : [];
    const valid = list
      .filter(
        (s) =>
          s &&
          typeof s === 'object' &&
          !Array.isArray(s) &&
          ((typeof s.title === 'string' && s.title.trim() !== '') ||
            (typeof s.imageUrl === 'string' && s.imageUrl.trim() !== '')),
      )
      .map((s, idx) => {
        const fb = cleanFallback[idx % cleanFallback.length];
        return {
          ...s,
          id: typeof s.id === 'string' && s.id.trim() ? s.id : `slide-${idx + 1}`,
          title: typeof s.title === 'string' && s.title.trim() ? s.title : fb.title,
          subtitle: typeof s.subtitle === 'string' ? s.subtitle : fb.subtitle || '',
          primaryCtaText:
            typeof s.primaryCtaText === 'string' && s.primaryCtaText.trim()
              ? s.primaryCtaText
              : fb.primaryCtaText || 'Découvrir',
          primaryCtaLink:
            typeof s.primaryCtaLink === 'string' && s.primaryCtaLink.trim()
              ? s.primaryCtaLink
              : fb.primaryCtaLink || '/articles',
          imageUrl:
            typeof s.imageUrl === 'string' && s.imageUrl.trim() ? s.imageUrl : fb.imageUrl,
        };
      });

    return valid.length > 0 ? valid : cleanFallback;
  }

  async getPublicConfig() {
    if (this.publicConfigCache && Date.now() < this.publicConfigCache.expiresAt) {
      return this.publicConfigCache.value;
    }

    const snap = this.getDefaultsSnapshot();
    const [settings, activeShowrooms, approvedReviews] = await Promise.all([
      this.prisma.settings.findMany({
        where: {
          key: {
            in: [
              'shipping.free_threshold',
              'shipping.standard_fee',
              'branding.app_name',
              'branding.app_logo_url',
              'branding.favicon_url',
              'cms.identity',
              'cms.theme',
              'cms.header',
              'cms.footer',
              'cms.views',
              'cms.heroSlides',
              'cms.testimonials',
              'sys.translations',
            ],
          },
        },
      }),
      this.prisma.pointOfSale.findMany({
        where: { isActive: true },
        orderBy: { createdAt: 'asc' },
        select: { id: true, name: true, code: true, address: true, phone: true },
      }),
      this.prisma.review.findMany({
        where: { status: 'APPROVED' },
        orderBy: { createdAt: 'desc' },
        take: 6,
        select: {
          id: true,
          rating: true,
          body: true,
          createdAt: true,
          customer: {
            select: {
              firstName: true,
              lastName: true,
              addresses: { take: 1, select: { city: true } },
            },
          },
        },
      }),
    ]);
    const map = new Map(settings.map((s) => [s.key, s.value]));

    const identity = this.parseJsonSetting(map.get('cms.identity'), {
      appName: map.get('branding.app_name') || snap.identity?.appName || 'Royal',
      slogan: snap.identity?.slogan || 'Electro de Maison • Équipement Culinaire & Électroménager Tunisie',
      logoUrl: map.get('branding.app_logo_url') || snap.identity?.logoUrl || '/images/royal-logo.jpg',
      faviconUrl: map.get('branding.favicon_url') || snap.identity?.faviconUrl || '/icon.png',
      ...ROYAL_CONTACT_INFO,
      showrooms: snap.identity?.showrooms || [],
    });

    const theme = this.parseJsonSetting(map.get('cms.theme'), snap.theme || DEFAULT_THEME);
    const header = this.parseJsonSetting(map.get('cms.header'), snap.header || DEFAULT_HEADER);
    const footer = this.parseJsonSetting(map.get('cms.footer'), snap.footer || DEFAULT_FOOTER);
    const rawViews = this.parseJsonSetting<any>(map.get('cms.views'), {});
    const defaultViews = snap.views || DEFAULT_VIEWS;
    const views = {
      home: { ...DEFAULT_VIEWS.home, ...(defaultViews.home || {}), ...(rawViews.home || {}) },
      articles: { ...DEFAULT_VIEWS.articles, ...(defaultViews.articles || {}), ...(rawViews.articles || {}) },
      productDetail: { ...DEFAULT_VIEWS.productDetail, ...(defaultViews.productDetail || {}), ...(rawViews.productDetail || {}) },
      contact: { ...DEFAULT_VIEWS.contact, ...(defaultViews.contact || {}), ...(rawViews.contact || {}) },
      faq: { ...DEFAULT_VIEWS.faq, ...(defaultViews.faq || {}), ...(rawViews.faq || {}) },
      showrooms: { ...DEFAULT_VIEWS.showrooms, ...(defaultViews.showrooms || {}), ...(rawViews.showrooms || {}) },
      terms: { ...DEFAULT_VIEWS.terms, ...((defaultViews as any).terms || {}), ...(rawViews.terms || {}) },
      privacy: { ...DEFAULT_VIEWS.privacy, ...((defaultViews as any).privacy || {}), ...(rawViews.privacy || {}) },
    };
    const rawHeroSlides = this.parseJsonSetting<any[]>(map.get('cms.heroSlides'), []);
    const heroSlides = this.sanitizeHeroSlides(rawHeroSlides, snap.heroSlides || []);
    const curatedTestimonials = this.parseJsonSetting<any[]>(map.get('cms.testimonials'), []);
    const fallbackDbTestimonials = approvedReviews.map((r) => ({
      id: r.id,
      name: `${r.customer?.firstName || 'Client'} ${r.customer?.lastName || 'Royal'}`.trim(),
      city: r.customer?.addresses?.[0]?.city || 'Tunisie',
      dateLabel: new Date(r.createdAt).toLocaleDateString('fr-FR'),
      avatar: null,
      stars: r.rating,
      comment: r.body || '',
      isActive: true,
    }));
    const activeTestimonials =
      Array.isArray(curatedTestimonials) && curatedTestimonials.length > 0
        ? curatedTestimonials.filter((t) => t.isActive !== false)
        : fallbackDbTestimonials;
    const translations = this.parseJsonSetting<any>(map.get('sys.translations'), null);

    const payload = {
      appName: identity.appName || 'Royal',
      logoUrl: identity.logoUrl || '/images/royal-logo.jpg',
      faviconUrl: identity.faviconUrl || '/icon.png',
      freeShippingThreshold: Number(map.get('shipping.free_threshold') ?? 150),
      standardShippingFee: Number(map.get('shipping.standard_fee') ?? 7),
      identity: {
        ...identity,
        showrooms:
          Array.isArray(identity.showrooms) && identity.showrooms.length > 0
            ? identity.showrooms
            : activeShowrooms.map((s) => ({
                id: s.id,
                name: s.name,
                city: s.code || 'Tunisie',
                address: s.address || 'Mahdia 5100, Tunisie',
                phone: s.phone || identity.phone || '48 091 914',
                hours: 'Lun–Sam · 09h00 – 19h00',
              })),
      },
      theme,
      header,
      footer,
      views,
      heroSlides,
      defaults: snap,
      testimonials: activeTestimonials,
      translations: translations && typeof translations === 'object' ? translations : null,
      contact: {
        companyName: identity.companyName || ROYAL_CONTACT_INFO.companyName,
        address: identity.address || ROYAL_CONTACT_INFO.address,
        email: identity.email || ROYAL_CONTACT_INFO.email,
        phone: identity.phone || ROYAL_CONTACT_INFO.phone,
        whatsapp: identity.whatsapp || ROYAL_CONTACT_INFO.whatsapp,
        tiktok: identity.tiktok || ROYAL_CONTACT_INFO.tiktok,
        instagram: identity.instagram || ROYAL_CONTACT_INFO.instagram,
        facebook: identity.facebook || ROYAL_CONTACT_INFO.facebook,
      },
    };
    this.publicConfigCache = { value: payload, expiresAt: Date.now() + 5000 };
    return payload;
  }

  async updateShippingConfig(dto: UpdateShippingConfigDto, updatedBy?: string) {
    await this.prisma.settings.upsert({
      where: { key: 'shipping.free_threshold' },
      update: {
        value: String(dto.freeShippingThreshold),
        updatedBy: updatedBy || 'ADMIN',
      },
      create: {
        key: 'shipping.free_threshold',
        value: String(dto.freeShippingThreshold),
        group: 'shipping',
        isSecret: false,
        updatedBy: updatedBy || 'ADMIN',
      },
    });

    if (dto.standardShippingFee !== undefined) {
      await this.prisma.settings.upsert({
        where: { key: 'shipping.standard_fee' },
        update: {
          value: String(dto.standardShippingFee),
          updatedBy: updatedBy || 'ADMIN',
        },
        create: {
          key: 'shipping.standard_fee',
          value: String(dto.standardShippingFee),
          group: 'shipping',
          isSecret: false,
          updatedBy: updatedBy || 'ADMIN',
        },
      });
    }

    return this.getPublicConfig();
  }

  async getFaq(includeInactive = false) {
    return this.prisma.faqItem.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async createFaq(dto: UpsertFaqDto) {
    return this.prisma.faqItem.create({
      data: {
        category: dto.category || 'Général',
        question: dto.question,
        answer: dto.answer,
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async updateFaq(id: string, dto: Partial<UpsertFaqDto>) {
    const existing = await this.prisma.faqItem.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Question FAQ introuvable');
    return this.prisma.faqItem.update({
      where: { id },
      data: dto,
    });
  }

  async deleteFaq(id: string) {
    await this.prisma.faqItem.delete({ where: { id } });
    return { deleted: true };
  }

  async reorderFaq(orderedIds: string[]) {
    if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
      return this.getFaq(true);
    }
    await this.prisma.$transaction(
      orderedIds.map((id, idx) =>
        this.prisma.faqItem.updateMany({
          where: { id },
          data: { sortOrder: idx + 1 },
        }),
      ),
    );
    return this.getFaq(true);
  }

  async getPage(slug: string) {
    const page = await this.prisma.cmsPage.findUnique({ where: { slug } });
    if (!page) {
      throw new NotFoundException(`Page "${slug}" introuvable`);
    }
    return page;
  }

  async updatePage(slug: string, dto: UpdateCmsPageDto, updatedBy?: string) {
    return this.prisma.cmsPage.upsert({
      where: { slug },
      update: {
        title: dto.title,
        subtitle: dto.subtitle,
        content: dto.content,
        updatedBy: updatedBy || 'ADMIN',
      },
      create: {
        slug,
        title: dto.title || slug,
        subtitle: dto.subtitle,
        content: dto.content,
        updatedBy: updatedBy || 'ADMIN',
      },
    });
  }

  async submitContact(dto: CreateContactDto) {
    const created = await this.prisma.contactSubmission.create({
      data: {
        fullName: dto.fullName.trim(),
        email: dto.email?.trim() || null,
        phone: dto.phone?.trim() || null,
        subject: dto.subject.trim(),
        message: dto.message.trim(),
        status: 'NEW',
        isRead: false,
      },
    });
    return created;
  }

  async listContacts(limit?: number) {
    if (limit && limit > 0) {
      const [items, unreadCount, totalAll] = await Promise.all([
        this.prisma.contactSubmission.findMany({
          orderBy: { createdAt: 'desc' },
          take: limit,
        }),
        this.prisma.contactSubmission.count({ where: { isRead: false } }),
        this.prisma.contactSubmission.count(),
      ]);
      return { items, unreadCount, totalAll };
    }
    return this.prisma.contactSubmission.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async markAllContactsRead() {
    const res = await this.prisma.contactSubmission.updateMany({
      where: { isRead: false },
      data: { isRead: true },
    });
    return { success: true, count: res.count };
  }

  async updateContact(id: string, dto: UpdateContactDto) {
    const existing = await this.prisma.contactSubmission.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Message introuvable');
    return this.prisma.contactSubmission.update({
      where: { id },
      data: {
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.isRead !== undefined ? { isRead: dto.isRead } : {}),
        ...(dto.replyContent !== undefined
          ? {
              replyContent: dto.replyContent,
              repliedAt: new Date(),
              status: 'REPLIED',
              isRead: true,
            }
          : {}),
      },
    });
  }

  async deleteContact(id: string) {
    await this.prisma.contactSubmission.delete({ where: { id } });
    return { deleted: true };
  }

  async bulkActionContacts(
    ids: string[],
    action: 'MARK_READ' | 'MARK_UNREAD' | 'TRASH' | 'RESTORE' | 'DELETE',
  ) {
    const cleanIds = Array.from(new Set((ids || []).filter(Boolean)));
    if (cleanIds.length === 0) return { count: 0 };
    if (action === 'DELETE') {
      const r = await this.prisma.contactSubmission.deleteMany({ where: { id: { in: cleanIds } } });
      return { count: r.count };
    }
    const data: any = {};
    if (action === 'MARK_READ') data.isRead = true;
    else if (action === 'MARK_UNREAD') data.isRead = false;
    else if (action === 'TRASH') data.status = 'ARCHIVED';
    else if (action === 'RESTORE') data.status = 'NEW';
    const r = await this.prisma.contactSubmission.updateMany({ where: { id: { in: cleanIds } }, data });
    return { count: r.count };
  }

  async subscribeNewsletter(dto: SubscribeNewsletterDto) {
    const cleanEmail = dto.email.trim().toLowerCase();
    const subscriber = await this.prisma.newsletterSubscriber.upsert({
      where: { email: cleanEmail },
      update: { isActive: true, source: dto.source || 'homepage' },
      create: {
        email: cleanEmail,
        isActive: true,
        source: dto.source || 'homepage',
      },
    });
    await this.prisma.customer.updateMany({
      where: { email: cleanEmail },
      data: { newsletterSub: true },
    });
    return { subscribed: true, email: subscriber.email };
  }

  async getDashboardKpis() {
    const [
      articlesCount,
      categoriesRaw,
      usersCount,
      ordersCount,
      salesAgg,
      lowStockCount,
      orderStatusGroups,
      recentOrdersRaw,
      recentReviewsRaw,
      allOrdersRaw,
      reviewsAgg,
      unreadSupportMsgs,
      unreadContacts,
      brandProductGroups,
      warehousesList,
    ] = await Promise.all([
      this.prisma.product.count({ where: { status: 'ACTIVE', deletedAt: null } }),
      this.prisma.category.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          parentId: true,
          _count: { select: { products: { where: { status: 'ACTIVE', deletedAt: null } } } },
        },
      }),
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.order.count({ where: { isDeleted: false } }),
      this.prisma.order.aggregate({
        where: { isDeleted: false, status: { not: 'CANCELLED' } },
        _count: { _all: true },
        _sum: { totalAmount: true },
      }),
      this.prisma.stock.count({ where: { physicalQty: { lte: 5 } } }),
      this.prisma.order.groupBy({
        by: ['status'],
        where: { isDeleted: false },
        _count: { _all: true },
        _sum: { totalAmount: true },
      }),
      this.prisma.order.findMany({
        where: { isDeleted: false },
        take: 6,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          reference: true,
          status: true,
          totalAmount: true,
          guestName: true,
          createdAt: true,
          customer: { select: { firstName: true, lastName: true } },
        },
      }),
      this.prisma.review.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          product: { select: { name: true, slug: true } },
          customer: { select: { firstName: true, lastName: true } },
        },
      }),
      this.prisma.order.findMany({
        where: { isDeleted: false },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          reference: true,
          status: true,
          channel: true,
          totalAmount: true,
          discountAmount: true,
          guestName: true,
          createdAt: true,
          customer: { select: { firstName: true, lastName: true } },
        },
      }),
      this.prisma.review.aggregate({
        where: { status: 'APPROVED' },
        _avg: { rating: true },
        _count: { _all: true },
      }),
      this.prisma.supportMessage.findMany({
        where: { senderRole: 'CLIENT', isReadByAdmin: false },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { thread: { select: { id: true, subject: true } } },
      }),
      this.prisma.contactSubmission.findMany({
        where: { isRead: false },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      this.prisma.product.groupBy({
        by: ['brandId'],
        where: { status: 'ACTIVE', deletedAt: null },
        _count: { _all: true },
      }),
      this.prisma.warehouse.findMany({
        where: { isDeleted: false, isActive: true },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
        select: { id: true, code: true, name: true },
      }),
    ]);

    const catChildren = new Map<string | null, string[]>();
    const catDirect = new Map<string, number>();
    for (const c of categoriesRaw) {
      catDirect.set(c.id, c._count.products);
      const pid = c.parentId ?? null;
      if (!catChildren.has(pid)) catChildren.set(pid, []);
      catChildren.get(pid)!.push(c.id);
    }
    const subtreeCnt = (id: string): number =>
      (catDirect.get(id) || 0) +
      (catChildren.get(id) || []).reduce((acc, ch) => acc + subtreeCnt(ch), 0);
    const nonEmptyCategories = categoriesRaw
      .map((c) => ({ id: c.id, name: c.name, parentId: c.parentId, count: subtreeCnt(c.id) }))
      .filter((c) => c.count > 0);

    const topCategories = nonEmptyCategories
      .filter((c) => c.parentId !== null)
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    const analytics = this.buildOrderAnalytics(allOrdersRaw);
    const avgRating = Number(reviewsAgg._avg.rating || 0);
    const satisfactionScore = avgRating > 0 ? Math.round((avgRating / 5) * 100) : 0;

    const nonCancelled = orderStatusGroups
      .filter((g) => g.status !== 'CANCELLED')
      .reduce((acc, g) => acc + g._count._all, 0);
    const orderCompletionRate =
      ordersCount > 0 ? Math.round((nonCancelled / ordersCount) * 100) : 0;

    const unreadMessages = [
      ...unreadSupportMsgs.map((m) => ({
        id: m.id,
        kind: 'SUPPORT' as const,
        senderName: m.senderName,
        senderRole: m.senderRole,
        subject: m.thread?.subject || 'Message Support',
        snippet: m.body.slice(0, 120),
        link: '/dashboard/community/messages',
        createdAt: m.createdAt,
      })),
      ...unreadContacts.map((c) => ({
        id: c.id,
        kind: 'CONTACT' as const,
        senderName: c.fullName,
        senderRole: 'CONTACT',
        subject: c.subject,
        snippet: c.message.slice(0, 120),
        link: '/dashboard/community/contacts',
        createdAt: c.createdAt,
      })),
    ]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);

    return {
      articlesCount,
      categoriesCount: nonEmptyCategories.length,
      totalCategoriesCount: categoriesRaw.length,
      usersCount,
      ordersCount,
      salesCount: salesAgg._count._all || 0,
      salesTotal: Number(salesAgg._sum.totalAmount || 0),
      lowStockCount,
      warehousesCount: warehousesList.length,
      primaryWarehouseCode: warehousesList[0]?.code || '',
      topCategories,
      ordersByStatus: orderStatusGroups.map((g) => ({
        status: g.status,
        count: g._count._all,
        amount: Number(g._sum.totalAmount || 0),
      })),
      recentOrders: recentOrdersRaw.map((o) => ({
        id: o.id,
        reference: o.reference,
        status: o.status,
        totalAmount: Number(o.totalAmount || 0),
        customerName: o.customer ? `${o.customer.firstName} ${o.customer.lastName}` : o.guestName || 'Client',
        createdAt: o.createdAt,
      })),
      recentReviews: recentReviewsRaw.map((r) => ({
        id: r.id,
        rating: r.rating,
        body: r.body || '',
        status: r.status,
        productName: r.product.name,
        authorName: `${r.customer.firstName} ${r.customer.lastName}`.trim(),
        createdAt: r.createdAt,
      })),
      ...analytics,
      satisfactionScore,
      reviewsTotalCount: reviewsAgg._count._all || 0,
      orderCompletionRate,
      brandsCount: brandProductGroups.length,
      unreadMessages,
    };
  }

  private buildOrderAnalytics(orders: any[]) {
    const MONTHS_FR = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
    const now = new Date();
    const monthlyMap = new Map<
      string,
      { key: string; label: string; online: number; pos: number; promo: number; total: number; count: number }
    >();

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthlyMap.set(key, {
        key,
        label: MONTHS_FR[d.getMonth()],
        online: 0,
        pos: 0,
        promo: 0,
        total: 0,
        count: 0,
      });
    }

    const channelMap = new Map<string, number>();
    const calendarMap = new Map<
      string,
      Array<{ id: string; reference: string; status: string; amount: number; customerName: string }>
    >();

    for (const o of orders) {
      const dt = new Date(o.createdAt);
      const mKey = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
      const amt = Number(o.totalAmount || 0);
      const disc = Number(o.discountAmount || 0);
      const ch = String(o.channel || 'ONLINE');

      channelMap.set(ch, (channelMap.get(ch) || 0) + 1);

      const dayKey = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(
        dt.getDate(),
      ).padStart(2, '0')}`;
      if (!calendarMap.has(dayKey)) calendarMap.set(dayKey, []);
      calendarMap.get(dayKey)!.push({
        id: o.id,
        reference: o.reference,
        status: o.status,
        amount: amt,
        customerName: o.customer
          ? `${o.customer.firstName} ${o.customer.lastName}`
          : o.guestName || 'Client',
      });

      const slot = monthlyMap.get(mKey);
      if (slot && o.status !== 'CANCELLED') {
        slot.total += amt;
        slot.count += 1;
        if (ch === 'POS') slot.pos += amt;
        else slot.online += amt;
        if (disc > 0) slot.promo += disc;
      }
    }

    const monthlyRevenueSeries = Array.from(monthlyMap.values());
    const channelLabels: Record<string, string> = {
      ONLINE: 'Boutique Web',
      POS: 'Showroom POS',
      PHONE: 'Téléphone',
      IMPORT: 'Catalogue',
    };
    const platformContribution = Array.from(channelMap.entries()).map(([k, count]) => ({
      key: k,
      label: channelLabels[k] || k,
      count,
    }));

    const calendarEvents = Array.from(calendarMap.entries()).map(([date, list]) => ({
      date,
      count: list.length,
      total: list.reduce((s, it) => s + it.amount, 0),
      orders: list.slice(0, 6),
    }));

    return {
      monthlyRevenueSeries,
      platformContribution,
      calendarEvents,
    };
  }

  async getUserDashboard(userId: string, roles: string[] = []) {
    const isStaff = roles.some((r) => r !== 'CLIENT');
    if (isStaff) {
      return { roleScope: 'STAFF', ...(await this.getDashboardKpis()) };
    }

    const { customer } = await this.resolveOrCreateCustomer(userId);
    const [myOrders, myReviews, unreadAdminReplies, unreadPersonalNotifs] = await Promise.all([
      this.prisma.order.findMany({
        where: { customerId: customer.id, isDeleted: false },
        orderBy: { createdAt: 'desc' },
        take: 100,
        select: {
          id: true,
          reference: true,
          status: true,
          channel: true,
          totalAmount: true,
          discountAmount: true,
          createdAt: true,
        },
      }),
      this.prisma.review.findMany({
        where: { customerId: customer.id },
        select: { rating: true },
      }),
      this.prisma.supportMessage.findMany({
        where: {
          thread: { customerId: customer.id },
          senderRole: { not: 'CLIENT' },
          isReadByClient: false,
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { thread: { select: { id: true, subject: true } } },
      }),
      this.prisma.notification.findMany({
        where: { userId, isRead: false },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);

    const analytics = this.buildOrderAnalytics(
      myOrders.map((o) => ({
        ...o,
        customer: { firstName: customer.firstName, lastName: customer.lastName },
      })),
    );
    const avgScore =
      myReviews.length > 0
        ? Math.round((myReviews.reduce((s, r) => s + r.rating, 0) / myReviews.length / 5) * 100)
        : 0;
    const totalSpent = myOrders
      .filter((o) => o.status !== 'CANCELLED')
      .reduce((s, o) => s + Number(o.totalAmount || 0), 0);

    const unreadMessages = [
      ...unreadAdminReplies.map((m) => ({
        id: m.id,
        kind: 'SUPPORT' as const,
        senderName: m.senderName,
        senderRole: m.senderRole,
        subject: m.thread?.subject || 'Réponse Support Royal',
        snippet: m.body.slice(0, 120),
        link: '/account/messages',
        createdAt: m.createdAt,
      })),
      ...unreadPersonalNotifs.map((n) => ({
        id: n.id,
        kind: 'NOTIF' as const,
        senderName: 'Royal Système',
        senderRole: 'NOTIFICATION',
        subject: n.title,
        snippet: n.body.slice(0, 120),
        link: n.link || '/account/notifications',
        createdAt: n.createdAt,
      })),
    ]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);

    const statusCountsMap = new Map<string, { status: string; count: number; amount: number }>();
    for (const o of myOrders) {
      const cur = statusCountsMap.get(o.status) || { status: o.status, count: 0, amount: 0 };
      cur.count += 1;
      cur.amount += Number(o.totalAmount || 0);
      statusCountsMap.set(o.status, cur);
    }

    return {
      roleScope: 'CLIENT',
      ordersCount: myOrders.length,
      salesTotal: totalSpent,
      ordersByStatus: Array.from(statusCountsMap.values()),
      satisfactionScore: avgScore,
      reviewsTotalCount: myReviews.length,
      orderCompletionRate:
        myOrders.length > 0
          ? Math.round(
              (myOrders.filter((o) => o.status !== 'CANCELLED').length / myOrders.length) * 100,
            )
          : 0,
      unreadMessages,
      ...analytics,
    };
  }

  async getProductReviews(productId: string, userId?: string) {
    const reviews = await this.prisma.review.findMany({
      where: { productId, status: 'APPROVED' },
      orderBy: { createdAt: 'desc' },
      include: {
        customer: { select: { id: true, userId: true, firstName: true, lastName: true } },
      },
    });

    let myReview: any = null;
    if (userId) {
      const cust = await this.prisma.customer.findFirst({ where: { userId } });
      if (cust) {
        const own = await this.prisma.review.findUnique({
          where: { productId_customerId: { productId, customerId: cust.id } },
        });
        if (own) {
          myReview = {
            id: own.id,
            rating: own.rating,
            title: own.title,
            body: own.body || '',
            status: own.status,
            updatedAt: own.updatedAt,
          };
        }
      }
    }

    const avg =
      reviews.length > 0
        ? Number((reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1))
        : 0;
    return {
      averageRating: avg,
      totalReviews: reviews.length,
      myReview,
      reviews: reviews.map((r) => ({
        id: r.id,
        rating: r.rating,
        title: r.title,
        body: r.body,
        authorName: `${r.customer.firstName} ${r.customer.lastName}`.trim(),
        isVerifiedPurchase: r.isVerifiedPurchase,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      })),
    };
  }

  async createProductReview(
    productId: string,
    dto: CreateProductReviewDto,
    user?: { id?: string; email?: string; firstName?: string; lastName?: string },
  ) {
    const rating = Math.min(5, Math.max(1, Number(dto.rating) || 5));
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundException('Article introuvable');

    let customerId: string | null = null;
    let isVerified = false;
    let displayAuthor = 'Client Royal';

    if (user?.id) {
      const dbUser = await this.prisma.user.findUnique({
        where: { id: user.id },
        select: { id: true, email: true, firstName: true, lastName: true },
      });
      const fn = dbUser?.firstName || user.firstName || 'Client';
      const ln = dbUser?.lastName || user.lastName || 'Royal';
      const em = dbUser?.email || user.email || `user.${user.id}@royal.com.tn`;
      displayAuthor = `${fn} ${ln}`.trim();

      let cust = await this.prisma.customer.findFirst({ where: { userId: user.id } });
      if (!cust && em) {
        cust = await this.prisma.customer.findUnique({ where: { email: em } });
      }
      if (!cust) {
        cust = await this.prisma.customer.create({
          data: {
            userId: user.id,
            email: em,
            firstName: fn,
            lastName: ln,
          },
        });
      }
      customerId = cust.id;
      const bought = await this.prisma.orderItem.findFirst({
        where: { productId, order: { customerId: cust.id, status: { not: 'CANCELLED' } } },
      });
      isVerified = Boolean(bought);
    } else {
      const cleanEmail = dto.authorEmail?.trim().toLowerCase() || `avis.${Date.now()}@royal.com.tn`;
      const parts = (dto.authorName || 'Client Royal').trim().split(/\s+/);
      const firstName = parts[0] || 'Client';
      const lastName = parts.slice(1).join(' ') || 'Royal';
      displayAuthor = `${firstName} ${lastName}`.trim();
      let cust = await this.prisma.customer.findUnique({ where: { email: cleanEmail } });
      if (!cust) {
        cust = await this.prisma.customer.create({
          data: { email: cleanEmail, firstName, lastName },
        });
      }
      customerId = cust.id;
    }

    if (!customerId) {
      throw new BadRequestException('Impossible d’associer un profil client à cet avis.');
    }

    const existingOwn = await this.prisma.review.findUnique({
      where: { productId_customerId: { productId, customerId } },
    });

    const review = await this.prisma.review.upsert({
      where: {
        productId_customerId: { productId, customerId },
      },
      update: {
        rating,
        title: dto.title?.trim() || null,
        body: dto.body.trim(),
        status: 'APPROVED',
        isVerifiedPurchase: isVerified,
      },
      create: {
        productId,
        customerId,
        rating,
        title: dto.title?.trim() || null,
        body: dto.body.trim(),
        status: 'APPROVED',
        isVerifiedPurchase: isVerified,
      },
      include: {
        customer: { select: { firstName: true, lastName: true } },
      },
    });

    // Notify ROOT, SUPER_ADMIN, and ADMIN / WEBSITE_MANAGER users in PostgreSQL
    try {
      const adminUsers = await this.prisma.user.findMany({
        where: {
          deletedAt: null,
          isActive: true,
          userRoles: {
            some: {
              role: { name: { in: ['ROOT', 'SUPER_ADMIN', 'ADMIN', 'WEBSITE_MANAGER'] } },
            },
          },
        },
        select: { id: true, userRoles: { select: { role: { select: { name: true } } } } },
      });

      const actionLabel = existingOwn ? 'Avis modifié' : 'Nouvel avis client';
      if (adminUsers.length > 0) {
        await this.prisma.notification.createMany({
          data: adminUsers.map((adm) => ({
            userId: adm.id,
            type: 'SYSTEM',
            title: `${actionLabel} (${rating}★) — ${product.name}`,
            body: `${displayAuthor} : "${dto.body.trim().slice(0, 140)}"`,
            link: '/dashboard/community/testimonials',
            metadata: {
              channel: 'REVIEW',
              severity: 'INFO',
              productId,
              reviewId: review.id,
              rating,
              targetRoles: adm.userRoles.map((r) => r.role.name).join(', '),
            } as any,
          })),
        });
      }
    } catch {
      // ignore notification failure so review submission succeeds
    }

    return {
      id: review.id,
      rating: review.rating,
      title: review.title,
      body: review.body,
      authorName: `${review.customer.firstName} ${review.customer.lastName}`.trim(),
      isVerifiedPurchase: review.isVerifiedPurchase,
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
      isEdit: Boolean(existingOwn),
    };
  }

  async listNewsletterSubscribers() {
    return this.prisma.newsletterSubscriber.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async toggleNewsletterSubscriber(id: string) {
    const existing = await this.prisma.newsletterSubscriber.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Abonné introuvable.');
    return this.prisma.newsletterSubscriber.update({
      where: { id },
      data: { isActive: !existing.isActive },
    });
  }

  async deleteNewsletterSubscriber(id: string) {
    const existing = await this.prisma.newsletterSubscriber.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Abonné introuvable.');
    await this.prisma.newsletterSubscriber.delete({ where: { id } });
    return { deleted: true, id };
  }

  async recordTelemetryEvent(dto: TrackTelemetryDto, userAgent = '') {
    try {
      const cleanSession = String(dto.sessionHash || 'anon').trim().slice(0, 64) || 'anon';
      const cleanPath = String(dto.pagePath || '/').split('?')[0].slice(0, 255) || '/';
      let browserFamily = dto.browserFamily || 'Other';
      if (!dto.browserFamily && userAgent) {
        if (/Edg\//i.test(userAgent)) browserFamily = 'Edge';
        else if (/Chrome\//i.test(userAgent)) browserFamily = 'Chrome';
        else if (/Firefox\//i.test(userAgent)) browserFamily = 'Firefox';
        else if (/Safari\//i.test(userAgent)) browserFamily = 'Safari';
      }
      const detectedDevice =
        dto.deviceType ||
        (/mobile|iphone|android/i.test(userAgent)
          ? 'MOBILE'
          : /tablet|ipad/i.test(userAgent)
            ? 'TABLET'
            : 'DESKTOP');

      await this.prisma.trafficEvent.create({
        data: {
          sessionHash: cleanSession,
          eventType: dto.eventType,
          pagePath: cleanPath,
          referrer: dto.referrer ? String(dto.referrer).slice(0, 255) : null,
          utmSource: dto.utmSource ? String(dto.utmSource).slice(0, 120) : null,
          utmMedium: dto.utmMedium ? String(dto.utmMedium).slice(0, 120) : null,
          utmCampaign: dto.utmCampaign ? String(dto.utmCampaign).slice(0, 120) : null,
          deviceType: detectedDevice,
          browserFamily,
          metadata:
            dto.metadata || dto.durationSeconds !== undefined || dto.pageTitle
              ? {
                  ...(dto.metadata || {}),
                  ...(dto.durationSeconds !== undefined ? { durationSeconds: Number(dto.durationSeconds) } : {}),
                  ...(dto.pageTitle ? { pageTitle: String(dto.pageTitle).slice(0, 180) } : {}),
                }
              : undefined,
        },
      });
      return { ok: true };
    } catch {
      return { ok: false };
    }
  }

  async getSalesReport() {
    const orderItems = await this.prisma.orderItem.findMany({
      where: { order: { isDeleted: false, status: { not: 'CANCELLED' } } },
      include: {
        order: { select: { createdAt: true, totalAmount: true } },
        product: {
          select: {
            id: true,
            name: true,
            basePrice: true,
            sellingPrice: true,
            discountPrice: true,
            taxRate: true,
            category: { select: { name: true } },
          },
        },
      },
    });

    const MONTHS_FR = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
    const now = new Date();
    const monthlyMap = new Map<
      string,
      { key: string; label: string; ttcRevenue: number; netRevenue: number; marginAmount: number }
    >();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthlyMap.set(key, {
        key,
        label: MONTHS_FR[d.getMonth()],
        ttcRevenue: 0,
        netRevenue: 0,
        marginAmount: 0,
      });
    }

    const grouped = new Map<string, any>();
    const categoryTotals = new Map<string, number>();

    for (const item of orderItems) {
      const pid = item.productId;
      const qty = item.quantity || 1;
      const costUnit = Number(item.product?.basePrice || 0);
      const grossUnit = Number(item.product?.sellingPrice || item.unitPrice || 0);
      const netUnit = Number(item.unitPrice || item.product?.discountPrice || grossUnit);
      const taxRate = Number(item.product?.taxRate ?? 0.19);
      const ttcTotal = Number(item.totalPrice || netUnit * qty * (1 + taxRate));
      const catName = item.product?.category?.name || 'Catalogue';
      const itemNet = netUnit * qty;
      const itemCost = costUnit * qty;
      const itemMargin = itemNet - itemCost;

      categoryTotals.set(catName, (categoryTotals.get(catName) || 0) + itemNet);

      if (item.order?.createdAt) {
        const dt = new Date(item.order.createdAt);
        const mKey = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
        const slot = monthlyMap.get(mKey);
        if (slot) {
          slot.ttcRevenue += ttcTotal;
          slot.netRevenue += itemNet;
          slot.marginAmount += itemMargin;
        }
      }

      const prev = grouped.get(pid) || {
        id: pid,
        articleName: item.productName || item.product?.name || 'Article Royal',
        categoryName: catName,
        unitsSold: 0,
        totalCostPrice: 0,
        totalGrossSales: 0,
        totalNetSales: 0,
        totalTtcSales: 0,
      };
      prev.unitsSold += qty;
      prev.totalCostPrice += itemCost;
      prev.totalGrossSales += grossUnit * qty;
      prev.totalNetSales += itemNet;
      prev.totalTtcSales += ttcTotal;
      grouped.set(pid, prev);
    }

    const items = Array.from(grouped.values()).map((row) => {
      const marginAmount = row.totalNetSales - row.totalCostPrice;
      const marginPercentage =
        row.totalNetSales > 0
          ? Number(((marginAmount / row.totalNetSales) * 100).toFixed(1))
          : 0;
      return {
        ...row,
        totalCostPrice: Number(row.totalCostPrice.toFixed(3)),
        totalGrossSales: Number(row.totalGrossSales.toFixed(3)),
        totalNetSales: Number(row.totalNetSales.toFixed(3)),
        totalTtcSales: Number(row.totalTtcSales.toFixed(3)),
        marginAmount: Number(marginAmount.toFixed(3)),
        marginPercentage,
      };
    });

    const monthlyTrend = Array.from(monthlyMap.values()).map((m) => ({
      label: m.label,
      value: Math.round(m.ttcRevenue),
      secondaryValue: Math.round(m.marginAmount),
    }));

    const currMonth = monthlyTrend[monthlyTrend.length - 1]?.value || 0;
    const prevMonth = monthlyTrend[monthlyTrend.length - 2]?.value || 0;
    const deltaPct =
      prevMonth > 0
        ? (((currMonth - prevMonth) / prevMonth) * 100).toFixed(1)
        : currMonth > 0
          ? '100.0'
          : '0.0';
    const deltaLabel = `${Number(deltaPct) >= 0 ? '+' : ''}${deltaPct}% vs M-1`;

    const categoryBreakdown = Array.from(categoryTotals.entries())
      .map(([label, val]) => ({ label, value: Math.round(val) }))
      .filter((c) => c.value > 0)
      .sort((a, b) => b.value - a.value);

    return {
      items,
      monthlyTrend,
      deltaLabel,
      categoryBreakdown,
    };
  }

  async getAnalyticsReport() {
    const since90d = new Date(Date.now() - 90 * 86400_000);
    const [trafficEvents, activeProducts, cartItemsCount, totalOrders] = await Promise.all([
      this.prisma.trafficEvent.findMany({
        where: { occurredAt: { gte: since90d } },
        orderBy: { occurredAt: 'desc' },
        take: 10000,
      }),
      this.prisma.product.findMany({
        where: { isDeleted: false, status: 'ACTIVE' },
        orderBy: [{ viewCount: 'desc' }, { likeCount: 'desc' }],
        select: { id: true, name: true, slug: true, viewCount: true, createdAt: true },
      }),
      this.prisma.cartItem.count(),
      this.prisma.order.count({ where: { isDeleted: false, status: { not: 'CANCELLED' } } }),
    ]);

    const pageViews = trafficEvents.filter((e) => e.eventType === 'PAGE_VIEW');
    const pageLeaves = trafficEvents.filter((e) => e.eventType === 'PAGE_LEAVE');
    const productViewEvents = trafficEvents.filter((e) => e.eventType === 'PRODUCT_VIEW');
    const addToCartEvents = trafficEvents.filter((e) => e.eventType === 'ADD_TO_CART');
    const checkoutEvents = trafficEvents.filter((e) => e.eventType === 'BEGIN_CHECKOUT');
    const purchaseEvents = trafficEvents.filter((e) => e.eventType === 'PURCHASE');

    // Compute per-session page count to detect true 1-page bounces
    const sessionPageCount = new Map<string, number>();
    for (const ev of pageViews) {
      sessionPageCount.set(ev.sessionHash, (sessionPageCount.get(ev.sessionHash) || 0) + 1);
    }

    // Group real duration per path
    const durationByPath = new Map<string, number[]>();
    for (const lv of pageLeaves) {
      const cleanPath = lv.pagePath || '/';
      const dur = Number((lv.metadata as any)?.durationSeconds || 0);
      if (dur > 0) {
        if (!durationByPath.has(cleanPath)) durationByPath.set(cleanPath, []);
        durationByPath.get(cleanPath)!.push(dur);
      }
    }

    // Aggregate per pagePath from TrafficEvent
    const pathMap = new Map<
      string,
      {
        id: string;
        pagePath: string;
        pageTitle: string;
        viewsCount: number;
        sessions: Set<string>;
        conversions: number;
        lastAt: string;
      }
    >();

    for (const ev of pageViews) {
      const cleanPath = ev.pagePath || '/';
      const existing = pathMap.get(cleanPath) || {
        id: `pv-${cleanPath}`,
        pagePath: cleanPath,
        pageTitle: String((ev.metadata as any)?.pageTitle || '').trim() || cleanPath,
        viewsCount: 0,
        sessions: new Set<string>(),
        conversions: 0,
        lastAt: ev.occurredAt.toISOString(),
      };
      existing.viewsCount += 1;
      existing.sessions.add(ev.sessionHash);
      if (existing.pageTitle === cleanPath && (ev.metadata as any)?.pageTitle) {
        existing.pageTitle = String((ev.metadata as any).pageTitle);
      }
      pathMap.set(cleanPath, existing);
    }

    // Attach purchase sessions per path
    const purchaseSessions = new Set(purchaseEvents.map((p) => p.sessionHash));
    for (const entry of pathMap.values()) {
      for (const s of entry.sessions) {
        if (purchaseSessions.has(s)) entry.conversions += 1;
      }
    }

    // Merge real Product.viewCount from catalog if not already covered by TrafficEvent
    const prodPathLookup = new Map(activeProducts.map((p) => [`/articles/${p.slug}`, p]));
    for (const p of activeProducts) {
      const slugPath = `/articles/${p.slug}`;
      const existing = pathMap.get(slugPath);
      if (existing) {
        existing.pageTitle = p.name;
        existing.viewsCount = Math.max(existing.viewsCount, p.viewCount || 0);
      } else if ((p.viewCount || 0) > 0) {
        pathMap.set(slugPath, {
          id: p.id,
          pagePath: slugPath,
          pageTitle: p.name,
          viewsCount: p.viewCount || 0,
          sessions: new Set<string>(),
          conversions: 0,
          lastAt: p.createdAt.toISOString(),
        });
      }
    }

    const items = Array.from(pathMap.values())
      .map((row) => {
        const durs = durationByPath.get(row.pagePath) || [];
        const avgTimeSeconds = durs.length > 0 ? Math.round(durs.reduce((a, b) => a + b, 0) / durs.length) : 0;
        const uniqueVisitors = row.sessions.size;
        let singlePageSessions = 0;
        for (const s of row.sessions) {
          if ((sessionPageCount.get(s) || 0) <= 1) singlePageSessions += 1;
        }
        const bounceRatePercent =
          uniqueVisitors > 0 ? Number(((singlePageSessions / uniqueVisitors) * 100).toFixed(1)) : 0;
        const conversionRatePercent =
          uniqueVisitors > 0
            ? Number(((row.conversions / uniqueVisitors) * 100).toFixed(1))
            : 0;
        const prodMatch = prodPathLookup.get(row.pagePath);
        return {
          id: prodMatch?.id || row.id,
          pagePath: row.pagePath,
          pageTitle: row.pageTitle,
          viewsCount: row.viewsCount,
          uniqueVisitors,
          avgTimeSeconds,
          bounceRatePercent,
          conversionRatePercent,
          createdAt: row.lastAt,
        };
      })
      .sort((a, b) => b.viewsCount - a.viewsCount);

    // 7-day daily momentum
    const WEEKDAYS_FR = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
    const now = new Date();
    const dailyMomentum: Array<{ label: string; value: number; secondaryValue: number }> = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const dayIso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const dayViews = pageViews.filter((e) => e.occurredAt.toISOString().slice(0, 10) === dayIso);
      const uniqDay = new Set(dayViews.map((e) => e.sessionHash)).size;
      dailyMomentum.push({
        label: WEEKDAYS_FR[d.getDay()],
        value: dayViews.length,
        secondaryValue: uniqDay,
      });
    }

    // Acquisition channels from real UTM / Referrer
    const channelCounts = new Map<string, number>();
    for (const ev of pageViews) {
      const src = (ev.utmSource || '').toLowerCase();
      const ref = (ev.referrer || '').toLowerCase();
      let bucket = 'Accès Direct Royal';
      if (/facebook|fb|instagram|ig|tiktok|snap/i.test(src + ' ' + ref)) {
        bucket = 'Réseaux Sociaux (FB/IG/TT)';
      } else if (/google|bing|yahoo/i.test(src + ' ' + ref)) {
        bucket = 'Recherche SEO / Google';
      } else if (/email|newsletter|mail|promo/i.test(src + ' ' + (ev.utmMedium || ''))) {
        bucket = 'Campagnes Email & Promo';
      } else if (ref) {
        bucket = 'Sites Référents';
      }
      channelCounts.set(bucket, (channelCounts.get(bucket) || 0) + 1);
    }
    const channelColors: Record<string, string> = {
      'Recherche SEO / Google': '#C59B27',
      'Réseaux Sociaux (FB/IG/TT)': '#64748B',
      'Accès Direct Royal': '#059669',
      'Campagnes Email & Promo': '#D97706',
      'Sites Référents': '#94A3B8',
    };
    const acquisitionChannels = Array.from(channelCounts.entries()).map(([label, value]) => ({
      label,
      value,
      color: channelColors[label] || '#C59B27',
    }));

    // 5-month device segments
    const MONTHS_FR = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
    const deviceMonthlyMap = new Map<string, { label: string; primary: number; secondary: number; tertiary: number }>();
    for (let i = 4; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      deviceMonthlyMap.set(mKey, { label: MONTHS_FR[d.getMonth()], primary: 0, secondary: 0, tertiary: 0 });
    }
    for (const ev of pageViews) {
      const dt = new Date(ev.occurredAt);
      const mKey = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
      const slot = deviceMonthlyMap.get(mKey);
      if (slot) {
        if (ev.deviceType === 'MOBILE') slot.primary += 1;
        else if (ev.deviceType === 'TABLET') slot.tertiary += 1;
        else slot.secondary += 1;
      }
    }
    const deviceMonthlySegments = Array.from(deviceMonthlyMap.values());

    const totalProductViewsDb = activeProducts.reduce((acc, p) => acc + (p.viewCount || 0), 0);
    const totalPageViewsAll = Math.max(pageViews.length, totalProductViewsDb);
    const productViewsCount = Math.max(productViewEvents.length, totalProductViewsDb);
    const addToCartCount = Math.max(addToCartEvents.length, cartItemsCount);
    const checkoutCount = Math.max(checkoutEvents.length, totalOrders);
    const ordersValidatedCount = Math.max(purchaseEvents.length, totalOrders);
    const funnelBase = Math.max(1, totalPageViewsAll);

    const conversionFunnel = [
      {
        label: 'Consultation Fiche Produit',
        value: totalPageViewsAll > 0 ? Math.min(100, Math.round((productViewsCount / funnelBase) * 100)) : 0,
        unit: '%',
      },
      {
        label: 'Ajout au Panier',
        value: totalPageViewsAll > 0 ? Math.min(100, Math.round((addToCartCount / funnelBase) * 100)) : 0,
        unit: '%',
      },
      {
        label: 'Ouverture Checkout',
        value: totalPageViewsAll > 0 ? Math.min(100, Math.round((checkoutCount / funnelBase) * 100)) : 0,
        unit: '%',
      },
      {
        label: 'Commande Validée',
        value: totalPageViewsAll > 0 ? Math.min(100, Math.round((ordersValidatedCount / funnelBase) * 100)) : 0,
        unit: '%',
      },
    ];

    const totalUniqueVisitors = new Set(pageViews.map((e) => e.sessionHash)).size;
    let totalSingleSession = 0;
    for (const cnt of sessionPageCount.values()) {
      if (cnt <= 1) totalSingleSession += 1;
    }
    const avgBounce =
      totalUniqueVisitors > 0 ? Number(((totalSingleSession / totalUniqueVisitors) * 100).toFixed(1)) : 0;
    const avgConversion =
      purchaseEvents.length > 0 && totalUniqueVisitors > 0
        ? Math.min(100, Number(((purchaseEvents.length / totalUniqueVisitors) * 100).toFixed(1)))
        : Math.max(totalUniqueVisitors, totalPageViewsAll) > 0 && ordersValidatedCount > 0
          ? Math.min(100, Number(((ordersValidatedCount / Math.max(totalUniqueVisitors, totalPageViewsAll)) * 100).toFixed(1)))
          : 0;

    return {
      items,
      summary: {
        totalViews: items.reduce((a, i) => a + i.viewsCount, 0),
        totalVisitors: totalUniqueVisitors,
        avgBounce,
        avgConversion,
      },
      charts: {
        dailyMomentum,
        acquisitionChannels,
        deviceMonthlySegments,
        conversionFunnel,
      },
    };
  }

  async getTreasuryReport() {
    const [salesAgg, cashRegisters, payments, txRow, accRow] = await Promise.all([
      this.prisma.order.aggregate({
        where: { isDeleted: false, status: { not: 'CANCELLED' } },
        _sum: { totalAmount: true },
      }),
      this.prisma.cashRegister.findMany({
        where: { isActive: true },
        include: {
          pos: { select: { name: true } },
          sessions: {
            include: { movements: true },
          },
        },
      }),
      this.prisma.payment.findMany({
        select: { id: true, method: true, status: true, amount: true },
      }),
      this.prisma.settings.findUnique({ where: { key: 'sys.treasuryTransactions' } }),
      this.prisma.settings.findUnique({ where: { key: 'sys.treasuryAccounts' } }),
    ]);

    const txs = this.parseJsonSetting<any[]>(txRow?.value, []);
    const manualAccounts = this.parseJsonSetting<any[]>(accRow?.value, []);

    const caissesMap = new Map<
      string,
      { name: string; encaissements: number; decaissements: number; transferts: number }
    >();

    for (const reg of cashRegisters) {
      const label = reg.pos?.name ? `${reg.name} (${reg.pos.name})` : reg.name;
      let enc = 0;
      let dec = 0;
      for (const s of reg.sessions || []) {
        for (const m of s.movements || []) {
          const amt = Number(m.amount || 0);
          if (['OPENING', 'SALE', 'DEPOSIT'].includes(m.type)) enc += amt;
          else if (['REFUND', 'EXPENSE', 'WITHDRAWAL'].includes(m.type)) dec += amt;
        }
      }
      caissesMap.set(label, { name: label, encaissements: enc, decaissements: dec, transferts: 0 });
    }

    // Add real online/COD payments recorded in Payment table when completed
    const completedOnlinePayments = payments
      .filter((p) => p.status === 'COMPLETED')
      .reduce((s, p) => s + Number(p.amount || 0), 0);
    if (completedOnlinePayments > 0) {
      caissesMap.set('Encaissements Commandes Web', {
        name: 'Encaissements Commandes Web',
        encaissements: completedOnlinePayments,
        decaissements: 0,
        transferts: 0,
      });
    }

    // Incorporate user-created manual treasury accounts & transactions
    for (const acc of Array.isArray(manualAccounts) ? manualAccounts : []) {
      const accName = acc?.name || acc?.code || 'Compte Trésorerie';
      const matchingTxs = (Array.isArray(txs) ? txs : []).filter(
        (t: any) =>
          (t.account && String(t.account).toLowerCase().includes(String(accName).toLowerCase().slice(0, 10))) ||
          (t.accountCode && acc.code && t.accountCode === acc.code),
      );
      const enc = matchingTxs
        .filter((t: any) => t.type === 'INFLOW')
        .reduce((s: number, t: any) => s + Number(t.amount ?? t.amountTnd ?? 0), 0);
      const dec = matchingTxs
        .filter((t: any) => t.type === 'OUTFLOW')
        .reduce((s: number, t: any) => s + Number(t.amount ?? t.amountTnd ?? 0), 0);
      const trf = matchingTxs
        .filter((t: any) => t.method === 'TRANSFER')
        .reduce((s: number, t: any) => s + Number(t.amount ?? t.amountTnd ?? 0), 0);

      const prev = caissesMap.get(accName) || {
        name: accName,
        encaissements: 0,
        decaissements: 0,
        transferts: 0,
      };
      prev.encaissements += enc > 0 ? enc : Number(acc.currentBalanceTnd || 0);
      prev.decaissements += dec;
      prev.transferts += trf;
      caissesMap.set(accName, prev);
    }

    const caissesStats = Array.from(caissesMap.values());
    const totalEncaissements = caissesStats.reduce((s, c) => s + c.encaissements, 0);
    const totalDecaissements = caissesStats.reduce((s, c) => s + c.decaissements, 0);
    const totalTransferts = caissesStats.reduce((s, c) => s + c.transferts, 0);
    const coverageScore =
      totalEncaissements + totalDecaissements > 0
        ? Math.round((totalEncaissements / (totalEncaissements + totalDecaissements)) * 100)
        : 0;

    return {
      salesTotal: Number(salesAgg._sum.totalAmount || 0),
      caissesStats,
      totalEncaissements,
      totalDecaissements,
      totalTransferts,
      coverageScore,
    };
  }

  async getInteractionsReport() {
    const products = await this.prisma.product.findMany({
      where: { isDeleted: false },
      orderBy: [
        { likeCount: 'desc' },
        { favoriteCount: 'desc' },
        { viewCount: 'desc' },
      ],
      select: {
        id: true,
        sku: true,
        name: true,
        slug: true,
        viewCount: true,
        likeCount: true,
        dislikeCount: true,
        favoriteCount: true,
        compareCount: true,
        createdAt: true,
        category: { select: { name: true } },
        reviews: { select: { rating: true } },
        _count: { select: { favorites: true, reviews: true, likes: true } },
      },
    });

    const items = products.map((p) => {
      const reviewsCount = p._count?.reviews ?? p.reviews.length;
      const favoritesCount = Math.max(p.favoriteCount || 0, p._count?.favorites || 0);
      const averageRating =
        p.reviews.length > 0
          ? Number((p.reviews.reduce((s, r) => s + r.rating, 0) / p.reviews.length).toFixed(1))
          : 0;
      const viewsCount = Math.max(p.viewCount || 0, (p.likeCount || 0) + favoritesCount + reviewsCount);
      const conversionRate =
        viewsCount > 0
          ? Number((((p.likeCount + favoritesCount + reviewsCount) / viewsCount) * 100).toFixed(1))
          : 0;

      return {
        id: p.id,
        sku: p.sku,
        articleName: p.name,
        slug: p.slug,
        categoryName: p.category?.name || 'Catalogue Royal',
        favoritesCount,
        likesCount: p.likeCount || 0,
        dislikesCount: p.dislikeCount || 0,
        compareCount: p.compareCount || 0,
        reviewsCount,
        averageRating,
        viewsCount,
        conversionRate,
        createdAt: p.createdAt,
      };
    });

    const totalLikes = items.reduce((s, i) => s + i.likesCount, 0);
    const totalDislikes = items.reduce((s, i) => s + i.dislikesCount, 0);
    const totalFavorites = items.reduce((s, i) => s + i.favoritesCount, 0);
    const totalReviews = items.reduce((s, i) => s + i.reviewsCount, 0);
    const totalViews = items.reduce((s, i) => s + i.viewsCount, 0);

    return {
      summary: {
        totalArticles: items.length,
        totalLikes,
        totalDislikes,
        totalFavorites,
        totalReviews,
        totalViews,
      },
      items,
    };
  }

  async listAdminReviews() {
    const rows = await this.prisma.review.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        product: { select: { id: true, name: true, slug: true, sku: true } },
        customer: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      productId: r.productId,
      productName: r.product.name,
      productSlug: r.product.slug,
      authorName: `${r.customer.firstName} ${r.customer.lastName}`.trim(),
      authorEmail: r.customer.email,
      rating: r.rating,
      title: r.title,
      comment: r.body || '',
      isVerifiedPurchase: r.isVerifiedPurchase,
      status: r.status,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  }

  async moderateReview(id: string, dto: ModerateReviewDto, moderator?: string) {
    const existing = await this.prisma.review.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Commentaire introuvable');
    return this.prisma.review.update({
      where: { id },
      data: {
        status: dto.status,
        moderatedAt: new Date(),
        moderatedBy: moderator || 'ADMIN',
      },
    });
  }

  async deleteAdminReview(id: string) {
    await this.prisma.review.delete({ where: { id } });
    return { deleted: true };
  }

  async bulkActionReviews(
    ids: string[],
    action: 'STATUS' | 'DELETE',
    status?: 'APPROVED' | 'REJECTED' | 'PENDING',
    moderator?: string,
  ) {
    const cleanIds = Array.from(new Set((ids || []).filter(Boolean)));
    if (cleanIds.length === 0) return { count: 0 };
    if (action === 'DELETE') {
      const r = await this.prisma.review.deleteMany({ where: { id: { in: cleanIds } } });
      return { count: r.count };
    }
    if (status) {
      const r = await this.prisma.review.updateMany({
        where: { id: { in: cleanIds } },
        data: {
          status: status as any,
          moderatedAt: new Date(),
          moderatedBy: moderator || 'ADMIN',
        },
      });
      return { count: r.count };
    }
    return { count: 0 };
  }

  private mapDashboardNotification(n: any) {
    const meta = (n.metadata as any) || {};
    return {
      id: n.id,
      type: meta.severity || (n.type === 'LOW_STOCK' ? 'ALERT' : n.type === 'SYSTEM' ? 'INFO' : 'SUCCESS'),
      title: n.title,
      message: n.body || '',
      channel: meta.channel || (n.type === 'LOW_STOCK' ? 'STOCK' : n.type.startsWith('ORDER') ? 'ORDER' : 'SYSTEM'),
      link: n.link || '/dashboard/community/testimonials',
      isRead: n.isRead,
      recipient: meta.targetRoles || 'ROOT / Super Admin / Website Manager',
      createdAt: n.createdAt,
    };
  }

  async listNotifications(_userId: string, query?: any) {
    const wantsPagination =
      query &&
      (query.limit !== undefined ||
        query.offset !== undefined ||
        query.paginated === 'true');

    if (!wantsPagination) {
      const rows = await this.prisma.notification.findMany({
        orderBy: { createdAt: 'desc' },
        take: 200,
      });
      return rows.map((n) => this.mapDashboardNotification(n));
    }

    const searchQ = String(query?.search || '').trim().toLowerCase();
    const statusFilter = String(query?.status || 'ALL').toUpperCase();
    const typeFilter = String(query?.type || 'ALL').toUpperCase();
    const channelFilter = String(query?.channel || 'ALL').toUpperCase();
    const startDate = query?.startDate ? new Date(String(query.startDate)) : null;
    const endDate = query?.endDate ? new Date(String(query.endDate)) : null;
    if (startDate && !String(query.startDate).includes('T')) startDate.setHours(0, 0, 0, 0);
    if (endDate && !String(query.endDate).includes('T')) endDate.setHours(23, 59, 59, 999);

    const limit = Math.max(1, Number(query?.limit ?? 10));
    const offset = Math.max(0, Number(query?.offset ?? 0));

    // Fast SQL path when only status filter or unfiltered feed is requested (e.g., navbar popover & infinite scroll)
    const isSimpleQuery =
      !searchQ &&
      typeFilter === 'ALL' &&
      channelFilter === 'ALL' &&
      !startDate &&
      !endDate &&
      ['ALL', 'READ', 'UNREAD'].includes(statusFilter);

    if (isSimpleQuery) {
      const filteredWhere: any =
        statusFilter === 'UNREAD'
          ? { isRead: false }
          : statusFilter === 'READ'
          ? { isRead: true }
          : {};

      const [rows, filteredCount, totalAll, unreadCount, alertCount] = await Promise.all([
        this.prisma.notification.findMany({
          where: filteredWhere,
          orderBy: { createdAt: 'desc' },
          skip: offset,
          take: limit,
        }),
        this.prisma.notification.count({ where: filteredWhere }),
        this.prisma.notification.count(),
        this.prisma.notification.count({ where: { isRead: false } }),
        this.prisma.notification.count({
          where: {
            OR: [
              { type: 'LOW_STOCK' },
              { metadata: { path: ['severity'], equals: 'ALERT' } },
            ],
          },
        }),
      ]);

      const items = rows.map((n) => this.mapDashboardNotification(n));
      return {
        items,
        data: items,
        total: filteredCount,
        totalAll,
        unreadCount,
        readCount: totalAll - unreadCount,
        alertCount,
        hasMore: offset + items.length < filteredCount,
        offset,
        limit,
      };
    }

    const rows = await this.prisma.notification.findMany({
      orderBy: { createdAt: 'desc' },
    });
    const allMapped = rows.map((n) => this.mapDashboardNotification(n));
    const totalAll = allMapped.length;
    const unreadCount = allMapped.filter((n) => !n.isRead).length;
    const readCount = totalAll - unreadCount;
    const alertCount = allMapped.filter((n) => n.type === 'ALERT').length;

    const filtered = allMapped.filter((item) => {
      if (searchQ) {
        const hit =
          item.title.toLowerCase().includes(searchQ) ||
          item.message.toLowerCase().includes(searchQ) ||
          item.channel.toLowerCase().includes(searchQ);
        if (!hit) return false;
      }
      if (statusFilter === 'UNREAD' && item.isRead) return false;
      if (statusFilter === 'READ' && !item.isRead) return false;
      if (typeFilter !== 'ALL' && item.type !== typeFilter) return false;
      if (channelFilter !== 'ALL' && item.channel !== channelFilter) return false;
      if (startDate && new Date(item.createdAt) < startDate) return false;
      if (endDate && new Date(item.createdAt) > endDate) return false;
      return true;
    });

    const items = filtered.slice(offset, offset + limit);

    return {
      items,
      data: items,
      total: filtered.length,
      totalAll,
      unreadCount,
      readCount,
      alertCount,
      hasMore: offset + items.length < filtered.length,
      offset,
      limit,
    };
  }

  async bulkActionNotifications(
    ids: string[],
    action: 'MARK_READ' | 'MARK_UNREAD' | 'DELETE',
  ) {
    const cleanIds = Array.from(new Set((ids || []).filter(Boolean)));
    if (cleanIds.length === 0) return { count: 0 };
    if (action === 'DELETE') {
      const r = await this.prisma.notification.deleteMany({ where: { id: { in: cleanIds } } });
      return { count: r.count };
    }
    const markRead = action === 'MARK_READ';
    const r = await this.prisma.notification.updateMany({
      where: { id: { in: cleanIds } },
      data: { isRead: markRead, readAt: markRead ? new Date() : null },
    });
    return { count: r.count };
  }

  async toggleNotificationRead(id: string, _userId: string) {
    const n = await this.prisma.notification.findUnique({ where: { id } });
    if (!n) throw new NotFoundException('Notification introuvable');
    return this.prisma.notification.update({
      where: { id },
      data: { isRead: !n.isRead, readAt: !n.isRead ? new Date() : null },
    });
  }

  async markAllNotificationsRead(_userId: string) {
    await this.prisma.notification.updateMany({
      where: { isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
    return { success: true };
  }

  async deleteNotification(id: string) {
    await this.prisma.notification.delete({ where: { id } });
    return { deleted: true };
  }

  async getMyProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        avatar: true,
        customer: {
          select: {
            id: true,
            phone: true,
            birthDate: true,
            gender: true,
            newsletterSub: true,
            addresses: {
              orderBy: { updatedAt: 'desc' },
            },
          },
        },
      },
    });
    if (!user) throw new NotFoundException('Utilisateur introuvable');

    const addresses = user.customer?.addresses || [];
    const shippingAddr =
      addresses.find((a) => a.label === 'SHIPPING') || addresses.find((a) => a.isDefault) || addresses[0] || null;
    const billingAddr = addresses.find((a) => a.label === 'BILLING') || shippingAddr || null;

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone || user.customer?.phone || '',
      avatar: user.avatar || null,
      birthDate: user.customer?.birthDate ? user.customer.birthDate.toISOString().slice(0, 10) : '',
      gender: user.customer?.gender || 'PREFER_NOT_TO_SAY',
      newsletterSub: user.customer?.newsletterSub ?? false,
      shippingAddress: shippingAddr
        ? {
            firstName: shippingAddr.firstName,
            lastName: shippingAddr.lastName,
            phone: shippingAddr.phone || user.phone || '',
            street: shippingAddr.street || '',
            street2: shippingAddr.street2 || '',
            city: shippingAddr.city || '',
            state: shippingAddr.state || '',
            postalCode: shippingAddr.postalCode || '',
          }
        : null,
      billingAddress: billingAddr
        ? {
            firstName: billingAddr.firstName,
            lastName: billingAddr.lastName,
            phone: billingAddr.phone || user.phone || '',
            street: billingAddr.street || '',
            street2: billingAddr.street2 || '',
            city: billingAddr.city || '',
            state: billingAddr.state || '',
            postalCode: billingAddr.postalCode || '',
          }
        : null,
    };
  }

  async updateMyProfile(userId: string, dto: UpdateMyProfileDto) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        phone: dto.phone?.trim() || null,
        ...(dto.avatar !== undefined ? { avatar: dto.avatar || null } : {}),
      },
      select: { id: true, email: true, firstName: true, lastName: true, phone: true, avatar: true },
    });

    let cust = await this.prisma.customer.findFirst({ where: { OR: [{ userId }, { email: user.email }] } });
    const parsedBirthDate = dto.birthDate ? new Date(dto.birthDate) : undefined;
    const validGender = ['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY'].includes(String(dto.gender))
      ? (dto.gender as any)
      : undefined;

    if (cust) {
      cust = await this.prisma.customer.update({
        where: { id: cust.id },
        data: {
          userId,
          firstName: dto.firstName.trim(),
          lastName: dto.lastName.trim(),
          phone: dto.phone?.trim() || null,
          ...(parsedBirthDate && !isNaN(parsedBirthDate.getTime()) ? { birthDate: parsedBirthDate } : {}),
          ...(validGender ? { gender: validGender } : {}),
        },
      });
    } else {
      cust = await this.prisma.customer.create({
        data: {
          userId,
          email: user.email,
          firstName: dto.firstName.trim(),
          lastName: dto.lastName.trim(),
          phone: dto.phone?.trim() || null,
          ...(parsedBirthDate && !isNaN(parsedBirthDate.getTime()) ? { birthDate: parsedBirthDate } : {}),
          ...(validGender ? { gender: validGender } : {}),
        },
      });
    }

    const upsertTypedAddress = async (label: string, addr?: Record<string, any>) => {
      if (!addr || (!addr.city && !addr.state && !addr.street)) return;
      const existing = await this.prisma.address.findFirst({
        where: { customerId: cust!.id, label },
      });
      const dataPayload = {
        firstName: String(addr.firstName || dto.firstName).trim(),
        lastName: String(addr.lastName || dto.lastName).trim(),
        phone: String(addr.phone || dto.phone || '').trim() || null,
        street: String(addr.street || addr.street2 || '').trim() || 'Adresse principale',
        street2: addr.street2 ? String(addr.street2).trim() : null,
        city: String(addr.city || 'Tunis').trim(),
        state: addr.state ? String(addr.state).trim() : null,
        postalCode: addr.postalCode ? String(addr.postalCode).trim() : null,
        country: 'TN',
        isDefault: label === 'SHIPPING',
      };
      if (existing) {
        await this.prisma.address.update({ where: { id: existing.id }, data: dataPayload });
      } else {
        await this.prisma.address.create({ data: { customerId: cust!.id, label, ...dataPayload } });
      }
    };

    await upsertTypedAddress('SHIPPING', dto.shippingAddress);
    await upsertTypedAddress('BILLING', dto.billingAddress);

    return this.getMyProfile(userId);
  }

  private async resolveOrCreateCustomer(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    let cust = await this.prisma.customer.findFirst({
      where: { OR: [{ userId }, { email: user.email }] },
    });
    if (!cust) {
      cust = await this.prisma.customer.create({
        data: {
          userId,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
        },
      });
    } else if (!cust.userId) {
      cust = await this.prisma.customer.update({
        where: { id: cust.id },
        data: { userId },
      });
    }
    return { user, customer: cust };
  }

  private formatStorefrontProductCard(p: any) {
    if (!p) return null;
    const gallery = Array.isArray(p.images) ? p.images.map((i: any) => i.url) : [];
    const primaryImage = gallery[0] || '/images/products/placeholder.jpg';
    const sp = Number(p.sellingPrice || 0);
    const dp = p.discountPrice ? Number(p.discountPrice) : null;
    const discountPct =
      dp !== null && dp > 0 && dp < sp ? Math.round(((sp - dp) / sp) * 100) : null;
    const approvedReviews = Array.isArray(p.reviews) ? p.reviews : [];
    const ratingAvg =
      approvedReviews.length > 0
        ? Number(
            (
              approvedReviews.reduce((acc: number, r: any) => acc + Number(r.rating || 0), 0) /
              approvedReviews.length
            ).toFixed(1),
          )
        : 0;
    return {
      id: p.id,
      sku: p.sku,
      name: p.name,
      slug: p.slug,
      shortDescription: p.shortDescription,
      sellingPrice: sp,
      discountPrice: dp,
      discountPercent: discountPct,
      discountPercentage: discountPct,
      primaryImage,
      images: gallery.length > 0 ? gallery : [primaryImage],
      category: p.category || null,
      brand: p.brand || null,
      variants: Array.isArray(p.variants)
        ? p.variants.map((v: any) => ({
            id: v.id,
            sku: v.sku,
            name: v.name,
            sellingPrice: v.sellingPrice ? Number(v.sellingPrice) : sp,
            attributesJson: v.attributesJson,
          }))
        : [],
      reviewsCount: p._count?.reviews ?? approvedReviews.length,
      reviewCount: p._count?.reviews ?? approvedReviews.length,
      likeCount: p.likeCount ?? 0,
      dislikeCount: p.dislikeCount ?? 0,
      favoriteCount: p.favoriteCount ?? 0,
      rating: ratingAvg,
      stockStatus: 'IN_STOCK',
    };
  }

  private readonly cardInclude = {
    images: { orderBy: [{ isPrimary: 'desc' as const }, { sortOrder: 'asc' as const }] },
    category: { select: { name: true, slug: true } },
    brand: { select: { name: true, slug: true } },
    variants: { orderBy: { sortOrder: 'asc' as const } },
    reviews: { where: { status: 'APPROVED' as const }, select: { rating: true } },
    _count: { select: { reviews: { where: { status: 'APPROVED' as const } } } },
  };

  async toggleCustomerWishlist(userId: string, dto: ToggleWishlistDto) {
    const { customer } = await this.resolveOrCreateCustomer(userId);
    const existing = await this.prisma.wishlist.findFirst({
      where: { customerId: customer.id, productId: dto.productId },
    });
    let saved = false;
    if (dto.action === 'REMOVE') {
      await this.prisma.wishlist.deleteMany({
        where: { customerId: customer.id, productId: dto.productId },
      });
      saved = false;
    } else if (dto.action === 'ADD') {
      if (!existing) {
        await this.prisma.wishlist.create({
          data: { customerId: customer.id, productId: dto.productId, variantId: dto.variantId || null },
        });
      }
      saved = true;
    } else if (existing) {
      await this.prisma.wishlist.deleteMany({
        where: { customerId: customer.id, productId: dto.productId },
      });
      saved = false;
    } else {
      await this.prisma.wishlist.create({
        data: { customerId: customer.id, productId: dto.productId, variantId: dto.variantId || null },
      });
      saved = true;
    }
    const favCount = await this.prisma.wishlist.count({ where: { productId: dto.productId } });
    await this.prisma.product.update({
      where: { id: dto.productId },
      data: { favoriteCount: favCount },
    }).catch(() => null);

    return { saved, favoriteCount: favCount };
  }

  async getMyWishlistProducts(userId: string) {
    const { customer } = await this.resolveOrCreateCustomer(userId);
    const rows = await this.prisma.wishlist.findMany({
      where: { customerId: customer.id },
      orderBy: { createdAt: 'desc' },
      include: { product: { include: this.cardInclude } },
    });
    const seen = new Set<string>();
    const list: any[] = [];
    for (const r of rows) {
      if (r.product && !r.product.deletedAt && !seen.has(r.productId)) {
        seen.add(r.productId);
        list.push(this.formatStorefrontProductCard(r.product));
      }
    }
    return list;
  }

  async toggleProductReaction(userId: string, dto: ToggleReactionDto) {
    const { customer } = await this.resolveOrCreateCustomer(userId);
    const product = await this.prisma.product.findUnique({ where: { id: dto.productId } });
    if (!product) throw new NotFoundException('Article introuvable');

    const existing = await this.prisma.productLike.findUnique({
      where: { productId_customerId: { productId: dto.productId, customerId: customer.id } },
    });

    let myReaction: 'LIKE' | 'DISLIKE' | null = dto.reaction;
    if (existing) {
      if ((existing as any).reaction === dto.reaction) {
        await this.prisma.productLike.delete({ where: { id: existing.id } });
        myReaction = null;
      } else {
        await this.prisma.productLike.update({
          where: { id: existing.id },
          data: { reaction: dto.reaction } as any,
        });
      }
    } else {
      await this.prisma.productLike.create({
        data: {
          productId: dto.productId,
          customerId: customer.id,
          reaction: dto.reaction,
        } as any,
      });
    }

    const [likeCount, dislikeCount] = await Promise.all([
      this.prisma.productLike.count({ where: { productId: dto.productId, reaction: 'LIKE' } as any }),
      this.prisma.productLike.count({ where: { productId: dto.productId, reaction: 'DISLIKE' } as any }),
    ]);

    await this.prisma.product.update({
      where: { id: dto.productId },
      data: { likeCount, dislikeCount } as any,
    });

    return { productId: dto.productId, myReaction, likeCount, dislikeCount };
  }

  async getMyReactions(userId: string) {
    const { customer } = await this.resolveOrCreateCustomer(userId);
    const rows = await this.prisma.productLike.findMany({
      where: { customerId: customer.id },
      select: { productId: true, reaction: true } as any,
    });
    const reactions: Record<string, 'LIKE' | 'DISLIKE'> = {};
    for (const r of rows as any[]) {
      reactions[r.productId] = r.reaction || 'LIKE';
    }
    return { reactions };
  }

  async getMyReviews(userId: string) {
    const { customer } = await this.resolveOrCreateCustomer(userId);
    const rows = await this.prisma.review.findMany({
      where: { customerId: customer.id },
      select: { productId: true, rating: true, title: true, body: true },
    });
    const reviews: Record<string, { rating: number; title?: string | null; body: string }> = {};
    for (const r of rows) {
      reviews[r.productId] = { rating: r.rating, title: r.title, body: r.body || '' };
    }
    return { reviews };
  }

  async getMyInteractions(userId: string) {
    const { customer } = await this.resolveOrCreateCustomer(userId);
    const [custReactions, custReviews, custWishlists, custOrders] = await Promise.all([
      this.prisma.productLike.findMany({
        where: { customerId: customer.id },
        orderBy: { createdAt: 'desc' },
        include: { product: { include: this.cardInclude } },
      }),
      this.prisma.review.findMany({
        where: { customerId: customer.id },
        orderBy: { updatedAt: 'desc' },
        include: { product: { include: this.cardInclude } },
      }),
      this.prisma.wishlist.findMany({
        where: { customerId: customer.id },
        orderBy: { createdAt: 'desc' },
        include: { product: { include: this.cardInclude } },
      }),
      this.prisma.order.findMany({
        where: { customerId: customer.id, isDeleted: false },
        orderBy: { createdAt: 'desc' },
        include: {
          items: { include: { product: { include: this.cardInclude } } },
        },
      }),
    ]);

    const [reactions, reviews, wishlists, orders] = await Promise.all([
      custReactions.length > 0
        ? custReactions
        : this.prisma.productLike.findMany({
            orderBy: { createdAt: 'desc' },
            take: 20,
            include: { product: { include: this.cardInclude } },
          }),
      custReviews.length > 0
        ? custReviews
        : this.prisma.review.findMany({
            orderBy: { updatedAt: 'desc' },
            take: 20,
            include: { product: { include: this.cardInclude } },
          }),
      Promise.resolve(custWishlists),
      custOrders.length > 0
        ? custOrders
        : this.prisma.order.findMany({
            where: { isDeleted: false },
            orderBy: { createdAt: 'desc' },
            take: 20,
            include: {
              items: { include: { product: { include: this.cardInclude } } },
            },
          }),
    ]);

    const likedProducts = (reactions as any[])
      .filter((r) => (r.reaction || 'LIKE') === 'LIKE' && r.product && !r.product.deletedAt)
      .map((r) => this.formatStorefrontProductCard(r.product));
    const dislikedProducts = (reactions as any[])
      .filter((r) => r.reaction === 'DISLIKE' && r.product && !r.product.deletedAt)
      .map((r) => this.formatStorefrontProductCard(r.product));
    const wishlistProducts = wishlists
      .filter((w) => w.product && !w.product.deletedAt)
      .map((w) => this.formatStorefrontProductCard(w.product));

    const commentedItems = reviews
      .filter((r) => r.product && !r.product.deletedAt)
      .map((r) => ({
        reviewId: r.id,
        rating: r.rating,
        title: r.title,
        body: r.body,
        status: r.status,
        createdAt: r.updatedAt,
        product: this.formatStorefrontProductCard(r.product),
      }));

    const orderedProductsMap = new Map<string, any>();
    for (const o of orders) {
      for (const it of o.items) {
        if (it.product && !it.product.deletedAt && !orderedProductsMap.has(it.product.id)) {
          orderedProductsMap.set(it.product.id, this.formatStorefrontProductCard(it.product));
        }
      }
    }

    return {
      likedProducts,
      dislikedProducts,
      wishlistProducts,
      commentedItems,
      orderedProducts: Array.from(orderedProductsMap.values()),
      orders: orders.map((o) => ({
        id: o.id,
        reference: o.reference,
        status: o.status,
        totalAmount: Number(o.totalAmount || 0),
        createdAt: o.createdAt,
        itemsCount: o.items.reduce((s, i) => s + i.quantity, 0),
        items: o.items.map((it) => ({
          productId: it.productId,
          productName: it.productName,
          quantity: it.quantity,
          unitPrice: Number(it.unitPrice || 0),
          imageUrl: it.imageUrl || it.product?.images?.[0]?.url || null,
          slug: it.product?.slug || null,
        })),
      })),
    };
  }

  async getMyTimeline(userId: string) {
    const { user, customer: cust } = await this.resolveOrCreateCustomer(userId);
    const fullName = `${user.firstName} ${user.lastName}`.trim();

    const [custOrders, custReviews, custReactions, custWishlists] = await Promise.all([
      this.prisma.order.findMany({
        where: { customerId: cust.id, isDeleted: false },
        orderBy: { createdAt: 'desc' },
        include: {
          statusHistory: { orderBy: { createdAt: 'desc' } },
          items: { take: 4, include: { product: { include: { images: { take: 1 } } } } },
        },
      }),
      this.prisma.review.findMany({
        where: { customerId: cust.id },
        orderBy: { updatedAt: 'desc' },
        include: { product: { include: this.cardInclude } },
      }),
      this.prisma.productLike.findMany({
        where: { customerId: cust.id },
        orderBy: { createdAt: 'desc' },
        include: { product: { include: this.cardInclude } },
      }),
      this.prisma.wishlist.findMany({
        where: { customerId: cust.id },
        orderBy: { createdAt: 'desc' },
        include: { product: { include: this.cardInclude } },
      }),
    ]);

    const [orders, reviews, reactions, wishlists] = await Promise.all([
      custOrders.length > 0
        ? custOrders
        : this.prisma.order.findMany({
            where: { isDeleted: false },
            orderBy: { createdAt: 'desc' },
            take: 15,
            include: {
              statusHistory: { orderBy: { createdAt: 'desc' } },
              items: { take: 4, include: { product: { include: { images: { take: 1 } } } } },
            },
          }),
      custReviews.length > 0
        ? custReviews
        : this.prisma.review.findMany({
            orderBy: { updatedAt: 'desc' },
            take: 15,
            include: { product: { include: this.cardInclude } },
          }),
      custReactions.length > 0
        ? custReactions
        : this.prisma.productLike.findMany({
            orderBy: { createdAt: 'desc' },
            take: 15,
            include: { product: { include: this.cardInclude } },
          }),
      custWishlists.length > 0
        ? custWishlists
        : this.prisma.wishlist.findMany({
            orderBy: { createdAt: 'desc' },
            take: 15,
            include: { product: { include: this.cardInclude } },
          }),
    ]);

    const events: Array<{
      id: string;
      type: 'ORDER' | 'CANCELLED' | 'DELIVERED' | 'COUPON' | 'REVIEW' | 'LIKE' | 'DISLIKE' | 'WISHLIST';
      actorName: string;
      actorAvatar: string | null;
      headline: string;
      title: string;
      description: string;
      link?: string;
      rating?: number;
      reviewBody?: string;
      product?: any;
      order?: any;
      createdAt: Date;
    }> = [];

    for (const o of orders) {
      const orderSummary = {
        id: o.id,
        reference: o.reference,
        status: o.status,
        totalAmount: Number(o.totalAmount || 0),
        items: o.items.map((it) => ({
          productName: it.productName,
          quantity: it.quantity,
          unitPrice: Number(it.unitPrice || 0),
          imageUrl: it.imageUrl || it.product?.images?.[0]?.url || null,
          slug: it.product?.slug || null,
        })),
      };

      events.push({
        id: `ord-${o.id}`,
        type: 'ORDER',
        actorName: fullName,
        actorAvatar: user.avatar || null,
        headline: `${fullName} a passé la commande ${o.reference}`,
        title: `Commande ${o.reference}`,
        description: `${o.items.map((i) => `${i.quantity}x ${i.productName}`).join(' · ')} — Total ${Number(o.totalAmount).toFixed(3)} TND`,
        link: `/order-confirmation/${o.reference}`,
        order: orderSummary,
        createdAt: o.createdAt,
      });

      if (o.couponCode) {
        events.push({
          id: `cp-${o.id}`,
          type: 'COUPON',
          actorName: fullName,
          actorAvatar: user.avatar || null,
          headline: `${fullName} a utilisé le code promo ${o.couponCode}`,
          title: `Code promo : ${o.couponCode}`,
          description: `Réduction appliquée de ${Number(o.discountAmount || 0).toFixed(3)} TND sur ${o.reference}`,
          link: `/order-confirmation/${o.reference}`,
          order: orderSummary,
          createdAt: o.createdAt,
        });
      }

      if (o.status === 'CANCELLED' && o.cancelledAt) {
        events.push({
          id: `can-${o.id}`,
          type: 'CANCELLED',
          actorName: fullName,
          actorAvatar: user.avatar || null,
          headline: `Commande ${o.reference} annulée`,
          title: `Commande annulée : ${o.reference}`,
          description: `Votre commande ${o.reference} (${Number(o.totalAmount).toFixed(3)} TND) a été annulée`,
          link: `/order-confirmation/${o.reference}`,
          order: orderSummary,
          createdAt: o.cancelledAt,
        });
      }

      if (o.status === 'DELIVERED' && o.deliveredAt) {
        events.push({
          id: `del-${o.id}`,
          type: 'DELIVERED',
          actorName: fullName,
          actorAvatar: user.avatar || null,
          headline: `Colis ${o.reference} livré avec succès`,
          title: `Commande livrée : ${o.reference}`,
          description: `Votre colis ${o.reference} a été remis à votre adresse`,
          link: `/order-confirmation/${o.reference}`,
          order: orderSummary,
          createdAt: o.deliveredAt,
        });
      }
    }

    for (const r of reviews) {
      if (!r.product || r.product.deletedAt) continue;
      events.push({
        id: `rev-${r.id}`,
        type: 'REVIEW',
        actorName: fullName,
        actorAvatar: user.avatar || null,
        headline: `${fullName} a publié un avis (${r.rating}★) sur ${r.product.name}`,
        title: r.title || `${r.rating}/5 ★ — ${r.product.name}`,
        description: r.body || 'Évaluation client',
        link: `/articles/${r.product.slug}`,
        rating: r.rating,
        reviewBody: r.body || undefined,
        product: this.formatStorefrontProductCard(r.product),
        createdAt: r.updatedAt,
      });
    }

    for (const rx of reactions as any[]) {
      if (!rx.product || rx.product.deletedAt) continue;
      const isDislike = rx.reaction === 'DISLIKE';
      events.push({
        id: `rx-${rx.id}`,
        type: isDislike ? 'DISLIKE' : 'LIKE',
        actorName: fullName,
        actorAvatar: user.avatar || null,
        headline: isDislike
          ? `${fullName} n’a pas aimé ${rx.product.name}`
          : `${fullName} a aimé ${rx.product.name}`,
        title: rx.product.name,
        description: isDislike ? 'Réaction Je n’aime pas enregistrée' : 'Réaction J’aime enregistrée',
        link: `/articles/${rx.product.slug}`,
        product: this.formatStorefrontProductCard(rx.product),
        createdAt: rx.updatedAt || rx.createdAt,
      });
    }

    for (const w of wishlists) {
      if (!w.product || w.product.deletedAt) continue;
      events.push({
        id: `wish-${w.id}`,
        type: 'WISHLIST',
        actorName: fullName,
        actorAvatar: user.avatar || null,
        headline: `${fullName} a ajouté ${w.product.name} à sa liste d’envies`,
        title: w.product.name,
        description: `Sauvegardé dans votre wishlist Royal`,
        link: `/articles/${w.product.slug}`,
        product: this.formatStorefrontProductCard(w.product),
        createdAt: w.createdAt,
      });
    }

    return events.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  // ── Client Notifications Feed (Personal DB notifications + Order/Promo/Catalog Updates) ──
  async getClientNotificationsFeed(userId: string, query?: any) {
    const { customer } = await this.resolveOrCreateCustomer(userId);
    const [ownPersonalRows, recentOrderHistory, newestProducts, promoProducts, activeCoupons] =
      await Promise.all([
        this.prisma.notification.findMany({
          where: { OR: [{ userId }, { userId: null }] },
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.orderStatusHistory.findMany({
          where: { order: { customerId: customer.id, isDeleted: false } },
          orderBy: { createdAt: 'desc' },
          include: { order: { select: { reference: true, totalAmount: true } } },
        }),
        this.prisma.product.findMany({
          where: { status: 'ACTIVE', deletedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 30,
          select: {
            id: true,
            name: true,
            slug: true,
            sellingPrice: true,
            discountPrice: true,
            createdAt: true,
            updatedAt: true,
            category: { select: { name: true, slug: true } },
          },
        }),
        this.prisma.product.findMany({
          where: {
            status: 'ACTIVE',
            deletedAt: null,
            discountPrice: { not: null },
          },
          orderBy: { updatedAt: 'desc' },
          select: {
            id: true,
            name: true,
            slug: true,
            sellingPrice: true,
            discountPrice: true,
            updatedAt: true,
            category: { select: { name: true, slug: true } },
          },
        }),
        this.prisma.coupon.findMany({
          where: { isActive: true },
          orderBy: { createdAt: 'desc' },
        }),
      ]);

    const personalRows =
      ownPersonalRows.length > 0
        ? ownPersonalRows
        : await this.prisma.notification.findMany({
            orderBy: { createdAt: 'desc' },
          });

    const notifications = personalRows.map((n) => {
      const meta = (n.metadata as any) || {};
      return {
        id: n.id,
        category: meta.channel || (n.type.startsWith('ORDER') ? 'ORDER' : 'SYSTEM'),
        title: n.title,
        message: n.body,
        link: n.link || null,
        isRead: n.isRead,
        createdAt: n.createdAt,
        isPersonal: true,
      };
    });

    const catalogFeed: Array<{
      id: string;
      category: 'ORDER' | 'PROMO' | 'CATALOG' | 'PRICE';
      title: string;
      message: string;
      link: string;
      badge?: string;
      createdAt: Date;
    }> = [];

    for (const h of recentOrderHistory) {
      catalogFeed.push({
        id: `oh-${h.id}`,
        category: 'ORDER',
        title: `Suivi Commande ${h.order.reference} : ${h.toStatus}`,
        message: h.comment || `Statut mis à jour : ${h.fromStatus ? `${h.fromStatus} → ` : ''}${h.toStatus}`,
        link: `/order-confirmation/${h.order.reference}`,
        badge: h.toStatus,
        createdAt: h.createdAt,
      });
    }

    for (const p of promoProducts) {
      const sell = Number(p.sellingPrice || 0);
      const disc = Number(p.discountPrice || 0);
      if (disc > 0 && disc < sell) {
        const pct = Math.round(((sell - disc) / sell) * 100);
        catalogFeed.push({
          id: `pr-${p.id}`,
          category: 'PROMO',
          title: `Promotion -${pct}% : ${p.name}`,
          message: `Prix réduit à ${disc.toFixed(3)} TND au lieu de ${sell.toFixed(3)} TND${p.category?.name ? ` (${p.category.name})` : ''}.`,
          link: `/articles/${p.slug}`,
          badge: `-${pct}%`,
          createdAt: p.updatedAt,
        });
      }
    }

    for (const p of newestProducts) {
      catalogFeed.push({
        id: `new-${p.id}`,
        category: 'CATALOG',
        title: `Nouvel article ajouté : ${p.name}`,
        message: `Disponible dans ${p.category?.name || 'Catalogue Royal'} au tarif de ${Number(p.discountPrice || p.sellingPrice).toFixed(3)} TND.`,
        link: `/articles/${p.slug}`,
        badge: 'Nouveau',
        createdAt: p.createdAt,
      });
    }

    for (const c of activeCoupons) {
      if (String(c.code || '').startsWith('PROMO-')) continue;
      catalogFeed.push({
        id: `cpn-${c.id}`,
        category: 'PROMO',
        title: `Offre Spéciale : Code ${c.code}`,
        message: c.description || `Remise ${c.type === 'PERCENTAGE' ? `${c.value}%` : `${c.value} TND`} (${c.targetType === 'CATEGORY' ? 'Catégorie ciblée' : c.targetType === 'ARTICLE' ? 'Articles ciblés' : 'Catalogue'})`,
        link: '/articles?sortBy=promo',
        badge: c.code,
        createdAt: c.createdAt,
      });
    }

    catalogFeed.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const unreadCount = notifications.filter((n) => !n.isRead).length;
    const personalTotal = notifications.length;
    const feedTotal = catalogFeed.length;

    const wantsPagination =
      query &&
      (query.limit !== undefined ||
        query.offset !== undefined ||
        query.feedLimit !== undefined ||
        query.feedOffset !== undefined);

    if (wantsPagination) {
      const limit = Math.max(1, Number(query?.limit ?? 10));
      const offset = Math.max(0, Number(query?.offset ?? 0));
      const feedLimit = Math.max(1, Number(query?.feedLimit ?? limit));
      const feedOffset = Math.max(0, Number(query?.feedOffset ?? 0));
      const pagedNotifications = notifications.slice(offset, offset + limit);
      const pagedFeed = catalogFeed.slice(feedOffset, feedOffset + feedLimit);
      return {
        notifications: pagedNotifications,
        personalTotal,
        personalHasMore: offset + pagedNotifications.length < personalTotal,
        unreadCount,
        catalogFeed: pagedFeed,
        feedTotal,
        feedHasMore: feedOffset + pagedFeed.length < feedTotal,
      };
    }

    return {
      notifications,
      personalTotal,
      personalHasMore: false,
      unreadCount,
      catalogFeed,
      feedTotal,
      feedHasMore: false,
    };
  }

  // ── Client <-> Royal Support Multi-Admin Discussions (ROOT, SUPER_ADMIN, WEBSITE_MANAGER) ──
  private async getSupportAdminUsers() {
    return this.prisma.user.findMany({
      where: {
        deletedAt: null,
        isActive: true,
        userRoles: {
          some: {
            role: { name: { in: ['ROOT', 'SUPER_ADMIN', 'ADMIN', 'WEBSITE_MANAGER'] } },
          },
        },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        userRoles: { select: { role: { select: { name: true } } } },
      },
    });
  }

  async getMySupportThreads(userId: string) {
    const { customer } = await this.resolveOrCreateCustomer(userId);
    let threads = await this.prisma.supportThread.findMany({
      where: { customerId: customer.id },
      orderBy: { updatedAt: 'desc' },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (threads.length === 0) {
      threads = await this.prisma.supportThread.findMany({
        orderBy: { updatedAt: 'desc' },
        include: {
          messages: { orderBy: { createdAt: 'asc' } },
        },
      });
    }

    // Mark admin replies as read when client views
    await this.prisma.supportMessage
      .updateMany({
        where: {
          thread: { customerId: customer.id },
          senderRole: { not: 'CLIENT' },
          isReadByClient: false,
        },
        data: { isReadByClient: true },
      })
      .catch(() => null);

    return threads;
  }

  async sendClientSupportMessage(userId: string, dto: CreateSupportMessageDto) {
    const { user, customer } = await this.resolveOrCreateCustomer(userId);
    const fullName = `${user.firstName} ${user.lastName}`.trim() || user.email;
    const cleanBody = dto.message.trim();
    if (!cleanBody) throw new BadRequestException('Le message ne peut pas être vide.');

    let thread: any = null;
    if (dto.threadId) {
      thread = await this.prisma.supportThread.findFirst({
        where: { id: dto.threadId, customerId: customer.id },
      });
    }

    if (!thread) {
      thread = await this.prisma.supportThread.create({
        data: {
          customerId: customer.id,
          subject: dto.subject?.trim() || 'Discussion avec Support Royal',
          status: 'OPEN',
        },
      });
    } else {
      await this.prisma.supportThread.update({
        where: { id: thread.id },
        data: { status: 'OPEN', updatedAt: new Date() },
      });
    }

    const msg = await this.prisma.supportMessage.create({
      data: {
        threadId: thread.id,
        senderId: user.id,
        senderRole: 'CLIENT',
        senderName: fullName,
        body: cleanBody,
        isReadByAdmin: false,
        isReadByClient: true,
      },
    });

    // Notify ALL active ROOT, SUPER_ADMIN, ADMIN, WEBSITE_MANAGER users
    const admins = await this.getSupportAdminUsers();
    if (admins.length > 0) {
      await this.prisma.notification
        .createMany({
          data: admins.map((adm) => ({
            userId: adm.id,
            type: 'SYSTEM' as any,
            title: `Nouveau message Support — ${fullName}`,
            body: `[${thread.subject}] : "${cleanBody.slice(0, 140)}"`,
            link: '/dashboard/community/messages',
            metadata: {
              channel: 'SUPPORT',
              severity: 'INFO',
              threadId: thread.id,
              targetRoles: adm.userRoles.map((r) => r.role.name).join(', '),
            } as any,
          })),
        })
        .catch(() => null);
    }

    return this.prisma.supportThread.findUnique({
      where: { id: thread.id },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
  }

  async listAdminSupportThreads() {
    return this.prisma.supportThread.findMany({
      orderBy: { updatedAt: 'desc' },
      include: {
        customer: {
          select: { id: true, firstName: true, lastName: true, email: true, phone: true },
        },
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });
  }

  async bulkActionSupportThreads(
    ids: string[],
    action: 'STATUS' | 'DELETE',
    status?: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED',
  ) {
    const cleanIds = Array.from(new Set((ids || []).filter(Boolean)));
    if (cleanIds.length === 0) return { count: 0 };
    if (action === 'DELETE') {
      const r = await this.prisma.supportThread.deleteMany({ where: { id: { in: cleanIds } } });
      return { count: r.count };
    }
    if (status) {
      const r = await this.prisma.supportThread.updateMany({
        where: { id: { in: cleanIds } },
        data: { status: status as any },
      });
      return { count: r.count };
    }
    return { count: 0 };
  }

  async replyAdminSupportThread(
    threadId: string,
    adminUserId: string,
    dto: ReplySupportThreadDto,
  ) {
    const cleanBody = dto.message.trim();
    if (!cleanBody) throw new BadRequestException('La réponse ne peut pas être vide.');

    const thread = await this.prisma.supportThread.findUnique({
      where: { id: threadId },
      include: { customer: true },
    });
    if (!thread) throw new NotFoundException('Discussion introuvable.');

    const adminUser = await this.prisma.user.findUnique({
      where: { id: adminUserId },
      include: { userRoles: { select: { role: { select: { name: true } } } } },
    });
    if (!adminUser) throw new NotFoundException('Administrateur introuvable.');

    const roleNames = adminUser.userRoles.map((r) => r.role.name);
    const primaryRole =
      roleNames.find((r) => ['ROOT', 'SUPER_ADMIN', 'WEBSITE_MANAGER', 'ADMIN'].includes(r)) ||
      roleNames[0] ||
      'ADMIN';
    const senderLabel =
      primaryRole === 'ADMIN' ? 'WEBSITE_MANAGER' : primaryRole;
    const senderName = `${adminUser.firstName} ${adminUser.lastName}`.trim();

    const msg = await this.prisma.supportMessage.create({
      data: {
        threadId: thread.id,
        senderId: adminUser.id,
        senderRole: senderLabel,
        senderName,
        body: cleanBody,
        isReadByAdmin: true,
        isReadByClient: false,
      },
    });

    await this.prisma.supportThread.update({
      where: { id: thread.id },
      data: { status: 'IN_PROGRESS', updatedAt: new Date() },
    });

    // Notify client + sibling admins (ROOT, SUPER_ADMIN, WEBSITE_MANAGER)
    const admins = await this.getSupportAdminUsers();
    const notificationsToCreate: any[] = [];

    if (thread.customer?.userId) {
      notificationsToCreate.push({
        userId: thread.customer.userId,
        type: 'SYSTEM' as any,
        title: `Réponse du Support Royal (${senderLabel})`,
        body: `${senderName} : "${cleanBody.slice(0, 140)}"`,
        link: '/account/messages',
        metadata: {
          channel: 'SUPPORT',
          severity: 'INFO',
          threadId: thread.id,
          targetRoles: 'CLIENT',
        } as any,
      });
    }

    for (const adm of admins) {
      if (adm.id === adminUser.id) continue;
      notificationsToCreate.push({
        userId: adm.id,
        type: 'SYSTEM' as any,
        title: `Réponse équipe (${senderLabel}) — ${thread.customer.firstName} ${thread.customer.lastName}`,
        body: `${senderName} : "${cleanBody.slice(0, 140)}"`,
        link: '/dashboard/community/messages',
        metadata: {
          channel: 'SUPPORT',
          severity: 'INFO',
          threadId: thread.id,
          targetRoles: adm.userRoles.map((r) => r.role.name).join(', '),
        } as any,
      });
    }

    if (notificationsToCreate.length > 0) {
      await this.prisma.notification.createMany({ data: notificationsToCreate }).catch(() => null);
    }

    return this.prisma.supportThread.findUnique({
      where: { id: thread.id },
      include: {
        customer: {
          select: { id: true, firstName: true, lastName: true, email: true, phone: true },
        },
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });
  }

  async updateSupportThreadStatus(id: string, dto: UpdateSupportStatusDto) {
    return this.prisma.supportThread.update({
      where: { id },
      data: { status: dto.status as any },
      include: {
        customer: {
          select: { id: true, firstName: true, lastName: true, email: true, phone: true },
        },
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });
  }

  async updateCmsIdentity(dto: UpdateCmsIdentityDto, updatedBy?: string) {
    const current = await this.getPublicConfig();
    const merged = { ...current.identity, ...dto };
    await this.upsertSetting('cms.identity', JSON.stringify(merged), 'cms', updatedBy);
    if (merged.appName) await this.upsertSetting('branding.app_name', merged.appName, 'branding', updatedBy);
    if (merged.logoUrl) await this.upsertSetting('branding.app_logo_url', merged.logoUrl, 'branding', updatedBy);
    if (merged.faviconUrl) await this.upsertSetting('branding.favicon_url', merged.faviconUrl, 'branding', updatedBy);
    return this.getPublicConfig();
  }

  async updateCmsLayout(dto: UpdateCmsLayoutDto, updatedBy?: string) {
    const current = await this.getPublicConfig();
    if (dto.theme) {
      await this.upsertSetting('cms.theme', JSON.stringify({ ...current.theme, ...dto.theme }), 'cms', updatedBy);
    }
    if (dto.header) {
      await this.upsertSetting('cms.header', JSON.stringify({ ...current.header, ...dto.header }), 'cms', updatedBy);
    }
    if (dto.footer) {
      await this.upsertSetting('cms.footer', JSON.stringify({ ...current.footer, ...dto.footer }), 'cms', updatedBy);
    }
    return this.getPublicConfig();
  }

  async updateCmsViews(dto: UpdateCmsViewsDto, updatedBy?: string) {
    const current = await this.getPublicConfig();
    const incoming = dto.views || {};
    const merged = {
      home: { ...current.views.home, ...(incoming.home || {}) },
      articles: { ...current.views.articles, ...(incoming.articles || {}) },
      productDetail: { ...current.views.productDetail, ...(incoming.productDetail || {}) },
      contact: { ...current.views.contact, ...(incoming.contact || {}) },
      faq: { ...current.views.faq, ...(incoming.faq || {}) },
      showrooms: { ...current.views.showrooms, ...(incoming.showrooms || {}) },
      terms: { ...((current.views as any).terms || {}), ...(incoming.terms || {}) },
      privacy: { ...((current.views as any).privacy || {}), ...(incoming.privacy || {}) },
    };
    await this.upsertSetting('cms.views', JSON.stringify(merged), 'cms', updatedBy);
    const rawNextSlides = Array.isArray(dto.heroSlides)
      ? dto.heroSlides
      : Array.isArray((incoming as any).heroSlides)
      ? (incoming as any).heroSlides
      : null;
    if (rawNextSlides) {
      const nextSlides = this.sanitizeHeroSlides(
        rawNextSlides,
        this.getDefaultsSnapshot().heroSlides || [],
      );
      await this.upsertSetting('cms.heroSlides', JSON.stringify(nextSlides), 'cms', updatedBy);
    }
    return this.getPublicConfig();
  }

  async resetCmsDefaults(updatedBy?: string) {
    const snap = this.getDefaultsSnapshot();
    await Promise.all([
      this.upsertSetting('cms.identity', JSON.stringify(snap.identity || {}), 'cms', updatedBy),
      this.upsertSetting('branding.app_name', snap.identity?.appName || 'Royal', 'branding', updatedBy),
      this.upsertSetting('branding.app_logo_url', snap.identity?.logoUrl || '/images/royal-logo.jpg', 'branding', updatedBy),
      this.upsertSetting('branding.favicon_url', snap.identity?.faviconUrl || '/icon.png', 'branding', updatedBy),
      this.upsertSetting('cms.theme', JSON.stringify(snap.theme || DEFAULT_THEME), 'cms', updatedBy),
      this.upsertSetting('cms.header', JSON.stringify(snap.header || DEFAULT_HEADER), 'cms', updatedBy),
      this.upsertSetting('cms.footer', JSON.stringify(snap.footer || DEFAULT_FOOTER), 'cms', updatedBy),
      this.upsertSetting('cms.views', JSON.stringify(snap.views || DEFAULT_VIEWS), 'cms', updatedBy),
      this.upsertSetting('cms.heroSlides', JSON.stringify(snap.heroSlides || []), 'cms', updatedBy),
    ]);
    return this.getPublicConfig();
  }

  async listCuratedTestimonials() {
    const row = await this.prisma.settings.findUnique({ where: { key: 'cms.testimonials' } });
    return this.parseJsonSetting<any[]>(row?.value, []);
  }

  async createCuratedTestimonial(dto: UpsertCuratedTestimonialDto, updatedBy?: string) {
    const list = await this.listCuratedTestimonials();
    const nextItem = {
      id: `test-${Date.now()}`,
      name: dto.name,
      city: dto.city || 'Tunisie',
      dateLabel: dto.dateLabel || "Aujourd'hui",
      avatar: dto.avatar || '',
      stars: Math.min(5, Math.max(1, dto.stars || 5)),
      comment: dto.comment,
      isActive: dto.isActive !== false,
    };
    const nextList = [nextItem, ...list];
    await this.upsertSetting('cms.testimonials', JSON.stringify(nextList), 'cms', updatedBy);
    return nextList;
  }

  async updateCuratedTestimonial(id: string, dto: Partial<UpsertCuratedTestimonialDto>, updatedBy?: string) {
    const list = await this.listCuratedTestimonials();
    const nextList = list.map((item) => (item.id === id ? { ...item, ...dto } : item));
    await this.upsertSetting('cms.testimonials', JSON.stringify(nextList), 'cms', updatedBy);
    return nextList;
  }

  async deleteCuratedTestimonial(id: string, updatedBy?: string) {
    const list = await this.listCuratedTestimonials();
    const nextList = list.filter((item) => item.id !== id);
    await this.upsertSetting('cms.testimonials', JSON.stringify(nextList), 'cms', updatedBy);
    return nextList;
  }

  private async ensureDefaultEmailTemplates() {
    const count = await this.prisma.emailTemplate.count();
    if (count > 0) return;
    const defaults = [
      {
        key: 'auth:welcome',
        name: 'Bienvenue Nouveau Client',
        subject: 'Bienvenue chez {{appName}}, {{firstName}} !',
        bodyHtml: '<p>Bonjour {{firstName}},</p><p>Votre compte Royal est activé. Profitez de nos nouveautés électroménager.</p>',
        variables: ['{{appName}}', '{{firstName}}', '{{lastName}}', '{{email}}'],
      },
      {
        key: 'auth:forgot_password',
        name: 'Mot de Passe Oublié / Réinitialisation',
        subject: 'Réinitialisation de votre mot de passe Royal',
        bodyHtml: '<p>Bonjour {{firstName}},</p><p>Cliquez ici pour réinitialiser votre mot de passe : {{resetLink}} (valide {{expireTime}}).</p>',
        variables: ['{{firstName}}', '{{resetLink}}', '{{expireTime}}'],
      },
      {
        key: 'auth:verify_email',
        name: 'Confirmation d’Adresse Email',
        subject: 'Confirmez votre adresse email — Royal',
        bodyHtml: '<p>Bonjour {{firstName}},</p><p>Veuillez confirmer votre email via le lien : {{verifyLink}}.</p>',
        variables: ['{{firstName}}', '{{verifyLink}}'],
      },
      {
        key: 'campaign:promo_general',
        name: 'Campagne Promotion & Black Friday',
        subject: 'Offres Exclusives Royal : Jusqu’à -{{discountPercent}}% !',
        bodyHtml: '<p>Découvrez nos promotions sur une sélection d’appareils Royal & DSP. Code : <strong>{{promoCode}}</strong>.</p>',
        variables: ['{{firstName}}', '{{discountPercent}}', '{{promoCode}}', '{{campaignUrl}}'],
      },
      {
        key: 'messages:support_reply',
        name: 'Réponse Support & Formulaire Contact',
        subject: 'Re: {{subject}} — Service Client Royal',
        bodyHtml: '<p>Bonjour {{customerName}},</p><p>{{replyBody}}</p><p>Cordialement,<br/>Équipe Support Royal</p>',
        variables: ['{{customerName}}', '{{subject}}', '{{replyBody}}'],
      },
      {
        key: 'orders:status_update',
        name: 'Suivi & Changement Statut Commande',
        subject: 'Votre commande #{{orderNumber}} : {{statusLabel}}',
        bodyHtml: '<p>Merci {{firstName}} pour votre confiance.</p><p>Statut actuel de votre commande #{{orderNumber}} : <strong>{{statusLabel}}</strong>.</p>',
        variables: ['{{firstName}}', '{{orderNumber}}', '{{statusLabel}}', '{{trackingUrl}}'],
      },
    ];
    for (const d of defaults) {
      await this.prisma.emailTemplate.create({
        data: { ...d, isActive: true, variables: d.variables as any },
      });
    }
  }

  async listEmailTemplates() {
    await this.ensureDefaultEmailTemplates();
    const list = await this.prisma.emailTemplate.findMany({ orderBy: { createdAt: 'asc' } });
    return list.map((t) => {
      const catPrefix = t.key.includes(':') ? t.key.split(':')[0] : 'orders';
      const category = ['auth', 'campaign', 'messages', 'orders'].includes(catPrefix) ? catPrefix : 'orders';
      return { ...t, category };
    });
  }

  async upsertEmailTemplate(id: string | null, dto: Partial<UpsertEmailTemplateDto>) {
    const category = dto.category || 'orders';
    const rawKey = (dto.key || '').includes(':') ? dto.key! : `${category}:${dto.key || Date.now()}`;
    if (id) {
      return this.prisma.emailTemplate.update({
        where: { id },
        data: {
          ...(dto.name ? { name: dto.name } : {}),
          ...(dto.subject ? { subject: dto.subject } : {}),
          ...(dto.subjectAr !== undefined ? { subjectAr: dto.subjectAr } : {}),
          ...(dto.bodyHtml ? { bodyHtml: dto.bodyHtml } : {}),
          ...(dto.bodyHtmlAr !== undefined ? { bodyHtmlAr: dto.bodyHtmlAr } : {}),
          ...(dto.variables ? { variables: dto.variables as any } : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        },
      });
    }
    return this.prisma.emailTemplate.create({
      data: {
        key: rawKey,
        name: dto.name || 'Nouveau Modèle',
        subject: dto.subject || 'Information Royal',
        subjectAr: dto.subjectAr || null,
        bodyHtml: dto.bodyHtml || '<p>Bonjour,</p>',
        bodyHtmlAr: dto.bodyHtmlAr || null,
        variables: (dto.variables || []) as any,
        isActive: dto.isActive !== false,
      },
    });
  }

  async deleteEmailTemplate(id: string) {
    return this.prisma.emailTemplate.delete({ where: { id } });
  }

  async listProspects() {
    const row = await this.prisma.settings.findUnique({ where: { key: 'crm.prospects' } });
    return this.parseJsonSetting<any[]>(row?.value, [
      { id: 'pros-1', companyName: 'Import Electro Méditerranée', contactName: 'Nabil Trabelsi', phone: '+216 71 900 120', email: 'nabil@med-electro.tn', city: 'Tunis', specialty: 'Petit Électroménager', status: 'CONTACTED', notes: 'Catalogue tarifaire demandé — sans commande BC pour l’instant', createdAt: new Date().toISOString() },
      { id: 'pros-2', companyName: 'Sfax Distribution Pro', contactName: 'Hatem Gargouri', phone: '+216 74 220 840', email: 'contact@sfaxdist.tn', city: 'Sfax', specialty: 'Cuisson & Fours', status: 'QUALIFIED', notes: 'À convertir en fiche fournisseur officielle après validation devis', createdAt: new Date().toISOString() },
    ]);
  }

  async saveProspects(prospects: any[], updatedBy?: string) {
    await this.upsertSetting('crm.prospects', JSON.stringify(prospects), 'purchases', updatedBy);
    return prospects;
  }

  async listShowrooms() {
    return this.prisma.pointOfSale.findMany({
      include: { cashRegisters: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createShowroom(dto: UpsertShowroomDto) {
    const wh = await this.prisma.warehouse.findFirst({ orderBy: { createdAt: 'asc' } });
    if (!wh) throw new BadRequestException('Aucun entrepôt configuré pour rattacher la salle d’exposition.');
    return this.prisma.pointOfSale.create({
      data: {
        name: dto.name,
        code: dto.code,
        warehouseId: wh.id,
        address: dto.city ? `${dto.address} (${dto.city})` : dto.address,
        phone: dto.phone || null,
        isActive: dto.isActive !== false,
      },
      include: { cashRegisters: true, warehouse: true },
    });
  }

  async updateShowroom(id: string, dto: Partial<UpsertShowroomDto>) {
    return this.prisma.pointOfSale.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.code !== undefined ? { code: dto.code } : {}),
        ...(dto.address !== undefined ? { address: dto.city ? `${dto.address} (${dto.city})` : dto.address } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
      include: { cashRegisters: true, warehouse: true },
    });
  }

  async deleteShowroom(id: string) {
    const existing = await this.prisma.pointOfSale.findUnique({
      where: { id },
      include: { cashRegisters: true },
    });
    if (!existing) {
      throw new NotFoundException('Salle d’exposition introuvable.');
    }
    try {
      await this.prisma.pointOfSale.delete({ where: { id } });
      return { ok: true, deletedId: id };
    } catch {
      await this.prisma.pointOfSale.update({
        where: { id },
        data: { isActive: false },
      });
      return { ok: true, archivedId: id, softDeactivated: true };
    }
  }

  async bulkActionShowrooms(ids: string[], action: 'ACTIVATE' | 'DEACTIVATE' | 'DELETE') {
    const cleanIds = Array.from(new Set((Array.isArray(ids) ? ids : []).filter(Boolean)));
    if (cleanIds.length === 0) return { ok: true, count: 0 };
    if (action === 'DELETE') {
      let count = 0;
      for (const id of cleanIds) {
        await this.deleteShowroom(id);
        count++;
      }
      return { ok: true, action, count };
    }
    const isActive = action === 'ACTIVATE';
    const res = await this.prisma.pointOfSale.updateMany({
      where: { id: { in: cleanIds } },
      data: { isActive },
    });
    return { ok: true, action, count: res.count };
  }

  async getSectionDashboard(section: string) {
    const key = section.toLowerCase();

    if (key === 'community') {
      const [
        reviewsCount,
        approvedReviews,
        pendingReviews,
        contactsCount,
        unreadContactsCount,
        repliedContactsCount,
        supportCount,
        openSupportCount,
        resolvedSupportCount,
        newsletterCount,
        notificationsCount,
        totalNotificationsCount,
        recentReviews,
        recentContacts,
        recentThreads,
      ] = await Promise.all([
        this.prisma.review.count(),
        this.prisma.review.count({ where: { status: 'APPROVED' } }),
        this.prisma.review.count({ where: { status: 'PENDING' } }),
        this.prisma.contactSubmission.count(),
        this.prisma.contactSubmission.count({ where: { isRead: false } }),
        this.prisma.contactSubmission.count({ where: { status: 'REPLIED' } }),
        this.prisma.supportThread.count(),
        this.prisma.supportThread.count({ where: { status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
        this.prisma.supportThread.count({ where: { status: 'RESOLVED' } }),
        this.prisma.newsletterSubscriber.count({ where: { isActive: true } }),
        this.prisma.notification.count({ where: { isRead: false } }),
        this.prisma.notification.count(),
        this.prisma.review.findMany({
          take: 5,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            rating: true,
            title: true,
            status: true,
            createdAt: true,
            customer: { select: { firstName: true, lastName: true } },
          },
        }),
        this.prisma.contactSubmission.findMany({
          take: 5,
          orderBy: { createdAt: 'desc' },
          select: { id: true, fullName: true, subject: true, isRead: true, status: true, createdAt: true },
        }),
        this.prisma.supportThread.findMany({
          take: 5,
          orderBy: { updatedAt: 'desc' },
          select: { id: true, subject: true, status: true, updatedAt: true },
        }),
      ]);

      const totalMsgs = contactsCount + supportCount;
      const resolutionRate = totalMsgs > 0 ? Math.round(((repliedContactsCount + resolvedSupportCount) / totalMsgs) * 100) : 0;

      return {
        section: key,
        kpis: {
          notificationsCount,
          totalNotificationsCount,
          supportCount,
          openSupportCount,
          contactsCount,
          unreadContactsCount,
        },
        charts: {
          statusBreakdown: [
            { label: 'Contacts Non Lus', value: unreadContactsCount },
            { label: 'Contacts Répondus', value: repliedContactsCount },
            { label: 'Support Ouverts', value: openSupportCount },
            { label: 'Support Résolus', value: resolvedSupportCount },
          ],
          channelVolumes: [
            { label: 'Notifications', value: totalNotificationsCount },
            { label: 'Messages Contact', value: contactsCount },
            { label: 'Tickets Support', value: supportCount },
            { label: 'Abonnés Newsletter', value: newsletterCount },
            { label: 'Avis Publiés', value: approvedReviews },
          ],
          engagementCompare: [
            { label: 'Notifications', primary: notificationsCount, secondary: Math.max(0, totalNotificationsCount - notificationsCount) },
            { label: 'Contacts', primary: repliedContactsCount, secondary: unreadContactsCount },
            { label: 'Support', primary: resolvedSupportCount, secondary: openSupportCount },
            { label: 'Avis', primary: approvedReviews, secondary: pendingReviews },
          ],
          resolutionRate,
        },
        lists: {
          recentReviews: recentReviews.map((r) => ({
            id: r.id,
            authorName: r.customer ? `${r.customer.firstName} ${r.customer.lastName}` : 'Client',
            rating: r.rating,
            title: r.title,
            status: r.status,
            createdAt: r.createdAt,
          })),
          recentContacts,
          recentThreads,
        },
      };
    }

    if (key === 'users') {
      const [usersCount, activeUsers, inactiveUsers, customersCount, roles, recentStaff] =
        await Promise.all([
          this.prisma.user.count({ where: { isDeleted: false } }),
          this.prisma.user.count({ where: { isDeleted: false, isActive: true } }),
          this.prisma.user.count({ where: { isDeleted: false, isActive: false } }),
          this.prisma.customer.count(),
          this.prisma.role.findMany({
            include: { _count: { select: { userRoles: true } } },
            orderBy: { name: 'asc' },
          }),
          this.prisma.user.findMany({
            where: { isDeleted: false },
            take: 6,
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              isActive: true,
              createdAt: true,
              userRoles: { include: { role: { select: { name: true, displayName: true } } } },
            },
          }),
        ]);
      const roleBreakdown = roles.map((r) => ({
        name: r.name,
        label: r.displayName || r.name,
        count: r._count.userRoles,
      }));
      const activeRate = usersCount > 0 ? Math.round((activeUsers / usersCount) * 100) : 0;
      return {
        section: key,
        kpis: {
          usersCount,
          activeUsers,
          inactiveUsers,
          customersCount,
          rolesCount: roles.length,
        },
        roleBreakdown,
        charts: {
          roleDistribution: roleBreakdown.map((r) => ({ label: r.label, value: r.count })),
          accountStatusSlices: [
            { label: 'Comptes Actifs', value: activeUsers },
            { label: 'Comptes Inactifs', value: inactiveUsers },
            { label: 'Clients Boutique', value: customersCount },
          ],
          roleCoverage: roleBreakdown.slice(0, 5).map((r) => ({
            label: r.label,
            value: r.count,
            maxValue: Math.max(1, ...roleBreakdown.map((x) => x.count)),
            unit: 'comptes',
          })),
          activeRate,
        },
        lists: {
          recentStaff: recentStaff.map((u) => ({
            id: u.id,
            fullName: `${u.firstName} ${u.lastName}`,
            email: u.email,
            status: u.isActive ? 'ACTIF' : 'INACTIF',
            role: u.userRoles?.[0]?.role?.displayName || u.userRoles?.[0]?.role?.name || 'Membre',
            createdAt: u.createdAt,
          })),
        },
      };
    }

    if (key === 'catalogue') {
      const [
        productsCount,
        activeProducts,
        draftProducts,
        categoriesCount,
        brandsCount,
        variantsCount,
        characteristicsCount,
        couponsCount,
        categories,
        brands,
        topProducts,
      ] = await Promise.all([
        this.prisma.product.count({ where: { isDeleted: false } }),
        this.prisma.product.count({ where: { isDeleted: false, status: 'ACTIVE' } }),
        this.prisma.product.count({ where: { isDeleted: false, status: { not: 'ACTIVE' } } }),
        this.prisma.category.count({ where: { isActive: true } }),
        this.prisma.brand.count({ where: { isActive: true } }),
        this.prisma.productVariant.count({ where: { isDeleted: false } }),
        this.prisma.characteristic.count(),
        this.prisma.coupon.count({ where: { isActive: true } }),
        this.prisma.category.findMany({
          where: { isActive: true },
          include: { _count: { select: { products: true } } },
        }),
        this.prisma.brand.findMany({
          where: { isActive: true },
          include: { _count: { select: { products: true } } },
        }),
        this.prisma.product.findMany({
          where: { isDeleted: false },
          take: 6,
          orderBy: { createdAt: 'desc' },
          select: { id: true, sku: true, name: true, sellingPrice: true, status: true, createdAt: true },
        }),
      ]);
      const catSorted = categories
        .map((c) => ({ name: c.name, count: c._count.products }))
        .filter((c) => c.count > 0)
        .sort((a, b) => b.count - a.count)
        .slice(0, 6);
      const brandSorted = brands
        .map((b) => ({ name: b.name, count: b._count.products }))
        .filter((b) => b.count > 0)
        .sort((a, b) => b.count - a.count)
        .slice(0, 6);
      const activeRate = productsCount > 0 ? Math.round((activeProducts / productsCount) * 100) : 0;
      return {
        section: key,
        kpis: {
          productsCount,
          activeProducts,
          categoriesCount,
          brandsCount,
          variantsCount,
          characteristicsCount,
          couponsCount,
        },
        categoryBreakdown: catSorted,
        charts: {
          topCategories: catSorted.map((c) => ({ label: c.name, value: c.count, unit: 'art.' })),
          statusSlices: [
            { label: 'Articles Actifs', value: activeProducts },
            { label: 'Brouillons / Autres', value: draftProducts },
            { label: 'Promos Actives', value: couponsCount },
          ],
          brandBars: brandSorted.map((b) => ({ label: b.name, primary: b.count, secondary: 0 })),
          activeRate,
        },
        lists: {
          recentProducts: topProducts.map((p) => ({
            id: p.id,
            sku: p.sku,
            name: p.name,
            sellingPrice: Number(p.sellingPrice || 0),
            status: p.status,
            createdAt: p.createdAt,
          })),
        },
      };
    }

    if (key === 'treasury') {
      const [caissesCount, openSessions, movementsCount, paymentsAgg, cashMovementsAll, recentMovements, recentPayments, txSys, paySys] =
        await Promise.all([
          this.prisma.cashRegister.count({ where: { isActive: true } }),
          this.prisma.cashRegisterSession.count({ where: { closedAt: null } }),
          this.prisma.cashMovement.count(),
          this.prisma.payment.aggregate({ _sum: { amount: true }, where: { status: 'COMPLETED' } }),
          this.prisma.cashMovement.findMany({
            select: { type: true, amount: true },
          }),
          this.prisma.cashMovement.findMany({
            take: 10,
            orderBy: { createdAt: 'desc' },
            select: { id: true, type: true, amount: true, description: true, createdAt: true },
          }),
          this.prisma.payment.findMany({
            take: 10,
            orderBy: { createdAt: 'desc' },
            select: { id: true, method: true, amount: true, status: true, createdAt: true },
          }),
          this.getSysConfig('treasuryTransactions').then((r) => (Array.isArray(r.value) ? r.value : [])).catch(() => []),
          this.getSysConfig('treasuryPayments').then((r) => (Array.isArray(r.value) ? r.value : [])).catch(() => []),
        ]);

      const dbCashInflow = cashMovementsAll
        .filter((m) => ['OPENING', 'SALE', 'DEPOSIT'].includes(m.type))
        .reduce((s, m) => s + Number(m.amount || 0), 0);
      const dbCashOutflow = cashMovementsAll
        .filter((m) => ['REFUND', 'EXPENSE', 'WITHDRAWAL'].includes(m.type))
        .reduce((s, m) => s + Number(m.amount || 0), 0);
      const dbPosSales = cashMovementsAll
        .filter((m) => m.type === 'SALE')
        .reduce((s, m) => s + Number(m.amount || 0), 0);

      const sysTxCount = txSys.length;
      const sysInflow = txSys.filter((t: any) => t.direction === 'IN' || t.type === 'RECEIPT' || t.type === 'INFLOW').reduce((s: number, t: any) => s + Number(t.amount ?? t.amountTnd ?? 0), 0);
      const sysOutflow = txSys.filter((t: any) => t.direction === 'OUT' || t.type === 'DISBURSEMENT' || t.type === 'OUTFLOW').reduce((s: number, t: any) => s + Number(t.amount ?? t.amountTnd ?? 0), 0);
      const sysPaidTotal = paySys.filter((p: any) => p.status === 'PAID' || p.status === 'ENCAISSE').reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
      const combinedPayments = Number(paymentsAgg._sum.amount || 0) + sysPaidTotal + dbPosSales;
      const totalInflows = dbCashInflow + sysInflow + Number(paymentsAgg._sum.amount || 0);
      const totalOutflows = dbCashOutflow + sysOutflow;

      const byMethodMap: Record<string, number> = {};
      recentPayments.forEach((p) => {
        const m = p.method || 'AUTRE';
        byMethodMap[m] = (byMethodMap[m] || 0) + Number(p.amount || 0);
      });
      paySys.forEach((p: any) => {
        const m = p.method || p.paymentMethod || 'VIREMENT';
        byMethodMap[m] = (byMethodMap[m] || 0) + Number(p.amount || 0);
      });
      if (dbPosSales > 0 && recentPayments.length === 0) {
        byMethodMap['Caisse POS'] = (byMethodMap['Caisse POS'] || 0) + dbPosSales;
      }
      const methodSlices = Object.entries(byMethodMap)
        .filter(([, value]) => value > 0)
        .map(([label, value]) => ({ label, value: Math.round(value) }));

      const trendPoints =
        recentMovements.length > 0
          ? recentMovements
              .slice(0, 6)
              .reverse()
              .map((m, i) => ({
                label: m.description ? m.description.slice(0, 14) : `${m.type} #${i + 1}`,
                value: Number(m.amount || 0),
              }))
          : txSys
              .slice(0, 6)
              .reverse()
              .map((t: any, i: number) => ({
                label: t.reference || `Op #${i + 1}`,
                value: Number(t.amount ?? t.amountTnd ?? 0),
              }));

      const totalSettledOps = paySys.length + (dbPosSales > 0 ? 1 : 0) + (Number(paymentsAgg._sum.amount || 0) > 0 ? 1 : 0);
      const settledNumerator =
        paySys.filter((p: any) => p.status === 'PAID' || p.status === 'ENCAISSE').length +
        (dbPosSales > 0 ? 1 : 0) +
        (Number(paymentsAgg._sum.amount || 0) > 0 ? 1 : 0);

      return {
        section: key,
        kpis: {
          caissesCount,
          openSessions,
          movementsCount: movementsCount + sysTxCount,
          totalPayments: combinedPayments,
        },
        charts: {
          cashflowCompare: [
            { label: 'Encaissements', primary: Math.round(totalInflows), secondary: 0 },
            { label: 'Décaissements', primary: 0, secondary: Math.round(totalOutflows) },
            { label: 'Règlements Validés', primary: Math.round(combinedPayments), secondary: 0 },
          ],
          methodSlices,
          trendPoints,
          settlementRate: totalSettledOps > 0 ? Math.round((settledNumerator / totalSettledOps) * 100) : 0,
        },
        lists: {
          recentMovements: recentMovements.map((m) => ({ ...m, amount: Number(m.amount || 0) })),
          recentPayments: recentPayments.map((p) => ({ ...p, amount: Number(p.amount || 0) })),
        },
      };
    }

    if (key === 'purchases') {
      const [prospectsRow, suppliersCount, activeSuppliers, recentSuppliers, poSys, brSys] = await Promise.all([
        this.prisma.settings.findUnique({ where: { key: 'cms.prospects' } }),
        this.prisma.supplier.count({ where: { isDeleted: false } }),
        this.prisma.supplier.count({ where: { isDeleted: false, isActive: true } }),
        this.prisma.supplier.findMany({
          where: { isDeleted: false },
          take: 6,
          orderBy: { createdAt: 'desc' },
          select: { id: true, name: true, contactPerson: true, phone: true, isActive: true, createdAt: true },
        }),
        this.getSysConfig('purchaseOrders').then((r) => (Array.isArray(r.value) ? r.value : [])).catch(() => []),
        this.getSysConfig('purchaseReceipts').then((r) => (Array.isArray(r.value) ? r.value : [])).catch(() => []),
      ]);
      const prospects = this.parseJsonSetting<any[]>(prospectsRow?.value, []);
      const prospectsCount = Array.isArray(prospects) ? prospects.length : 0;
      const poCount = poSys.length;
      const brCount = brSys.length;
      const totalPoAmount = poSys.reduce((s: number, o: any) => s + Number(o.totalTtc || 0), 0);
      const poConfirmed = poSys.filter((o: any) => ['CONFIRMED', 'RECEIVED', 'COMPLETED'].includes(o.status)).length;
      const brValidated = brSys.filter((b: any) => ['VALIDATED', 'RECEIVED', 'COMPLETED'].includes(b.status)).length;

      return {
        section: key,
        kpis: {
          prospectsCount,
          suppliersCount,
          activeSuppliers,
          poCount,
          brCount,
          totalPoAmount,
        },
        charts: {
          pipelineBars: [
            { label: 'Prospects', value: prospectsCount, unit: 'contacts' },
            { label: 'Fournisseurs Actifs', value: activeSuppliers, unit: 'fiches' },
            { label: 'Commandes (BC)', value: poCount, unit: 'bons' },
            { label: 'Réceptions (BR)', value: brCount, unit: 'bons' },
          ],
          poStatusSlices: [
            { label: 'BC Confirmés / Reçus', value: poConfirmed },
            { label: 'BC En Attente', value: Math.max(0, poCount - poConfirmed) },
            { label: 'BR Validés', value: brValidated },
          ],
          supplierAmounts: poSys.slice(0, 5).map((o: any) => ({
            label: o.orderNumber || o.supplierName,
            primary: Math.round(Number(o.totalHt || 0)),
            secondary: Math.round(Number(o.totalTtc || 0) - Number(o.totalHt || 0)),
          })),
          receiptRate: poCount > 0 ? Math.round((brValidated / poCount) * 100) : 0,
        },
        lists: {
          recentSuppliers: recentSuppliers.map((s) => ({
            id: s.id,
            companyName: s.name,
            contactName: s.contactPerson,
            phone: s.phone,
            isActive: s.isActive,
            createdAt: s.createdAt,
          })),
          recentProspects: Array.isArray(prospects) ? prospects.slice(0, 5) : [],
        },
      };
    }

    if (key === 'stock') {
      const [warehouses, stockAgg, stockByWh, movByType, lowStockCount, movementsCount, transfersCount, stocks, recentMovements, bsSys] =
        await Promise.all([
          this.prisma.warehouse.findMany({ where: { isActive: true, isDeleted: false }, select: { id: true, name: true, code: true } }),
          this.prisma.stock.aggregate({ _sum: { physicalQty: true, reservedQty: true } }),
          this.prisma.stock.groupBy({ by: ['warehouseId'], _sum: { physicalQty: true, reservedQty: true }, _count: true }),
          this.prisma.stockMovement.groupBy({ by: ['type'], _count: true }),
          this.prisma.stock.count({ where: { physicalQty: { lte: 10 } } }),
          this.prisma.stockMovement.count(),
          this.prisma.stockTransfer.count(),
          this.prisma.stock.findMany({
            take: 8,
            orderBy: { physicalQty: 'asc' },
            include: {
              warehouse: { select: { name: true } },
              variant: { select: { name: true, sku: true, product: { select: { name: true } } } },
            },
          }),
          this.prisma.stockMovement.findMany({
            take: 6,
            orderBy: { createdAt: 'desc' },
            select: { id: true, type: true, quantityDelta: true, reason: true, createdAt: true },
          }),
          this.getSysConfig('stockOuts').then((r) => (Array.isArray(r.value) ? r.value : [])).catch(() => []),
        ]);

      const whMap = new Map(warehouses.map((w) => [w.id, w.name]));
      const warehouseBreakdown = stockByWh.map((g) => ({
        label: whMap.get(g.warehouseId) || g.warehouseId,
        value: Number(g._sum.physicalQty || 0),
        unit: 'pcs',
      }));
      const totalStockCount = await this.prisma.stock.count();
      const healthyRate = totalStockCount > 0 ? Math.round(((totalStockCount - lowStockCount) / totalStockCount) * 100) : 0;

      return {
        section: key,
        kpis: {
          warehousesCount: warehouses.length,
          totalPhysicalQty: stockAgg._sum.physicalQty || 0,
          totalReservedQty: stockAgg._sum.reservedQty || 0,
          lowStockCount,
          movementsCount,
          stockOutsCount: bsSys.length,
          transfersCount,
        },
        charts: {
          warehouseBreakdown,
          movementSlices: movByType.map((m) => ({ label: m.type, value: m._count })),
          coverageSegments: warehouseBreakdown.map((w) => ({
            label: w.label,
            value: w.value,
            maxValue: Math.max(1, stockAgg._sum.physicalQty || 1),
            unit: 'pcs',
          })),
          healthyRate,
        },
        lists: {
          lowStockItems: stocks.map((s) => ({
            id: s.id,
            name: `${s.variant.product.name} (${s.variant.name})`,
            sku: s.variant.sku,
            warehouse: s.warehouse.name,
            qty: s.physicalQty,
          })),
          recentMovements,
        },
      };
    }

    if (key === 'pos') {
      const [posCount, registersCount, openSessions, posOrdersCount, posOrdersAgg, showrooms, recentPosOrders, posByStatus] =
        await Promise.all([
          this.prisma.pointOfSale.count({ where: { isActive: true } }),
          this.prisma.cashRegister.count({ where: { isActive: true } }),
          this.prisma.cashRegisterSession.count({ where: { closedAt: null } }),
          this.prisma.order.count({ where: { channel: 'POS' } }),
          this.prisma.order.aggregate({ _sum: { totalAmount: true }, where: { channel: 'POS', status: { not: 'CANCELLED' } } }),
          this.prisma.pointOfSale.findMany({
            orderBy: { name: 'asc' },
            include: { warehouse: { select: { name: true, _count: { select: { stock: true } } } } },
          }),
          this.prisma.order.findMany({
            where: { channel: 'POS' },
            take: 6,
            orderBy: { createdAt: 'desc' },
            select: { id: true, reference: true, status: true, totalAmount: true, createdBy: true, createdAt: true },
          }),
          this.prisma.order.groupBy({ by: ['status'], where: { channel: 'POS' }, _count: true }),
        ]);

      return {
        section: key,
        kpis: {
          posCount,
          registersCount,
          openSessions,
          posOrdersCount,
          posRevenue: Number(posOrdersAgg._sum.totalAmount || 0),
        },
        charts: {
          showroomStocks: showrooms.map((sh) => ({
            label: sh.name,
            value: sh.warehouse?._count?.stock || 0,
            unit: 'réfs',
          })),
          posOrderSlices: posByStatus.map((g) => ({ label: g.status, value: g._count })),
          posOrderTrend: recentPosOrders.slice().reverse().map((o) => ({
            label: o.reference,
            value: Number(o.totalAmount || 0),
          })),
          readinessRate:
            showrooms.length > 0
              ? Math.round((showrooms.filter((s) => s.isActive).length / showrooms.length) * 100)
              : 0,
        },
        lists: {
          showrooms: showrooms.map((s) => ({ id: s.id, name: s.name, code: s.code, address: s.address, isActive: s.isActive })),
          recentPosOrders: recentPosOrders.map((o) => ({ ...o, totalAmount: Number(o.totalAmount || 0) })),
        },
      };
    }

    if (key === 'seo') {
      const [
        reviewsTotal,
        reviewsApproved,
        reviewsPending,
        newsletterCount,
        prodInteractions,
        topViewedProds,
        curatedRow,
        recentProducts,
      ] = await Promise.all([
        this.prisma.review.count(),
        this.prisma.review.count({ where: { status: 'APPROVED' } }),
        this.prisma.review.count({ where: { status: 'PENDING' } }),
        this.prisma.newsletterSubscriber.count({ where: { isActive: true } }),
        this.prisma.product.aggregate({
          where: { isDeleted: false },
          _sum: { viewCount: true, likeCount: true, dislikeCount: true, favoriteCount: true },
        }),
        this.prisma.product.findMany({
          where: { isDeleted: false },
          take: 5,
          orderBy: { viewCount: 'desc' },
          select: { name: true, viewCount: true, likeCount: true, favoriteCount: true },
        }),
        this.prisma.settings.findUnique({ where: { key: 'cms.testimonials' } }),
        this.prisma.product.findMany({
          where: { isDeleted: false },
          take: 6,
          orderBy: { updatedAt: 'desc' },
          select: { id: true, name: true, slug: true, metaTitle: true, metaDesc: true },
        }),
      ]);
      const curatedList = this.parseJsonSetting<any[]>(curatedRow?.value, []);
      const totalViews = Number(prodInteractions._sum.viewCount || 0);
      const totalLikes = Number(prodInteractions._sum.likeCount || 0);
      const totalDislikes = Number(prodInteractions._sum.dislikeCount || 0);
      const totalFavs = Number(prodInteractions._sum.favoriteCount || 0);

      return {
        section: key,
        kpis: {
          reviewsTotal,
          reviewsApproved,
          totalInteractions: totalLikes + totalDislikes + totalFavs,
          totalViews,
          newsletterCount,
          testimonialsCount: Array.isArray(curatedList) ? curatedList.length : 0,
        },
        charts: {
          topViewedBars: topViewedProds.map((p) => ({ label: p.name.slice(0, 22), value: p.viewCount, unit: 'vues' })),
          interactionSlices: [
            { label: 'J’aime', value: totalLikes },
            { label: 'Favoris', value: totalFavs },
            { label: 'Avis Approuvés', value: reviewsApproved },
            { label: 'Dislikes', value: totalDislikes },
          ],
          reputationCompare: [
            { label: 'Avis Clients', primary: reviewsApproved, secondary: reviewsPending },
            { label: 'Réactions', primary: totalLikes, secondary: totalDislikes },
            { label: 'Abonnés / Témoignages', primary: newsletterCount, secondary: Array.isArray(curatedList) ? curatedList.length : 0 },
          ],
          approvalScore: reviewsTotal > 0 ? Math.round((reviewsApproved / reviewsTotal) * 100) : 0,
        },
        lists: { recentProducts },
      };
    }

    if (key === 'system') {
      const [usersCount, rolesCount, permissionsCount, settingsCount, emailTemplatesCount, auditCount, auditByRes, recentAudits] =
        await Promise.all([
          this.prisma.user.count({ where: { isDeleted: false } }),
          this.prisma.role.count(),
          this.prisma.permission.count(),
          this.prisma.settings.count(),
          this.prisma.emailTemplate.count(),
          this.prisma.auditLog.count(),
          this.prisma.auditLog.groupBy({ by: ['resourceType'], _count: true, orderBy: { _count: { resourceType: 'desc' } }, take: 5 }),
          this.prisma.auditLog.findMany({
            take: 6,
            orderBy: { createdAt: 'desc' },
            select: { id: true, action: true, resourceType: true, actorName: true, createdAt: true },
          }),
        ]);
      return {
        section: key,
        kpis: {
          usersCount,
          rolesCount,
          permissionsCount,
          settingsCount,
          emailTemplatesCount,
          auditCount,
        },
        charts: {
          auditResourceBars: auditByRes.map((a) => ({ label: a.resourceType || 'SYSTEM', value: a._count, unit: 'logs' })),
          configSlices: [
            { label: 'Paramètres DB', value: settingsCount },
            { label: 'Permissions RBAC', value: permissionsCount },
            { label: 'Modèles Email', value: emailTemplatesCount },
            { label: 'Rôles Actifs', value: rolesCount },
          ],
          securityCoverage: rolesCount > 0 && permissionsCount > 0 ? 100 : 0,
        },
        lists: { recentAudits },
      };
    }

    // Sales, Reports, Client
    const [
      ordersCount,
      pendingOrders,
      deliveredOrders,
      cancelledOrders,
      couponsCount,
      customersCount,
      productsCount,
      ordersAgg,
      ordersByStatus,
      ordersByChannel,
      recentOrders,
      blSys,
      invSys,
    ] = await Promise.all([
      this.prisma.order.count(),
      this.prisma.order.count({ where: { status: 'PENDING' } }),
      this.prisma.order.count({ where: { status: 'DELIVERED' } }),
      this.prisma.order.count({ where: { status: 'CANCELLED' } }),
      this.prisma.coupon.count({ where: { isActive: true } }),
      this.prisma.customer.count(),
      this.prisma.product.count({ where: { isDeleted: false } }),
      this.prisma.order.aggregate({ _sum: { totalAmount: true }, where: { status: { not: 'CANCELLED' } } }),
      this.prisma.order.groupBy({ by: ['status'], _count: true }),
      this.prisma.order.groupBy({ by: ['channel'], _count: true, _sum: { totalAmount: true } }),
      this.prisma.order.findMany({
        take: 6,
        orderBy: { createdAt: 'desc' },
        select: { id: true, reference: true, status: true, channel: true, totalAmount: true, createdAt: true },
      }),
      this.getSysConfig('deliverySlips').then((r) => (Array.isArray(r.value) ? r.value : [])).catch(() => []),
      this.getSysConfig('invoicesList').then((r) => (Array.isArray(r.value) ? r.value : [])).catch(() => []),
    ]);

    return {
      section: key,
      kpis: {
        ordersCount,
        pendingOrders,
        deliveredOrders,
        cancelledOrders,
        couponsCount,
        customersCount,
        productsCount,
        deliveriesCount: blSys.length,
        invoicesCount: invSys.length,
        revenueTotal: Number(ordersAgg._sum.totalAmount || 0),
      },
      charts: {
        statusSlices: ordersByStatus.map((s) => ({ label: s.status, value: s._count })),
        channelBars: ordersByChannel.map((c) => ({
          label: c.channel === 'POS' ? 'Terminal POS' : 'Boutique En Ligne',
          value: Math.round(Number(c._sum.totalAmount || 0)),
          unit: 'TND',
        })),
        orderTrend: recentOrders.slice().reverse().map((o) => ({
          label: o.reference,
          value: Number(o.totalAmount || 0),
        })),
        fulfillmentRate: ordersCount > 0 ? Math.round(((ordersCount - cancelledOrders) / ordersCount) * 100) : 0,
      },
      recentOrders: recentOrders.map((o) => ({
        id: o.id,
        reference: o.reference,
        status: o.status,
        channel: o.channel,
        totalAmount: Number(o.totalAmount || 0),
        createdAt: o.createdAt,
      })),
    };
  }

  private getUploadDir() {
    const dir = path.resolve(process.cwd(), 'uploads', 'branding');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  async saveBrandingImage(file: { originalname?: string; mimetype?: string; size?: number; buffer: Buffer }) {
    const allowedMimes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp', 'image/svg+xml'];
    const ext = path.extname(file.originalname || '').toLowerCase();
    const allowedExts = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'];
    if (!allowedMimes.includes(file.mimetype || '') && !allowedExts.includes(ext)) {
      throw new BadRequestException('Format non supporté. Formats autorisés : PNG, JPG, JPEG, GIF, WEBP, SVG.');
    }
    const maxBytes = 10 * 1024 * 1024;
    if ((file.size || file.buffer.length) > maxBytes) {
      throw new BadRequestException('Fichier trop volumineux. Taille maximale autorisée : 10 Mo.');
    }

    const safeExt = allowedExts.includes(ext) ? ext : '.png';
    const mimeType = file.mimetype || (safeExt === '.svg' ? 'image/svg+xml' : `image/${safeExt.replace('.', '')}`);
    const filename = `royal-brand-${Date.now()}-${Math.floor(Math.random() * 1000)}${safeExt}`;

    const storageRow = await this.prisma.settings.findUnique({ where: { key: 'sys.mediaStorage' } });
    const storageCfg = this.parseJsonSetting<any>(storageRow?.value, this.getExtendedSysConfigDefault('mediaStorage'));
    return storeMediaAsset(file.buffer, filename, mimeType, storageCfg, this.getUploadDir());
  }

  async readBrandingImage(filename: string) {
    const clean = path.basename(filename);
    const fullPath = path.join(this.getUploadDir(), clean);
    if (!fs.existsSync(fullPath)) {
      throw new NotFoundException('Média introuvable.');
    }
    const ext = path.extname(clean).toLowerCase();
    const mimeMap: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
    };
    return {
      buffer: fs.readFileSync(fullPath),
      contentType: mimeMap[ext] || 'application/octet-stream',
    };
  }

  private getDefaultSysConfig(key: string) {
    if (key === 'marketingPixels') {
      return {
        metaPixelEnabled: false,
        metaPixelId: '',
        facebookDomainVerification: '',
        tiktokPixelEnabled: false,
        tiktokPixelId: '',
        ga4Enabled: false,
        ga4MeasurementId: '',
        gtmEnabled: false,
        gtmContainerId: '',
        snapPixelEnabled: false,
        snapPixelId: '',
        googleSiteVerification: '',
        seoTitle: 'Royal — Électro de Maison | Électroménager & Cuisine en Tunisie',
        seoDescription: 'Découvrez notre collection d’électroménager, robots culinaires, cuisson et art de la table en Tunisie. Livraison 24–48h et garantie officielle.',
        seoKeywords: 'électroménager tunisie, cuisine tunisie, airfryer, robot pétrin, royal tunisie',
        canonicalBaseUrl: '',
        robotsIndex: true,
        trackAddToCart: true,
        trackPurchase: true,
        trackWishlist: true,
        trackViewContent: true,
      };
    }
    if (key === 'smtp') {
      return {
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: Number(process.env.SMTP_PORT || 587),
        user: 'royaltn24@gmail.com',
        password: '',
        fromEmail: 'royaltn24@gmail.com',
        fromName: 'Royal — Électro de Maison',
        useTls: true,
      };
    }
    if (key === 'tva') {
      return [
        { id: 'tva-19', code: 'TVA19', label: 'TVA Standard Électroménager & Équipements', rate: 19, isDefault: true, isActive: true, createdAt: new Date().toISOString() },
        { id: 'tva-13', code: 'TVA13', label: 'TVA Intermédiaire Équipements Spécifiques', rate: 13, isDefault: false, isActive: true, createdAt: new Date().toISOString() },
        { id: 'tva-7', code: 'TVA7', label: 'TVA Réduite Accessoires & Pièces', rate: 7, isDefault: false, isActive: true, createdAt: new Date().toISOString() },
        { id: 'tva-0', code: 'EXO0', label: 'Exonération Export / Convention', rate: 0, isDefault: false, isActive: true, createdAt: new Date().toISOString() },
      ];
    }
    if (key === 'prefixes') {
      return [
        { id: 'pref-cmd', code: 'CMD', docType: 'Commande Client Web & POS', format: '{PREFIX}-{YYYY}{MM}-{SEQ4}', nextSeq: 124, preview: 'CMD-202611-0124', isActive: true, printTemplateCode: 'TPL-BON-CMD', createdAt: new Date().toISOString() },
        { id: 'pref-fac', code: 'FAC', docType: 'Facture Fiscale TTC', format: '{PREFIX}-{YYYY}-{SEQ5}', nextSeq: 418, preview: 'FAC-2026-00418', isActive: true, printTemplateCode: 'TPL-FACTURE-A4', createdAt: new Date().toISOString() },
        { id: 'pref-bl', code: 'BL', docType: 'Bon de Livraison Expédition', format: '{PREFIX}-{YY}{MM}-{SEQ4}', nextSeq: 89, preview: 'BL-2611-0089', isActive: true, printTemplateCode: 'TPL-BON-LIVR', createdAt: new Date().toISOString() },
        { id: 'pref-tk', code: 'TK', docType: 'Ticket Caisse Showroom POS', format: '{PREFIX}-{YYYYMMDD}-{SEQ4}', nextSeq: 305, preview: 'TK-20261120-0305', isActive: true, printTemplateCode: 'TPL-TICKET-80MM', createdAt: new Date().toISOString() },
        { id: 'pref-bc', code: 'BC', docType: 'Bon de Commande Fournisseur', format: '{PREFIX}-{YYYY}-{SEQ4}', nextSeq: 46, preview: 'BC-2026-0046', isActive: true, printTemplateCode: 'TPL-BON-CMD-FOURN', createdAt: new Date().toISOString() },
        { id: 'pref-br', code: 'BR', docType: 'Bon de Réception Quai', format: '{PREFIX}-{YYYY}-{SEQ4}', nextSeq: 39, preview: 'BR-2026-0039', isActive: true, printTemplateCode: 'TPL-BON-RECEP', createdAt: new Date().toISOString() },
        { id: 'pref-be', code: 'BE', docType: 'Bon d’Entrée Stock', format: '{PREFIX}-{YYYY}-{SEQ4}', nextSeq: 43, preview: 'BE-2026-0043', isActive: true, printTemplateCode: 'TPL-BON-ENTREE', createdAt: new Date().toISOString() },
        { id: 'pref-bs', code: 'BS', docType: 'Bon de Sortie & Picking', format: '{PREFIX}-{YYYY}-{SEQ4}', nextSeq: 12, preview: 'BS-2026-0012', isActive: true, printTemplateCode: 'TPL-BON-SORTIE', createdAt: new Date().toISOString() },
        { id: 'pref-inv', code: 'INV', docType: 'Document Inventaire & Ajustement', format: '{PREFIX}-{YYYY}-{SEQ4}', nextSeq: 15, preview: 'INV-2026-0015', isActive: true, printTemplateCode: 'TPL-INVENTAIRE', createdAt: new Date().toISOString() },
        { id: 'pref-trf', code: 'TRF', docType: 'Transfert Inter-Dépôts', format: '{PREFIX}-{YYYY}-{SEQ4}', nextSeq: 14, preview: 'TRF-2026-0014', isActive: true, printTemplateCode: 'TPL-TRANSFERT', createdAt: new Date().toISOString() },
        { id: 'pref-ret', code: 'RET', docType: 'Bon de Retour & Avoir SAV', format: '{PREFIX}-{YYYY}-{SEQ4}', nextSeq: 13, preview: 'RET-2026-0013', isActive: true, printTemplateCode: 'TPL-BON-RETOUR', createdAt: new Date().toISOString() },
        { id: 'pref-ecr', code: 'ECR', docType: 'Pièce & Écriture Comptable', format: '{PREFIX}-{YYYY}-{SEQ4}', nextSeq: 45, preview: 'ECR-2026-0045', isActive: true, printTemplateCode: 'TPL-PIECE-COMPTA', createdAt: new Date().toISOString() },
      ];
    }
    if (key === 'printTemplates') {
      return [
        {
          id: 'tpl-cmd',
          code: 'TPL-BON-CMD',
          name: 'Bon de Commande Client A4',
          paperFormat: 'A4',
          prefixCode: 'CMD',
          headerText: 'Royal — Électro de Maison | Mahdia 5100, Tunisie',
          footerText: 'Bon de commande client — Merci pour votre confiance.',
          htmlBody: '<div class="royal-doc"><h1>{{companyName}}</h1><p>Commande {{reference}} — Client : {{customerName}}</p></div>',
          cssStyles: '.royal-doc { font-family: Poppins, sans-serif; color: #1D232E; border-top: 4px solid #C59B27; padding: 20px; }',
          showLogo: true,
          showTaxBreakdown: true,
          showQr: true,
          isActive: true,
          createdAt: new Date().toISOString(),
        },
        {
          id: 'tpl-fac',
          code: 'TPL-FACTURE-A4',
          name: 'Facture Officielle Royal A4',
          paperFormat: 'A4',
          prefixCode: 'FAC',
          headerText: 'Royal — Électro de Maison | Mahdia 5100, Tunisie',
          footerText: 'Arrêtée la présente facture TTC. Merci pour votre confiance.',
          htmlBody: '<div class="royal-doc"><h1>{{companyName}}</h1><p>Facture N° {{reference}} — Client : {{customerName}}</p></div>',
          cssStyles: '.royal-doc { font-family: Poppins, sans-serif; color: #1D232E; border-top: 4px solid #C59B27; padding: 20px; }',
          showLogo: true,
          showTaxBreakdown: true,
          showQr: true,
          isActive: true,
          createdAt: new Date().toISOString(),
        },
        {
          id: 'tpl-bl',
          code: 'TPL-BON-LIVR',
          name: 'Bon de Livraison Transporteur',
          paperFormat: 'A4',
          prefixCode: 'BL',
          headerText: 'Expédition 24–48h • Service Logistique Mahdia',
          footerText: 'Vérification du colis requise avant paiement comptant à la livraison.',
          htmlBody: '<div class="royal-bl"><h2>BON DE LIVRAISON {{reference}}</h2><p>Destinataire : {{customerName}} — {{phone}}</p></div>',
          cssStyles: '.royal-bl { font-family: Poppins, sans-serif; border: 1px solid #C59B27; padding: 16px; }',
          showLogo: true,
          showTaxBreakdown: false,
          showQr: true,
          isActive: true,
          createdAt: new Date().toISOString(),
        },
        {
          id: 'tpl-pos',
          code: 'TPL-TICKET-80MM',
          name: 'Ticket Thermique Caisse Showroom 80mm',
          paperFormat: '80mm',
          prefixCode: 'TK',
          headerText: 'Showroom Royal • Tél: 48 091 914',
          footerText: 'Garantie constructeur selon conditions showroom.',
          htmlBody: '<div class="thermal"><strong>ROYAL {{posName}}</strong><hr/><p>Ticket {{reference}}</p></div>',
          cssStyles: '.thermal { width: 80mm; font-family: monospace; font-size: 11px; }',
          showLogo: true,
          showTaxBreakdown: true,
          showQr: true,
          isActive: true,
          createdAt: new Date().toISOString(),
        },
        {
          id: 'tpl-bc',
          code: 'TPL-BON-CMD-FOURN',
          name: 'Bon de Commande Fournisseur (BC)',
          paperFormat: 'A4',
          prefixCode: 'BC',
          headerText: 'Service Approvisionnement Royal — Commande Fournisseur',
          footerText: 'Merci d’accuser réception et de joindre le BL à la livraison.',
          htmlBody: '<div class="royal-doc"><h2>BON DE COMMANDE {{reference}}</h2></div>',
          cssStyles: '.royal-doc { font-family: Poppins, sans-serif; border-top: 4px solid #C59B27; padding: 20px; }',
          showLogo: true,
          showTaxBreakdown: true,
          showQr: true,
          isActive: true,
          createdAt: new Date().toISOString(),
        },
        {
          id: 'tpl-br',
          code: 'TPL-BON-RECEP',
          name: 'Bon de Réception Quai (BR)',
          paperFormat: 'A4',
          prefixCode: 'BR',
          headerText: 'Contrôle Qualité & Quantitatif Quai Royal',
          footerText: 'Signature du contrôleur quai et du transporteur fournisseur requise.',
          htmlBody: '<div class="royal-doc"><h2>BON DE RÉCEPTION {{reference}}</h2></div>',
          cssStyles: '.royal-doc { font-family: Poppins, sans-serif; border-top: 4px solid #C59B27; padding: 20px; }',
          showLogo: true,
          showTaxBreakdown: false,
          showQr: true,
          isActive: true,
          createdAt: new Date().toISOString(),
        },
        {
          id: 'tpl-be',
          code: 'TPL-BON-ENTREE',
          name: 'Bon d’Entrée en Stock (BE)',
          paperFormat: 'A4',
          prefixCode: 'BE',
          headerText: 'Direction Entrepôts Royal — Mise en Stock',
          footerText: 'Visa Magasinier & Responsable Dépôt.',
          htmlBody: '<div class="royal-doc"><h2>BON D’ENTRÉE {{reference}}</h2></div>',
          cssStyles: '.royal-doc { font-family: Poppins, sans-serif; border-top: 4px solid #C59B27; padding: 20px; }',
          showLogo: true,
          showTaxBreakdown: true,
          showQr: true,
          isActive: true,
          createdAt: new Date().toISOString(),
        },
        {
          id: 'tpl-bs',
          code: 'TPL-BON-SORTIE',
          name: 'Bon de Sortie & Picking Entrepôt (BS)',
          paperFormat: 'A4',
          prefixCode: 'BS',
          headerText: 'Ordre de Prélèvement Quai & Colisage Royal',
          footerText: 'Décrémentation physique validée par le magasinier.',
          htmlBody: '<div class="royal-doc"><h2>BON DE SORTIE {{reference}}</h2></div>',
          cssStyles: '.royal-doc { font-family: Poppins, sans-serif; border-top: 4px solid #C59B27; padding: 20px; }',
          showLogo: true,
          showTaxBreakdown: false,
          showQr: true,
          isActive: true,
          createdAt: new Date().toISOString(),
        },
        {
          id: 'tpl-inv',
          code: 'TPL-INVENTAIRE',
          name: 'Feuille de Comptage & Inventaire (INV)',
          paperFormat: 'A4',
          prefixCode: 'INV',
          headerText: 'Audit Physique des Stocks & Écarts',
          footerText: 'PV d’inventaire certifié conforme.',
          htmlBody: '<div class="royal-doc"><h2>INVENTAIRE {{reference}}</h2></div>',
          cssStyles: '.royal-doc { font-family: Poppins, sans-serif; border-top: 4px solid #C59B27; padding: 20px; }',
          showLogo: true,
          showTaxBreakdown: false,
          showQr: true,
          isActive: true,
          createdAt: new Date().toISOString(),
        },
        {
          id: 'tpl-trf',
          code: 'TPL-TRANSFERT',
          name: 'Bordereau de Transfert Inter-Dépôts (TRF)',
          paperFormat: 'A4',
          prefixCode: 'TRF',
          headerText: 'Logistique Interne & Réassort Showrooms Royal',
          footerText: 'Bon pour transfert entre dépôts Royal.',
          htmlBody: '<div class="royal-doc"><h2>TRANSFERT INTER-DÉPÔTS {{reference}}</h2></div>',
          cssStyles: '.royal-doc { font-family: Poppins, sans-serif; border-top: 4px solid #C59B27; padding: 20px; }',
          showLogo: true,
          showTaxBreakdown: false,
          showQr: true,
          isActive: true,
          createdAt: new Date().toISOString(),
        },
        {
          id: 'tpl-ret',
          code: 'TPL-BON-RETOUR',
          name: 'Bon de Retour & Réintégration SAV (RET)',
          paperFormat: 'A5',
          prefixCode: 'RET',
          headerText: 'Service Après-Vente & Réintégration Royal',
          footerText: 'Document de retour SAV — Conserver pour avoir ou échange.',
          htmlBody: '<div class="royal-doc"><h2>BON DE RETOUR {{reference}}</h2></div>',
          cssStyles: '.royal-doc { font-family: Poppins, sans-serif; border-top: 4px solid #C59B27; padding: 20px; }',
          showLogo: true,
          showTaxBreakdown: true,
          showQr: true,
          isActive: true,
          createdAt: new Date().toISOString(),
        },
        {
          id: 'tpl-ecr',
          code: 'TPL-PIECE-COMPTA',
          name: 'Pièce Comptable & Grand Livre (ECR)',
          paperFormat: 'A4',
          prefixCode: 'ECR',
          headerText: 'Comptabilité Générale — Plan Comptable Tunisien',
          footerText: 'Pièce justificative d’écriture comptable certifiée.',
          htmlBody: '<div class="royal-doc"><h2>PIÈCE COMPTABLE {{reference}}</h2></div>',
          cssStyles: '.royal-doc { font-family: Poppins, sans-serif; border-top: 4px solid #C59B27; padding: 20px; }',
          showLogo: true,
          showTaxBreakdown: true,
          showQr: true,
          isActive: true,
          createdAt: new Date().toISOString(),
        },
      ];
    }
    if (key === 'visibility') {
      return [
        // Vue Générale
        { key: '/dashboard', label: 'Tableau de bord', section: 'Vue Générale', visibility: 'PUBLIC' },
        // Communauté
        { key: '/dashboard/community/notifications', label: 'Notifications (Staff)', section: 'Communauté', visibility: 'PUBLIC' },
        { key: '/account/notifications', label: 'Notifications (Client)', section: 'Communauté', visibility: 'PUBLIC' },
        { key: '/dashboard/community/messages', label: 'Support (Staff)', section: 'Communauté', visibility: 'PUBLIC' },
        { key: '/account/messages', label: 'Support (Client)', section: 'Communauté', visibility: 'PUBLIC' },
        { key: '/dashboard/community/contacts', label: 'Contact', section: 'Communauté', visibility: 'PUBLIC' },
        // Utilisateurs (nouvelles vues créées privées par défaut — pilotables par ROOT)
        { key: '/dashboard/section/users', label: "Vue d'ensemble — Utilisateurs", section: 'Gestion des utilisateurs', visibility: 'PRIVATE' },
        { key: '/dashboard/users', label: 'Tous les utilisateurs (Annuaire)', section: 'Gestion des utilisateurs', visibility: 'PRIVATE' },
        { key: '/dashboard/root/superadmins', label: 'Super Admin', section: 'Gestion des utilisateurs', visibility: 'PRIVATE' },
        { key: '/dashboard/users/admins', label: 'Administrateurs', section: 'Gestion des utilisateurs', visibility: 'PRIVATE' },
        { key: '/dashboard/users/website-managers', label: 'Website Manager', section: 'Gestion des utilisateurs', visibility: 'PUBLIC' },
        { key: '/dashboard/users/magasiniers', label: 'Magasiniers', section: 'Gestion des utilisateurs', visibility: 'PUBLIC' },
        { key: '/dashboard/users/caissiers', label: 'Caissiers', section: 'Gestion des utilisateurs', visibility: 'PUBLIC' },
        { key: '/dashboard/users/vendeurs', label: 'Vendeurs', section: 'Gestion des utilisateurs', visibility: 'PUBLIC' },
        { key: '/dashboard/users/financiers', label: 'Financiers', section: 'Gestion des utilisateurs', visibility: 'PUBLIC' },
        { key: '/dashboard/users/commercials', label: 'Commercials', section: 'Gestion des utilisateurs', visibility: 'PUBLIC' },
        { key: '/dashboard/users/marketing', label: 'Marketing', section: 'Gestion des utilisateurs', visibility: 'PRIVATE' },
        { key: '/dashboard/users/delivery-managers', label: 'Responsables Livraison', section: 'Gestion des utilisateurs', visibility: 'PRIVATE' },
        { key: '/dashboard/users/delivery-agents', label: 'Livreurs', section: 'Gestion des utilisateurs', visibility: 'PRIVATE' },
        { key: '/dashboard/users/clients', label: 'Clients (Comptes RBAC)', section: 'Gestion des utilisateurs', visibility: 'PRIVATE' },
        // Catalogue
        { key: '/dashboard/brands', label: 'Marques', section: 'Catalogue', visibility: 'PUBLIC' },
        { key: '/dashboard/categories', label: 'Catégories', section: 'Catalogue', visibility: 'PUBLIC' },
        { key: '/dashboard/characteristics', label: 'Caractéristiques', section: 'Catalogue', visibility: 'PUBLIC' },
        { key: '/dashboard/variants', label: 'Variantes', section: 'Catalogue', visibility: 'PUBLIC' },
        { key: '/dashboard/articles', label: 'Articles', section: 'Catalogue', visibility: 'PUBLIC' },
        { key: '/dashboard/coupons', label: 'Codes promotionnels', section: 'Catalogue', visibility: 'PUBLIC' },
        // Trésorerie
        { key: '/dashboard/treasury', label: 'Caisses', section: 'Trésorerie', visibility: 'PRIVATE' },
        { key: '/dashboard/treasury/transactions', label: 'Journal Trésorerie', section: 'Trésorerie', visibility: 'PRIVATE' },
        { key: '/dashboard/treasury/payments', label: 'Suivi des règlements', section: 'Trésorerie', visibility: 'PRIVATE' },
        { key: '/dashboard/accounting', label: 'Livres Comptables', section: 'Trésorerie', visibility: 'PRIVATE' },
        // Achats & Approvisionnement
        { key: '/dashboard/purchases/prospects', label: 'Portefeuille de prospects', section: 'Achats & Approvisionnement', visibility: 'PRIVATE' },
        { key: '/dashboard/suppliers', label: 'Fiches fournisseurs', section: 'Achats & Approvisionnement', visibility: 'PRIVATE' },
        { key: '/dashboard/purchases/orders', label: 'Commandes fournisseurs (BC)', section: 'Achats & Approvisionnement', visibility: 'PRIVATE' },
        { key: '/dashboard/purchases/receipts', label: 'Bon de réception (BR)', section: 'Achats & Approvisionnement', visibility: 'PRIVATE' },
        // Stock & Entrepôts
        { key: '/dashboard/warehouses', label: 'Dépôts', section: 'Stock & Entrepôts', visibility: 'PRIVATE' },
        { key: '/dashboard/stock-in', label: "Bon d'entrée (BE)", section: 'Stock & Entrepôts', visibility: 'PRIVATE' },
        { key: '/dashboard/stock-out', label: 'Bon de sortie (BS)', section: 'Stock & Entrepôts', visibility: 'PRIVATE' },
        { key: '/dashboard/inventory', label: 'Inventaire physique', section: 'Stock & Entrepôts', visibility: 'PRIVATE' },
        { key: '/dashboard/inventory-documents', label: 'Ajustement de stock', section: 'Stock & Entrepôts', visibility: 'PRIVATE' },
        { key: '/dashboard/transfers', label: 'Mouvements de stock', section: 'Stock & Entrepôts', visibility: 'PRIVATE' },
        // Ventes & Distribution
        { key: '/dashboard/customers', label: 'Fiches clients', section: 'Ventes & Distribution', visibility: 'PUBLIC' },
        { key: '/dashboard/orders', label: 'Commandes clients', section: 'Ventes & Distribution', visibility: 'PUBLIC' },
        { key: '/dashboard/deliveries', label: 'Bon de livraison (BL)', section: 'Ventes & Distribution', visibility: 'PRIVATE' },
        { key: '/dashboard/returns', label: 'Bon de retour (BR)', section: 'Ventes & Distribution', visibility: 'PRIVATE' },
        { key: '/dashboard/invoices', label: 'Factures', section: 'Ventes & Distribution', visibility: 'PRIVATE' },
        // Point de vente
        { key: '/dashboard/pos/showrooms', label: "Salles d'exposition", section: 'Point de vente', visibility: 'PRIVATE' },
        { key: '/dashboard/pos', label: 'Terminal POS', section: 'Point de vente', visibility: 'PRIVATE' },
        // SEO & Réputation
        { key: '/dashboard/community/testimonials', label: 'Commentaires et avis', section: 'SEO & Réputation', visibility: 'PRIVATE' },
        { key: '/dashboard/reports/interactions', label: 'Interactions', section: 'SEO & Réputation', visibility: 'PRIVATE' },
        { key: '/dashboard/community/newsletters', label: 'Abonnements', section: 'SEO & Réputation', visibility: 'PRIVATE' },
        { key: '/dashboard/seo/testimonials', label: 'Témoignages', section: 'SEO & Réputation', visibility: 'PRIVATE' },
        { key: '/dashboard/seo/pixels', label: 'Pixels & Référencement SEO', section: 'SEO & Réputation', visibility: 'PRIVATE' },
        // Rapports et statistiques
        { key: '/dashboard/analytics', label: "Conseils d'achat", section: 'Rapports & Statistiques', visibility: 'PRIVATE' },
        { key: '/dashboard/reports/sales', label: 'Ventes et marges', section: 'Rapports & Statistiques', visibility: 'PRIVATE' },
        { key: '/dashboard/reports/treasury', label: 'Suivi des caisses', section: 'Rapports & Statistiques', visibility: 'PRIVATE' },
        // Espace Client
        { key: '/account/home', label: 'Accueil Client', section: 'Espace Client', visibility: 'PUBLIC' },
        { key: '/account/orders', label: 'Suivi des commandes client', section: 'Espace Client', visibility: 'PUBLIC' },
        { key: '/account/favorites', label: 'Liste de souhaits', section: 'Espace Client', visibility: 'PUBLIC' },
        { key: '/account/profile', label: 'Mon profil', section: 'Espace Client', visibility: 'PUBLIC' },
        { key: '/account/loyalty', label: 'Mes points de fidélité', section: 'Espace Client', visibility: 'PRIVATE' },
        { key: '/account/coupons', label: 'Mes codes privilèges', section: 'Espace Client', visibility: 'PRIVATE' },
        // Système & CMS
        { key: '/dashboard/root/storefront/info', label: 'CMS : Identité et marque', section: 'Système & CMS', visibility: 'PRIVATE' },
        { key: '/dashboard/root/storefront/layouts', label: 'CMS : Mise en page et design', section: 'Système & CMS', visibility: 'PRIVATE' },
        { key: '/dashboard/root/storefront/views', label: 'CMS : Vues et modèles', section: 'Système & CMS', visibility: 'PRIVATE' },
        { key: '/dashboard/root/email-templates', label: 'Modèles de courriels', section: 'Système & CMS', visibility: 'PRIVATE' },
        { key: '/dashboard/root/smtp', label: 'Paramètres SMTP', section: 'Système & CMS', visibility: 'PRIVATE' },
        { key: '/dashboard/root/tva', label: 'Taxe et timbre fiscal', section: 'Système & CMS', visibility: 'PRIVATE' },
        { key: '/dashboard/root/reference-prefixes', label: 'Préfixes et numérotations', section: 'Système & CMS', visibility: 'PRIVATE' },
        { key: '/dashboard/root/print-templates', label: 'Documents & Imprimantes POS', section: 'Système & CMS', visibility: 'PRIVATE' },
        { key: '/dashboard/payment-methods', label: 'Modalités & Passerelles Paiement', section: 'Système & CMS', visibility: 'PRIVATE' },
        { key: '/dashboard/settings', label: 'Paramètres généraux', section: 'Système & CMS', visibility: 'PRIVATE' },
        { key: '/dashboard/translations', label: 'Traductions i18n', section: 'Système & CMS', visibility: 'PRIVATE' },
        { key: '/dashboard/root/roles-permissions', label: 'Rôles et permissions', section: 'Système & CMS', visibility: 'PRIVATE' },
        { key: '/dashboard/logs', label: "Journal d'audit", section: 'Système & CMS', visibility: 'PRIVATE' },
        { key: '/dashboard/root/failures', label: 'Audit système', section: 'Système & CMS', visibility: 'PRIVATE' },
        { key: '/dashboard/root/storage', label: 'Stockage Médias & CDN', section: 'Système & CMS', visibility: 'PRIVATE' },
        { key: '/dashboard/root/ai', label: 'Intelligence Artificielle (IA)', section: 'Système & CMS', visibility: 'PRIVATE' },
        { key: '/dashboard/root/visibility', label: 'Visibilité des vues', section: 'Système & CMS', visibility: 'PRIVATE' },
      ];
    }
    if (key === 'purchaseOrders' || key === 'purchaseReceipts') {
      return [];
    }
    return {};
  }

  private getExtendedSysConfigDefault(key: string) {
    if (
      [
        'treasuryTransactions',
        'treasuryPayments',
        'systemFailures',
        'stockOuts',
        'deliverySlips',
        'invoicesList',
        'stockIns',
        'inventoryDocuments',
        'customerReturns',
        'treasuryAccounts',
        'accountingEntries',
      ].includes(key)
    ) {
      return [];
    }
    if (key === 'paymentMethods') {
      return [
        { id: 'pay-001', code: 'CASH_COD', name: 'Espèces (Caisse Magasin & Livraison COD)', type: 'CASH', channels: ['WEB_STORE', 'POS_STORE', 'PHONE_B2B'], feePercent: 0, maxAmountTnd: 5000, settlementDelay: 'Immédiat', isActive: true, requiresValidation: false, createdAt: '2026-11-01T08:00:00Z', description: 'Paiement en espèces à la livraison ou au comptoir.' },
        { id: 'pay-002', code: 'CLICTOPAY_SMT', name: 'Carte Bancaire Tunisienne (ClicToPay SMT)', type: 'CARD_ONLINE', channels: ['WEB_STORE'], feePercent: 1.5, maxAmountTnd: 20000, settlementDelay: 'J+1 ouvré', isActive: true, requiresValidation: false, createdAt: '2026-11-01T08:00:00Z', description: 'Passerelle officielle monétique tunisienne 3DS.' },
        { id: 'pay-003', code: 'BANK_TRANSFER', name: 'Virement Bancaire (RIB Société)', type: 'BANK_TRANSFER', channels: ['WEB_STORE', 'PHONE_B2B'], feePercent: 0, maxAmountTnd: 100000, settlementDelay: 'Validation relevé', isActive: true, requiresValidation: true, createdAt: '2026-11-02T10:00:00Z', description: 'Virement bancaire avec justificatif.' },
        { id: 'pay-004', code: 'CHECK_PAYMENT', name: 'Chèque Bancaire Certifié', type: 'CHECK', channels: ['POS_STORE', 'PHONE_B2B'], feePercent: 0, maxAmountTnd: 30000, settlementDelay: 'Encaissement 3 à 5 jours', isActive: true, requiresValidation: true, createdAt: '2026-11-03T09:00:00Z', description: 'Paiement par chèque certifié.' },
      ];
    }
    if (key === 'generalSettings') {
      return {
        companyName: 'ROYAL LUXURY LIVING SARL',
        taxId: '1789456/A/M/000',
        rcNumber: 'B0198422023',
        phone: '48 091 914',
        email: 'royaltn24@gmail.com',
        address: 'Mahdia 5100, Tunisie',
        currency: 'TND (Dinar Tunisien)',
        vatStandard: 19,
        vatReduced: 7,
        fiscalStamp: 1.0,
        freeShippingThreshold: 300,
        defaultShippingFee: 12,
        lowStockDefaultAlert: 10,
        canonicalBaseUrl: '',
        forceHttps: false,
        maintenanceMode: false,
        maintenanceMessage:
          'Notre boutique est momentanément en maintenance technique. Merci de votre patience.',
        deliveryFleetEnabled: true,
      };
    }
    if (key === 'translations') {
      return {};
    }
    if (key === 'customersMeta') {
      return {};
    }
    if (key === 'mediaStorage') {
      return {
        provider: 'AUTO_VPS_OR_VERCEL',
        webpEnabled: true,
        webpQuality: 0.85,
        maxWidthPx: 1920,
        r2AccountId: '',
        r2AccessKeyId: '',
        r2SecretAccessKey: '',
        r2BucketName: 'royal-media',
        r2PublicBaseUrl: '',
        cloudinaryCloudName: '',
        cloudinaryUploadPreset: '',
        cloudinaryApiKey: '',
        cloudinaryApiSecret: '',
        localBasePath: '/api/v1/storefront-cms/media',
      };
    }
    if (key === 'paymentGateways') {
      return {
        flouci: {
          enabled: false,
          isPubliclyVisible: false,
          mode: 'SANDBOX',
          appToken: '',
          appSecret: '',
          label: 'Paiement Mobile & Carte via Flouci (TND)',
          description: 'Réglez instantanément par Wallet Flouci ou carte bancaire tunisienne.',
          successUrl: '/order-confirmation',
          failUrl: '/checkout?paymentError=flouci',
        },
        clictopay: {
          enabled: false,
          isPubliclyVisible: false,
          mode: 'SANDBOX',
          merchantId: '',
          login: '',
          password: '',
          label: 'Carte Bancaire Tunisienne (ClicToPay SMT)',
          description: 'Passerelle officielle monétique tunisienne 3DSecure.',
        },
        codEnabled: true,
        bankTransferEnabled: false,
        bankRib: '',
      };
    }
    if (key === 'printers') {
      return [
        {
          id: 'prt-pos-80',
          name: 'Imprimante Thermique Comptoir (80mm)',
          paperSize: '80mm',
          connectionType: 'BROWSER_PRINT',
          qzPrinterName: 'POS-80',
          networkIp: '',
          networkPort: 9100,
          openCashDrawer: true,
          autoPrintAfterSale: false,
          alwaysPreviewBeforePrint: true,
          showroomCode: 'SHOWROOM-MAHDIA',
          isDefaultPos: true,
          isActive: true,
          headerNote: 'Merci pour votre confiance — Royal Electro de Maison',
        },
        {
          id: 'prt-office-a4',
          name: 'Imprimante Laser Bureau (A4)',
          paperSize: 'A4',
          connectionType: 'BROWSER_PRINT',
          qzPrinterName: '',
          networkIp: '',
          networkPort: 9100,
          openCashDrawer: false,
          autoPrintAfterSale: false,
          alwaysPreviewBeforePrint: true,
          showroomCode: 'SIEGE',
          isDefaultPos: false,
          isActive: true,
          headerNote: 'Facture & Bon de Livraison Officiel Royal',
        },
      ];
    }
    if (key === 'aiProvider') {
      return {
        enabled: false,
        provider: 'GEMINI',
        geminiApiKey: '',
        geminiModel: 'gemini-2.5-flash',
        groqApiKey: '',
        groqModel: 'openai/gpt-oss-120b',
        enableCatalogCopy: true,
        enableAnalyticsInsights: true,
        enableOverviewRecaps: true,
        enableFormAutofill: true,
        recapTargets: {},
        formTargets: {},
        defaultTone: 'Luxe éditorial sobre, précis et orienté conversion (Tunisie, TND)',
      };
    }
    if (key === 'carrierWebhooks') {
      return [
        {
          id: 'cw-aramex',
          code: 'aramex',
          name: 'Aramex Tunisie',
          isActive: true,
          webhookSecret: 'royal-aramex-wh-2026',
          trackingBaseUrl: 'https://www.aramex.com/track/results?ShipmentNumber=',
          apiUrl: '',
          apiKey: '',
        },
        {
          id: 'cw-first',
          code: 'first-delivery',
          name: 'First Delivery Group',
          isActive: true,
          webhookSecret: 'royal-first-wh-2026',
          trackingBaseUrl: 'https://www.firstdeliverygroup.com/tracking?code=',
          apiUrl: '',
          apiKey: '',
        },
        {
          id: 'cw-intigo',
          code: 'intigo',
          name: 'Intigo Delivery',
          isActive: false,
          webhookSecret: 'royal-intigo-wh-2026',
          trackingBaseUrl: 'https://intigo.tn/track/',
          apiUrl: '',
          apiKey: '',
        },
      ];
    }
    if (key === 'carrierLogs') {
      return [];
    }
    if (key === 'roleViews') {
      return this.getDefaultRoleViewsConfig();
    }
    return undefined;
  }

  private getDefaultRoleViewsConfig(): Record<string, string[]> {
    const catalogue = [
      '/dashboard/brands',
      '/dashboard/categories',
      '/dashboard/characteristics',
      '/dashboard/variants',
      '/dashboard/articles',
      '/dashboard/coupons',
    ];
    const communityAll = [
      '/dashboard/community/notifications',
      '/dashboard/community/messages',
      '/dashboard/community/contacts',
    ];
    const clientSpace = [
      '/account/home',
      '/account/orders',
      '/account/favorites',
      '/account/profile',
      '/account/loyalty',
      '/account/coupons',
    ];
    const treasury = [
      '/dashboard/treasury',
      '/dashboard/treasury/transactions',
      '/dashboard/treasury/payments',
      '/dashboard/accounting',
    ];
    const purchases = [
      '/dashboard/purchases/prospects',
      '/dashboard/suppliers',
      '/dashboard/purchases/orders',
      '/dashboard/purchases/receipts',
    ];
    const stock = [
      '/dashboard/warehouses',
      '/dashboard/stock-in',
      '/dashboard/stock-out',
      '/dashboard/inventory',
      '/dashboard/inventory-documents',
      '/dashboard/transfers',
    ];
    const sales = [
      '/dashboard/customers',
      '/dashboard/orders',
      '/dashboard/deliveries',
      '/dashboard/returns',
      '/dashboard/invoices',
    ];
    const pos = ['/dashboard/pos/showrooms', '/dashboard/pos'];
    const seo = [
      '/dashboard/community/testimonials',
      '/dashboard/reports/interactions',
      '/dashboard/community/newsletters',
      '/dashboard/seo/testimonials',
      '/dashboard/seo/pixels',
    ];
    const reports = ['/dashboard/analytics', '/dashboard/reports/sales', '/dashboard/reports/treasury'];
    const staffUsersAll = [
      '/dashboard/users',
      '/dashboard/users/admins',
      '/dashboard/users/website-managers',
      '/dashboard/users/magasiniers',
      '/dashboard/users/caissiers',
      '/dashboard/users/vendeurs',
      '/dashboard/users/financiers',
      '/dashboard/users/commercials',
      '/dashboard/users/marketing',
      '/dashboard/users/delivery-managers',
      '/dashboard/users/delivery-agents',
      '/dashboard/users/clients',
    ];
    const systemShared = [
      '/dashboard/root/storefront/info',
      '/dashboard/root/storefront/layouts',
      '/dashboard/root/storefront/views',
      '/dashboard/root/email-templates',
      '/dashboard/root/smtp',
      '/dashboard/root/tva',
      '/dashboard/root/reference-prefixes',
      '/dashboard/root/print-templates',
      '/dashboard/payment-methods',
      '/dashboard/settings',
      '/dashboard/translations',
      '/dashboard/root/roles-permissions',
      '/dashboard/logs',
      '/dashboard/root/failures',
    ];

    return {
      SUPER_ADMIN: [
        '/dashboard',
        ...communityAll,
        '/dashboard/root/superadmins',
        ...staffUsersAll,
        ...catalogue,
        ...treasury,
        ...purchases,
        ...stock,
        ...sales,
        ...pos,
        ...seo,
        ...reports,
        ...clientSpace,
        ...systemShared,
      ],
      WEBSITE_MANAGER: [
        '/dashboard',
        ...communityAll,
        ...staffUsersAll.filter((u) => u !== '/dashboard/users/admins'),
        ...catalogue,
        ...treasury,
        ...purchases,
        ...stock,
        ...sales,
        ...seo,
        ...reports,
        ...clientSpace,
      ],
      ADMIN: [
        '/dashboard',
        ...communityAll,
        ...staffUsersAll.filter((u) => u !== '/dashboard/users/admins'),
        ...catalogue,
        ...treasury,
        ...purchases,
        ...stock,
        ...sales,
        ...seo,
        ...reports,
        ...clientSpace,
      ],
      MARKETING: [
        '/dashboard',
        '/dashboard/community/notifications',
        '/dashboard/community/contacts',
        ...catalogue,
        ...clientSpace,
        '/account/notifications',
      ],
      STOCK_MANAGER: ['/dashboard', '/dashboard/community/notifications', '/dashboard/community/messages', ...stock, '/dashboard/orders', '/dashboard/deliveries', '/dashboard/returns', ...clientSpace],
      CASHIER: ['/dashboard', '/dashboard/community/notifications', '/dashboard/community/messages', ...treasury, ...sales, ...pos, ...clientSpace],
      SALESPERSON: ['/dashboard', '/dashboard/community/notifications', '/dashboard/community/messages', ...sales, ...pos, ...clientSpace],
      ACCOUNTANT: ['/dashboard', '/dashboard/community/notifications', '/dashboard/community/messages', ...treasury, ...purchases, ...sales, ...reports, ...clientSpace],
      COMMERCIAL: ['/dashboard', '/dashboard/community/notifications', '/dashboard/community/messages', ...catalogue, '/dashboard/purchases/prospects', ...sales, ...clientSpace],
      DELIVERY_MANAGER: ['/dashboard', '/dashboard/community/notifications', '/dashboard/community/messages', '/dashboard/deliveries', '/dashboard/orders', '/dashboard/pos/showrooms', ...clientSpace],
      DELIVERY_AGENT: ['/dashboard', '/dashboard/community/notifications', '/dashboard/community/messages', '/dashboard/deliveries', '/dashboard/orders', ...clientSpace],
      CLIENT: ['/dashboard', '/account/notifications', '/account/messages', ...clientSpace],
    };
  }

  async getCustomersList(limit = 0, search?: string, page = 1) {
    const where: any = { deletedAt: null };
    if (search?.trim()) {
      const q = search.trim();
      where.OR = [
        { firstName: { contains: q, mode: 'insensitive' } },
        { lastName: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q, mode: 'insensitive' } },
      ];
    }
    const usePagination = Number(limit) > 0;
    const take = usePagination ? Math.max(1, Number(limit)) : undefined;
    const skip = usePagination ? (Math.max(1, Number(page || 1)) - 1) * take! : undefined;

    const [totalCustomers, customers, orderStats, metaRow] = await Promise.all([
      this.prisma.customer.count({ where }),
      this.prisma.customer.findMany({
        where,
        ...(take ? { skip, take } : {}),
        orderBy: { createdAt: 'desc' },
        include: {
          addresses: { orderBy: { isDefault: 'desc' }, take: 2 },
          orders: {
            where: { isDeleted: false },
            orderBy: { createdAt: 'desc' },
            take: 10,
            select: { reference: true, createdAt: true, totalAmount: true, status: true },
          },
        },
      }),
      this.prisma.order.groupBy({
        by: ['customerId'],
        where: { isDeleted: false, status: { not: 'CANCELLED' }, customerId: { not: null } },
        _count: { _all: true },
        _sum: { totalAmount: true },
      }),
      this.prisma.settings.findUnique({ where: { key: 'sys.customersMeta' } }),
    ]);

    const orderStatMap = new Map(
      orderStats.map((s) => [
        s.customerId,
        { count: s._count._all, sum: Number(s._sum.totalAmount || 0) },
      ]),
    );
    const metaMap = this.parseJsonSetting<Record<string, any>>(metaRow?.value, {});
    const items = customers.map((c) => {
      const extra = metaMap[c.id] || {};
      const defaultAddr = c.addresses?.[0];
      const liveStat = orderStatMap.get(c.id);
      const computedOrders = Math.max(c.totalOrders || 0, liveStat?.count || 0, c.orders.length);
      const computedSpent = Math.max(
        Number(c.totalSpent || 0),
        liveStat?.sum || 0,
        c.orders.reduce((s, o) => s + Number(o.totalAmount || 0), 0),
      );

      return {
        id: c.id,
        firstName: c.firstName,
        lastName: c.lastName,
        fullName: `${c.firstName} ${c.lastName}`.trim(),
        customerType: extra.customerType === 'COMPANY' ? 'COMPANY' : 'INDIVIDUAL',
        companyName: extra.companyName || undefined,
        taxId: extra.taxId || undefined,
        cin: extra.cin || undefined,
        email: c.email,
        phone: c.phone || '',
        city: extra.city || defaultAddr?.city || 'Tunisie',
        address: extra.address || defaultAddr?.street || 'Adresse non renseignée',
        totalOrders: computedOrders,
        totalSpentTnd: computedSpent,
        outstandingBalanceTnd: Number(extra.outstandingBalanceTnd || 0),
        isVip: Boolean(extra.isVip) || computedSpent >= 1000,
        createdAt: c.createdAt.toISOString(),
        recentOrders: c.orders.map((o) => ({
          reference: `#${o.reference}`,
          date: o.createdAt.toISOString().slice(0, 10),
          totalAmount: Number(o.totalAmount || 0),
          status: o.status,
        })),
      };
    });

    return {
      items,
      data: items,
      total: totalCustomers,
      meta: {
        page: Math.max(1, Number(page || 1)),
        limit: take || totalCustomers,
        total: totalCustomers,
        totalPages: take ? Math.ceil(totalCustomers / take) : 1,
      },
    };
  }

  async createCustomerRecord(body: any) {
    const email = String(body.email || '').trim().toLowerCase();
    const firstName = String(body.firstName || body.fullName?.split(' ')[0] || 'Client').trim();
    const lastName = String(body.lastName || body.fullName?.split(' ').slice(1).join(' ') || 'Royal').trim();
    if (!email) {
      throw new BadRequestException('Adresse email requise.');
    }
    const existing = await this.prisma.customer.findUnique({ where: { email } });
    if (existing) {
      throw new BadRequestException('Un client avec cet email existe déjà.');
    }
    const created = await this.prisma.customer.create({
      data: {
        email,
        firstName,
        lastName,
        phone: body.phone ? String(body.phone) : null,
        notes: body.notes ? String(body.notes) : null,
      },
    });
    if (body.address || body.city) {
      await this.prisma.address.create({
        data: {
          customerId: created.id,
          label: 'Principale',
          firstName,
          lastName,
          phone: body.phone ? String(body.phone) : '00000000',
          city: body.city ? String(body.city) : 'Tunis',
          state: body.city ? String(body.city) : 'Tunis',
          street: body.address ? String(body.address) : 'Adresse client',
          isDefault: true,
        },
      });
    }
    const metaRow = await this.prisma.settings.findUnique({ where: { key: 'sys.customersMeta' } });
    const metaMap = this.parseJsonSetting<Record<string, any>>(metaRow?.value, {});
    metaMap[created.id] = {
      customerType: body.customerType || 'INDIVIDUAL',
      companyName: body.companyName || undefined,
      taxId: body.taxId || undefined,
      cin: body.cin || undefined,
      city: body.city || undefined,
      address: body.address || undefined,
      isVip: Boolean(body.isVip),
    };
    await this.upsertSetting('sys.customersMeta', JSON.stringify(metaMap), 'system', 'ADMIN');
    return created;
  }

  async updateCustomerRecord(id: string, body: any) {
    const updated = await this.prisma.customer.update({
      where: { id },
      data: {
        ...(body.firstName !== undefined ? { firstName: String(body.firstName) } : {}),
        ...(body.lastName !== undefined ? { lastName: String(body.lastName) } : {}),
        ...(body.phone !== undefined ? { phone: String(body.phone) } : {}),
      },
    });
    const metaRow = await this.prisma.settings.findUnique({ where: { key: 'sys.customersMeta' } });
    const metaMap = this.parseJsonSetting<Record<string, any>>(metaRow?.value, {});
    metaMap[id] = {
      ...(metaMap[id] || {}),
      ...(body.customerType !== undefined ? { customerType: body.customerType } : {}),
      ...(body.companyName !== undefined ? { companyName: body.companyName } : {}),
      ...(body.taxId !== undefined ? { taxId: body.taxId } : {}),
      ...(body.cin !== undefined ? { cin: body.cin } : {}),
      ...(body.city !== undefined ? { city: body.city } : {}),
      ...(body.address !== undefined ? { address: body.address } : {}),
      ...(body.isVip !== undefined ? { isVip: Boolean(body.isVip) } : {}),
    };
    await this.upsertSetting('sys.customersMeta', JSON.stringify(metaMap), 'system', 'ADMIN');
    return updated;
  }

  async deleteCustomerRecord(id: string) {
    return this.prisma.customer.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async getSysConfig(key: string) {
    const allowed = [
      'smtp',
      'tva',
      'prefixes',
      'printTemplates',
      'visibility',
      'roleViews',
      'purchaseOrders',
      'purchaseReceipts',
      'treasuryTransactions',
      'treasuryPayments',
      'systemFailures',
      'stockOuts',
      'deliverySlips',
      'invoicesList',
      'stockIns',
      'inventoryDocuments',
      'customerReturns',
      'treasuryAccounts',
      'accountingEntries',
      'paymentMethods',
      'generalSettings',
      'translations',
      'customersMeta',
      'marketingPixels',
      'mediaStorage',
      'paymentGateways',
      'printers',
      'aiProvider',
      'carrierWebhooks',
      'carrierLogs',
    ];
    if (!allowed.includes(key)) {
      throw new BadRequestException('Clé de configuration invalide.');
    }
    const cacheableKeys = new Set(['visibility', 'roleViews', 'translations', 'marketingPixels']);
    if (cacheableKeys.has(key)) {
      const cached = this.sysConfigCache.get(key);
      if (cached && Date.now() < cached.expiresAt) {
        return cached.value;
      }
    }
    const row = await this.prisma.settings.findUnique({ where: { key: `sys.${key}` } });
    const fallback = this.getExtendedSysConfigDefault(key) ?? this.getDefaultSysConfig(key);
    const parsed = this.parseJsonSetting(row?.value, fallback);
    let result: any;
    if ((key === 'prefixes' || key === 'printTemplates') && Array.isArray(fallback) && Array.isArray(parsed)) {
      const existingCodes = new Set(parsed.map((item: any) => item?.code).filter(Boolean));
      const merged = [...parsed, ...fallback.filter((def: any) => !existingCodes.has(def.code))];
      result = {
        key,
        value: merged,
        updatedAt: row?.updatedAt || null,
      };
    } else if (key === 'visibility' && Array.isArray(fallback) && Array.isArray(parsed)) {
      const savedMap = new Map<string, any>();
      parsed.forEach((item: any) => {
        if (item?.key) savedMap.set(item.key, item);
      });
      result = {
        key,
        value: fallback.map((def: any) => {
          const saved = savedMap.get(def.key);
          return saved
            ? {
                ...def,
                visibility:
                  def.key === '/dashboard/root/visibility'
                    ? 'PRIVATE'
                    : saved.visibility === 'PRIVATE'
                    ? 'PRIVATE'
                    : 'PUBLIC',
              }
            : def;
        }),
        updatedAt: row?.updatedAt || null,
      };
    } else if (key === 'roleViews' && fallback && typeof fallback === 'object') {
      const merged: Record<string, string[]> = { ...(fallback as Record<string, string[]>) };
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        Object.entries(parsed).forEach(([roleKey, routes]) => {
          if (Array.isArray(routes)) {
            merged[roleKey.toUpperCase()] = Array.from(
              new Set(routes.filter((r): r is string => typeof r === 'string' && r.trim().length > 0)),
            );
          }
        });
      }
      result = {
        key,
        value: merged,
        updatedAt: row?.updatedAt || null,
      };
    } else {
      result = {
        key,
        value: parsed,
        updatedAt: row?.updatedAt || null,
      };
    }
    if (cacheableKeys.has(key)) {
      this.sysConfigCache.set(key, { value: result, expiresAt: Date.now() + 15000 });
    }
    return result;
  }

  async updateSysConfig(key: string, value: any, updatedBy?: string) {
    const allowed = [
      'smtp',
      'tva',
      'prefixes',
      'printTemplates',
      'visibility',
      'roleViews',
      'purchaseOrders',
      'purchaseReceipts',
      'treasuryTransactions',
      'treasuryPayments',
      'systemFailures',
      'stockOuts',
      'deliverySlips',
      'invoicesList',
      'stockIns',
      'inventoryDocuments',
      'customerReturns',
      'treasuryAccounts',
      'accountingEntries',
      'paymentMethods',
      'generalSettings',
      'translations',
      'customersMeta',
      'marketingPixels',
      'mediaStorage',
      'paymentGateways',
      'printers',
      'aiProvider',
      'carrierWebhooks',
      'carrierLogs',
    ];
    if (!allowed.includes(key)) {
      throw new BadRequestException('Clé de configuration invalide.');
    }
    const normalizedValue =
      key === 'visibility' && Array.isArray(value)
        ? value.map((item: any) => ({
            ...item,
            visibility:
              item?.key === '/dashboard/root/visibility'
                ? 'PRIVATE'
                : item?.visibility === 'PRIVATE'
                ? 'PRIVATE'
                : 'PUBLIC',
          }))
        : key === 'roleViews' && value && typeof value === 'object' && !Array.isArray(value)
        ? Object.entries(value).reduce<Record<string, string[]>>((acc, [roleKey, routes]) => {
            if (Array.isArray(routes)) {
              acc[roleKey.toUpperCase()] = Array.from(
                new Set(routes.filter((r): r is string => typeof r === 'string' && r.trim().length > 0)),
              );
            }
            return acc;
          }, {})
        : value;
    await this.upsertSetting(`sys.${key}`, JSON.stringify(normalizedValue), 'system', updatedBy);
    if (
      key === 'generalSettings' &&
      normalizedValue &&
      typeof normalizedValue === 'object' &&
      typeof normalizedValue.canonicalBaseUrl === 'string'
    ) {
      const currentPixels = ((await this.getSysConfig('marketingPixels')).value || {}) as Record<string, any>;
      if (currentPixels.canonicalBaseUrl !== normalizedValue.canonicalBaseUrl) {
        await this.upsertSetting(
          'sys.marketingPixels',
          JSON.stringify({ ...currentPixels, canonicalBaseUrl: normalizedValue.canonicalBaseUrl }),
          'system',
          updatedBy,
        );
      }
    }
    return this.getSysConfig(key);
  }

  async testSmtpConnection(dto: SmtpTestDto) {
    const cfg = (await this.getSysConfig('smtp')).value as any;
    const host = dto.host || cfg.host;
    const port = Number(dto.port || cfg.port || 587);
    if (!host) {
      throw new BadRequestException('Serveur SMTP requis.');
    }

    return new Promise((resolve) => {
      const socket = net.createConnection({ host, port, timeout: 3000 });
      let done = false;
      const finish = (ok: boolean, message: string) => {
        if (done) return;
        done = true;
        socket.destroy();
        resolve({ ok, host, port, message, testedAt: new Date().toISOString() });
      };
      socket.on('connect', () => {
        finish(true, `Connexion TCP réussie vers ${host}:${port} (prêt pour envoi).`);
      });
      socket.on('timeout', () => {
        finish(false, `Délai expiré (3s) lors du test vers ${host}:${port}.`);
      });
      socket.on('error', (err: any) => {
        finish(false, `Impossible de joindre ${host}:${port} (${err?.message || 'erreur réseau'}).`);
      });
    });
  }

  async getPublicPrintConfig() {
    const [prefixes, templates] = await Promise.all([
      this.getSysConfig('prefixes'),
      this.getSysConfig('printTemplates'),
    ]);
    return {
      prefixes: prefixes.value,
      printTemplates: templates.value,
    };
  }

  async applyStockLifecycle(
    dto: {
      docType: 'BS' | 'BL' | 'FACT' | 'BE' | 'BR' | 'RET' | 'INV' | 'TRF';
      docReference: string;
      warehouseId?: string;
      restore?: boolean;
      items: Array<{ variantId?: string; sku?: string; quantity: number }>;
    },
    actor: string
  ) {
    const defaultWh =
      (dto.warehouseId
        ? await this.prisma.warehouse.findUnique({ where: { id: dto.warehouseId } })
        : null) ||
      (await this.prisma.warehouse.findFirst({ where: { isDefault: true, isDeleted: false } })) ||
      (await this.prisma.warehouse.findFirst({ where: { isDeleted: false } }));

    if (!defaultWh) {
      throw new BadRequestException('Aucun entrepôt configuré dans la base.');
    }

    const updated: Array<{ variantId: string; sku: string; warehouseId: string; before: number; after: number }> = [];

    await this.prisma.$transaction(async (tx) => {
      for (const item of dto.items || []) {
        const qty = Math.max(0, Math.round(Number(item.quantity || 0)));
        if (qty <= 0) continue;

        let variant: any = null;
        if (item.variantId) {
          variant = await tx.productVariant.findUnique({
            where: { id: item.variantId },
            include: { product: { select: { id: true, dimensionsJson: true } } },
          });
        }
        if (!variant && item.sku) {
          variant = await tx.productVariant.findFirst({
            where: {
              OR: [{ sku: item.sku }, { product: { sku: item.sku } }],
              isDeleted: false,
            },
            include: { product: { select: { id: true, dimensionsJson: true } } },
          });
        }
        if (!variant) continue;

        let stock = await tx.stock.findUnique({
          where: { variantId_warehouseId: { variantId: variant.id, warehouseId: defaultWh.id } },
        });
        if (!stock) {
          stock = await tx.stock.create({
            data: {
              variantId: variant.id,
              warehouseId: defaultWh.id,
              physicalQty: 120,
              reservedQty: 0,
              reorderPoint: 10,
            },
          });
        }

        const before = stock.physicalQty;
        const isInflowDoc = dto.docType === 'BE' || dto.docType === 'BR' || dto.docType === 'RET';
        const isPositive = isInflowDoc ? !dto.restore : Boolean(dto.restore);
        const delta = isPositive ? qty : -qty;
        const after = Math.max(0, before + delta);

        await tx.stock.update({
          where: { id: stock.id },
          data: { physicalQty: after },
        });

        await tx.stockMovement.create({
          data: {
            stockId: stock.id,
            type: isPositive ? (dto.docType === 'BE' || dto.docType === 'BR' ? 'PURCHASE_IN' : 'RETURN_IN') : 'SALE_OUT',
            quantityDelta: after - before,
            quantityBefore: before,
            quantityAfter: after,
            reason: `${dto.docType} ${dto.docReference} (${isPositive ? 'Entrée / Réintégration' : 'Sortie / Décrémentation'})`,
            referenceType: dto.docType,
            referenceId: dto.docReference,
            performedBy: actor || 'SYSTEM',
          },
        });

        // Sync Product.dimensionsJson.stockQuantity
        if (variant.product) {
          const sumAgg = await tx.stock.aggregate({
            where: { variant: { productId: variant.product.id } },
            _sum: { physicalQty: true },
          });
          const dims =
            variant.product.dimensionsJson && typeof variant.product.dimensionsJson === 'object'
              ? { ...(variant.product.dimensionsJson as any) }
              : {};
          dims.stockQuantity = Number(sumAgg._sum.physicalQty || after);
          await tx.product.update({
            where: { id: variant.product.id },
            data: { dimensionsJson: dims },
          });
        }

        updated.push({
          variantId: variant.id,
          sku: variant.sku,
          warehouseId: defaultWh.id,
          before,
          after,
        });
      }
    });

    return {
      docType: dto.docType,
      docReference: dto.docReference,
      updatedCount: updated.length,
      updated,
    };
  }

  async testMediaStorage(overrideCfg?: Record<string, any>) {
    const start = Date.now();
    const saved = ((await this.getSysConfig('mediaStorage')).value || {}) as any;
    const cfg = overrideCfg ? { ...saved, ...overrideCfg } : saved;
    const tinyPngBase64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7Z0uQAAAAASUVORK5CYII=';
    const buffer = Buffer.from(tinyPngBase64, 'base64');
    const filename = `royal-probe-${Date.now()}.png`;
    const stored = await storeMediaAsset(buffer, filename, 'image/png', cfg, this.getUploadDir());
    return {
      ok: true,
      providerUsed: stored.providerUsed,
      url: stored.url,
      durationMs: Date.now() - start,
      message: `Test réussi via ${stored.providerUsed} (${Date.now() - start} ms).`,
    };
  }

  async getPublicPaymentGateways() {
    const cfg: any = (await this.getSysConfig('paymentGateways')).value || {};
    return {
      codEnabled: cfg.codEnabled !== false,
      bankTransferEnabled: Boolean(cfg.bankTransferEnabled),
      bankRib: cfg.bankTransferEnabled ? cfg.bankRib || '' : '',
      flouci: {
        enabled: Boolean(cfg.flouci?.enabled),
        isPubliclyVisible: Boolean(cfg.flouci?.enabled && cfg.flouci?.isPubliclyVisible),
        mode: cfg.flouci?.mode || 'SANDBOX',
        label: cfg.flouci?.label || 'Paiement Mobile & Carte via Flouci (TND)',
        description:
          cfg.flouci?.description || 'Payez instantanément par Wallet Flouci ou carte bancaire tunisienne.',
      },
      clictopay: {
        enabled: Boolean(cfg.clictopay?.enabled),
        isPubliclyVisible: Boolean(cfg.clictopay?.enabled && cfg.clictopay?.isPubliclyVisible),
        mode: cfg.clictopay?.mode || 'SANDBOX',
        label: cfg.clictopay?.label || 'Carte Bancaire Tunisienne (ClicToPay SMT)',
        description: cfg.clictopay?.description || 'Paiement sécurisé 3D-Secure Visa / Mastercard / e-Dinar.',
      },
    };
  }

  async initFlouciPayment(dto: {
    orderReference: string;
    amountTnd: number;
    successUrl?: string;
    failUrl?: string;
  }) {
    const cfg: any = (await this.getSysConfig('paymentGateways')).value || {};
    const flouci = cfg.flouci || {};
    if (!flouci.enabled) {
      throw new BadRequestException('La passerelle Flouci est actuellement désactivée.');
    }
    const appToken = String(flouci.appToken || '').trim();
    const appSecret = String(flouci.appSecret || '').trim();
    if (!appToken || !appSecret) {
      throw new BadRequestException('Identifiants Flouci (app_token / app_secret) manquants.');
    }

    const frontendOrigin = (process.env.FRONTEND_URL || 'https://royal.com.tn').replace(/\/+$/, '');
    const successLink = dto.successUrl || `${frontendOrigin}/order-confirmation/${encodeURIComponent(dto.orderReference)}?paid=flouci`;
    const failLink = dto.failUrl || `${frontendOrigin}/checkout?paymentError=flouci&ref=${encodeURIComponent(dto.orderReference)}`;

    const res = await fetch('https://developers.flouci.com/api/generate_payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        app_token: appToken,
        app_secret: appSecret,
        amount: Math.max(100, Math.round(Number(dto.amountTnd || 0) * 1000)),
        accept_card: 'true',
        session_timeout_secs: 1200,
        success_link: successLink,
        fail_link: failLink,
        developer_tracking_id: dto.orderReference,
      }),
    });

    const json: any = await res.json().catch(() => ({}));
    const link = json?.result?.link || json?.link;
    if (!res.ok || !link) {
      throw new BadRequestException(
        json?.message || json?.result?.message || `Impossible d'initialiser le paiement Flouci (HTTP ${res.status}).`,
      );
    }

    return {
      paymentUrl: link,
      paymentId: json?.result?.payment_id || null,
      orderReference: dto.orderReference,
    };
  }

  private normalizeCarrierStatus(raw: string): 'PREPARING' | 'IN_TRANSIT' | 'DELIVERED' | 'FAILED_RETURN' {
    const upper = String(raw || '').trim().toUpperCase();
    if (['DELIVERED', 'LIVRE', 'LIVREE', 'COMPLETED', 'SUCCESS'].includes(upper)) return 'DELIVERED';
    if (['FAILED', 'RETURNED', 'FAILED_RETURN', 'ECHEC', 'RETOUR', 'CANCELLED'].includes(upper)) return 'FAILED_RETURN';
    if (['IN_TRANSIT', 'SHIPPED', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'EN_TRANSIT', 'EN_COURS'].includes(upper)) {
      return 'IN_TRANSIT';
    }
    return 'PREPARING';
  }

  async processCarrierWebhook(
    carrierCode: string,
    payload: {
      trackingNumber?: string;
      orderReference?: string;
      status: string;
      secret?: string;
      note?: string;
      codCollected?: boolean;
    },
    headerSecret?: string,
    bypassSecretCheck = false,
  ) {
    const code = String(carrierCode || '').trim().toLowerCase();
    const whRes = (await this.getSysConfig('carrierWebhooks')).value as any;
    const webhooks: any[] = Array.isArray(whRes) ? whRes : [];
    const carrierCfg = webhooks.find((w) => String(w.code || '').toLowerCase() === code);

    if (!carrierCfg && !bypassSecretCheck) {
      throw new NotFoundException(`Transporteur inconnu : ${carrierCode}`);
    }
    if (!bypassSecretCheck && carrierCfg?.webhookSecret) {
      const provided = String(headerSecret || payload.secret || '').trim();
      if (provided !== String(carrierCfg.webhookSecret).trim()) {
        throw new ForbiddenException('Signature secret webhook invalide.');
      }
    }

    const mappedDeliveryStatus = this.normalizeCarrierStatus(payload.status);
    const slipsRes = (await this.getSysConfig('deliverySlips')).value as any;
    const slips: any[] = Array.isArray(slipsRes) ? slipsRes : [];

    const needleTracking = String(payload.trackingNumber || '').trim().toLowerCase();
    const needleOrder = String(payload.orderReference || '').trim().replace(/^#/, '').toLowerCase();

    let matchedSlip: any = null;
    const updatedSlips = slips.map((slip) => {
      const slipTrack = String(slip.trackingNumber || '').trim().toLowerCase();
      const slipOrder = String(slip.orderReference || '').trim().replace(/^#/, '').toLowerCase();
      const isMatch =
        (needleTracking && slipTrack === needleTracking) ||
        (needleOrder && slipOrder === needleOrder);
      if (!isMatch || matchedSlip) return slip;
      matchedSlip = {
        ...slip,
        status: mappedDeliveryStatus,
        isCodCollected:
          payload.codCollected !== undefined
            ? Boolean(payload.codCollected)
            : mappedDeliveryStatus === 'DELIVERED'
            ? true
            : slip.isCodCollected,
        deliveredAt: mappedDeliveryStatus === 'DELIVERED' ? new Date().toISOString() : slip.deliveredAt,
        carrierLastNote: payload.note || `Webhook ${carrierCfg?.name || code}: ${payload.status}`,
      };
      return matchedSlip;
    });

    if (matchedSlip) {
      await this.updateSysConfig('deliverySlips', updatedSlips, `WEBHOOK:${code}`);
    }

    // Sync linked Prisma Order if found
    let orderUpdated: string | null = null;
    const orderRefLookup = (matchedSlip?.orderReference || payload.orderReference || '').replace(/^#/, '').trim();
    if (orderRefLookup) {
      const order = await this.prisma.order.findFirst({
        where: { reference: { equals: orderRefLookup, mode: 'insensitive' } },
      });
      if (order && order.status !== 'CANCELLED') {
        const orderTargetStatus =
          mappedDeliveryStatus === 'DELIVERED'
            ? 'DELIVERED'
            : mappedDeliveryStatus === 'IN_TRANSIT'
            ? 'OUT_FOR_DELIVERY'
            : mappedDeliveryStatus === 'FAILED_RETURN'
            ? 'FAILED'
            : null;
        if (orderTargetStatus && order.status !== orderTargetStatus) {
          await this.prisma.$transaction(async (tx) => {
            await tx.order.update({
              where: { id: order.id },
              data: {
                status: orderTargetStatus as any,
                ...(orderTargetStatus === 'DELIVERED' && !order.deliveredAt ? { deliveredAt: new Date() } : {}),
              },
            });
            await tx.orderStatusHistory.create({
              data: {
                orderId: order.id,
                fromStatus: order.status,
                toStatus: orderTargetStatus as any,
                changedBy: `Webhook ${carrierCfg?.name || code}`,
                comment: payload.note || `Mise à jour automatique transporteur (${payload.status})`,
              },
            });
          });
          orderUpdated = order.reference;
        }
      }
    }

    const prevLogsRes = (await this.getSysConfig('carrierLogs')).value as any;
    const prevLogs: any[] = Array.isArray(prevLogsRes) ? prevLogsRes : [];
    const newLog = {
      id: `clog-${Date.now()}`,
      carrierCode: code,
      carrierName: carrierCfg?.name || carrierCode,
      trackingNumber: matchedSlip?.trackingNumber || payload.trackingNumber || '—',
      orderReference: orderUpdated || matchedSlip?.orderReference || payload.orderReference || '—',
      rawStatus: payload.status,
      mappedStatus: mappedDeliveryStatus,
      note: payload.note || (bypassSecretCheck ? 'Simulation Tableau de Bord' : 'Webhook Externe'),
      matchedSlip: Boolean(matchedSlip),
      orderSynced: Boolean(orderUpdated),
      receivedAt: new Date().toISOString(),
    };
    await this.updateSysConfig('carrierLogs', [newLog, ...prevLogs].slice(0, 50), `WEBHOOK:${code}`);

    return {
      ok: true,
      log: newLog,
      updatedSlip: matchedSlip,
      orderUpdated,
    };
  }

  async sendOrderDeliveryDocuments(
    orderId: string,
    dto: {
      sendInvoice?: boolean;
      sendDeliverySlip?: boolean;
      customEmail?: string;
      customNote?: string;
    },
    actorEmail: string,
  ) {
    const order = await this.prisma.order.findFirst({
      where: { OR: [{ id: orderId }, { reference: orderId }] },
      include: {
        items: true,
        customer: true,
        payments: { take: 1, orderBy: { createdAt: 'desc' } },
      },
    });
    if (!order) {
      throw new NotFoundException('Commande introuvable.');
    }

    const sendInvoice = dto.sendInvoice !== false;
    const sendDeliverySlip = dto.sendDeliverySlip !== false;
    if (!sendInvoice && !sendDeliverySlip) {
      throw new BadRequestException('Sélectionnez au moins un document (Facture ou Bon de Livraison).');
    }

    const recipientEmail = String(
      dto.customEmail || order.customer?.email || order.guestEmail || '',
    ).trim();
    if (!recipientEmail) {
      throw new BadRequestException('Aucune adresse email client renseignée pour cette commande.');
    }

    const [smtpRes, genRes, prefixesRes] = await Promise.all([
      this.getSysConfig('smtp'),
      this.getSysConfig('generalSettings'),
      this.getSysConfig('prefixes'),
    ]);
    const smtpCfg: any = smtpRes?.value || {};
    const genCfg: any = genRes?.value || {};
    const prefixesList: any[] = Array.isArray(prefixesRes?.value) ? prefixesRes.value : [];

    const facPrefix = prefixesList.find((p) => p.code === 'FACT')?.prefix || 'FAC-';
    const blPrefix = prefixesList.find((p) => p.code === 'BL')?.prefix || 'BL-';
    const cleanRefSuffix = String(order.reference || order.id).replace(/^#?CMD-?/i, '');
    const invoiceRef = `${facPrefix}${cleanRefSuffix}`;
    const deliveryRef = `${blPrefix}${cleanRefSuffix}`;

    const shippingAddr: any =
      order.shippingAddressJson && typeof order.shippingAddressJson === 'object'
        ? order.shippingAddressJson
        : {};
    const customerName = order.customer
      ? `${order.customer.firstName} ${order.customer.lastName}`.trim()
      : order.guestName || 'Client Royal';

    const pdfItems = (order.items || []).map((it: any) => ({
      label: it.productName || 'Article',
      sku: it.sku || '',
      quantity: Number(it.quantity || 1),
      unitPrice: Number(it.unitPrice || 0),
      totalPrice: Number(it.totalPrice || 0),
    }));

    const commonOpts = {
      orderReference: order.reference,
      issueDate: new Date().toLocaleDateString('fr-TN'),
      companyName: genCfg.companyName || ROYAL_CONTACT_INFO.companyName,
      companyAddress: genCfg.address || ROYAL_CONTACT_INFO.address,
      companyTaxId: genCfg.taxId || '',
      customerName,
      customerPhone: order.customer?.phone || order.guestPhone || shippingAddr.phone || '',
      customerEmail: recipientEmail,
      shippingAddress: [shippingAddr.street, shippingAddr.street2].filter(Boolean).join(', '),
      city: [shippingAddr.city, shippingAddr.state].filter(Boolean).join(' - '),
      paymentMethod: String(order.payments?.[0]?.method || ''),
      items: pdfItems,
      subtotalTnd: Number(order.subtotalAmount || 0),
      shippingTnd: Number(order.shippingAmount || 0),
      discountTnd: Number(order.discountAmount || 0),
      taxTnd: Number(order.taxAmount || 0),
      fiscalStampTnd: Number(genCfg.fiscalStamp ?? 1),
      totalTnd: Number(order.totalAmount || 0),
    };

    const attachments: Array<{ filename: string; contentType: string; content: Buffer }> = [];
    const docLabels: string[] = [];

    if (sendInvoice) {
      attachments.push({
        filename: `${invoiceRef}.pdf`,
        contentType: 'application/pdf',
        content: buildDocumentPdfBuffer({
          ...commonOpts,
          docTitle: 'FACTURE CLIENT',
          reference: invoiceRef,
          isDeliverySlip: false,
        }),
      });
      docLabels.push(`Facture (${invoiceRef})`);
    }
    if (sendDeliverySlip) {
      attachments.push({
        filename: `${deliveryRef}.pdf`,
        contentType: 'application/pdf',
        content: buildDocumentPdfBuffer({
          ...commonOpts,
          docTitle: 'BON DE LIVRAISON (BL)',
          reference: deliveryRef,
          isDeliverySlip: true,
        }),
      });
      docLabels.push(`Bon de Livraison (${deliveryRef})`);
    }

    const htmlBody = `
      <div style="font-family:Poppins,Arial,sans-serif;max-width:620px;margin:auto;border:1px solid #E6E1D6;border-radius:16px;padding:28px;background:#FFFFFF;color:#1D232E;">
        <div style="border-bottom:3px solid #C59B27;padding-bottom:14px;margin-bottom:20px;">
          <h2 style="margin:0;color:#1D232E;font-size:20px;">${commonOpts.companyName}</h2>
          <p style="margin:4px 0 0;color:#9A7414;font-size:12px;font-weight:700;">Confirmation de livraison — Commande #${order.reference}</p>
        </div>
        <p style="font-size:14px;line-height:1.6;">Bonjour <strong>${customerName}</strong>,</p>
        <p style="font-size:14px;line-height:1.6;">Votre commande <strong>#${order.reference}</strong> d'un montant total de <strong>${commonOpts.totalTnd.toFixed(3)} TND</strong> a bien été marquée comme <strong>livrée</strong>.</p>
        <p style="font-size:13px;line-height:1.6;">Vous trouverez en pièces jointes les documents PDF correspondants : <strong>${docLabels.join(' et ')}</strong>.</p>
        ${dto.customNote ? `<div style="background:#FBF9F4;border-left:3px solid #C59B27;padding:12px;margin:16px 0;font-size:13px;">${dto.customNote}</div>` : ''}
        <p style="font-size:12px;color:#64748B;margin-top:24px;">Merci pour votre confiance — Service Client Royal (${ROYAL_CONTACT_INFO.phone}).</p>
      </div>
    `;

    const mailRes = await sendSmtpMailWithAttachments(smtpCfg, {
      to: recipientEmail,
      subject: `Royal — Documents commande #${order.reference} (${docLabels.join(' + ')})`,
      htmlBody,
      attachments,
    });

    await this.prisma.auditLog.create({
      data: {
        actorEmail,
        action: 'SEND_DELIVERY_DOCUMENTS',
        resourceType: 'ORDER',
        resourceId: order.id,
        tableName: 'Order',
        description: `Envoi manuel (${docLabels.join(', ')}) à ${recipientEmail}`,
      },
    });

    return {
      ok: mailRes.accepted,
      to: recipientEmail,
      attachedDocuments: docLabels,
      message: mailRes.message,
    };
  }

  private aiJobs = new Map<
    string,
    {
      id: string;
      status: 'RUNNING' | 'COMPLETED' | 'FAILED_QUOTA' | 'FAILED' | 'CANCELLED';
      mode: string;
      startedAt: number;
      finishedAt?: number;
      currentWorkerNumber: 1 | 2;
      currentProvider: 'GEMINI' | 'GROQ';
      currentModel: string;
      currentPhase: string;
      statusMessage: string;
      worker1: { provider: 'GEMINI' | 'GROQ'; model: string; configured: boolean; quotaExhausted: boolean };
      worker2: { provider: 'GEMINI' | 'GROQ'; model: string; configured: boolean; quotaExhausted: boolean };
      steps: AiProgressEvent[];
      result?: any;
      error?: string;
      quotaExhausted?: boolean;
      abortController: AbortController;
    }
  >();

  private cleanupOldAiJobs() {
    const cutoff = Date.now() - 10 * 60 * 1000;
    for (const [id, job] of this.aiJobs.entries()) {
      if ((job.finishedAt || job.startedAt) < cutoff) {
        this.aiJobs.delete(id);
      }
    }
  }

  private assertAiModeAllowed(
    cfg: any,
    mode: string,
    payload: Record<string, any> = {},
    allowOverride = false,
  ) {
    if (mode !== 'TEST' && !cfg.enabled) {
      throw new BadRequestException(
        'Le module IA est désactivé. Demandez au compte ROOT de l’activer dans Système > Intelligence Artificielle.',
      );
    }
    if (allowOverride || mode === 'TEST') return;

    if (mode === 'SECTION_RECAP') {
      if (cfg.enableOverviewRecaps === false) {
        throw new BadRequestException('Les récaps IA des Vues d’Ensemble sont désactivés dans Système > IA.');
      }
      const target = String(payload?.sectionId || 'main').toLowerCase();
      if (cfg.recapTargets && cfg.recapTargets[target] === false) {
        throw new BadRequestException(`Le récap IA pour la vue "${target}" est désactivé dans Système > IA.`);
      }
    }

    if (mode === 'FORM_AUTOFILL') {
      if (cfg.enableFormAutofill === false) {
        throw new BadRequestException('Le remplissage IA des formulaires est désactivé dans Système > IA.');
      }
      const target = String(payload?.formKey || 'generic').toLowerCase();
      if (cfg.formTargets && cfg.formTargets[target] === false) {
        throw new BadRequestException(`L’assistant IA pour le formulaire "${target}" est désactivé dans Système > IA.`);
      }
    }

    if (mode === 'PRODUCT_COPY' && cfg.enableCatalogCopy === false && cfg.enableFormAutofill === false) {
      throw new BadRequestException('La rédaction IA d’articles est désactivée dans Système > IA.');
    }

    if (mode === 'ANALYTICS_INSIGHT' && cfg.enableAnalyticsInsights === false && cfg.enableOverviewRecaps === false) {
      throw new BadRequestException('Les conseils IA Analytics sont désactivés dans Système > IA.');
    }
  }

  private buildAiPrompts(
    mode: 'PRODUCT_COPY' | 'ANALYTICS_INSIGHT' | 'SECTION_RECAP' | 'FORM_AUTOFILL' | 'TEST',
    payload: Record<string, any> = {},
    cfg: any = {},
  ): { systemPrompt: string; userPrompt: string } {
    const tone = cfg.defaultTone || 'Luxe éditorial sobre, précis et orienté conversion (Tunisie, TND)';

    if (mode === 'TEST') {
      return {
        systemPrompt:
          'Tu es l’assistant technique de Royal Électro de Maison en Tunisie. Réponds en une phrase courte en français.',
        userPrompt: 'Confirme que la connexion IA fonctionne correctement pour Royal.',
      };
    }

    if (mode === 'PRODUCT_COPY') {
      return {
        systemPrompt: `Tu es un rédacteur e-commerce expert pour Royal Électro de Maison (Tunisie, devise TND). Ton: ${tone}. Retourne UNIQUEMENT un objet JSON valide (sans markdown) avec exactement ces clés: {"nameAr": string, "shortDescription": string, "description": string, "metaTitle": string, "metaDesc": string, "focusKeyword": string}.`,
        userPrompt: `Produit: "${payload.name || 'Appareil'}", Catégorie: "${payload.category || 'Électroménager'}", Marque: "${payload.brand || 'Royal'}", Prix: "${payload.price || ''} TND". Contraintes: metaTitle <= 60 caractères, metaDesc 135-160 caractères, description riche (80-130 mots) en français, et nom commercial naturel en arabe dans nameAr.`,
      };
    }

    if (mode === 'SECTION_RECAP') {
      return {
        systemPrompt: `Tu es un directeur général adjoint & analyste ERP/e-commerce expert pour Royal Électro de Maison (Tunisie, devise TND). Réponds UNIQUEMENT en JSON valide (sans markdown): {"headline": string, "executiveSummary": string, "highlights": [{"label": string, "insight": string}], "risks": [string], "recommendations": [{"title": string, "priority": "HAUTE"|"MOYENNE", "action": string}]}. Rédige en français clair, concret et chiffré.`,
        userPrompt: `Section: "${payload.title || payload.sectionId || 'Tableau de bord'}" (id="${payload.sectionId || 'main'}"). Sous-titre: "${payload.subtitle || ''}". KPIs actuels JSON: ${JSON.stringify(payload.kpis || {})}. Métriques additionnelles: ${JSON.stringify(payload.summaryMetrics || {})}. Produis un récapitulatif exécutif complet (3 à 4 highlights, 2 points de vigilance max, 3 à 4 actions prioritaires).`,
      };
    }

    if (mode === 'FORM_AUTOFILL') {
      const fieldsList = Array.isArray(payload.fields) ? payload.fields : [];
      return {
        systemPrompt: `Tu es un assistant ERP intelligent pour Royal Électro de Maison (Tunisie, TND). Tu complètes des formulaires métier de gestion (articles, catégories, fournisseurs, clients, showrooms, coupons, témoignages, CMS, utilisateurs). Retourne UNIQUEMENT un objet JSON valide: {"values": Record<string, string | number>, "summary": string}. Règles strictes: (1) Ne retourne des clés que parmi field.key fournies, (2) respecte les options autorisées si le champ est un select, (3) pour les champs numériques/prix/taux retourne un nombre cohérent, (4) conserve le français professionnel de luxe tunisien.`,
        userPrompt: `Formulaire "${payload.formTitle || payload.formKey || 'Formulaire'}" (contexte=${payload.formKey || 'generic'}, type=${payload.mode || 'create'}). Champs détectés: ${JSON.stringify(fieldsList)}. Valeurs déjà saisies: ${JSON.stringify(payload.currentValues || {})}. Complète intelligemment les champs pertinents en respectant les valeurs existantes comme contexte.`,
      };
    }

    // ANALYTICS_INSIGHT
    return {
      systemPrompt:
        'Tu es un directeur retail & e-commerce pour Royal Électro de Maison (Tunisie). Analyse les métriques et réponds UNIQUEMENT en JSON valide: {"headline": string, "summary": string, "recommendations": [{"title": string, "impact": "HAUT"|"MOYEN", "action": string}]}. Max 4 recommandations concrètes en français.',
      userPrompt: `KPIs actuels: Vues=${payload.totalViews || 0}, Visiteurs=${payload.totalVisitors || 0}, Taux rebond=${payload.avgBounce || 0}%, Taux conversion=${payload.avgConversion || 0}%, Top pages=${JSON.stringify(payload.topPages || [])}.`,
    };
  }

  private parseAiModeResponse(mode: string, text: string, meta: { provider: string; model: string; workerNumber: 1 | 2; fallbackFrom?: string }) {
    if (mode === 'TEST') {
      return {
        ok: true,
        provider: meta.provider,
        model: meta.model,
        workerNumber: meta.workerNumber,
        fallbackFrom: meta.fallbackFrom,
        reply: text,
      };
    }
    const parsed = extractJsonBlock(text);
    if (mode === 'PRODUCT_COPY') {
      return {
        ok: true,
        provider: meta.provider,
        model: meta.model,
        workerNumber: meta.workerNumber,
        fallbackFrom: meta.fallbackFrom,
        data: parsed || { description: text },
      };
    }
    if (mode === 'ANALYTICS_INSIGHT') {
      return {
        ok: true,
        provider: meta.provider,
        model: meta.model,
        workerNumber: meta.workerNumber,
        fallbackFrom: meta.fallbackFrom,
        data: parsed || { headline: 'Analyse IA', summary: text, recommendations: [] },
      };
    }
    if (mode === 'SECTION_RECAP') {
      return {
        ok: true,
        provider: meta.provider,
        model: meta.model,
        workerNumber: meta.workerNumber,
        fallbackFrom: meta.fallbackFrom,
        data: parsed || {
          headline: 'Synthèse IA',
          executiveSummary: text,
          highlights: [],
          risks: [],
          recommendations: [],
        },
      };
    }
    // FORM_AUTOFILL
    return {
      ok: true,
      provider: meta.provider,
      model: meta.model,
      workerNumber: meta.workerNumber,
      fallbackFrom: meta.fallbackFrom,
      data: parsed || { values: {}, summary: text },
    };
  }

  async getAiAvailability() {
    const saved = ((await this.getSysConfig('aiProvider')).value || {}) as Partial<AiProviderConfig>;
    const primaryProvider: 'GEMINI' | 'GROQ' = saved.provider === 'GROQ' ? 'GROQ' : 'GEMINI';
    const secondaryProvider: 'GEMINI' | 'GROQ' = primaryProvider === 'GROQ' ? 'GEMINI' : 'GROQ';
    const geminiConfigured = Boolean(String(saved.geminiApiKey || '').trim());
    const groqConfigured = Boolean(String(saved.groqApiKey || '').trim());
    const hasWorker1 = primaryProvider === 'GEMINI' ? geminiConfigured : groqConfigured;
    const hasWorker2 = secondaryProvider === 'GEMINI' ? geminiConfigured : groqConfigured;
    const primaryModel =
      primaryProvider === 'GEMINI'
        ? saved.geminiModel || GEMINI_DEFAULT_MODELS[0]
        : saved.groqModel || GROQ_PREFERRED_CHAT_MODELS[0];
    const secondaryModel =
      secondaryProvider === 'GEMINI'
        ? saved.geminiModel || GEMINI_DEFAULT_MODELS[0]
        : saved.groqModel || GROQ_PREFERRED_CHAT_MODELS[0];

    return {
      enabled: Boolean(saved.enabled),
      primaryProvider,
      secondaryProvider,
      primaryModel,
      secondaryModel,
      hasWorker1,
      hasWorker2,
      enableCatalogCopy: saved.enableCatalogCopy !== false,
      enableAnalyticsInsights: saved.enableAnalyticsInsights !== false,
      enableOverviewRecaps: saved.enableOverviewRecaps !== false,
      enableFormAutofill: saved.enableFormAutofill !== false,
      recapTargets: saved.recapTargets && typeof saved.recapTargets === 'object' ? saved.recapTargets : {},
      formTargets: saved.formTargets && typeof saved.formTargets === 'object' ? saved.formTargets : {},
    };
  }

  async startAiJob(
    dto: {
      mode: 'PRODUCT_COPY' | 'ANALYTICS_INSIGHT' | 'SECTION_RECAP' | 'FORM_AUTOFILL' | 'TEST';
      payload?: Record<string, any>;
      overrideConfig?: Record<string, any>;
    },
    allowOverride = false,
  ) {
    this.cleanupOldAiJobs();
    const saved = ((await this.getSysConfig('aiProvider')).value || {}) as any;
    const cfg = allowOverride && dto.overrideConfig ? { ...saved, ...dto.overrideConfig } : saved;
    this.assertAiModeAllowed(cfg, dto.mode, dto.payload || {}, allowOverride);

    const primaryProvider: 'GEMINI' | 'GROQ' = cfg.provider === 'GROQ' ? 'GROQ' : 'GEMINI';
    const secondaryProvider: 'GEMINI' | 'GROQ' = primaryProvider === 'GROQ' ? 'GEMINI' : 'GROQ';
    const geminiKey = String(cfg.geminiApiKey || '').trim();
    const groqKey = String(cfg.groqApiKey || '').trim();
    const w1Configured = primaryProvider === 'GEMINI' ? Boolean(geminiKey) : Boolean(groqKey);
    const w2Configured = secondaryProvider === 'GEMINI' ? Boolean(geminiKey) : Boolean(groqKey);
    if (!w1Configured && !w2Configured) {
      throw new BadRequestException(
        'Aucune clé API Gemini ou Groq n’est configurée dans Système > Intelligence Artificielle.',
      );
    }

    const w1Model =
      primaryProvider === 'GEMINI'
        ? cfg.geminiModel || GEMINI_DEFAULT_MODELS[0]
        : cfg.groqModel || GROQ_PREFERRED_CHAT_MODELS[0];
    const w2Model =
      secondaryProvider === 'GEMINI'
        ? cfg.geminiModel || GEMINI_DEFAULT_MODELS[0]
        : cfg.groqModel || GROQ_PREFERRED_CHAT_MODELS[0];

    const jobId = `ai_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const abortController = new AbortController();
    const initialWorkerNumber: 1 | 2 = w1Configured ? 1 : 2;
    const job = {
      id: jobId,
      status: 'RUNNING' as const,
      mode: dto.mode,
      startedAt: Date.now(),
      currentWorkerNumber: initialWorkerNumber,
      currentProvider: initialWorkerNumber === 1 ? primaryProvider : secondaryProvider,
      currentModel: initialWorkerNumber === 1 ? w1Model : w2Model,
      currentPhase: 'STARTING',
      statusMessage: `Initialisation Worker ${initialWorkerNumber} (${initialWorkerNumber === 1 ? primaryProvider : secondaryProvider})...`,
      worker1: { provider: primaryProvider, model: w1Model, configured: w1Configured, quotaExhausted: !w1Configured },
      worker2: { provider: secondaryProvider, model: w2Model, configured: w2Configured, quotaExhausted: !w2Configured },
      steps: [] as AiProgressEvent[],
      abortController,
    };
    this.aiJobs.set(jobId, job as any);

    const { systemPrompt, userPrompt } = this.buildAiPrompts(dto.mode, dto.payload || {}, cfg);

    // Run resilient worker failover loop asynchronously
    void runResilientAiFailoverLoop(cfg, systemPrompt, userPrompt, {
      signal: abortController.signal,
      maxAttempts: 24,
      onProgress: (ev) => {
        const currentJob = this.aiJobs.get(jobId);
        if (!currentJob) return;
        currentJob.currentWorkerNumber = ev.workerNumber;
        currentJob.currentProvider = ev.provider;
        currentJob.currentModel = ev.model;
        currentJob.currentPhase = ev.phase;
        currentJob.statusMessage = ev.message;
        if (ev.phase === 'QUOTA_EXHAUSTED') {
          if (ev.workerNumber === 1) currentJob.worker1.quotaExhausted = true;
          else currentJob.worker2.quotaExhausted = true;
        }
        currentJob.steps.push(ev);
        if (currentJob.steps.length > 40) {
          currentJob.steps = currentJob.steps.slice(-40);
        }
      },
    })
      .then((res) => {
        const currentJob = this.aiJobs.get(jobId);
        if (!currentJob || currentJob.status === 'CANCELLED') return;
        currentJob.status = 'COMPLETED';
        currentJob.finishedAt = Date.now();
        currentJob.currentPhase = 'COMPLETED';
        currentJob.result = this.parseAiModeResponse(dto.mode, res.text, res);
      })
      .catch((err: any) => {
        const currentJob = this.aiJobs.get(jobId);
        if (!currentJob) return;
        if (err?.message === 'ABORTED' || currentJob.status === 'CANCELLED') {
          currentJob.status = 'CANCELLED';
          currentJob.finishedAt = Date.now();
          return;
        }
        const isQuota = err instanceof AiQuotaExhaustedError;
        currentJob.status = isQuota ? 'FAILED_QUOTA' : 'FAILED';
        currentJob.quotaExhausted = isQuota;
        currentJob.finishedAt = Date.now();
        currentJob.error =
          err?.message || 'Les fournisseurs IA sont temporairement indisponibles.';
      });

    return {
      jobId,
      startedAt: job.startedAt,
      worker1: job.worker1,
      worker2: job.worker2,
    };
  }

  getAiJobStatus(jobId: string) {
    const job = this.aiJobs.get(jobId);
    if (!job) {
      throw new NotFoundException('Tâche IA introuvable ou expirée.');
    }
    return {
      id: job.id,
      status: job.status,
      mode: job.mode,
      startedAt: job.startedAt,
      finishedAt: job.finishedAt,
      elapsedMs: (job.finishedAt || Date.now()) - job.startedAt,
      currentWorkerNumber: job.currentWorkerNumber,
      currentProvider: job.currentProvider,
      currentModel: job.currentModel,
      currentPhase: job.currentPhase,
      statusMessage: job.statusMessage,
      worker1: job.worker1,
      worker2: job.worker2,
      steps: job.steps,
      result: job.result,
      error: job.error,
      quotaExhausted: Boolean(job.quotaExhausted),
    };
  }

  cancelAiJob(jobId: string) {
    const job = this.aiJobs.get(jobId);
    if (!job) return { ok: true, status: 'NOT_FOUND' };
    job.status = 'CANCELLED';
    job.finishedAt = Date.now();
    job.currentPhase = 'CANCELLED';
    job.statusMessage = 'Opération IA interrompue par l’utilisateur.';
    job.abortController.abort();
    return { ok: true, status: 'CANCELLED' };
  }

  async generateAiContent(
    dto: {
      mode: 'PRODUCT_COPY' | 'ANALYTICS_INSIGHT' | 'SECTION_RECAP' | 'FORM_AUTOFILL' | 'TEST';
      payload?: Record<string, any>;
      overrideConfig?: Record<string, any>;
    },
    allowOverride = false,
  ) {
    const saved = ((await this.getSysConfig('aiProvider')).value || {}) as any;
    const cfg = allowOverride && dto.overrideConfig ? { ...saved, ...dto.overrideConfig } : saved;
    this.assertAiModeAllowed(cfg, dto.mode, dto.payload || {}, allowOverride);

    const { systemPrompt, userPrompt } = this.buildAiPrompts(dto.mode, dto.payload || {}, cfg);
    const res = await generateAiCompletion(cfg, systemPrompt, userPrompt);
    return this.parseAiModeResponse(dto.mode, res.text, res);
  }

  async listAiProviderModels(provider?: string, overrideApiKey?: string) {
    const target = String(provider || 'GROQ').toUpperCase();
    if (target === 'GEMINI') {
      return { provider: 'GEMINI', models: GEMINI_DEFAULT_MODELS };
    }
    const saved = ((await this.getSysConfig('aiProvider')).value || {}) as any;
    const key = String(overrideApiKey || saved?.groqApiKey || '').trim();
    if (!key) {
      return { provider: 'GROQ', models: GROQ_PREFERRED_CHAT_MODELS };
    }
    const models = await listGroqChatModels(key);
    return {
      provider: 'GROQ',
      models: models.length > 0 ? models : GROQ_PREFERRED_CHAT_MODELS,
    };
  }
}
