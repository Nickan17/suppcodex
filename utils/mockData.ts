export const MOCK_PRODUCTS = [
  {
    id: '1',
    name: 'Ultra Strength Omega-3 Fish Oil Supplement',
    brand: 'NaturePlus',
    imageUrl: 'https://images.pexels.com/photos/6941883/pexels-photo-6941883.jpeg',
    score: 85,
    date: '2 days ago',
    _meta: { 
      status: 'success',
      remediation: 'none'
    },
    ingredients: 'Fish Oil Concentrate 1200mg (EPA 360mg, DHA 240mg), Gelatin, Glycerin, Water, Natural Lemon Flavor',
    supplement_facts: 'Serving Size: 1 Softgel, Servings Per Container: 90, Amount Per Serving: Fish Oil Concentrate 1200mg (EPA 360mg, DHA 240mg), Other Ingredients: Gelatin, Glycerin, Water, Natural Lemon Flavor',
  },
  {
    id: '2',
    name: 'Complete Multivitamin Daily Formula',
    brand: 'VitaCore',
    imageUrl: 'https://images.pexels.com/photos/3683074/pexels-photo-3683074.jpeg',
    score: 73,
    date: '3 days ago',
    _meta: { 
      status: 'parser_fail',
      remediation: 'manual review',
      parserSteps: [
        'Attempted to extract product name from title',
        'Failed to parse ingredient list due to malformed HTML',
        'Attempted OCR on product image',
        'Failed to match product against database'
      ]
    },
    ingredients: 'Vitamin A, Vitamin C, Vitamin D, Vitamin E, Vitamin K, Thiamin, Riboflavin, Niacin, Vitamin B6, Folate, Vitamin B12, Biotin, Pantothenic Acid, Calcium, Iron, Phosphorus, Iodine, Magnesium, Zinc, Selenium, Copper, Manganese, Chromium, Molybdenum, Potassium',
    supplement_facts: '',
  },
  {
    id: '3',
    name: 'Vitamin D3 5000 IU Immune Support',
    brand: 'PureNutrients',
    imageUrl: 'https://images.pexels.com/photos/6692132/pexels-photo-6692132.jpeg',
    score: 92,
    date: '1 week ago',
    _meta: { 
      status: 'success',
      remediation: 'none'
    },
    ingredients: 'Vitamin D3 (as Cholecalciferol) 5000 IU, Olive Oil, Gelatin, Glycerin, Purified Water',
    supplement_facts: 'Serving Size: 1 Softgel, Servings Per Container: 360, Amount Per Serving: Vitamin D3 (as Cholecalciferol) 5000 IU (125 mcg) 625% DV, Other Ingredients: Olive Oil, Gelatin, Glycerin, Purified Water',
  },
  {
    id: '4',
    name: 'Magnesium Glycinate Complex',
    brand: 'OptimumHealth',
    imageUrl: 'https://images.pexels.com/photos/5856020/pexels-photo-5856020.jpeg',
    score: 45,
    date: '2 weeks ago',
    _meta: { 
      status: 'blocked_by_site',
      remediation: 'try different source'
    },
    ingredients: 'Magnesium (as Magnesium Glycinate) 400mg',
    supplement_facts: '',
  },
  {
    id: '5',
    name: 'Probiotic 50 Billion CFU Formula',
    brand: 'GutBalance',
    imageUrl: 'https://images.pexels.com/photos/5699514/pexels-photo-5699514.jpeg',
    score: 67,
    date: '3 weeks ago',
    _meta: { 
      status: 'manual',
      remediation: 'needs verification'
    },
    ingredients: 'Proprietary Probiotic Blend 50 Billion CFU (Lactobacillus acidophilus, Bifidobacterium lactis, Lactobacillus plantarum, Lactobacillus paracasei, Bifidobacterium longum), Vegetable Cellulose Capsule, Microcrystalline Cellulose, Magnesium Stearate',
    supplement_facts: 'Serving Size: 1 Capsule, Servings Per Container: 30, Amount Per Serving: Proprietary Probiotic Blend 50 Billion CFU (Lactobacillus acidophilus, Bifidobacterium lactis, Lactobacillus plantarum, Lactobacillus paracasei, Bifidobacterium longum), Other Ingredients: Vegetable Cellulose Capsule, Microcrystalline Cellulose, Magnesium Stearate',
  },
];

