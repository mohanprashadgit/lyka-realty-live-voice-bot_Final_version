/** Shared extraction boundary: unknown/empty values never erase known facts. */
export function normalizeLeadFields(input: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, field] of Object.entries(input || {})) {
    const value = field && typeof field === 'object' ? field.value : field;
    if (typeof value === 'string' && value.trim()) result[key] = value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) result[key] = value;
  }
  if (!result.location && result.all_locations_mentioned) result.location = result.all_locations_mentioned;
  if (!result.intent && result.buyer_type) result.intent = result.buyer_type;
  if (result.qualification_status) {
    const status = String(result.qualification_status).toUpperCase();
    if (['HOT', 'WARM', 'COLD', 'PENDING', 'REACH_AGAIN', 'OPT_OUT'].includes(status)) result.qualification_status = status;
    else delete result.qualification_status;
  }
  return result;
}
