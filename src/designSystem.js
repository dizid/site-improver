// src/designSystem.js
// Industry-specific design system with visual personalities
// Creates distinctive looks per industry, not just font/color swaps

/**
 * Extended font pairings for premium typography
 * Each pairing has distinct personality and use case
 */
export const FONT_PAIRINGS = {
  // Premium/Editorial - for luxury, high-end services
  editorial: {
    heading: "'Cormorant Garamond', 'Playfair Display', Georgia, serif",
    body: "'Source Serif Pro', Georgia, serif",
    googleFonts: 'family=Cormorant+Garamond:wght@500;600;700&family=Source+Serif+Pro:wght@400;600',
    letterSpacing: { heading: '-0.02em', body: '0' },
    lineHeight: { heading: 1.1, body: 1.7 }
  },

  // Geometric/Tech - for modern, tech-forward businesses
  geometric: {
    heading: "'Space Grotesk', 'Inter', system-ui, sans-serif",
    body: "'Inter', system-ui, sans-serif",
    googleFonts: 'family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600',
    letterSpacing: { heading: '-0.03em', body: '-0.01em' },
    lineHeight: { heading: 1.05, body: 1.6 }
  },

  // Industrial/Bold - for trades, construction, automotive
  industrial: {
    heading: "'Oswald', 'Bebas Neue', Impact, sans-serif",
    body: "'Source Sans Pro', 'Open Sans', sans-serif",
    googleFonts: 'family=Oswald:wght@500;600;700&family=Source+Sans+Pro:wght@400;600',
    letterSpacing: { heading: '0.02em', body: '0' },
    lineHeight: { heading: 1.1, body: 1.65 }
  },

  // Approachable/Friendly - for family businesses, local services
  approachable: {
    heading: "'Poppins', 'Nunito', sans-serif",
    body: "'Poppins', sans-serif",
    googleFonts: 'family=Poppins:wght@400;500;600;700',
    letterSpacing: { heading: '-0.01em', body: '0' },
    lineHeight: { heading: 1.15, body: 1.7 }
  },

  // Sophisticated/Elegant - for professional services, upscale
  sophisticated: {
    heading: "'DM Serif Display', Georgia, serif",
    body: "'DM Sans', sans-serif",
    googleFonts: 'family=DM+Serif+Display&family=DM+Sans:wght@400;500;700',
    letterSpacing: { heading: '-0.01em', body: '0' },
    lineHeight: { heading: 1.1, body: 1.65 }
  },

  // Clean/Minimal - for medical, dental, clean services
  clean: {
    heading: "'Outfit', 'Inter', sans-serif",
    body: "'Inter', system-ui, sans-serif",
    googleFonts: 'family=Outfit:wght@500;600;700&family=Inter:wght@400;500',
    letterSpacing: { heading: '-0.02em', body: '0' },
    lineHeight: { heading: 1.1, body: 1.7 }
  },

  // Warm/Organic - for restaurants, wellness, organic
  warm: {
    heading: "'Fraunces', Georgia, serif",
    body: "'Nunito Sans', sans-serif",
    googleFonts: 'family=Fraunces:wght@500;600;700&family=Nunito+Sans:wght@400;600',
    letterSpacing: { heading: '-0.01em', body: '0' },
    lineHeight: { heading: 1.15, body: 1.7 }
  },

  // Strong/Confident - for security, legal, finance
  strong: {
    heading: "'Archivo', 'Roboto', sans-serif",
    body: "'Roboto', sans-serif",
    googleFonts: 'family=Archivo:wght@600;700;800&family=Roboto:wght@400;500',
    letterSpacing: { heading: '-0.02em', body: '0' },
    lineHeight: { heading: 1.1, body: 1.65 }
  }
};

/**
 * Industry-specific color palettes with proper color psychology
 * Each industry has 2-4 distinct palettes for variety
 */
