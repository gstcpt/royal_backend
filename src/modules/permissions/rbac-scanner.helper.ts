import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';

export interface CanonicalRbacSection {
  order: number;
  key: string;
  labelFr: string;
  descriptionFr: string;
  modules: string[];
  routes: Array<{
    path: string;
    labelFr: string;
    defaultPermissionCode: string;
    visibility: 'PUBLIC' | 'PRIVATE';
  }>;
}

export const MODULE_FRENCH_LABELS: Record<string, string> = {
  brands: 'Marques',
  categories: 'Catégories',
  characteristics: 'Caractéristiques',
  variants: 'Variantes',
  products: 'Articles / Produits',
  coupons: 'Codes promotionnels',
  contacts: 'Contact (Formulaire public)',
  notifications: 'Notifications',
  support: 'Support (Messagerie client)',
  customers: 'Fiches clients',
  orders: 'Commandes clients',
  deliveries: 'Bons de livraison (BL)',
  returns: 'Bons de retour (BR)',
  invoices: 'Factures',
  warehouses: 'Dépôts',
  stock_in: "Bons d'entrée (BE)",
  stock_out: 'Bons de sortie (BS)',
  inventory: 'Inventaire & Ajustements',
  transfers: 'Mouvements de stock',
  prospects: 'Portefeuille de prospects',
  suppliers: 'Fiches fournisseurs',
  purchases_orders: 'Commandes fournisseurs (BC)',
  purchases_receipts: 'Bons de réception (BR)',
  treasury: 'Caisses & Trésorerie',
  treasury_journal: 'Journal de trésorerie',
  payments: 'Suivi des règlements',
  accounting: 'Livres comptables',
  expenses: 'Dépenses',
  pos: 'Terminal POS',
  showrooms: "Salles d'exposition",
  reviews: 'Commentaires & avis',
  interactions: 'Interactions clients',
  newsletters: 'Abonnements newsletter',
  testimonials: 'Témoignages & SEO',
  reports: "Conseils d'achat & Analytics",
  reports_buying: "Rapports d'achat",
  reports_sales: 'Ventes et marges',
  reports_cash: 'Suivi des caisses',
  client_home: 'Espace Client — Accueil',
  client_orders: 'Espace Client — Suivi commandes',
  client_profile: 'Espace Client — Mon profil',
  client_wishlist: 'Espace Client — Favoris',
  client_loyalty: 'Espace Client — Points de fidélité',
  client_coupons: 'Espace Client — Codes privilèges',
  users: 'Tous les utilisateurs (Annuaire)',
  superadmins: 'Super Administrateurs',
  website_managers: 'Website Managers',
  magasiniers: 'Magasiniers',
  caissiers: 'Caissiers',
  vendeurs: 'Vendeurs',
  financiers: 'Financiers',
  commercials: 'Commerciaux',
  marketing: 'Équipe Marketing',
  delivery_companies: 'Sociétés & Tarifs Livraison',
  clients: 'Clients (Comptes RBAC)',
  roles: 'Rôles RBAC',
  permissions: 'Permissions & Vues RBAC',
  settings: 'Paramètres système & Infra',
  audit: "Journal d'audit",
  system_audit: 'Audit système',
  crm_brand: 'CMS — Identité et marque',
  crm_layout: 'CMS — Mise en page et design',
  crm_views: 'CMS — Vues et modèles',
  email_templates: 'Modèles de courriels',
  payment_methods: 'Modalités & Passerelles paiement',
};

export const ACTION_FRENCH_VERBS: Record<string, string> = {
  read: 'Consulter',
  read_list: 'Lister les éléments',
  read_detail: 'Afficher la fiche détaillée',
  create: 'Créer / Ajouter',
  update: 'Modifier / Mettre à jour',
  delete: 'Supprimer',
  manage: 'Administration complète',
  adjust: 'Ajuster les quantités',
  reserve: 'Réserver du stock',
  operate: 'Opérer la caisse / terminal',
  view: 'Visualiser la section',
  approve: 'Approuver / Valider',
  dispatch: 'Expédier / Dispatcher',
  receive: 'Réceptionner',
  cancel: 'Annuler',
  'permissions.assign': 'Assigner des permissions',
};

