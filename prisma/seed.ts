import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { syncPermissionsViews } from '../src/modules/permissions/rbac-scanner.helper';
import { ensureDefaultDeliveryCompanies, ensureDeliverySystemDocumentDefaults } from '../src/modules/deliveries/delivery-pricing.helper';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting Royal Database Seeding...');

  // 1. Roles
  const roles = [
    { name: 'ROOT', displayName: 'Super Root System', isSystem: true, description: 'Master administrator with unbreakable god privileges' },
    { name: 'SUPER_ADMIN', displayName: 'Super Administrateur', isSystem: true, description: 'Directeur général de la plateforme' },
    { name: 'WEBSITE_MANAGER', displayName: 'Website Manager', isSystem: true, description: 'Gestionnaire délégué de boutique et opérations' },
    { name: 'COMMERCIAL', displayName: 'Commercial', isSystem: true, description: 'Prospection, catalogue et suivi ventes B2B' },
    { name: 'MARKETING', displayName: 'Marketing', isSystem: false, description: 'Catalogue (sans suppression), Communauté (Notifications & Contact sans Support) et Espace Client' },
    { name: 'SALESPERSON', displayName: 'Vendeurs', isSystem: true, description: 'Ventes showrooms et caisse POS' },
    { name: 'CLIENT', displayName: 'Client', isSystem: true, description: 'Client final e-commerce' },
    { name: 'STOCK_MANAGER', displayName: 'Magasiniers', isSystem: true, description: 'Responsable inventaire et entrepôts' },
    { name: 'CASHIER', displayName: 'Caissiers', isSystem: true, description: 'Opérateur caisse et point de vente' },
    { name: 'ACCOUNTANT', displayName: 'Financiers', isSystem: true, description: 'Responsable trésorerie et finances' },
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: { displayName: role.displayName, description: role.description },
      create: role,
    });
  }
  console.log(`✅ ${roles.length} Roles seeded.`);

  // 2. Permissions
  const modules = [
    'users', 'roles', 'permissions', 'products', 'categories', 'characteristics', 'variants', 'brands', 'suppliers',
    'warehouses', 'inventory', 'pos', 'orders', 'customers', 'deliveries', 'delivery_companies',
    'payments', 'treasury', 'accounting', 'expenses', 'reports', 'settings',
    'audit', 'reviews', 'coupons'
  ];
  const actions = ['read', 'create', 'update', 'delete', 'manage'];

  let countPerms = 0;
  for (const mod of modules) {
    for (const act of actions) {
      const permKey = {
        module: mod,
        resource: mod,
        action: act,
        scope: 'all',
      };
      await prisma.permission.upsert({
        where: {
          module_resource_action_scope: permKey,
        },
        update: {},
        create: {
          ...permKey,
          description: `Permission ${act} on ${mod}`,
        },
      });
      countPerms++;
    }
  }
  console.log(`✅ ${countPerms} Permissions seeded.`);

  // 3. Assign all permissions to ROOT and SUPER_ADMIN, and operational permissions to WEBSITE_MANAGER
  const rootRole = await prisma.role.findUniqueOrThrow({ where: { name: 'ROOT' } });
  const superAdminRole = await prisma.role.findUniqueOrThrow({ where: { name: 'SUPER_ADMIN' } });
  const websiteManagerRole = await prisma.role.findUniqueOrThrow({ where: { name: 'WEBSITE_MANAGER' } });
  const allPermissions = await prisma.permission.findMany();

  const websiteManagerModules = new Set([
    'users', 'products', 'categories', 'characteristics', 'variants', 'brands', 'suppliers',
    'warehouses', 'inventory', 'pos', 'orders', 'customers', 'deliveries', 'delivery_companies',
    'payments', 'treasury', 'accounting', 'expenses', 'reports', 'reviews', 'coupons',
  ]);

  for (const perm of allPermissions) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: rootRole.id, permissionId: perm.id } },
      update: {},
      create: { roleId: rootRole.id, permissionId: perm.id },
    });

    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: superAdminRole.id, permissionId: perm.id } },
      update: {},
      create: { roleId: superAdminRole.id, permissionId: perm.id },
    });

    if (websiteManagerModules.has(perm.module)) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: websiteManagerRole.id, permissionId: perm.id } },
        update: {},
        create: { roleId: websiteManagerRole.id, permissionId: perm.id },
      });
    }
  }

  // 4. Create Core Royal Users
  const rootEmail = process.env.ROOT_EMAIL || 'root@royal.com.tn';
  const rootPassword = process.env.ROOT_PASSWORD || 'RootAdmin2026!';
  const hashedPassword = await argon2.hash(rootPassword);

  const rootUser = await prisma.user.upsert({
    where: { email: rootEmail },
    update: {
      passwordHash: hashedPassword,
      firstName: 'Master',
      lastName: 'Root',
      isActive: true,
      isEmailVerified: true,
    },
    create: {
      email: rootEmail,
      passwordHash: hashedPassword,
      firstName: 'Master',
      lastName: 'Root',
      isActive: true,
      isEmailVerified: true,
    },
  });

  // Assign ROOT role to root user
  const existingUserRole = await prisma.userRole.findFirst({
    where: {
      userId: rootUser.id,
      roleId: rootRole.id,
    },
  });

  if (!existingUserRole) {
    await prisma.userRole.create({
      data: {
        userId: rootUser.id,
        roleId: rootRole.id,
      },
    });
  }
  console.log(`👑 Root user ready: ${rootEmail}`);

  const staffAndClientAccounts = [
    { email: 'superadmin@royal.com.tn', password: process.env.SUPERADMIN_PASSWORD || 'SuperAdmin2026!', firstName: 'Directeur', lastName: 'Général', role: 'SUPER_ADMIN' },
    { email: 'websitemanager@royal.com.tn', password: process.env.ADMIN_PASSWORD || 'AdminStore2026!', firstName: 'Website', lastName: 'Manager', role: 'WEBSITE_MANAGER' },
    { email: 'commercial@royal.com.tn', password: process.env.COMMERCIAL_PASSWORD || 'Commercial2026!', firstName: 'Commercial', lastName: 'Royal', role: 'COMMERCIAL' },
    { email: 'marketing@royal.com.tn', password: process.env.MARKETING_PASSWORD || process.env.ADMIN_PASSWORD || 'AdminStore2026!', firstName: 'Marketing', lastName: 'Royal', role: 'MARKETING' },
    { email: 'vendeur@royal.com.tn', password: process.env.SALESPERSON_PASSWORD || 'Vendeur2026!', firstName: 'Vendeur', lastName: 'Showroom', role: 'SALESPERSON' },
    { email: 'cashier@royal.com.tn', password: process.env.CASHIER_PASSWORD || 'Cashier2026!', firstName: 'Karim', lastName: 'Mejri', role: 'CASHIER' },
    { email: 'stock@royal.com.tn', password: process.env.STOCK_PASSWORD || 'Stock2026!', firstName: 'Youssef', lastName: 'Gharbi', role: 'STOCK_MANAGER' },
    { email: 'financier@royal.com.tn', password: process.env.ACCOUNTANT_PASSWORD || 'Financier2026!', firstName: 'Financier', lastName: 'Royal', role: 'ACCOUNTANT' },
    { email: 'client@royal.com.tn', password: process.env.CLIENT_PASSWORD || 'ClientPassword2026!', firstName: 'Amira', lastName: 'Trabelsi', role: 'CLIENT' },
  ];

  for (const acc of staffAndClientAccounts) {
    const pwHash = await argon2.hash(acc.password);
    const u = await prisma.user.upsert({
      where: { email: acc.email },
      update: { passwordHash: pwHash, firstName: acc.firstName, lastName: acc.lastName, isActive: true, isEmailVerified: true },
      create: { email: acc.email, passwordHash: pwHash, firstName: acc.firstName, lastName: acc.lastName, isActive: true, isEmailVerified: true },
    });
    const r = await prisma.role.findUnique({ where: { name: acc.role } });
    if (r) {
      const existingUr = await prisma.userRole.findFirst({ where: { userId: u.id, roleId: r.id } });
      if (!existingUr) {
        await prisma.userRole.create({ data: { userId: u.id, roleId: r.id } });
      }
    }
    if (acc.role === 'CLIENT') {
      await prisma.customer.upsert({
        where: { email: acc.email },
        update: { userId: u.id, firstName: acc.firstName, lastName: acc.lastName },
        create: { userId: u.id, email: acc.email, firstName: acc.firstName, lastName: acc.lastName },
      });
    }
  }
  console.log(`✅ ${staffAndClientAccounts.length} Royal operational & client accounts ready.`);

  // 5. Default Settings (Dynamic Branding & System Config)
  const defaultSettings = [
    { key: 'branding.app_name', value: 'Royal', group: 'branding' },
    { key: 'branding.app_slogan', value: 'Plateforme E-Commerce & Gestion Commerciale', group: 'branding' },
    { key: 'branding.app_logo_url', value: '/images/royal-logo.svg', group: 'branding' },
    { key: 'branding.app_favicon_url', value: '/favicon.ico', group: 'branding' },
    { key: 'branding.domain', value: 'royal.com.tn', group: 'branding' },
    { key: 'branding.meta_title', value: 'Royal — E-Commerce & Commerce Management', group: 'branding' },
    { key: 'branding.meta_description', value: 'Boutique en ligne et système de gestion commerciale complet.', group: 'branding' },
    { key: 'store.currency', value: 'TND', group: 'store' },
    { key: 'store.default_language', value: 'fr', group: 'store' },
    { key: 'store.tax_rate', value: '0.19', group: 'store' },
    { key: 'checkout.guest_enabled', value: 'true', group: 'checkout' },
    { key: 'checkout.guest_require_phone', value: 'true', group: 'checkout' },
    { key: 'checkout.guest_require_email', value: 'true', group: 'checkout' },
    { key: 'payment.clictopay_enabled', value: 'false', group: 'payment' },
    { key: 'payment.clictopay_mode', value: 'test', group: 'payment' },
    { key: 'storage.provider', value: 'local', group: 'storage' },
    { key: 'storage.local_path', value: '/app/uploads', group: 'storage' },
  ];

  for (const s of defaultSettings) {
    await prisma.settings.upsert({
      where: { key: s.key },
      update: {},
      create: s,
    });
  }
  console.log(`⚙️ ${defaultSettings.length} Default settings seeded.`);

  // 6. Default Warehouse & Secondary Boutique
  const whCentral = await prisma.warehouse.upsert({
    where: { code: 'WH-CENTRAL' },
    update: {},
    create: {
      code: 'WH-CENTRAL',
      name: 'Entrepôt Central Principal',
      address: 'Zone Industrielle Charguia II',
      city: 'Tunis',
      country: 'TN',
      isDefault: true,
      isActive: true,
    },
  });

  const whMarsa = await prisma.warehouse.upsert({
    where: { code: 'WH-MARSA' },
    update: {},
    create: {
      code: 'WH-MARSA',
      name: 'Réserve Boutique La Marsa',
      address: 'Avenue Habib Bourguiba',
      city: 'La Marsa',
      country: 'TN',
      isDefault: false,
      isActive: true,
    },
  });
  console.log('🏢 Warehouses created (WH-CENTRAL, WH-MARSA).');

  // 7. Point of Sale & Cash Register
  const posMarsa = await prisma.pointOfSale.upsert({
    where: { code: 'POS-MARSA' },
    update: {},
    create: {
      code: 'POS-MARSA',
      name: 'Boutique Royal La Marsa',
      warehouseId: whMarsa.id,
      address: 'Avenue Habib Bourguiba, La Marsa',
      phone: '+216 71 777 888',
      isActive: true,
    },
  });

  await prisma.cashRegister.upsert({
    where: { id: 'reg-marsa-01' },
    update: {},
    create: {
      id: 'reg-marsa-01',
      name: 'Caisse Tactile Principale',
      posId: posMarsa.id,
      isActive: true,
    },
  });
  console.log('🛒 POS Boutique & Cash Register created.');

  const seededCompanies = await ensureDefaultDeliveryCompanies(prisma);
  const deliveryDocs = await ensureDeliverySystemDocumentDefaults(prisma);
  const viewsSync = await syncPermissionsViews(prisma);
  console.log('🚚 Delivery companies & doc defaults ready:', JSON.stringify({ seededCompanies, deliveryDocs }));
  console.log(`🧭 permissions_views synced: ${viewsSync.upsertedCount} records.`);

  console.log('✨ Core Royal infrastructure seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
