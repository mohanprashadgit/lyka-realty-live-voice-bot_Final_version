import { getPool } from './db.js';
import { splitNotes, SALES_FIELDS } from './src/utils/salesIntelligence.js';
import { startSalesCall } from './src/utils/salesConversation.js';
export function resolveMemoryCandidate(rows: Record<string,any>[], sessionId:string, phone:string) {
 const digits=phone.replace(/\D/g,'');
 const exact=rows.filter(r=>r.guest_session_id===sessionId);
 if(exact.length===1 && (!digits || !exact[0].phone || String(exact[0].phone).replace(/\D/g,'')===digits)) return exact[0];
 if(exact.length || digits.length<8 || digits.length>15) return null;
 const matched=rows.filter(r=>String(r.phone||'').replace(/\D/g,'')===digits);
 return matched.length===1?matched[0]:null;
}
export function releaseCustomerMemory(current:Record<string,any>, candidate:Record<string,any>|null, confirmed: boolean) {
 if(current.memory_identity_pending==='confirmed' && confirmed) return {facts:current,released:true};
 if(current.memory_identity_pending==='rejected') return {facts:current,released:false};
 if (!confirmed || !candidate || candidate.qualification_status === 'OPT_OUT') return {facts:{...current,memory_identity_pending:'rejected'},released:false};
 // Fresh current-call statements win; previous permission never starts a new call.
 const facts:Record<string,any>={...candidate,...current,memory_identity_pending:'confirmed',conversation_disposition:'engaged'};
 delete facts.notes;
 return {facts,released:true};
}
export async function loadCustomerMemory(lead:Record<string,any>|null) {
 if(!lead?.id) return null;
 const facts=startSalesCall(lead);
 delete facts.conversation_disposition;
 facts.qualification_status=lead.temperature==='OPT_OUT'?'OPT_OUT':facts.qualification_status;
 try {
  const [rows]:any=await getPool().query(`SELECT d.summary, c.ended_at FROM conversations c JOIN voice_call_details d ON d.call_id = c.id WHERE c.lead_id = ? AND c.ended_at IS NOT NULL AND d.deleted_at IS NULL ORDER BY c.ended_at DESC LIMIT 3`,[lead.id]);
  facts.previous_call_memory=rows.map((r:any)=>`${new Date(r.ended_at).toISOString()}: ${splitNotes(r.summary).text.slice(0,400)}`).join('\n');
 } catch { facts.previous_call_memory='Previous summaries unavailable; use confirmed CRM requirements only.'; }
 // Only approved facts go to the model, never arbitrary account/database columns.
 const allowed=['preferred_contact_method','best_time_to_contact','name','full_name','customer_name_raw','budget','bedrooms','property_type','location','timeline','qualification_status',...Object.keys(SALES_FIELDS)];
 return Object.fromEntries(allowed.filter(k=>facts[k]!=null).map(k=>[k,facts[k]]));
}