export const CANONICAL_RBAC_SECTIONS: CanonicalRbacSection[] = [
  {
    order: 1,
    key: 'overview',
    labelFr: 'Tableau de bord',
    descriptionFr: 'Accueil exécutif et indicateurs synthétiques du tableau de bord.',
    modules: [],
    routes: [
      {
        path: '/dashboard',
        labelFr: 'Vue principale Tableau de bord',
        defaultPermissionCode: 'reports.read',
        visibility: 'PUBLIC',
      },
    ],
  },
  {
    order: 2,
    key: 'community',
    labelFr: 'Communauté',
    descriptionFr: 'Notifications staff & client, formulaire Contact et messagerie Support.',
    modules: ['notifications', 'contacts', 'support'],
    routes: [
      {
        path: '/dashboard/community/notifications',
        labelFr: 'Notifications (Staff)',
        defaultPermissionCode: 'notifications.read_list',
        visibility: 'PUBLIC',
      },
      {
        path: '/dashboard/community/contacts',
        labelFr: 'Contact (Formulaire Public)',
        defaultPermissionCode: 'contacts.read_list',
        visibility: 'PUBLIC',
      },
      {
        path: '/dashboard/community/messages',
        labelFr: 'Support (Messagerie Client)',
        defaultPermissionCode: 'support.read_list',
        visibility: 'PUBLIC',
      },
      {
        path: '/account/notifications',
        labelFr: 'Notifications (Client)',
        defaultPermissionCode: 'notifications.read_list',
        visibility: 'PUBLIC',
      },
      {
        path: '/account/messages',
        labelFr: 'Support (Client)',
        defaultPermissionCode: 'support.read_list',
        visibility: 'PUBLIC',
      },
    ],
  },
  {
    order: 3,
    key: 'users',
    labelFr: 'Gestion des utilisateurs',
    descriptionFr: 'Annuaire collaborateurs par profil métier et gestion des comptes clients.',
    modules: [
      'users',
      'superadmins',
      'website_managers',
      'magasiniers',
      'caissiers',
      'vendeurs',
      'financiers',
      'commercials',
    ],
    routes: [
      {
        path: '/dashboard/section/users',
        labelFr: "Vue d'ensemble — Utilisateurs",
        defaultPermissionCode: 'users.read',
        visibility: 'PRIVATE',
      },
      {
        path: '/dashboard/users',
        labelFr: 'Tous les utilisateurs',
        defaultPermissionCode: 'users.read',
        visibility: 'PRIVATE',
      },
      {
        path: '/dashboard/root/superadmins',
        labelFr: 'Super admin',
        defaultPermissionCode: 'superadmins.read_list',
        visibility: 'PRIVATE',
      },
      {
        path: '/dashboard/users/website-managers',
        labelFr: 'Website Manager',
        defaultPermissionCode: 'website_managers.read_list',
        visibility: 'PUBLIC',
      },
      {
        path: '/dashboard/users/magasiniers',
        labelFr: 'Magasiniers',
        defaultPermissionCode: 'magasiniers.read_list',
        visibility: 'PUBLIC',
      },
      {
        path: '/dashboard/users/caissiers',
        labelFr: 'Caissiers',
        defaultPermissionCode: 'caissiers.read_list',
        visibility: 'PUBLIC',
      },
      {
        path: '/dashboard/users/vendeurs',
        labelFr: 'Vendeurs',
        defaultPermissionCode: 'vendeurs.read_list',
        visibility: 'PUBLIC',
      },
      {
        path: '/dashboard/users/financiers',
        labelFr: 'Financiers',
        defaultPermissionCode: 'financiers.read_list',
        visibility: 'PUBLIC',
      },
      {
        path: '/dashboard/users/commercials',
        labelFr: 'Commercials',
        defaultPermissionCode: 'commercials.read_list',
        visibility: 'PUBLIC',
      },
      {
        path: '/dashboard/users/marketing',
        labelFr: 'Marketing',
        defaultPermissionCode: 'users.read',
        visibility: 'PRIVATE',
      },
      {
        path: '/dashboard/users/clients',
        labelFr: 'Clients (Comptes RBAC)',
        defaultPermissionCode: 'users.read',
        visibility: 'PRIVATE',
      },
    ],
  },
  {
    order: 4,
    key: 'catalogue',
    labelFr: 'Catalogue',
    descriptionFr: 'Marques, catégories, caractéristiques, variantes, articles et coupons.',
    modules: ['brands', 'categories', 'characteristics', 'variants', 'products', 'coupons'],
    routes: [
      {
        path: '/dashboard/brands',
        labelFr: 'Marques',
        defaultPermissionCode: 'brands.read',
        visibility: 'PUBLIC',
      },
      {
        path: '/dashboard/categories',
        labelFr: 'Catégories',
        defaultPermissionCode: 'categories.read',
        visibility: 'PUBLIC',
      },
      {
        path: '/dashboard/characteristics',
        labelFr: 'Caractéristiques',
        defaultPermissionCode: 'characteristics.read',
        visibility: 'PUBLIC',
      },
      {
        path: '/dashboard/variants',
        labelFr: 'Variantes',
        defaultPermissionCode: 'variants.read',
        visibility: 'PUBLIC',
      },
      {
        path: '/dashboard/articles',
        labelFr: 'Articles',
        defaultPermissionCode: 'products.read',
        visibility: 'PUBLIC',
      },
      {
        path: '/dashboard/coupons',
        labelFr: 'Codes promotionnels',
        defaultPermissionCode: 'coupons.read',
        visibility: 'PUBLIC',
      },
    ],
  },
  {
    order: 5,
    key: 'treasury',
    labelFr: 'Trésorerie',
    descriptionFr: 'Caisses, journal de trésorerie, règlements, comptabilité et dépenses.',
    modules: ['treasury', 'treasury_journal', 'payments', 'accounting', 'expenses'],
    routes: [
      {
        path: '/dashboard/treasury',
        labelFr: 'Caisses',
        defaultPermissionCode: 'treasury.read',
        visibility: 'PRIVATE',
      },
      {
        path: '/dashboard/treasury/transactions',
        labelFr: 'Journal Trésorerie',
        defaultPermissionCode: 'treasury_journal.read_list',
        visibility: 'PRIVATE',
      },
      {
        path: '/dashboard/treasury/payments',
        labelFr: 'Suivi des règlements',
        defaultPermissionCode: 'payments.read',
        visibility: 'PRIVATE',
      },
      {
        path: '/dashboard/accounting',
        labelFr: 'Livres Comptables',
        defaultPermissionCode: 'accounting.read',
        visibility: 'PRIVATE',
      },
    ],
  },
  {
    order: 6,
    key: 'purchases',
    labelFr: 'Achats et approvisionnement',
    descriptionFr: 'Portefeuille prospects, fournisseurs, bons de commande et réceptions.',
    modules: ['prospects', 'suppliers', 'purchases_orders', 'purchases_receipts'],
    routes: [
      {
        path: '/dashboard/purchases/prospects',
        labelFr: 'Portefeuille de prospects',
        defaultPermissionCode: 'prospects.read_list',
        visibility: 'PRIVATE',
      },
      {
        path: '/dashboard/suppliers',
        labelFr: 'Fiches fournisseurs',
        defaultPermissionCode: 'suppliers.read',
        visibility: 'PRIVATE',
      },
      {
        path: '/dashboard/purchases/orders',
        labelFr: 'Commandes fournisseurs (BC)',
        defaultPermissionCode: 'purchases_orders.read_list',
        visibility: 'PRIVATE',
      },
      {
        path: '/dashboard/purchases/receipts',
        labelFr: 'Bon de réception (BR)',
        defaultPermissionCode: 'purchases_receipts.read_list',
        visibility: 'PRIVATE',
      },
    ],
  },
  {
    order: 7,
    key: 'stock',
    labelFr: 'Stock et entrepôts',
    descriptionFr: 'Dépôts, entrées, sorties, inventaire physique, ajustements et transferts.',
    modules: ['warehouses', 'stock_in', 'stock_out', 'inventory', 'transfers'],
    routes: [
      {
        path: '/dashboard/warehouses',
        labelFr: 'Dépôts',
        defaultPermissionCode: 'warehouses.read',
        visibility: 'PRIVATE',
      },
      {
        path: '/dashboard/stock-in',
        labelFr: "Bon d'entrée (BE)",
        defaultPermissionCode: 'stock_in.read_list',
        visibility: 'PRIVATE',
      },
      {
        path: '/dashboard/stock-out',
        labelFr: 'Bon de sortie (BS)',
        defaultPermissionCode: 'stock_out.read_list',
        visibility: 'PRIVATE',
      },
      {
        path: '/dashboard/inventory',
        labelFr: 'Inventaire physique',
        defaultPermissionCode: 'inventory.read',
        visibility: 'PRIVATE',
      },
      {
        path: '/dashboard/inventory-documents',
        labelFr: 'Ajustement',
        defaultPermissionCode: 'inventory.update',
        visibility: 'PRIVATE',
      },
      {
        path: '/dashboard/transfers',
        labelFr: 'Mouvements de stock',
        defaultPermissionCode: 'transfers.read_list',
        visibility: 'PRIVATE',
      },
    ],
  },
  {
    order: 8,
    key: 'sales',
    labelFr: 'Ventes et distribution',
    descriptionFr: 'Clients, commandes, sociétés de livraison, bons de livraison, retours et facturation.',
    modules: ['customers', 'orders', 'deliveries', 'delivery_companies', 'returns', 'invoices'],
    routes: [
      {
        path: '/dashboard/customers',
        labelFr: 'Fiches clients',
        defaultPermissionCode: 'customers.read',
        visibility: 'PUBLIC',
      },
      {
        path: '/dashboard/orders',
        labelFr: 'Commandes clients',
        defaultPermissionCode: 'orders.read',
        visibility: 'PUBLIC',
      },
      {
        path: '/dashboard/delivery-companies',
        labelFr: 'Sociétés & Tarifs de Livraison',
        defaultPermissionCode: 'delivery_companies.read',
        visibility: 'PRIVATE',
      },
      {
        path: '/dashboard/deliveries',
        labelFr: 'Bon de livraison (BL)',
        defaultPermissionCode: 'deliveries.read',
        visibility: 'PRIVATE',
      },
      {
        path: '/dashboard/returns',
        labelFr: 'Bon de retour (BR)',
        defaultPermissionCode: 'returns.read_list',
        visibility: 'PRIVATE',
      },
      {
        path: '/dashboard/invoices',
        labelFr: 'Factures',
        defaultPermissionCode: 'invoices.read_list',
        visibility: 'PRIVATE',
      },
    ],
  },
  {
    order: 9,
    key: 'pos',
    labelFr: 'Point de vente (POS)',
    descriptionFr: "Salles d'exposition (Showrooms) et terminal de caisse tactiles.",
    modules: ['showrooms', 'pos'],
    routes: [
      {
        path: '/dashboard/pos/showrooms',
        labelFr: "Salles d'exposition",
        defaultPermissionCode: 'showrooms.read_list',
        visibility: 'PRIVATE',
      },
      {
        path: '/dashboard/pos',
        labelFr: 'Terminal POS',
        defaultPermissionCode: 'pos.read',
        visibility: 'PRIVATE',
      },
    ],
  },
  {
    order: 10,
    key: 'seo',
    labelFr: 'SEO & Réputation',
    descriptionFr: 'Avis clients, interactions, newsletters, témoignages et pixels SEO.',
    modules: ['reviews', 'interactions', 'newsletters', 'testimonials'],
    routes: [
      {
        path: '/dashboard/community/testimonials',
        labelFr: 'Commentaires et avis',
        defaultPermissionCode: 'reviews.read',
        visibility: 'PRIVATE',
      },
      {
        path: '/dashboard/reports/interactions',
        labelFr: 'Interactions',
        defaultPermissionCode: 'interactions.read_list',
        visibility: 'PRIVATE',
      },
      {
        path: '/dashboard/community/newsletters',
        labelFr: 'Abonnements',
        defaultPermissionCode: 'newsletters.read_list',
        visibility: 'PRIVATE',
      },
      {
        path: '/dashboard/seo/testimonials',
        labelFr: 'Témoignages',
        defaultPermissionCode: 'testimonials.read_list',
        visibility: 'PRIVATE',
      },
      {
        path: '/dashboard/seo/pixels',
        labelFr: 'Pixels & Référencement SEO',
        defaultPermissionCode: 'settings.read',
        visibility: 'PRIVATE',
      },
    ],
  },
  {
    order: 11,
    key: 'reports',
    labelFr: 'Rapports et statistiques',
    descriptionFr: "Conseils d'achat, marges commerciales et reporting des caisses.",
    modules: ['reports', 'reports_buying', 'reports_sales', 'reports_cash'],
    routes: [
      {
        path: '/dashboard/analytics',
        labelFr: "Conseils d'achat",
        defaultPermissionCode: 'reports.read',
        visibility: 'PRIVATE',
      },
      {
        path: '/dashboard/reports/sales',
        labelFr: 'Ventes et marges',
        defaultPermissionCode: 'reports_sales.read_list',
        visibility: 'PRIVATE',
      },
      {
        path: '/dashboard/reports/treasury',
        labelFr: 'Suivi des caisses',
        defaultPermissionCode: 'reports_cash.read_list',
        visibility: 'PRIVATE',
      },
    ],
  },
  {
    order: 12,
    key: 'client',
    labelFr: 'Espace client',
    descriptionFr: 'Accueil client, suivi commandes, favoris, profil, fidélité et privilèges.',
    modules: [
      'client_home',
      'client_orders',
      'client_wishlist',
      'client_profile',
      'client_loyalty',
      'client_coupons',
    ],
    routes: [
      {
        path: '/account/home',
        labelFr: 'Accueil Client',
        defaultPermissionCode: 'client_home.read_list',
        visibility: 'PUBLIC',
      },
      {
        path: '/account/orders',
        labelFr: 'Suivi des commandes client',
        defaultPermissionCode: 'client_orders.read_list',
        visibility: 'PUBLIC',
      },
      {
        path: '/account/favorites',
        labelFr: 'Liste de souhaits',
        defaultPermissionCode: 'client_wishlist.read_list',
        visibility: 'PUBLIC',
      },
      {
        path: '/account/profile',
        labelFr: 'Mon profil',
        defaultPermissionCode: 'client_profile.read_list',
        visibility: 'PUBLIC',
      },
      {
        path: '/account/loyalty',
        labelFr: 'Mes points de fidélité',
        defaultPermissionCode: 'client_loyalty.read_list',
        visibility: 'PRIVATE',
      },
      {
        path: '/account/coupons',
        labelFr: 'Mes codes privilèges',
        defaultPermissionCode: 'client_coupons.read_list',
        visibility: 'PRIVATE',
      },
    ],
  },
  {
    order: 13,
    key: 'system',
    labelFr: 'Système',
    descriptionFr:
      'CMS storefront, e-mails, SMTP, TVA, préfixes, imprimantes, paiements, stockage, IA, visibilité, traductions, RBAC et audit.',
    modules: [
      'crm_brand',
      'crm_layout',
      'crm_views',
      'email_templates',
      'settings',
      'payment_methods',
      'roles',
      'permissions',
      'audit',
      'system_audit',
    ],
    routes: [
      {
        path: '/dashboard/root/storefront/info',
        labelFr: 'CMS : Identité et marque',
        defaultPermissionCode: 'crm_brand.read_list',
        visibility: 'PRIVATE',
      },
      {
        path: '/dashboard/root/storefront/layouts',
        labelFr: 'CMS : Mise en page et design',
        defaultPermissionCode: 'crm_layout.read_list',
        visibility: 'PRIVATE',
      },
      {
        path: '/dashboard/root/storefront/views',
        labelFr: 'CMS : Vues et modèles',
        defaultPermissionCode: 'crm_views.read_list',
        visibility: 'PRIVATE',
      },
      {
        path: '/dashboard/root/email-templates',
        labelFr: 'Modèles de courriels',
        defaultPermissionCode: 'email_templates.read_list',
        visibility: 'PRIVATE',
      },
      {
        path: '/dashboard/root/smtp',
        labelFr: 'Paramètres SMTP',
        defaultPermissionCode: 'settings.read',
        visibility: 'PRIVATE',
      },
      {
        path: '/dashboard/root/tva',
        labelFr: 'Taxe et timbre fiscal',
        defaultPermissionCode: 'settings.read',
        visibility: 'PRIVATE',
      },
      {
        path: '/dashboard/root/reference-prefixes',
        labelFr: 'Préfixes et numérotations',
        defaultPermissionCode: 'settings.read',
        visibility: 'PRIVATE',
      },
      {
        path: '/dashboard/root/print-templates',
        labelFr: 'Documents & Imprimantes POS',
        defaultPermissionCode: 'settings.read',
        visibility: 'PRIVATE',
      },
      {
        path: '/dashboard/payment-methods',
        labelFr: 'Paiements',
        defaultPermissionCode: 'payment_methods.read_list',
        visibility: 'PRIVATE',
      },
      {
        path: '/dashboard/settings',
        labelFr: 'Paramètres généraux',
        defaultPermissionCode: 'settings.read',
        visibility: 'PRIVATE',
      },
      {
        path: '/dashboard/root/delivery-settings',
        labelFr: 'Règles Livraison, Distances & Transferts',
        defaultPermissionCode: 'settings.read',
        visibility: 'PRIVATE',
      },
      {
        path: '/dashboard/root/storage',
        labelFr: 'Stockage Médias & CDN',
        defaultPermissionCode: 'settings.read',
        visibility: 'PRIVATE',
      },
      {
        path: '/dashboard/root/visibility',
        labelFr: 'Visibilité des vues',
        defaultPermissionCode: 'roles.read',
        visibility: 'PRIVATE',
      },
      {
        path: '/dashboard/root/ai',
        labelFr: 'Intelligence Artificielle (IA)',
        defaultPermissionCode: 'settings.read',
        visibility: 'PRIVATE',
      },
      {
        path: '/dashboard/translations',
        labelFr: 'Langues & Traductions (FR / AR)',
        defaultPermissionCode: 'settings.read',
        visibility: 'PRIVATE',
      },
      {
        path: '/dashboard/root/roles-permissions',
        labelFr: 'Rôles & Permissions',
        defaultPermissionCode: 'roles.read',
        visibility: 'PRIVATE',
      },
      {
        path: '/dashboard/logs',
        labelFr: "Journal d'audit",
        defaultPermissionCode: 'audit.read',
        visibility: 'PRIVATE',
      },
      {
        path: '/dashboard/root/failures',
        labelFr: 'Audit système',
        defaultPermissionCode: 'system_audit.read_list',
        visibility: 'PRIVATE',
      },
    ],
  },
];

