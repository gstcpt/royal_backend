import { PrismaClient, ProductStatus } from '@prisma/client';
import { Decimal } from 'decimal.js';

const prisma = new PrismaClient();

async function seedCatalog() {
  console.log('🍳 Seeding Royal Luxury Catalog & Categories...');

  // 1. Brands
  const brandsData = [
    { name: 'Chefsy Atelier', slug: 'chefsy-atelier', description: 'Haute technologie culinaire et design scandinave épuré' },
    { name: 'Le Creuset', slug: 'le-creuset', description: 'Excellence française de la fonte émaillée depuis 1925' },
    { name: 'Staub Heritage', slug: 'staub-heritage', description: 'Fonte d’Alsace prisée par les plus grands chefs étoilés' },
    { name: 'Smeg Signature', slug: 'smeg-signature', description: 'Électroménager rétro chic et ingénierie de précision italienne' },
    { name: 'Wüsthof Solingen', slug: 'wusthof-solingen', description: 'Coutellerie de maître forgée à Solingen, Allemagne' },
  ];

  const brandsMap = new Map<string, string>();
  for (const b of brandsData) {
    const brand = await prisma.brand.upsert({
      where: { slug: b.slug },
      update: { name: b.name, description: b.description },
      create: b,
    });
    brandsMap.set(b.slug, brand.id);
  }
  console.log(`✅ ${brandsData.length} Marques enregistrées.`);

  // 1.5 Suppliers
  const suppliersData = [
    {
      name: 'Fonderies Alsaciennes de Précision',
      code: 'SUP-ALSACE-01',
      email: 'contact@fonderies-alsace.fr',
      phone: '+33 3 88 00 11 22',
      address: 'Route des Forges',
      city: 'Strasbourg',
      country: 'FR',
      taxId: 'FR88991122334',
      paymentTerms: 30,
    },
    {
      name: 'Manufacture Coutelière de Solingen',
      code: 'SUP-SOLINGEN-02',
      email: 'export@solingen-messer.de',
      phone: '+49 212 998877',
      address: 'Klingenstrasse 45',
      city: 'Solingen',
      country: 'DE',
      taxId: 'DE123456789',
      paymentTerms: 45,
    },
  ];

  for (const sup of suppliersData) {
    await prisma.supplier.upsert({
      where: { code: sup.code },
      update: { name: sup.name, email: sup.email },
      create: sup,
    });
  }
  console.log(`✅ ${suppliersData.length} Fournisseurs d’exception enregistrés.`);

  // 2. Categories
  const categoriesData = [
    {
      name: 'Batteries & Casseroles',
      nameAr: 'أواني وقدور الطهي',
      slug: 'batteries-casseroles',
      description: 'Ensembles complets de casseroles, poêles et cocottes en fonte',
      imageUrl: 'https://images.unsplash.com/photo-1584990347449-3543efee3be5?auto=format&fit=crop&w=600&q=80',
      sortOrder: 1,
    },
    {
      name: 'Plaques & Cuisson',
      nameAr: 'مواقد وأفران الطهي',
      slug: 'plaques-cuisson',
      description: 'Plaques à induction et tables de cuisson encastrables',
      imageUrl: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=600&q=80',
      sortOrder: 2,
    },
    {
      name: 'Ustensiles de Chef',
      nameAr: 'أدوات وسكاكين الشيف',
      slug: 'ustensiles-chef',
      description: 'Coutellerie japonaise et sets d’accessoires en silicone alimentaire',
      imageUrl: 'https://images.unsplash.com/photo-1590794056226-79ef3a8147e1?auto=format&fit=crop&w=600&q=80',
      sortOrder: 3,
    },
    {
      name: 'Conservation & Bocaux',
      nameAr: 'أواني الحفظ والتخزين',
      slug: 'conservation-bocaux',
      description: 'Pots hermétiques en verre borosilicate et boîtes sous vide',
      imageUrl: 'https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?auto=format&fit=crop&w=600&q=80',
      sortOrder: 4,
    },
    {
      name: 'Petit Électroménager',
      nameAr: 'أجهزة المطبخ الكهربائية',
      slug: 'petit-electromenager',
      description: 'Air fryers, robots pétrins et bouilloires thermorégulées',
      imageUrl: 'https://images.unsplash.com/photo-1574269909862-7e1d70bb8078?auto=format&fit=crop&w=600&q=80',
      sortOrder: 5,
    },
    {
      name: 'Art de la Table',
      nameAr: 'أطقم السفرة والضيافة',
      slug: 'art-de-la-table',
      description: 'Assiettes en grès émaillé et couverts dorés pour réceptions',
      imageUrl: 'https://images.unsplash.com/photo-1614707267537-b85aaf00c4b7?auto=format&fit=crop&w=600&q=80',
      sortOrder: 6,
    },
  ];

  const catMap = new Map<string, string>();
  for (const c of categoriesData) {
    const cat = await prisma.category.upsert({
      where: { slug: c.slug },
      update: { name: c.name, nameAr: c.nameAr, imageUrl: c.imageUrl, sortOrder: c.sortOrder },
      create: c,
    });
    catMap.set(c.slug, cat.id);
  }
  console.log(`✅ ${categoriesData.length} Catégories enregistrées.`);

  // 3. Central Warehouse reference
  const warehouse = await prisma.warehouse.findFirst();
  const warehouseId = warehouse?.id;

  // 4. Luxury Products
  const products = [
    {
      sku: 'CHEF-COC-28',
      name: 'Cocotte Ronde en Fonte Émaillée Signée 28cm',
      nameAr: 'قدر طهي دائري من الحديد الزهر المصقول 28 سم',
      slug: 'cocotte-ronde-fonte-emaillee-28cm',
      shortDescription: 'Pièce maîtresse en fonte émaillée, rétention thermique exceptionnelle et arrosage continu.',
      description: 'Fabriquée dans la plus pure tradition, cette cocotte de 28cm garantit une cuisson lente et homogène.',
      categorySlug: 'batteries-casseroles',
      brandSlug: 'chefsy-atelier',
      basePrice: 195.0,
      sellingPrice: 345.0,
      discountPrice: 289.0, // Promo
      weight: 5.6,
      dimensionsJson: { diametre: '28 cm', volume: '6.7 Litres', hauteur: '18 cm' },
      isFeatured: true,
      imageUrl: 'https://images.unsplash.com/photo-1584990347449-3543efee3be5?auto=format&fit=crop&w=800&q=80',
      variants: [
        { sku: 'CHEF-COC-28-EM', name: 'Émeraude Impériale', attributesJson: { couleur: 'Émeraude' } },
        { sku: 'CHEF-COC-28-OB', name: 'Noir Obsidienne', attributesJson: { couleur: 'Obsidienne' } },
        { sku: 'CHEF-COC-28-CR', name: 'Crème Albâtre', attributesJson: { couleur: 'Crème' } },
      ],
    },
    {
      sku: 'CHEF-SET-SIL',
      name: 'Set de 12 Ustensiles Chef avec Pot Céramique',
      nameAr: 'طقم 12 أداة طهي احترافية مع حامل سيراميك',
      slug: 'set-12-ustensiles-chef-silicone-bois',
      shortDescription: 'Silicone alimentaire sans BPA résistant à 260°C et manches en bois d’acacia noble.',
      description: 'Le set indispensable pour toutes vos préparations, livré avec son pot en grès assorti.',
      categorySlug: 'ustensiles-chef',
      brandSlug: 'chefsy-atelier',
      basePrice: 45.0,
      sellingPrice: 89.0,
      discountPrice: 69.0,
      weight: 1.2,
      dimensionsJson: { pieces: '12', materiau: 'Silicone & Bois Acacia' },
      isFeatured: true,
      imageUrl: 'https://images.unsplash.com/photo-1590794056226-79ef3a8147e1?auto=format&fit=crop&w=800&q=80',
      variants: [
        { sku: 'CHEF-SET-SIL-EM', name: 'Vert Pastel / Sauge', attributesJson: { couleur: 'Sauge' } },
        { sku: 'CHEF-SET-SIL-GY', name: 'Gris Ardoise', attributesJson: { couleur: 'Gris' } },
      ],
    },
    {
      sku: 'CHEF-AIR-PRO',
      name: 'Friteuse Sans Huile Air Fryer Digital Touch 6.5L',
      nameAr: 'قلاية هوائية رقمية سعة 6.5 لتر بتقنية الهواء الساخن',
      slug: 'air-fryer-digital-touch-6-5l',
      shortDescription: 'Cuisson croustillante avec 85% de matière grasse en moins, écran tactile tactile LED.',
      description: 'Technologie de convection thermo-cyclone à 360°, 12 programmes pré-enregistrés.',
      categorySlug: 'petit-electromenager',
      brandSlug: 'smeg-signature',
      basePrice: 160.0,
      sellingPrice: 289.0,
      discountPrice: 249.0,
      weight: 4.8,
      dimensionsJson: { capacite: '6.5L', puissance: '1800W' },
      isFeatured: true,
      imageUrl: 'https://images.unsplash.com/photo-1574269909862-7e1d70bb8078?auto=format&fit=crop&w=800&q=80',
      variants: [
        { sku: 'CHEF-AIR-PRO-BK', name: 'Noir Mat Intense', attributesJson: { couleur: 'Noir Mat' } },
        { sku: 'CHEF-AIR-PRO-WH', name: 'Blanc Nacré', attributesJson: { couleur: 'Blanc' } },
      ],
    },
    {
      sku: 'CHEF-KNIFE-8',
      name: 'Couteau de Chef Forgé Santoku Acier VG-10',
      nameAr: 'سكين الشيف سانتوكو من الفولاذ الياباني VG-10',
      slug: 'couteau-chef-santoku-acier-vg10',
      shortDescription: 'Lame damassée 67 couches avec manche ergonomique en bois de pakkawood.',
      description: 'Équilibre parfait et tranchant rasoir durable pour les découpes ultra précises.',
      categorySlug: 'ustensiles-chef',
      brandSlug: 'wusthof-solingen',
      basePrice: 85.0,
      sellingPrice: 165.0,
      discountPrice: 145.0,
      weight: 0.35,
      dimensionsJson: { lame: '20 cm', acier: 'Damas VG-10' },
      isFeatured: false,
      imageUrl: 'https://images.unsplash.com/photo-1593618998160-e34014e67546?auto=format&fit=crop&w=800&q=80',
      variants: [
        { sku: 'CHEF-KNIFE-8-STD', name: 'Standard 20cm', attributesJson: { taille: '20cm' } },
      ],
    },
    {
      sku: 'CHEF-JAR-SET',
      name: 'Coffret 6 Bocaux Hermétiques en Verre Borosilicate',
      nameAr: 'طقم 6 أواني زجاجية محكمة الغلق بأغطية خشب البامبو',
      slug: 'coffret-6-bocaux-verre-borosilicate-bambou',
      shortDescription: 'Verre ultra-résistant aux chocs thermiques et couvercles en bambou naturel avec joint silicone.',
      description: 'Idéal pour conserver graines, épices, pâtes fraîches et farines tout en décorant la cuisine.',
      categorySlug: 'conservation-bocaux',
      brandSlug: 'chefsy-atelier',
      basePrice: 32.0,
      sellingPrice: 68.0,
      discountPrice: 55.0,
      weight: 1.8,
      dimensionsJson: { contenances: '2x500ml, 2x800ml, 2x1200ml' },
      isFeatured: true,
      imageUrl: 'https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?auto=format&fit=crop&w=800&q=80',
      variants: [
        { sku: 'CHEF-JAR-SET-6', name: 'Lot de 6 Bocaux', attributesJson: { pack: '6 pièces' } },
      ],
    },
    {
      sku: 'CHEF-KETTLE-TEMP',
      name: 'Bouilloire Électrique Thermorégulée avec Infuseur',
      nameAr: 'غلاية كهربائية ذكية مع مصفاة شاي وتحكم في درجات الحرارة',
      slug: 'bouilloire-electrique-thermoregulee-infuseur',
      shortDescription: 'Contrôle précis de 40°C à 100°C pour thés rares et cafés de spécialité, corps en inox poli.',
      description: 'Maintien au chaud pendant 2 heures, bec col de cygne pour un versement fluide.',
      categorySlug: 'petit-electromenager',
      brandSlug: 'smeg-signature',
      basePrice: 95.0,
      sellingPrice: 175.0,
      discountPrice: null,
      weight: 1.4,
      dimensionsJson: { capacite: '1.2 Litres', puissance: '1500W' },
      isFeatured: false,
      imageUrl: 'https://images.unsplash.com/photo-1556909212-d5b604d0c90d?auto=format&fit=crop&w=800&q=80',
      variants: [
        { sku: 'CHEF-KETTLE-TEMP-EM', name: 'Vert Émeraude Métallisé', attributesJson: { couleur: 'Émeraude' } },
        { sku: 'CHEF-KETTLE-TEMP-CH', name: 'Chromé Poli', attributesJson: { couleur: 'Chrome' } },
      ],
    },
  ];

  for (const p of products) {
    const categoryId = catMap.get(p.categorySlug);
    const brandId = brandsMap.get(p.brandSlug);
    if (!categoryId) continue;

    const created = await prisma.product.upsert({
      where: { sku: p.sku },
      update: {
        name: p.name,
        nameAr: p.nameAr,
        shortDescription: p.shortDescription,
        description: p.description,
        sellingPrice: new Decimal(p.sellingPrice),
        discountPrice: p.discountPrice ? new Decimal(p.discountPrice) : null,
        isFeatured: p.isFeatured,
      },
      create: {
        sku: p.sku,
        name: p.name,
        nameAr: p.nameAr,
        slug: p.slug,
        shortDescription: p.shortDescription,
        description: p.description,
        categoryId,
        brandId,
        basePrice: new Decimal(p.basePrice),
        sellingPrice: new Decimal(p.sellingPrice),
        discountPrice: p.discountPrice ? new Decimal(p.discountPrice) : null,
        weight: p.weight ? new Decimal(p.weight) : null,
        dimensionsJson: p.dimensionsJson,
        status: ProductStatus.ACTIVE,
        isFeatured: p.isFeatured,
        isComparable: true,
        publishedAt: new Date(),
      },
    });

    // Seed primary image
    await prisma.productImage.deleteMany({ where: { productId: created.id } });
    await prisma.productImage.create({
      data: {
        productId: created.id,
        url: p.imageUrl,
        alt: p.name,
        isPrimary: true,
        sortOrder: 0,
      },
    });

    // Seed variants
    await prisma.productVariant.deleteMany({ where: { productId: created.id } });
    for (let i = 0; i < p.variants.length; i++) {
      const v = p.variants[i];
      const variant = await prisma.productVariant.create({
        data: {
          productId: created.id,
          sku: v.sku,
          name: v.name,
          attributesJson: v.attributesJson,
          sellingPrice: new Decimal(p.sellingPrice),
          sortOrder: i,
        },
      });

      // Stock
      if (warehouseId) {
        await prisma.stock.upsert({
          where: { variantId_warehouseId: { variantId: variant.id, warehouseId } },
          update: { physicalQty: 50 },
          create: {
            variantId: variant.id,
            warehouseId,
            physicalQty: 50,
            reservedQty: 0,
          },
        });
      }
    }
  }

  console.log(`✅ ${products.length} Produits de luxe avec variantes et stocks créés !`);
}

seedCatalog()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
