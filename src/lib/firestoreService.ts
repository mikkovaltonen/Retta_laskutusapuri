import { doc, setDoc, getDoc, collection, query, where, orderBy, limit, getDocs, addDoc, serverTimestamp, FieldValue, deleteDoc } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { db, auth } from '@/lib/firebase';
import { logger, ChatSessionLog } from './loggingService';

// Workspace types - simplified to only invoicer
export type WorkspaceType = 'invoicer';

// Helper function to get workspace-specific collection names
const getWorkspaceCollectionName = (baseCollection: string, workspace: WorkspaceType): string => {
  return `invoicer_${baseCollection}`;
};

export interface SystemPromptVersion {
  id?: string;
  version: number;
  systemPrompt: string;
  evaluation: string;
  savedDate: Date;
  aiModel: string;
  userId: string;
  technicalKey?: string; // New: username + version number
}

// New interface for structured error reports
export interface ErrorReport {
  id?: string;
  // Header-level information
  userId: string;
  userEmail?: string;
  reportDate: Date;
  userComment: string; // User's description of the problem
  sessionId: string;
  sessionKey: string;
  systemPrompt: string;
  
  // Line-level information: chat history and function calls
  chatHistory: Array<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp?: Date;
  }>;
  
  functionCalls: Array<{
    functionName: string;
    inputs: Record<string, unknown>;
    outputs: Record<string, unknown>;
    timestamp?: Date;
    aiRequestId?: string;
  }>;
  
  // Additional metadata
  uploadedFileName?: string;
  ostolaskuDataSample?: any[];
  messageCount: number;
  functionCallCount: number;
  
  // Status tracking
  issueStatus: 'pending' | 'investigating' | 'fixed' | 'wont_fix';
  feedback: 'thumbs_down';
}


// Generate technical key from user email and version
const generateTechnicalKey = (userEmail: string, version: number): string => {
  const username = userEmail.split('@')[0]; // Extract username part from email
  return `${username}_v${version}`;
};

// Save a new version of system prompt (shared across all users)
export const savePromptVersion = async (
  userId: string, 
  promptText: string, 
  evaluation: string = '',
  aiModel: string = 'gemini-2.5-flash-preview-04-17',
  userEmail?: string,
  workspace: WorkspaceType = 'invoicer'
): Promise<number> => {
  if (!db) {
    throw new Error('Firebase not initialized');
  }

  try {
    // Get next version from shared prompts
    const nextVersion = await getNextVersionNumber('shared', workspace);
    const technicalKey = userEmail ? generateTechnicalKey(userEmail, nextVersion) : `shared_v${nextVersion}`;
    
    const promptVersion: Omit<SystemPromptVersion, 'id'> = {
      version: nextVersion,
      systemPrompt: promptText,
      evaluation: evaluation,
      savedDate: new Date(),
      aiModel: aiModel,
      userId: userId,
      technicalKey: technicalKey
    };

    const docRef = await addDoc(collection(db, getWorkspaceCollectionName('systemPromptVersions', workspace)), {
      ...promptVersion,
      savedDate: serverTimestamp()
    });
    
    console.log(`[FirestoreService] Saved prompt version ${nextVersion} with ID: ${docRef.id} and key: ${technicalKey}`);
    return nextVersion;
  } catch (error) {
    console.error('Firebase save failed:', error);
    throw error;
  }
};

// Get the next version number (shared across all users)
const getNextVersionNumber = async (sharedKey: string, workspace: WorkspaceType = 'invoicer'): Promise<number> => {
  if (!db) {
    return 1;
  }

  // Query all prompts in the collection (no user filter)
  const q = query(
    collection(db, getWorkspaceCollectionName('systemPromptVersions', workspace))
  );
  
  const querySnapshot = await getDocs(q);
  
  if (querySnapshot.empty) {
    return 1;
  }
  
  // Find highest version on client side
  const docs = querySnapshot.docs.map(doc => doc.data().version || 0);
  const latestVersion = Math.max(...docs);
  return latestVersion + 1;
};

// Load the latest version of system prompt (shared across all users)
export const loadLatestPrompt = async (userId: string, workspace: WorkspaceType = 'invoicer'): Promise<string | null> => {
  if (!db) {
    throw new Error('Firebase not initialized');
  }

  try {
    console.log('🔍 Loading latest shared prompt, workspace:', workspace);

    // Query all prompts (no user filter)
    const q = query(
      collection(db, getWorkspaceCollectionName('systemPromptVersions', workspace))
    );
    
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      console.log('📝 No shared prompts found');
      return null;
    }
    
    // Sort by version on client side to avoid index requirement
    const docs = querySnapshot.docs.map(doc => ({
      ...doc.data(),
      version: doc.data().version || 0
    }));
    
    const latestDoc = docs.reduce((latest, current) => 
      current.version > latest.version ? current : latest
    );
    
    const latestPrompt = latestDoc.systemPrompt || null;
    
    console.log('✅ Latest shared prompt loaded:', {
      version: latestDoc.version,
      promptLength: latestPrompt?.length || 0,
      savedBy: latestDoc.userId?.substring(0, 8) + '...'
    });
    
    return latestPrompt;
  } catch (error) {
    console.error('Firebase load failed:', error);
    throw error;
  }
};

