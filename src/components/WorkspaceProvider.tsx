import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { WorkspaceContext, WorkspaceType, workspaceConfigs } from '../hooks/useWorkspace';

interface WorkspaceProviderProps {
  children: React.ReactNode;
}

export const WorkspaceProvider: React.FC<WorkspaceProviderProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  
  // Determine workspace from URL
  const getWorkspaceFromPath = (pathname: string): WorkspaceType => {
    return 'invoicer'; // Only invoicer workspace available
  };

  const [currentWorkspace, setCurrentWorkspace] = useState<WorkspaceType>(
    getWorkspaceFromPath(location.pathname)
  );

  // Update workspace when URL changes
  useEffect(() => {
    const workspaceFromPath = getWorkspaceFromPath(location.pathname);
    setCurrentWorkspace(workspaceFromPath);
  }, [location.pathname]);

  const setWorkspace = (workspace: WorkspaceType) => {
    setCurrentWorkspace(workspace);
    
    // Navigate to the new workspace, preserving the current page type (workbench/admin)
    const isAdminPage = location.pathname.includes('/admin');
    const newPath = `/workspace/${workspace}${isAdminPage ? '/admin' : ''}`;
    navigate(newPath);
  };

  return (
    <WorkspaceContext.Provider
      value={{
        currentWorkspace,
        setWorkspace,
        workspaceConfig: workspaceConfigs
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
};