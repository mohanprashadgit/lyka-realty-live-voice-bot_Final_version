import React from 'react';

/**
 * highlightKeywords.tsx
 * Subtle, elegant inline keyword highlighting for transcripts and message bubbles.
 * Highlights: Names, Budget/Currency, Buyer Type, Property Type, Location, Timeline, Priority.
 */

interface KeywordPattern {
  type: 'name' | 'budget' | 'buyer' | 'property' | 'location' | 'timeline' | 'priority';
  regex: RegExp;
  className: string;
}

const KEYWORD_PATTERNS: KeywordPattern[] = [
  // Budget & Currency (INR, AED, Lakhs, Crores, Millions)
  {
    type: 'budget',
    regex: /(?:₹\s*[\d,.]+\s*(?:Crore|Cr|Lakhs?|L|k)?|AED\s*[\d,.]+\s*(?:Million|M|k)?|\$[\d,.]+[kKmM]?|\b\d+\.?\d*\s*(?:Crore|Crores|Cr|Lakhs?|Lakh|L|Million|M|AED|INR)\b)/i,
    className: 'font-semibold text-emerald-400 bg-emerald-500/10 px-1 py-0.5 rounded border border-emerald-500/20',
  },
  // Property Types
  {
    type: 'property',
    regex: /\b(?:villa|villas|apartment|apartments|flat|flats|penthouse|penthouses|plot|plots|land|residential plot|agricultural land|commercial land|townhouse|duplex|\d+\s*BHK|\d+BHK)\b/i,
    className: 'font-semibold text-violet-400 bg-violet-500/10 px-1 py-0.5 rounded border border-violet-500/20',
  },
  // Locations (India & Dubai)
  {
    type: 'location',
    regex: /\b(?:Dubai Marina|Downtown Dubai|Palm Jumeirah|Dubai Hills|Business Bay|Creek Harbour|JVC|Emirates Living|OMR|ECR|Anna Nagar|Velachery|Porur|Tambaram|Adyar|T Nagar|Sholinganallur|Medavakkam|Kelambakkam|Chennai|Dubai|Bangalore|Hyderabad|Mumbai)\b/i,
    className: 'font-semibold text-blue-400 bg-blue-500/10 px-1 py-0.5 rounded border border-blue-500/20',
  },
  // Buyer / Investor Roles
  {
    type: 'buyer',
    regex: /\b(?:First-Time Homebuyer|First-Time Buyer|Property Investor|Investor|NRI|End-User|Family Upgrading|Luxury Buyer|Tenant|Buyer)\b/i,
    className: 'font-semibold text-amber-400 bg-amber-500/10 px-1 py-0.5 rounded border border-amber-500/20',
  },
  // Timelines
  {
    type: 'timeline',
    regex: /\b(?:Immediate|Ready to Move|Within \d+ (?:months?|days?|weeks?)|Within 1-3 months|Within 60 days|Next month|Flexible)\b/i,
    className: 'font-semibold text-cyan-400 bg-cyan-500/10 px-1 py-0.5 rounded border border-cyan-500/20',
  },
  // Lead Priority / Classification
  {
    type: 'priority',
    regex: /\b(?:HOT|WARM|COLD|High Priority)\b/,
    className: 'font-bold text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20 uppercase tracking-wide',
  },
];

export function renderHighlightedText(text: string): React.ReactNode {
  if (!text) return text;

  // Build combined regex from all patterns
  const combinedPattern = new RegExp(
    KEYWORD_PATTERNS.map((p) => `(${p.regex.source})`).join('|'),
    'gi'
  );

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = combinedPattern.exec(text)) !== null) {
    const matchIndex = match.index;
    const matchText = match[0];

    // Push plain text prior to match
    if (matchIndex > lastIndex) {
      parts.push(text.substring(lastIndex, matchIndex));
    }

    // Identify which pattern matched
    let matchedClass = 'font-semibold text-violet-300';
    for (const p of KEYWORD_PATTERNS) {
      if (p.regex.test(matchText)) {
        matchedClass = p.className;
        break;
      }
    }

    parts.push(
      <span key={`${matchIndex}-${matchText}`} className={matchedClass}>
        {matchText}
      </span>
    );

    lastIndex = matchIndex + matchText.length;
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return <>{parts}</>;
}