export const COLOR_PALETTES = {
  plumber: {
    trust: {
      primary: '#1e3a5f',      // Deep navy - reliability
      secondary: '#f59e0b',    // Amber - attention/action
      accent: '#60a5fa',       // Light blue - water/clean
      surface: '#f8fafc',      // Cool white
      surfaceDark: '#0f172a',
      text: '#1e293b',
      textMuted: '#64748b',
      gradient: 'linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%)',
      heroOverlay: 'linear-gradient(135deg, rgba(30,58,95,0.9) 0%, rgba(15,23,42,0.85) 100%)'
    },
    modern: {
      primary: '#0891b2',      // Cyan - fresh/modern
      secondary: '#1e293b',    // Dark slate
      accent: '#22d3ee',       // Bright cyan
      surface: '#f1f5f9',
      surfaceDark: '#0f172a',
      text: '#0f172a',
      textMuted: '#475569',
      gradient: 'linear-gradient(135deg, #0891b2 0%, #0e7490 100%)',
      heroOverlay: 'linear-gradient(135deg, rgba(8,145,178,0.85) 0%, rgba(14,116,144,0.9) 100%)'
    },
    local: {
      primary: '#166534',      // Forest green - local/trusted
      secondary: '#854d0e',    // Warm brown
      accent: '#22c55e',       // Bright green
      surface: '#fafaf9',
      surfaceDark: '#14532d',
      text: '#1c1917',
      textMuted: '#57534e',
      gradient: 'linear-gradient(135deg, #166534 0%, #14532d 100%)',
      heroOverlay: 'linear-gradient(135deg, rgba(22,101,52,0.88) 0%, rgba(20,83,45,0.92) 100%)'
    }
  },

  electrician: {
    power: {
      primary: '#eab308',      // Electric yellow
      secondary: '#1f2937',    // Dark gray
      accent: '#fbbf24',       // Gold
      surface: '#f9fafb',
      surfaceDark: '#111827',
      text: '#111827',
      textMuted: '#4b5563',
      gradient: 'linear-gradient(135deg, #1f2937 0%, #111827 100%)',
      heroOverlay: 'linear-gradient(135deg, rgba(31,41,55,0.92) 0%, rgba(17,24,39,0.95) 100%)'
    },
    tech: {
      primary: '#3b82f6',      // Electric blue
      secondary: '#1e293b',
      accent: '#60a5fa',
      surface: '#f8fafc',
      surfaceDark: '#0f172a',
      text: '#0f172a',
      textMuted: '#64748b',
      gradient: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
      heroOverlay: 'linear-gradient(135deg, rgba(59,130,246,0.85) 0%, rgba(29,78,216,0.9) 100%)'
    }
  },

  restaurant: {
    elegant: {
      primary: '#1c1917',      // Almost black - sophistication
      secondary: '#c9a227',    // Gold - premium
      accent: '#a16207',       // Bronze
      surface: '#faf9f7',      // Warm white
      surfaceDark: '#292524',
      text: '#1c1917',
      textMuted: '#57534e',
      gradient: 'linear-gradient(135deg, #1c1917 0%, #292524 100%)',
      heroOverlay: 'linear-gradient(135deg, rgba(28,25,23,0.88) 0%, rgba(41,37,36,0.85) 100%)'
    },
    casual: {
      primary: '#dc2626',      // Vibrant red - appetite
      secondary: '#fbbf24',    // Yellow - friendly
      accent: '#22c55e',       // Fresh green
      surface: '#fffbeb',      // Cream
      surfaceDark: '#7f1d1d',
      text: '#1c1917',
      textMuted: '#78716c',
      gradient: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
      heroOverlay: 'linear-gradient(135deg, rgba(220,38,38,0.85) 0%, rgba(185,28,28,0.9) 100%)'
    },
    modern: {
      primary: '#0f172a',      // Dark slate
      secondary: '#f97316',    // Orange - appetite
      accent: '#fb923c',
      surface: '#fafafa',
      surfaceDark: '#1e293b',
      text: '#0f172a',
      textMuted: '#64748b',
      gradient: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
      heroOverlay: 'linear-gradient(135deg, rgba(15,23,42,0.9) 0%, rgba(30,41,59,0.88) 100%)'
    },
    rustic: {
      primary: '#78350f',      // Brown - earthy
      secondary: '#65a30d',    // Green - fresh/organic
      accent: '#a3e635',       // Lime
      surface: '#fef3c7',      // Warm cream
      surfaceDark: '#451a03',
      text: '#422006',
      textMuted: '#78716c',
      gradient: 'linear-gradient(135deg, #78350f 0%, #451a03 100%)',
      heroOverlay: 'linear-gradient(135deg, rgba(120,53,15,0.88) 0%, rgba(69,26,3,0.92) 100%)'
    }
  },

  lawyer: {
    prestigious: {
      primary: '#1e1b4b',      // Deep indigo - authority
      secondary: '#7c2d12',    // Burgundy - tradition
      accent: '#c7d2fe',       // Light indigo
      surface: '#faf5ff',
      surfaceDark: '#312e81',
      text: '#1e1b4b',
      textMuted: '#4c1d95',
      gradient: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
      heroOverlay: 'linear-gradient(135deg, rgba(30,27,75,0.92) 0%, rgba(49,46,129,0.88) 100%)'
    },
    approachable: {
      primary: '#0369a1',      // Friendly blue
      secondary: '#1e3a5f',
      accent: '#38bdf8',
      surface: '#f0f9ff',
      surfaceDark: '#0c4a6e',
      text: '#0c4a6e',
      textMuted: '#0284c7',
      gradient: 'linear-gradient(135deg, #0369a1 0%, #0c4a6e 100%)',
      heroOverlay: 'linear-gradient(135deg, rgba(3,105,161,0.88) 0%, rgba(12,74,110,0.92) 100%)'
    },
    modern: {
      primary: '#18181b',      // Near black
      secondary: '#3f3f46',
      accent: '#a1a1aa',
      surface: '#fafafa',
      surfaceDark: '#27272a',
      text: '#18181b',
      textMuted: '#52525b',
      gradient: 'linear-gradient(135deg, #18181b 0%, #27272a 100%)',
      heroOverlay: 'linear-gradient(135deg, rgba(24,24,27,0.92) 0%, rgba(39,39,42,0.9) 100%)'
    }
  },

  dentist: {
    clinical: {
      primary: '#0ea5e9',      // Sky blue - clean/fresh
      secondary: '#14b8a6',    // Teal - medical
      accent: '#22d3ee',
      surface: '#f0fdfa',
      surfaceDark: '#0369a1',
      text: '#0c4a6e',
      textMuted: '#0891b2',
      gradient: 'linear-gradient(135deg, #0ea5e9 0%, #14b8a6 100%)',
      heroOverlay: 'linear-gradient(135deg, rgba(14,165,233,0.85) 0%, rgba(20,184,166,0.88) 100%)'
    },
    friendly: {
      primary: '#059669',      // Green - health
      secondary: '#0284c7',    // Blue
      accent: '#34d399',
      surface: '#f0fdf4',
      surfaceDark: '#047857',
      text: '#064e3b',
      textMuted: '#047857',
      gradient: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
      heroOverlay: 'linear-gradient(135deg, rgba(5,150,105,0.88) 0%, rgba(4,120,87,0.9) 100%)'
    }
  },

  'real-estate': {
    luxury: {
      primary: '#1c1917',      // Black - premium
      secondary: '#d4af37',    // Gold
      accent: '#f5d370',
      surface: '#faf9f7',
      surfaceDark: '#292524',
      text: '#1c1917',
      textMuted: '#57534e',
      gradient: 'linear-gradient(135deg, #1c1917 0%, #292524 100%)',
      heroOverlay: 'linear-gradient(135deg, rgba(28,25,23,0.85) 0%, rgba(41,37,36,0.88) 100%)'
    },
    professional: {
      primary: '#1e3a8a',      // Navy - trust
      secondary: '#166534',    // Green - growth
      accent: '#60a5fa',
      surface: '#f8fafc',
      surfaceDark: '#1e40af',
      text: '#1e3a8a',
      textMuted: '#3b82f6',
      gradient: 'linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%)',
      heroOverlay: 'linear-gradient(135deg, rgba(30,58,138,0.88) 0%, rgba(30,64,175,0.9) 100%)'
    },
    modern: {
      primary: '#0f172a',
      secondary: '#06b6d4',    // Cyan - fresh
      accent: '#22d3ee',
      surface: '#f1f5f9',
      surfaceDark: '#1e293b',
      text: '#0f172a',
      textMuted: '#475569',
      gradient: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
      heroOverlay: 'linear-gradient(135deg, rgba(15,23,42,0.9) 0%, rgba(30,41,59,0.88) 100%)'
    }
  },

  hvac: {
    comfort: {
      primary: '#1d4ed8',      // Blue - cooling
      secondary: '#dc2626',    // Red - heating
      accent: '#3b82f6',
      surface: '#f8fafc',
      surfaceDark: '#1e40af',
      text: '#1e3a8a',
      textMuted: '#3b82f6',
      gradient: 'linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%)',
      heroOverlay: 'linear-gradient(135deg, rgba(29,78,216,0.88) 0%, rgba(30,64,175,0.9) 100%)'
    },
    professional: {
      primary: '#0f172a',
      secondary: '#f59e0b',    // Amber - energy
      accent: '#fbbf24',
      surface: '#f9fafb',
      surfaceDark: '#1e293b',
      text: '#0f172a',
      textMuted: '#4b5563',
      gradient: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
      heroOverlay: 'linear-gradient(135deg, rgba(15,23,42,0.9) 0%, rgba(30,41,59,0.88) 100%)'
    }
  },

  general: {
    professional: {
      primary: '#1e40af',
      secondary: '#059669',
      accent: '#3b82f6',
      surface: '#f8fafc',
      surfaceDark: '#1e3a8a',
      text: '#1e3a8a',
      textMuted: '#3b82f6',
      gradient: 'linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%)',
      heroOverlay: 'linear-gradient(135deg, rgba(30,64,175,0.88) 0%, rgba(30,58,138,0.9) 100%)'
    },
    modern: {
      primary: '#0f172a',
      secondary: '#8b5cf6',    // Purple - creative
      accent: '#a78bfa',
      surface: '#faf5ff',
      surfaceDark: '#1e293b',
      text: '#0f172a',
      textMuted: '#64748b',
      gradient: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
      heroOverlay: 'linear-gradient(135deg, rgba(15,23,42,0.9) 0%, rgba(30,41,59,0.88) 100%)'
    }
  }
};

