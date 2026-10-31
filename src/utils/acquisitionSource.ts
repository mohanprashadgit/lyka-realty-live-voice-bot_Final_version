/**
 * Customer acquisition-source taxonomy shared by the AI extraction pipeline,
 * the dashboard donut, and the Leads & Calls source filter.
 *
 * The database field of record is leads.lead_source (the customer's answer).
 * Canonicalisation happens at read time so the original answer is never lost.
 */

export type AcquisitionSourceKey =
  | 'WHATSAPP'
  | 'EMAIL'
  | 'YOUTUBE'
  | 'INSTAGRAM'
  | 'FACEBOOK'
  | 'GOOGLE'
  | 'WEBSITE'
  | 'LINKEDIN'
  | 'REFERRAL'
  | 'ADVERTISEMENT'
  | 'OTHER'
  | 'UNKNOWN';

export interface AcquisitionSourceOption {
  key: AcquisitionSourceKey;
  label: string;
  shortLabel: string;
  color: string;
}

export const ACQUISITION_SOURCES: AcquisitionSourceOption[] = [
  { key: 'WHATSAPP', label: 'WhatsApp', shortLabel: 'WhatsApp', color: '#1aa260' },
  { key: 'EMAIL', label: 'Email', shortLabel: 'Email', color: '#4f8ef7' },
  { key: 'YOUTUBE', label: 'YouTube', shortLabel: 'YouTube', color: '#ef4456' },
  { key: 'INSTAGRAM', label: 'Instagram', shortLabel: 'Instagram', color: '#c13584' },
  { key: 'FACEBOOK', label: 'Facebook', shortLabel: 'Facebook', color: '#3b5998' },
  { key: 'GOOGLE', label: 'Google Search', shortLabel: 'Google', color: '#d9a441' },
  { key: 'WEBSITE', label: 'Website', shortLabel: 'Website', color: '#7a2d5c' },
  { key: 'LINKEDIN', label: 'LinkedIn', shortLabel: 'LinkedIn', color: '#0a66c2' },
  { key: 'REFERRAL', label: 'Referral / Friend', shortLabel: 'Referral', color: '#e07a5f' },
  { key: 'ADVERTISEMENT', label: 'Advertisement', shortLabel: 'Ads', color: '#9b59b6' },
  { key: 'OTHER', label: 'Other', shortLabel: 'Other', color: '#8a6f7c' },
  { key: 'UNKNOWN', label: 'Unknown / Not Mentioned', shortLabel: 'Unknown', color: '#b9a7a1' },
];

export const ACQUISITION_SOURCE_BY_KEY = ACQUISITION_SOURCES.reduce(
  (map, option) => ({ ...map, [option.key]: option }),
  {} as Record<AcquisitionSourceKey, AcquisitionSourceOption>
);

export function acquisitionSourceLabel(key: AcquisitionSourceKey): string {
  return ACQUISITION_SOURCE_BY_KEY[key]?.label ?? 'Unknown / Not Mentioned';
}

export function acquisitionSourceColor(key: AcquisitionSourceKey): string {
  return ACQUISITION_SOURCE_BY_KEY[key]?.color ?? '#b9a7a1';
}

/** Values that describe an internal record origin, not a customer acquisition channel. */
const OPERATIONAL_PLACEHOLDERS: RegExp[] = [
  /^ai voice agent$/,
  /^phone call$/,
  /^employee entry\b/,
  /^employee$/,
  /^csv import$/,
  /^verified twilio\b/,
  /^manual(?: entry)?$/,
  /^customer(?:\s+entry)?$/,
  /^unknown(?:\s*\/?\s*(?:not mentioned|not provided))?$/,
  /^(?:not|never) mentioned$/,
  /^n\/?a$/,
  /^-+$/,
  /^null$/,
  /^undefined$/,
];

const UNKNOWN_PHRASES =
  /unknown|not mentioned|didn'?t (?:say|mention)|don'?t know|no idea|not sure|(?:do not|don'?t|can'?t|cannot)\s+remember|theriyala|theriyadhu|sollala|தெரியல|சொல்லல|கூறவில்லை/;

/**
 * Category tests are ordered: platform names win over generic words such as
 * "advertisement", matching the customer's actual answer (e.g. a YouTube ad
 * is attributed to YouTube, while a Google ad buy is attributed to ads).
 */
const SOURCE_PATTERNS: Array<[AcquisitionSourceKey, RegExp]> = [
  ['LINKEDIN', /linked\s*-?\s*in|லிங்க்ட?இன்|லிங்க்டின்/],
  ['WHATSAPP', /whats\s*app|wats\s*app|\bwa\b|வாட்ஸ்/],
  ['INSTAGRAM', /\binsta(?:gram)?\b|இன்ஸ்டா|இன்ஸ்டாகிராம்/],
  ['YOUTUBE', /you\s*tube|\byt\b|யூட்யூப்|யூடியூப்|யூடுப்/],
  ['FACEBOOK', /face\s*book|\bfb\b|ஃபேஸ்புக்|பேஸ்புக்|முகநூல்/],
  ['ADVERTISEMENT', /google\s*ads?\b|கூகிள்\s*விளம்பர|கூகுள்\s*விளம்பர/],
  ['GOOGLE', /google|கூகிள்|கூகுள்|கூகல்/],
  ['EMAIL', /e-?\s*mail|\bemail\b|மின்னஞ்சல்|மெயில்|ஈமெயில்/],
  ['WEBSITE', /web\s*site|webpage|landing\s*page|இணையதளம்|வலைத்தளம்|வெப்சைட்/],
  [
    'REFERRAL',
    /\breferr(?:al|ed|ing)?\b|\bfriends?\b|word\s*of\s*mouth|\bnanban\b|\bthozhan\b|\brelative\b|\bcolleague\b|\bcoworker\b|\bfamily\b|நண்ப[ரனனி]|தோழ[னி]|உறவினர்|பரிந்துரை/,
  ],
  [
    'ADVERTISEMENT',
    /\bads?\b|advert\w*|\bcampaign\b|\bbillboard\b|\bhoarding\b|\bflyer\b|\bpamphlet\b|\bnewspaper\b|\bmagazine\b|\btv\b|\bradio\b|\bsms\b|\bexpo\b|\broad\s*show\b|\bpromotion\b|\bsponsored\b|\bcommercial\b|விளம்பர/,
  ],
];

export function normalizeAcquisitionSource(raw?: string | null): AcquisitionSourceKey {
  const text = String(raw ?? '').trim().toLowerCase();
  if (!text) return 'UNKNOWN';
  if (OPERATIONAL_PLACEHOLDERS.some((pattern) => pattern.test(text))) return 'UNKNOWN';

  for (const [key, pattern] of SOURCE_PATTERNS) {
    if (pattern.test(text)) return key;
  }
  if (UNKNOWN_PHRASES.test(text)) return 'UNKNOWN';
  // Any other real answer is kept as Other rather than discarded.
  return 'OTHER';
}
