import type { AcquisitionSourceKey } from '../utils/acquisitionSource';

export type DashboardPeriod = 'today' | '7d' | '30d';

export type LeadsOutcomeFilter = 'ALL' | 'HOT' | 'WARM' | 'COLD' | 'UNWANTED';

export type LeadsScopeFilter = 'ALL' | 'ATTEMPTED' | 'ANSWERED' | 'QUALIFIED';

export type LeadsSourceFilter = 'ALL' | AcquisitionSourceKey;

export interface LeadsView {
  outcome: LeadsOutcomeFilter;
  scope: LeadsScopeFilter;
  source: LeadsSourceFilter;
  focusLeadId?: string;
  focusCallId?: string;
  focusToken?: number;
}

export interface LeadsNavigationTarget {
  outcome?: LeadsOutcomeFilter;
  scope?: LeadsScopeFilter;
  source?: LeadsSourceFilter;
  leadId?: string;
  callId?: string;
}