/**
 * Industry design systems with visual personalities
 * Each personality defines a complete visual language
 */
export const INDUSTRY_DESIGN_SYSTEMS = {
  plumber: {
    personalities: {
      trust: {
        heroStyle: 'diagonal-split',
        typography: 'industrial',
        colorScheme: 'trust',
        cardStyle: 'bordered-accent',
        sectionDivider: 'diagonal',
        buttonStyle: 'solid',
        animations: 'professional',
        spacing: 'normal',
        shadows: 'medium'
      },
      modern: {
        heroStyle: 'mesh-gradient',
        typography: 'geometric',
        colorScheme: 'modern',
        cardStyle: 'glass',
        sectionDivider: 'wave',
        buttonStyle: 'gradient',
        animations: 'smooth',
        spacing: 'relaxed',
        shadows: 'soft'
      },
      local: {
        heroStyle: 'fullwidth',
        typography: 'approachable',
        colorScheme: 'local',
        cardStyle: 'rounded',
        sectionDivider: 'curve',
        buttonStyle: 'solid',
        animations: 'friendly',
        spacing: 'comfortable',
        shadows: 'subtle'
      }
    },
    defaultPersonality: 'trust',
    selectPersonality: (siteData) => {
      if (siteData.trustSignals?.yearsInBusiness > 15) return 'trust';
      if (siteData.rating >= 4.7 && siteData.reviewCount > 50) return 'local';
      return 'modern';
    }
  },

  electrician: {
    personalities: {
      power: {
        heroStyle: 'diagonal-split',
        typography: 'industrial',
        colorScheme: 'power',
        cardStyle: 'bordered-accent',
        sectionDivider: 'sharp',
        buttonStyle: 'solid',
        animations: 'professional',
        spacing: 'normal',
        shadows: 'strong'
      },
      tech: {
        heroStyle: 'mesh-gradient',
        typography: 'geometric',
        colorScheme: 'tech',
        cardStyle: 'glass',
        sectionDivider: 'wave',
        buttonStyle: 'gradient',
        animations: 'smooth',
        spacing: 'relaxed',
        shadows: 'glow'
      }
    },
    defaultPersonality: 'power',
    selectPersonality: (siteData) => {
      const techKeywords = ['smart home', 'automation', 'solar', 'ev charger', 'tesla'];
      const hasModernServices = siteData.services?.some(s =>
        techKeywords.some(kw => s.toLowerCase().includes(kw))
      );
      return hasModernServices ? 'tech' : 'power';
    }
  },

  restaurant: {
    personalities: {
      elegant: {
        heroStyle: 'fullwidth-dark',
        typography: 'editorial',
        colorScheme: 'elegant',
        cardStyle: 'minimal',
        sectionDivider: 'none',
        buttonStyle: 'outline',
        animations: 'subtle',
        spacing: 'luxurious',
        shadows: 'none'
      },
      casual: {
        heroStyle: 'stacked',
        typography: 'approachable',
        colorScheme: 'casual',
        cardStyle: 'rounded',
        sectionDivider: 'wave',
        buttonStyle: 'solid',
        animations: 'playful',
        spacing: 'comfortable',
        shadows: 'soft'
      },
      modern: {
        heroStyle: 'split-offset',
        typography: 'geometric',
        colorScheme: 'modern',
        cardStyle: 'glass',
        sectionDivider: 'diagonal',
        buttonStyle: 'gradient',
        animations: 'smooth',
        spacing: 'relaxed',
        shadows: 'medium'
      },
      rustic: {
        heroStyle: 'fullwidth',
        typography: 'warm',
        colorScheme: 'rustic',
        cardStyle: 'textured',
        sectionDivider: 'organic',
        buttonStyle: 'solid',
        animations: 'natural',
        spacing: 'comfortable',
        shadows: 'warm'
      }
    },
    defaultPersonality: 'casual',
    selectPersonality: (siteData) => {
      const priceRange = siteData.priceRange || '';
      if (priceRange === '$$$$' || priceRange === '$$$') return 'elegant';
      const modernKeywords = ['fusion', 'contemporary', 'craft', 'artisan'];
      const rusticKeywords = ['farm', 'organic', 'local', 'homemade', 'traditional'];
      const headline = (siteData.headlines?.[0] || '').toLowerCase();
      if (rusticKeywords.some(kw => headline.includes(kw))) return 'rustic';
      if (modernKeywords.some(kw => headline.includes(kw))) return 'modern';
      return 'casual';
    }
  },

  lawyer: {
    personalities: {
      prestigious: {
        heroStyle: 'text-focus',
        typography: 'editorial',
        colorScheme: 'prestigious',
        cardStyle: 'minimal',
        sectionDivider: 'none',
        buttonStyle: 'outline',
        animations: 'subtle',
        spacing: 'luxurious',
        shadows: 'none'
      },
      approachable: {
        heroStyle: 'split',
        typography: 'clean',
        colorScheme: 'approachable',
        cardStyle: 'bordered',
        sectionDivider: 'curve',
        buttonStyle: 'solid',
        animations: 'professional',
        spacing: 'comfortable',
        shadows: 'soft'
      },
      modern: {
        heroStyle: 'diagonal-split',
        typography: 'strong',
        colorScheme: 'modern',
        cardStyle: 'glass',
        sectionDivider: 'sharp',
        buttonStyle: 'gradient',
        animations: 'smooth',
        spacing: 'normal',
        shadows: 'medium'
      }
    },
    defaultPersonality: 'prestigious',
    selectPersonality: (siteData) => {
      const services = (siteData.services || []).join(' ').toLowerCase();
      const personalInjury = ['injury', 'accident', 'workers comp', 'disability'];
      const corporate = ['corporate', 'business', 'real estate', 'mergers'];
      if (personalInjury.some(kw => services.includes(kw))) return 'approachable';
      if (corporate.some(kw => services.includes(kw))) return 'modern';
      return 'prestigious';
    }
  },

  dentist: {
    personalities: {
      clinical: {
        heroStyle: 'split',
        typography: 'clean',
        colorScheme: 'clinical',
        cardStyle: 'bordered',
        sectionDivider: 'wave',
        buttonStyle: 'solid',
        animations: 'smooth',
        spacing: 'relaxed',
        shadows: 'soft'
      },
      friendly: {
        heroStyle: 'stacked',
        typography: 'approachable',
        colorScheme: 'friendly',
        cardStyle: 'rounded',
        sectionDivider: 'curve',
        buttonStyle: 'solid',
        animations: 'friendly',
        spacing: 'comfortable',
        shadows: 'subtle'
      }
    },
    defaultPersonality: 'friendly',
    selectPersonality: (siteData) => {
      const services = (siteData.services || []).join(' ').toLowerCase();
      const cosmetic = ['cosmetic', 'veneer', 'whitening', 'invisalign'];
      if (cosmetic.some(kw => services.includes(kw))) return 'clinical';
      return 'friendly';
    }
  },

  'real-estate': {
    personalities: {
      luxury: {
        heroStyle: 'fullwidth-dark',
        typography: 'editorial',
        colorScheme: 'luxury',
        cardStyle: 'minimal',
        sectionDivider: 'none',
        buttonStyle: 'outline',
        animations: 'elegant',
        spacing: 'luxurious',
        shadows: 'none'
      },
      professional: {
        heroStyle: 'split',
        typography: 'sophisticated',
        colorScheme: 'professional',
        cardStyle: 'bordered',
        sectionDivider: 'diagonal',
        buttonStyle: 'solid',
        animations: 'professional',
        spacing: 'normal',
        shadows: 'medium'
      },
      modern: {
        heroStyle: 'mesh-gradient',
        typography: 'geometric',
        colorScheme: 'modern',
        cardStyle: 'glass',
        sectionDivider: 'wave',
        buttonStyle: 'gradient',
        animations: 'smooth',
        spacing: 'relaxed',
        shadows: 'soft'
      }
    },
    defaultPersonality: 'professional',
    selectPersonality: (siteData) => {
      const text = (siteData.headlines?.join(' ') + siteData.paragraphs?.join(' ')).toLowerCase();
      const luxury = ['luxury', 'estate', 'million', 'exclusive', 'prestigious'];
      const modern = ['modern', 'contemporary', 'innovative', 'tech'];
      if (luxury.some(kw => text.includes(kw))) return 'luxury';
      if (modern.some(kw => text.includes(kw))) return 'modern';
      return 'professional';
    }
  },

  hvac: {
    personalities: {
      comfort: {
        heroStyle: 'split',
        typography: 'approachable',
        colorScheme: 'comfort',
        cardStyle: 'rounded',
        sectionDivider: 'wave',
        buttonStyle: 'solid',
        animations: 'friendly',
        spacing: 'comfortable',
        shadows: 'soft'
      },
      professional: {
        heroStyle: 'diagonal-split',
        typography: 'industrial',
        colorScheme: 'professional',
        cardStyle: 'bordered-accent',
        sectionDivider: 'diagonal',
        buttonStyle: 'solid',
        animations: 'professional',
        spacing: 'normal',
        shadows: 'medium'
      }
    },
    defaultPersonality: 'professional',
    selectPersonality: (siteData) => {
      if (siteData.trustSignals?.yearsInBusiness > 20) return 'professional';
      return 'comfort';
    }
  },

  general: {
    personalities: {
      professional: {
        heroStyle: 'split',
        typography: 'clean',
        colorScheme: 'professional',
        cardStyle: 'bordered',
        sectionDivider: 'wave',
        buttonStyle: 'solid',
        animations: 'professional',
        spacing: 'normal',
        shadows: 'medium'
      },
      modern: {
        heroStyle: 'mesh-gradient',
        typography: 'geometric',
        colorScheme: 'modern',
        cardStyle: 'glass',
        sectionDivider: 'diagonal',
        buttonStyle: 'gradient',
        animations: 'smooth',
        spacing: 'relaxed',
        shadows: 'soft'
      }
    },
    defaultPersonality: 'professional',
    selectPersonality: () => 'professional'
  }
};

