import { createContext, useContext } from 'react';

export type WorkspaceType = 'purchaser' | 'invoicer' | 'competitive_bidding';

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
    name: 'Propertius Hankinta',
    chatTitle: 'Hankinta-avustaja',
    adminTitle: 'Hankintojen hallinta',
    erpTitle: 'Ostotilausten integraatio',
    apiTestTitle: 'Ostotilaus API:n testaus'
  },
  invoicer: {
    name: 'Propertius Laskutus', 
    chatTitle: 'Laskutusavustaja',
    adminTitle: 'Laskutuksen hallinta',
    erpTitle: 'Myyntilaskujen integraatio',
    apiTestTitle: 'Myyntilasku API:n testaus'
  },
  competitive_bidding: {
    name: 'Propertius Kilpailuttaja',
    chatTitle: 'Kilpailutusavustaja', 
    adminTitle: 'Kilpailutuksen hallinta',
    erpTitle: 'Markkinatietojen integraatio',
    apiTestTitle: 'Markkinatietojen testaus'
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