const MODULE_PRIMARY_ROUTES: Record<string, Array<{ viewPath: string; viewLabelFr: string }>> = {
  brands: [{ viewPath: '/dashboard/brands', viewLabelFr: 'Marques' }],
  categories: [{ viewPath: '/dashboard/categories', viewLabelFr: 'Catégories' }],
  characteristics: [{ viewPath: '/dashboard/characteristics', viewLabelFr: 'Caractéristiques' }],
  variants: [{ viewPath: '/dashboard/variants', viewLabelFr: 'Variantes' }],
  products: [{ viewPath: '/dashboard/articles', viewLabelFr: 'Articles' }],
  coupons: [{ viewPath: '/dashboard/coupons', viewLabelFr: 'Codes promotionnels' }],
  notifications: [
    { viewPath: '/dashboard/community/notifications', viewLabelFr: 'Notifications (Staff)' },
    { viewPath: '/account/notifications', viewLabelFr: 'Notifications (Client)' },
  ],
  contacts: [{ viewPath: '/dashboard/community/contacts', viewLabelFr: 'Contact (Formulaire Public)' }],
  support: [
    { viewPath: '/dashboard/community/messages', viewLabelFr: 'Support (Messagerie Client)' },
    { viewPath: '/account/messages', viewLabelFr: 'Support (Client)' },
  ],
  users: [
    { viewPath: '/dashboard/section/users', viewLabelFr: "Vue d'ensemble — Utilisateurs" },
    { viewPath: '/dashboard/users', viewLabelFr: 'Tous les utilisateurs' },
    { viewPath: '/dashboard/users/marketing', viewLabelFr: 'Marketing' },
    { viewPath: '/dashboard/users/clients', viewLabelFr: 'Clients (Comptes RBAC)' },
  ],
  superadmins: [{ viewPath: '/dashboard/root/superadmins', viewLabelFr: 'Super admin' }],
  website_managers: [{ viewPath: '/dashboard/users/website-managers', viewLabelFr: 'Website Manager' }],
  magasiniers: [{ viewPath: '/dashboard/users/magasiniers', viewLabelFr: 'Magasiniers' }],
  caissiers: [{ viewPath: '/dashboard/users/caissiers', viewLabelFr: 'Caissiers' }],
  vendeurs: [{ viewPath: '/dashboard/users/vendeurs', viewLabelFr: 'Vendeurs' }],
  financiers: [{ viewPath: '/dashboard/users/financiers', viewLabelFr: 'Financiers' }],
  commercials: [{ viewPath: '/dashboard/users/commercials', viewLabelFr: 'Commercials' }],
  treasury: [{ viewPath: '/dashboard/treasury', viewLabelFr: 'Caisses' }],
  treasury_journal: [{ viewPath: '/dashboard/treasury/transactions', viewLabelFr: 'Journal Trésorerie' }],
  payments: [{ viewPath: '/dashboard/treasury/payments', viewLabelFr: 'Suivi des règlements' }],
  accounting: [{ viewPath: '/dashboard/accounting', viewLabelFr: 'Livres Comptables' }],
  expenses: [{ viewPath: '/dashboard/treasury/transactions', viewLabelFr: 'Dépenses & Journal' }],
  prospects: [{ viewPath: '/dashboard/purchases/prospects', viewLabelFr: 'Portefeuille de prospects' }],
  suppliers: [{ viewPath: '/dashboard/suppliers', viewLabelFr: 'Fiches fournisseurs' }],
  purchases_orders: [{ viewPath: '/dashboard/purchases/orders', viewLabelFr: 'Commandes fournisseurs (BC)' }],
  purchases_receipts: [{ viewPath: '/dashboard/purchases/receipts', viewLabelFr: 'Bon de réception (BR)' }],
  warehouses: [{ viewPath: '/dashboard/warehouses', viewLabelFr: 'Dépôts' }],
  stock_in: [{ viewPath: '/dashboard/stock-in', viewLabelFr: "Bon d'entrée (BE)" }],
  stock_out: [{ viewPath: '/dashboard/stock-out', viewLabelFr: 'Bon de sortie (BS)' }],
  inventory: [
    { viewPath: '/dashboard/inventory', viewLabelFr: 'Inventaire physique' },
    { viewPath: '/dashboard/inventory-documents', viewLabelFr: 'Ajustement' },
  ],
  transfers: [
    { viewPath: '/dashboard/transfers', viewLabelFr: 'Mouvements de stock' },
    { viewPath: '/dashboard/transfers/[id]', viewLabelFr: 'Détail Demande & Bon de Transfert' },
  ],
  customers: [{ viewPath: '/dashboard/customers', viewLabelFr: 'Fiches clients' }],
  orders: [
    { viewPath: '/dashboard/orders', viewLabelFr: 'Commandes clients' },
    { viewPath: '/dashboard/orders/[id]', viewLabelFr: 'Détail commande client' },
  ],
  delivery_companies: [
    { viewPath: '/dashboard/delivery-companies', viewLabelFr: 'Sociétés & Tarifs de Livraison' },
  ],
  deliveries: [{ viewPath: '/dashboard/deliveries', viewLabelFr: 'Bon de livraison (BL)' }],
  returns: [{ viewPath: '/dashboard/returns', viewLabelFr: 'Bon de retour (BR)' }],
  invoices: [{ viewPath: '/dashboard/invoices', viewLabelFr: 'Factures' }],
  showrooms: [{ viewPath: '/dashboard/pos/showrooms', viewLabelFr: "Salles d'exposition" }],
  pos: [{ viewPath: '/dashboard/pos', viewLabelFr: 'Terminal POS' }],
  reviews: [{ viewPath: '/dashboard/community/testimonials', viewLabelFr: 'Commentaires et avis' }],
  interactions: [{ viewPath: '/dashboard/reports/interactions', viewLabelFr: 'Interactions' }],
  newsletters: [{ viewPath: '/dashboard/community/newsletters', viewLabelFr: 'Abonnements' }],
  testimonials: [{ viewPath: '/dashboard/seo/testimonials', viewLabelFr: 'Témoignages' }],
  reports: [
    { viewPath: '/dashboard', viewLabelFr: 'Vue principale Tableau de bord' },
    { viewPath: '/dashboard/analytics', viewLabelFr: "Conseils d'achat" },
  ],
  reports_buying: [{ viewPath: '/dashboard/analytics', viewLabelFr: "Conseils d'achat" }],
  reports_sales: [{ viewPath: '/dashboard/reports/sales', viewLabelFr: 'Ventes et marges' }],
  reports_cash: [{ viewPath: '/dashboard/reports/treasury', viewLabelFr: 'Suivi des caisses' }],
  client_home: [{ viewPath: '/account/home', viewLabelFr: 'Accueil Client' }],
  client_orders: [{ viewPath: '/account/orders', viewLabelFr: 'Suivi des commandes client' }],
  client_wishlist: [{ viewPath: '/account/favorites', viewLabelFr: 'Liste de souhaits' }],
  client_profile: [{ viewPath: '/account/profile', viewLabelFr: 'Mon profil' }],
  client_loyalty: [{ viewPath: '/account/loyalty', viewLabelFr: 'Mes points de fidélité' }],
  client_coupons: [{ viewPath: '/account/coupons', viewLabelFr: 'Mes codes privilèges' }],
  crm_brand: [{ viewPath: '/dashboard/root/storefront/info', viewLabelFr: 'CMS : Identité et marque' }],
  crm_layout: [{ viewPath: '/dashboard/root/storefront/layouts', viewLabelFr: 'CMS : Mise en page et design' }],
  crm_views: [{ viewPath: '/dashboard/root/storefront/views', viewLabelFr: 'CMS : Vues et modèles' }],
  email_templates: [{ viewPath: '/dashboard/root/email-templates', viewLabelFr: 'Modèles de courriels' }],
  settings: [
    { viewPath: '/dashboard/settings', viewLabelFr: 'Paramètres généraux' },
    { viewPath: '/dashboard/root/delivery-settings', viewLabelFr: 'Règles Livraison, Distances & Transferts' },
    { viewPath: '/dashboard/root/smtp', viewLabelFr: 'Paramètres SMTP' },
    { viewPath: '/dashboard/root/tva', viewLabelFr: 'Taxe et timbre fiscal' },
    { viewPath: '/dashboard/root/reference-prefixes', viewLabelFr: 'Préfixes et numérotations' },
    { viewPath: '/dashboard/root/print-templates', viewLabelFr: 'Documents & Imprimantes POS' },
    { viewPath: '/dashboard/root/storage', viewLabelFr: 'Stockage Médias & CDN' },
    { viewPath: '/dashboard/root/ai', viewLabelFr: 'Intelligence Artificielle (IA)' },
    { viewPath: '/dashboard/translations', viewLabelFr: 'Langues & Traductions (FR / AR)' },
    { viewPath: '/dashboard/seo/pixels', viewLabelFr: 'Pixels & Référencement SEO' },
  ],
  payment_methods: [{ viewPath: '/dashboard/payment-methods', viewLabelFr: 'Paiements' }],
  roles: [
    { viewPath: '/dashboard/root/roles-permissions', viewLabelFr: 'Rôles & Permissions' },
    { viewPath: '/dashboard/root/visibility', viewLabelFr: 'Visibilité des vues' },
  ],
  permissions: [{ viewPath: '/dashboard/root/roles-permissions', viewLabelFr: 'Rôles & Permissions' }],
  audit: [{ viewPath: '/dashboard/logs', viewLabelFr: "Journal d'audit" }],
  system_audit: [{ viewPath: '/dashboard/root/failures', viewLabelFr: 'Audit système' }],
};