// Map additional industries to base industries
const INDUSTRY_ALIASES = {
  'home-services': 'plumber',
  'contractor': 'plumber',
  'roofing': 'plumber',
  'landscaping': 'plumber',
  'salon': 'restaurant',
  'spa': 'restaurant',
  'retail': 'general',
  'accountant': 'lawyer',
  'insurance': 'lawyer',
  'financial': 'lawyer'
};

/**
 * Get design system for an industry
 * @param {string} industry - Industry name
 * @returns {object} Design system configuration
 */
export function getDesignSystem(industry) {
  // Check for alias
  const normalizedIndustry = INDUSTRY_ALIASES[industry] || industry;

  // Get design system, fall back to general
  return INDUSTRY_DESIGN_SYSTEMS[normalizedIndustry] || INDUSTRY_DESIGN_SYSTEMS.general;
}

/**
 * Get color palette for industry and personality
 * @param {string} industry - Industry name
 * @param {string} colorScheme - Color scheme name
 * @returns {object} Color palette
 */
export function getColorPalette(industry, colorScheme) {
  const normalizedIndustry = INDUSTRY_ALIASES[industry] || industry;
  const palettes = COLOR_PALETTES[normalizedIndustry] || COLOR_PALETTES.general;
  return palettes[colorScheme] || palettes[Object.keys(palettes)[0]];
}

