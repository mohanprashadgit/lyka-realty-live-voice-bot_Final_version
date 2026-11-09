/**
 * Live Information & Currency Conversion Service for Lyka Realty AI Voice Agent
 * - Live AED / INR exchange rate retrieval with caching & offline fallback
 * - Exact mathematical conversions with transparent breakdown
 * - Accurate Dubai (GST, UTC+4) and India (IST, UTC+5:30) date & time
 */

interface CachedRate {
  rate: number; // 1 AED = X INR
  timestamp: number;
  source: string;
}

// In-memory cache for live exchange rates (valid for 10 minutes)
let cachedRate: CachedRate | null = null;
const CACHE_TTL_MS = 10 * 60 * 1000;

// Benchmark fallback rate (~22.75 INR per AED)
const FALLBACK_AED_INR_RATE = 22.75;
let currentRate = FALLBACK_AED_INR_RATE;
let currentRateSource = 'Market Benchmark Reference';
let currentRateTime = new Date().toISOString();

// Proactively fetch live rate on startup and refresh every 10 minutes
export async function refreshExchangeRate(): Promise<number> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);
    const res = await fetch('https://open.er-api.com/v6/latest/AED', {
      signal: controller.signal,
      headers: { 'User-Agent': 'LykaRealtyVoice/1.0' },
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data: any = await res.json();
      if (data && data.rates && typeof data.rates.INR === 'number' && data.rates.INR > 0) {
        currentRate = Number(data.rates.INR.toFixed(4));
        currentRateSource = 'open.er-api.com (Live)';
        currentRateTime = new Date().toISOString();
        cachedRate = {
          rate: currentRate,
          timestamp: Date.now(),
          source: currentRateSource,
        };
        console.log(`[Currency] Live AED/INR rate updated: 1 AED = ${currentRate} INR`);
        return currentRate;
      }
    }
  } catch (err) {
    // Keep fallback or existing rate
  }
  return currentRate;
}

// Start periodic background refresh (unref so it doesn't block node process exit in tests)
refreshExchangeRate().catch(() => {});
const intervalId = setInterval(() => { refreshExchangeRate().catch(() => {}); }, CACHE_TTL_MS);
if (typeof intervalId.unref === 'function') intervalId.unref();

export function getSyncRate(): { rate: number; source: string; timestamp: string } {
  return { rate: currentRate, source: currentRateSource, timestamp: currentRateTime };
}

/**
 * Fetch live AED to INR exchange rate.
 * Uses free public exchange rate APIs with fallback.
 */
export async function getLiveAedInrRate(): Promise<{ rate: number; source: string; timestamp: string }> {
  const now = Date.now();
  if (cachedRate && now - cachedRate.timestamp < CACHE_TTL_MS) {
    return {
      rate: cachedRate.rate,
      source: cachedRate.source,
      timestamp: new Date(cachedRate.timestamp).toISOString(),
    };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);
    const res = await fetch('https://open.er-api.com/v6/latest/AED', {
      signal: controller.signal,
      headers: { 'User-Agent': 'LykaRealtyVoice/1.0' },
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data: any = await res.json();
      if (data && data.rates && typeof data.rates.INR === 'number' && data.rates.INR > 0) {
        cachedRate = {
          rate: Number(data.rates.INR.toFixed(4)),
          timestamp: now,
          source: 'open.er-api.com (Live)',
        };
        return {
          rate: cachedRate.rate,
          source: cachedRate.source,
          timestamp: new Date(cachedRate.timestamp).toISOString(),
        };
      }
    }
  } catch (err) {
    console.warn('[Currency] Live exchange rate API fetch warning, using fallback benchmark:', (err as any)?.message || err);
  }

  // Fallback to trusted benchmark
  cachedRate = {
    rate: FALLBACK_AED_INR_RATE,
    timestamp: now,
    source: 'Market Benchmark Reference',
  };
  return {
    rate: cachedRate.rate,
    source: cachedRate.source,
    timestamp: new Date(cachedRate.timestamp).toISOString(),
  };
}

/**
 * Convert AED to INR mathematically with detailed explanation.
 */
export async function convertAedToInr(amountAed: number): Promise<{
  inputAmount: number;
  fromCurrency: string;
  toCurrency: string;
  convertedAmount: number;
  rate: number;
  formattedInr: string;
  explanation: string;
  disclaimer: string;
}> {
  const { rate } = await getLiveAedInrRate();
  const inr = Number((amountAed * rate).toFixed(2));

  // Format into Indian Lakhs / Crores if appropriate
  let formattedInr = `₹${inr.toLocaleString('en-IN')}`;
  if (inr >= 10000000) {
    const cr = (inr / 10000000).toFixed(2);
    formattedInr += ` (Approx. ${cr} Crores INR)`;
  } else if (inr >= 100000) {
    const lk = (inr / 100000).toFixed(2);
    formattedInr += ` (Approx. ${lk} Lakhs INR)`;
  }

  const explanation = `${amountAed.toLocaleString('en-US')} AED at current rate of 1 AED = ${rate} INR equals approximately ${formattedInr}.`;
  const disclaimer = 'Sir, approximate-a AED to INR conversion calculate panni solluren. Actual bank conversion rate, card charges, and remittance fees konjam vary aagalam.';

  return {
    inputAmount: amountAed,
    fromCurrency: 'AED',
    toCurrency: 'INR',
    convertedAmount: inr,
    rate,
    formattedInr,
    explanation,
    disclaimer,
  };
}