// Get all versions (shared history for all users)
export const getPromptHistory = async (userId: string, workspace: WorkspaceType = 'invoicer'): Promise<SystemPromptVersion[]> => {
  if (!db) {
    throw new Error('Firebase not initialized');
  }

  try {
    console.log('📚 Loading shared prompt history, workspace:', workspace);

    // Query all prompts (no user filter)
    const q = query(
      collection(db, getWorkspaceCollectionName('systemPromptVersions', workspace))
    );
    
    const querySnapshot = await getDocs(q);
    
    const history = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      savedDate: doc.data().savedDate?.toDate() || new Date()
    })) as SystemPromptVersion[];
    
    // Sort by version on client side to avoid index requirement
    const sortedHistory = history.sort((a, b) => b.version - a.version);
    
    console.log('✅ Shared prompt history loaded:', {
      versionCount: sortedHistory.length,
      latestVersion: sortedHistory[0]?.version || 'none'
    });
    
    return sortedHistory;
  } catch (error) {
    console.error('Firebase history load failed:', error);
    throw error;
  }
};

// Get specific version
export const getPromptVersion = async (versionId: string): Promise<SystemPromptVersion | null> => {
  if (!db) {
    throw new Error('Firebase not initialized');
  }

  try {

    const docRef = doc(db, 'systemPromptVersions', versionId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return {
        id: docSnap.id,
        ...docSnap.data(),
        savedDate: docSnap.data().savedDate?.toDate() || new Date()
      } as SystemPromptVersion;
    }
    
    return null;
  } catch (error) {
    console.error('Firebase version load failed:', error);
    throw error;
  }
};

// Update evaluation for a specific version
export const updatePromptEvaluation = async (versionId: string, evaluation: string): Promise<void> => {
  if (!db) {
    throw new Error('Firebase not initialized');
  }

  try {

    const docRef = doc(db, 'systemPromptVersions', versionId);
    await setDoc(docRef, { evaluation }, { merge: true });
  } catch (error) {
    console.error('Firebase evaluation update failed:', error);
    throw error;
  }
};

// Legacy functions for backward compatibility
export const savePrompt = async (userId: string, promptText: string): Promise<void> => {
  await savePromptVersion(userId, promptText);
};

export const loadPrompt = async (userId: string): Promise<string | null> => {
  return await loadLatestPrompt(userId);
};

// Get chat logs for a user
export const getChatLogs = async (
  userId?: string,
  workspace: WorkspaceType = 'invoicer'
): Promise<ChatSessionLog[]> => {
  try {
    if (!db) {
      logger.warn('FirestoreService', 'getChatLogs', 'Firebase not initialized');
      return [];
    }

    let q = query(
      collection(db, getWorkspaceCollectionName('chat_logs', workspace))
    );

    if (userId) {
      q = query(q, where('userId', '==', userId));
    }

    const querySnapshot = await getDocs(q);
    
    const logs = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as ChatSessionLog[];

    return logs.sort((a, b) => new Date(b.endTime).getTime() - new Date(a.endTime).getTime());
  } catch (error) {
    logger.error('FirestoreService', 'getChatLogs', 'Failed to get chat logs', { error });
    return [];
  }
};

export const saveChatSessionLog = async (
  sessionLog: ChatSessionLog,
  workspace: WorkspaceType = 'invoicer'
): Promise<string | null> => {
  try {
    if (!db) {
      logger.warn('FirestoreService', 'saveChatSessionLog', 'Firebase not initialized');
      return null;
    }

    // Sanitoitiedot - poista undefined-arvot
    const sanitizedLog = JSON.parse(JSON.stringify(sessionLog, (_, value) => 
      value === undefined ? null : value
    ));


    // Luo dokumentti chat_logs -kokoelmaan
    const docRef = await addDoc(
      collection(db, getWorkspaceCollectionName('chat_logs', workspace)),
      {
        ...sanitizedLog,
        savedAt: serverTimestamp(),
        // Varmista että päivämäärät tallentuvat oikein
        startTime: sanitizedLog.startTime,
        endTime: sanitizedLog.endTime,
        'userFeedback.timestamp': sanitizedLog.userFeedback?.timestamp || null
      }
    );

    logger.info('FirestoreService', 'saveChatSessionLog', 'Chat session log saved', {
      docId: docRef.id,
      sessionId: sessionLog.sessionId,
      rating: sessionLog.userFeedback?.rating,
      messageCount: sessionLog.messages.length,
      logCount: sessionLog.logs.length,
      contextUsage: sanitizedLog.metadata?.contextUsage
    });

    return docRef.id;
  } catch (error) {
    logger.error('FirestoreService', 'saveChatSessionLog', 'Failed to save chat session log', { error });
    return null;
  }
};

