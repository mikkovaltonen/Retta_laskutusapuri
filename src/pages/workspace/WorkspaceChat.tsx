import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { WorkspaceLayout } from '@/components/WorkspaceLayout';
import PropertyManagerChat from '@/components/PropertyManagerChat';
import CompetitiveBiddingChat from '@/components/CompetitiveBiddingChat';

const WorkspaceChat = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { currentWorkspace, workspaceConfig } = useWorkspace();

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
            {currentWorkspace === 'purchaser' 
              ? 'Ammattimainen hankintahallinta tekoälykäyttöisellä kustannusoptimoinnilla ja toimittaja-analytiikalla'
              : currentWorkspace === 'invoicer'
              ? 'Virtaviivaistetut laskutustyönkulut älykkäällä automaatiolla ja maksuseurannalla'
              : 'Markkinatietojen hankinta ja kilpailutus Google-haulla ja ammattimaisella analytiikalla'
            }
          </p>
        </div>
        
        {/* Chat component without its own navigation since we have workspace navigation */}
        <div className="bg-white rounded-lg shadow-sm">
          {currentWorkspace === 'competitive_bidding' ? (
            <CompetitiveBiddingChat onLogout={handleLogout} hideNavigation={true} />
          ) : (
            <PropertyManagerChat onLogout={handleLogout} hideNavigation={true} />
          )}
        </div>
      </div>
    </WorkspaceLayout>
  );
};

export default WorkspaceChat;