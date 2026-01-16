// src/industryKeywords.js
// Centralized industry keyword database with weighted detection signals

/**
 * Industry keywords organized by signal strength:
 * - primary: Core industry terms (2x weight)
 * - secondary: Related terms (1x weight)
 * - negative: Terms that indicate FALSE matches (exclude)
 * - schemaTypes: Schema.org types that map to this industry (3x weight)
 * - urlPatterns: Common URL/domain patterns (2x weight)
 */
export const INDUSTRY_KEYWORDS = {
  plumber: {
    primary: ['plumber', 'plumbing', 'drain', 'pipe', 'sewer', 'water heater'],
    secondary: ['leak', 'faucet', 'toilet', 'clog', 'septic', 'backflow', 'water line', 'gas line', 'fixture', 'bathroom remodel'],
    negative: ['data pipeline', 'sales pipeline', 'pipeline software', 'CI/CD pipeline'],
    schemaTypes: ['Plumber', 'HomeAndConstructionBusiness'],
    urlPatterns: ['plumb', 'drain', 'pipe', 'sewer']
  },

  electrician: {
    primary: ['electrician', 'electrical', 'wiring', 'electric'],
    secondary: ['outlet', 'circuit', 'panel', 'breaker', 'lighting', 'generator', 'rewire', 'voltage', 'power', 'ev charger'],
    negative: ['electric car', 'electric vehicle sales', 'electronics store', 'electric guitar'],
    schemaTypes: ['Electrician', 'HomeAndConstructionBusiness'],
    urlPatterns: ['electric', 'wiring']
  },

  hvac: {
    primary: ['hvac', 'heating', 'cooling', 'air conditioning', 'furnace', 'ac repair'],
    secondary: ['thermostat', 'duct', 'ventilation', 'heat pump', 'boiler', 'central air', 'mini split', 'air handler', 'compressor'],
    negative: ['heating discussion', 'cooling off period'],
    schemaTypes: ['HVACBusiness', 'HomeAndConstructionBusiness'],
    urlPatterns: ['hvac', 'heating', 'cooling', 'aircon']
  },

  roofing: {
    primary: ['roofing', 'roofer', 'roof repair', 'roof replacement', 'shingles'],
    secondary: ['gutter', 'siding', 'flashing', 'leak repair', 'storm damage', 'metal roof', 'tile roof', 'flat roof', 'chimney'],
    negative: ['rooftop bar', 'rooftop garden', 'rooftop dining'],
    schemaTypes: ['RoofingContractor', 'HomeAndConstructionBusiness'],
    urlPatterns: ['roof', 'shingle', 'gutter']
  },

  landscaping: {
    primary: ['landscaping', 'landscaper', 'lawn care', 'lawn service', 'yard work'],
    secondary: ['mowing', 'irrigation', 'hardscape', 'patio', 'garden', 'tree service', 'mulch', 'sod', 'sprinkler', 'outdoor living'],
    negative: ['landscape photography', 'landscape painting', 'landscape mode'],
    schemaTypes: ['LandscapingBusiness', 'HomeAndConstructionBusiness'],
    urlPatterns: ['landscape', 'lawn', 'yard', 'garden']
  },

  'home-services': {
    primary: ['handyman', 'contractor', 'remodeling', 'home repair', 'renovation'],
    secondary: ['painting', 'drywall', 'carpentry', 'flooring', 'tile', 'deck', 'fence', 'bathroom', 'kitchen', 'basement'],
    negative: ['home services software', 'digital services'],
    schemaTypes: ['HomeAndConstructionBusiness', 'GeneralContractor'],
    urlPatterns: ['handyman', 'contractor', 'remodel', 'renovation']
  },

  restaurant: {
    primary: ['restaurant', 'cafe', 'bistro', 'diner', 'grill', 'eatery'],
    secondary: ['menu', 'reservation', 'dining', 'chef', 'cuisine', 'takeout', 'delivery', 'catering', 'brunch', 'bar'],
    negative: ['restaurant supply', 'restaurant equipment', 'restaurant software', 'restaurant POS'],
    schemaTypes: ['Restaurant', 'FoodEstablishment', 'CafeOrCoffeeShop', 'BarOrPub', 'Bakery'],
    urlPatterns: ['restaurant', 'cafe', 'bistro', 'grill', 'kitchen', 'eats']
  },

  lawyer: {
    primary: ['lawyer', 'attorney', 'law firm', 'legal', 'counsel'],
    secondary: ['litigation', 'divorce', 'injury', 'criminal', 'defense', 'estate', 'bankruptcy', 'immigration', 'family law', 'personal injury'],
    negative: ['brother-in-law', 'son-in-law', 'law enforcement', 'law school'],
    schemaTypes: ['Attorney', 'LegalService', 'Notary'],
    urlPatterns: ['law', 'legal', 'attorney', 'lawyer']
  },

  'real-estate': {
    primary: ['real estate', 'realtor', 'realty', 'real estate agent', 'broker'],
    secondary: ['homes', 'houses', 'property', 'properties', 'buying', 'selling', 'listings', 'mls', 'mortgage', 'condo', 'apartment'],
    negative: ['real estate software', 'real estate investing course'],
    schemaTypes: ['RealEstateAgent', 'RealEstateBroker'],
    urlPatterns: ['realty', 'realtor', 'homes', 'property', 'estate']
  },

  dentist: {
    primary: ['dentist', 'dental', 'dentistry', 'oral health'],
    secondary: ['teeth', 'tooth', 'cleaning', 'whitening', 'braces', 'orthodontist', 'implant', 'crown', 'filling', 'extraction', 'cosmetic dentistry'],
    negative: ['dental software', 'dental supplies wholesale'],
    schemaTypes: ['Dentist', 'DentalClinic', 'Orthodontist'],
    urlPatterns: ['dental', 'dentist', 'smile', 'tooth', 'teeth']
  },

  retail: {
    primary: ['shop', 'store', 'boutique', 'retail'],
    secondary: ['products', 'merchandise', 'shopping', 'buy', 'sale', 'discount', 'clothing', 'fashion', 'jewelry', 'gifts', 'furniture'],
    negative: ['app store', 'play store', 'store data', 'store procedure'],
    schemaTypes: ['Store', 'ClothingStore', 'JewelryStore', 'FurnitureStore', 'ShoppingCenter'],
    urlPatterns: ['shop', 'store', 'boutique', 'mart']
  },

  auto: {
    primary: ['auto repair', 'auto shop', 'mechanic', 'car repair', 'automotive'],
    secondary: ['oil change', 'brake', 'tire', 'transmission', 'engine', 'diagnostic', 'tune up', 'alignment', 'collision', 'body shop'],
    negative: ['auto-save', 'auto-complete', 'automation', 'auto insurance'],
    schemaTypes: ['AutoRepair', 'AutoBodyShop', 'AutoDealer', 'TireShop'],
    urlPatterns: ['auto', 'mechanic', 'car', 'tire', 'brake']
  },

  cleaning: {
    primary: ['cleaning', 'maid', 'janitorial', 'housekeeping', 'cleaner'],
    secondary: ['house cleaning', 'office cleaning', 'carpet cleaning', 'window cleaning', 'pressure washing', 'sanitizing', 'deep clean'],
    negative: ['data cleaning', 'cleaning up code', 'clean energy'],
    schemaTypes: ['HousekeepingService', 'CleaningService'],
    urlPatterns: ['clean', 'maid', 'janitorial']
  },

  insurance: {
    primary: ['insurance', 'insure', 'coverage', 'policy'],
    secondary: ['auto insurance', 'home insurance', 'life insurance', 'health insurance', 'claim', 'premium', 'deductible', 'agent', 'broker'],
    negative: ['quality insurance', 'insurance software'],
    schemaTypes: ['InsuranceAgency', 'FinancialService'],
    urlPatterns: ['insurance', 'insure', 'coverage']
  },

  accountant: {
    primary: ['accountant', 'accounting', 'cpa', 'bookkeeper', 'bookkeeping'],
    secondary: ['tax', 'taxes', 'payroll', 'audit', 'financial', 'returns', 'quickbooks', 'tax preparation', 'business services'],
    negative: ['account manager', 'account settings', 'user account'],
    schemaTypes: ['AccountingService', 'FinancialService'],
    urlPatterns: ['account', 'cpa', 'tax', 'bookkeep']
  },

  salon: {
    primary: ['salon', 'hair salon', 'beauty salon', 'barber', 'barbershop', 'spa'],
    secondary: ['haircut', 'color', 'stylist', 'nails', 'manicure', 'pedicure', 'facial', 'waxing', 'massage', 'blowout'],
    negative: ['salon software', 'salon equipment wholesale'],
    schemaTypes: ['HairSalon', 'BeautySalon', 'BarberShop', 'DaySpa', 'NailSalon'],
    urlPatterns: ['salon', 'hair', 'beauty', 'barber', 'spa', 'nail']
  },

  gym: {
    primary: ['gym', 'fitness', 'health club', 'fitness center', 'workout'],
    secondary: ['training', 'personal trainer', 'crossfit', 'yoga', 'pilates', 'membership', 'exercise', 'weights', 'cardio', 'classes'],
    negative: ['mental fitness', 'gym equipment store', 'fitness app'],
    schemaTypes: ['HealthClub', 'ExerciseGym', 'SportsActivityLocation', 'YogaStudio'],
    urlPatterns: ['gym', 'fitness', 'fit', 'workout', 'training']
  },

  general: {
    primary: [],
    secondary: [],
    negative: [],
    schemaTypes: ['LocalBusiness', 'Organization'],
    urlPatterns: []
  }
};

