import { PrismaClient, ProductStatus } from '@prisma/client';

const prisma = new PrismaClient();

export async function seedDokaniCatalog() {
  console.log('⚡ Seeding Dokani-Style Electroménager & Cuisine Catalog...');

  // 1. Warehouses
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

  const whLac2 = await prisma.warehouse.upsert({
    where: { code: 'WH-LAC2' },
    update: {},
    create: {
      code: 'WH-LAC2',
      name: 'Réserve Showroom Lac II',
      address: 'Avenue de la Bourse, Les Berges du Lac II',
      city: 'Tunis',
      country: 'TN',
      isDefault: false,
      isActive: true,
    },
  });

  // 2. Categories
  const dokaniCategories = [
    {
      name: 'Petit Électroménager',
      nameAr: 'الأجهزة الكهرومنزلية الصغيرة',
      slug: 'petit-electromenager',
      description: 'Airfryers, robots pétrins multifonctions, cafetières espresso, mixeurs et hachoirs.',
      imageUrl: 'https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?auto=format&fit=crop&w=800&q=80',
      sortOrder: 1,
      isActive: true,
    },
    {
      name: 'Gros Électroménager',
      nameAr: 'الأجهزة الكهرومنزلية الكبيرة',
      slug: 'gros-electromenager',
      description: 'Fours encastrables, cuisinières tout inox, plaques de cuisson gaz et réfrigérateurs.',
      imageUrl: 'https://images.unsplash.com/photo-1590794056226-79ef3a8147e1?auto=format&fit=crop&w=800&q=80',
      sortOrder: 2,
      isActive: true,
    },
    {
      name: 'Cuisine & Préparation',
      nameAr: 'أدوات الطبخ والتحضير',
      slug: 'cuisine-et-preparation',
      description: 'Batteries de cuisine antiadhésives en granit, poêles inox et sets de couteaux professionnels.',
      imageUrl: 'https://images.unsplash.com/photo-1594998893017-36147cbcae05?auto=format&fit=crop&w=800&q=80',
      sortOrder: 3,
      isActive: true,
    },
    {
      name: 'Maison & Entretien',
      nameAr: 'تجهيزات المنزل والعناية',
      slug: 'maison-et-entretien',
      description: 'Aspirateurs balais et sans sac cycloniques, fers à repasser et centrales vapeur.',
      imageUrl: 'https://images.unsplash.com/photo-1558317374-067fb5f30001?auto=format&fit=crop&w=800&q=80',
      sortOrder: 4,
      isActive: true,
    },
  ];

  const catMap: Record<string, any> = {};
  for (const c of dokaniCategories) {
    const record = await prisma.category.upsert({
      where: { slug: c.slug },
      update: c,
      create: c,
    });
    catMap[c.slug] = record;
  }
  console.log(`✅ ${Object.keys(catMap).length} Dokani Categories ready.`);

  // 3. Brands
  const dokaniBrands = [
    { name: 'Moulinex', slug: 'moulinex', description: 'Leader de la préparation culinaire et petit électro.', website: 'https://www.moulinex.com' },
    { name: 'Kenwood', slug: 'kenwood', description: 'Robots pâtissiers et moteurs professionnels.', website: 'https://www.kenwoodworld.com' },
    { name: 'DeLonghi', slug: 'delonghi', description: 'L’art du café espresso et broyeurs à grains italiens.', website: 'https://www.delonghi.com' },
    { name: 'Tefal', slug: 'tefal', description: 'Pionnier du revêtement anti-adhésif et cuisson saine.', website: 'https://www.tefal.com' },
    { name: 'Bosch', slug: 'bosch', description: 'Qualité allemande pour le gros électroménager et fours encastrables.', website: 'https://www.bosch-home.com' },
    { name: 'Beko', slug: 'beko', description: 'Cuisinières et froid robustes au meilleur rapport qualité-prix.', website: 'https://www.beko.com' },
    { name: 'Philips', slug: 'philips', description: 'Airfryers et petit électroménager innovant.', website: 'https://www.philips.com' },
  ];

  const brandMap: Record<string, any> = {};
  for (const b of dokaniBrands) {
    const record = await prisma.brand.upsert({
      where: { slug: b.slug },
      update: b,
      create: b,
    });
    brandMap[b.slug] = record;
  }
  console.log(`✅ ${Object.keys(brandMap).length} Dokani Brands ready.`);

  // 4. Suppliers (Fournisseurs)
  const dokaniSuppliers = [
    { name: 'Comptoir Tunisien de l’Électroménager (CTE)', code: 'SUP-CTE-01', email: 'commercial@cte.tn', phone: '+216 71 200 300', country: 'TN' },
    { name: 'Distribution Moderne d’Équipement (DME)', code: 'SUP-DME-02', email: 'appro@dme-distrib.com', phone: '+216 71 400 500', country: 'TN' },
    { name: 'Alliance Technique Maghreb (ATM)', code: 'SUP-ATM-03', email: 'ventes@atm-sahel.tn', phone: '+216 73 500 600', country: 'TN' },
  ];

  const supplierMap: Record<string, any> = {};
  for (const s of dokaniSuppliers) {
    const record = await prisma.supplier.upsert({
      where: { code: s.code },
      update: s,
      create: s,
    });
    supplierMap[s.code] = record;
  }
  console.log(`✅ ${Object.keys(supplierMap).length} Suppliers ready.`);

  // 5. Products Data
  const productsToSeed = [
    {
      sku: 'DKN-AIR-DUAL-85',
      barcode: '619888001001',
      name: 'Friteuse Sans Huile Airfryer Double Tiroir 8.5L — 2400W Inox',
      nameAr: 'قلاية هوائية بدون زيت بدرجين سعة 8.5 لتر قوة 2400 واط',
      slug: 'airfryer-double-tiroir-8-5l-2400w',
      description: 'Airfryer grande capacité à 2 tiroirs synchronisés (5.2L + 3.3L). Permet de cuire deux plats différents simultanément à températures indépendantes. 10 programmes automatiques, écran tactile LED et revêtement antiadhésif lavable au lave-vaisselle.',
      shortDescription: 'Double zone 8.5L, 2400W, 90% d’huile en moins, 10 programmes automatiques.',
      categoryId: catMap['petit-electromenager'].id,
      brandId: brandMap['moulinex'].id,
      supplierId: supplierMap['SUP-CTE-01'].id,
      basePrice: 369.00,
      sellingPrice: 369.00,
      discountPrice: 289.00,
      status: ProductStatus.ACTIVE,
      isFeatured: true,
      variants: [
        { sku: 'DKN-AIR-DUAL-85-INOX', name: 'Inox Brossé & Noir 8.5L', price: 289.00, attrs: { color: 'Inox & Noir', capacity: '8.5L', power: '2400W' }, stockCentral: 45, stockLac2: 15 },
        { sku: 'DKN-AIR-DUAL-85-BLK', name: 'Noir Mat Intense 8.5L', price: 289.00, attrs: { color: 'Noir Mat', capacity: '8.5L', power: '2400W' }, stockCentral: 30, stockLac2: 12 },
      ],
      images: [
        { url: 'https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?q=80&w=800&auto=format&fit=crop', alt: 'Airfryer double bac 8.5L', isPrimary: true },
        { url: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?q=80&w=800&auto=format&fit=crop', alt: 'Cuisson saine airfryer', isPrimary: false },
      ],
    },
    {
      sku: 'DKN-ROB-TIT-1800',
      barcode: '619888001002',
      name: 'Robot Pétrin Professionnel Titanium 8.5L — 1800W Inox',
      nameAr: 'عجانة احترافية تيتانيوم سعة 8.5 لتر قوة 1800 واط',
      slug: 'robot-petrin-multifonctions-8-5l-1800w',
      description: 'Robot pâtissier professionnel avec cuve en acier inoxydable de 8.5 litres et moteur surpuissant de 1800W à transmission par engrenages métalliques. Mouvement planétaire complet, 6 vitesses réglables et fonction pulse. Livré avec pétrin, batteur et fouet métallique.',
      shortDescription: 'Bol inox 8.5L avec poignée, moteur 1800W engrenages métal, kit pâtisserie complet.',
      categoryId: catMap['petit-electromenager'].id,
      brandId: brandMap['kenwood'].id,
      supplierId: supplierMap['SUP-CTE-01'].id,
      basePrice: 440.00,
      sellingPrice: 440.00,
      discountPrice: 359.00,
      status: ProductStatus.ACTIVE,
      isFeatured: true,
      variants: [
        { sku: 'DKN-ROB-TIT-1800-SIL', name: 'Gris Titanium Inox 8.5L', price: 359.00, attrs: { color: 'Titanium', capacity: '8.5L', power: '1800W' }, stockCentral: 38, stockLac2: 14 },
        { sku: 'DKN-ROB-TIT-1800-RED', name: 'Rouge Rubis Inox 8.5L', price: 369.00, attrs: { color: 'Rouge Rubis', capacity: '8.5L', power: '1800W' }, stockCentral: 25, stockLac2: 8 },
      ],
      images: [
        { url: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?q=80&w=800&auto=format&fit=crop', alt: 'Robot pétrin 8.5L', isPrimary: true },
      ],
    },
    {
      sku: 'DKN-CAF-ESPR-20B',
      barcode: '619888001003',
      name: 'Machine à Café Espresso Barista 20 Bars avec Buse Vapeur',
      nameAr: 'ماكينة صنع القهوة اسبريسو بضغط 20 بار مع مبخر حليب',
      slug: 'machine-cafe-espresso-barista-20-bars',
      description: 'Machine espresso automatique à haute pression 20 bars avec technologie thermo-block de chauffe rapide en 35 secondes. Double porte-filtre pour 1 ou 2 tasses, buse vapeur pivotante pour cappuccino crémeux et plateau chauffe-tasses supérieur.',
      shortDescription: 'Pression 20 bars, thermoblock rapide, buse mousse de lait inox, plateau chauffe-tasses.',
      categoryId: catMap['petit-electromenager'].id,
      brandId: brandMap['delonghi'].id,
      supplierId: supplierMap['SUP-DME-02'].id,
      basePrice: 249.00,
      sellingPrice: 249.00,
      discountPrice: 199.00,
      status: ProductStatus.ACTIVE,
      isFeatured: true,
      variants: [
        { sku: 'DKN-CAF-ESPR-20B-INOX', name: 'Corps Acier Inoxydable', price: 199.00, attrs: { pressure: '20 Bars', material: 'Inox & ABS' }, stockCentral: 50, stockLac2: 20 },
      ],
      images: [
        { url: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?q=80&w=800&auto=format&fit=crop', alt: 'Machine à café espresso', isPrimary: true },
      ],
    },
    {
      sku: 'DKN-FOUR-ENC-70L',
      barcode: '619888001004',
      name: 'Four Électrique Encastrable 70L Chaleur Tournante Pyrolyse',
      nameAr: 'فرن كهربائي مدمج سعة 70 لتر بنظام تنظيف ذاتي وحرارة دوارة',
      slug: 'four-electrique-encastrable-70l-pyrolyse',
      description: 'Four encastrable grande capacité 70L avec système de nettoyage pyrolytique à 500°C qui détruit graisses et résidus. Chaleur tournante 3D pulsée pour une cuisson homogène sur 3 niveaux. Porte froide quadruple vitrage pour une sécurité totale des enfants.',
      shortDescription: 'Cavité XXL 70L, pyrolyse intégrée, chaleur tournante 3D, porte froide 4 vitres.',
      categoryId: catMap['gros-electromenager'].id,
      brandId: brandMap['bosch'].id,
      supplierId: supplierMap['SUP-CTE-01'].id,
      basePrice: 890.00,
      sellingPrice: 890.00,
      discountPrice: 779.00,
      status: ProductStatus.ACTIVE,
      isFeatured: true,
      variants: [
        { sku: 'DKN-FOUR-ENC-70L-INOX', name: 'Inox Anti-trace & Verre Noir', price: 779.00, attrs: { capacity: '70L', cleaning: 'Pyrolyse', energy: 'Classe A+' }, stockCentral: 16, stockLac2: 5 },
      ],
      images: [
        { url: 'https://images.unsplash.com/photo-1590794056226-79ef3a8147e1?q=80&w=800&auto=format&fit=crop', alt: 'Four encastrable Bosch', isPrimary: true },
      ],
    },
    {
      sku: 'DKN-HACH-2L-500',
      barcode: '619888001005',
      name: 'Hachoir Électrique Viande & Légumes Bol Verre 2L — 500W',
      nameAr: 'فرامة كهربائية للحوم والخضار بوعاء زجاجي 2 لتر 500 واط',
      slug: 'hachoir-electrique-viande-legumes-2l',
      description: 'Hachoir universel avec bol en verre trempé hygiénique résistant aux chocs thermiques. 4 lames bi-niveaux en acier inoxydable trempé pour hacher viande, persil, oignons, noix et épices en quelques secondes.',
      shortDescription: 'Bol verre 2L, 4 lames bi-niveaux inox, 500W puissance, 2 vitesses.',
      categoryId: catMap['petit-electromenager'].id,
      brandId: brandMap['tefal'].id,
      supplierId: supplierMap['SUP-ATM-03'].id,
      basePrice: 119.00,
      sellingPrice: 119.00,
      discountPrice: 89.00,
      status: ProductStatus.ACTIVE,
      isFeatured: true,
      variants: [
        { sku: 'DKN-HACH-2L-500-GLAS', name: 'Bol Verre 2 Litres', price: 89.00, attrs: { capacity: '2L', power: '500W', bowl: 'Verre trempé' }, stockCentral: 80, stockLac2: 30 },
      ],
      images: [
        { url: 'https://images.unsplash.com/photo-1588854337236-6889d631faa8?q=80&w=800&auto=format&fit=crop', alt: 'Hachoir électrique verre 2L', isPrimary: true },
      ],
    },
    {
      sku: 'DKN-BAT-GRAN-9P',
      barcode: '619888001006',
      name: 'Batterie de Cuisine 9 Pièces Granit Anti-adhésif Induction',
      nameAr: 'طقم أواني طهي 9 قطع من الجرانيت المقاوم للالتصاق',
      slug: 'batterie-cuisine-9-pieces-granit-induction',
      description: 'Ensemble complet comprenant 3 faitouts (20, 24, 28cm) avec couvercles en verre trempé, 1 poêle à frire 26cm, 1 casserole 18cm et 2 maniques thermo-isolantes. Revêtement en pierre de granit sans PFOA ultra-résistant.',
      shortDescription: 'Revêtement granit 5 couches sans PFOA, triple fond induction, poignées ergonomiques.',
      categoryId: catMap['cuisine-et-preparation'].id,
      brandId: brandMap['tefal'].id,
      supplierId: supplierMap['SUP-DME-02'].id,
      basePrice: 380.00,
      sellingPrice: 380.00,
      discountPrice: 299.00,
      status: ProductStatus.ACTIVE,
      isFeatured: true,
      variants: [
        { sku: 'DKN-BAT-GRAN-9P-GRY', name: 'Gris Granit Marbré', price: 299.00, attrs: { color: 'Gris Marbré', pieces: '9 pièces', compatibility: 'Tous feux + Induction' }, stockCentral: 35, stockLac2: 12 },
        { sku: 'DKN-BAT-GRAN-9P-BLK', name: 'Noir Granit Volcanique', price: 299.00, attrs: { color: 'Noir Volcanique', pieces: '9 pièces', compatibility: 'Tous feux + Induction' }, stockCentral: 25, stockLac2: 10 },
      ],
      images: [
        { url: 'https://images.unsplash.com/photo-1594998893017-36147cbcae05?q=80&w=800&auto=format&fit=crop', alt: 'Batterie cuisine granit 9 pièces', isPrimary: true },
      ],
    },
    {
      sku: 'DKN-ASP-CYC-2000',
      barcode: '619888001007',
      name: 'Aspirateur Traîneau Multicyclonique Sans Sac 2000W',
      nameAr: 'مكنسة كهربائية بدون كيس بنظام الفلترة الإعصارية 2000 واط',
      slug: 'aspirateur-traineau-cyclonique-sans-sac-2000w',
      description: 'Aspirateur puissant à filtration multicyclonique haute efficacité avec bac à poussière 2.5L vidable d’un seul clic. Filtre HEPA 13 lavable capturant 99.9% des allergènes et microparticules.',
      shortDescription: 'Puissance 2000W, filtration HEPA 13 anti-allergène, bac 2.5L sans sac.',
      categoryId: catMap['maison-et-entretien'].id,
      brandId: brandMap['tefal'].id,
      supplierId: supplierMap['SUP-CTE-01'].id,
      basePrice: 260.00,
      sellingPrice: 260.00,
      discountPrice: 219.00,
      status: ProductStatus.ACTIVE,
      isFeatured: false,
      variants: [
        { sku: 'DKN-ASP-CYC-2000-RED', name: 'Rouge & Noir Cyclonique', price: 219.00, attrs: { power: '2000W', capacity: '2.5L', filter: 'HEPA 13' }, stockCentral: 40, stockLac2: 15 },
      ],
      images: [
        { url: 'https://images.unsplash.com/photo-1558317374-067fb5f30001?q=80&w=800&auto=format&fit=crop', alt: 'Aspirateur sans sac', isPrimary: true },
      ],
    },
    {
      sku: 'DKN-CUIS-60-INOX',
      barcode: '619888001008',
      name: 'Cuisinière Tout Inox 60x60 — 4 Feux Gaz Sécurité Thermocouple',
      nameAr: 'طباخ غاز كامل من الفولاذ المقاوم للصدأ 60×60 بأربعة عيون ونظام أمان',
      slug: 'cuisiniere-tout-inox-60x60-4-feux-gaz',
      description: 'Cuisinière 60x60 tout inox de qualité professionnelle. Table de cuisson 4 brûleurs gaz haute performance avec grilles en fonte émaillée et sécurité thermocouple coupe-gaz automatique. Four gaz avec tournebroche et éclairage intérieur.',
      shortDescription: 'Dimension 60x60, 4 brûleurs gaz, sécurité thermocouple, tournebroche intégré.',
      categoryId: catMap['gros-electromenager'].id,
      brandId: brandMap['beko'].id,
      supplierId: supplierMap['SUP-ATM-03'].id,
      basePrice: 790.00,
      sellingPrice: 790.00,
      discountPrice: 699.00,
      status: ProductStatus.ACTIVE,
      isFeatured: true,
      variants: [
        { sku: 'DKN-CUIS-60-INOX-STD', name: 'Modèle Inox Standard 60x60', price: 699.00, attrs: { size: '60x60cm', finish: 'Inox', security: 'Thermocouple' }, stockCentral: 12, stockLac2: 4 },
      ],
      images: [
        { url: 'https://images.unsplash.com/photo-1590794056226-79ef3a8147e1?q=80&w=800&auto=format&fit=crop', alt: 'Cuisinière tout inox Beko', isPrimary: true },
      ],
    },
  ];

  for (const p of productsToSeed) {
    const prod = await prisma.product.upsert({
      where: { slug: p.slug },
      update: {
        name: p.name,
        nameAr: p.nameAr,
        description: p.description,
        shortDescription: p.shortDescription,
        basePrice: p.basePrice,
        sellingPrice: p.sellingPrice,
        discountPrice: p.discountPrice,
        status: p.status,
        isFeatured: p.isFeatured,
      },
      create: {
        sku: p.sku,
        barcode: p.barcode,
        name: p.name,
        nameAr: p.nameAr,
        slug: p.slug,
        description: p.description,
        shortDescription: p.shortDescription,
        categoryId: p.categoryId,
        brandId: p.brandId,
        supplierId: p.supplierId,
        basePrice: p.basePrice,
        sellingPrice: p.sellingPrice,
        discountPrice: p.discountPrice,
        status: p.status,
        isFeatured: p.isFeatured,
        publishedAt: new Date(),
      },
    });

    // Images
    for (let idx = 0; idx < p.images.length; idx++) {
      const img = p.images[idx];
      const existing = await prisma.productImage.findFirst({
        where: { productId: prod.id, url: img.url },
      });
      if (!existing) {
        await prisma.productImage.create({
          data: {
            productId: prod.id,
            url: img.url,
            alt: img.alt,
            isPrimary: img.isPrimary,
            sortOrder: idx,
          },
        });
      }
    }

    // Variants and stock in both warehouses
    for (const v of p.variants) {
      const variant = await prisma.productVariant.upsert({
        where: { sku: v.sku },
        update: {
          name: v.name,
          sellingPrice: v.price,
          attributesJson: v.attrs,
        },
        create: {
          productId: prod.id,
          sku: v.sku,
          name: v.name,
          sellingPrice: v.price,
          attributesJson: v.attrs,
        },
      });

      // Stock Central
      await prisma.stock.upsert({
        where: { variantId_warehouseId: { variantId: variant.id, warehouseId: whCentral.id } },
        update: { physicalQty: v.stockCentral },
        create: {
          variantId: variant.id,
          warehouseId: whCentral.id,
          physicalQty: v.stockCentral,
          reorderPoint: 5,
        },
      });

      // Stock Lac 2
      await prisma.stock.upsert({
        where: { variantId_warehouseId: { variantId: variant.id, warehouseId: whLac2.id } },
        update: { physicalQty: v.stockLac2 },
        create: {
          variantId: variant.id,
          warehouseId: whLac2.id,
          physicalQty: v.stockLac2,
          reorderPoint: 3,
        },
      });
    }
  }

  console.log(`✅ Seeded ${productsToSeed.length} Dokani Electroménager products with variants and stocks!`);
}

// Standalone execution if called directly
if (require.main === module) {
  seedDokaniCatalog()
    .catch((e) => {
      console.error('Error seeding dokani catalog:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
