import { LeadRecord } from '../types/agent';

const LEADS_STORAGE_KEY = 'lyka_realty_leads_v1';

export const INITIAL_SEED_LEADS: LeadRecord[] = [
  {
    id: 'lead-mohan',
    name: 'Mohan Prashad',
    phone: '+919944406813',
    email: 'mohanprashad2005@gmail.com',
    source: 'Verified Twilio Mobile',
    consent: true,
    callStatus: 'NOT_CALLED',
    createdAt: new Date().toISOString(),
    notes: 'Verified mobile phone for live real outbound Twilio PSTN calls.',
  },
  {
    id: 'lead-1',
    name: 'John Doe',
    phone: '+919944406813',
    email: 'john@example.com',
    source: 'Website',
    consent: true,
    callStatus: 'NOT_CALLED',
    createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
    notes: 'Interested in primary off-plan properties in Downtown or Dubai Marina.',
  },
  {
    id: 'lead-2',
    name: 'Jane Smith',
    phone: '+971500000002',
    email: 'jane@example.com',
    source: 'Campaign',
    consent: true,
    callStatus: 'NOT_CALLED',
    createdAt: new Date(Date.now() - 3600000 * 18).toISOString(),
    notes: 'Looking for a family villa or 3BHK with good payment plan.',
  },
  {
    id: 'lead-3',
    name: 'David',
    phone: '+971500000003',
    email: 'david@example.com',
    source: 'Roadshow',
    consent: true,
    callStatus: 'NOT_CALLED',
    createdAt: new Date(Date.now() - 3600000 * 12).toISOString(),
    notes: 'Met at property expo, interested in high ROI rental yields.',
  },
  {
    id: 'lead-4',
    name: 'Priya Sharma',
    phone: '+919876543210',
    email: 'priya@example.com',
    source: 'Referral',
    consent: true,
    callStatus: 'NOT_CALLED',
    createdAt: new Date(Date.now() - 3600000 * 6).toISOString(),
    notes: 'Looking for 3BHK flat in Chennai OMR / Anna Nagar under ₹1.5 Cr.',
  },
  {
    id: 'lead-5',
    name: 'Michael Brown',
    phone: '+14155552671',
    email: 'michael@example.com',
    source: 'Google Ads',
    consent: true,
    callStatus: 'NOT_CALLED',
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    notes: 'Inquired about luxury beachfront residential units.',
  },
];

export function getLeads(): LeadRecord[] {
  try {
    const raw = localStorage.getItem(LEADS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('[Storage] Error reading leads:', err);
    return [];
  }
}

export function saveLead(lead: LeadRecord): void {
  try {
    const current = getLeads();
    const phone = lead.phone.replace(/\D/g, '');
    const existing = current.find(l => l.id === lead.id) || current.find(l => phone && l.phone.replace(/\D/g, '') === phone);
    const record = existing ? { ...existing, ...lead, id: existing.id, createdAt: existing.createdAt } : lead;
    const updated = [record, ...current.filter(l => l.id !== record.id)];
    localStorage.setItem(LEADS_STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('[Storage] Error saving lead:', err);
  }
}

export function updateLead(id: string, updates: Partial<LeadRecord>): LeadRecord | null {
  try {
    const current = getLeads();
    const index = current.findIndex((l) => l.id === id);
    if (index === -1) return null;

    const updatedLead: LeadRecord = {
      ...current[index],
      ...updates,
      id, // Preserve id
    };

    current[index] = updatedLead;
    localStorage.setItem(LEADS_STORAGE_KEY, JSON.stringify(current));
    return updatedLead;
  } catch (err) {
    console.error('[Storage] Error updating lead:', err);
    return null;
  }
}

export function deleteLead(id: string): void {
  try {
    const current = getLeads();
    const filtered = current.filter((l) => l.id !== id);
    localStorage.setItem(LEADS_STORAGE_KEY, JSON.stringify(filtered));
  } catch (err) {
    console.error('[Storage] Error deleting lead:', err);
  }
}

export function getLeadById(id: string): LeadRecord | null {
  const current = getLeads();
  return current.find((l) => l.id === id) || null;
}

export function importLeads(
  newLeads: Array<{
    name?: string;
    phone?: string;
    email?: string;
    source?: string;
    consent?: boolean | string;
    notes?: string;
  }>
): { added: number; errors: string[] } {
  const current = getLeads();
  const errors: string[] = [];
  const validRecords: LeadRecord[] = [];

  newLeads.forEach((item, idx) => {
    const rowNum = idx + 1;
    const phone = (item.phone || '').trim();
    const name = (item.name || '').trim();

    if (!phone) {
      errors.push(`Row ${rowNum}: Missing required phone number.`);
      return;
    }

    // Check duplicate phone in current import or existing records
    const cleanPhone = phone.replace(/\D/g, '');
    const isDuplicate =
      current.some((c) => c.phone.replace(/\D/g, '') === cleanPhone) ||
      validRecords.some((v) => v.phone.replace(/\D/g, '') === cleanPhone);

    if (isDuplicate) {
      errors.push(`Row ${rowNum}: Phone ${phone} is already in the database.`);
      return;
    }

    const consentVal =
      typeof item.consent === 'boolean'
        ? item.consent
        : String(item.consent || '').toLowerCase() === 'true' ||
          String(item.consent || '').toLowerCase() === 'yes';

    const newRecord: LeadRecord = {
      id: `lead-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      name: name || 'Unnamed Lead',
      phone,
      email: (item.email || '').trim(),
      source: (item.source || 'CSV Import').trim(),
      consent: consentVal,
      callStatus: 'NOT_CALLED',
      createdAt: new Date().toISOString(),
      notes: item.notes || '',
    };

    validRecords.push(newRecord);
  });

  if (validRecords.length > 0) {
    const combined = [...validRecords, ...current];
    try {
      localStorage.setItem(LEADS_STORAGE_KEY, JSON.stringify(combined));
    } catch (err) {
      console.error('[Storage] Error persisting imported leads:', err);
    }
  }

  return {
    added: validRecords.length,
    errors,
  };
}

export function resetLeadsToDefault(): void {
  try {
    localStorage.setItem(LEADS_STORAGE_KEY, JSON.stringify(INITIAL_SEED_LEADS));
  } catch (err) {
    console.error('[Storage] Error resetting leads:', err);
  }
}
