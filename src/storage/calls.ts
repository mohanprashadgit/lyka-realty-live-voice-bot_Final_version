import { CallRecord, DashboardStats, LeadRecord } from '../types/agent';

const CALLS_STORAGE_KEY = 'lyka_realty_calls_v1';

export function getCalls(): CallRecord[] {
  try {
    const raw = localStorage.getItem(CALLS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('[Storage] Error reading calls:', err);
    return [];
  }
}

export function saveCall(call: CallRecord): void {
  try {
    const current = getCalls();
    const updated = [call, ...current.filter((c) => c.callId !== call.callId)];
    localStorage.setItem(CALLS_STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('[Storage] Error saving call:', err);
  }
}

export function updateCall(callId: string, updates: Partial<CallRecord>): void {
  try {
    const current = getCalls();
    const index = current.findIndex((c) => c.callId === callId);
    if (index === -1) return;
    current[index] = { ...current[index], ...updates };
    localStorage.setItem(CALLS_STORAGE_KEY, JSON.stringify(current));
  } catch (err) {
    console.error('[Storage] Error updating call:', err);
  }
}

export function getCallsByLeadId(leadId: string): CallRecord[] {
  const current = getCalls();
  return current.filter((c) => c.leadId === leadId);
}

export function getCallById(callId: string): CallRecord | null {
  const current = getCalls();
  return current.find((c) => c.callId === callId) || null;
}

export function clearAllCalls(): void {
  try {
    localStorage.removeItem(CALLS_STORAGE_KEY);
  } catch (err) {
    console.error('[Storage] Error clearing calls:', err);
  }
}

export interface DateMetricsBreakdown {
  selectedDate: string; // 'ALL' or 'YYYY-MM-DD'
  totalCallsOnDate: number;
  hot: number;
  warm: number;
  cold: number;
  optOut: number;
  connected: number;
  calls: CallRecord[];
  hotPercentage: number;
  warmPercentage: number;
  coldPercentage: number;
}

export function computeStatsForDate(
  calls: CallRecord[],
  dateStr?: string // 'ALL' or 'YYYY-MM-DD'
): DateMetricsBreakdown {
  const isAll = !dateStr || dateStr === 'ALL';
  const filteredCalls = isAll
    ? calls
    : calls.filter((c) => {
        const callDate = c.startedAt ? c.startedAt.slice(0, 10) : '';
        return callDate === dateStr;
      });

  let hot = 0;
  let warm = 0;
  let cold = 0;
  let optOut = 0;
  let connected = 0;

  filteredCalls.forEach((c) => {
    if (c.callStatus === 'CONNECTED' || c.callStatus === 'COMPLETED') {
      connected++;
    }
    if (c.outcome === 'HOT') hot++;
    else if (c.outcome === 'WARM') warm++;
    else if (c.outcome === 'COLD') cold++;
    else if (c.outcome === 'OPT_OUT' || c.outcome === 'UNWANTED') optOut++;
  });

  const total = filteredCalls.length;
  return {
    selectedDate: dateStr || 'ALL',
    totalCallsOnDate: total,
    hot,
    warm,
    cold,
    optOut,
    connected,
    calls: filteredCalls,
    hotPercentage: total > 0 ? Math.round((hot / total) * 100) : 0,
    warmPercentage: total > 0 ? Math.round((warm / total) * 100) : 0,
    coldPercentage: total > 0 ? Math.round((cold / total) * 100) : 0,
  };
}

/**
 * Computes strictly derived metrics from stored leads and calls.
 * No hardcoded fake statistics.
 */
export function computeDashboardStats(
  leads: LeadRecord[],
  calls: CallRecord[]
): DashboardStats {
  const totalLeads = leads.length;
  const callsMade = calls.length;

  let callsConnected = 0;
  let noAnswer = 0;
  let interested = 0;
  let notInterested = 0;
  let hot = 0;
  let warm = 0;
  let cold = 0;
  let reachAgain = 0;
  let optOut = 0;

  // Track lead-level outcomes so dashboard statistics match the Leads Table filter tabs 1:1
  leads.forEach((l) => {
    // Determine current effective outcome of this lead
    let outcome = l.outcome;
    if (!outcome) {
      const leadCalls = calls.filter((c) => c.leadId === l.id);
      if (leadCalls.length > 0) {
        outcome = [...leadCalls].sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0].outcome;
      }
    }

    if (l.isOptedOut || outcome === 'OPT_OUT' || outcome === 'UNWANTED') {
      optOut++;
      notInterested++;
    } else if (
      outcome === 'REACH_AGAIN' ||
      l.callStatus === 'REACH_AGAIN' ||
      Boolean(
        l.notes &&
          (l.notes.toLowerCase().includes('call back') ||
            l.notes.toLowerCase().includes('reach again') ||
            l.notes.toLowerCase().includes('unavailable') ||
            l.notes.toLowerCase().includes('brother') ||
            l.notes.includes('கால் திரும்ப'))
      )
    ) {
      reachAgain++;
    } else if (outcome === 'HOT') {
      hot++;
      interested++;
    } else if (outcome === 'WARM') {
      warm++;
      interested++;
    } else if (outcome === 'COLD') {
      cold++;
      notInterested++;
    }
  });

  calls.forEach((c) => {
    if (c.callStatus === 'CONNECTED' || c.callStatus === 'COMPLETED' || c.callStatus === 'REACH_AGAIN') {
      callsConnected++;
    } else if (c.callStatus === 'NO_ANSWER') {
      noAnswer++;
    }
  });

  // Calculate percentage rates
  const answerRate = callsMade > 0 ? Math.round((callsConnected / callsMade) * 100) : 0;
  const interestedRate = callsConnected > 0 ? Math.round((interested / callsConnected) * 100) : 0;
  const qualificationRate = callsConnected > 0 ? Math.round(((hot + warm) / callsConnected) * 100) : 0;
  const hotLeadRate = callsConnected > 0 ? Math.round((hot / callsConnected) * 100) : 0;

  return {
    totalLeads,
    callsMade,
    callsConnected,
    noAnswer,
    interested,
    notInterested,
    hot,
    warm,
    cold,
    reachAgain,
    optOut,
    answerRate,
    interestedRate,
    qualificationRate,
    hotLeadRate,
  };
}
