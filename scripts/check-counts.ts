import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const [
    users,
    roles,
    permissions,
    categories,
    brands,
    suppliers,
    products,
    variants,
    stocks,
    warehouses,
    customers,
    orders,
    orderItems,
    coupons,
    reviews,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.role.count(),
    prisma.permission.count(),
    prisma.category.count(),
    prisma.brand.count(),
    prisma.supplier.count(),
    prisma.product.count(),
    prisma.productVariant.count(),
    prisma.stock.count(),
    prisma.warehouse.count(),
    prisma.customer.count(),
    prisma.order.count(),
    prisma.orderItem.count(),
    prisma.coupon.count(),
    prisma.review.count(),
  ]);

  console.log('TABLE ROW COUNTS:');
  console.log(JSON.stringify({
    users,
    roles,
    permissions,
    categories,
    brands,
    suppliers,
    products,
    variants,
    stocks,
    warehouses,
    customers,
    orders,
    orderItems,
    coupons,
    reviews,
  }, null, 2));
}

main().finally(() => prisma.$disconnect());
