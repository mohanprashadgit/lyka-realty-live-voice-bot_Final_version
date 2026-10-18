/**
 * GlobalAIAssistant.tsx — Floating Role-Aware AI Assistant for Lyka Realty CRM
 * 
 * Provides an omnipresent floating assistant across all CRM screens with:
 * - Server-verified role awareness (Super Admin, Operations Admin, Lead Executive, Territory Manager, Sales Executive)
 * - Page-aware contextual prompt chips (Dashboard, Leads, Inventory, Land, Deals, Performance, etc.)
 * - Unified Land & Property AI recommendation engine directly inside chat
 * - Interactive RequirementConfirmationCard & PropertyRecommendationCard rendering
 * - In-drawer site visit scheduling & interest saving
 * - Strict per-user session isolation: conversations never leak across users
 * - Full integration with backend RAG database grounding (/api/chat & /api/crm/matching/recommend)
 * - Speech-to-text voice input support
 * - Aura Privé graphite & champagne-gold styling
 */
import React, { useState, useEffect, useRef } from 'react';
import { useCrm } from '../context/CrmContext';
import { ROLE_CONFIGS } from '../permissions';
import {
  Sparkles,
  X,
  Minus,
  Send,
  Mic,
  MicOff,
  RotateCcw,
  Bot,
  User,
  ChevronDown,
  ArrowUpRight,
  Shield,
  Layers,
  AlertCircle,
  Loader2,
  Calendar,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import { PropertyRecommendationCard } from '../../components/PropertyRecommendationCard';
import { RequirementConfirmationCard } from '../../components/RequirementConfirmationCard';
import { PropertyDetailModal } from '../../components/PropertyDetailModal';
import { MatchResult, StructuredRequirements } from '../../../backend/services/propertyMatchingService';

interface ChatMsg {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  confirmationData?: StructuredRequirements;
  recommendations?: MatchResult[];
  recommendationId?: string;
}

export const GlobalAIAssistant: React.FC = () => {
  const {
    activeRole,
    activeModule,
    authenticatedUser,
    authToken,
    theme,
    onOpenChatbot,
  } = useCrm();

  const isDark = theme === 'dark';
  const roleConfig = ROLE_CONFIGS[activeRole] || ROLE_CONFIGS['Super Admin'];

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Recommendation & Site Visit Modals
  const [selectedDetailProperty, setSelectedDetailProperty] = useState<MatchResult | null>(null);
  const [siteVisitModalProp, setSiteVisitModalProp] = useState<MatchResult | null>(null);
  const [visitDate, setVisitDate] = useState('');
  const [visitTime, setVisitTime] = useState('11:00 AM');
  const [visitBookingLoading, setVisitBookingLoading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  // Stable session identifier per authenticated user
  const userId = authenticatedUser?.id || 'guest_staff';
  const storageKey = `lyka_ai_crm_chat_${userId}`;

  // Load isolated conversation on mount or user switch
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(storageKey);
      if (saved) {
        setMessages(JSON.parse(saved));
      } else {
        // Initial personalized greeting
        const greeting: ChatMsg = {
          id: 'welcome-msg',
          role: 'assistant',
          content: `Welcome **${authenticatedUser?.name || 'Lyka Colleague'}** (${activeRole}). I am your Aura Privé AI Assistant, connected live to our verified database. How may I assist your operations today?`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages([greeting]);
      }
    } catch (e) {
      setMessages([]);
    }
  }, [userId, activeRole]);

  // Save to isolated sessionStorage
  useEffect(() => {
    if (messages.length > 0) {
      try {
        sessionStorage.setItem(storageKey, JSON.stringify(messages));
      } catch (e) {}
    }
  }, [messages, storageKey]);

  // Scroll to bottom on new message
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  // Setup Web Speech API for voice input if supported
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-IN';

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setInputValue(prev => (prev ? `${prev} ${transcript}` : transcript));
        }
        setIsRecording(false);
      };

      recognition.onerror = () => {
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  const toggleVoiceRecording = () => {
    if (!recognitionRef.current) {
      alert('Speech recognition is not supported in this browser. Please use Chrome or Edge.');
      return;
    }

    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsRecording(true);
      } catch (e) {
        setIsRecording(false);
      }
    }
  };

  const handleClearChat = () => {
    const greeting: ChatMsg = {
      id: `welcome-${Date.now()}`,
      role: 'assistant',
      content: `Conversation reset. Ready to assist you with ${activeRole} workflows.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages([greeting]);
    sessionStorage.removeItem(storageKey);
  };

  // ── Role- & Page-Aware Suggested Prompts ─────────────────────────────
  const getContextualSuggestions = (): string[] => {
    if (activeModule === 'land') {
      return [
        "Do you have any land available in OMR?",
        "Show all plots in Chennai under ₹40 lakh",
        "I need 2,400 sq. ft. land near ECR with road access",
        "Find residential land suitable for building a house",
        "Compare the top matching plots",
      ];
    }
    if (activeModule === 'properties') {
      return [
        "Show villas in Chennai under ₹2 crore",
        "Find a 2 BHK apartment near a metro station",
        "Which properties need verification?",
        "Find properties missing photos or specs",
      ];
    }
    if (activeModule === 'matching') {
      return [
        "Do you have any land available in OMR?",
        "Show all plots in Chennai under ₹40 lakh",
        "Run property matching for my latest lead",
        "Show unmatched customer requirements (< 50%)",
        "Explain criteria weighting in matching engine",
      ];
    }
    if (activeModule === 'leads') {
      return [
        "Show land options matching this customer's budget",
        "Which available land listings best match my customer's requirements?",
        "Show leads waiting for first contact",
        "Which follow-ups are overdue?",
      ];
    }
    if (activeModule === 'pipeline' || activeModule === 'deals') {
      return [
        "Summarise active deal stages in pipeline",
        "Which high-value deals are in negotiation?",
        activeRole === 'Sales Territory Manager' ? "Which deals need manager approval?" : "Show my closed-won revenue",
      ];
    }
    if (activeModule === 'site-visits') {
      return [
        "Show scheduled site visits for today",
        "Which site visits need transportation arranged?",
      ];
    }
    if (activeModule === 'employees' || activeModule === 'teams') {
      if (activeRole === 'Super Admin' || activeRole === 'Operations Admin') {
        return [
          "Who are my employees and their workloads?",
          "Compare employee points & quota achievement",
          "Show staff directory by department",
        ];
      }
      if (activeRole === 'Sales Territory Manager') {
        return [
          "Compare my team's sales this month",
          "Show team quota achievement percentages",
        ];
      }
    }
    if (activeModule === 'rewards' || activeModule === 'performance') {
      return [
        "How do I earn reward points for deals?",
        "Show recent transactions on rewards ledger",
      ];
    }

    // Default Dashboard Suggestions by Role
    switch (activeRole) {
      case 'Super Admin':
        return [
          "Do you have any land available in OMR?",
          "Show all plots in Chennai under ₹40 lakh",
          "Who are my employees and their current workloads?",
          "Summarise the sales pipeline and revenue",
        ];
      case 'Operations Admin':
        return [
          "Show available land listings in Chennai",
          "Show available property and land inventory",
          "Which properties need verification?",
        ];
      case 'Lead Management Executive':
        return [
          "Show all plots in Chennai under ₹40 lakh",
          "Show unassigned leads waiting for contact",
          "Which follow-ups are overdue today?",
        ];
      case 'Sales Territory Manager':
        return [
          "Do you have any land available in OMR?",
          "Summarise my team's sales pipeline",
          "Show pending site visits for my team",
        ];
      case 'Sales & Growth Executive':
        return [
          "Do you have any land available in OMR?",
          "Show all plots in Chennai under ₹40 lakh",
          "Show land options matching this customer's budget",
          "Show my assigned leads",
        ];
      default:
        return [
          "Do you have any land available in OMR?",
          "Show all plots in Chennai under ₹40 lakh",
        ];
    }
  };

  const suggestions = getContextualSuggestions();

  // ── Execute Direct Search & Matching ───────────────────────────────
  const handleConfirmAndSearch = async (req: StructuredRequirements) => {
    setLoading(true);
    try {
      const res = await fetch('/api/crm/matching/recommend', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({
          session_id: `crm_session_${userId}`,
          employee_id: authenticatedUser?.id,
          requirements: req,
          limit: 10,
          persist: true,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to search matching inventory');
      }

      if (data.unmatched || !data.results || data.results.length === 0) {
        const noMatchMsg: ChatMsg = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: `I searched our verified database inventory, but no listings currently match 100% of these exact criteria.\n\n${data.unmatched_reason || 'Would you like to relax budget/area filters or search neighboring localities?'}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages(prev => [...prev, noMatchMsg]);
      } else {
        const resultsMsg: ChatMsg = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: `Found **${data.results.length}** verified inventory listings matching your requirements (Total eligible: ${data.total_eligible_matches || data.results.length}):`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          recommendations: data.results,
          recommendationId: data.recommendation_id,
        };
        setMessages(prev => [...prev, resultsMsg]);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Matching service error');
      const errorMsg: ChatMsg = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: `Inventory search error: ${err.message}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveInterest = async (prop: MatchResult): Promise<boolean> => {
    try {
      const res = await fetch('/api/crm/matching/interest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({
          property_id: prop.listing_type === 'property' ? prop.property_id : undefined,
          land_id: prop.listing_type === 'land' ? prop.property_id : undefined,
          employee_id: authenticatedUser?.id,
          notes: `Staff saved interest from AI Assistant: ${prop.title} (${prop.formatted_price})`,
        }),
      });
      const data = await res.json();
      if (data.success) {
        const sysMsg: ChatMsg = {
          id: `sys-${Date.now()}`,
          role: 'assistant',
          content: `❤️ Saved "${prop.title}" to interested properties!`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages(prev => [...prev, sysMsg]);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const handleConfirmSiteVisit = async () => {
    if (!siteVisitModalProp || !visitDate) return;
    setVisitBookingLoading(true);
    try {
      const res = await fetch('/api/crm/matching/site-visit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({
          property_id: siteVisitModalProp.listing_type === 'property' ? siteVisitModalProp.property_id : undefined,
          land_id: siteVisitModalProp.listing_type === 'land' ? siteVisitModalProp.property_id : undefined,
          employee_id: authenticatedUser?.id,
          visit_date: visitDate,
          visit_time: visitTime,
          notes: `Site visit scheduled via Global AI Assistant for ${siteVisitModalProp.title}`,
        }),
      });
      const data = await res.json();
      if (data.success) {
        const propTitle = siteVisitModalProp.title;
        setSiteVisitModalProp(null);
        const confirmMsg: ChatMsg = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: `🎉 Site visit confirmed for **${propTitle}** on ${visitDate} at ${visitTime}! Booking ID: \`${data.id}\`. A follow-up task has been assigned in CRM.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages(prev => [...prev, confirmMsg]);
      } else {
        alert(data.error || 'Failed to schedule site visit');
      }
    } finally {
      setVisitBookingLoading(false);
    }
  };

  // ── Send Message to Backend AI Assistant ────────────────────────────
  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputValue).trim();
    if (!text || loading) return;

    setErrorMsg(null);
    setInputValue('');

    const userMsg: ChatMsg = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setLoading(true);

    try {
      const chatPayload = newHistory
        .filter(m => m.id !== 'welcome-msg')
        .map(m => ({ role: m.role, content: m.content }));

      const contextualPrompt = `[Context: Current Page is '${activeModule}', Role is '${activeRole}', Employee ID is '${authenticatedUser?.id || 'staff'}']\n${text}`;
      chatPayload[chatPayload.length - 1].content = contextualPrompt;

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({
          messages: chatPayload,
          language: 'english',
          sessionId: `crm_session_${userId}`,
          employeeToken: authToken,
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to receive response from assistant');
      }

      const assistantMsg: ChatMsg = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.message || data.reply || 'Request processed successfully.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        confirmationData: data.extractedRequirements || undefined,
      };

      setMessages(prev => [...prev, assistantMsg]);

      // If the query is an explicit search or has high confidence requirements, auto search!
      const lowerText = text.toLowerCase();
      const isSearchIntent =
        lowerText.includes('plot') ||
        lowerText.includes('land') ||
        lowerText.includes('omr') ||
        lowerText.includes('ecr') ||
        lowerText.includes('lakh') ||
        lowerText.includes('crore') ||
        lowerText.includes('bhk') ||
        lowerText.includes('villa') ||
        lowerText.includes('show all') ||
        lowerText.includes('find') ||
        lowerText.includes('available');

      if (data.extractedRequirements && isSearchIntent) {
        await handleConfirmAndSearch(data.extractedRequirements);
      }
    } catch (err: any) {
      console.error('[GlobalAIAssistant] Chat error:', err);
      setErrorMsg(err.message || 'Unable to communicate with Lyka AI assistant.');
      const errorResponse: ChatMsg = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: `I encountered an issue connecting to the live assistant server: ${err.message}. Please check your connection or try again.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages(prev => [...prev, errorResponse]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <>
      {/* ── 1. Floating Launcher Button (Closed State) ───────────────── */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2.5 px-4 py-3 rounded-full border border-[#d8a868]/40 bg-[#141217]/95 hover:bg-[#1f1d24] text-white shadow-2xl hover:shadow-[#d8a868]/20 transition-all duration-300 group cursor-pointer backdrop-blur-md hover:scale-105"
          title={`Open Lyka AI Assistant (${activeRole})`}
        >
          <div className="relative">
            <Sparkles className="w-5 h-5 text-[#d8a868] animate-pulse" />
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400" />
          </div>
          <div className="text-left hidden sm:block">
            <div className="text-xs font-bold text-white flex items-center gap-1.5">
              <span>Lyka AI</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded font-mono font-bold bg-[#d8a868]/20 text-[#d8a868]">
                CRM
              </span>
            </div>
            <div className="text-[10px] text-[#968a7e] font-medium leading-tight">
              {activeRole}
            </div>
          </div>
        </button>
      )}

      {/* ── 2. Expanded Floating Panel ──────────────────────────────── */}
      {isOpen && (
        <div
          className={`fixed bottom-6 right-6 z-50 w-96 sm:w-[500px] h-[640px] max-h-[88vh] rounded-2xl border shadow-2xl flex flex-col overflow-hidden backdrop-blur-xl animate-in fade-in slide-in-from-bottom-5 duration-200 ${
            isDark
              ? 'border-[#28232D] bg-[#141217]/95 text-[#e6e1e5]'
              : 'border-[#E2D8D1] bg-[#FAF7F2]/95 text-[#1c1b1e]'
          }`}
        >
          {/* Header */}
          <div
            className={`px-4 py-3 border-b flex items-center justify-between shrink-0 ${
              isDark ? 'border-[#28232D] bg-[#0B0A0C]' : 'border-[#E2D8D1] bg-white'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-[#d8a868]/15 border border-[#d8a868]/30 flex items-center justify-center text-[#d8a868] shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className={`text-xs font-bold truncate ${isDark ? 'text-white' : 'text-[#1c1b1e]'}`}>
                    Lyka AI Concierge
                  </span>
                  <span
                    className="w-2 h-2 rounded-full inline-block shrink-0"
                    style={{ backgroundColor: roleConfig.badgeColor }}
                    title={activeRole}
                  />
                </div>
                <div className="text-[10px] text-[#968a7e] truncate flex items-center gap-1.5">
                  <span className="font-medium text-[#d8a868]">{authenticatedUser?.name || 'Staff User'}</span>
                  <span>•</span>
                  <span className="capitalize">{activeModule}</span>
                </div>
              </div>
            </div>

            {/* Window Controls */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={handleClearChat}
                className="p-1.5 rounded-lg text-[#968a7e] hover:text-white hover:bg-[#28232D] transition-colors cursor-pointer"
                title="Reset conversation"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg text-[#968a7e] hover:text-white hover:bg-[#28232D] transition-colors cursor-pointer"
                title="Minimize assistant"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg text-[#968a7e] hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                title="Close"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Context Banner */}
          <div
            className={`px-3 py-1.5 border-b text-[10px] flex items-center justify-between shrink-0 font-medium ${
              isDark ? 'border-[#28232D] bg-[#18161B] text-[#968a7e]' : 'border-[#E2D8D1] bg-[#f5efe8] text-[#817568]'
            }`}
          >
            <div className="flex items-center gap-1.5 truncate">
              <Shield className="w-3 h-3 text-[#d8a868]" />
              <span className="truncate">Role: <strong className="text-white">{activeRole}</strong></span>
              <span>•</span>
              <span className="truncate">Page: <strong className="text-white">{activeModule}</strong></span>
            </div>
            <button
              onClick={onOpenChatbot}
              className="text-[#d8a868] hover:underline flex items-center gap-0.5 shrink-0 cursor-pointer font-bold"
              title="Launch full-screen voice assistant"
            >
              <span>Voice Room</span>
              <ArrowUpRight className="w-2.5 h-2.5" />
            </button>
          </div>

          {/* Messages Scroll Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 min-h-0 text-xs">
            {messages.map((m) => {
              const isUser = m.role === 'user';
              return (
                <div
                  key={m.id}
                  className={`flex gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}
                >
                  {!isUser && (
                    <div className="w-6 h-6 rounded-lg bg-[#d8a868]/20 border border-[#d8a868]/30 flex items-center justify-center text-[#d8a868] shrink-0 mt-0.5">
                      <Bot className="w-3.5 h-3.5" />
                    </div>
                  )}

                  <div
                    className={`max-w-[92%] rounded-2xl px-3.5 py-2.5 leading-relaxed break-words ${
                      isUser
                        ? 'bg-[#d8a868] text-[#0B0A0C] font-medium rounded-tr-sm shadow-md'
                        : isDark
                        ? 'bg-[#1e1c24] border border-[#28232D] text-[#e6e1e5] rounded-tl-sm'
                        : 'bg-white border border-[#E2D8D1] text-[#1c1b1e] rounded-tl-sm'
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{m.content}</div>

                    {/* Step 2: Requirement Confirmation Card */}
                    {m.confirmationData && (
                      <div className="mt-3">
                        <RequirementConfirmationCard
                          requirements={m.confirmationData}
                          isLoading={loading}
                          onConfirm={handleConfirmAndSearch}
                          onEdit={handleConfirmAndSearch}
                          onContinue={handleConfirmAndSearch}
                        />
                      </div>
                    )}

                    {/* Step 3: Recommendation Results Cards */}
                    {m.recommendations && m.recommendations.length > 0 && (
                      <div className="mt-3 space-y-3">
                        {m.recommendations.map(prop => (
                          <PropertyRecommendationCard
                            key={prop.property_id}
                            property={prop}
                            onViewDetails={(p) => setSelectedDetailProperty(p)}
                            onScheduleVisit={(p) => {
                              setSiteVisitModalProp(p);
                              setVisitDate(new Date(Date.now() + 86400000).toISOString().slice(0, 10));
                            }}
                            onSaveInterest={handleSaveInterest}
                          />
                        ))}
                      </div>
                    )}

                    <div
                      className={`text-[9px] mt-1 text-right font-mono ${
                        isUser ? 'text-[#0B0A0C]/70' : 'text-[#968a7e]'
                      }`}
                    >
                      {m.timestamp}
                    </div>
                  </div>

                  {isUser && (
                    <div className="w-6 h-6 rounded-lg bg-[#28232D] flex items-center justify-center text-white shrink-0 mt-0.5">
                      <User className="w-3.5 h-3.5" />
                    </div>
                  )}
                </div>
              );
            })}

            {loading && (
              <div className="flex gap-2.5 justify-start items-center text-[#968a7e] text-xs py-1">
                <div className="w-6 h-6 rounded-lg bg-[#d8a868]/20 flex items-center justify-center text-[#d8a868] shrink-0">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                </div>
                <div className="italic">Querying live database & computing deterministic matching scores...</div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Contextual Suggestions Chips */}
          <div
            className={`px-3 py-2 border-t shrink-0 ${
              isDark ? 'border-[#28232D] bg-[#0E0D10]' : 'border-[#E2D8D1] bg-[#fcfaf7]'
            }`}
          >
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#968a7e] mb-1.5 flex items-center justify-between">
              <span>Suggested for {activeModule}</span>
              <span className="text-[#d8a868]">{activeRole}</span>
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {suggestions.map((prompt, i) => (
                <button
                  key={i}
                  onClick={() => handleSendMessage(prompt)}
                  disabled={loading}
                  className={`px-2.5 py-1 rounded-lg text-[11px] whitespace-nowrap transition-colors border shrink-0 cursor-pointer text-left ${
                    isDark
                      ? 'border-[#28232D] bg-[#18161B] text-[#c9c0b5] hover:border-[#d8a868]/50 hover:text-white'
                      : 'border-[#E2D8D1] bg-white text-[#4f4539] hover:border-[#d8a868]/60 hover:text-black'
                  }`}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>

          {/* Chat Input Bar */}
          <div
            className={`p-3 border-t shrink-0 ${
              isDark ? 'border-[#28232D] bg-[#141217]' : 'border-[#E2D8D1] bg-white'
            }`}
          >
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleVoiceRecording}
                className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                  isRecording
                    ? 'border-rose-500 bg-rose-500/20 text-rose-300 animate-pulse'
                    : isDark
                    ? 'border-[#28232D] bg-[#18161B] text-[#968a7e] hover:text-white'
                    : 'border-[#E2D8D1] bg-[#FAF7F2] text-[#817568] hover:text-black'
                }`}
                title={isRecording ? 'Stop speech recording' : 'Dictate question via voice'}
              >
                {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>

              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isRecording ? 'Listening...' : `Ask anything (${activeRole})...`}
                disabled={loading}
                className={`flex-1 px-3 py-2 rounded-xl text-xs border outline-none transition-colors ${
                  isDark
                    ? 'border-[#28232D] bg-[#18161B] text-white placeholder-[#968a7e] focus:border-[#d8a868]/50'
                    : 'border-[#E2D8D1] bg-[#FAF7F2] text-[#1c1b1e] placeholder-[#817568] focus:border-[#d8a868]/60'
                }`}
              />

              <button
                type="button"
                onClick={() => handleSendMessage()}
                disabled={!inputValue.trim() || loading}
                className={`p-2 rounded-xl font-bold transition-all cursor-pointer ${
                  inputValue.trim() && !loading
                    ? 'bg-[#d8a868] text-[#0B0A0C] hover:bg-[#f0be7c] shadow'
                    : 'bg-[#28232D]/40 text-[#968a7e] cursor-not-allowed'
                }`}
                title="Send message"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 3. Detail Inspection Modal ──────────────────────────────── */}
      {selectedDetailProperty && (
        <PropertyDetailModal
          property={selectedDetailProperty}
          onClose={() => setSelectedDetailProperty(null)}
          onScheduleVisit={(p) => {
            setSelectedDetailProperty(null);
            setSiteVisitModalProp(p);
            setVisitDate(new Date(Date.now() + 86400000).toISOString().slice(0, 10));
          }}
          onSaveInterest={handleSaveInterest}
        />
      )}

      {/* ── 4. In-Drawer Site Visit Scheduling Modal ─────────────────── */}
      {siteVisitModalProp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                <Calendar className="w-4 h-4" />
                <span>Schedule Verified Site Visit</span>
              </div>
              <button
                onClick={() => setSiteVisitModalProp(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <div className="text-xs text-slate-400">Selected Listing:</div>
              <div className="text-sm font-semibold text-white mt-0.5">{siteVisitModalProp.title}</div>
              <div className="text-xs text-amber-400">{siteVisitModalProp.formatted_price} • {siteVisitModalProp.location}</div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] text-slate-400">Preferred Visit Date</label>
                <input
                  type="date"
                  value={visitDate}
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setVisitDate(e.target.value)}
                  className="w-full mt-1 rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white focus:border-amber-400 outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-400">Preferred Time Slot</label>
                <select
                  value={visitTime}
                  onChange={(e) => setVisitTime(e.target.value)}
                  className="w-full mt-1 rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white focus:border-amber-400 outline-none"
                >
                  <option value="10:00 AM">10:00 AM (Morning)</option>
                  <option value="11:30 AM">11:30 AM (Morning)</option>
                  <option value="02:30 PM">02:30 PM (Afternoon)</option>
                  <option value="04:30 PM">04:30 PM (Evening)</option>
                  <option value="06:00 PM">06:00 PM (Sunset Walkthrough)</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => setSiteVisitModalProp(null)}
                className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSiteVisit}
                disabled={!visitDate || visitBookingLoading}
                className="rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 px-5 py-2 text-xs font-semibold text-slate-950 shadow-lg shadow-amber-500/20 disabled:opacity-50 transition-all flex items-center gap-1.5"
              >
                {visitBookingLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                <span>Confirm Visit Booking</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default GlobalAIAssistant;
