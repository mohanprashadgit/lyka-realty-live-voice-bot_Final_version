/**
 * CrmApp.tsx — Entry point for the CRM Portal
 */
import React from 'react';
import { CrmProvider } from './context/CrmContext';
import { CrmLayout } from './components/CrmLayout';
import { ErrorBoundary } from './components/ErrorBoundary';

export interface CrmAppProps {
  onOpenChatbot: () => void;
  onLogout?: () => void;
  initialTheme?: 'dark' | 'light';
}

export const CrmApp: React.FC<CrmAppProps> = ({ onOpenChatbot, onLogout, initialTheme = 'dark' }) => {
  return (
    <ErrorBoundary>
      <CrmProvider onOpenChatbot={onOpenChatbot} onLogout={onLogout} initialTheme={initialTheme}>
        <CrmLayout />
      </CrmProvider>
    </ErrorBoundary>
  );
};

export default CrmApp;
