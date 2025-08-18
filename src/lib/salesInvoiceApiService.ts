import { storageService, ERPDocument } from './storageService';

export interface InvoiceSearchCriteria {
  customerName?: string;        // Customer name or partial name
  serviceDescription?: string;  // Service description or partial description
  invoiceDateFrom?: string;     // Invoice date from (YYYY-MM-DD)
  invoiceDateTo?: string;       // Invoice date to (YYYY-MM-DD)
  dueDateFrom?: string;         // Due date from (YYYY-MM-DD)
  dueDateTo?: string;           // Due date to (YYYY-MM-DD)
  approverName?: string;        // Approver name or partial name
  paymentStatus?: string;       // Payment status (Paid, Pending, Overdue, etc.)
  invoiceNumber?: string;       // Invoice number or partial number
  amountFrom?: number;          // Minimum invoice amount
  amountTo?: number;            // Maximum invoice amount
}

export interface InvoiceRecord {
  rowIndex: number;
  [key: string]: string | number | boolean | null | undefined; // Dynamic columns based on Excel headers
}

export interface InvoiceSearchResult {
  records: InvoiceRecord[];
  totalCount: number;
  searchCriteria: InvoiceSearchCriteria;
  executedAt: Date;
  processingTimeMs: number;
}

export class SalesInvoiceApiService {
  /**
   * Search sales invoice data with multiple criteria
   */
  async searchInvoices(userId: string, criteria: InvoiceSearchCriteria): Promise<InvoiceSearchResult> {
    const startTime = Date.now();
    const requestId = Math.random().toString(36).substring(2, 8);
    
    // Log API Request Input
    console.log('📥 SALES INVOICE API REQUEST [' + requestId + ']:', {
      method: 'searchInvoices',
      userId: userId.substring(0, 8) + '...',
      inputParameters: {
        customerName: criteria.customerName || null,
        serviceDescription: criteria.serviceDescription || null,
        invoiceDateFrom: criteria.invoiceDateFrom || null,
        invoiceDateTo: criteria.invoiceDateTo || null,
        dueDateFrom: criteria.dueDateFrom || null,
        dueDateTo: criteria.dueDateTo || null,
        approverName: criteria.approverName || null,
        paymentStatus: criteria.paymentStatus || null,
        invoiceNumber: criteria.invoiceNumber || null,
        amountFrom: criteria.amountFrom || null,
        amountTo: criteria.amountTo || null
      },
      timestamp: new Date().toISOString(),
      requestId: requestId
    });
    
    try {
      // Get user's sales invoice document from invoicer workspace
      const invoiceDocuments = await storageService.getUserERPDocuments(userId, 'invoicer');
      
      if (invoiceDocuments.length === 0) {
        const result = {
          records: [],
          totalCount: 0,
          searchCriteria: criteria,
          executedAt: new Date(),
          processingTimeMs: Date.now() - startTime
        };
        
        console.log('📤 SALES INVOICE API RESPONSE [' + requestId + ']:', {
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

      console.log(`📄 Found ${invoiceDocuments.length} invoice documents for user, combining all data for search.`);

      // Combine JSON data from all invoice documents
      const allJsonRecords: Record<string, unknown>[] = [];

      for (const invoiceDoc of invoiceDocuments) {
        console.log(`📊 Processing invoice document: ${invoiceDoc.name}`);
        
        if (invoiceDoc.jsonData && invoiceDoc.jsonData.length > 0) {
          allJsonRecords.push(...invoiceDoc.jsonData);
          console.log(`✅ Added ${invoiceDoc.jsonData.length} JSON records from ${invoiceDoc.name}`);
        } else {
          console.log(`⚠️ No JSON data found in ${invoiceDoc.name}`);
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
        
        console.log('📤 SALES INVOICE API RESPONSE [' + requestId + ']:', {
          status: 'INVALID_DATA',
          outputResults: {
            recordCount: result.totalCount,
            records: [],
            searchCriteria: result.searchCriteria,
            error: 'No valid invoice data found'
          },
          processingTimeMs: result.processingTimeMs,
          timestamp: new Date().toISOString(),
          requestId: requestId
        });
        
        return result;
      }

      // Convert JSON objects to InvoiceRecord format
      const allRecords: InvoiceRecord[] = allJsonRecords.map((jsonRecord, index) => {
        const record: InvoiceRecord = { 
          rowIndex: index + 2, // +2 because row 1 is headers, Excel rows start from 1
          ...jsonRecord // Spread all JSON properties
        };
        return record;
      });

      // Apply search filters
      const availableHeaders = allRecords.length > 0 ? Object.keys(allRecords[0]).filter(key => key !== 'rowIndex') : [];
      console.log('📋 Invoice data summary:', {
        totalRecords: allRecords.length,
        availableHeaders: availableHeaders,
        sampleRecord: allRecords[0] || null
      });

      const filteredRecords = this.applyInvoiceFilters(allRecords, criteria, availableHeaders, requestId);
      
      const result = {
        records: filteredRecords,
        totalCount: filteredRecords.length,
        searchCriteria: criteria,
        executedAt: new Date(),
        processingTimeMs: Date.now() - startTime
      };
      
      console.log('📤 SALES INVOICE API RESPONSE [' + requestId + ']:', {
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
      console.log('📤 SALES INVOICE API RESPONSE [' + requestId + ']:', {
        status: 'ERROR',
        outputResults: {
          error: error instanceof Error ? error.message : 'Unknown error',
          searchCriteria: criteria
        },
        processingTimeMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        requestId: requestId
      });
      
      console.error('❌ Sales invoice API search failed:', error);
      throw new Error(`Invoice search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Apply search filters to invoice records
   */
  private applyInvoiceFilters(records: InvoiceRecord[], criteria: InvoiceSearchCriteria, headers: string[], requestId: string): InvoiceRecord[] {
    console.log('🔧 INVOICE FILTER PROCESSING [' + requestId + ']:', {
      startingRecordCount: records.length,
      filtersToApply: Object.keys(criteria).filter(key => criteria[key as keyof InvoiceSearchCriteria])
    });
    
    const filtered = records.filter(record => {
      // Filter by customer name
      if (criteria.customerName) {
        const customerField = headers.find(header => 
          header === 'Customer Name' || header.toLowerCase() === 'customer name' ||
          header === 'Client Name' || header.toLowerCase() === 'client name'
        );
        
        if (customerField) {
          const customerValue = String(record[customerField] || '').toLowerCase();
          const searchTerm = criteria.customerName.toLowerCase();
          if (!customerValue.includes(searchTerm)) {
            return false;
          }
        } else {
          console.log('⚠️ "Customer Name" column not found. Available headers:', headers);
        }
      }

      // Filter by service description
      if (criteria.serviceDescription) {
        const serviceField = headers.find(header => 
          header === 'Service Description' || header.toLowerCase() === 'service description' ||
          header === 'Description' || header.toLowerCase() === 'description' ||
          header === 'Service' || header.toLowerCase() === 'service'
        );
        
        if (serviceField) {
          const serviceValue = String(record[serviceField] || '').toLowerCase();
          const searchTerm = criteria.serviceDescription.toLowerCase();
          if (!serviceValue.includes(searchTerm)) {
            return false;
          }
        } else {
          console.log('⚠️ "Service Description" column not found. Available headers:', headers);
        }
      }

      // Filter by invoice date range
      if (criteria.invoiceDateFrom || criteria.invoiceDateTo) {
        const invoiceDateField = headers.find(header => 
          header === 'Invoice Date' || header.toLowerCase() === 'invoice date' ||
          header === 'Date' || header.toLowerCase() === 'date'
        );
        
        if (invoiceDateField) {
          const rawDateValue = String(record[invoiceDateField] || '');
          const dateValue = this.parseDate(rawDateValue);
          
          if (criteria.invoiceDateFrom && dateValue) {
            const fromDate = new Date(criteria.invoiceDateFrom);
            if (dateValue < fromDate) {
              return false;
            }
          }
          
          if (criteria.invoiceDateTo && dateValue) {
            const toDate = new Date(criteria.invoiceDateTo);
            toDate.setHours(23, 59, 59, 999);
            if (dateValue > toDate) {
              return false;
            }
          }
        } else {
          console.log('⚠️ "Invoice Date" column not found. Available headers:', headers);
        }
      }

      // Filter by due date range
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
          console.log('⚠️ "Due Date" column not found. Available headers:', headers);
        }
      }

      // Filter by approver name
      if (criteria.approverName) {
        const approverField = headers.find(header => 
          header === 'Approver Name' || header.toLowerCase() === 'approver name' ||
          header === 'Approved By' || header.toLowerCase() === 'approved by' ||
          header === 'Approver' || header.toLowerCase() === 'approver'
        );
        
        if (approverField) {
          const approverValue = String(record[approverField] || '').toLowerCase();
          const searchTerm = criteria.approverName.toLowerCase();
          if (!approverValue.includes(searchTerm)) {
            return false;
          }
        } else {
          console.log('⚠️ "Approver Name" column not found. Available headers:', headers);
        }
      }

      // Filter by payment status
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
          console.log('⚠️ "Payment Status" column not found. Available headers:', headers);
        }
      }

      // Filter by invoice number
      if (criteria.invoiceNumber) {
        const invoiceNumberField = headers.find(header => 
          header === 'Invoice Number' || header.toLowerCase() === 'invoice number' ||
          header === 'Invoice #' || header.toLowerCase() === 'invoice #' ||
          header === 'Number' || header.toLowerCase() === 'number'
        );
        
        if (invoiceNumberField) {
          const invoiceNumberValue = String(record[invoiceNumberField] || '').toLowerCase();
          const searchTerm = criteria.invoiceNumber.toLowerCase();
          if (!invoiceNumberValue.includes(searchTerm)) {
            return false;
          }
        } else {
          console.log('⚠️ "Invoice Number" column not found. Available headers:', headers);
        }
      }

      // Filter by amount range
      if (criteria.amountFrom !== undefined || criteria.amountTo !== undefined) {
        const amountField = headers.find(header => 
          header === 'Amount' || header.toLowerCase() === 'amount' ||
          header === 'Invoice Amount' || header.toLowerCase() === 'invoice amount' ||
          header === 'Total' || header.toLowerCase() === 'total'
        );
        
        if (amountField) {
          const amountValue = this.parseAmount(String(record[amountField] || ''));
          
          if (criteria.amountFrom !== undefined && amountValue < criteria.amountFrom) {
            return false;
          }
          
          if (criteria.amountTo !== undefined && amountValue > criteria.amountTo) {
            return false;
          }
        } else {
          console.log('⚠️ "Amount" column not found. Available headers:', headers);
        }
      }

      return true;
    });
    
    console.log('✅ INVOICE FILTER COMPLETE [' + requestId + ']:', {
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
          return date;
        }
      }
    }

    // Try parsing as Excel date serial number
    const num = parseFloat(dateStr);
    if (!isNaN(num) && num > 1 && num < 100000) {
      const excelEpoch = new Date(1900, 0, 1);
      const date = new Date(excelEpoch.getTime() + (num - 2) * 24 * 60 * 60 * 1000);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }

    return null;
  }

  /**
   * Parse amount from string (remove currency symbols, commas, etc.)
   */
  private parseAmount(amountStr: string): number {
    if (!amountStr) return 0;
    
    // Remove currency symbols, spaces, and convert commas to dots
    const cleanStr = amountStr
      .replace(/[€$£¥₹]/g, '') // Remove currency symbols
      .replace(/\s/g, '') // Remove spaces
      .replace(/,/g, '.'); // Convert commas to dots
    
    const amount = parseFloat(cleanStr);
    return isNaN(amount) ? 0 : amount;
  }

  /**
   * Get available fields/columns from sales invoice data
   */
  async getAvailableFields(userId: string): Promise<string[]> {
    const requestId = Math.random().toString(36).substring(2, 8);
    
    console.log('📥 SALES INVOICE API REQUEST [' + requestId + ']:', {
      method: 'getAvailableFields',
      userId: userId.substring(0, 8) + '...',
      timestamp: new Date().toISOString(),
      requestId: requestId
    });
    
    try {
      const invoiceDocuments = await storageService.getUserERPDocuments(userId, 'invoicer');
      
      if (invoiceDocuments.length === 0) {
        return [];
      }
      
      // Get fields from first document's JSON data
      const firstDoc = invoiceDocuments[0];
      const fields = (firstDoc.jsonData && firstDoc.jsonData.length > 0) 
        ? Object.keys(firstDoc.jsonData[0]) 
        : [];
      
      console.log('📤 SALES INVOICE API RESPONSE [' + requestId + ']:', {
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
      console.log('📤 SALES INVOICE API RESPONSE [' + requestId + ']:', {
        status: 'ERROR',
        outputResults: {
          error: error instanceof Error ? error.message : 'Unknown error'
        },
        timestamp: new Date().toISOString(),
        requestId: requestId
      });
      
      console.error('❌ Failed to get available invoice fields:', error);
      return [];
    }
  }

  /**
   * Get sample invoice data for testing
   */
  async getSampleData(userId: string, maxRows: number = 5): Promise<InvoiceRecord[]> {
    const requestId = Math.random().toString(36).substring(2, 8);
    
    console.log('📥 SALES INVOICE API REQUEST [' + requestId + ']:', {
      method: 'getSampleData',
      userId: userId.substring(0, 8) + '...',
      inputParameters: {
        maxRows: maxRows
      },
      timestamp: new Date().toISOString(),
      requestId: requestId
    });
    
    try {
      const searchResult = await this.searchInvoices(userId, {});
      const sampleData = searchResult.records.slice(0, maxRows);
      
      console.log('📤 SALES INVOICE API RESPONSE [' + requestId + ']:', {
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
      console.log('📤 SALES INVOICE API RESPONSE [' + requestId + ']:', {
        status: 'ERROR',
        outputResults: {
          error: error instanceof Error ? error.message : 'Unknown error',
          maxRowsRequested: maxRows
        },
        timestamp: new Date().toISOString(),
        requestId: requestId
      });
      
      console.error('❌ Failed to get sample invoice data:', error);
      return [];
    }
  }
}

export const salesInvoiceApiService = new SalesInvoiceApiService();