/**
 * Convert INR to AED mathematically with detailed explanation.
 */
export async function convertInrToAed(amountInr: number): Promise<{
  inputAmount: number;
  fromCurrency: string;
  toCurrency: string;
  convertedAmount: number;
  rate: number;
  formattedAed: string;
  explanation: string;
  disclaimer: string;
}> {
  const { rate } = await getLiveAedInrRate();
  const aed = Number((amountInr / rate).toFixed(2));
  const formattedAed = `${aed.toLocaleString('en-US')} AED`;
  const explanation = `₹${amountInr.toLocaleString('en-IN')} INR at current rate of 1 AED = ${rate} INR equals approximately ${formattedAed}.`;
  const disclaimer = 'Sir, approximate-a INR to AED conversion calculate panni solluren. Actual bank conversion rate and charges konjam vary aagalam.';

  return {
    inputAmount: amountInr,
    fromCurrency: 'INR',
    toCurrency: 'AED',
    convertedAmount: aed,
    rate,
    formattedAed,
    explanation,
    disclaimer,
  };
}

/**
 * Get current accurate local times in India (IST) and Dubai (GST).
 */
export function getLiveTimeInfo(now: Date = new Date()): {
  indiaTime: string;
  dubaiTime: string;
  currentDate: string;
  timeDifferenceExplanation: string;
} {
  const indiaTime = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(now);

  const dubaiTime = new Intl.DateTimeFormat('en-AE', {
    timeZone: 'Asia/Dubai',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(now);

  const currentDate = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(now);

  const timeDifferenceExplanation = 'Dubai is 1 hour and 30 minutes behind India (GST is UTC+4, IST is UTC+5:30).';

  return {
    indiaTime: `${indiaTime} IST (India Standard Time)`,
    dubaiTime: `${dubaiTime} GST (Dubai / Gulf Standard Time)`,
    currentDate,
    timeDifferenceExplanation,
  };
}

/**
 * Handle tool call execution for Gemini Live tool calling.
 */
export function executeLiveCurrencyAndTimeQuery(args: Record<string, any>) {
  const queryType = args.query_type || 'all';
  const amount = typeof args.amount === 'number' && Number.isFinite(args.amount) ? args.amount : undefined;
  const fromCurrency = (args.from_currency || '').toUpperCase();
  const toCurrency = (args.to_currency || '').toUpperCase();

  const timeInfo = getLiveTimeInfo();
  const syncRate = getSyncRate();

  let conversionResult: any = undefined;
  if (amount != null && amount > 0) {
    if (fromCurrency === 'AED' || toCurrency === 'INR' || queryType === 'convert_aed_to_inr') {
      const inr = Number((amount * syncRate.rate).toFixed(2));
      let formattedInr = `₹${inr.toLocaleString('en-IN')}`;
      if (inr >= 10000000) {
        formattedInr += ` (${(inr / 10000000).toFixed(2)} Cr INR)`;
      } else if (inr >= 100000) {
        formattedInr += ` (${(inr / 100000).toFixed(2)} Lakhs INR)`;
      }
      conversionResult = {
        from: `${amount.toLocaleString('en-US')} AED`,
        to: formattedInr,
        numericValue: inr,
        targetCurrency: 'INR',
        rateUsed: `1 AED = ${syncRate.rate} INR`,
        explanation: `${amount.toLocaleString('en-US')} AED is approximately ${formattedInr} at current rate of 1 AED = ${syncRate.rate} INR.`,
      };
    } else if (fromCurrency === 'INR' || toCurrency === 'AED' || queryType === 'convert_inr_to_aed') {
      const aed = Number((amount / syncRate.rate).toFixed(2));
      const formattedAed = `${aed.toLocaleString('en-US')} AED`;
      conversionResult = {
        from: `₹${amount.toLocaleString('en-IN')} INR`,
        to: formattedAed,
        numericValue: aed,
        targetCurrency: 'AED',
        rateUsed: `1 AED = ${syncRate.rate} INR`,
        explanation: `₹${amount.toLocaleString('en-IN')} INR is approximately ${formattedAed} at current rate of 1 AED = ${syncRate.rate} INR.`,
      };
    }
  }

  return {
    status: 'success',
    currentDate: timeInfo.currentDate,
    indiaTime: timeInfo.indiaTime,
    dubaiTime: timeInfo.dubaiTime,
    timeDifference: timeInfo.timeDifferenceExplanation,
    exchangeRate: {
      pair: 'AED / INR',
      rate: syncRate.rate,
      display: `1 AED = ${syncRate.rate} INR (or 1 INR = ${(1 / syncRate.rate).toFixed(4)} AED)`,
      source: syncRate.source,
      asOf: syncRate.timestamp,
    },
    conversion: conversionResult,
    disclaimer: 'Sir, approximate-a AED to INR conversion calculate panni solluren. Actual bank conversion rate and charges konjam vary aagalam.',
    instruction: 'Present these verified live numbers clearly. Do not invent alternate rates or unverified fees.',
  };
}

