import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const MARKETING_PERMISSIONS: Array<{ module: string; actions: string[] }> = [
  // Catalogue (sans suppression ni manage!)
  { module: 'brands', actions: ['create', 'read', 'read_list', 'read_detail', 'update'] },
  { module: 'categories', actions: ['create', 'read', 'read_list', 'read_detail', 'update'] },
  { module: 'characteristics', actions: ['create', 'read', 'read_list', 'read_detail', 'update'] },
  { module: 'variants', actions: ['create', 'read', 'read_list', 'read_detail', 'update'] },
  { module: 'products', actions: ['create', 'read', 'read_list', 'read_detail', 'update'] },
  { module: 'coupons', actions: ['create', 'read', 'read_list', 'read_detail', 'update'] },
  // Communauté sans Support
  { module: 'contacts', actions: ['create', 'read_list', 'read_detail', 'update', 'delete'] },
  { module: 'notifications', actions: ['create', 'read_list', 'read_detail', 'update', 'delete'] },
  // Espace Client (aligné sur CLIENT)
  { module: 'client_home', actions: ['create', 'read_list', 'read_detail', 'update'] },
  { module: 'client_orders', actions: ['create', 'read_list', 'read_detail', 'update'] },
  { module: 'client_profile', actions: ['create', 'read_list', 'read_detail', 'update'] },
  { module: 'client_loyalty', actions: ['create', 'read_list', 'read_detail', 'update'] },
  { module: 'client_coupons', actions: ['create', 'read_list', 'read_detail', 'update'] },
  { module: 'client_wishlist', actions: ['create', 'read_list', 'read_detail', 'update', 'delete'] },
];

const MARKETING_DEFAULT_VIEWS = [
  '/dashboard',
  '/dashboard/community/notifications',
  '/dashboard/community/contacts',
  '/dashboard/brands',
  '/dashboard/categories',
  '/dashboard/characteristics',
  '/dashboard/variants',
  '/dashboard/articles',
  '/dashboard/coupons',
  '/account/home',
  '/account/orders',
  '/account/favorites',
  '/account/profile',
  '/account/loyalty',
  '/account/coupons',
  '/account/notifications',
];

async function main() {
  const role = await prisma.role.upsert({
    where: { name: 'MARKETING' },
    update: {
      displayName: 'Marketing',
      description: 'Catalogue (sans suppression), Communauté (Notifications & Contact sans Support) et Espace Client',
    },
    create: {
      name: 'MARKETING',
      displayName: 'Marketing',
      description: 'Catalogue (sans suppression), Communauté (Notifications & Contact sans Support) et Espace Client',
      isSystem: false,
    },
  });

  const targetPermissionIds: string[] = [];
  for (const spec of MARKETING_PERMISSIONS) {
    for (const action of spec.actions) {
      const existing = await prisma.permission.findFirst({
        where: {
          module: spec.module,
          action,
        },
      });
      if (existing) {
        targetPermissionIds.push(existing.id);
      } else {
        const created = await prisma.permission.create({
          data: {
            module: spec.module,
            resource: spec.module,
            action,
            scope: null,
            description: `${spec.module} — ${action}`,
          },
        });
        targetPermissionIds.push(created.id);
      }
    }
  }

  // Remplacer proprement les permissions de MARKETING pour corriger d'éventuelles erreurs précédentes
  await prisma.$transaction([
    prisma.rolePermission.deleteMany({ where: { roleId: role.id } }),
    prisma.rolePermission.createMany({
      data: targetPermissionIds.map((permissionId) => ({
        roleId: role.id,
        permissionId,
      })),
      skipDuplicates: true,
    }),
  ]);

  // Synchroniser sys.roleViews pour MARKETING tout en préservant les autres rôles personnalisés
  const existingSetting = await prisma.settings.findUnique({ where: { key: 'sys.roleViews' } });
  let roleViewsMap: Record<string, string[]> = {};
  if (existingSetting?.value) {
    try {
      const parsed = JSON.parse(existingSetting.value);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        roleViewsMap = parsed;
      }
    } catch {
      roleViewsMap = {};
    }
  }
  roleViewsMap.MARKETING = MARKETING_DEFAULT_VIEWS;

  await prisma.settings.upsert({
    where: { key: 'sys.roleViews' },
    update: {
      value: JSON.stringify(roleViewsMap),
      group: 'system',
      updatedBy: 'SYNC_SCRIPT',
    },
    create: {
      key: 'sys.roleViews',
      value: JSON.stringify(roleViewsMap),
      group: 'system',
      isSecret: false,
      updatedBy: 'SYNC_SCRIPT',
    },
  });

  console.log(
    `[OK] Role MARKETING (${role.id}) synchronisé avec ${targetPermissionIds.length} permissions validées et ${MARKETING_DEFAULT_VIEWS.length} vues autorisées.`,
  );
}

main()
  .catch((err) => {
    console.error('[ERROR] sync-marketing-role:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
