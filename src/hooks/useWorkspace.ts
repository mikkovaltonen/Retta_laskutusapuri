import { createContext, useContext } from 'react';

export type WorkspaceType = 'purchaser' | 'invoicer';

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
  purchaser: {
    name: 'Propertius Procurement',
    chatTitle: 'Procurement Assistant',
    adminTitle: 'Procurement Management',
    erpTitle: 'Purchase Order Integration',
    apiTestTitle: 'Purchase Order API Testing'
  },
  invoicer: {
    name: 'Propertius Invoicing', 
    chatTitle: 'Invoicing Assistant',
    adminTitle: 'Invoicing Management',
    erpTitle: 'Sales Invoice Integration',
    apiTestTitle: 'Sales Invoice API Testing'
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