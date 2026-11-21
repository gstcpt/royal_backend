import { PrismaClient, ProductStatus, OrderStatus, OrderChannel, PaymentMethod, PaymentStatus, StockMovementType, ReviewStatus } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting Comprehensive Full Catalog Seeding for Royal...');

  // 1. Roles & Permissions (Ensure existing)
  const rootRole = await prisma.role.findUniqueOrThrow({ where: { name: 'ROOT' } });
  const clientRole = await prisma.role.findUniqueOrThrow({ where: { name: 'CLIENT' } });

  // 2. Ensure Warehouses exist
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

  // 3. Categories
  const categoriesData = [
    {
      name: 'Batterie de Cuisine',
      nameAr: 'أواني وتجهيزات الطبخ',
      slug: 'batterie-de-cuisine',
      description: 'Cocottes en fonte émaillée, poêles en inox multi-ply, casseroles et sauteuses de haute gastronomie.',
      descriptionAr: 'قدور من الحديد الزهر، مقالي ومقالي من الفولاذ المقاوم للصدأ للطهي الراقي.',
      imageUrl: '/images/categories/cookware.jpg',
      sortOrder: 1,
      isActive: true,
    },
    {
      name: 'Coutellerie Haute Précision',
      nameAr: 'سكاكين وأدوات القطع الدقيقة',
      slug: 'coutellerie-haute-precision',
      description: 'Couteaux de chef japonais, acier damas 67 couches, santoku et sets de découpe professionnels.',
      descriptionAr: 'سكاكين طهاة يابانية، فولاذ دمشقي 67 طبقة وسكاكين تقطيع احترافية.',
      imageUrl: '/images/categories/knives.jpg',
      sortOrder: 2,
      isActive: true,
    },
    {
      name: 'Art de la Table',
      nameAr: 'فن وأدوات المائدة الفاخرة',
      slug: 'art-de-la-table',
      description: 'Ménagères d’exception, carafes à décanter, moulins artisanaux et vaisselle prestigieuse.',
      descriptionAr: 'أطقم ملاعق وشوك راقية، أباريق ومطاحن يدوية وأواني ضيافة فاخرة.',
      imageUrl: '/images/categories/tableware.jpg',
      sortOrder: 3,
      isActive: true,
    },
    {
      name: 'Accessoires de Chef',
      nameAr: 'ملحقات وأدوات الشيف',
      slug: 'accessoires-de-chef',
      description: 'Mandolines de précision, mortiers en granit, thermomètres laser et pinces de dressage.',
      descriptionAr: 'فرامات وموازين وملاقط تزيين الأطباق لخبراء الطبخ.',
      imageUrl: '/images/categories/accessories.jpg',
      sortOrder: 4,
      isActive: true,
    },
    {
      name: 'Électroménager Culinaire',
      nameAr: 'الأجهزة الكهرومنزلية للطهي',
      slug: 'electromenager-culinaire',
      description: 'Robots pâtissiers multifonctions, mélangeurs thermiques et mixeurs plongeants professionnels.',
      descriptionAr: 'عجانات وخلاطات احترافية لإعداد الحلويات والمأكولات الراقية.',
      imageUrl: '/images/categories/appliances.jpg',
      sortOrder: 5,
      isActive: true,
    },
    {
      name: 'Pâtisserie & Boulangerie',
      nameAr: 'مستلزمات الحلويات والمخبوزات',
      slug: 'patisserie-boulangerie',
      description: 'Moules en silicone platine, cercles à entremets et rouleaux en marbre.',
      descriptionAr: 'قوالب سيليكون وأدوات تشكيل الحلويات والخبز الراقي.',
      imageUrl: '/images/categories/pastry.jpg',
      sortOrder: 6,
      isActive: true,
    },
  ];

  const categories: Record<string, any> = {};
  for (const cat of categoriesData) {
    const c = await prisma.category.upsert({
      where: { slug: cat.slug },
      update: cat,
      create: cat,
    });
    categories[cat.slug] = c;
  }
  console.log(`✅ ${Object.keys(categories).length} Categories seeded.`);

  // 4. Brands
  const brandsData = [
    { name: 'Le Creuset', slug: 'le-creuset', description: 'Manufacture française de fonte émaillée depuis 1925.', website: 'https://www.lecreuset.com' },
    { name: 'Zwilling J.A. Henckels', slug: 'zwilling', description: 'Coutellerie de Solingen alliant tradition et aciers d’exception.', website: 'https://www.zwilling.com' },
    { name: 'Staub', slug: 'staub', description: 'L’excellence alsacienne de la cocotte en fonte noire et céramique.', website: 'https://www.staub-online.com' },
    { name: 'De Buyer', slug: 'de-buyer', description: 'Ustensiles professionnels de cuisson créés dans les Vosges.', website: 'https://www.debuyer.com' },
    { name: 'WMF', slug: 'wmf', description: 'Ingénierie allemande pour la préparation culinaire et le service.', website: 'https://www.wmf.com' },
    { name: 'Christofle Paris', slug: 'christofle', description: 'Orfèvrerie de prestige et art de la table de haute couture.', website: 'https://www.christofle.com' },
  ];

  const brands: Record<string, any> = {};
  for (const b of brandsData) {
    const record = await prisma.brand.upsert({
      where: { slug: b.slug },
      update: b,
      create: b,
    });
    brands[b.slug] = record;
  }
  console.log(`✅ ${Object.keys(brands).length} Brands seeded.`);

  // 5. Suppliers
  const suppliersData = [
    { name: "Manufacture Européenne d'Orfèvrerie & Fonte", code: 'SUP-MEOF-01', email: 'contact@meof-distribution.eu', country: 'FR' },
    { name: 'Solingen Cutlery Import', code: 'SUP-SOLINGEN-02', email: 'sales@solingen-export.de', country: 'DE' },
    { name: 'Comptoir Gastronomique Méditerranéen', code: 'SUP-CGM-TN', email: 'direction@cgm.tn', country: 'TN' },
  ];

  const suppliers: Record<string, any> = {};
  for (const s of suppliersData) {
    const record = await prisma.supplier.upsert({
      where: { code: s.code },
      update: s,
      create: s,
    });
    suppliers[s.code] = record;
  }
  console.log(`✅ ${Object.keys(suppliers).length} Suppliers seeded.`);

  // 6. Products, Variants, Images & Stocks
  const productsData = [
    {
      sku: 'FLR-COC-28',
      barcode: '6191234560011',
      name: 'Cocotte Ronde en Fonte Émaillée Signature 28cm',
      nameAr: 'قدر طهي دائري من الحديد الزهر المطلي 28 سم',
      slug: 'cocotte-ronde-fonte-emaillee-signature-28cm',
      description: 'La cocotte iconique indispensable pour mijoter, rôtir et braiser. Émail résistant aux chocs et rétention thermique d’exception.',
      shortDescription: 'Fonte émaillée haut de gamme, compatible tous feux y compris induction.',
      categoryId: categories['batterie-de-cuisine'].id,
      brandId: brands['le-creuset'].id,
      supplierId: suppliers['SUP-MEOF-01'].id,
      basePrice: 480.00,
      sellingPrice: 480.00,
      status: ProductStatus.ACTIVE,
      isFeatured: true,
      variants: [
        { sku: 'FLR-COC-28-RED', name: 'Cerise Rouge 28cm (6.7L)', price: 480.00, attrs: { color: 'Rouge Cerise', size: '28cm', volume: '6.7L' }, stockCentral: 35, stockMarsa: 12 },
        { sku: 'FLR-COC-28-BLU', name: 'Bleu Marseille 28cm (6.7L)', price: 480.00, attrs: { color: 'Bleu Marseille', size: '28cm', volume: '6.7L' }, stockCentral: 28, stockMarsa: 8 },
        { sku: 'FLR-COC-28-BLK', name: 'Noir Satin Mat 28cm (6.7L)', price: 495.00, attrs: { color: 'Noir Satin', size: '28cm', volume: '6.7L' }, stockCentral: 20, stockMarsa: 6 },
      ],
      images: [
        { url: 'https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?q=80&w=800&auto=format&fit=crop', alt: 'Cocotte fonte émaillée rouge', isPrimary: true },
        { url: 'https://images.unsplash.com/photo-1544025162-d76694265947?q=80&w=800&auto=format&fit=crop', alt: 'Cocotte en situation de cuisson', isPrimary: false },
      ],
    },
    {
      sku: 'FLR-SAN-18',
      barcode: '6191234560028',
      name: 'Couteau Santoku Damas 67 Couches 18cm',
      nameAr: 'سكين سانتوكو من الفولاذ الدمشقي 67 طبقة 18 سم',
      slug: 'couteau-santoku-damas-67-couches-18cm',
      description: 'Lame forgée en acier damas japonais VG-10 avec 67 couches martelées. Tranchant rasoir affûté à la main selon la méthode Honbazuke.',
      shortDescription: 'Couteau polyvalent japonais d’une précision chirurgicale.',
      categoryId: categories['coutellerie-haute-precision'].id,
      brandId: brands['zwilling'].id,
      supplierId: suppliers['SUP-SOLINGEN-02'].id,
      basePrice: 320.00,
      sellingPrice: 320.00,
      status: ProductStatus.ACTIVE,
      isFeatured: true,
      variants: [
        { sku: 'FLR-SAN-18-MIC', name: 'Manche Micarta Noir 18cm', price: 320.00, attrs: { handle: 'Micarta Noir', length: '18cm', steel: 'VG-10 Damas' }, stockCentral: 40, stockMarsa: 15 },
        { sku: 'FLR-SAN-18-PAK', name: 'Manche Pakkawood Ébène 18cm', price: 345.00, attrs: { handle: 'Pakkawood Ébène', length: '18cm', steel: 'VG-10 Damas' }, stockCentral: 25, stockMarsa: 10 },
      ],
      images: [
        { url: 'https://images.unsplash.com/photo-1593618998160-e34014e67546?q=80&w=800&auto=format&fit=crop', alt: 'Couteau santoku damas 67 couches', isPrimary: true },
        { url: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?q=80&w=800&auto=format&fit=crop', alt: 'Détail lame damassée', isPrimary: false },
      ],
    },
    {
      sku: 'FLR-POE-24',
      barcode: '6191234560035',
      name: 'Poêle Ronde Inox Multi-Ply Pro 24cm',
      nameAr: 'مقلاة دائرية من الفولاذ المقاوم للصدأ 24 سم',
      slug: 'poele-ronde-inox-multi-ply-pro-24cm',
      description: 'Structure 5 couches inox et aluminium conducteur. Saisie parfaite des viandes et dorure homogène sans revêtement nocif.',
      shortDescription: 'Inox 18/10 multicouche inusable garanti à vie.',
      categoryId: categories['batterie-de-cuisine'].id,
      brandId: brands['de-buyer'].id,
      supplierId: suppliers['SUP-MEOF-01'].id,
      basePrice: 195.00,
      sellingPrice: 195.00,
      status: ProductStatus.ACTIVE,
      isFeatured: true,
      variants: [
        { sku: 'FLR-POE-24-STD', name: 'Diamètre 24cm', price: 195.00, attrs: { diameter: '24cm', material: 'Inox 5-Ply' }, stockCentral: 50, stockMarsa: 20 },
        { sku: 'FLR-POE-28-STD', name: 'Diamètre 28cm', price: 235.00, attrs: { diameter: '28cm', material: 'Inox 5-Ply' }, stockCentral: 40, stockMarsa: 16 },
      ],
      images: [
        { url: 'https://images.unsplash.com/photo-1584990347449-3a31c5cf14e7?q=80&w=800&auto=format&fit=crop', alt: 'Poêle ronde inox multi-ply', isPrimary: true },
      ],
    },
    {
      sku: 'FLR-MEN-24',
      barcode: '6191234560042',
      name: 'Ménagère 24 Pièces Argent & Inox Miroir',
      nameAr: 'طقم ملاعق وسكاكين فضية ومعدنية 24 قطعة',
      slug: 'menagere-24-pieces-argent-inox-miroir',
      description: 'Service de table complet pour 6 personnes. Lignes épurées, équilibre parfait en main et éclat durable digne des plus grands palaces.',
      shortDescription: 'Service de haute orfèvrerie parisienne pour 6 convives.',
      categoryId: categories['art-de-la-table'].id,
      brandId: brands['christofle'].id,
      supplierId: suppliers['SUP-MEOF-01'].id,
      basePrice: 680.00,
      sellingPrice: 680.00,
      status: ProductStatus.ACTIVE,
      isFeatured: true,
      variants: [
        { sku: 'FLR-MEN-24-MIR', name: 'Finition Miroir Brillant', price: 680.00, attrs: { finish: 'Poli Miroir', pieces: '24 pcs', guests: '6 personnes' }, stockCentral: 18, stockMarsa: 7 },
        { sku: 'FLR-MEN-24-SAT', name: 'Finition Brossé Satiné', price: 720.00, attrs: { finish: 'Brossé Satiné', pieces: '24 pcs', guests: '6 personnes' }, stockCentral: 12, stockMarsa: 5 },
      ],
      images: [
        { url: 'https://images.unsplash.com/photo-1577140917170-285929fb55b7?q=80&w=800&auto=format&fit=crop', alt: 'Ménagère de prestige', isPrimary: true },
      ],
    },
    {
      sku: 'FLR-STA-31',
      barcode: '6191234560059',
      name: 'Cocotte Ovale en Fonte Staub 31cm Grenadine',
      nameAr: 'قدر بيضاوي من الحديد الزهر ستوب 31 سم',
      slug: 'cocotte-ovale-fonte-staub-31cm-grenadine',
      description: 'Couvercle à picots breveté pour un arrosage continu des viandes. Émail majolique intense couleur grenadine.',
      shortDescription: 'L’incontournable des rôtis et volailles du chef étoilé.',
      categoryId: categories['batterie-de-cuisine'].id,
      brandId: brands['staub'].id,
      supplierId: suppliers['SUP-MEOF-01'].id,
      basePrice: 520.00,
      sellingPrice: 520.00,
      status: ProductStatus.ACTIVE,
      isFeatured: false,
      variants: [
        { sku: 'FLR-STA-31-GRE', name: 'Grenadine Majolique 31cm (5.5L)', price: 520.00, attrs: { color: 'Grenadine Majolique', size: '31cm' }, stockCentral: 22, stockMarsa: 9 },
        { sku: 'FLR-STA-31-BLK', name: 'Noir Fonte Brute 31cm (5.5L)', price: 490.00, attrs: { color: 'Noir Fonte', size: '31cm' }, stockCentral: 30, stockMarsa: 11 },
      ],
      images: [
        { url: 'https://images.unsplash.com/photo-1544025162-d76694265947?q=80&w=800&auto=format&fit=crop', alt: 'Cocotte Staub ovale', isPrimary: true },
      ],
    },
    {
      sku: 'FLR-BLOC-7',
      barcode: '6191234560066',
      name: 'Bloc de 7 Couteaux Japonais Fourreau Bambou',
      nameAr: 'كتلة تضم 7 سكاكين يابانية مع غلاف من الخيزران',
      slug: 'bloc-7-couteaux-japonais-fourreau-bambou',
      description: 'Ensemble maître comprenant couteau de chef, santoku, couteau à pain, utilitaire, couteau d’office et ciseaux de chef.',
      shortDescription: 'L’arsenal complet du gastronome dans un bloc bambou aimanté.',
      categoryId: categories['coutellerie-haute-precision'].id,
      brandId: brands['zwilling'].id,
      supplierId: suppliers['SUP-SOLINGEN-02'].id,
      basePrice: 890.00,
      sellingPrice: 890.00,
      status: ProductStatus.ACTIVE,
      isFeatured: true,
      variants: [
        { sku: 'FLR-BLOC-7-BAM', name: 'Bloc 7 Pièces Bambou Naturel', price: 890.00, attrs: { pieces: '7 pièces', material: 'Bambou & Acier Cryodur' }, stockCentral: 15, stockMarsa: 6 },
      ],
      images: [
        { url: 'https://images.unsplash.com/photo-1593618998160-e34014e67546?q=80&w=800&auto=format&fit=crop', alt: 'Bloc couteaux', isPrimary: true },
      ],
    },
    {
      sku: 'FLR-MOU-OLI',
      barcode: '6191234560073',
      name: 'Duo Moulins à Poivre & Sel Bois d’Olivier 22cm',
      nameAr: 'طقم مطاحن ملح وفلفل من خشب الزيتون 22 سم',
      slug: 'duo-moulins-poivre-sel-bois-olivier-22cm',
      description: 'Mécanisme en céramique inaltérable garanti 25 ans. Bois d’olivier tunisien noble façonné artisanalement.',
      shortDescription: 'Élégance naturelle et mouture réglable de ultra-fine à concassée.',
      categoryId: categories['art-de-la-table'].id,
      brandId: brands['de-buyer'].id,
      supplierId: suppliers['SUP-CGM-TN'].id,
      basePrice: 110.00,
      sellingPrice: 110.00,
      status: ProductStatus.ACTIVE,
      isFeatured: false,
      variants: [
        { sku: 'FLR-MOU-OLI-22', name: 'Duo 22cm Poivre & Sel', price: 110.00, attrs: { wood: 'Olivier Massif', height: '22cm' }, stockCentral: 60, stockMarsa: 24 },
      ],
      images: [
        { url: 'https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?q=80&w=800&auto=format&fit=crop', alt: 'Moulins bois olivier', isPrimary: true },
      ],
    },
    {
      sku: 'FLR-MAN-JAP',
      barcode: '6191234560080',
      name: 'Mandoline Professionnelle Japonaise Inox V-Blade',
      nameAr: 'فرامة يابانية احترافية بشفرة على شكل V',
      slug: 'mandoline-professionnelle-japonaise-inox-v-blade',
      description: 'Lames interchangeables en acier trempé pour juliennes, tagliatelles de légumes et tranches translucides de 0.5 à 9mm.',
      shortDescription: 'Découpe ultra-rapide et sécurisée avec chariot poussoir ergonomique.',
      categoryId: categories['accessoires-de-chef'].id,
      brandId: brands['de-buyer'].id,
      supplierId: suppliers['SUP-MEOF-01'].id,
      basePrice: 165.00,
      sellingPrice: 165.00,
      status: ProductStatus.ACTIVE,
      isFeatured: false,
      variants: [
        { sku: 'FLR-MAN-JAP-V', name: 'Mandoline V-Blade Pro Inox', price: 165.00, attrs: { blade: 'V-Blade', thickness: '0.5-9mm' }, stockCentral: 45, stockMarsa: 18 },
      ],
      images: [
        { url: 'https://images.unsplash.com/photo-1584990347449-3a31c5cf14e7?q=80&w=800&auto=format&fit=crop', alt: 'Mandoline de chef', isPrimary: true },
      ],
    },
    {
      sku: 'FLR-ROB-WMF',
      barcode: '6191234560097',
      name: 'Robot Pâtissier Multifonction Cuve Inox 5L',
      nameAr: 'عجانة ومحضرة حلويات متعددة الوظائف 5 لتر',
      slug: 'robot-patissier-multifonction-cuve-inox-5l',
      description: 'Mouvement planétaire puissant de 1200W avec cuve inox brossé 5L, fouet ballon, crochet pétrisseur et batteur plat.',
      shortDescription: 'Pour des pâtes parfaites, meringues aériennes et brioches dorées.',
      categoryId: categories['electromenager-culinaire'].id,
      brandId: brands['wmf'].id,
      supplierId: suppliers['SUP-SOLINGEN-02'].id,
      basePrice: 1250.00,
      sellingPrice: 1250.00,
      status: ProductStatus.ACTIVE,
      isFeatured: true,
      variants: [
        { sku: 'FLR-ROB-WMF-SIL', name: 'Argent Cromargan 5L', price: 1250.00, attrs: { color: 'Cromargan Brossé', capacity: '5L', power: '1200W' }, stockCentral: 14, stockMarsa: 4 },
      ],
      images: [
        { url: 'https://images.unsplash.com/photo-1544025162-d76694265947?q=80&w=800&auto=format&fit=crop', alt: 'Robot pâtissier WMF', isPrimary: true },
      ],
    },
    {
      sku: 'FLR-PLA-CER',
      barcode: '6191234560103',
      name: 'Plat à Four Rectangulaire en Céramique Grand Cru',
      nameAr: 'طبق فرن مستطيل من السيراميك الفاخر',
      slug: 'plat-four-rectangulaire-ceramique-grand-cru',
      description: 'Céramique haute résistance thermique supportant de -20°C à +300°C. Émail lisse antiadhésif facile à nettoyer.',
      shortDescription: 'Idéal pour gratins dorés, lasagnes généreuses et crumbles fondants.',
      categoryId: categories['batterie-de-cuisine'].id,
      brandId: brands['staub'].id,
      supplierId: suppliers['SUP-MEOF-01'].id,
      basePrice: 145.00,
      sellingPrice: 145.00,
      status: ProductStatus.ACTIVE,
      isFeatured: false,
      variants: [
        { sku: 'FLR-PLA-CER-BLU', name: 'Bleu Océan 34x24cm', price: 145.00, attrs: { color: 'Bleu Océan', size: '34x24cm' }, stockCentral: 32, stockMarsa: 14 },
      ],
      images: [
        { url: 'https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?q=80&w=800&auto=format&fit=crop', alt: 'Plat à four céramique', isPrimary: true },
      ],
    },
    {
      sku: 'FLR-CAR-CRI',
      barcode: '6191234560110',
      name: 'Carafe à Décanter Cristal Soufflé Bouche 1.5L',
      nameAr: 'إبريق لترويق المشروبات من الكريستال المنفوخ يدويا 1.5 لتر',
      slug: 'carafe-a-decanter-cristal-souffle-bouche-1-5l',
      description: 'Aération optimale des grands crus grâce à sa base large et son col effilé. Réalisée artisanalement par nos maîtres verriers.',
      shortDescription: 'Sublimez vos tables de fête avec une pièce maîtresse en cristal pur.',
      categoryId: categories['art-de-la-table'].id,
      brandId: brands['christofle'].id,
      supplierId: suppliers['SUP-MEOF-01'].id,
      basePrice: 260.00,
      sellingPrice: 260.00,
      status: ProductStatus.ACTIVE,
      isFeatured: true,
      variants: [
        { sku: 'FLR-CAR-CRI-15', name: 'Cristal Pur 1.5L', price: 260.00, attrs: { material: 'Cristal sans plomb', capacity: '1.5L' }, stockCentral: 25, stockMarsa: 10 },
      ],
      images: [
        { url: 'https://images.unsplash.com/photo-1577140917170-285929fb55b7?q=80&w=800&auto=format&fit=crop', alt: 'Carafe à décanter cristal', isPrimary: true },
      ],
    },
    {
      sku: 'FLR-KIR-20',
      barcode: '6191234560127',
      name: 'Couteau de Chef Kiritsuke 20cm Acier VG-10',
      nameAr: 'سكين الشيف كيريتسوكي 20 سم فولاذ VG-10',
      slug: 'couteau-chef-kiritsuke-20cm-acier-vg10',
      description: 'Profil hybride entre santoku et yanagiba avec pointe biseautée inversée (k-tip). Réservé aux maîtres de cuisine exigeants.',
      shortDescription: 'Le symbole du statut de chef au Japon.',
      categoryId: categories['coutellerie-haute-precision'].id,
      brandId: brands['zwilling'].id,
      supplierId: suppliers['SUP-SOLINGEN-02'].id,
      basePrice: 395.00,
      sellingPrice: 395.00,
      status: ProductStatus.ACTIVE,
      isFeatured: true,
      variants: [
        { sku: 'FLR-KIR-20-ROZ', name: 'Manche Bois de Rose Octogonal 20cm', price: 395.00, attrs: { handle: 'Bois de Rose', length: '20cm' }, stockCentral: 20, stockMarsa: 7 },
      ],
      images: [
        { url: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?q=80&w=800&auto=format&fit=crop', alt: 'Couteau Kiritsuke', isPrimary: true },
      ],
    },
  ];

  const createdProducts: any[] = [];
  const createdVariants: any[] = [];

  for (const p of productsData) {
    const prod = await prisma.product.upsert({
      where: { slug: p.slug },
      update: {
        name: p.name,
        nameAr: p.nameAr,
        description: p.description,
        shortDescription: p.shortDescription,
        basePrice: p.basePrice,
        sellingPrice: p.sellingPrice,
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
        status: p.status,
        isFeatured: p.isFeatured,
        publishedAt: new Date(),
      },
    });

    createdProducts.push(prod);

    // Images
    for (let idx = 0; idx < p.images.length; idx++) {
      const img = p.images[idx];
      const existingImg = await prisma.productImage.findFirst({
        where: { productId: prod.id, url: img.url },
      });
      if (!existingImg) {
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

    // Variants & Stock
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
          isActive: true,
        },
      });

      createdVariants.push(variant);

      // Stock Central
      const stockC = await prisma.stock.upsert({
        where: {
          variantId_warehouseId: {
            variantId: variant.id,
            warehouseId: whCentral.id,
          },
        },
        update: { physicalQty: v.stockCentral },
        create: {
          variantId: variant.id,
          warehouseId: whCentral.id,
          physicalQty: v.stockCentral,
          reservedQty: 0,
        },
      });

      // Stock Marsa
      await prisma.stock.upsert({
        where: {
          variantId_warehouseId: {
            variantId: variant.id,
            warehouseId: whMarsa.id,
          },
        },
        update: { physicalQty: v.stockMarsa },
        create: {
          variantId: variant.id,
          warehouseId: whMarsa.id,
          physicalQty: v.stockMarsa,
          reservedQty: 0,
        },
      });

      // Stock Movement Log
      const existingMov = await prisma.stockMovement.findFirst({
        where: { stockId: stockC.id },
      });
      if (!existingMov) {
        await prisma.stockMovement.create({
          data: {
            stockId: stockC.id,
            type: StockMovementType.PURCHASE_IN,
            quantityDelta: v.stockCentral,
            quantityBefore: 0,
            quantityAfter: v.stockCentral,
            reason: 'Réception initiale de stock catalogue Royal',
            performedBy: 'System Root',
          },
        });
      }
    }
  }
  console.log(`✅ ${createdProducts.length} Products & ${createdVariants.length} Variants seeded with full stock.`);

  // 7. Customers & Addresses
  const customersData = [
    {
      email: 'client@royal.com.tn',
      firstName: 'Amira',
      lastName: 'Trabelsi',
      phone: '+216 98 123 456',
      street: '14 Avenue de la République',
      city: 'Tunis',
      postalCode: '1001',
    },
    {
      email: 'sami.bensalah@test.tn',
      firstName: 'Sami',
      lastName: 'Ben Salah',
      phone: '+216 98 234 567',
      street: '45 Rue Habib Bourguiba',
      city: 'La Marsa',
      postalCode: '2078',
    },
    {
      email: 'nadia.mansour@test.tn',
      firstName: 'Nadia',
      lastName: 'Mansour',
      phone: '+216 22 345 678',
      street: '8 Rue des Orangers',
      city: 'Carthage',
      postalCode: '2016',
    },
    {
      email: 'yassine.chahed@test.tn',
      firstName: 'Yassine',
      lastName: 'Chahed',
      phone: '+216 55 456 789',
      street: '22 Boulevard du 14 Janvier',
      city: 'Sousse',
      postalCode: '4000',
    },
  ];

  const createdCustomers: any[] = [];
  for (const c of customersData) {
    const cust = await prisma.customer.upsert({
      where: { email: c.email },
      update: {
        firstName: c.firstName,
        lastName: c.lastName,
        phone: c.phone,
      },
      create: {
        email: c.email,
        firstName: c.firstName,
        lastName: c.lastName,
        phone: c.phone,
      },
    });

    createdCustomers.push(cust);

    // Address
    const existingAddr = await prisma.address.findFirst({
      where: { customerId: cust.id },
    });
    if (!existingAddr) {
      await prisma.address.create({
        data: {
          customerId: cust.id,
          label: 'Domicile Principal',
          firstName: c.firstName,
          lastName: c.lastName,
          phone: c.phone,
          street: c.street,
          city: c.city,
          postalCode: c.postalCode,
          country: 'TN',
          isDefault: true,
        },
      });
    }
  }
  console.log(`✅ ${createdCustomers.length} Customers and Addresses seeded.`);

  // 8. Orders, Order Items & Payments
  const ordersSeed = [
    {
      ref: 'FLR-2026-00101',
      customer: createdCustomers[0], // Amira
      status: OrderStatus.DELIVERED,
      subtotal: 675.00,
      shipping: 0.00,
      total: 675.00,
      method: PaymentMethod.CARD_ONLINE,
      payStatus: PaymentStatus.COMPLETED,
      items: [
        { prod: createdProducts[0], var: createdVariants[0], qty: 1, price: 480.00 },
        { prod: createdProducts[2], var: createdVariants[4], qty: 1, price: 195.00 },
      ],
    },
    {
      ref: 'FLR-2026-00102',
      customer: createdCustomers[1], // Sami
      status: OrderStatus.SHIPPED,
      subtotal: 320.00,
      shipping: 7.00,
      total: 327.00,
      method: PaymentMethod.CASH_ON_DELIVERY,
      payStatus: PaymentStatus.PENDING,
      items: [
        { prod: createdProducts[1], var: createdVariants[3], qty: 1, price: 320.00 },
      ],
    },
    {
      ref: 'FLR-2026-00103',
      customer: createdCustomers[2], // Nadia
      status: OrderStatus.PROCESSING,
      subtotal: 1250.00,
      shipping: 0.00,
      total: 1250.00,
      method: PaymentMethod.CARD_ONLINE,
      payStatus: PaymentStatus.COMPLETED,
      items: [
        { prod: createdProducts[8], var: createdVariants[9], qty: 1, price: 1250.00 },
      ],
    },
    {
      ref: 'FLR-2026-00104',
      customer: createdCustomers[3], // Yassine
      status: OrderStatus.CONFIRMED,
      subtotal: 480.00,
      shipping: 7.00,
      total: 487.00,
      method: PaymentMethod.CARD_ONLINE,
      payStatus: PaymentStatus.COMPLETED,
      items: [
        { prod: createdProducts[0], var: createdVariants[1], qty: 1, price: 480.00 },
      ],
    },
  ];

  for (const o of ordersSeed) {
    const existingOrder = await prisma.order.findUnique({
      where: { reference: o.ref },
    });

    if (!existingOrder) {
      const order = await prisma.order.create({
        data: {
          reference: o.ref,
          customerId: o.customer.id,
          status: o.status,
          channel: OrderChannel.ONLINE,
          subtotalAmount: o.subtotal,
          taxAmount: Number((o.subtotal * 0.19).toFixed(2)),
          shippingAmount: o.shipping,
          totalAmount: o.total,
          currency: 'TND',
          confirmedAt: new Date(),
        },
      });

      // Items
      for (const item of o.items) {
        await prisma.orderItem.create({
          data: {
            orderId: order.id,
            productId: item.prod.id,
            variantId: item.var.id,
            productName: item.prod.name,
            variantName: item.var.name,
            sku: item.var.sku,
            unitPrice: item.price,
            taxRate: 0.19,
            quantity: item.qty,
            totalPrice: item.price * item.qty,
          },
        });
      }

      // Payment
      await prisma.payment.create({
        data: {
          orderId: order.id,
          amount: o.total,
          currency: 'TND',
          method: o.method,
          status: o.payStatus,
          provider: o.method === PaymentMethod.CARD_ONLINE ? 'ClicToPay' : 'Cash',
          idempotencyKey: `pay-${o.ref}-${Date.now()}`,
          paidAt: o.payStatus === PaymentStatus.COMPLETED ? new Date() : null,
        },
      });
    }
  }
  console.log(`✅ ${ordersSeed.length} Realistic Orders & Payments seeded.`);

  // 9. Customer Reviews
  const reviewsData = [
    {
      product: createdProducts[0], // Cocotte Le Creuset
      customer: createdCustomers[0], // Amira
      rating: 5,
      title: 'Une pièce maîtresse dans ma cuisine',
      body: 'Qualité exceptionnelle. La chaleur est diffusée uniformément et les viandes restent incomparablement moelleuses. La couleur rouge cerise est somptueuse.',
    },
    {
      product: createdProducts[1], // Santoku Zwilling
      customer: createdCustomers[1], // Sami
      rating: 5,
      title: 'Tranchant chirurgical remarquable',
      body: 'Lame damas d’une légèreté et d’un équilibre parfaits. Découpe les tomates et les filets sans aucune résistance.',
    },
    {
      product: createdProducts[2], // Poêle Inox De Buyer
      customer: createdCustomers[2], // Nadia
      rating: 5,
      title: 'Inox inusable de très haut niveau',
      body: 'Après culottage et bonne chauffe, rien n’accroche. Une qualité professionnelle vosgienne qui durera toute une vie.',
    },
  ];

  for (const r of reviewsData) {
    await prisma.review.upsert({
      where: {
        productId_customerId: {
          productId: r.product.id,
          customerId: r.customer.id,
        },
      },
      update: {
        rating: r.rating,
        title: r.title,
        body: r.body,
        status: ReviewStatus.APPROVED,
      },
      create: {
        productId: r.product.id,
        customerId: r.customer.id,
        rating: r.rating,
        title: r.title,
        body: r.body,
        status: ReviewStatus.APPROVED,
        isVerifiedPurchase: true,
      },
    });
  }
  console.log(`✅ ${reviewsData.length} Reviews seeded.`);

  console.log('🎉 Full database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