export function buildFrenchActionTitle(mod: string, action: string): string {
  const modLabel = MODULE_FRENCH_LABELS[mod] || mod.replace(/_/g, ' ');
  const normalizedAction = action.toLowerCase();
  const verb = ACTION_FRENCH_VERBS[normalizedAction];
  if (verb) {
    return `${verb} — ${modLabel}`;
  }
  return `${action} — ${modLabel}`;
}

export function resolveWorkspaceRoot(): string | null {
  const candidates = [
    process.cwd(),
    path.resolve(process.cwd(), '..', '..'),
    path.resolve(__dirname, '..', '..', '..', '..'),
    path.resolve(__dirname, '..', '..', '..', '..', '..'),
  ];
  for (const dir of candidates) {
    const feDir = path.join(dir, 'apps', 'frontend', 'src', 'app', '(dashboard)');
    const beDir = path.join(dir, 'apps', 'backend', 'src', 'modules');
    if (fs.existsSync(feDir) && fs.existsSync(beDir)) {
      return dir;
    }
  }
  return null;
}

function walkFiles(dir: string, suffix: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkFiles(full, suffix));
    } else if (entry.name.endsWith(suffix)) {
      results.push(full);
    }
  }
  return results;
}

export interface ScannedControllerEndpoint {
  controllerFile: string;
  controllerPrefix: string;
  httpMethod: string;
  subPath: string;
  fullEndpoint: string;
  permissionTokens: string[];
}