/**
 * Schema.org type to industry mapping
 * Used for high-confidence industry detection
 */
export const SCHEMA_TO_INDUSTRY = {
  // Plumber
  'Plumber': 'plumber',

  // Electrician
  'Electrician': 'electrician',

  // HVAC
  'HVACBusiness': 'hvac',

  // Roofing
  'RoofingContractor': 'roofing',

  // Landscaping
  'LandscapingBusiness': 'landscaping',

  // Home Services
  'HomeAndConstructionBusiness': 'home-services',
  'GeneralContractor': 'home-services',

  // Restaurant
  'Restaurant': 'restaurant',
  'FoodEstablishment': 'restaurant',
  'CafeOrCoffeeShop': 'restaurant',
  'BarOrPub': 'restaurant',
  'Bakery': 'restaurant',
  'FastFoodRestaurant': 'restaurant',

  // Lawyer
  'Attorney': 'lawyer',
  'LegalService': 'lawyer',
  'Notary': 'lawyer',

  // Real Estate
  'RealEstateAgent': 'real-estate',
  'RealEstateBroker': 'real-estate',

  // Dentist
  'Dentist': 'dentist',
  'DentalClinic': 'dentist',
  'Orthodontist': 'dentist',

  // Retail
  'Store': 'retail',
  'ClothingStore': 'retail',
  'JewelryStore': 'retail',
  'FurnitureStore': 'retail',
  'ShoppingCenter': 'retail',
  'GroceryStore': 'retail',
  'HardwareStore': 'retail',

  // Auto
  'AutoRepair': 'auto',
  'AutoBodyShop': 'auto',
  'AutoDealer': 'auto',
  'TireShop': 'auto',
  'CarWash': 'auto',

  // Cleaning
  'HousekeepingService': 'cleaning',
  'CleaningService': 'cleaning',

  // Insurance
  'InsuranceAgency': 'insurance',

  // Accountant
  'AccountingService': 'accountant',

  // Salon
  'HairSalon': 'salon',
  'BeautySalon': 'salon',
  'BarberShop': 'salon',
  'DaySpa': 'salon',
  'NailSalon': 'salon',

  // Gym
  'HealthClub': 'gym',
  'ExerciseGym': 'gym',
  'SportsActivityLocation': 'gym',
  'YogaStudio': 'gym',
  'FitnessCenter': 'gym',

  // Generic fallbacks
  'LocalBusiness': null, // Don't infer from generic type
  'Organization': null,
  'ProfessionalService': null
};

/**
 * Signal weights for industry detection scoring
 */
export const SIGNAL_WEIGHTS = {
  schemaType: 3.0,        // Schema.org type is most reliable
  businessName: 2.0,      // Business name usually contains industry
  urlDomain: 2.0,         // Domain often indicates industry
  primaryKeyword: 2.0,    // Core industry terms
  headlineKeyword: 1.5,   // Keywords in headlines
  serviceKeyword: 1.5,    // Keywords in services
  secondaryKeyword: 1.0,  // Related terms in body
  negativeKeyword: -5.0   // Strong penalty for false positive indicators
};

/**
 * Minimum confidence threshold for using industry-specific templates
 */
export const CONFIDENCE_THRESHOLDS = {
  high: 0.7,    // Use full industry template
  medium: 0.4,  // Use industry template with generic fallbacks
  low: 0.0      // Use general template
};
