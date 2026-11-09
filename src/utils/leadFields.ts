// Accept complete domestic or international contact numbers. Validate before removing formatting.
export function usableContactPhone(value: unknown): string | undefined {
  if (typeof value !== 'string' || !/^\+?[\d ()-]+$/.test(value.trim())) return undefined;
  const phone = value.trim().replace(/[ ()-]/g, '');
  if (phone.startsWith('+91')) return /^\+91\d{10}$/.test(phone) ? phone : undefined;
  if (phone.startsWith('+1')) return /^\+1\d{10}$/.test(phone) ? phone : undefined;
  if (phone.startsWith('+971')) return /^\+971(?:5\d{8}|[234679]\d{7})$/.test(phone) ? phone : undefined;
  return /^(?:\+[1-9]\d{7,14}|\d{10,15})$/.test(phone) ? phone : undefined;
}

/** Shared extraction boundary: unknown/empty values never erase known facts. */
export function normalizeLeadFields(input: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, field] of Object.entries(input || {})) {
    // Banking secrets are never CRM extraction fields, even if an unexpected tool payload supplies them.
    if (/(?:password|passwd|credential|(?:^|_)pin(?:_|$)|(?:^|_)otp(?:_|$)|bank_?(?:balance|statement|account|login)|account_number|cash_holdings|exact_savings)/i.test(key)) continue;
    const value = field && typeof field === 'object' ? field.value : field;
    if (typeof value === 'string' && value.trim() && !/^(unknown(?: \/ not mentioned)?|not (?:provided|mentioned|known)|n\/a|null|undefined|none)$/i.test(value.trim())) result[key] = value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) result[key] = value;
  }
  if ('phone' in result) {
    const phone = usableContactPhone(result.phone);
    if (phone) result.phone = phone;
    else delete result.phone;
  }
  if (!result.intent && result.buyer_type) result.intent = result.buyer_type;
  if (result.qualification_status) {
    const status = String(result.qualification_status).toUpperCase();
    if (['HOT', 'WARM', 'COLD', 'PENDING', 'REACH_AGAIN', 'OPT_OUT', 'UNWANTED'].includes(status)) result.qualification_status = status;
    else delete result.qualification_status;
  }
  return result;
}
