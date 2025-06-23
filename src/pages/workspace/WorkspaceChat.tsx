import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { WorkspaceLayout } from '@/components/WorkspaceLayout';
import DocumentAnalysis from '@/components/DocumentAnalysis';

const WorkspaceChat = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { currentWorkspace, workspaceConfig } = useWorkspace();
  const [isLoading, setIsLoading] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <WorkspaceLayout onLogout={handleLogout}>
      <div className="w-full">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            {workspaceConfig[currentWorkspace].chatTitle}
          </h1>
          <p className="text-gray-600 mt-1">
            Virtaviivaistetut laskutustyönkulut älykkäällä automaatiolla ja maksuseurannalla
          </p>
        </div>
        
        {/* Document analysis component for invoicing */}
        <div className="bg-white rounded-lg shadow-sm">
          <DocumentAnalysis 
            isLoading={isLoading}
            setIsLoading={setIsLoading}
            fileFilter="all"
          />
        </div>
      </div>
    </WorkspaceLayout>
  );
};

export default WorkspaceChat;