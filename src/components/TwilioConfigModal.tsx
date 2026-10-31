import React, { useState, useEffect } from 'react';
import {
  X,
  Phone,
  ShieldCheck,
  Globe,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Save,
  HelpCircle,
  Info,
  Sparkles,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';

interface TwilioConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigSaved?: () => void;
}

interface TwilioAccountInfo {
  accountName?: string;
  accountType?: string;
  assignedNumbers?: Array<{ phoneNumber: string; friendlyName: string }>;
  verifiedCallerIds?: Array<{ phoneNumber: string; friendlyName: string }>;
  currentFromNumber?: string;
}

export const TwilioConfigModal: React.FC<TwilioConfigModalProps> = ({
  isOpen,
  onClose,
  onConfigSaved,
}) => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [publicBaseUrl, setPublicBaseUrl] = useState('');
  const [accountSidMasked, setAccountSidMasked] = useState('');
  const [isConfigured, setIsConfigured] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingAccount, setIsCheckingAccount] = useState(false);
  const [accountInfo, setAccountInfo] = useState<TwilioAccountInfo | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchConfig();
      fetchAccountInfo();
    }
  }, [isOpen]);

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/twilio/config');
      if (res.ok) {
        const data = await res.json();
        setPhoneNumber(data.phoneNumber || '');
        setPublicBaseUrl(data.publicBaseUrl || '');
        setAccountSidMasked(data.accountSidMasked || '');
        setIsConfigured(data.isConfigured || false);
      }
    } catch (err) {
      console.error('[Twilio Config] Error fetching config:', err);
    }
  };

  const fetchAccountInfo = async () => {
    try {
      setIsCheckingAccount(true);
      const res = await fetch('/api/twilio/account-info');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setAccountInfo(data);
          // If the user hasn't set a phone number, or set an invalid personal number,
          // and Twilio has an assigned number, offer it!
          if (data.assignedNumbers && data.assignedNumbers.length > 0 && !phoneNumber) {
            setPhoneNumber(data.assignedNumbers[0].phoneNumber);
          }
        }
      }
    } catch (err) {
      console.error('[Twilio Config] Error fetching account info:', err);
    } finally {
      setIsCheckingAccount(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsLoading(true);
      setStatusMessage(null);

      const res = await fetch('/api/twilio/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: phoneNumber.trim(),
          publicBaseUrl: publicBaseUrl.trim(),
        }),
      });

      const data = await res.json();
      if (data.success) {
        setStatusMessage({ type: 'success', text: 'Twilio configuration updated and saved!' });
        setIsConfigured(Boolean(phoneNumber.trim()));
        if (onConfigSaved) onConfigSaved();
      } else {
        setStatusMessage({ type: 'error', text: data.error || 'Failed to save configuration' });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Network error saving config' });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const hasAssignedNumbers = Boolean(accountInfo?.assignedNumbers && accountInfo.assignedNumbers.length > 0);
  const isTrial = accountInfo?.accountType === 'Trial';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-xl w-full p-5 sm:p-6 shadow-2xl space-y-4 text-slate-900 dark:text-slate-100 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center border border-rose-500/30">
              <Phone className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span>Twilio Real Phone Calling Setup</span>
                {isTrial && (
                  <span className="text-[10px] font-mono text-amber-700 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                    Trial Account
                  </span>
                )}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                PSTN mobile dialing to real physical phones
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-white dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Credentials & Live Twilio Diagnostic Banner */}
        <div className="bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 space-y-2.5 text-xs text-slate-800 dark:text-slate-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span className="font-semibold">Twilio Credentials:</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-emerald-600 dark:text-emerald-400 font-mono font-semibold">Connected</span>
              <button
                type="button"
                onClick={fetchAccountInfo}
                disabled={isCheckingAccount}
                title="Refresh Twilio Account Status"
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${isCheckingAccount ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between bg-white dark:bg-slate-900/60 p-2 rounded border border-slate-200 dark:border-slate-800">
            <span>Account SID:</span>
            <span className="text-slate-800 dark:text-slate-200">{accountSidMasked || 'ACc184...35b2'}</span>
          </div>

          {/* Diagnostic Alert: Trial Account Number Check */}
          {!hasAssignedNumbers && (
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 space-y-2 text-xs">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-bold text-amber-200">
                    Action Needed: Get a Free Twilio Phone Number
                  </div>
                  <p className="text-[11px] text-amber-300/90 leading-relaxed">
                    You cannot use your personal mobile phone (e.g. 9944406813) as the <strong>"Caller ID / From"</strong> number.
                    Twilio requires you to place calls from an assigned Twilio virtual number.
                  </p>
                  <ol className="list-decimal list-inside text-[11px] space-y-1 text-slate-300 pt-1">
                    <li>
                      Go to <a href="https://console.twilio.com" target="_blank" rel="noreferrer" className="underline text-amber-400 hover:text-amber-300 inline-flex items-center gap-0.5">Twilio Console <ExternalLink className="w-2.5 h-2.5" /></a>
                    </li>
                    <li>Click the button <strong>"Get a Trial Phone Number"</strong> (free).</li>
                    <li>Copy that virtual number (e.g. <span className="font-mono text-amber-300">+12025550199</span>) and paste it into the field below.</li>
                    <li>
                      Under <a href="https://console.twilio.com/us1/develop/phone-numbers/manage/verified" target="_blank" rel="noreferrer" className="underline text-amber-400 hover:text-amber-300 inline-flex items-center gap-0.5">Verified Caller IDs <ExternalLink className="w-2.5 h-2.5" /></a>, make sure your mobile number is verified so Twilio allows calling it.
                    </li>
                  </ol>
                </div>
              </div>
            </div>
          )}

          {hasAssignedNumbers && (
            <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[11px] flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Found Twilio Number: <strong>{accountInfo?.assignedNumbers?.[0]?.phoneNumber}</strong></span>
              </span>
              <button
                type="button"
                onClick={() => setPhoneNumber(accountInfo?.assignedNumbers?.[0]?.phoneNumber || '')}
                className="px-2 py-0.5 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-[10px] font-bold cursor-pointer"
              >
                Use This
              </button>
            </div>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleSave} className="space-y-3.5 text-xs">
          {/* Twilio Outbound Phone Number */}
          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1 flex items-center justify-between">
              <span>Twilio Caller Number (From): <span className="text-rose-500">*</span></span>
              <a
                href="https://console.twilio.com/us1/develop/phone-numbers/manage/incoming"
                target="_blank"
                rel="noreferrer"
                className="text-[10px] text-cyan-600 dark:text-cyan-400 hover:underline flex items-center gap-1"
              >
                <span>Find in Twilio Console</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </label>
            <input
              type="text"
              required
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+12025550199 (Virtual number from Twilio Console)"
              className="w-full text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-amber-500"
            />
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Must be your virtual Twilio number in <strong>+E.164</strong> format (e.g. +1...), <strong>not</strong> your personal mobile phone.
            </p>
          </div>

          {/* Public Base URL (for webhooks) */}
          <div className="bg-slate-50 dark:bg-slate-950/70 p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Public Webhook Base URL:</span>
              </span>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                ✓ Auto-Configured
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              Automatically points to your live Cloud Run webhook address. No changes needed.
            </p>
            <input
              type="text"
              readOnly
              value={publicBaseUrl}
              className="w-full text-xs font-mono bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-500 dark:text-slate-400 cursor-not-allowed"
            />
          </div>

          {/* Feedback Message */}
          {statusMessage && (
            <div
              className={`p-2.5 rounded-xl border text-xs flex items-center gap-2 ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300'
              }`}
            >
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-500 dark:text-rose-400 shrink-0" />
              )}
              <span>{statusMessage.text}</span>
            </div>
          )}

          {/* Submit Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-xl text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            >
              Close
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-1.5 rounded-xl font-semibold bg-rose-500 hover:bg-rose-400 text-white transition-all cursor-pointer flex items-center gap-1.5 shadow-md shadow-rose-500/15 disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isLoading ? 'Saving...' : 'Save Settings'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
