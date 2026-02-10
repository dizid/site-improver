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
  },

  // Humanist/Warm - personal, approachable, classic warmth
  humanist: {
    heading: "'Libre Baskerville', Georgia, serif",
    body: "'Lato', sans-serif",
    googleFonts: 'family=Libre+Baskerville:wght@400;700&family=Lato:wght@400;700',
    letterSpacing: { heading: '0', body: '0' },
    lineHeight: { heading: 1.2, body: 1.7 }
  },

  // Monospace-Modern - techy, distinctive, developer-feel
  'monospace-modern': {
    heading: "'JetBrains Mono', monospace",
    body: "'Inter', system-ui, sans-serif",
    googleFonts: 'family=JetBrains+Mono:wght@500;600;700&family=Inter:wght@400;500;600',
    letterSpacing: { heading: '-0.02em', body: '-0.01em' },
    lineHeight: { heading: 1.1, body: 1.6 }
  },

  // Condensed-Bold - impactful, bold, attention-grabbing
  'condensed-bold': {
    heading: "'Barlow Condensed', sans-serif",
    body: "'Barlow', sans-serif",
    googleFonts: 'family=Barlow+Condensed:wght@500;600;700;800&family=Barlow:wght@400;500;600',
    letterSpacing: { heading: '0.02em', body: '0' },
    lineHeight: { heading: 1.05, body: 1.65 }
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
    },
    emergency: {
      primary: '#dc2626',      // Red - urgency
      secondary: '#0f172a',    // Dark navy - authority
      accent: '#f87171',       // Light red
      surface: '#fef2f2',
      surfaceDark: '#7f1d1d',
      text: '#1e293b',
      textMuted: '#475569',
      gradient: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)',
      heroOverlay: 'linear-gradient(135deg, rgba(220,38,38,0.9) 0%, rgba(15,23,42,0.92) 100%)'
    },
    premium: {
      primary: '#374151',      // Charcoal - sophistication
      secondary: '#d4a843',    // Gold - luxury
      accent: '#fbbf24',       // Bright gold
      surface: '#f9fafb',
      surfaceDark: '#1f2937',
      text: '#111827',
      textMuted: '#6b7280',
      gradient: 'linear-gradient(135deg, #374151 0%, #1f2937 100%)',
      heroOverlay: 'linear-gradient(135deg, rgba(55,65,81,0.9) 0%, rgba(31,41,55,0.92) 100%)'
    },
    family: {
      primary: '#92400e',      // Warm brown - approachable
      secondary: '#65a30d',    // Sage green - friendly
      accent: '#fbbf24',       // Warm yellow
      surface: '#fffbeb',
      surfaceDark: '#78350f',
      text: '#1c1917',
      textMuted: '#78716c',
      gradient: 'linear-gradient(135deg, #92400e 0%, #78350f 100%)',
      heroOverlay: 'linear-gradient(135deg, rgba(146,64,14,0.88) 0%, rgba(120,53,15,0.9) 100%)'
    },
    craftsman: {
      primary: '#44403c',      // Stone - handcrafted
      secondary: '#b45309',    // Amber - warmth
      accent: '#78716c',       // Warm gray
      surface: '#fafaf9',
      surfaceDark: '#292524',
      text: '#1c1917',
      textMuted: '#57534e',
      gradient: 'linear-gradient(135deg, #44403c 0%, #292524 100%)',
      heroOverlay: 'linear-gradient(135deg, rgba(68,64,60,0.9) 0%, rgba(41,37,36,0.92) 100%)'
    },
    eco: {
      primary: '#047857',      // Emerald - eco
      secondary: '#0e7490',    // Teal - water
      accent: '#34d399',       // Light emerald
      surface: '#ecfdf5',
      surfaceDark: '#064e3b',
      text: '#064e3b',
      textMuted: '#047857',
      gradient: 'linear-gradient(135deg, #047857 0%, #064e3b 100%)',
      heroOverlay: 'linear-gradient(135deg, rgba(4,120,87,0.88) 0%, rgba(6,78,59,0.92) 100%)'
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
    },
    safety: {
      primary: '#ea580c',      // Orange - safety/caution
      secondary: '#1e293b',    // Dark slate
      accent: '#fbbf24',       // Yellow - warning
      surface: '#fff7ed',
      surfaceDark: '#9a3412',
      text: '#1c1917',
      textMuted: '#57534e',
      gradient: 'linear-gradient(135deg, #ea580c 0%, #9a3412 100%)',
      heroOverlay: 'linear-gradient(135deg, rgba(234,88,12,0.88) 0%, rgba(154,52,18,0.92) 100%)'
    },
    residential: {
      primary: '#059669',      // Green - home comfort
      secondary: '#1e3a5f',    // Navy - trust
      accent: '#34d399',       // Light green
      surface: '#f0fdf4',
      surfaceDark: '#047857',
      text: '#064e3b',
      textMuted: '#047857',
      gradient: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
      heroOverlay: 'linear-gradient(135deg, rgba(5,150,105,0.88) 0%, rgba(4,120,87,0.9) 100%)'
    },
    commercial: {
      primary: '#1e293b',      // Slate - industrial
      secondary: '#eab308',    // Yellow - electric
      accent: '#94a3b8',       // Cool gray
      surface: '#f8fafc',
      surfaceDark: '#0f172a',
      text: '#0f172a',
      textMuted: '#475569',
      gradient: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
      heroOverlay: 'linear-gradient(135deg, rgba(30,41,59,0.92) 0%, rgba(15,23,42,0.95) 100%)'
    },
    solar: {
      primary: '#d97706',      // Amber - solar
      secondary: '#166534',    // Green - eco
      accent: '#fbbf24',       // Gold - sun
      surface: '#fffbeb',
      surfaceDark: '#92400e',
      text: '#1c1917',
      textMuted: '#78716c',
      gradient: 'linear-gradient(135deg, #d97706 0%, #92400e 100%)',
      heroOverlay: 'linear-gradient(135deg, rgba(217,119,6,0.88) 0%, rgba(146,64,14,0.9) 100%)'
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
    },
    'fine-dining': {
      primary: '#0a0a0a',      // Black - premium
      secondary: '#c9a959',    // Gold - luxury
      accent: '#d4af37',       // Rich gold
      surface: '#fafaf9',
      surfaceDark: '#171717',
      text: '#0a0a0a',
      textMuted: '#525252',
      gradient: 'linear-gradient(135deg, #0a0a0a 0%, #171717 100%)',
      heroOverlay: 'linear-gradient(135deg, rgba(10,10,10,0.92) 0%, rgba(23,23,23,0.88) 100%)'
    },
    'fast-casual': {
      primary: '#ea580c',      // Orange - energy/appetite
      secondary: '#0d9488',    // Teal - fresh
      accent: '#fb923c',       // Light orange
      surface: '#fff7ed',
      surfaceDark: '#9a3412',
      text: '#1c1917',
      textMuted: '#78716c',
      gradient: 'linear-gradient(135deg, #ea580c 0%, #c2410c 100%)',
      heroOverlay: 'linear-gradient(135deg, rgba(234,88,12,0.85) 0%, rgba(194,65,12,0.9) 100%)'
    },
    ethnic: {
      primary: '#991b1b',      // Deep red - cultural warmth
      secondary: '#d97706',    // Warm amber
      accent: '#fbbf24',       // Gold
      surface: '#fef2f2',
      surfaceDark: '#7f1d1d',
      text: '#1c1917',
      textMuted: '#57534e',
      gradient: 'linear-gradient(135deg, #991b1b 0%, #7f1d1d 100%)',
      heroOverlay: 'linear-gradient(135deg, rgba(153,27,27,0.88) 0%, rgba(127,29,29,0.92) 100%)'
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
    },
    aggressive: {
      primary: '#1c1917',      // Dark charcoal - power
      secondary: '#b91c1c',    // Crimson - intensity
      accent: '#ef4444',       // Red
      surface: '#fafaf9',
      surfaceDark: '#0c0a09',
      text: '#1c1917',
      textMuted: '#57534e',
      gradient: 'linear-gradient(135deg, #1c1917 0%, #0c0a09 100%)',
      heroOverlay: 'linear-gradient(135deg, rgba(28,25,23,0.94) 0%, rgba(12,10,9,0.92) 100%)'
    },
    boutique: {
      primary: '#1e3a5f',      // Navy - trust
      secondary: '#92400e',    // Warm brown - personal
      accent: '#fbbf24',       // Gold
      surface: '#fef3c7',      // Warm cream
      surfaceDark: '#1e3a5f',
      text: '#1c1917',
      textMuted: '#78716c',
      gradient: 'linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%)',
      heroOverlay: 'linear-gradient(135deg, rgba(30,58,95,0.88) 0%, rgba(15,23,42,0.92) 100%)'
    },
    corporate: {
      primary: '#4b5563',      // Cool gray - enterprise
      secondary: '#3b82f6',    // Steel blue - trust
      accent: '#60a5fa',       // Light blue
      surface: '#f9fafb',
      surfaceDark: '#374151',
      text: '#111827',
      textMuted: '#6b7280',
      gradient: 'linear-gradient(135deg, #4b5563 0%, #374151 100%)',
      heroOverlay: 'linear-gradient(135deg, rgba(75,85,99,0.9) 0%, rgba(55,65,81,0.92) 100%)'
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
    },
    cosmetic: {
      primary: '#374151',      // Charcoal - sophisticated
      secondary: '#db2777',    // Pink - beauty
      accent: '#f9a8d4',       // Light pink
      surface: '#fce7f3',
      surfaceDark: '#831843',
      text: '#1f2937',
      textMuted: '#6b7280',
      gradient: 'linear-gradient(135deg, #374151 0%, #1f2937 100%)',
      heroOverlay: 'linear-gradient(135deg, rgba(55,65,81,0.9) 0%, rgba(31,41,55,0.92) 100%)'
    },
    pediatric: {
      primary: '#7c3aed',      // Purple - playful
      secondary: '#06b6d4',    // Cyan - fresh
      accent: '#a78bfa',       // Light purple
      surface: '#faf5ff',
      surfaceDark: '#5b21b6',
      text: '#1e1b4b',
      textMuted: '#7c3aed',
      gradient: 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)',
      heroOverlay: 'linear-gradient(135deg, rgba(124,58,237,0.85) 0%, rgba(91,33,182,0.9) 100%)'
    },
    modern: {
      primary: '#0284c7',      // Sky blue - clean
      secondary: '#0f172a',    // Dark slate
      accent: '#38bdf8',       // Light blue
      surface: '#f0f9ff',
      surfaceDark: '#0c4a6e',
      text: '#0c4a6e',
      textMuted: '#0369a1',
      gradient: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
      heroOverlay: 'linear-gradient(135deg, rgba(2,132,199,0.88) 0%, rgba(3,105,161,0.9) 100%)'
    },
    holistic: {
      primary: '#0f766e',      // Deep teal - wellness
      secondary: '#a16207',    // Earth tone
      accent: '#2dd4bf',       // Turquoise
      surface: '#f0fdfa',
      surfaceDark: '#115e59',
      text: '#134e4a',
      textMuted: '#0f766e',
      gradient: 'linear-gradient(135deg, #0f766e 0%, #115e59 100%)',
      heroOverlay: 'linear-gradient(135deg, rgba(15,118,110,0.88) 0%, rgba(17,94,89,0.92) 100%)'
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
    },
    urban: {
      primary: '#27272a',      // Charcoal - city energy
      secondary: '#2563eb',    // Electric blue
      accent: '#60a5fa',       // Light blue
      surface: '#fafafa',
      surfaceDark: '#18181b',
      text: '#18181b',
      textMuted: '#52525b',
      gradient: 'linear-gradient(135deg, #27272a 0%, #18181b 100%)',
      heroOverlay: 'linear-gradient(135deg, rgba(39,39,42,0.92) 0%, rgba(24,24,27,0.9) 100%)'
    },
    suburban: {
      primary: '#4d7c0f',      // Sage - family/nature
      secondary: '#92400e',    // Warm brown
      accent: '#84cc16',       // Lime green
      surface: '#faf5ef',
      surfaceDark: '#365314',
      text: '#1c1917',
      textMuted: '#78716c',
      gradient: 'linear-gradient(135deg, #4d7c0f 0%, #365314 100%)',
      heroOverlay: 'linear-gradient(135deg, rgba(77,124,15,0.88) 0%, rgba(54,83,20,0.92) 100%)'
    },
    coastal: {
      primary: '#0c4a6e',      // Deep ocean - coastal
      secondary: '#d4a843',    // Sand
      accent: '#38bdf8',       // Sky blue
      surface: '#f0f9ff',
      surfaceDark: '#075985',
      text: '#0c4a6e',
      textMuted: '#0369a1',
      gradient: 'linear-gradient(135deg, #0c4a6e 0%, #075985 100%)',
      heroOverlay: 'linear-gradient(135deg, rgba(12,74,110,0.88) 0%, rgba(7,89,133,0.9) 100%)'
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
    },
    emergency: {
      primary: '#dc2626',      // Red - urgency
      secondary: '#1e293b',    // Dark - serious
      accent: '#f87171',       // Light red
      surface: '#fef2f2',
      surfaceDark: '#991b1b',
      text: '#1e293b',
      textMuted: '#475569',
      gradient: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)',
      heroOverlay: 'linear-gradient(135deg, rgba(220,38,38,0.9) 0%, rgba(153,27,27,0.92) 100%)'
    },
    eco: {
      primary: '#166534',      // Green - sustainability
      secondary: '#0e7490',    // Teal
      accent: '#22c55e',       // Bright green
      surface: '#f0fdf4',
      surfaceDark: '#14532d',
      text: '#064e3b',
      textMuted: '#047857',
      gradient: 'linear-gradient(135deg, #166534 0%, #14532d 100%)',
      heroOverlay: 'linear-gradient(135deg, rgba(22,101,52,0.88) 0%, rgba(20,83,45,0.92) 100%)'
    },
    residential: {
      primary: '#7c3aed',      // Purple - premium home
      secondary: '#0891b2',    // Cyan - comfort
      accent: '#a78bfa',       // Light purple
      surface: '#faf5ff',
      surfaceDark: '#5b21b6',
      text: '#1e1b4b',
      textMuted: '#6b21a8',
      gradient: 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)',
      heroOverlay: 'linear-gradient(135deg, rgba(124,58,237,0.88) 0%, rgba(91,33,182,0.9) 100%)'
    }
  },

  'home-services': {
    reliable: {
      primary: '#1e3a5f',      // Navy - trust
      secondary: '#f59e0b',    // Amber - attention
      accent: '#60a5fa',       // Light blue
      surface: '#f8fafc',
      surfaceDark: '#0f172a',
      text: '#1e293b',
      textMuted: '#64748b',
      gradient: 'linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%)',
      heroOverlay: 'linear-gradient(135deg, rgba(30,58,95,0.9) 0%, rgba(15,23,42,0.92) 100%)'
    },
    'modern-home': {
      primary: '#334155',      // Slate - contemporary
      secondary: '#84cc16',    // Lime - fresh
      accent: '#a3e635',       // Light lime
      surface: '#f8fafc',
      surfaceDark: '#1e293b',
      text: '#0f172a',
      textMuted: '#475569',
      gradient: 'linear-gradient(135deg, #334155 0%, #1e293b 100%)',
      heroOverlay: 'linear-gradient(135deg, rgba(51,65,85,0.9) 0%, rgba(30,41,59,0.92) 100%)'
    },
    eco: {
      primary: '#166534',      // Forest green - sustainability
      secondary: '#a16207',    // Earth
      accent: '#22c55e',       // Bright green
      surface: '#f0fdf4',
      surfaceDark: '#14532d',
      text: '#1c1917',
      textMuted: '#57534e',
      gradient: 'linear-gradient(135deg, #166534 0%, #14532d 100%)',
      heroOverlay: 'linear-gradient(135deg, rgba(22,101,52,0.88) 0%, rgba(20,83,45,0.92) 100%)'
    },
    handyman: {
      primary: '#b45309',      // Amber - tools/craft
      secondary: '#1e293b',    // Dark
      accent: '#fbbf24',       // Gold
      surface: '#fffbeb',
      surfaceDark: '#78350f',
      text: '#1c1917',
      textMuted: '#78716c',
      gradient: 'linear-gradient(135deg, #b45309 0%, #92400e 100%)',
      heroOverlay: 'linear-gradient(135deg, rgba(180,83,9,0.88) 0%, rgba(146,64,14,0.92) 100%)'
    },
    premium: {
      primary: '#374151',      // Charcoal
      secondary: '#d4a843',    // Gold
      accent: '#fbbf24',       // Bright gold
      surface: '#f9fafb',
      surfaceDark: '#1f2937',
      text: '#111827',
      textMuted: '#6b7280',
      gradient: 'linear-gradient(135deg, #374151 0%, #1f2937 100%)',
      heroOverlay: 'linear-gradient(135deg, rgba(55,65,81,0.9) 0%, rgba(31,41,55,0.92) 100%)'
    },
    local: {
      primary: '#047857',      // Emerald - community
      secondary: '#854d0e',    // Brown
      accent: '#34d399',       // Light emerald
      surface: '#ecfdf5',
      surfaceDark: '#064e3b',
      text: '#064e3b',
      textMuted: '#047857',
      gradient: 'linear-gradient(135deg, #047857 0%, #064e3b 100%)',
      heroOverlay: 'linear-gradient(135deg, rgba(4,120,87,0.88) 0%, rgba(6,78,59,0.92) 100%)'
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
    },
    friendly: {
      primary: '#059669',      // Green - approachable
      secondary: '#0891b2',    // Cyan
      accent: '#34d399',       // Light green
      surface: '#f0fdf4',
      surfaceDark: '#047857',
      text: '#064e3b',
      textMuted: '#047857',
      gradient: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
      heroOverlay: 'linear-gradient(135deg, rgba(5,150,105,0.88) 0%, rgba(4,120,87,0.9) 100%)'
    },
    bold: {
      primary: '#dc2626',      // Red - attention
      secondary: '#0f172a',    // Dark
      accent: '#f87171',       // Light red
      surface: '#fef2f2',
      surfaceDark: '#991b1b',
      text: '#1e293b',
      textMuted: '#475569',
      gradient: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)',
      heroOverlay: 'linear-gradient(135deg, rgba(220,38,38,0.88) 0%, rgba(153,27,27,0.92) 100%)'
    },
    warm: {
      primary: '#92400e',      // Warm brown
      secondary: '#b45309',    // Amber
      accent: '#fbbf24',       // Gold
      surface: '#fffbeb',
      surfaceDark: '#78350f',
      text: '#1c1917',
      textMuted: '#78716c',
      gradient: 'linear-gradient(135deg, #92400e 0%, #78350f 100%)',
      heroOverlay: 'linear-gradient(135deg, rgba(146,64,14,0.88) 0%, rgba(120,53,15,0.92) 100%)'
    },
    elegant: {
      primary: '#1e1b4b',      // Deep indigo
      secondary: '#c9a227',    // Gold
      accent: '#818cf8',       // Indigo
      surface: '#eef2ff',
      surfaceDark: '#312e81',
      text: '#1e1b4b',
      textMuted: '#4338ca',
      gradient: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
      heroOverlay: 'linear-gradient(135deg, rgba(30,27,75,0.9) 0%, rgba(49,46,129,0.88) 100%)'
    },
    tech: {
      primary: '#0f172a',      // Dark slate
      secondary: '#06b6d4',    // Cyan
      accent: '#22d3ee',       // Bright cyan
      surface: '#f0f9ff',
      surfaceDark: '#1e293b',
      text: '#0f172a',
      textMuted: '#475569',
      gradient: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
      heroOverlay: 'linear-gradient(135deg, rgba(15,23,42,0.92) 0%, rgba(30,41,59,0.88) 100%)'
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
        shadows: 'medium',
        // Layout tokens for visual differentiation
        heroLayout: 'split-right',
        cardStyleVariant: 'bordered',
        buttonStyleVariant: 'solid',
        animationIntensity: 'moderate',
        sectionSpacing: 'normal'
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
        shadows: 'soft',
        heroLayout: 'centered',
        cardStyleVariant: 'flat',
        buttonStyleVariant: 'pill',
        animationIntensity: 'moderate',
        sectionSpacing: 'normal'
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
        shadows: 'subtle',
        heroLayout: 'split-left',
        cardStyleVariant: 'elevated',
        buttonStyleVariant: 'solid',
        animationIntensity: 'moderate',
        sectionSpacing: 'normal'
      },
      emergency: {
        heroStyle: 'fullwidth-dark',
        typography: 'condensed-bold',
        colorScheme: 'emergency',
        cardStyle: 'bordered-accent',
        sectionDivider: 'sharp',
        buttonStyle: 'solid',
        animations: 'professional',
        spacing: 'compact',
        shadows: 'strong',
        heroLayout: 'centered',
        cardStyleVariant: 'elevated',
        buttonStyleVariant: 'solid',
        animationIntensity: 'bold',
        sectionSpacing: 'compact'
      },
      premium: {
        heroStyle: 'text-focus',
        typography: 'sophisticated',
        colorScheme: 'premium',
        cardStyle: 'minimal',
        sectionDivider: 'none',
        buttonStyle: 'outline',
        animations: 'subtle',
        spacing: 'luxurious',
        shadows: 'soft',
        heroLayout: 'split-left',
        cardStyleVariant: 'glass',
        buttonStyleVariant: 'ghost',
        animationIntensity: 'subtle',
        sectionSpacing: 'spacious'
      },
      family: {
        heroStyle: 'stacked',
        typography: 'humanist',
        colorScheme: 'family',
        cardStyle: 'rounded',
        sectionDivider: 'curve',
        buttonStyle: 'solid',
        animations: 'friendly',
        spacing: 'comfortable',
        shadows: 'warm',
        heroLayout: 'split-right',
        cardStyleVariant: 'elevated',
        buttonStyleVariant: 'solid',
        animationIntensity: 'moderate',
        sectionSpacing: 'normal'
      },
      craftsman: {
        heroStyle: 'split',
        typography: 'warm',
        colorScheme: 'craftsman',
        cardStyle: 'textured',
        sectionDivider: 'organic',
        buttonStyle: 'solid',
        animations: 'natural',
        spacing: 'normal',
        shadows: 'medium',
        heroLayout: 'split-left',
        cardStyleVariant: 'bordered',
        buttonStyleVariant: 'solid',
        animationIntensity: 'subtle',
        sectionSpacing: 'normal'
      },
      eco: {
        heroStyle: 'split-offset',
        typography: 'clean',
        colorScheme: 'eco',
        cardStyle: 'bordered',
        sectionDivider: 'wave',
        buttonStyle: 'gradient',
        animations: 'smooth',
        spacing: 'relaxed',
        shadows: 'soft',
        heroLayout: 'split-right',
        cardStyleVariant: 'glass',
        buttonStyleVariant: 'pill',
        animationIntensity: 'subtle',
        sectionSpacing: 'spacious'
      }
    },
    defaultPersonality: 'trust',
    selectPersonality: (siteData) => {
      const scores = { trust: 0, modern: 0, local: 0, emergency: 0, premium: 0, family: 0, craftsman: 0, eco: 0 };
      const text = JSON.stringify(siteData).toLowerCase();

      // Years in business signal
      if (siteData.trustSignals?.yearsInBusiness > 25) scores.trust += 4;
      else if (siteData.trustSignals?.yearsInBusiness > 15) scores.trust += 2;

      // Emergency keywords
      const emergencyWords = ['emergency', '24/7', 'urgent', 'same-day', 'immediate', 'after hours'];
      if (emergencyWords.some(w => text.includes(w))) scores.emergency += 5;

      // Premium indicators
      const premiumWords = ['luxury', 'premium', 'high-end', 'exclusive', 'custom'];
      if (premiumWords.some(w => text.includes(w))) scores.premium += 4;

      // Family/community focus
      const familyWords = ['family', 'community', 'neighborhood', 'generations', 'dad', 'son'];
      if (familyWords.some(w => text.includes(w))) scores.family += 3;

      // Eco/green focus
      const ecoWords = ['eco', 'green', 'sustainable', 'tankless', 'energy efficient', 'water saving'];
      if (ecoWords.some(w => text.includes(w))) scores.eco += 4;

      // Craftsman indicators
      const craftsmanWords = ['master', 'craft', 'artisan', 'handmade', 'quality work', 'old-fashioned'];
      if (craftsmanWords.some(w => text.includes(w))) scores.craftsman += 3;

      // Modern tech
      const modernWords = ['app', 'online booking', 'digital', 'smart', 'technology'];
      if (modernWords.some(w => text.includes(w))) scores.modern += 3;

      // High reviews = local reputation
      if (siteData.rating >= 4.8 && siteData.reviewCount > 50) scores.local += 4;
      else if (siteData.rating >= 4.5 && siteData.reviewCount > 20) scores.local += 2;

      return Object.entries(scores).sort((a, b) => b[1] - a[1])[0]?.[0] || 'trust';
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
        shadows: 'strong',
        heroLayout: 'centered',
        cardStyleVariant: 'elevated',
        buttonStyleVariant: 'solid',
        animationIntensity: 'bold',
        sectionSpacing: 'compact'
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
        shadows: 'glow',
        heroLayout: 'split-left',
        cardStyleVariant: 'glass',
        buttonStyleVariant: 'pill',
        animationIntensity: 'moderate',
        sectionSpacing: 'normal'
      },
      safety: {
        heroStyle: 'fullwidth-dark',
        typography: 'condensed-bold',
        colorScheme: 'safety',
        cardStyle: 'bordered-accent',
        sectionDivider: 'diagonal',
        buttonStyle: 'solid',
        animations: 'professional',
        spacing: 'compact',
        shadows: 'strong',
        heroLayout: 'split-right',
        cardStyleVariant: 'bordered',
        buttonStyleVariant: 'solid',
        animationIntensity: 'moderate',
        sectionSpacing: 'normal'
      },
      residential: {
        heroStyle: 'stacked',
        typography: 'approachable',
        colorScheme: 'residential',
        cardStyle: 'rounded',
        sectionDivider: 'curve',
        buttonStyle: 'solid',
        animations: 'friendly',
        spacing: 'comfortable',
        shadows: 'soft',
        heroLayout: 'centered',
        cardStyleVariant: 'elevated',
        buttonStyleVariant: 'solid',
        animationIntensity: 'moderate',
        sectionSpacing: 'normal'
      },
      commercial: {
        heroStyle: 'text-focus',
        typography: 'strong',
        colorScheme: 'commercial',
        cardStyle: 'minimal',
        sectionDivider: 'sharp',
        buttonStyle: 'solid',
        animations: 'professional',
        spacing: 'normal',
        shadows: 'medium',
        heroLayout: 'text-only',
        cardStyleVariant: 'flat',
        buttonStyleVariant: 'outline',
        animationIntensity: 'subtle',
        sectionSpacing: 'spacious'
      },
      solar: {
        heroStyle: 'split-offset',
        typography: 'clean',
        colorScheme: 'solar',
        cardStyle: 'bordered',
        sectionDivider: 'wave',
        buttonStyle: 'gradient',
        animations: 'smooth',
        spacing: 'relaxed',
        shadows: 'soft',
        heroLayout: 'full-image',
        cardStyleVariant: 'glass',
        buttonStyleVariant: 'pill',
        animationIntensity: 'subtle',
        sectionSpacing: 'spacious'
      }
    },
    defaultPersonality: 'power',
    selectPersonality: (siteData) => {
      const scores = { power: 0, tech: 0, safety: 0, residential: 0, commercial: 0, solar: 0 };
      const text = JSON.stringify(siteData).toLowerCase();

      // Smart home / tech
      const techWords = ['smart home', 'automation', 'ev charger', 'tesla', 'home automation', 'iot'];
      if (techWords.some(w => text.includes(w))) scores.tech += 5;

      // Solar / green energy
      const solarWords = ['solar', 'renewable', 'battery', 'green energy', 'panel'];
      if (solarWords.some(w => text.includes(w))) scores.solar += 5;

      // Safety focus
      const safetyWords = ['safety', 'inspection', 'code compliance', 'licensed', 'certified', 'bonded'];
      if (safetyWords.some(w => text.includes(w))) scores.safety += 3;

      // Commercial focus
      const commercialWords = ['commercial', 'industrial', 'warehouse', 'office', 'retail space', 'business'];
      if (commercialWords.some(w => text.includes(w))) scores.commercial += 4;

      // Residential focus
      const residentialWords = ['home', 'residential', 'family', 'house', 'apartment', 'condo'];
      if (residentialWords.some(w => text.includes(w))) scores.residential += 3;

      // Established = power
      if (siteData.trustSignals?.yearsInBusiness > 20) scores.power += 3;

      return Object.entries(scores).sort((a, b) => b[1] - a[1])[0]?.[0] || 'power';
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
        shadows: 'none',
        heroLayout: 'full-image',
        cardStyleVariant: 'flat',
        buttonStyleVariant: 'ghost',
        animationIntensity: 'subtle',
        sectionSpacing: 'spacious'
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
        shadows: 'soft',
        heroLayout: 'centered',
        cardStyleVariant: 'elevated',
        buttonStyleVariant: 'solid',
        animationIntensity: 'moderate',
        sectionSpacing: 'normal'
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
        shadows: 'medium',
        heroLayout: 'split-left',
        cardStyleVariant: 'glass',
        buttonStyleVariant: 'outline',
        animationIntensity: 'moderate',
        sectionSpacing: 'normal'
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
        shadows: 'warm',
        heroLayout: 'full-image',
        cardStyleVariant: 'bordered',
        buttonStyleVariant: 'solid',
        animationIntensity: 'subtle',
        sectionSpacing: 'spacious'
      },
      'fine-dining': {
        heroStyle: 'fullwidth-dark',
        typography: 'editorial',
        colorScheme: 'fine-dining',
        cardStyle: 'minimal',
        sectionDivider: 'none',
        buttonStyle: 'outline',
        animations: 'subtle',
        spacing: 'luxurious',
        shadows: 'none',
        heroLayout: 'text-only',
        cardStyleVariant: 'flat',
        buttonStyleVariant: 'outline',
        animationIntensity: 'subtle',
        sectionSpacing: 'spacious'
      },
      'fast-casual': {
        heroStyle: 'diagonal-split',
        typography: 'condensed-bold',
        colorScheme: 'fast-casual',
        cardStyle: 'rounded',
        sectionDivider: 'diagonal',
        buttonStyle: 'solid',
        animations: 'playful',
        spacing: 'compact',
        shadows: 'medium',
        heroLayout: 'split-right',
        cardStyleVariant: 'elevated',
        buttonStyleVariant: 'pill',
        animationIntensity: 'bold',
        sectionSpacing: 'compact'
      },
      ethnic: {
        heroStyle: 'fullwidth',
        typography: 'humanist',
        colorScheme: 'ethnic',
        cardStyle: 'textured',
        sectionDivider: 'curve',
        buttonStyle: 'solid',
        animations: 'natural',
        spacing: 'comfortable',
        shadows: 'warm',
        heroLayout: 'full-image',
        cardStyleVariant: 'elevated',
        buttonStyleVariant: 'solid',
        animationIntensity: 'moderate',
        sectionSpacing: 'normal'
      }
    },
    defaultPersonality: 'casual',
    selectPersonality: (siteData) => {
      const scores = { elegant: 0, casual: 0, modern: 0, rustic: 0, 'fine-dining': 0, 'fast-casual': 0, ethnic: 0 };
      const text = JSON.stringify(siteData).toLowerCase();

      // Price range signals
      const priceRange = siteData.priceRange || '';
      if (priceRange === '$$$$') scores['fine-dining'] += 5;
      else if (priceRange === '$$$') scores.elegant += 4;
      else if (priceRange === '$') scores['fast-casual'] += 3;

      // Fine dining keywords
      const fineDiningWords = ['tasting menu', 'sommelier', 'michelin', 'prix fixe', 'reservation only', 'fine dining'];
      if (fineDiningWords.some(w => text.includes(w))) scores['fine-dining'] += 5;

      // Fast casual keywords
      const fastCasualWords = ['counter service', 'takeout', 'delivery', 'quick', 'grab', 'order online', 'fast'];
      if (fastCasualWords.some(w => text.includes(w))) scores['fast-casual'] += 3;

      // Ethnic/cultural keywords
      const ethnicWords = ['authentic', 'traditional recipe', 'homeland', 'thai', 'mexican', 'indian', 'chinese', 'japanese', 'korean', 'ethiopian', 'vietnamese', 'italian', 'greek'];
      if (ethnicWords.some(w => text.includes(w))) scores.ethnic += 4;

      // Rustic/farm keywords
      const rusticWords = ['farm', 'organic', 'local', 'homemade', 'traditional', 'garden', 'seasonal'];
      if (rusticWords.some(w => text.includes(w))) scores.rustic += 3;

      // Modern/fusion keywords
      const modernWords = ['fusion', 'contemporary', 'craft', 'artisan', 'innovative', 'molecular'];
      if (modernWords.some(w => text.includes(w))) scores.modern += 3;

      // Elegant indicators
      const elegantWords = ['wine', 'cocktail', 'lounge', 'upscale', 'elegant', 'sophisticated'];
      if (elegantWords.some(w => text.includes(w))) scores.elegant += 3;

      return Object.entries(scores).sort((a, b) => b[1] - a[1])[0]?.[0] || 'casual';
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
        shadows: 'none',
        heroLayout: 'text-only',
        cardStyleVariant: 'flat',
        buttonStyleVariant: 'ghost',
        animationIntensity: 'subtle',
        sectionSpacing: 'spacious'
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
        shadows: 'soft',
        heroLayout: 'split-left',
        cardStyleVariant: 'bordered',
        buttonStyleVariant: 'solid',
        animationIntensity: 'moderate',
        sectionSpacing: 'normal'
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
        shadows: 'medium',
        heroLayout: 'text-only',
        cardStyleVariant: 'flat',
        buttonStyleVariant: 'pill',
        animationIntensity: 'moderate',
        sectionSpacing: 'normal'
      },
      aggressive: {
        heroStyle: 'fullwidth-dark',
        typography: 'condensed-bold',
        colorScheme: 'aggressive',
        cardStyle: 'bordered-accent',
        sectionDivider: 'sharp',
        buttonStyle: 'solid',
        animations: 'professional',
        spacing: 'compact',
        shadows: 'strong',
        heroLayout: 'centered',
        cardStyleVariant: 'elevated',
        buttonStyleVariant: 'solid',
        animationIntensity: 'bold',
        sectionSpacing: 'compact'
      },
      boutique: {
        heroStyle: 'stacked',
        typography: 'humanist',
        colorScheme: 'boutique',
        cardStyle: 'rounded',
        sectionDivider: 'curve',
        buttonStyle: 'solid',
        animations: 'friendly',
        spacing: 'comfortable',
        shadows: 'warm',
        heroLayout: 'split-right',
        cardStyleVariant: 'glass',
        buttonStyleVariant: 'solid',
        animationIntensity: 'subtle',
        sectionSpacing: 'normal'
      },
      corporate: {
        heroStyle: 'mesh-gradient',
        typography: 'geometric',
        colorScheme: 'corporate',
        cardStyle: 'glass',
        sectionDivider: 'diagonal',
        buttonStyle: 'gradient',
        animations: 'smooth',
        spacing: 'relaxed',
        shadows: 'soft',
        heroLayout: 'split-left',
        cardStyleVariant: 'glass',
        buttonStyleVariant: 'outline',
        animationIntensity: 'subtle',
        sectionSpacing: 'spacious'
      }
    },
    defaultPersonality: 'prestigious',
    selectPersonality: (siteData) => {
      const scores = { prestigious: 0, approachable: 0, modern: 0, aggressive: 0, boutique: 0, corporate: 0 };
      const text = JSON.stringify(siteData).toLowerCase();

      // Aggressive/trial lawyer signals
      const aggressiveWords = ['fight', 'aggressive', 'trial', 'verdict', 'million dollar', 'no fee unless', 'we win'];
      if (aggressiveWords.some(w => text.includes(w))) scores.aggressive += 5;

      // Personal injury / approachable
      const personalInjuryWords = ['injury', 'accident', 'workers comp', 'disability', 'slip and fall', 'medical malpractice'];
      if (personalInjuryWords.some(w => text.includes(w))) scores.approachable += 3;

      // Corporate / enterprise
      const corporateWords = ['corporate', 'mergers', 'acquisitions', 'securities', 'compliance', 'fortune 500'];
      if (corporateWords.some(w => text.includes(w))) scores.corporate += 4;

      // Boutique / personal firm
      const boutiqueWords = ['boutique', 'personalized', 'small firm', 'individual attention', 'family law', 'estate planning'];
      if (boutiqueWords.some(w => text.includes(w))) scores.boutique += 4;

      // Modern / tech law
      const modernWords = ['technology', 'startup', 'intellectual property', 'patent', 'tech', 'digital'];
      if (modernWords.some(w => text.includes(w))) scores.modern += 3;

      // Prestigious indicators
      const prestigiousWords = ['established', 'renowned', 'prestigious', 'landmark', 'decades of', 'tradition'];
      if (prestigiousWords.some(w => text.includes(w))) scores.prestigious += 3;
      if (siteData.trustSignals?.yearsInBusiness > 30) scores.prestigious += 3;

      return Object.entries(scores).sort((a, b) => b[1] - a[1])[0]?.[0] || 'prestigious';
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
        shadows: 'soft',
        heroLayout: 'split-left',
        cardStyleVariant: 'bordered',
        buttonStyleVariant: 'solid',
        animationIntensity: 'moderate',
        sectionSpacing: 'normal'
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
        shadows: 'subtle',
        heroLayout: 'split-right',
        cardStyleVariant: 'elevated',
        buttonStyleVariant: 'pill',
        animationIntensity: 'moderate',
        sectionSpacing: 'normal'
      },
      cosmetic: {
        heroStyle: 'fullwidth-dark',
        typography: 'sophisticated',
        colorScheme: 'cosmetic',
        cardStyle: 'minimal',
        sectionDivider: 'none',
        buttonStyle: 'outline',
        animations: 'subtle',
        spacing: 'luxurious',
        shadows: 'soft',
        heroLayout: 'full-image',
        cardStyleVariant: 'glass',
        buttonStyleVariant: 'outline',
        animationIntensity: 'subtle',
        sectionSpacing: 'spacious'
      },
      pediatric: {
        heroStyle: 'stacked',
        typography: 'approachable',
        colorScheme: 'pediatric',
        cardStyle: 'rounded',
        sectionDivider: 'curve',
        buttonStyle: 'solid',
        animations: 'playful',
        spacing: 'comfortable',
        shadows: 'soft',
        heroLayout: 'centered',
        cardStyleVariant: 'elevated',
        buttonStyleVariant: 'pill',
        animationIntensity: 'moderate',
        sectionSpacing: 'normal'
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
        shadows: 'soft',
        heroLayout: 'split-left',
        cardStyleVariant: 'glass',
        buttonStyleVariant: 'pill',
        animationIntensity: 'moderate',
        sectionSpacing: 'normal'
      },
      holistic: {
        heroStyle: 'split-offset',
        typography: 'humanist',
        colorScheme: 'holistic',
        cardStyle: 'textured',
        sectionDivider: 'organic',
        buttonStyle: 'solid',
        animations: 'natural',
        spacing: 'comfortable',
        shadows: 'warm',
        heroLayout: 'split-right',
        cardStyleVariant: 'bordered',
        buttonStyleVariant: 'solid',
        animationIntensity: 'subtle',
        sectionSpacing: 'spacious'
      }
    },
    defaultPersonality: 'friendly',
    selectPersonality: (siteData) => {
      const scores = { clinical: 0, friendly: 0, cosmetic: 0, pediatric: 0, modern: 0, holistic: 0 };
      const text = JSON.stringify(siteData).toLowerCase();

      // Cosmetic dentistry
      const cosmeticWords = ['cosmetic', 'veneer', 'whitening', 'invisalign', 'smile makeover', 'aesthetic', 'beauty'];
      if (cosmeticWords.some(w => text.includes(w))) scores.cosmetic += 5;

      // Pediatric dentistry
      const pediatricWords = ['pediatric', 'children', 'kids', 'child', 'fun', 'family friendly', 'toddler'];
      if (pediatricWords.some(w => text.includes(w))) scores.pediatric += 5;

      // Holistic / natural
      const holisticWords = ['holistic', 'natural', 'mercury-free', 'biological', 'biocompatible', 'wellness'];
      if (holisticWords.some(w => text.includes(w))) scores.holistic += 4;

      // Modern / tech
      const modernWords = ['laser', 'digital', '3d', 'cerec', 'technology', 'state-of-the-art', 'advanced'];
      if (modernWords.some(w => text.includes(w))) scores.modern += 3;

      // Clinical / specialist
      const clinicalWords = ['oral surgery', 'implant', 'periodon', 'endodon', 'prosthodon', 'specialist'];
      if (clinicalWords.some(w => text.includes(w))) scores.clinical += 3;

      // Friendly general
      const friendlyWords = ['family', 'gentle', 'caring', 'comfortable', 'warm', 'welcome'];
      if (friendlyWords.some(w => text.includes(w))) scores.friendly += 2;

      return Object.entries(scores).sort((a, b) => b[1] - a[1])[0]?.[0] || 'friendly';
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
        shadows: 'none',
        heroLayout: 'full-image',
        cardStyleVariant: 'glass',
        buttonStyleVariant: 'ghost',
        animationIntensity: 'subtle',
        sectionSpacing: 'spacious'
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
        shadows: 'medium',
        heroLayout: 'split-right',
        cardStyleVariant: 'bordered',
        buttonStyleVariant: 'solid',
        animationIntensity: 'moderate',
        sectionSpacing: 'normal'
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
        shadows: 'soft',
        heroLayout: 'split-left',
        cardStyleVariant: 'glass',
        buttonStyleVariant: 'pill',
        animationIntensity: 'moderate',
        sectionSpacing: 'normal'
      },
      urban: {
        heroStyle: 'fullwidth-dark',
        typography: 'condensed-bold',
        colorScheme: 'urban',
        cardStyle: 'glass',
        sectionDivider: 'sharp',
        buttonStyle: 'gradient',
        animations: 'smooth',
        spacing: 'compact',
        shadows: 'medium',
        heroLayout: 'full-image',
        cardStyleVariant: 'glass',
        buttonStyleVariant: 'outline',
        animationIntensity: 'moderate',
        sectionSpacing: 'normal'
      },
      suburban: {
        heroStyle: 'stacked',
        typography: 'humanist',
        colorScheme: 'suburban',
        cardStyle: 'rounded',
        sectionDivider: 'curve',
        buttonStyle: 'solid',
        animations: 'friendly',
        spacing: 'comfortable',
        shadows: 'soft',
        heroLayout: 'centered',
        cardStyleVariant: 'elevated',
        buttonStyleVariant: 'solid',
        animationIntensity: 'moderate',
        sectionSpacing: 'normal'
      },
      coastal: {
        heroStyle: 'fullwidth',
        typography: 'clean',
        colorScheme: 'coastal',
        cardStyle: 'bordered',
        sectionDivider: 'wave',
        buttonStyle: 'solid',
        animations: 'natural',
        spacing: 'relaxed',
        shadows: 'soft',
        heroLayout: 'full-image',
        cardStyleVariant: 'flat',
        buttonStyleVariant: 'solid',
        animationIntensity: 'subtle',
        sectionSpacing: 'spacious'
      }
    },
    defaultPersonality: 'professional',
    selectPersonality: (siteData) => {
      const scores = { luxury: 0, professional: 0, modern: 0, urban: 0, suburban: 0, coastal: 0 };
      const text = JSON.stringify(siteData).toLowerCase();

      // Luxury indicators
      const luxuryWords = ['luxury', 'estate', 'million', 'exclusive', 'prestigious', 'penthouse', 'mansion'];
      if (luxuryWords.some(w => text.includes(w))) scores.luxury += 5;

      // Urban/city
      const urbanWords = ['downtown', 'urban', 'city', 'condo', 'loft', 'high-rise', 'metro'];
      if (urbanWords.some(w => text.includes(w))) scores.urban += 4;

      // Suburban/family
      const suburbanWords = ['suburb', 'family home', 'school district', 'neighborhood', 'backyard', 'community'];
      if (suburbanWords.some(w => text.includes(w))) scores.suburban += 4;

      // Coastal/beach
      const coastalWords = ['beach', 'ocean', 'waterfront', 'coastal', 'lakefront', 'marina', 'bay'];
      if (coastalWords.some(w => text.includes(w))) scores.coastal += 5;

      // Modern/tech
      const modernWords = ['modern', 'contemporary', 'innovative', 'virtual tour', 'tech', '3d'];
      if (modernWords.some(w => text.includes(w))) scores.modern += 3;

      // Established = professional
      if (siteData.trustSignals?.yearsInBusiness > 15) scores.professional += 2;

      return Object.entries(scores).sort((a, b) => b[1] - a[1])[0]?.[0] || 'professional';
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
        shadows: 'soft',
        heroLayout: 'split-right',
        cardStyleVariant: 'elevated',
        buttonStyleVariant: 'solid',
        animationIntensity: 'moderate',
        sectionSpacing: 'normal'
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
        shadows: 'medium',
        heroLayout: 'split-left',
        cardStyleVariant: 'bordered',
        buttonStyleVariant: 'solid',
        animationIntensity: 'moderate',
        sectionSpacing: 'normal'
      },
      emergency: {
        heroStyle: 'fullwidth-dark',
        typography: 'condensed-bold',
        colorScheme: 'emergency',
        cardStyle: 'bordered-accent',
        sectionDivider: 'sharp',
        buttonStyle: 'solid',
        animations: 'professional',
        spacing: 'compact',
        shadows: 'strong',
        heroLayout: 'centered',
        cardStyleVariant: 'elevated',
        buttonStyleVariant: 'solid',
        animationIntensity: 'bold',
        sectionSpacing: 'compact'
      },
      eco: {
        heroStyle: 'split-offset',
        typography: 'clean',
        colorScheme: 'eco',
        cardStyle: 'bordered',
        sectionDivider: 'wave',
        buttonStyle: 'gradient',
        animations: 'smooth',
        spacing: 'relaxed',
        shadows: 'soft',
        heroLayout: 'split-right',
        cardStyleVariant: 'glass',
        buttonStyleVariant: 'pill',
        animationIntensity: 'subtle',
        sectionSpacing: 'spacious'
      },
      residential: {
        heroStyle: 'stacked',
        typography: 'humanist',
        colorScheme: 'residential',
        cardStyle: 'rounded',
        sectionDivider: 'curve',
        buttonStyle: 'solid',
        animations: 'friendly',
        spacing: 'comfortable',
        shadows: 'soft',
        heroLayout: 'split-left',
        cardStyleVariant: 'elevated',
        buttonStyleVariant: 'solid',
        animationIntensity: 'moderate',
        sectionSpacing: 'normal'
      },
      modern: {
        heroStyle: 'mesh-gradient',
        typography: 'geometric',
        colorScheme: 'comfort',
        cardStyle: 'glass',
        sectionDivider: 'diagonal',
        buttonStyle: 'gradient',
        animations: 'smooth',
        spacing: 'relaxed',
        shadows: 'glow',
        heroLayout: 'split-left',
        cardStyleVariant: 'glass',
        buttonStyleVariant: 'pill',
        animationIntensity: 'moderate',
        sectionSpacing: 'normal'
      }
    },
    defaultPersonality: 'professional',
    selectPersonality: (siteData) => {
      const scores = { comfort: 0, professional: 0, emergency: 0, eco: 0, residential: 0, modern: 0 };
      const text = JSON.stringify(siteData).toLowerCase();

      // Emergency signals
      const emergencyWords = ['emergency', '24/7', 'urgent', 'same-day', 'breakdown', 'no heat', 'no ac'];
      if (emergencyWords.some(w => text.includes(w))) scores.emergency += 5;

      // Eco / energy efficiency
      const ecoWords = ['energy efficient', 'green', 'eco', 'heat pump', 'geothermal', 'solar', 'sustainable'];
      if (ecoWords.some(w => text.includes(w))) scores.eco += 4;

      // Modern / smart home
      const modernWords = ['smart thermostat', 'wifi', 'app', 'technology', 'zoning', 'ductless'];
      if (modernWords.some(w => text.includes(w))) scores.modern += 3;

      // Residential / family
      const residentialWords = ['home', 'family', 'residential', 'comfort', 'cozy'];
      if (residentialWords.some(w => text.includes(w))) scores.residential += 2;

      // Established
      if (siteData.trustSignals?.yearsInBusiness > 20) scores.professional += 3;

      // Comfort focus
      const comfortWords = ['comfort', 'indoor air quality', 'humidity', 'air purification'];
      if (comfortWords.some(w => text.includes(w))) scores.comfort += 3;

      return Object.entries(scores).sort((a, b) => b[1] - a[1])[0]?.[0] || 'professional';
    }
  },

  'home-services': {
    personalities: {
      reliable: {
        heroStyle: 'diagonal-split',
        typography: 'industrial',
        colorScheme: 'reliable',
        cardStyle: 'bordered-accent',
        sectionDivider: 'diagonal',
        buttonStyle: 'solid',
        animations: 'professional',
        spacing: 'normal',
        shadows: 'medium',
        heroLayout: 'split-right',
        cardStyleVariant: 'bordered',
        buttonStyleVariant: 'solid',
        animationIntensity: 'moderate',
        sectionSpacing: 'normal'
      },
      'modern-home': {
        heroStyle: 'mesh-gradient',
        typography: 'geometric',
        colorScheme: 'modern-home',
        cardStyle: 'glass',
        sectionDivider: 'wave',
        buttonStyle: 'gradient',
        animations: 'smooth',
        spacing: 'relaxed',
        shadows: 'soft',
        heroLayout: 'split-left',
        cardStyleVariant: 'glass',
        buttonStyleVariant: 'pill',
        animationIntensity: 'moderate',
        sectionSpacing: 'normal'
      },
      eco: {
        heroStyle: 'split-offset',
        typography: 'clean',
        colorScheme: 'eco',
        cardStyle: 'bordered',
        sectionDivider: 'wave',
        buttonStyle: 'gradient',
        animations: 'smooth',
        spacing: 'relaxed',
        shadows: 'soft',
        heroLayout: 'split-right',
        cardStyleVariant: 'glass',
        buttonStyleVariant: 'pill',
        animationIntensity: 'subtle',
        sectionSpacing: 'spacious'
      },
      handyman: {
        heroStyle: 'fullwidth',
        typography: 'warm',
        colorScheme: 'handyman',
        cardStyle: 'textured',
        sectionDivider: 'organic',
        buttonStyle: 'solid',
        animations: 'natural',
        spacing: 'comfortable',
        shadows: 'warm',
        heroLayout: 'centered',
        cardStyleVariant: 'elevated',
        buttonStyleVariant: 'solid',
        animationIntensity: 'moderate',
        sectionSpacing: 'normal'
      },
      premium: {
        heroStyle: 'text-focus',
        typography: 'sophisticated',
        colorScheme: 'premium',
        cardStyle: 'minimal',
        sectionDivider: 'none',
        buttonStyle: 'outline',
        animations: 'subtle',
        spacing: 'luxurious',
        shadows: 'soft',
        heroLayout: 'split-left',
        cardStyleVariant: 'glass',
        buttonStyleVariant: 'ghost',
        animationIntensity: 'subtle',
        sectionSpacing: 'spacious'
      },
      local: {
        heroStyle: 'stacked',
        typography: 'humanist',
        colorScheme: 'local',
        cardStyle: 'rounded',
        sectionDivider: 'curve',
        buttonStyle: 'solid',
        animations: 'friendly',
        spacing: 'comfortable',
        shadows: 'subtle',
        heroLayout: 'split-right',
        cardStyleVariant: 'elevated',
        buttonStyleVariant: 'solid',
        animationIntensity: 'moderate',
        sectionSpacing: 'normal'
      }
    },
    defaultPersonality: 'reliable',
    selectPersonality: (siteData) => {
      const scores = { reliable: 0, 'modern-home': 0, eco: 0, handyman: 0, premium: 0, local: 0 };
      const text = JSON.stringify(siteData).toLowerCase();

      // Eco/green
      const ecoWords = ['eco', 'green', 'sustainable', 'energy efficient', 'solar'];
      if (ecoWords.some(w => text.includes(w))) scores.eco += 4;

      // Handyman
      const handymanWords = ['handyman', 'odd jobs', 'fix', 'repair', 'maintenance', 'honey-do'];
      if (handymanWords.some(w => text.includes(w))) scores.handyman += 4;

      // Premium / luxury
      const premiumWords = ['luxury', 'premium', 'high-end', 'custom', 'exclusive'];
      if (premiumWords.some(w => text.includes(w))) scores.premium += 4;

      // Modern home
      const modernWords = ['smart home', 'renovation', 'remodel', 'modern', 'contemporary', 'design'];
      if (modernWords.some(w => text.includes(w))) scores['modern-home'] += 3;

      // Local / community
      const localWords = ['local', 'community', 'neighborhood', 'family', 'trusted'];
      if (localWords.some(w => text.includes(w))) scores.local += 3;

      // Reliable / established
      if (siteData.trustSignals?.yearsInBusiness > 15) scores.reliable += 3;
      if (siteData.rating >= 4.7 && siteData.reviewCount > 30) scores.reliable += 2;

      return Object.entries(scores).sort((a, b) => b[1] - a[1])[0]?.[0] || 'reliable';
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
        shadows: 'medium',
        heroLayout: 'split-left',
        cardStyleVariant: 'bordered',
        buttonStyleVariant: 'solid',
        animationIntensity: 'moderate',
        sectionSpacing: 'normal'
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
        shadows: 'soft',
        heroLayout: 'split-left',
        cardStyleVariant: 'glass',
        buttonStyleVariant: 'pill',
        animationIntensity: 'moderate',
        sectionSpacing: 'normal'
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
        shadows: 'soft',
        heroLayout: 'centered',
        cardStyleVariant: 'elevated',
        buttonStyleVariant: 'solid',
        animationIntensity: 'moderate',
        sectionSpacing: 'normal'
      },
      bold: {
        heroStyle: 'fullwidth-dark',
        typography: 'condensed-bold',
        colorScheme: 'bold',
        cardStyle: 'bordered-accent',
        sectionDivider: 'sharp',
        buttonStyle: 'solid',
        animations: 'professional',
        spacing: 'compact',
        shadows: 'strong',
        heroLayout: 'centered',
        cardStyleVariant: 'elevated',
        buttonStyleVariant: 'solid',
        animationIntensity: 'bold',
        sectionSpacing: 'compact'
      },
      warm: {
        heroStyle: 'fullwidth',
        typography: 'humanist',
        colorScheme: 'warm',
        cardStyle: 'textured',
        sectionDivider: 'organic',
        buttonStyle: 'solid',
        animations: 'natural',
        spacing: 'comfortable',
        shadows: 'warm',
        heroLayout: 'split-right',
        cardStyleVariant: 'elevated',
        buttonStyleVariant: 'solid',
        animationIntensity: 'moderate',
        sectionSpacing: 'normal'
      },
      elegant: {
        heroStyle: 'text-focus',
        typography: 'editorial',
        colorScheme: 'elegant',
        cardStyle: 'minimal',
        sectionDivider: 'none',
        buttonStyle: 'outline',
        animations: 'subtle',
        spacing: 'luxurious',
        shadows: 'none',
        heroLayout: 'text-only',
        cardStyleVariant: 'flat',
        buttonStyleVariant: 'outline',
        animationIntensity: 'subtle',
        sectionSpacing: 'spacious'
      },
      tech: {
        heroStyle: 'mesh-gradient',
        typography: 'monospace-modern',
        colorScheme: 'tech',
        cardStyle: 'glass',
        sectionDivider: 'diagonal',
        buttonStyle: 'gradient',
        animations: 'smooth',
        spacing: 'relaxed',
        shadows: 'glow',
        heroLayout: 'split-left',
        cardStyleVariant: 'glass',
        buttonStyleVariant: 'pill',
        animationIntensity: 'moderate',
        sectionSpacing: 'normal'
      }
    },
    defaultPersonality: 'professional',
    selectPersonality: (siteData) => {
      const scores = { professional: 0, modern: 0, friendly: 0, bold: 0, warm: 0, elegant: 0, tech: 0 };
      const text = JSON.stringify(siteData).toLowerCase();

      // Tech/startup
      const techWords = ['technology', 'software', 'saas', 'startup', 'app', 'digital', 'ai', 'cloud'];
      if (techWords.some(w => text.includes(w))) scores.tech += 4;

      // Friendly/local
      const friendlyWords = ['family', 'community', 'neighborhood', 'local', 'friendly'];
      if (friendlyWords.some(w => text.includes(w))) scores.friendly += 3;

      // Bold/urgent
      const boldWords = ['urgent', 'immediate', '24/7', 'fast', 'now', 'limited time'];
      if (boldWords.some(w => text.includes(w))) scores.bold += 3;

      // Warm/organic
      const warmWords = ['organic', 'natural', 'wellness', 'holistic', 'handmade', 'artisan'];
      if (warmWords.some(w => text.includes(w))) scores.warm += 3;

      // Elegant/premium
      const elegantWords = ['luxury', 'premium', 'exclusive', 'boutique', 'bespoke'];
      if (elegantWords.some(w => text.includes(w))) scores.elegant += 4;

      // Modern
      const modernWords = ['modern', 'innovative', 'contemporary', 'cutting-edge'];
      if (modernWords.some(w => text.includes(w))) scores.modern += 2;

      // Professional baseline
      if (siteData.trustSignals?.yearsInBusiness > 10) scores.professional += 2;

      return Object.entries(scores).sort((a, b) => b[1] - a[1])[0]?.[0] || 'professional';
    }
  }
};