// Legacy function - kept for backward compatibility but not used with new chat_logs system
export const setUserFeedback = async (
  sessionId: string,
  feedback: 'thumbs_up' | 'thumbs_down',
  comment?: string,
  workspace: WorkspaceType = 'invoicer'
): Promise<void> => {
  logger.info('FirestoreService', 'setUserFeedback', 'Legacy feedback function called - use saveChatSessionLog instead', {
    sessionId,
    feedback,
    hasComment: !!comment
  });
  // This function is deprecated - new feedback is saved via saveChatSessionLog
};

// Get negative feedback sessions from chat_logs
export const getNegativeFeedbackSessions = async (
  userId?: string, // If not provided, get all users' feedback
  workspace: WorkspaceType = 'invoicer'
): Promise<ChatSessionLog[]> => {
  try {
    if (!db) {
      logger.warn('FirestoreService', 'getNegativeFeedbackSessions', 'Firebase not initialized');
      return [];
    }

    let q = query(
      collection(db, getWorkspaceCollectionName('chat_logs', workspace)),
      where('userFeedback.rating', '==', 'thumbs_down')
    );

    if (userId) {
      q = query(q, where('userId', '==', userId));
    }

    const querySnapshot = await getDocs(q);
    
    const sessions = querySnapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id
    })) as ChatSessionLog[];

    return sessions.sort((a, b) => new Date(b.endTime).getTime() - new Date(a.endTime).getTime());
  } catch (error) {
    logger.error('FirestoreService', 'getNegativeFeedbackSessions', 'Failed to get feedback', { error });
    return [];
  }
};

// Update issue status for negative feedback in chat_logs
export const updateIssueStatus = async (
  sessionId: string,
  status: 'fixed' | 'not_fixed',
  workspace: WorkspaceType = 'invoicer'
): Promise<void> => {
  try {
    if (!db) {
      logger.warn('FirestoreService', 'updateIssueStatus', 'Firebase not initialized');
      return;
    }

    const sessionRef = doc(db, getWorkspaceCollectionName('chat_logs', workspace), sessionId);
    await setDoc(sessionRef, {
      issueStatus: status,
      issueUpdatedAt: serverTimestamp()
    }, { merge: true });

    logger.info('FirestoreService', 'updateIssueStatus', 'Issue status updated', { sessionId, status });
  } catch (error) {
    logger.error('FirestoreService', 'updateIssueStatus', 'Failed to update status', { error, sessionId });
  }
};

// Get error reports from chat_logs
export const getErrorReports = async (
  userId?: string,
  workspace: WorkspaceType = 'invoicer'
): Promise<ChatSessionLog[]> => {
  try {
    if (!db) {
      logger.warn('FirestoreService', 'getErrorReports', 'Firebase not initialized');
      return [];
    }

    let q = query(
      collection(db, getWorkspaceCollectionName('chat_logs', workspace)),
      where('userFeedback.rating', '==', 'thumbs_down')
    );

    if (userId) {
      q = query(q, where('userId', '==', userId));
    }

    const querySnapshot = await getDocs(q);
    
    const reports = querySnapshot.docs
      .map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ChatSessionLog[];

    return reports.sort((a, b) => new Date(b.endTime).getTime() - new Date(a.endTime).getTime());
  } catch (error) {
    logger.error('FirestoreService', 'getErrorReports', 'Failed to get error reports', { error });
    return [];
  }
};

// Update error report status in chat_logs
export const updateErrorReportStatus = async (
  reportId: string,
  status: 'pending' | 'investigating' | 'fixed' | 'wont_fix',
  workspace: WorkspaceType = 'invoicer'
): Promise<void> => {
  try {
    if (!db) {
      logger.warn('FirestoreService', 'updateErrorReportStatus', 'Firebase not initialized');
      return;
    }

    const reportRef = doc(db, getWorkspaceCollectionName('chat_logs', workspace), reportId);
    await setDoc(reportRef, {
      issueStatus: status,
      issueUpdatedAt: serverTimestamp()
    }, { merge: true });

    logger.info('FirestoreService', 'updateErrorReportStatus', 'Report status updated', { reportId, status });
  } catch (error) {
    logger.error('FirestoreService', 'updateErrorReportStatus', 'Failed to update status', { error, reportId });
  }
};

