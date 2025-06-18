import { storageService, ERPDocument, WorkspaceType } from './storageService';
import * as XLSX from 'xlsx';
import { db } from './firebase';
import { collection, addDoc, setDoc, doc } from 'firebase/firestore';

// Helper function to get workspace-specific collection names
const getWorkspaceCollectionName = (baseCollection: string, workspace: WorkspaceType): string => {
  if (baseCollection === 'knowledge' && workspace === 'competitive_bidding') {
    return 'purchaser_knowledge';
  }
  return `${workspace}_${baseCollection}`;
};

export interface SearchCriteria {
  supplierName?: string;        // Toimittajan nimi tai osa nimestä
  productDescription?: string;  // Tuotteen kuvaus tai osa kuvauksesta (purchase orders)
  serviceDescription?: string;  // Palvelun kuvaus tai osa kuvauksesta (invoices)
  dateFrom?: string;           // Ostopäivämäärä alkaen (YYYY-MM-DD)
  dateTo?: string;             // Ostopäivämäärä päättyen (YYYY-MM-DD)
  dueDateFrom?: string;        // Eräpäivä alkaen (YYYY-MM-DD) - invoices only
  dueDateTo?: string;          // Eräpäivä päättyen (YYYY-MM-DD) - invoices only
  buyerName?: string;          // Ostajan nimi tai osa nimestä (purchase orders)
  approverName?: string;       // Hyväksyjän nimi tai osa nimestä (invoices)
  paymentStatus?: string;      // Maksun tila (invoices only)
}

export interface ERPRecord {
  rowIndex: number;
  [key: string]: string | number | boolean | null | undefined; // Dynamic columns based on Excel headers
}

export interface PurchaseOrderRow {
  orderNumber: string;
  supplierName: string;
  productDescription: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  orderDate: string; // YYYY-MM-DD format
  receiveByDate?: string; // YYYY-MM-DD format
  buyerName?: string;
  status?: string;
  notes?: string;
}

export interface CreatePurchaseOrderResult {
  success: boolean;
  orderNumber: string;
  fileName: string;
  downloadUrl?: string;
  rowsAdded: number;
  message: string;
}

export interface SearchResult {
  records: ERPRecord[];
  totalCount: number;
  searchCriteria: SearchCriteria;
  executedAt: Date;
  processingTimeMs: number;
}

