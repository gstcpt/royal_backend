import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  // Ensure standard accounts exist for each key role so the user has fully working test accounts
  const standardAccounts = [
    {
      email: 'root@royal.com.tn',
      pass: 'RootAdmin2026!',
      first: 'Master',
      last: 'Root',
      role: 'ROOT',
    },
    {
      email: 'superadmin@royal.com.tn',
      pass: 'SuperAdmin2026!',
      first: 'Directeur',
      last: 'Général',
      role: 'SUPER_ADMIN',
    },
    {
      email: 'websitemanager@royal.com.tn',
      pass: 'AdminStore2026!',
      first: 'Website',
      last: 'Manager',
      role: 'WEBSITE_MANAGER',
    },
    {
      email: 'client@royal.com.tn',
      pass: 'ClientPassword2026!',
      first: 'Amira',
      last: 'Trabelsi',
      role: 'CLIENT',
    },
    {
      email: 'cashier@royal.com.tn',
      pass: 'Cashier2026!',
      first: 'Karim',
      last: 'Mejri',
      role: 'CASHIER',
    },
    {
      email: 'stock@royal.com.tn',
      pass: 'Stock2026!',
      first: 'Youssef',
      last: 'Gharbi',
      role: 'STOCK_MANAGER',
    },
    {
      email: 'vendeur@royal.com.tn',
      pass: 'Vendeur2026!',
      first: 'Vendeur',
      last: 'Showroom',
      role: 'SALESPERSON',
    },
    {
      email: 'financier@royal.com.tn',
      pass: 'Financier2026!',
      first: 'Financier',
      last: 'Royal',
      role: 'ACCOUNTANT',
    },
    {
      email: 'commercial@royal.com.tn',
      pass: 'Commercial2026!',
      first: 'Commercial',
      last: 'Royal',
      role: 'COMMERCIAL',
    },
  ];

  for (const acc of standardAccounts) {
    const roleRecord = await prisma.role.findUnique({ where: { name: acc.role } });
    if (!roleRecord) continue;
    const hash = await argon2.hash(acc.pass);

    const user = await prisma.user.upsert({
      where: { email: acc.email },
      update: {
        passwordHash: hash,
        firstName: acc.first,
        lastName: acc.last,
        isActive: true,
        isEmailVerified: true,
      },
      create: {
        email: acc.email,
        passwordHash: hash,
        firstName: acc.first,
        lastName: acc.last,
        isActive: true,
        isEmailVerified: true,
      },
    });

    const existingRole = await prisma.userRole.findFirst({
      where: { userId: user.id, roleId: roleRecord.id },
    });

    if (!existingRole) {
      await prisma.userRole.create({
        data: { userId: user.id, roleId: roleRecord.id },
      });
    }

    // Also link customer if client
    if (acc.role === 'CLIENT') {
      await prisma.customer.upsert({
        where: { email: acc.email },
        update: { userId: user.id },
        create: {
          userId: user.id,
          email: acc.email,
          firstName: acc.first,
          lastName: acc.last,
          phone: '+216 98 123 456',
        },
      });
    }
  }

  const users = await prisma.user.findMany({
    include: {
      userRoles: {
        include: {
          role: true,
        },
      },
    },
  });

  console.log('✅ EXISTING ACCOUNTS:');
  users.forEach((u) => {
    console.log(`- ${u.email} | ${u.firstName} ${u.lastName} | Roles: ${u.userRoles.map((r) => r.role.name).join(', ')}`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