export const MOCK_COMPARISONS = [
  {
    id: '1',
    product1: {
      name: 'Ultra Strength Omega-3 Fish Oil Supplement',
      brand: 'NaturePlus',
      imageUrl: 'https://images.pexels.com/photos/6941883/pexels-photo-6941883.jpeg',
      score: 85,
      _meta: { 
        status: 'success',
        remediation: 'none'
      },
      ingredients: 'Fish Oil Concentrate 1200mg (EPA 360mg, DHA 240mg), Gelatin, Glycerin, Water, Natural Lemon Flavor',
      supplement_facts: 'Serving Size: 1 Softgel, Servings Per Container: 90, Amount Per Serving: Fish Oil Concentrate 1200mg (EPA 360mg, DHA 240mg), Other Ingredients: Gelatin, Glycerin, Water, Natural Lemon Flavor',
    },
    product2: {
      name: 'Pure Omega-3 Wild Caught Fish Oil',
      brand: 'OceanHealth',
      imageUrl: 'https://images.pexels.com/photos/6692103/pexels-photo-6692103.jpeg',
      score: 92,
      _meta: { 
        status: 'success',
        remediation: 'none'
      },
      ingredients: 'Wild Caught Fish Oil 1500mg (EPA 800mg, DHA 600mg), Gelatin, Glycerin, Purified Water, Natural Lemon Oil',
      supplement_facts: 'Serving Size: 1 Softgel, Servings Per Container: 120, Amount Per Serving: Wild Caught Fish Oil 1500mg (EPA 800mg, DHA 600mg), Other Ingredients: Gelatin, Glycerin, Purified Water, Natural Lemon Oil',
    },
  },
  {
    id: '2',
    product1: {
      name: 'Complete Multivitamin Daily Formula',
      brand: 'VitaCore',
      imageUrl: 'https://images.pexels.com/photos/3683074/pexels-photo-3683074.jpeg',
      score: 73,
      _meta: { 
        status: 'parser_fail',
        remediation: 'manual review'
      },
      ingredients: 'Vitamin A, Vitamin C, Vitamin D, Vitamin E, Vitamin K, Thiamin, Riboflavin, Niacin, Vitamin B6, Folate, Vitamin B12, Biotin, Pantothenic Acid, Calcium, Iron, Phosphorus, Iodine, Magnesium, Zinc, Selenium, Copper, Manganese, Chromium, Molybdenum, Potassium',
      supplement_facts: '',
    },
    product2: {
      name: 'Premium Multivitamin & Mineral Complex',
      brand: 'OptimumHealth',
      imageUrl: 'https://images.pexels.com/photos/5699514/pexels-photo-5699514.jpeg',
      score: 67,
      _meta: { 
        status: 'manual',
        remediation: 'needs verification'
      },
      ingredients: 'Vitamin A, C, D3, E, K2, B-Complex, Calcium, Magnesium, Zinc, Selenium, Iron, Iodine, Chromium, Biotin, Manganese, Copper',
      supplement_facts: 'Serving Size: 2 Tablets, Servings Per Container: 60, Vitamin A (as Retinyl Palmitate) 5000 IU, Vitamin C (as Ascorbic Acid) 250mg, Vitamin D3 (as Cholecalciferol) 2000 IU, Vitamin E (as d-Alpha Tocopheryl Succinate) 100 IU, Vitamin K2 (as Menaquinone-7) 80mcg, Thiamine (as Thiamine Mononitrate) 25mg, Riboflavin 25mg, Niacin (as Niacinamide) 25mg, Vitamin B6 (as Pyridoxine HCl) 25mg, Folate (as Folic Acid) 400mcg, Vitamin B12 (as Methylcobalamin) 100mcg, Biotin 300mcg, Pantothenic Acid (as d-Calcium Pantothenate) 25mg, Calcium (as Calcium Carbonate) 100mg, Iron (as Ferrous Fumarate) 18mg, Phosphorus (as Dicalcium Phosphate) 50mg, Iodine (as Potassium Iodide) 150mcg, Magnesium (as Magnesium Oxide) 100mg, Zinc (as Zinc Oxide) 15mg, Selenium (as Sodium Selenite) 70mcg, Copper (as Copper Gluconate) 2mg, Manganese (as Manganese Gluconate) 2mg, Chromium (as Chromium Picolinate) 120mcg, Molybdenum (as Sodium Molybdate) 75mcg, Potassium (as Potassium Chloride) 50mg, Other Ingredients: Microcrystalline Cellulose, Stearic Acid, Croscarmellose Sodium, Silicon Dioxide, Magnesium Stearate, Pharmaceutical Glaze',
    },
  },
];

export const MOCK_PRODUCT_DETAILS = {
  id: '123',
  name: 'Ultra Strength Omega-3 Fish Oil Supplement',
  brand: 'NaturePlus',
  imageUrl: 'https://images.pexels.com/photos/6941883/pexels-photo-6941883.jpeg',
  overallScore: 85,
  overallSummary: 'This supplement provides a high-quality fish oil with appropriate EPA and DHA levels. Transparent about sourcing and testing for contaminants. Dosage is evidence-based and matches label claims.',
  _meta: { 
    status: 'success',
    remediation: 'none',
    parserSteps: [
      'Successfully extracted product name from title',
      'Parsed ingredient list from product page',
      'Verified dosage information from supplement facts',
      'Matched product against database',
      'All validation checks passed'
    ]
  },
  ingredients: ['Fish Oil Concentrate 1200mg (EPA 360mg, DHA 240mg)', 'Gelatin', 'Glycerin', 'Water', 'Natural Lemon Flavor'],
  supplement_facts: 'Serving Size: 1 Softgel, Servings Per Container: 90, Amount Per Serving: Fish Oil Concentrate 1200mg (EPA 360mg, DHA 240mg), Other Ingredients: Gelatin, Glycerin, Water, Natural Lemon Flavor',
  categories: [
    {
      name: 'Ingredient Quality',
      score: 90,
      insights: [
        'Contains pharmaceutical-grade fish oil from wild-caught sources',
        'Includes natural lemon flavor to reduce fishy aftertaste',
        'Free from artificial colors, flavors, and preservatives'
      ]
    },
    {
      name: 'Label Transparency',
      score: 85,
      insights: [
        'Clearly lists EPA and DHA content per serving',
        'Provides specific fish sources (anchovy, sardine, mackerel)',
        'Discloses extraction method (molecular distillation)'
      ]
    },
    {
      name: 'Dosage Accuracy',
      score: 95,
      insights: [
        'Third-party tested to verify EPA/DHA content matches label',
        'Recommended serving size aligns with research-backed amounts',
        'Consistent potency throughout shelf life'
      ]
    },
    {
      name: 'Value Assessment',
      score: 70,
      insights: [
        'Higher price point but justified by quality and potency',
        'Cost per serving is moderate compared to similar products',
        'Fewer servings per bottle than some competitors'
      ]
    }
  ]
};