// Map additional industries to base industries
// Map additional industries to base industries for design system lookup
// home-services now has its own design system
const INDUSTRY_ALIASES = {
  'contractor': 'home-services',
  'roofing': 'home-services',
  'landscaping': 'home-services',
  'cleaning': 'home-services',
  'salon': 'restaurant',
  'spa': 'restaurant',
  'retail': 'general',
  'accountant': 'lawyer',
  'insurance': 'lawyer',
  'financial': 'lawyer',
  'auto': 'home-services'
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
/**
 * Animation timing presets per personality style
 * Maps animation style names to CSS custom properties
 */
const ANIMATION_PRESETS = {
  // Elegant/prestigious - slow, refined motion
  subtle: { duration: '0.8s', easing: 'cubic-bezier(0.4, 0, 0.2, 1)' },
  elegant: { duration: '0.8s', easing: 'cubic-bezier(0.4, 0, 0.2, 1)' },
  // Bold/industrial/emergency - snappy, impactful
  professional: { duration: '0.3s', easing: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)' },
  // Modern/geometric - balanced, clean
  smooth: { duration: '0.5s', easing: 'cubic-bezier(0.25, 0.1, 0.25, 1)' },
  // Friendly/approachable - bouncy, warm
  friendly: { duration: '0.6s', easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' },
  playful: { duration: '0.6s', easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' },
  natural: { duration: '0.7s', easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)' }
};

/**
 * Personalities that get mesh gradient hero backgrounds
 * Used for modern/premium visual styles
 */
const MESH_GRADIENT_STYLES = ['mesh-gradient', 'split-offset'];

export function generateDesignCSS(industry, personality) {
  const designSystem = getDesignSystem(industry);
  const config = designSystem.personalities[personality] || designSystem.personalities[designSystem.defaultPersonality];

  const colors = getColorPalette(industry, config.colorScheme);
  const fonts = getFontPairing(config.typography);

  // Resolve animation timing for this personality
  const animPreset = ANIMATION_PRESETS[config.animations] || ANIMATION_PRESETS.smooth;

  let css = `
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

      /* Layout tokens for visual differentiation */
      --hero-layout: ${config.heroLayout || 'centered'};
      --card-style-variant: ${config.cardStyleVariant || 'elevated'};
      --btn-style-variant: ${config.buttonStyleVariant || 'solid'};
      --animation-intensity: ${config.animationIntensity || 'moderate'};
      --section-spacing: ${config.sectionSpacing || 'normal'};

      /* Animation timing per personality */
      --animation-duration: ${animPreset.duration};
      --animation-easing: ${animPreset.easing};
    }

    /* Apply animation timing to interactive elements */
    .fade-in-up {
      transition: opacity var(--animation-duration) var(--animation-easing),
                  transform var(--animation-duration) var(--animation-easing);
    }
    .service-card, .why-us-item, .testimonial {
      transition: transform var(--animation-duration) var(--animation-easing),
                  box-shadow var(--animation-duration) var(--animation-easing);
    }
  `;

  // Add mesh gradient background for modern/premium hero styles
  if (MESH_GRADIENT_STYLES.includes(config.heroStyle)) {
    css += `
    .hero--mesh-gradient::before,
    .hero--split-offset::before {
      content: '';
      position: absolute;
      inset: 0;
      background:
        radial-gradient(at 20% 30%, ${colors.primary} 0%, transparent 50%),
        radial-gradient(at 80% 70%, ${colors.accent} 0%, transparent 50%),
        radial-gradient(at 50% 50%, ${colors.secondary} 0%, transparent 50%);
      opacity: 0.15;
      z-index: 0;
    }
    `;
  }

  return css;
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
