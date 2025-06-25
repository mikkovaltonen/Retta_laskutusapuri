import { createContext, useContext } from 'react';

export type WorkspaceType = 'invoicer';

export interface WorkspaceContextType {
  currentWorkspace: WorkspaceType;
  setWorkspace: (workspace: WorkspaceType) => void;
  workspaceConfig: {
    [key in WorkspaceType]: {
      name: string;
      chatTitle: string;
      adminTitle: string;
      erpTitle: string;
      apiTestTitle: string;
    }
  };
}

export const workspaceConfigs = {
  invoicer: {
    name: 'Retta Laskutus', 
    chatTitle: 'Retta - omien kulujen laskuttajan työpöytä',
    adminTitle: 'Laskutuksen hallinta',
    erpTitle: 'Myyntilaskujen integraatio',
    apiTestTitle: 'Myyntilasku API:n testaus'
  }
} as const;

export const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export const useWorkspace = () => {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
};