export class ERPApiService {
  /**
   * Search ERP data with multiple criteria
   */
  async searchRecords(userId: string, criteria: SearchCriteria, workspace: WorkspaceType = 'purchaser'): Promise<SearchResult> {
    const startTime = Date.now();
    const requestId = Math.random().toString(36).substring(2, 8);
    
    // Log API Request Input
    console.log('📥 ERP API REQUEST [' + requestId + ']:', {
      method: 'searchRecords',
      userId: userId.substring(0, 8) + '...',
      inputParameters: {
        supplierName: criteria.supplierName || null,
        productDescription: criteria.productDescription || null,
        dateFrom: criteria.dateFrom || null,
        dateTo: criteria.dateTo || null,
        buyerName: criteria.buyerName || null
      },
      timestamp: new Date().toISOString(),
      requestId: requestId
    });
    
    try {
      // Get user's ERP document
      const erpDocuments = await storageService.getUserERPDocuments(userId, workspace);
      
      if (erpDocuments.length === 0) {
        const result = {
          records: [],
          totalCount: 0,
          searchCriteria: criteria,
          executedAt: new Date(),
          processingTimeMs: Date.now() - startTime
        };
        
        // Log API Response Output (no data)
        console.log('📤 ERP API RESPONSE [' + requestId + ']:', {
          status: 'NO_DATA',
          outputResults: {
            recordCount: result.totalCount,
            records: [],
            searchCriteria: result.searchCriteria
          },
          processingTimeMs: result.processingTimeMs,
          timestamp: new Date().toISOString(),
          requestId: requestId
        });
        
        return result;
      }

      console.log(`📄 Found ${erpDocuments.length} ERP documents for user, combining all data for search.`);

      // Combine JSON data from all ERP documents
      let allJsonRecords: Record<string, unknown>[] = [];

      for (const erpDoc of erpDocuments) {
        console.log(`📊 Processing document: ${erpDoc.name}`);
        
        if (erpDoc.jsonData && erpDoc.jsonData.length > 0) {
          allJsonRecords.push(...erpDoc.jsonData);
          console.log(`✅ Added ${erpDoc.jsonData.length} JSON records from ${erpDoc.name}`);
        } else {
          console.log(`⚠️ No JSON data found in ${erpDoc.name}`);
        }
      }

      if (!allJsonRecords || allJsonRecords.length === 0) {
        const result = {
          records: [],
          totalCount: 0,
          searchCriteria: criteria,
          executedAt: new Date(),
          processingTimeMs: Date.now() - startTime
        };
        
        // Log API Response Output (invalid data)
        console.log('📤 ERP API RESPONSE [' + requestId + ']:', {
          status: 'INVALID_DATA',
          outputResults: {
            recordCount: result.totalCount,
            records: [],
            searchCriteria: result.searchCriteria,
            error: 'No valid data or headers found'
          },
          processingTimeMs: result.processingTimeMs,
          timestamp: new Date().toISOString(),
          requestId: requestId
        });
        
        return result;
      }

      // Convert JSON objects to ERPRecord format
      const allRecords: ERPRecord[] = allJsonRecords.map((jsonRecord, index) => {
        const record: ERPRecord = { 
          rowIndex: index + 2, // +2 because row 1 is headers, Excel rows start from 1
          ...jsonRecord // Spread all JSON properties
        };
        return record;
      });

      // Apply search filters
      const availableHeaders = allRecords.length > 0 ? Object.keys(allRecords[0]).filter(key => key !== 'rowIndex') : [];
      console.log('📋 Before filtering:', {
        totalRecords: allRecords.length,
        availableHeaders: availableHeaders,
        sampleRecord: allRecords[0] || null
      });
      
      // Debug: Show detailed first record mapping
      // Minimal logging for production
      if (allRecords.length > 0) {
        console.log(`📋 Data summary: ${availableHeaders.length} headers, ${allRecords.length} records`);
      }

      const filteredRecords = this.applyFilters(allRecords, criteria, availableHeaders, requestId);
      
      const result = {
        records: filteredRecords,
        totalCount: filteredRecords.length,
        searchCriteria: criteria,
        executedAt: new Date(),
        processingTimeMs: Date.now() - startTime
      };
      
      // Log API Response Output (success)
      console.log('📤 ERP API RESPONSE [' + requestId + ']:', {
        status: 'SUCCESS',
        outputResults: {
          recordCount: result.totalCount,
          totalRecordsBeforeFilter: allRecords.length,
          searchCriteria: result.searchCriteria,
          sampleRecords: result.records.slice(0, 3).map(record => {
            const { rowIndex, ...data } = record;
            return { rowIndex, ...data };
          })
        },
        processingTimeMs: result.processingTimeMs,
        timestamp: new Date().toISOString(),
        requestId: requestId
      });

      return result;
    } catch (error) {
      // Log API Response Output (error)
      console.log('📤 ERP API RESPONSE [' + requestId + ']:', {
        status: 'ERROR',
        outputResults: {
          error: error instanceof Error ? error.message : 'Unknown error',
          searchCriteria: criteria
        },
        processingTimeMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        requestId: requestId
      });
      
      console.error('❌ ERP API search failed:', error);
      throw new Error(`Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Apply search filters to records
   */
  private applyFilters(records: ERPRecord[], criteria: SearchCriteria, headers: string[], requestId: string): ERPRecord[] {
    console.log('🔧 FILTER PROCESSING [' + requestId + ']:', {
      startingRecordCount: records.length,
      filtersToApply: Object.keys(criteria).filter(key => criteria[key as keyof SearchCriteria])
    });
    
    const filtered = records.filter(record => {
      // Filter by supplier name - exact column match
      if (criteria.supplierName) {
        const supplierField = headers.find(header => 
          header === 'Supplier Name' || header.toLowerCase() === 'supplier name'
        );
        // Removed excessive per-record logging for production
        
        if (supplierField) {
          const supplierValue = String(record[supplierField] || '').toLowerCase();
          const searchTerm = criteria.supplierName.toLowerCase();
          if (!supplierValue.includes(searchTerm)) {
            return false;
          }
        } else {
          console.log('⚠️ "Supplier Name" column not found. Available headers:', headers);
        }
      }

      // Filter by product description - exact column match (purchase orders)
      if (criteria.productDescription) {
        const productField = headers.find(header => 
          header === 'Description' || header.toLowerCase() === 'description'
        );
        // Removed excessive per-record logging for production
        
        if (productField) {
          const productValue = String(record[productField] || '').toLowerCase();
          const searchTerm = criteria.productDescription.toLowerCase();
          if (!productValue.includes(searchTerm)) {
            return false;
          }
        } else {
          console.log('⚠️ "Description" column not found. Available headers:', headers);
        }
      }

      // Filter by service description - exact column match (invoices)
      if (criteria.serviceDescription) {
        const serviceField = headers.find(header => 
          header === 'Service Description' || header.toLowerCase() === 'service description' ||
          header === 'Description' || header.toLowerCase() === 'description'
        );
        
        if (serviceField) {
          const serviceValue = String(record[serviceField] || '').toLowerCase();
          const searchTerm = criteria.serviceDescription.toLowerCase();
          if (!serviceValue.includes(searchTerm)) {
            return false;
          }
        } else {
          console.log('⚠️ "Service Description" or "Description" column not found. Available headers:', headers);
        }
      }

      // Filter by date range
      if (criteria.dateFrom || criteria.dateTo) {
        // Look specifically for "Receive By" column as the date field
        const dateField = headers.find(header => 
          header === 'Receive By' || header.toLowerCase() === 'receive by'
        );
        
        // Removed excessive per-record logging for production
        
        if (dateField) {
          const rawDateValue = String(record[dateField] || '');
          const dateValue = this.parseDate(rawDateValue);
          
          // Date parsing optimized for production
          
          if (criteria.dateFrom && dateValue) {
            const fromDate = new Date(criteria.dateFrom);
            const passesFromCheck = dateValue >= fromDate;
            // Date FROM check optimized for production
            if (!passesFromCheck) {
              return false;
            }
          }
          
          if (criteria.dateTo && dateValue) {
            const toDate = new Date(criteria.dateTo);
            toDate.setHours(23, 59, 59, 999); // End of day
            const passesToCheck = dateValue <= toDate;
            // Date TO check optimized for production
            if (!passesToCheck) {
              return false;
            }
          }
        } else {
          console.log('⚠️ "Receive By" column not found for date filtering. Available headers:', headers);
          console.log('💡 Tip: Make sure your Excel has a column named "Receive By" for date filtering to work.');
        }
      }

      // Filter by buyer name - exact column match (purchase orders)
      if (criteria.buyerName) {
        const buyerField = headers.find(header => 
          header === 'Buyer Name' || header.toLowerCase() === 'buyer name'
        );
        // Removed excessive per-record logging for production
        
        if (buyerField) {
          const buyerValue = String(record[buyerField] || '').toLowerCase();
          const searchTerm = criteria.buyerName.toLowerCase();
          if (!buyerValue.includes(searchTerm)) {
            return false;
          }
        } else {
          console.log('⚠️ "Buyer Name" column not found. Available headers:', headers);
        }
      }

      // Filter by approver name - exact column match (invoices)
      if (criteria.approverName) {
        const approverField = headers.find(header => 
          header === 'Approver Name' || header.toLowerCase() === 'approver name' ||
          header === 'Approved By' || header.toLowerCase() === 'approved by'
        );
        
        if (approverField) {
          const approverValue = String(record[approverField] || '').toLowerCase();
          const searchTerm = criteria.approverName.toLowerCase();
          if (!approverValue.includes(searchTerm)) {
            return false;
          }
        } else {
          console.log('⚠️ "Approver Name" or "Approved By" column not found. Available headers:', headers);
        }
      }

      // Filter by due date range (invoices)
      if (criteria.dueDateFrom || criteria.dueDateTo) {
        const dueDateField = headers.find(header => 
          header === 'Due Date' || header.toLowerCase() === 'due date' ||
          header === 'Payment Due' || header.toLowerCase() === 'payment due'
        );
        
        if (dueDateField) {
          const rawDateValue = String(record[dueDateField] || '');
          const dateValue = this.parseDate(rawDateValue);
          
          if (criteria.dueDateFrom && dateValue) {
            const fromDate = new Date(criteria.dueDateFrom);
            if (dateValue < fromDate) {
              return false;
            }
          }
          
          if (criteria.dueDateTo && dateValue) {
            const toDate = new Date(criteria.dueDateTo);
            toDate.setHours(23, 59, 59, 999);
            if (dateValue > toDate) {
              return false;
            }
          }
        } else {
          console.log('⚠️ "Due Date" column not found for due date filtering. Available headers:', headers);
        }
      }

      // Filter by payment status (invoices)
      if (criteria.paymentStatus) {
        const statusField = headers.find(header => 
          header === 'Payment Status' || header.toLowerCase() === 'payment status' ||
          header === 'Status' || header.toLowerCase() === 'status'
        );
        
        if (statusField) {
          const statusValue = String(record[statusField] || '').toLowerCase();
          const searchTerm = criteria.paymentStatus.toLowerCase();
          if (!statusValue.includes(searchTerm)) {
            return false;
          }
        } else {
          console.log('⚠️ "Payment Status" or "Status" column not found. Available headers:', headers);
        }
      }

      return true;
    });
    
    console.log('✅ FILTER COMPLETE [' + requestId + ']:', {
      originalRecordCount: records.length,
      filteredRecordCount: filtered.length,
      recordsFiltered: records.length - filtered.length,
      filterEfficiency: ((records.length - filtered.length) / records.length * 100).toFixed(1) + '%'
    });
    
    return filtered;
  }


  /**
   * Parse date from various formats
   */
  private parseDate(dateStr: string): Date | null {
    if (!dateStr) return null;
    
    // Date parsing optimized for production
    
    // Try different date formats
    const formats = [
      { regex: /^\d{4}-\d{2}-\d{2}$/, name: 'YYYY-MM-DD' },
      { regex: /^\d{2}\/\d{2}\/\d{4}$/, name: 'MM/DD/YYYY' },
      { regex: /^\d{2}\.\d{2}\.\d{4}$/, name: 'DD.MM.YYYY' },
      { regex: /^\d{1,2}\/\d{1,2}\/\d{4}$/, name: 'M/D/YYYY' },
      { regex: /^\d{1,2}\.\d{1,2}\.\d{4}$/, name: 'D.M.YYYY' }
    ];

    for (const format of formats) {
      if (format.regex.test(dateStr)) {
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
          // Date parsed successfully
          return date;
        }
      }
    }

    // Try parsing as Excel date serial number
    const num = parseFloat(dateStr);
    if (!isNaN(num) && num > 1 && num < 100000) { // Reasonable range for Excel dates
      // Excel date: days since January 1, 1900 (with leap year bug)
      const excelEpoch = new Date(1900, 0, 1);
      const date = new Date(excelEpoch.getTime() + (num - 2) * 24 * 60 * 60 * 1000);
      if (!isNaN(date.getTime())) {
        // Excel serial date parsed successfully
        return date;
      }
    }

    // Failed to parse date - optimized for production
    return null;
  }

  /**
   * Get available fields/columns from ERP data
   */
  async getAvailableFields(userId: string, workspace: WorkspaceType = 'purchaser'): Promise<string[]> {
    const requestId = Math.random().toString(36).substring(2, 8);
    
    console.log('📥 ERP API REQUEST [' + requestId + ']:', {
      method: 'getAvailableFields',
      userId: userId.substring(0, 8) + '...',
      timestamp: new Date().toISOString(),
      requestId: requestId
    });
    
    try {
      const erpDocuments = await storageService.getUserERPDocuments(userId, workspace);
      
      if (erpDocuments.length === 0) {
        return [];
      }
      
      // Get fields from first document's JSON data
      const firstDoc = erpDocuments[0];
      const fields = (firstDoc.jsonData && firstDoc.jsonData.length > 0) 
        ? Object.keys(firstDoc.jsonData[0]) 
        : [];
      
      console.log('📤 ERP API RESPONSE [' + requestId + ']:', {
        status: 'SUCCESS',
        outputResults: {
          availableFields: fields,
          fieldCount: fields.length
        },
        timestamp: new Date().toISOString(),
        requestId: requestId
      });
      
      return fields;
    } catch (error) {
      console.log('📤 ERP API RESPONSE [' + requestId + ']:', {
        status: 'ERROR',
        outputResults: {
          error: error instanceof Error ? error.message : 'Unknown error'
        },
        timestamp: new Date().toISOString(),
        requestId: requestId
      });
      
      console.error('❌ Failed to get available fields:', error);
      return [];
    }
  }

  /**
   * Get sample data for testing
   */
  async getSampleData(userId: string, maxRows: number = 5, workspace: WorkspaceType = 'purchaser'): Promise<ERPRecord[]> {
    const requestId = Math.random().toString(36).substring(2, 8);
    
    console.log('📥 ERP API REQUEST [' + requestId + ']:', {
      method: 'getSampleData',
      userId: userId.substring(0, 8) + '...',
      inputParameters: {
        maxRows: maxRows
      },
      timestamp: new Date().toISOString(),
      requestId: requestId
    });
    
    try {
      const searchResult = await this.searchRecords(userId, {}, workspace);
      const sampleData = searchResult.records.slice(0, maxRows);
      
      console.log('📤 ERP API RESPONSE [' + requestId + ']:', {
        status: 'SUCCESS',
        outputResults: {
          sampleRecordCount: sampleData.length,
          totalAvailableRecords: searchResult.totalCount,
          maxRowsRequested: maxRows
        },
        timestamp: new Date().toISOString(),
        requestId: requestId
      });
      
      return sampleData;
    } catch (error) {
      console.log('📤 ERP API RESPONSE [' + requestId + ']:', {
        status: 'ERROR',
        outputResults: {
          error: error instanceof Error ? error.message : 'Unknown error',
          maxRowsRequested: maxRows
        },
        timestamp: new Date().toISOString(),
        requestId: requestId
      });
      
      console.error('❌ Failed to get sample data:', error);
      return [];
    }
  }

  /**
   * Create a new purchase order with multiple product rows and save to Excel
   */
  async createPurchaseOrder(userId: string, orderData: {
    orderNumber: string;
    supplierName: string;
    buyerName?: string;
    orderDate: string;
    receiveByDate?: string;
    rows: Array<{
      productDescription: string;
      quantity: number;
      unitPrice: number;
      notes?: string;
    }>;
  }, workspace: WorkspaceType = 'purchaser'): Promise<CreatePurchaseOrderResult> {
    const startTime = Date.now();
    const requestId = Math.random().toString(36).substring(2, 8);
    
    console.log('📥 ERP API REQUEST [' + requestId + ']:', {
      method: 'createPurchaseOrder',
      userId: userId.substring(0, 8) + '...',
      inputParameters: {
        orderNumber: orderData.orderNumber,
        supplierName: orderData.supplierName,
        buyerName: orderData.buyerName || null,
        orderDate: orderData.orderDate,
        receiveByDate: orderData.receiveByDate || null,
        productRows: orderData.rows.length
      },
      timestamp: new Date().toISOString(),
      requestId: requestId
    });

    try {
      // Generate filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
      const fileName = `Purchase_Order_${orderData.orderNumber}_${timestamp}.xlsx`;

      // Prepare Excel data with proper column names
      const excelRows = orderData.rows.map(row => ({
        'Order Number': orderData.orderNumber,
        'Supplier Name': orderData.supplierName,
        'Description': row.productDescription,
        'Qty': row.quantity,
        'Unit Price': row.unitPrice,
        'Total Price': row.quantity * row.unitPrice,
        'Order Date': orderData.orderDate,
        'Receive By': orderData.receiveByDate || '',
        'Buyer Name': orderData.buyerName || '',
        'Status': 'New',
        'Notes': row.notes || ''
      }));

      // Create Excel workbook
      const workbook = XLSX.utils.book_new();
      
      // Convert data to worksheet format
      const worksheet = XLSX.utils.json_to_sheet(excelRows);
      
      // Add headers styling (basic)
      const headers = [
        'Order Number', 'Supplier Name', 'Product Description', 'Quantity',
        'Unit Price', 'Total Price', 'Order Date', 'Receive By Date',
        'Buyer Name', 'Status', 'Notes'
      ];
      
      // Set column widths
      const colWidths = [
        { wch: 15 }, // Order Number
        { wch: 20 }, // Supplier Name
        { wch: 30 }, // Product Description
        { wch: 10 }, // Quantity
        { wch: 12 }, // Unit Price
        { wch: 12 }, // Total Price
        { wch: 12 }, // Order Date
        { wch: 15 }, // Receive By Date
        { wch: 15 }, // Buyer Name
        { wch: 10 }, // Status
        { wch: 25 }  // Notes
      ];
      worksheet['!cols'] = colWidths;

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Purchase Order');

      // Generate Excel buffer
      const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

      // Convert buffer to blob for download
      const blob = new Blob([excelBuffer], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });

      // Create download URL
      const downloadUrl = URL.createObjectURL(blob);

      const processingTime = Date.now() - startTime;

      console.log('📤 ERP API RESPONSE [' + requestId + ']:', {
        status: 'SUCCESS',
        outputResults: {
          orderNumber: orderData.orderNumber,
          fileName: fileName,
          rowsAdded: excelRows.length,
          downloadAvailable: true,
          totalValue: excelRows.reduce((sum, row) => sum + row['Total Price'], 0)
        },
        processingTimeMs: processingTime,
        timestamp: new Date().toISOString(),
        requestId: requestId
      });

      // Save to purchaser_erpDocuments collection - each row as separate document
      try {
        console.log(`💾 Saving ${excelRows.length} purchase order rows to purchaser_erpDocuments...`);
        
        // Save each row as separate document with order number + index as document ID
        const recordPromises = excelRows.map((record, index) => {
          // Create unique document ID using order number and row index
          const documentId = `${orderData.orderNumber}_row_${index + 1}`;
          
          const recordData = {
            userId,
            uploadedAt: new Date(),
            originalFileName: fileName,
            rowIndex: index + 1,
            createdViaAPI: true, // Mark as API-created vs uploaded
            ...record // All Excel columns as individual Firestore fields
          };
          
          // Log first record structure as example
          if (index === 0) {
            console.log(`📄 Sample purchase order record structure:`, Object.keys(recordData));
            console.log(`🆔 Using document ID: ${documentId}`);
          }
          
          return setDoc(doc(db, 'purchaser_erpDocuments', documentId), recordData);
        });
        
        await Promise.all(recordPromises);
        console.log(`✅ [CreatePurchaseOrder] Saved ${excelRows.length} individual records to purchaser_erpDocuments`);
      } catch (firestoreError) {
        console.warn('Failed to save to purchaser_erpDocuments, but Excel file created successfully:', firestoreError);
      }

      return {
        success: true,
        orderNumber: orderData.orderNumber,
        fileName: fileName,
        downloadUrl: downloadUrl,
        rowsAdded: excelRows.length,
        message: `Purchase order ${orderData.orderNumber} created successfully with ${excelRows.length} product rows. Total value: €${excelRows.reduce((sum, row) => sum + row['Total Price'], 0).toFixed(2)}`
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      console.log('📤 ERP API RESPONSE [' + requestId + ']:', {
        status: 'ERROR',
        outputResults: {
          error: error instanceof Error ? error.message : 'Unknown error',
          orderNumber: orderData.orderNumber
        },
        processingTimeMs: processingTime,
        timestamp: new Date().toISOString(),
        requestId: requestId
      });

      console.error('❌ Failed to create purchase order:', error);
      
      return {
        success: false,
        orderNumber: orderData.orderNumber,
        fileName: '',
        rowsAdded: 0,
        message: `Failed to create purchase order: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
}

export const erpApiService = new ERPApiService();