/**
 * Get font pairing by name
 * @param {string} name - Font pairing name
 * @returns {object} Font configuration
 */
export function getFontPairing(name) {
  return FONT_PAIRINGS[name] || FONT_PAIRINGS.clean;
}

/**
 * Generate CSS variables for a design configuration
 * @param {string} industry - Industry name
 * @param {string} personality - Personality name
 * @returns {string} CSS variables block
 */
export function generateDesignCSS(industry, personality) {
  const designSystem = getDesignSystem(industry);
  const config = designSystem.personalities[personality] || designSystem.personalities[designSystem.defaultPersonality];

  const colors = getColorPalette(industry, config.colorScheme);
  const fonts = getFontPairing(config.typography);

  return `
    :root {
      /* Colors */
      --color-primary: ${colors.primary};
      --color-secondary: ${colors.secondary};
      --color-accent: ${colors.accent};
      --color-surface: ${colors.surface};
      --color-surface-dark: ${colors.surfaceDark};
      --color-text: ${colors.text};
      --color-text-muted: ${colors.textMuted};
      --gradient-hero: ${colors.gradient};
      --hero-overlay: ${colors.heroOverlay};

      /* Typography */
      --font-heading: ${fonts.heading};
      --font-body: ${fonts.body};
      --letter-spacing-heading: ${fonts.letterSpacing.heading};
      --letter-spacing-body: ${fonts.letterSpacing.body};
      --line-height-heading: ${fonts.lineHeight.heading};
      --line-height-body: ${fonts.lineHeight.body};

      /* Design tokens */
      --hero-style: ${config.heroStyle};
      --card-style: ${config.cardStyle};
      --section-divider: ${config.sectionDivider};
      --button-style: ${config.buttonStyle};
      --animation-style: ${config.animations};
      --spacing-style: ${config.spacing};
      --shadow-style: ${config.shadows};
    }
  `;
}

export default {
  FONT_PAIRINGS,
  COLOR_PALETTES,
  INDUSTRY_DESIGN_SYSTEMS,
  getDesignSystem,
  getColorPalette,
  getFontPairing,
  generateDesignCSS
};
