/**
 * Verified local knowledge and landmarks for Tamil Nadu, UAE, and major Indian cities.
 * Provides authentic, factually grounded conversational color without hallucinated news or events.
 *
 * Rule: Stable verified cultural facts, landmarks, and famous foods only.
 * No fabricated recent events or unverified festival schedules.
 */

export interface LocalFact {
  displayName: string;
  fact: string;
}

const LOCAL_KNOWLEDGE: Record<string, LocalFact> = {
  tirunelveli: {
    displayName: 'Tirunelveli',
    fact: 'Nellaiappar Kovil-um Tirunelveli halwa-vum famous-la sir! Super.',
  },
  nellai: {
    displayName: 'Tirunelveli',
    fact: 'Nellaiappar Kovil-um Tirunelveli halwa-vum famous-la sir! Super.',
  },
  madurai: {
    displayName: 'Madurai',
    fact: 'Meenakshi Amman Kovil-ku famous-aana ooru! Nice sir.',
  },
  thanjavur: {
    displayName: 'Thanjavur',
    fact: 'Brihadisvara Temple (Periya Kovil) irukkura historic place-la! Super sir.',
  },
  tanjore: {
    displayName: 'Thanjavur',
    fact: 'Brihadisvara Temple (Periya Kovil) irukkura historic place-la! Super sir.',
  },
  kanyakumari: {
    displayName: 'Kanyakumari',
    fact: 'Vivekananda Rock Memorial, sea view ellam famous-la! Nice sir.',
  },
  coimbatore: {
    displayName: 'Coimbatore',
    fact: 'Major industrial city, textile and manufacturing hub-la! Super sir.',
  },
  kovai: {
    displayName: 'Coimbatore',
    fact: 'Major industrial city, textile and manufacturing hub-la! Super sir.',
  },
  thoothukudi: {
    displayName: 'Thoothukudi',
    fact: 'Port city, macaroons-ku famous-la! Nice sir.',
  },
  tuticorin: {
    displayName: 'Thoothukudi',
    fact: 'Port city, macaroons-ku famous-la! Nice sir.',
  },
  chennai: {
    displayName: 'Chennai',
    fact: 'Marina Beach, city life ellam famous-la! Nice sir.',
  },
  madras: {
    displayName: 'Chennai',
    fact: 'Marina Beach, city life ellam famous-la! Nice sir.',
  },
  salem: {
    displayName: 'Salem',
    fact: 'Steel city, maambazham ellam famous-la! Nice sir.',
  },
  trichy: {
    displayName: 'Trichy',
    fact: 'Rockfort Temple, historic city-la! Super sir.',
  },
  tiruchirappalli: {
    displayName: 'Trichy',
    fact: 'Rockfort Temple, historic city-la! Super sir.',
  },
  erode: {
    displayName: 'Erode',
    fact: 'Turmeric, textile hub-la! Nice sir.',
  },
  tiruppur: {
    displayName: 'Tiruppur',
    fact: 'Knitwear and garment export capital-la! Super sir.',
  },
  tirupur: {
    displayName: 'Tiruppur',
    fact: 'Knitwear and garment export capital-la! Super sir.',
  },
  nagercoil: {
    displayName: 'Nagercoil',
    fact: 'Nagaraja Kovil, greenery ellam famous-la! Nice sir.',
  },
  vellore: {
    displayName: 'Vellore',
    fact: 'Historic Vellore Fort, Golden Temple ellam famous-la! Super sir.',
  },
  dindigul: {
    displayName: 'Dindigul',
    fact: 'Dindigul biryani, lock manufacturing-ku famous-la! Nice sir.',
  },
  sivakasi: {
    displayName: 'Sivakasi',
    fact: 'Fireworks and printing capital-la! Super sir.',
  },
  theni: {
    displayName: 'Theni',
    fact: 'Western Ghats nature, cardamom, agriculture-ku famous-la! Super sir.',
  },
  karur: {
    displayName: 'Karur',
    fact: 'Home textiles export hub-la! Nice sir.',
  },
  namakkal: {
    displayName: 'Namakkal',
    fact: 'Anjaneyar Kovil, transport and poultry hub-la! Nice sir.',
  },
  pollachi: {
    displayName: 'Pollachi',
    fact: 'Coconut groves, green scenic nature ellam famous-la! Super sir.',
  },
  pudukkottai: {
    displayName: 'Pudukkottai',
    fact: 'Historic heritage, rock-cut temples-ku famous-la! Nice sir.',
  },
  virudhunagar: {
    displayName: 'Virudhunagar',
    fact: 'Business hub, trade scene ellam famous-la! Nice sir.',
  },
  cuddalore: {
    displayName: 'Cuddalore',
    fact: 'Silver Beach, historic coastal town-la! Nice sir.',
  },
  kanchipuram: {
    displayName: 'Kanchipuram',
    fact: 'Silk sarees, historic temple city-la! Super sir.',
  },
  kumbakonam: {
    displayName: 'Kumbakonam',
    fact: 'Temple town, filter coffee ellam famous-la! Nice sir.',
  },
  ooty: {
    displayName: 'Ooty',
    fact: 'Nilgiris tea estates, cool hill climate-la! Super sir.',
  },
  kodaikanal: {
    displayName: 'Kodaikanal',
    fact: 'Princess of hill stations, scenic lake-la! Super sir.',
  },
  hosur: {
    displayName: 'Hosur',
    fact: 'Industrial manufacturing hub, pleasant climate-la! Nice sir.',
  },
  tenkasi: {
    displayName: 'Tenkasi',
    fact: 'Courtallam waterfalls, natural beauty-ku famous-la! Super sir.',
  },
  dubai: {
    displayName: 'Dubai',
    fact: 'Global business hub, luxury lifestyle ellam superb-la! Nice sir.',
  },
  bangalore: {
    displayName: 'Bangalore',
    fact: 'Silicon Valley of India, pleasant climate-la! Nice sir.',
  },
  bengaluru: {
    displayName: 'Bangalore',
    fact: 'Silicon Valley of India, pleasant climate-la! Nice sir.',
  },
  mumbai: {
    displayName: 'Mumbai',
    fact: 'Financial capital, energetic city life-la! Nice sir.',
  },
  hyderabad: {
    displayName: 'Hyderabad',
    fact: 'IT corridor, biryani ellam famous-la! Nice sir.',
  },
  kochi: {
    displayName: 'Kochi',
    fact: 'Port city, backwaters ellam famous-la! Nice sir.',
  },
};

