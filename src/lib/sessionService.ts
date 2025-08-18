import { db } from './firebase';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { storageService, KnowledgeDocument, WorkspaceType } from './storageService';

// Helper function to get workspace-specific localStorage keys
const getWorkspaceStorageKey = (baseKey: string, workspace: WorkspaceType): string => {
  return `${workspace}_${baseKey}`;
};

export interface ChatSession {
  systemPrompt: string;
  knowledgeContext: string;
  fullContext: string;
  documentsUsed: KnowledgeDocument[];
  aiModel: string;
  createdAt: Date;
}

export interface SystemPromptVersion {
  id: string;
  version: number;
  systemPrompt: string;
  evaluation: string;
  savedDate: Date;
  aiModel: string;
  userId: string;
}

export class SessionService {
  /**
   * Get the latest system prompt for a user
   */
  async getLatestSystemPrompt(userId: string, workspace: WorkspaceType = 'invoicer'): Promise<SystemPromptVersion | null> {
    try {
      // Helper function to get workspace-specific collection names
      // Only knowledge is shared between competitive_bidding and purchaser
      const getWorkspaceCollectionName = (baseCollection: string, workspace: WorkspaceType): string => {
        if (baseCollection === 'knowledge' && workspace === 'competitive_bidding') {
          return 'purchaser_knowledge';
        }
        return `${workspace}_${baseCollection}`;
      };

      const q = query(
        collection(db, getWorkspaceCollectionName('systemPromptVersions', workspace)),
        where('userId', '==', userId)
      );
      
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        return null;
      }
      
      // Sort by version on client side until index is created
      const docs = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as SystemPromptVersion[];
      
      // Find the highest version number
      const latestDoc = docs.reduce((latest, current) => 
        current.version > latest.version ? current : latest
      );
      
      return latestDoc;
    } catch (error) {
      console.error('Failed to fetch latest system prompt:', error);
      return null;
    }
  }


  /**
   * Build knowledge context from documents
   */
  async buildKnowledgeContext(documents: KnowledgeDocument[]): Promise<string> {
    if (documents.length === 0) {
      return '';
    }

    const contextParts: string[] = [];
    
    for (const doc of documents) {
      try {
        const content = await storageService.downloadDocument(doc);
        contextParts.push(`
## Document: ${doc.name}
**Format:** ${doc.originalFormat}
**Size:** ${doc.size} bytes
**Content:**
${content}

---
`);
      } catch (error) {
        console.error(`Failed to load document ${doc.name}:`, error);
        // Continue with other documents
      }
    }

    return `
# INTERNAL KNOWLEDGE BASE

The following documents contain internal company knowledge, policies, and procedures that should inform your responses:

${contextParts.join('\n')}

Please use this internal knowledge to provide accurate, company-specific guidance while maintaining the principles outlined in your system prompt.
`;
  }

  /**
   * Initialize a new chat session with full context
   */
  async initializeChatSession(userId: string, workspace: WorkspaceType = 'invoicer'): Promise<ChatSession> {
    try {
      // Get latest system prompt
      const latestPrompt = await this.getLatestSystemPrompt(userId, workspace);
      if (!latestPrompt?.systemPrompt) {
        throw new Error('No system prompt configured. Please create a prompt in the Admin panel.');
      }
      const systemPrompt = latestPrompt.systemPrompt;
      const aiModel = latestPrompt.aiModel || 'gemini-2.5-pro-preview-06-05';

      // Get knowledge documents
      console.log(`🔍 Loading knowledge documents for chat session: workspace=${workspace}, userId=${userId}`);
      const documents = await storageService.getUserDocuments(userId, workspace);
      console.log(`📄 Chat session will use ${documents.length} documents from ${workspace === 'competitive_bidding' ? 'purchaser' : workspace}_knowledge collection`);
      
      // Build knowledge context
      const knowledgeContext = await this.buildKnowledgeContext(documents);

      // Combine system prompt with knowledge context
      const fullContext = this.combineContexts(systemPrompt, knowledgeContext);

      return {
        systemPrompt,
        knowledgeContext,
        fullContext,
        documentsUsed: documents,
        aiModel,
        createdAt: new Date()
      };
    } catch (error) {
      console.error('Failed to initialize chat session:', error);
      throw new Error('Failed to initialize chat session');
    }
  }

  /**
   * Combine system prompt with knowledge context
   */
  private combineContexts(systemPrompt: string, knowledgeContext: string): string {
    if (!knowledgeContext.trim()) {
      return systemPrompt;
    }

    return `${systemPrompt}

${knowledgeContext}

IMPORTANT: When responding, prioritize information from the internal knowledge base above while maintaining the tone and approach defined in your system prompt.`;
  }


  /**
   * Refresh session context (useful when documents are added/removed)
   */
  async refreshSessionContext(session: ChatSession, userId: string): Promise<ChatSession> {
    return await this.initializeChatSession(userId);
  }
}

export const sessionService = new SessionService();