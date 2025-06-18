import { storage, db } from './firebase';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { collection, addDoc, getDocs, deleteDoc, doc, query, where, orderBy } from 'firebase/firestore';
import * as XLSX from 'xlsx';

// Workspace types
export type WorkspaceType = 'purchaser' | 'invoicer' | 'competitive_bidding';

// Helper function to get workspace-specific collection names
// competitive_bidding shares knowledge with purchaser, but has separate prompts and other collections
const getWorkspaceCollectionName = (baseCollection: string, workspace: WorkspaceType): string => {
  // Only share knowledge collection between competitive_bidding and purchaser
  if (baseCollection === 'knowledge' && workspace === 'competitive_bidding') {
    return 'purchaser_knowledge';
  }
  return `${workspace}_${baseCollection}`;
};

export interface KnowledgeDocument {
  id?: string;
  name: string;
  originalFormat: string;
  content?: string; // Store content directly for small files
  storageUrl?: string; // Optional - for large files using Storage
  downloadUrl?: string; // Optional - for large files using Storage
  size: number;
  uploadedAt: Date;
  userId: string;
  type: 'internal-knowledge';
}

export interface ERPDocument {
  id?: string;
  name: string;
  originalFormat: string;
  jsonData: Record<string, unknown>[]; // Direct JSON objects from Excel
  storageUrl?: string; // Optional - for large files using Storage
  downloadUrl?: string; // Optional - for large files using Storage
  size: number;
  uploadedAt: Date;
  userId: string;
  type: 'erp-integration';
  sheets?: string[]; // Excel sheet names
}

export interface ERPRecord {
  id?: string;
  parentDocumentId: string;
  rowIndex: number;
  userId: string;
  uploadedAt: Date;
  [key: string]: unknown; // Dynamic columns from Excel
}

export class StorageService {
  private getStoragePath(userId: string, fileName: string, type: 'knowledge' | 'erp' = 'knowledge'): string {
    return `${type}/${userId}/${Date.now()}_${fileName}`;
  }

  async uploadDocument(
    file: File, 
    userId: string,
    originalFormat: string = 'md',
    workspace: WorkspaceType = 'purchaser'
  ): Promise<KnowledgeDocument> {
    try {
      // Read file content
      const content = await file.text();
      
      // Save directly to Firestore (avoiding Storage CORS issues)
      const docData = {
        name: file.name,
        originalFormat,
        content, // Store content directly in Firestore
        size: file.size,
        uploadedAt: new Date(),
        userId,
        type: 'internal-knowledge' as const
      };

      const docRef = await addDoc(collection(db, getWorkspaceCollectionName('knowledge', workspace)), docData);
      
      return {
        id: docRef.id,
        ...docData,
        storageUrl: '', // Not using storage
        downloadUrl: '' // Not using storage
      };
    } catch (error) {
      console.error('Upload failed:', error);
      throw new Error('Failed to upload document');
    }
  }

  async getUserDocuments(userId: string, workspace: WorkspaceType = 'purchaser'): Promise<KnowledgeDocument[]> {
    try {
      const q = query(
        collection(db, getWorkspaceCollectionName('knowledge', workspace)),
        where('userId', '==', userId)
      );
      
      const querySnapshot = await getDocs(q);
      const documents = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as KnowledgeDocument[];
      
      // Sort by uploadedAt on client side until index is created
      return documents.sort((a, b) => 
        new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
      );
    } catch (error) {
      console.error('Failed to fetch documents:', error);
      throw new Error('Failed to fetch documents');
    }
  }

  async deleteDocument(documentId: string, storagePath?: string, workspace: WorkspaceType = 'purchaser'): Promise<void> {
    try {
      // Delete from storage if using storage
      if (storagePath) {
        const storageRef = ref(storage, storagePath);
        await deleteObject(storageRef);
      }

      // Delete from Firestore using workspace-specific collection
      await deleteDoc(doc(db, getWorkspaceCollectionName('knowledge', workspace), documentId));
    } catch (error) {
      console.error('Delete failed:', error);
      throw new Error('Failed to delete document');
    }
  }

