import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { WorkspaceLayout } from '@/components/WorkspaceLayout';
import { ChatLayout } from '@/components/ChatLayout';

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
      <div className="w-full h-full flex flex-col">
        {/* Three-panel chat layout */}
        <div className="flex-1 min-h-0">
          <ChatLayout />
        </div>
      </div>
    </WorkspaceLayout>
  );
};

export default WorkspaceChat;