export interface WorkspaceRbacScanResult {
  workspaceRoot: string | null;
  discoveredFrontendRoutes: string[];
  canonicalViewsCount: number;
  discoveredControllerEndpoints: ScannedControllerEndpoint[];
  backendRoutesByPermCode: Record<string, string[]>;
  unregisteredFrontendRoutes: string[];
}

export function scanWorkspaceRbacSurface(explicitRoot?: string): WorkspaceRbacScanResult {
  const root = explicitRoot || resolveWorkspaceRoot();
  const discoveredFrontendRoutes: string[] = [];
  const discoveredControllerEndpoints: ScannedControllerEndpoint[] = [];
  const backendRoutesByPermCode: Record<string, string[]> = {};

  if (root) {
    const dashDir = path.join(root, 'apps', 'frontend', 'src', 'app', '(dashboard)');
    const pageFiles = walkFiles(dashDir, 'page.tsx');
    for (const file of pageFiles) {
      const rel = path
        .relative(dashDir, file)
        .replace(/\\/g, '/')
        .replace(/\/page\.tsx$/, '')
        .replace(/^page\.tsx$/, '');
      const route = rel ? `/${rel}` : '/';
      discoveredFrontendRoutes.push(route);
    }
    discoveredFrontendRoutes.sort();

    const beModulesDir = path.join(root, 'apps', 'backend', 'src', 'modules');
    const controllers = walkFiles(beModulesDir, '.controller.ts');
    for (const file of controllers) {
      const text = fs.readFileSync(file, 'utf8');
      const ctrlMatch = text.match(/@Controller\((['"`])([^'"`]*)\1\)/);
      const ctrlPrefix = ctrlMatch ? ctrlMatch[2].replace(/^\/+|\/+$/g, '') : '';
      const lines = text.split(/\r?\n/);

      let pendingMethod: { method: string; subPath: string } | null = null;
      let pendingPerms: string[] = [];

      const flushPending = () => {
        if (!pendingMethod) return;
        const cleanSub = pendingMethod.subPath.replace(/^\/+|\/+$/g, '');
        const fullEndpoint = `${pendingMethod.method} /api/${[ctrlPrefix, cleanSub].filter(Boolean).join('/')}`;
        if (pendingPerms.length > 0) {
          discoveredControllerEndpoints.push({
            controllerFile: path.relative(root, file).replace(/\\/g, '/'),
            controllerPrefix: ctrlPrefix,
            httpMethod: pendingMethod.method,
            subPath: pendingMethod.subPath,
            fullEndpoint,
            permissionTokens: [...pendingPerms],
          });
          for (const token of pendingPerms) {
            const parts = token.split('|').map((s) => s.trim()).filter(Boolean);
            for (const p of parts) {
              const norm = p.replace(/:/g, '.');
              backendRoutesByPermCode[norm] = backendRoutesByPermCode[norm] || [];
              if (!backendRoutesByPermCode[norm].includes(fullEndpoint)) {
                backendRoutesByPermCode[norm].push(fullEndpoint);
              }
            }
          }
        }
        pendingMethod = null;
        pendingPerms = [];
      };

      for (const line of lines) {
        const httpMatch = line.match(/@(Get|Post|Put|Patch|Delete)\(([^)]*)\)/);
        if (httpMatch) {
          flushPending();
          const rawArg = httpMatch[2].trim();
          const pathMatch = rawArg.match(/^(['"`])([^'"`]*)\1/);
          pendingMethod = {
            method: httpMatch[1].toUpperCase(),
            subPath: pathMatch ? pathMatch[2] : '',
          };
          continue;
        }
        const permMatch = line.match(/@Permissions\(([^)]+)\)/);
        if (permMatch && pendingMethod) {
          for (const q of permMatch[1].matchAll(/(['"`])([^'"`]+)\1/g)) {
            pendingPerms.push(q[2]);
          }
          continue;
        }
        if (/^\s*(async\s+)?[a-zA-Z0-9_]+\s*\(/.test(line) && !line.trim().startsWith('@')) {
          flushPending();
        }
      }
      flushPending();
    }
  }

  const canonicalRouteSet = new Set(
    CANONICAL_RBAC_SECTIONS.flatMap((s) => s.routes.map((r) => r.path)),
  );
  const unregisteredFrontendRoutes = discoveredFrontendRoutes.filter(
    (r) => !canonicalRouteSet.has(r),
  );

  return {
    workspaceRoot: root,
    discoveredFrontendRoutes,
    canonicalViewsCount: canonicalRouteSet.size,
    discoveredControllerEndpoints,
    backendRoutesByPermCode,
    unregisteredFrontendRoutes,
  };
}

export async function syncPermissionsViews(prisma: PrismaClient, explicitRoot?: string) {
  const scan = scanWorkspaceRbacSurface(explicitRoot);
  const allPerms = await prisma.permission.findMany({
    orderBy: [{ module: 'asc' }, { action: 'asc' }],
  });

  const permByCode = new Map<string, { id: string; module: string; action: string }>();
  for (const perm of allPerms) {
    const code = `${perm.module}.${perm.action}`;
    permByCode.set(code, perm);
  }

  const sectionByModule = new Map<string, CanonicalRbacSection>();
  const sectionByRoute = new Map<string, CanonicalRbacSection>();
  for (const sec of CANONICAL_RBAC_SECTIONS) {
    for (const mod of sec.modules) {
      sectionByModule.set(mod, sec);
    }
    for (const r of sec.routes) {
      sectionByRoute.set(r.path, sec);
    }
  }

  const entriesToUpsert: Array<{
    permissionId: string | null;
    permissionCode: string;
    module: string;
    action: string;
    actionTitleFr: string;
    sectionKey: string;
    sectionOrder: number;
    sectionLabelFr: string;
    viewPath: string;
    viewLabelFr: string;
    backendRoute: string | null;
    sourceType: string;
    isDefault: boolean;
  }> = [];

  // 1. Register every canonical route (78 dashboard/account views ordered 1..13)
  for (const sec of CANONICAL_RBAC_SECTIONS) {
    for (const route of sec.routes) {
      const perm = permByCode.get(route.defaultPermissionCode) || null;
      const [mod, ...actParts] = route.defaultPermissionCode.split('.');
      const action = actParts.join('.') || 'read';
      const matchingEndpoints = scan.backendRoutesByPermCode[route.defaultPermissionCode] || [];
      entriesToUpsert.push({
        permissionId: perm?.id || null,
        permissionCode: route.defaultPermissionCode,
        module: mod,
        action,
        actionTitleFr: buildFrenchActionTitle(mod, action),
        sectionKey: sec.key,
        sectionOrder: sec.order,
        sectionLabelFr: sec.labelFr,
        viewPath: route.path,
        viewLabelFr: route.labelFr,
        backendRoute: matchingEndpoints.slice(0, 4).join(' | ') || null,
        sourceType: 'SCANNER',
        isDefault: route.visibility === 'PUBLIC',
      });
    }
  }

  // 2. Register every granular permission against its primary dashboard view(s)
  for (const perm of allPerms) {
    const code = `${perm.module}.${perm.action}`;
    const sec =
      sectionByModule.get(perm.module) ||
      CANONICAL_RBAC_SECTIONS[CANONICAL_RBAC_SECTIONS.length - 1];
    const routes = MODULE_PRIMARY_ROUTES[perm.module] || [
      { viewPath: sec.routes[0]?.path || '/dashboard', viewLabelFr: sec.routes[0]?.labelFr || sec.labelFr },
    ];

    const altColonRead =
      perm.action === 'read_list' || perm.action === 'read_detail'
        ? `${perm.module}.read`
        : code;
    const altView = perm.action === 'read' ? `${perm.module}.view` : null;
    const endpoints = Array.from(
      new Set([
        ...(scan.backendRoutesByPermCode[code] || []),
        ...(scan.backendRoutesByPermCode[altColonRead] || []),
        ...(altView ? scan.backendRoutesByPermCode[altView] || [] : []),
      ]),
    );

    for (const route of routes) {
      const routeSec = sectionByRoute.get(route.viewPath) || sec;
      entriesToUpsert.push({
        permissionId: perm.id,
        permissionCode: code,
        module: perm.module,
        action: perm.action,
        actionTitleFr: buildFrenchActionTitle(perm.module, perm.action),
        sectionKey: routeSec.key,
        sectionOrder: routeSec.order,
        sectionLabelFr: routeSec.labelFr,
        viewPath: route.viewPath,
        viewLabelFr: route.viewLabelFr,
        backendRoute: endpoints.slice(0, 4).join(' | ') || null,
        sourceType: 'SCANNER',
        isDefault: perm.action === 'read' || perm.action === 'read_list' || perm.action === 'read_detail',
      });
    }
  }

  // Deduplicate by (permissionCode, viewPath) keeping the richest record
  const deduped = new Map<string, (typeof entriesToUpsert)[number]>();
  for (const item of entriesToUpsert) {
    const key = `${item.permissionCode}::${item.viewPath}`;
    const prev = deduped.get(key);
    if (!prev || (!prev.permissionId && item.permissionId)) {
      deduped.set(key, item);
    }
  }

  let upsertedCount = 0;
  for (const item of deduped.values()) {
    await prisma.permissionView.upsert({
      where: {
        permissionCode_viewPath: {
          permissionCode: item.permissionCode,
          viewPath: item.viewPath,
        },
      },
      update: {
        permissionId: item.permissionId,
        module: item.module,
        action: item.action,
        actionTitleFr: item.actionTitleFr,
        sectionKey: item.sectionKey,
        sectionOrder: item.sectionOrder,
        sectionLabelFr: item.sectionLabelFr,
        viewLabelFr: item.viewLabelFr,
        backendRoute: item.backendRoute,
        sourceType: item.sourceType,
        isDefault: item.isDefault,
      },
      create: item,
    });
    upsertedCount++;
  }

  return {
    upsertedCount,
    canonicalViewsCount: scan.canonicalViewsCount,
    discoveredFrontendRoutesCount: scan.discoveredFrontendRoutes.length,
    discoveredControllerEndpointsCount: scan.discoveredControllerEndpoints.length,
    unregisteredFrontendRoutes: scan.unregisteredFrontendRoutes,
  };
}