  async downloadDocument(document: KnowledgeDocument): Promise<string> {
    try {
      // If content is stored directly in Firestore
      if (document.content) {
        return document.content;
      }
      
      // Otherwise fetch from storage URL
      if (document.downloadUrl) {
        const response = await fetch(document.downloadUrl);
        if (!response.ok) {
          throw new Error('Download failed');
        }
        return await response.text();
      }
      
      throw new Error('No content available');
    } catch (error) {
      console.error('Download failed:', error);
      throw new Error('Failed to download document');
    }
  }

  /**
   * Delete user's existing ERP documents from purchaser_erpDocuments collection
   */
  async deleteUserERPDocuments(userId: string, workspace: WorkspaceType = 'purchaser'): Promise<void> {
    try {
      // Delete documents from purchaser_erpDocuments collection
      const recordsQ = query(
        collection(db, 'purchaser_erpDocuments'),
        where('userId', '==', userId)
      );
      
      const recordsSnapshot = await getDocs(recordsQ);
      const deleteRecordsPromises = recordsSnapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deleteRecordsPromises);
      
      console.log(`🗑️ Deleted ${recordsSnapshot.docs.length} existing ERP documents from purchaser_erpDocuments`);
    } catch (error) {
      console.error('Failed to delete existing ERP documents:', error);
      // Don't throw - just log and continue
    }
  }

  /**
   * Upload ERP/Excel document with parsing
   */
  async uploadERPDocument(
    file: File, 
    userId: string,
    workspace: WorkspaceType = 'purchaser'
  ): Promise<ERPDocument> {
    try {
      // Delete existing ERP documents for this user and workspace
      await this.deleteUserERPDocuments(userId, workspace);
      
      const fileExtension = file.name.split('.').pop()?.toLowerCase();
      
      if (!['xlsx', 'xls'].includes(fileExtension || '')) {
        throw new Error('Only Excel (.xlsx, .xls) files are supported');
      }
      
      // Handle Excel files only
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      
      const sheets = workbook.SheetNames;
      
      // Process first sheet - pure JSON approach
      const firstSheet = workbook.Sheets[sheets[0]];
      const jsonObjects = XLSX.utils.sheet_to_json(firstSheet) as Record<string, unknown>[];
      
      const columnCount = Object.keys(jsonObjects[0] || {}).length;
      const columnNames = Object.keys(jsonObjects[0] || {});
      
      console.log(`📊 Processed ${jsonObjects.length} records as JSON objects from sheet: ${sheets[0]}`);
      console.log(`📋 Found ${columnCount} columns:`, columnNames);
      
      // Save each row directly to purchaser_erpDocuments with order number as document ID
      console.log(`💾 Saving ${jsonObjects.length} records directly to purchaser_erpDocuments collection...`);
      console.log(`🔧 Using order numbers as document IDs with Excel columns as fields`);
      
      const recordPromises = jsonObjects.map((record, index) => {
        // Use order number as document ID if available, otherwise fallback
        const orderNumberField = Object.keys(record).find(key => 
          key.toLowerCase().includes('order') && key.toLowerCase().includes('number')
        );
        const orderNumber = orderNumberField ? String(record[orderNumberField]) : `record_${Date.now()}_${index}`;
        
        const recordData = {
          userId,
          uploadedAt: new Date(),
          originalFileName: file.name,
          rowIndex: index + 1,
          ...record // Spread all Excel columns as individual Firestore fields
        };
        
        // Log first record structure as example
        if (index === 0) {
          console.log(`📄 Sample record structure:`, Object.keys(recordData));
          console.log(`📋 Using order number '${orderNumber}' as document ID`);
        }
        
        return addDoc(collection(db, 'purchaser_erpDocuments'), recordData);
      });
      
      await Promise.all(recordPromises);
      console.log(`✅ Saved ${jsonObjects.length} individual records to purchaser_erpDocuments collection`);
      
      // Return format with jsonData for compatibility
      return {
        id: `upload_${Date.now()}`, // Generate temporary ID for compatibility
        name: file.name,
        originalFormat: fileExtension,
        jsonData: jsonObjects, // Keep in memory for immediate use
        sheets: sheets,
        size: file.size,
        uploadedAt: new Date(),
        userId: userId,
        type: 'erp-integration' as const,
        storageUrl: '',
        downloadUrl: ''
      };
    } catch (error) {
      console.error('ERP upload failed:', error);
      throw new Error(`Failed to upload ERP document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get user's ERP documents from purchaser_erpDocuments collection
   */
  async getUserERPDocuments(userId: string, workspace: WorkspaceType = 'purchaser'): Promise<ERPDocument[]> {
    try {
      // Get all records from purchaser_erpDocuments for this user
      const recordsQ = query(
        collection(db, 'purchaser_erpDocuments'),
        where('userId', '==', userId)
      );
      
      const recordsSnapshot = await getDocs(recordsQ);
      const jsonData = recordsSnapshot.docs.map(recordDoc => {
        const recordData = recordDoc.data();
        // Remove metadata fields, keep only Excel columns
        const { userId, uploadedAt, originalFileName, rowIndex, ...excelColumns } = recordData;
        return excelColumns;
      });
      
      console.log(`📋 Loaded ${jsonData.length} individual records from purchaser_erpDocuments`);
      
      // Group by original filename if available
      const fileGroups = new Map<string, Record<string, unknown>[]>();
      
      for (const doc of recordsSnapshot.docs) {
        const data = doc.data();
        const fileName = data.originalFileName || 'Unknown File';
        
        if (!fileGroups.has(fileName)) {
          fileGroups.set(fileName, []);
        }
        
        const { userId, uploadedAt, originalFileName, rowIndex, ...excelColumns } = data;
        fileGroups.get(fileName)!.push(excelColumns);
      }
      
      // Create ERPDocument objects for each file
      const documents: ERPDocument[] = [];
      for (const [fileName, records] of fileGroups) {
        const firstRecord = recordsSnapshot.docs.find(doc => doc.data().originalFileName === fileName);
        const firstRecordData = firstRecord?.data();
        
        documents.push({
          id: `file_${fileName}_${Date.now()}`,
          name: fileName,
          originalFormat: 'xlsx',
          jsonData: records,
          sheets: ['Sheet1'],
          size: records.length * 100, // Estimate
          uploadedAt: firstRecordData?.uploadedAt || new Date(),
          userId: userId,
          type: 'erp-integration' as const,
          storageUrl: '',
          downloadUrl: ''
        });
      }
      
      // Sort by uploadedAt on client side
      return documents.sort((a, b) => 
        new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
      );
    } catch (error) {
      console.error('Failed to fetch ERP documents:', error);
      throw new Error('Failed to fetch ERP documents');
    }
  }

  /**
   * Delete ERP document and its records
   */
  async deleteERPDocument(documentId: string, storagePath?: string, workspace: WorkspaceType = 'purchaser'): Promise<void> {
    try {
      // Delete from storage if using storage
      if (storagePath) {
        const storageRef = ref(storage, storagePath);
        await deleteObject(storageRef);
      }

      // Delete individual records first
      const recordsQ = query(
        collection(db, getWorkspaceCollectionName('erpRecords', workspace)),
        where('parentDocumentId', '==', documentId)
      );
      
      const recordsSnapshot = await getDocs(recordsQ);
      const deleteRecordsPromises = recordsSnapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deleteRecordsPromises);
      
      console.log(`🗑️ Deleted ${recordsSnapshot.docs.length} records for document ${documentId}`);

      // Delete document metadata
      await deleteDoc(doc(db, getWorkspaceCollectionName('erpDocuments', workspace), documentId));
      
      console.log(`🗑️ Deleted document metadata ${documentId}`);
    } catch (error) {
      console.error('Delete failed:', error);
      throw new Error('Failed to delete ERP document');
    }
  }

  /**
   * Download ERP document as JSON
   */
  async downloadERPDocument(document: ERPDocument): Promise<string> {
    try {
      // Return JSON data as formatted string
      if (document.jsonData && document.jsonData.length > 0) {
        return JSON.stringify(document.jsonData, null, 2);
      }
      
      throw new Error('No JSON data available');
    } catch (error) {
      console.error('Download failed:', error);
      throw new Error('Failed to download ERP document');
    }
  }
}

export const storageService = new StorageService();