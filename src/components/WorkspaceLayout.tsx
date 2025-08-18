import React from 'react';
import { WorkspaceNavigation } from './WorkspaceNavigation';

interface WorkspaceLayoutProps {
  children: React.ReactNode;
  onLogout?: () => void;
}

export const WorkspaceLayout: React.FC<WorkspaceLayoutProps> = ({ children, onLogout }) => {
  return (
    <div className="min-h-screen bg-gray-50">
      <WorkspaceNavigation onLogout={onLogout} />
      <main className="max-w-full mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
};