/** Normalize location string to lookup key */
export function normalizeLocationKey(loc: string): string {
  return (loc || '')
    .toLowerCase()
    .replace(/[,\-_.]/g, ' ')
    .replace(/\b(?:city|district|town|nagar|side|state|la|le|dhaan|dhan)\b/gi, '')
    .trim()
    .replace(/\s+/g, '_');
}

/** Get factually verified local connection if known; returns null for unknown places */
export function getLocalConnection(location: string): LocalFact | null {
  if (!location) return null;
  const key = normalizeLocationKey(location);
  if (LOCAL_KNOWLEDGE[key]) return LOCAL_KNOWLEDGE[key];

  // Look for any keyword inside location string
  for (const [k, v] of Object.entries(LOCAL_KNOWLEDGE)) {
    if (key.includes(k) || k.includes(key)) {
      return v;
    }
  }
  return null;
}

/**
 * Format a short, natural, factually grounded location acknowledgment.
 * For known towns: e.g. "Ohh Tirunelveli-ah! Nellaiappar Kovil-um Tirunelveli halwa-vum romba famous-la sir! Super."
 * For unknown towns: e.g. "Ohh appadiya sir! Nice." (neutral, never guesses landmarks or news).
 */
export function formatLocationAcknowledgment(location: string): string {
  const match = getLocalConnection(location);
  if (match) {
    return `Ohh ${match.displayName}-ah! ${match.fact}`;
  }
  return 'Ohh appadiya sir! Nice.';
}

/**
 * Format city acknowledgment + ask for specific area / locality.
 * Example for Tirunelveli:
 * "Ohh Tirunelveli-ah! Nellaiappar Kovil-um Tirunelveli halwa-vum famous-la sir! Super. Tirunelveli-la endha area sir?"
 * Example for unknown city:
 * "Ohh appadiya sir! Nice. Neenga anga endha area-la irukkeenga sir?"
 */
export function formatCityAreaQuestion(location: string): string {
  const match = getLocalConnection(location);
  if (match) {
    return `Ohh ${match.displayName}-ah! ${match.fact} ${match.displayName}-la endha area sir?`;
  }
  const cleanLoc = (location || '').trim().replace(/[.!?]$/, '');
  if (cleanLoc) {
    return `Ohh ${cleanLoc}-ah! Nice sir. ${cleanLoc}-la endha area sir?`;
  }
  return 'Ohh appadiya sir! Nice. Neenga anga endha area-la irukkeenga sir?';
}

/**
 * Format short, natural area / locality acknowledgment.
 * Example for Palayamkottai: "Ohh Palayamkottai side-ah! Nice sir."
 */
export function formatAreaAcknowledgment(area: string): string {
  if (!area) return '';
  const clean = area.trim().replace(/[.!?]$/, '').replace(/\b(?:side|area|nagar|la|le)\b/gi, '').trim() || area.trim();
  return `Ohh ${clean} side-ah! Nice sir.`;
}

/**
 * Returns verified dated local news/festivals only when available from a trusted, confirmed source.
 * Per sales agent safety policy: Never invent recent events, dates, or festivals.
 */
export function getVerifiedLocalNews(_location: string): string | null {
  // No unverified or synthetic news. Safe default is null (mention only stable local knowledge).
  return null;
}
