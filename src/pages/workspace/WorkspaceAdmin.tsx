import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { WorkspaceLayout } from '@/components/WorkspaceLayout';
import Admin from '@/pages/Admin';

const WorkspaceAdmin = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { currentWorkspace, workspaceConfig } = useWorkspace();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <WorkspaceLayout onLogout={handleLogout}>
      <div className="max-w-full">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            {workspaceConfig[currentWorkspace].adminTitle}
          </h1>
          <p className="text-gray-600 mt-1">
            Hallinnoi laskutusintegraatioita, konfiguroi ostolaskuprosesseja ja seuraa taloudellisia toimintoja
          </p>
        </div>
        
        {/* Admin component without its own navigation since we have workspace navigation */}
        <div className="bg-white rounded-lg shadow-sm">
          <Admin hideNavigation={true} />
        </div>
      </div>
    </WorkspaceLayout>
  );
};

export default WorkspaceAdmin;