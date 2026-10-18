/**
 * RolePreviewSelector.tsx — Development-Only Role Preview Switcher
 */
import React, { useState, useRef, useEffect } from 'react';
import { useCrm } from '../context/CrmContext';
import { DEV_ROLES, CrmRole } from '../types/crm';
import { Shield, ChevronDown, Check, AlertCircle } from 'lucide-react';

export const RolePreviewSelector: React.FC = () => {
  const { activeRole, setActiveRole, activeRoleInfo } = useCrm();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Hide in production builds
  if (!import.meta.env.DEV) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(prev => !prev)}
        className="flex items-center gap-2 px-2.5 py-1.5 sm:px-3 rounded-lg border border-[#d8a868]/30 bg-[#1e1c24]/80 hover:bg-[#262430] text-sm text-[#e6e1e5] transition-all shadow-sm shrink-0 cursor-pointer"
        title="Development Role Preview Switcher"
      >
        <Shield className="w-4 h-4 text-[#d8a868] shrink-0" />
        <div className="text-left hidden sm:block">
          <div className="text-[10px] uppercase tracking-wider text-[#d8a868] font-semibold leading-none">
            Dev Role
          </div>
          <div className="text-xs font-medium text-white flex items-center gap-1.5 mt-0.5">
            <span
              className="w-2 h-2 rounded-full inline-block shrink-0"
              style={{ backgroundColor: activeRoleInfo.badgeColor }}
            />
            <span className="truncate max-w-[90px]">{activeRole}</span>
          </div>
        </div>
        <div className="sm:hidden flex items-center gap-1 text-xs font-medium text-white">
          <span
            className="w-2 h-2 rounded-full inline-block shrink-0"
            style={{ backgroundColor: activeRoleInfo.badgeColor }}
          />
          <span className="truncate max-w-[65px]">{activeRole}</span>
        </div>
        <ChevronDown className="w-3.5 h-3.5 text-[#968a7e] ml-0.5 shrink-0" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 rounded-xl bg-[#18161B] border border-[#28232D] shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
          <div className="px-3 py-2 border-b border-[#28232D] mb-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#d8a868]">
              <AlertCircle className="w-3.5 h-3.5" />
              Development-Only Role Preview
            </div>
            <p className="text-[11px] text-[#968a7e] mt-1 leading-relaxed">
              Switch roles to preview interface views and permissions. Backend enforces strict authorization.
            </p>
          </div>

          <div className="space-y-1">
            {DEV_ROLES.map(r => {
              const isSelected = r.role === activeRole;
              return (
                <button
                  key={r.role}
                  onClick={() => {
                    setActiveRole(r.role);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-start gap-2.5 px-3 py-2 rounded-lg text-left transition-all ${
                    isSelected
                      ? 'bg-[#d8a868]/15 border border-[#d8a868]/40 text-white'
                      : 'hover:bg-[#262430] text-[#c9c0b5]'
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full mt-1.5 shrink-0"
                    style={{ backgroundColor: r.badgeColor }}
                  />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-white">{r.title}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-[#d8a868]" />}
                    </div>
                    <p className="text-[11px] text-[#968a7e] mt-0.5 leading-snug">{r.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
