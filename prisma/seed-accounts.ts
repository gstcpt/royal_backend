import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding Royal Accounts...');

  const accounts = [
    {
      email: 'root@royal.com.tn',
      password: 'RootAdmin2026!',
      firstName: 'Master',
      lastName: 'Root',
      role: 'ROOT',
    },
    {
      email: 'superadmin@royal.com.tn',
      password: 'SuperAdmin2026!',
      firstName: 'Directeur',
      lastName: 'Général',
      role: 'SUPER_ADMIN',
    },
    {
      email: 'admin@royal.com.tn',
      password: 'AdminStore2026!',
      firstName: 'Sami',
      lastName: 'Ben Salem',
      role: 'ADMIN',
    },
    {
      email: 'cashier@royal.com.tn',
      password: 'Cashier2026!',
      firstName: 'Karim',
      lastName: 'Mejri',
      role: 'CASHIER',
    },
    {
      email: 'stock@royal.com.tn',
      password: 'Stock2026!',
      firstName: 'Youssef',
      lastName: 'Gharbi',
      role: 'STOCK_MANAGER',
    },
    {
      email: 'delivery@royal.com.tn',
      password: 'Delivery2026!',
      firstName: 'Mohamed',
      lastName: 'Zitouni',
      role: 'DELIVERY_MANAGER',
    },
    {
      email: 'client@royal.com.tn',
      password: 'ClientPassword2026!',
      firstName: 'Amira',
      lastName: 'Trabelsi',
      role: 'CLIENT',
    },
    {
      email: 'sami.bensalah@test.tn',
      password: 'ClientPassword2026!',
      firstName: 'Sami',
      lastName: 'Ben Salah',
      role: 'CLIENT',
    },
  ];

  for (const acc of accounts) {
    const passwordHash = await argon2.hash(acc.password);
    const user = await prisma.user.upsert({
      where: { email: acc.email },
      update: {
        firstName: acc.firstName,
        lastName: acc.lastName,
        passwordHash,
        isActive: true,
        isEmailVerified: true,
      },
      create: {
        email: acc.email,
        passwordHash,
        firstName: acc.firstName,
        lastName: acc.lastName,
        isActive: true,
        isEmailVerified: true,
      },
    });

    const role = await prisma.role.findUnique({ where: { name: acc.role } });
    if (role) {
      const existingUserRole = await prisma.userRole.findFirst({
        where: { userId: user.id, roleId: role.id },
      });
      if (!existingUserRole) {
        await prisma.userRole.create({
          data: { userId: user.id, roleId: role.id },
        });
      }
    }
    console.log(`✅ User seeded: ${acc.email} (${acc.role})`);
  }

  console.log('🎉 All Royal accounts successfully seeded into PostgreSQL!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
