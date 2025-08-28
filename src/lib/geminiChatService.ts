import { GoogleGenerativeAI, GenerativeModel, ChatSession } from '@google/generative-ai';
import { collection, query, getDocs } from 'firebase/firestore';
import { db } from './firebase';
import { storageService } from './storageService';
import { logger } from './loggingService';

// Initialize Gemini 2.5 Pro
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY || '');

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  functionCalls?: string[];
}

export interface ChatContext {
  userId: string;
  systemPrompt: string;
  sessionId: string;
  ostolaskuExcelData?: any[];
}

class GeminiChatService {
  private model: GenerativeModel;
  private activeSessions: Map<string, ChatSession> = new Map();

  // Helper function to parse string arrays from Gemini
  private parseStringArray(value: any, fieldName: string, sessionId?: string): string[] {
    if (!value) {
      logger.debug('GeminiChatService', 'parseStringArray', `${fieldName} is empty/null`, null, sessionId);
      return [];
    }
    
    logger.debug('GeminiChatService', 'parseStringArray', `Parsing ${fieldName}`, {
      type: typeof value,
      isArray: Array.isArray(value),
      length: typeof value === 'string' ? value.length : 'N/A',
      preview: typeof value === 'string' ? value.substring(0, 50) : JSON.stringify(value).substring(0, 50)
    }, sessionId);
    
    if (Array.isArray(value)) {
      const result = value.map((v: any) => String(v).trim());
      logger.info('GeminiChatService', 'parseStringArray', `✅ ${fieldName} is already array`, { count: result.length }, sessionId);
      return result;
    }
    
    if (typeof value === 'string') {
      const trimmed = value.trim();
      // Check if it looks like a JSON array
      if (trimmed.startsWith('[') || trimmed.startsWith('"[')) {
        try {
          // Remove wrapper quotes if present
          const cleanString = trimmed.startsWith('"') && trimmed.endsWith('"') 
            ? trimmed.slice(1, -1).replace(/\\"/g, '"')
            : trimmed;
          const parsed = JSON.parse(cleanString);
          if (Array.isArray(parsed)) {
            logger.info('GeminiChatService', 'parseStringArray', `✅ Parsed ${fieldName} string array`, { count: parsed.length }, sessionId);
            return parsed.map((v: any) => String(v).trim());
          } else {
            logger.warn('GeminiChatService', 'parseStringArray', `${fieldName} parsed but not array`, { 
              parsedType: typeof parsed,
              parsed: JSON.stringify(parsed).substring(0, 100)
            }, sessionId);
          }
        } catch (e) {
          logger.warn('GeminiChatService', 'parseStringArray', `❌ Failed to parse ${fieldName}`, { 
            error: e instanceof Error ? e.message : String(e), 
            originalValue: value.substring(0, 100) 
          }, sessionId);
        }
      } else {
        // Single string value
        logger.debug('GeminiChatService', 'parseStringArray', `${fieldName} is single string value`, null, sessionId);
        return [value.trim()];
      }
    }
    
    logger.warn('GeminiChatService', 'parseStringArray', `${fieldName} has unexpected type`, { type: typeof value }, sessionId);
    return [];
  }

  constructor() {
    // Initialize Gemini 2.5 Pro with function calling
    this.model = genAI.getGenerativeModel({
      model: 'gemini-2.5-pro',
      generationConfig: {
        temperature: 0.1,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 8192,
      },
      tools: [
        {
          functionDeclarations: [
            {
              name: 'searchHinnasto',
              description: 'Search price list data by product names, price list names, or suppliers. IMPORTANT: This function handles up to 200 products efficiently in a single call. For OstolaskuExcel with 200+ unique products, process ALL in ONE call: searchHinnasto({productNames: ["product1","product2",...]}). Returns UNION of all matches. The function is optimized for large batches.',
              parameters: {
                type: 'object',
                properties: {
                  productNames: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Array of product names to search for (partial match supported). Example: ["Kuntotutkimus", "PTS"]'
                  },
                  priceListNames: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Array of price list names to search for (partial match supported)'
                  },
                  priceListSuppliers: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Array of price list suppliers to search for (partial match supported)'
                  },
                  productName: {
                    type: 'string',
                    description: 'Single product name to search for (legacy parameter - use productNames instead)'
                  },
                  priceListName: {
                    type: 'string',
                    description: 'Single price list name to search for (legacy parameter - use priceListNames instead)'
                  },
                  priceListSupplier: {
                    type: 'string',
                    description: 'Single price list supplier to search for (legacy parameter - use priceListSuppliers instead)'
                  },
                  limit: {
                    type: 'number',
                    description: 'Maximum number of results to return per search value (default 10 for product search, 50 for price list search)'
                  }
                },
                required: []  // All parameters are optional - at least one search parameter should be provided
              }
            },
            {
              name: 'searchTilaus',
              description: 'Search order data by Tampuuri codes AND/OR RP-numbers. Returns OrderNumber, Code, Name, ProductName, SalePrice (without VAT), TotalSellPrice (with VAT), and PriceListName. IMPORTANT: This function handles up to 200 values efficiently in a single call. For OstolaskuExcel with 200+ rows, the function will process ALL values - no need to split calls. Use arrays for batch searching: searchTilaus({tampuuriCodes: ["1","2",...], orderNumbers: ["RP-1","RP-2",...]}). Returns UNION of all matches.',
              parameters: {
                type: 'object',
                properties: {
                  tampuuriCodes: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Array of Tampuuri codes to search for (Code field - partial match supported). Example: ["12345", "67890"]'
                  },
                  orderNumbers: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Array of RP-numbers to search for (OrderNumber field - partial match supported). Example: ["RP-0201251024330417", "RP-0201251024330418"]'
                  },
                  tampuuriCode: {
                    type: 'string',
                    description: 'Single Tampuuri code to search for (legacy parameter - use tampuuriCodes instead)'
                  },
                  orderNumber: {
                    type: 'string',
                    description: 'Single RP-number to search for (legacy parameter - use orderNumbers instead)'
                  },
                  limit: {
                    type: 'number',
                    description: 'Maximum number of results to return per search value (default 10)'
                  }
                },
                required: []  // Neither is required - can search by either one
              }
            }
          ]
        }
      ]
    });
  }

  // Function implementations for Gemini to call
  private async searchHinnasto(userId: string, params: Record<string, any>, sessionId?: string) {
    // Log incoming parameters for debugging with types
    logger.info('GeminiChatService', 'searchHinnasto', '🔍 searchHinnasto called with params', {
      productNames: params.productNames,
      productNamesType: typeof params.productNames,
      priceListNames: params.priceListNames,
      priceListNamesType: typeof params.priceListNames,
      priceListSuppliers: params.priceListSuppliers,
      priceListSuppliersType: typeof params.priceListSuppliers,
      productName: params.productName,
      priceListName: params.priceListName,
      priceListSupplier: params.priceListSupplier,
      limit: params.limit
    }, sessionId);
    
    try {
      // Query ALL hinnasto records without limit to match UI behavior
      const q = query(
        collection(db, 'hinnasto')
        // No limit - get all records like the UI does
      );

      const querySnapshot = await getDocs(q);
      
      let records = querySnapshot.docs.map(doc => {
        const data = doc.data();
        // Return all seven fields needed for pricing verification and product identification
        return {
          id: doc.id,
          ProductNumber: data.ProductNumber || data.Tuotetunnus || data.tuotetunnus || 
                        data['Product Number'] || data.product_number || '',
          ProductName: data.ProductName || data.Tuote || data.tuote || 
                      data['Product Name'] || data.product_name || '',
          PriceListSupplier: data.PriceListSupplier || data.Hintalistan_toimittaja || data.hintalistan_toimittaja || 
                            data['Price List Supplier'] || data.price_list_supplier || '',
          PriceListName: data.PriceListName || data.Hintalista || data.hintalista || 
                        data['Price List Name'] || data.price_list_name || '',
          BuyPrice: data.BuyPrice || data.Ostohinta || data.ostohinta || 
                   data['Buy Price'] || data.buy_price || 0,
          SalePrice: data.SalePrice || data.Myyntihinta || data.myyntihinta || 
                    data['Sale Price'] || data.sale_price || 0,
          SalePriceVat: data.SalePriceVat || data.Myyntihinta_alv || data.myyntihinta_alv || 
                       data['Sale Price VAT'] || data.sale_price_vat || 0
        };
      });

      // Collect all search values (support both array and single value formats)
      const productNamesToSearch: string[] = [
        ...this.parseStringArray(params.productNames, 'productNames', sessionId).map(s => s.toLowerCase()),
        ...(params.productName ? [String(params.productName).toLowerCase().trim()] : [])
      ];
      
      const priceListNamesToSearch: string[] = [
        ...this.parseStringArray(params.priceListNames, 'priceListNames', sessionId).map(s => s.toLowerCase()),
        ...(params.priceListName ? [String(params.priceListName).toLowerCase().trim()] : [])
      ];
      
      const priceListSuppliersToSearch: string[] = [
        ...this.parseStringArray(params.priceListSuppliers, 'priceListSuppliers', sessionId).map(s => s.toLowerCase()),
        ...(params.priceListSupplier ? [String(params.priceListSupplier).toLowerCase().trim()] : [])
      ];
      
      // Check if at least one search parameter is provided
      if (productNamesToSearch.length === 0 && priceListNamesToSearch.length === 0 && priceListSuppliersToSearch.length === 0) {
        logger.warn('GeminiChatService', 'searchHinnasto', '⚠️ searchHinnasto called without search parameters - returning empty result', undefined, sessionId);
        return {
          success: true,
          data: [],
          count: 0
        };
      }
      
      // Log if we have a lot of search values
      const totalSearchValues = productNamesToSearch.length + priceListNamesToSearch.length + priceListSuppliersToSearch.length;
      if (totalSearchValues > 50) {
        logger.info('GeminiChatService', 'searchHinnasto', `📊 Large batch search: ${totalSearchValues} values`, {
          productCount: productNamesToSearch.length,
          priceListCount: priceListNamesToSearch.length,
          supplierCount: priceListSuppliersToSearch.length
        }, sessionId);
      }
      
      // Filter records - match ANY of the provided search values (UNION)
      // Using Set to track unique record IDs and avoid duplicates
      const matchedRecordIds = new Set<string>();
      const filteredRecords: any[] = [];
      
      for (const record of records) {
        let isMatch = false;
        
        // Check against product names
        if (productNamesToSearch.length > 0) {
          const recordProductName = String(record.ProductName).toLowerCase();
          for (const searchName of productNamesToSearch) {
            if (recordProductName.includes(searchName)) {
              isMatch = true;
              break;
            }
          }
        }
        
        // Check against price list names (if not already matched)
        if (!isMatch && priceListNamesToSearch.length > 0) {
          const recordPriceListName = String(record.PriceListName).toLowerCase();
          for (const searchList of priceListNamesToSearch) {
            if (recordPriceListName.includes(searchList)) {
              isMatch = true;
              break;
            }
          }
        }
        
        // Check against price list suppliers (if not already matched)
        if (!isMatch && priceListSuppliersToSearch.length > 0) {
          const recordPriceListSupplier = String(record.PriceListSupplier).toLowerCase();
          for (const searchSupplier of priceListSuppliersToSearch) {
            if (recordPriceListSupplier.includes(searchSupplier)) {
              isMatch = true;
              break;
            }
          }
        }
        
        // Add to results if matched and not already added
        if (isMatch && !matchedRecordIds.has(record.id)) {
          matchedRecordIds.add(record.id);
          filteredRecords.push(record);
        }
      }
      
      // Log search statistics
      if (sessionId) {
        const searchStats = {
          productNamesSearched: productNamesToSearch.length,
          productNames: productNamesToSearch,
          priceListNamesSearched: priceListNamesToSearch.length,
          priceListNames: priceListNamesToSearch,
          priceListSuppliersSearched: priceListSuppliersToSearch.length,
          priceListSuppliers: priceListSuppliersToSearch,
          totalRecordsFound: filteredRecords.length,
          batchSearch: (productNamesToSearch.length + priceListNamesToSearch.length + priceListSuppliersToSearch.length) > 1
        };
        logger.info('GeminiChatService', 'searchHinnasto', '📊 Batch search completed', searchStats, sessionId);
      }
      
      records = filteredRecords;
      
      const result = {
        success: true,
        data: records, // Return ALL results, no limit
        count: records.length
      };
      
      // Log how many results we're returning
      logger.info('GeminiChatService', 'searchHinnasto', `🎯 Returning ${records.length} results (ALL matches, no limit)`, null, sessionId);
      
      return result;
    } catch (error) {
      logger.error('GeminiChatService', 'searchHinnasto', '❌ searchHinnasto failed', error, sessionId);
      
      // Logging removed - addTechnicalLog function not available
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Search failed'
      };
    }
  }

  private async searchTilaus(userId: string, params: Record<string, any>, sessionId?: string) {
    // Log incoming parameters for debugging with types
    logger.info('GeminiChatService', 'searchTilaus', '🔍 searchTilaus called with params', {
      tampuuriCodes: params.tampuuriCodes,
      tampuuriCodesType: typeof params.tampuuriCodes,
      orderNumbers: params.orderNumbers,
      orderNumbersType: typeof params.orderNumbers,
      tampuuriCode: params.tampuuriCode,
      orderNumber: params.orderNumber,
      limit: params.limit
    }, sessionId);
    
    try {
      // Query ALL tilaus_data records without limit to match UI behavior
      const q = query(
        collection(db, 'tilaus_data')
        // No limit - get all records like the UI does
      );

      const querySnapshot = await getDocs(q);
      
      // Map to only essential fields to reduce response size
      const allRecords = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          OrderNumber: data.OrderNumber || data['RP-numero'] || data['RP-tunnus'] || '',
          Code: data.Code || data.Tampuurinumero || data.tampuurinumero || '',
          Name: data.Name || data.Nimi || data.name || '',
          ProductName: data.ProductName || data.Tuotenimi || data.tuotenimi || '',
          SalePrice: data.SalePrice || data.Myyntihinta || data.myyntihinta || 0,
          TotalSellPrice: data.TotalSellPrice || data.Myyntihinta_alv || data.SalePriceVat || data['Myyntihinta yhteensä'] || 0,
          PriceListName: data.PriceListName || data.Hintalista || data.hintalista || ''
        };
      });

      // Collect all search values (support both array and single value formats)
      const tampuuriCodesToSearch: string[] = [
        ...this.parseStringArray(params.tampuuriCodes, 'tampuuriCodes', sessionId),
        ...(params.tampuuriCode ? [String(params.tampuuriCode).trim()] : [])
      ];
      
      const orderNumbersToSearch: string[] = [
        ...this.parseStringArray(params.orderNumbers, 'orderNumbers', sessionId),
        ...(params.orderNumber ? [String(params.orderNumber).trim()] : [])
      ];
      
      // Check if any search values provided
      if (tampuuriCodesToSearch.length === 0 && orderNumbersToSearch.length === 0) {
        logger.warn('GeminiChatService', 'searchTilaus', '⚠️ searchTilaus called without search parameters - returning empty result', undefined, sessionId);
        return {
          success: true,
          data: [],
          count: 0
        };
      }
      
      // Log if we have a lot of search values
      const totalSearchValues = tampuuriCodesToSearch.length + orderNumbersToSearch.length;
      if (totalSearchValues > 100) {
        logger.info('GeminiChatService', 'searchTilaus', `📊 Large batch search: ${totalSearchValues} values`, {
          tampuuriCount: tampuuriCodesToSearch.length,
          orderCount: orderNumbersToSearch.length
        }, sessionId);
      }
      
      // Filter records - match ANY of the provided search values (UNION)
      // Using Set to track unique record IDs and avoid duplicates
      const matchedRecordIds = new Set<string>();
      const records: any[] = [];
      
      for (const record of allRecords) {
        let isMatch = false;
        
        // Check against Tampuuri codes
        if (tampuuriCodesToSearch.length > 0) {
          const code = String(record['Code'] || record['Tampuurinumero'] || '').trim();
          for (const searchCode of tampuuriCodesToSearch) {
            // For short search terms (1-3 chars), require exact match
            if (searchCode.length <= 3) {
              if (code === searchCode) {
                isMatch = true;
                break;
              }
            } else {
              // For longer search terms, allow partial match
              if (code.startsWith(searchCode) || code.includes(searchCode)) {
                isMatch = true;
                break;
              }
            }
          }
        }
        
        // Check against Order numbers (if not already matched)
        if (!isMatch && orderNumbersToSearch.length > 0) {
          const orderNum = String(record['OrderNumber'] || record['RP-numero'] || '').trim();
          for (const searchOrder of orderNumbersToSearch) {
            // For RP numbers, always use contains/partial match
            if (orderNum.toLowerCase().includes(searchOrder.toLowerCase())) {
              isMatch = true;
              break;
            }
          }
        }
        
        // Add to results if matched and not already added
        if (isMatch && !matchedRecordIds.has(record.id)) {
          matchedRecordIds.add(record.id);
          records.push(record);
        }
      }
      
      // Log search statistics
      if (sessionId) {
        const searchStats = {
          tampuuriCodesSearched: tampuuriCodesToSearch.length,
          tampuuriCodes: tampuuriCodesToSearch,
          orderNumbersSearched: orderNumbersToSearch.length,
          orderNumbers: orderNumbersToSearch,
          totalRecordsFound: records.length,
          batchSearch: (tampuuriCodesToSearch.length + orderNumbersToSearch.length) > 1
        };
        logger.info('GeminiChatService', 'searchTilaus', '📊 Batch search completed', searchStats, sessionId);
      }

      const result = {
        success: true,
        data: records, // Return ALL results, no limit
        count: records.length
      };
      
      // Log how many results we're returning
      logger.info('GeminiChatService', 'searchTilaus', `🎯 Returning ${records.length} results (ALL matches, no limit)`, null, sessionId);
      
      return result;
    } catch (error) {
      logger.error('GeminiChatService', 'searchTilaus', '❌ searchTilaus failed', error, sessionId);
      
      // Logging removed - addTechnicalLog function not available
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Search failed'
      };
    }
  }




  async initializeSession(context: ChatContext): Promise<string> {
    logger.info('GeminiChatService', 'initializeSession', '🚀 Initializing chat session', {
      sessionId: context.sessionId,
      userId: context.userId,
      promptLength: context.systemPrompt.length,
      hasOstolaskuExcelData: !!context.ostolaskuExcelData
    }, context.sessionId);
    
    try {
      // Build the system prompt with OstolaskuExcel data if available
      let fullSystemPrompt = context.systemPrompt;
      
      if (context.ostolaskuExcelData && context.ostolaskuExcelData.length > 0) {
        const ostolaskuExcelJson = JSON.stringify(context.ostolaskuExcelData, null, 2);
        fullSystemPrompt += `\n\n=== LADATTU OSTOLASKUEXCEL DATA ===\nSeuraava OstolaskuExcel on ladattu ja analyysiä varten:\n\`\`\`json\n${ostolaskuExcelJson}\n\`\`\`\n\nTämä data on nyt käytettävissä suoraan. Et tarvitse searchOstolaskuExcel funktiota - voit viitata suoraan tähän dataan vastauksissa.`;
      }
      
      const chat = this.model.startChat({
        history: [
          {
            role: 'user',
            parts: [{ text: fullSystemPrompt }]
          },
          {
            role: 'model',
            parts: [{ text: 'Ymmärsin.' }]
          }
        ]
      });

      this.activeSessions.set(context.sessionId, chat);
      logger.info('GeminiChatService', 'initializeSession', '✅ Chat session initialized successfully', { sessionId: context.sessionId }, context.sessionId);
      
      return context.sessionId;
    } catch (error) {
      logger.error('GeminiChatService', 'initializeSession', '❌ Failed to initialize chat session', error);
      throw new Error(`Failed to initialize chat session: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async sendMessage(sessionId: string, message: string, userId: string, ostolaskuExcelData: any[] = []): Promise<ChatMessage> {
    // Log API input details
    logger.info('GeminiChatService', 'sendMessage', '📤 Gemini API Input', { 
      messageLength: message.length,
      messagePreview: message.substring(0, 200),
      hasOstolaskuData: ostolaskuExcelData.length > 0,
      ostolaskuRowCount: ostolaskuExcelData.length
    }, sessionId);
    
    let session = this.activeSessions.get(sessionId);
    if (!session) {
      logger.error('GeminiChatService', 'sendMessage', '❌ Chat session not found', { sessionId }, sessionId);
      throw new Error('Chat session not found');
    }

    try {
      // OstolaskuExcel data was already provided during session initialization
      const fullMessage = message;
      
      // Retry logic for initial message
      let result;
      let response;
      let initialRetries = 0;
      const maxInitialRetries = 2;
      
      while (initialRetries <= maxInitialRetries) {
        try {
          result = await session.sendMessage(fullMessage);
          response = result.response;
          
          // Log API output
          logger.info('GeminiChatService', 'sendMessage', '📥 Gemini API Raw Response', {
            hasResponse: !!response,
            hasText: response ? !!response.text() : false,
            textLength: response ? response.text()?.length || 0 : 0,
            textPreview: response ? response.text()?.substring(0, 200) : null,
            hasFunctionCalls: response ? !!(response.functionCalls && typeof response.functionCalls === 'function') : false,
            functionCallCount: response && response.functionCalls && typeof response.functionCalls === 'function' ? response.functionCalls().length : 0
          }, sessionId);
          
          // Validate initial response
          if (response) {
            // Tallenna LLM-interaktio
            const responseText = response.text();
            const functionCalls = response.functionCalls && typeof response.functionCalls === 'function' ? response.functionCalls() : null;
            logger.logLLMInteraction(
              sessionId,
              fullMessage,
              responseText,
              'gemini-1.5-flash',
              functionCalls
            );
            break;
          }
          
          initialRetries++;
          logger.warn('GeminiChatService', 'sendMessage', '⚠️ Empty initial response, retry', { retryCount: initialRetries, maxRetries: maxInitialRetries }, sessionId);
          if (initialRetries <= maxInitialRetries) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        } catch (error: any) {
          initialRetries++;
          const errorDetails = {
            retryCount: initialRetries,
            maxRetries: maxInitialRetries,
            errorMessage: error?.message || 'Unknown error',
            errorName: error?.name || 'Unknown',
            errorStack: error?.stack?.substring(0, 500)
          };
          logger.error('GeminiChatService', 'sendMessage', '❌ Initial request failed, retry', errorDetails, sessionId);
          if (initialRetries > maxInitialRetries) {
            throw error;
          }
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      if (!response) {
        throw new Error('Failed to get response from Gemini after retries');
      }
      
      // Handle function calls
      const functionCalls: string[] = [];
      let finalContent = '';
      
      const functionCallsArray = response.functionCalls && typeof response.functionCalls === 'function' ? response.functionCalls() : null;
      if (functionCallsArray && Array.isArray(functionCallsArray) && functionCallsArray.length > 0) {
        // Only log if many function calls (potential issue)
        if (functionCallsArray.length > 10) {
          logger.info('GeminiChatService', 'sendMessage', '🔧 Many function calls detected', { count: functionCallsArray.length }, sessionId);
        }
        
        const functionResponses = [];
        
        // Log all function calls for debugging with full details
        logger.info('GeminiChatService', 'sendMessage', '🔧 Function calls received', {
          count: functionCallsArray.length,
          functions: functionCallsArray.map(call => ({
            name: call.name,
            args: JSON.stringify(call.args) // Stringify to see full content
          }))
        }, sessionId);
        
        // Also log each function call separately for clarity
        functionCallsArray.forEach((call, index) => {
          logger.info('GeminiChatService', 'sendMessage', `📞 Function call ${index + 1}/${functionCallsArray.length}: ${call.name}`, call.args, sessionId);
        });
        
        for (const call of functionCallsArray) {
          const functionName = call.name;
          const args = call.args;
          
          
          let functionResult;
          logger.info('GeminiChatService', 'sendMessage', `🔄 Executing function: ${functionName}`, { args: JSON.stringify(args).substring(0, 200) }, sessionId);
          
          switch (functionName) {
            case 'searchHinnasto':
              functionResult = await this.searchHinnasto(userId, args, sessionId);
              break;
            case 'searchTilaus':
              functionResult = await this.searchTilaus(userId, args, sessionId);
              break;
            default:
              logger.error('GeminiChatService', 'sendMessage', '❌ Unknown function called', { functionName }, sessionId);
              functionResult = { success: false, error: 'Unknown function' };
          }
          
          logger.info('GeminiChatService', 'sendMessage', `✅ Function ${functionName} completed`, { 
            success: functionResult?.success,
            dataCount: functionResult?.data?.length || 0,
            error: functionResult?.error
          }, sessionId);
          
          functionCalls.push(`${functionName}(${JSON.stringify(args)})`);
          
          // Collect function response
          functionResponses.push({
            functionResponse: {
              name: functionName,
              response: functionResult
            }
          });
        }
        
        // Send all function results back to model at once with retry logic
        let retryCount = 0;
        const maxRetries = 3;
        
        while (retryCount < maxRetries) {
          try {
            const finalResult = await session.sendMessage(functionResponses);
            finalContent = finalResult.response.text();
            
            // Check if response is valid
            if (finalContent && finalContent.trim() !== '') {
              break;
            } else {
              retryCount++;
              logger.warn('GeminiChatService', 'sendMessage', '⚠️ Empty response, retrying...', { retryCount, maxRetries }, sessionId);
              if (retryCount < maxRetries) {
                // Wait before retry (exponential backoff)
                await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount - 1)));
              }
            }
          } catch (retryError) {
            retryCount++;
            logger.error('GeminiChatService', 'sendMessage', '❌ Retry failed', { retryCount, maxRetries, error: retryError }, sessionId);
            if (retryCount >= maxRetries) {
              throw retryError;
            }
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount - 1)));
          }
        }
        
        if (!finalContent || finalContent.trim() === '') {
          logger.error('GeminiChatService', 'sendMessage', '❌ Empty response after function calls', { functionCallsCount: functionCalls.length }, sessionId);
          throw new Error('Empty response from AI model after function calls');
        }
      } else {
        // No function calls, use the original response
        finalContent = response.text();
        
        // Log if response is empty (critical issue)
        if (!finalContent || finalContent.trim() === '') {
          logger.error('GeminiChatService', 'sendMessage', '⚠️ Empty direct response from Gemini', { sessionId }, sessionId);
        }
      }
      
      // Final validation - only check if truly empty
      if (!finalContent || finalContent.trim() === '') {
        logger.error('GeminiChatService', 'sendMessage', '❌ Empty response from Gemini', undefined, sessionId);
        throw new Error('Empty response from AI model');
      }
      
      const chatMessage = {
        id: Date.now().toString(),
        role: 'assistant' as const,
        content: finalContent,
        timestamp: new Date(),
        functionCalls: functionCalls.length > 0 ? functionCalls : undefined
      };
      
      logger.info('GeminiChatService', 'sendMessage', '✅ Message processing complete', {
        messageId: chatMessage.id,
        contentLength: chatMessage.content.length,
        functionCallsCount: functionCalls.length
      }, sessionId);
      
      return chatMessage;
    } catch (error) {
      logger.error('GeminiChatService', 'sendMessage', '❌ sendMessage failed', error, sessionId);
      throw new Error(`Failed to send message: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getSessionHistory(sessionId: string): Promise<ChatMessage[]> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      return [];
    }

    // Note: Gemini doesn't provide direct access to history
    // This would need to be stored separately if full history is needed
    return [];
  }

  clearSession(sessionId: string): void {
    this.activeSessions.delete(sessionId);
  }
}

export const geminiChatService = new GeminiChatService();