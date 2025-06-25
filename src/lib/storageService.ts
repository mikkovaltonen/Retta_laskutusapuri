import { storage, db } from './firebase';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { collection, addDoc, getDocs, deleteDoc, doc, query, where, orderBy, setDoc } from 'firebase/firestore';
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
   * Delete user's existing documents from specific collection
   */
  async deleteUserDocumentsFromCollection(userId: string, collectionName: string): Promise<void> {
    try {
      const recordsQ = query(
        collection(db, collectionName),
        where('userId', '==', userId)
      );
      
      const recordsSnapshot = await getDocs(recordsQ);
      const deleteRecordsPromises = recordsSnapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deleteRecordsPromises);
      
      console.log(`🗑️ Deleted ${recordsSnapshot.docs.length} existing documents from ${collectionName}`);
    } catch (error) {
      console.error(`Failed to delete existing documents from ${collectionName}:`, error);
      // Don't throw - just log and continue
    }
  }

  /**
   * Upload Excel document to hinnasto collection
   */
  async uploadHinnastoDocument(
    file: File, 
    userId: string
  ): Promise<ERPDocument> {
    try {
      // Delete existing hinnasto documents for this user
      await this.deleteUserDocumentsFromCollection(userId, 'hinnasto');
      
      const fileExtension = file.name.split('.').pop()?.toLowerCase();
      
      if (!['xlsx', 'xls'].includes(fileExtension || '')) {
        throw new Error('Only Excel (.xlsx, .xls) files are supported');
      }
      
      // Handle Excel files only
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      
      // Look for 'Hinnasto' sheet specifically
      const hinnastoSheet = workbook.Sheets['Hinnasto'] || workbook.Sheets[workbook.SheetNames[0]];
      if (!hinnastoSheet) {
        throw new Error('Hinnasto sheet not found in Excel file');
      }
      
      let jsonObjects = XLSX.utils.sheet_to_json(hinnastoSheet) as Record<string, unknown>[];
      
      // Clean up and rename columns for hinnasto data
      jsonObjects = jsonObjects.map(row => {
        const cleanedRow: Record<string, unknown> = {};
        
        // Map problematic column names to proper names
        for (const [key, value] of Object.entries(row)) {
          let cleanKey = key;
          
          // Fix common Excel parsing issues
          if (key === '__EMPTY') {
            cleanKey = 'Tuotetunnus';
          } else if (key === '__EMPTY_1') {
            cleanKey = 'Tuote';
          } else if (key === '__EMPTY_2') {
            cleanKey = 'Myyntihinta';
          } else if (key === 'hinnat alv0') {
            cleanKey = 'Ostohinta';
          } else if (key.startsWith('__EMPTY')) {
            // Skip other empty columns
            continue;
          }
          
          // Only include non-empty values
          if (value !== undefined && value !== null && value !== '') {
            cleanedRow[cleanKey] = value;
          }
        }
        
        return cleanedRow;
      });
      
      // Filter out rows that are mostly empty
      jsonObjects = jsonObjects.filter(row => 
        Object.keys(row).length > 1 && 
        Object.values(row).some(val => val !== undefined && val !== null && val !== '')
      );
      
      // Remove header row (first row that contains column names as string values)
      jsonObjects = jsonObjects.filter(row => {
        // Check if this row contains header values (column names as strings)
        const values = Object.values(row);
        const isHeaderRow = values.some(val => 
          typeof val === 'string' && 
          (val === 'myyntihinta' || val === 'Tuote' || val === 'Tuotetunnus' || val === 'Ostohinta')
        );
        return !isHeaderRow;
      });
      
      console.log(`📊 Processed ${jsonObjects.length} hinnasto records with cleaned column names`);
      
      // Save each row to hinnasto collection
      const recordPromises = jsonObjects.map((record, index) => {
        const documentId = `hinnasto_${Date.now()}_${index + 1}`;
        
        const recordData = {
          userId,
          uploadedAt: new Date(),
          createdAt: new Date(),
          originalFileName: file.name,
          rowIndex: index + 1,
          ...record // Spread all Excel columns as individual Firestore fields
        };
        
        return setDoc(doc(db, 'hinnasto', documentId), recordData);
      });
      
      await Promise.all(recordPromises);
      console.log(`✅ Saved ${jsonObjects.length} hinnasto records`);
      
      return {
        id: `hinnasto_${Date.now()}`,
        name: file.name,
        originalFormat: fileExtension,
        jsonData: jsonObjects,
        sheets: ['Hinnasto'],
        size: file.size,
        uploadedAt: new Date(),
        userId: userId,
        type: 'erp-integration' as const,
        storageUrl: '',
        downloadUrl: ''
      };
    } catch (error) {
      console.error('Hinnasto upload failed:', error);
      throw new Error(`Failed to upload hinnasto document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Upload Excel document to tilaus_data collection
   */
  async uploadTilausDocument(
    file: File, 
    userId: string
  ): Promise<ERPDocument> {
    try {
      // Delete existing tilaus documents for this user
      await this.deleteUserDocumentsFromCollection(userId, 'tilaus_data');
      
      const fileExtension = file.name.split('.').pop()?.toLowerCase();
      
      if (!['xlsx', 'xls'].includes(fileExtension || '')) {
        throw new Error('Only Excel (.xlsx, .xls) files are supported');
      }
      
      // Handle Excel files only
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      
      // Look for 'Tilaus' sheet specifically
      const tilausSheet = workbook.Sheets['Tilaus'] || workbook.Sheets[workbook.SheetNames[0]];
      if (!tilausSheet) {
        throw new Error('Tilaus sheet not found in Excel file');
      }
      
      let jsonObjects = XLSX.utils.sheet_to_json(tilausSheet) as Record<string, unknown>[];
      
      // Clean up and rename columns for tilaus data
      jsonObjects = jsonObjects.map(row => {
        const cleanedRow: Record<string, unknown> = {};
        
        // Map problematic column names to proper names for tilaus data
        for (const [key, value] of Object.entries(row)) {
          let cleanKey = key;
          
          // Fix common Excel parsing issues for tilaus data
          if (key.startsWith('__EMPTY')) {
            // Skip empty columns for tilaus data
            continue;
          }
          
          // Clean up column names
          cleanKey = key.trim();
          
          // Only include non-empty values
          if (value !== undefined && value !== null && value !== '') {
            cleanedRow[cleanKey] = value;
          }
        }
        
        return cleanedRow;
      });
      
      // Filter out rows that are mostly empty
      jsonObjects = jsonObjects.filter(row => 
        Object.keys(row).length > 1 && 
        Object.values(row).some(val => val !== undefined && val !== null && val !== '')
      );
      
      // Remove header row (first row that contains column names as string values)
      jsonObjects = jsonObjects.filter(row => {
        // Check if this row contains header values (column names as strings)
        const values = Object.values(row);
        const isHeaderRow = values.some(val => 
          typeof val === 'string' && 
          Object.keys(row).some(key => val === key) // Value matches a column name
        );
        return !isHeaderRow;
      });
      
      console.log(`📊 Processed ${jsonObjects.length} tilaus records with cleaned column names`);
      
      // Save each row to tilaus_data collection
      const recordPromises = jsonObjects.map((record, index) => {
        const documentId = `tilaus_${Date.now()}_${index + 1}`;
        
        const recordData = {
          userId,
          uploadedAt: new Date(),
          createdAt: new Date(),
          originalFileName: file.name,
          rowIndex: index + 1,
          ...record // Spread all Excel columns as individual Firestore fields
        };
        
        return setDoc(doc(db, 'tilaus_data', documentId), recordData);
      });
      
      await Promise.all(recordPromises);
      console.log(`✅ Saved ${jsonObjects.length} tilaus records`);
      
      return {
        id: `tilaus_${Date.now()}`,
        name: file.name,
        originalFormat: fileExtension,
        jsonData: jsonObjects,
        sheets: ['Tilaus'],
        size: file.size,
        uploadedAt: new Date(),
        userId: userId,
        type: 'erp-integration' as const,
        storageUrl: '',
        downloadUrl: ''
      };
    } catch (error) {
      console.error('Tilaus upload failed:', error);
      throw new Error(`Failed to upload tilaus document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Upload ERP/Excel document with parsing (legacy function)
   */
  async uploadERPDocument(
    file: File, 
    userId: string,
    workspace: WorkspaceType = 'purchaser'
  ): Promise<ERPDocument> {
    try {
      // Delete existing ERP documents for this user and workspace
      const collectionName = workspace === 'invoicer' ? 'invoicer_erpDocuments' : 'purchaser_erpDocuments';
      await this.deleteUserDocumentsFromCollection(userId, collectionName);
      
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
      
      // Use the same collection name from above
      
      // Save each row directly to workspace-specific collection with order/invoice number as document ID
      console.log(`💾 Saving ${jsonObjects.length} records directly to ${collectionName} collection...`);
      console.log(`🔧 Using ${workspace === 'invoicer' ? 'invoice' : 'order'} numbers as document IDs with Excel columns as fields`);
      
      const recordPromises = jsonObjects.map((record, index) => {
        // Use appropriate number field as document ID based on workspace
        let numberField, documentId;
        
        if (workspace === 'invoicer') {
          // For invoices, look for invoice number field
          numberField = Object.keys(record).find(key => 
            key.toLowerCase().includes('invoice') && key.toLowerCase().includes('number')
          );
          const invoiceNumber = numberField ? String(record[numberField]) : `invoice_${Date.now()}_${index}`;
          documentId = `${invoiceNumber}_row_${index + 1}`;
        } else {
          // For purchase orders, look for order number field
          numberField = Object.keys(record).find(key => 
            key.toLowerCase().includes('order') && key.toLowerCase().includes('number')
          );
          const orderNumber = numberField ? String(record[numberField]) : `order_${Date.now()}_${index}`;
          documentId = `${orderNumber}_row_${index + 1}`;
        }
        
        const recordData = {
          userId,
          uploadedAt: new Date(),
          createdAt: new Date(), // Row creation timestamp
          originalFileName: file.name,
          rowIndex: index + 1,
          ...record // Spread all Excel columns as individual Firestore fields
        };
        
        // Log first record structure as example
        if (index === 0) {
          console.log(`📄 Sample record structure:`, Object.keys(recordData));
          console.log(`📋 Using document ID: ${documentId}`);
        }
        
        return setDoc(doc(db, collectionName, documentId), recordData);
      });
      
      await Promise.all(recordPromises);
      console.log(`✅ Saved ${jsonObjects.length} individual records to ${collectionName} collection`);
      
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
   * Get user's ERP documents from workspace-specific collection
   */
  async getUserERPDocuments(userId: string, workspace: WorkspaceType = 'purchaser'): Promise<ERPDocument[]> {
    try {
      const collectionName = workspace === 'invoicer' ? 'invoicer_erpDocuments' : 'purchaser_erpDocuments';
      
      // Get all records from workspace-specific collection for this user
      const recordsQ = query(
        collection(db, collectionName),
        where('userId', '==', userId)
      );
      
      const recordsSnapshot = await getDocs(recordsQ);
      const jsonData = recordsSnapshot.docs.map(recordDoc => {
        const recordData = recordDoc.data();
        // Remove metadata fields, keep only Excel columns
        const { userId, uploadedAt, createdAt, originalFileName, rowIndex, createdViaAPI, ...excelColumns } = recordData;
        return excelColumns;
      });
      
      console.log(`📋 Loaded ${jsonData.length} individual records from ${collectionName}`);
      
      // Group by original filename if available
      const fileGroups = new Map<string, Record<string, unknown>[]>();
      
      for (const doc of recordsSnapshot.docs) {
        const data = doc.data();
        const fileName = data.originalFileName || 'Unknown File';
        
        if (!fileGroups.has(fileName)) {
          fileGroups.set(fileName, []);
        }
        
        const { userId, uploadedAt, createdAt, originalFileName, rowIndex, createdViaAPI, ...excelColumns } = data;
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
   * Get user's hinnasto documents
   */
  async getUserHinnastoDocuments(userId: string): Promise<ERPDocument[]> {
    try {
      const recordsQ = query(
        collection(db, 'hinnasto'),
        where('userId', '==', userId)
      );
      
      const recordsSnapshot = await getDocs(recordsQ);
      const jsonData = recordsSnapshot.docs.map(recordDoc => {
        const recordData = recordDoc.data();
        const { userId, uploadedAt, createdAt, originalFileName, rowIndex, ...excelColumns } = recordData;
        return excelColumns;
      });
      
      console.log(`📋 Loaded ${jsonData.length} hinnasto records`);
      
      // Group by original filename
      const fileGroups = new Map<string, Record<string, unknown>[]>();
      
      for (const doc of recordsSnapshot.docs) {
        const data = doc.data();
        const fileName = data.originalFileName || 'Hinnasto Data';
        
        if (!fileGroups.has(fileName)) {
          fileGroups.set(fileName, []);
        }
        
        const { userId, uploadedAt, createdAt, originalFileName, rowIndex, ...excelColumns } = data;
        fileGroups.get(fileName)!.push(excelColumns);
      }
      
      // Create ERPDocument objects for each file
      const documents: ERPDocument[] = [];
      for (const [fileName, records] of fileGroups) {
        const firstRecord = recordsSnapshot.docs.find(doc => doc.data().originalFileName === fileName);
        const firstRecordData = firstRecord?.data();
        
        documents.push({
          id: `hinnasto_${fileName}_${Date.now()}`,
          name: fileName,
          originalFormat: 'xlsx',
          jsonData: records,
          sheets: ['Hinnasto'],
          size: records.length * 100,
          uploadedAt: firstRecordData?.uploadedAt || new Date(),
          userId: userId,
          type: 'erp-integration' as const,
          storageUrl: '',
          downloadUrl: ''
        });
      }
      
      return documents.sort((a, b) => 
        new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
      );
    } catch (error) {
      console.error('Failed to fetch hinnasto documents:', error);
      throw new Error('Failed to fetch hinnasto documents');
    }
  }

  /**
   * Get user's tilaus documents
   */
  async getUserTilausDocuments(userId: string): Promise<ERPDocument[]> {
    try {
      const recordsQ = query(
        collection(db, 'tilaus_data'),
        where('userId', '==', userId)
      );
      
      const recordsSnapshot = await getDocs(recordsQ);
      const jsonData = recordsSnapshot.docs.map(recordDoc => {
        const recordData = recordDoc.data();
        const { userId, uploadedAt, createdAt, originalFileName, rowIndex, ...excelColumns } = recordData;
        return excelColumns;
      });
      
      console.log(`📋 Loaded ${jsonData.length} tilaus records`);
      
      // Group by original filename
      const fileGroups = new Map<string, Record<string, unknown>[]>();
      
      for (const doc of recordsSnapshot.docs) {
        const data = doc.data();
        const fileName = data.originalFileName || 'Tilaus Data';
        
        if (!fileGroups.has(fileName)) {
          fileGroups.set(fileName, []);
        }
        
        const { userId, uploadedAt, createdAt, originalFileName, rowIndex, ...excelColumns } = data;
        fileGroups.get(fileName)!.push(excelColumns);
      }
      
      // Create ERPDocument objects for each file
      const documents: ERPDocument[] = [];
      for (const [fileName, records] of fileGroups) {
        const firstRecord = recordsSnapshot.docs.find(doc => doc.data().originalFileName === fileName);
        const firstRecordData = firstRecord?.data();
        
        documents.push({
          id: `tilaus_${fileName}_${Date.now()}`,
          name: fileName,
          originalFormat: 'xlsx',
          jsonData: records,
          sheets: ['Tilaus'],
          size: records.length * 100,
          uploadedAt: firstRecordData?.uploadedAt || new Date(),
          userId: userId,
          type: 'erp-integration' as const,
          storageUrl: '',
          downloadUrl: ''
        });
      }
      
      return documents.sort((a, b) => 
        new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
      );
    } catch (error) {
      console.error('Failed to fetch tilaus documents:', error);
      throw new Error('Failed to fetch tilaus documents');
    }
  }

  /**
   * Delete user's hinnasto documents
   */
  async deleteHinnastoDocuments(userId: string): Promise<void> {
    await this.deleteUserDocumentsFromCollection(userId, 'hinnasto');
  }

  /**
   * Delete user's tilaus documents
   */
  async deleteTilausDocuments(userId: string): Promise<void> {
    await this.deleteUserDocumentsFromCollection(userId, 'tilaus_data');
  }

  /**
   * Get user's myyntilaskut documents
   */
  async getUserMyyntilaskutDocuments(userId: string): Promise<ERPDocument[]> {
    try {
      const recordsQ = query(
        collection(db, 'myyntilaskut'),
        where('userId', '==', userId)
      );
      
      const recordsSnapshot = await getDocs(recordsQ);
      const jsonData = recordsSnapshot.docs.map(recordDoc => {
        const recordData = recordDoc.data();
        const { userId, uploadedAt, createdAt, ...invoiceData } = recordData;
        return {
          id: recordDoc.id,
          ...invoiceData
        };
      });
      
      console.log(`📋 Loaded ${jsonData.length} myyntilaskut records`);
      
      // Group by laskuotsikko or create single document
      const fileGroups = new Map<string, Record<string, unknown>[]>();
      
      for (const doc of recordsSnapshot.docs) {
        const data = doc.data();
        const fileName = data.laskuotsikko || 'Myyntilaskut Data';
        
        if (!fileGroups.has(fileName)) {
          fileGroups.set(fileName, []);
        }
        
        const { userId, uploadedAt, createdAt, ...invoiceData } = data;
        fileGroups.get(fileName)!.push({
          id: doc.id,
          ...invoiceData
        });
      }
      
      // Create ERPDocument objects for each file group
      const documents: ERPDocument[] = [];
      for (const [fileName, records] of fileGroups) {
        const firstRecord = recordsSnapshot.docs.find(doc => 
          (doc.data().laskuotsikko || 'Myyntilaskut Data') === fileName
        );
        const firstRecordData = firstRecord?.data();
        
        documents.push({
          id: `myyntilaskut_${fileName}_${Date.now()}`,
          name: fileName,
          originalFormat: 'json',
          jsonData: records,
          sheets: ['Myyntilaskut'],
          size: records.length * 200,
          uploadedAt: new Date(firstRecordData?.luontipaiva || firstRecordData?.uploadedAt || new Date()),
          userId: userId,
          type: 'erp-integration' as const,
          storageUrl: '',
          downloadUrl: ''
        });
      }
      
      return documents.sort((a, b) => 
        new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
      );
    } catch (error) {
      console.error('Failed to fetch myyntilaskut documents:', error);
      throw new Error('Failed to fetch myyntilaskut documents');
    }
  }

  /**
   * Delete user's myyntilaskut documents
   */
  async deleteMyyntilaskutDocuments(userId: string): Promise<void> {
    await this.deleteUserDocumentsFromCollection(userId, 'myyntilaskut');
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