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
              description: 'Search price list data by product name, price list name, or supplier. Can search by any combination of these fields. Returns product details including ProductNumber, ProductName, PriceListSupplier, PriceListName, BuyPrice, SalePrice, and SalePriceVat.',
              parameters: {
                type: 'object',
                properties: {
                  productName: {
                    type: 'string',
                    description: 'Product name to search for (checks fields: ProductName, Tuote, etc. - partial match supported)'
                  },
                  priceListName: {
                    type: 'string',
                    description: 'Price list name to search for (partial match supported)'
                  },
                  priceListSupplier: {
                    type: 'string',
                    description: 'Price list supplier to search for (partial match supported)'
                  },
                  limit: {
                    type: 'number',
                    description: 'Maximum number of results to return (default 10 for product search, 50 for price list search)'
                  }
                },
                required: []  // All parameters are optional - at least one search parameter should be provided
              }
            },
            {
              name: 'searchTilaus',
              description: 'Search order data by Tampuuri code OR RP-number. Returns order details including OrderNumber, Code, Name, ProductName, TotalSellPrice, and PriceListName.',
              parameters: {
                type: 'object',
                properties: {
                  tampuuriCode: {
                    type: 'string',
                    description: 'Tampuuri code to search for (Code field - partial match supported)'
                  },
                  orderNumber: {
                    type: 'string',
                    description: 'RP-number to search for (OrderNumber field - partial match supported)'
                  },
                  limit: {
                    type: 'number',
                    description: 'Maximum number of results to return (default 10)'
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
    // Reduced logging - only log errors
    
    // Log to continuous improvement
    if (sessionId) {
      await addTechnicalLog(sessionId, {
        event: 'function_call_triggered',
        functionName: 'searchHinnasto',
        functionInputs: params
      });
    }
    
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

      // Check if at least one search parameter is provided
      if (!params.productName && !params.priceListName && !params.priceListSupplier) {
        logger.warn('GeminiChatService', 'searchHinnasto', '⚠️ searchHinnasto called without any search parameters - returning empty result', undefined, sessionId);
        return {
          success: true,
          data: [],
          count: 0
        };
      }

      // Apply filters based on provided parameters (OR logic)
      const beforeFilter = records.length;
      
      // Filter by ProductName (partial match)
      if (params.productName) {
        const searchTerm = params.productName.toLowerCase();
        
        records = records.filter(record => {
          const productName = String(record.ProductName).toLowerCase();
          return productName.includes(searchTerm);
        });
      }
      
      // Filter by PriceListName (partial match)
      if (params.priceListName) {
        const searchTerm = params.priceListName.toLowerCase();
        records = records.filter(record => {
          const priceListName = String(record.PriceListName).toLowerCase();
          return priceListName.includes(searchTerm);
        });
      }
      
      // Filter by PriceListSupplier (partial match)
      if (params.priceListSupplier) {
        const searchTerm = params.priceListSupplier.toLowerCase();
        records = records.filter(record => {
          const priceListSupplier = String(record.PriceListSupplier).toLowerCase();
          return priceListSupplier.includes(searchTerm);
        });
      }
      
      // Determine default limit based on search type
      const defaultLimit = params.priceListName || params.priceListSupplier ? 50 : 10;
      
      const result = {
        success: true,
        data: records.slice(0, params.limit || defaultLimit),
        count: records.length
      };
      
      // Log result to continuous improvement
      if (sessionId) {
        await addTechnicalLog(sessionId, {
          eventType: 'function_result',
          functionName: 'searchHinnasto',
          result: {
            success: result.success,
            recordCount: result.data.length,
            totalFound: result.count
          },
          timestamp: new Date()
        });
      }
      
      return result;
    } catch (error) {
      logger.error('GeminiChatService', 'searchHinnasto', '❌ searchHinnasto failed', error, sessionId);
      
      // Log error to continuous improvement
      if (sessionId) {
        await addTechnicalLog(sessionId, {
          eventType: 'function_error',
          functionName: 'searchHinnasto',
          error: error instanceof Error ? error.message : 'Search failed',
          timestamp: new Date()
        });
      }
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Search failed'
      };
    }
  }

  private async searchTilaus(userId: string, params: Record<string, any>, sessionId?: string) {
    // Reduced logging - only log errors
    
    // Log to continuous improvement
    if (sessionId) {
      await addTechnicalLog(sessionId, {
        eventType: 'function_call',
        functionName: 'searchTilaus',
        parameters: params,
        timestamp: new Date()
      });
    }
    
    try {
      // Query ALL tilaus_data records without limit to match UI behavior
      const q = query(
        collection(db, 'tilaus_data')
        // No limit - get all records like the UI does
      );

      const querySnapshot = await getDocs(q);
      
      let records = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Apply filter - search by Code (Tampuurinumero) OR OrderNumber (RP-numero)
      if (params.tampuuriCode) {
        const beforeFilter = records.length;
        const searchCode = String(params.tampuuriCode).trim();
        
        records = records.filter(record => {
          // Check Code field (Tampuurinumero) - exact match or starts with for longer codes
          const code = String(record['Code'] || record['Tampuurinumero'] || '').trim();
          
          // For short search terms (1-3 chars), require exact match
          if (searchCode.length <= 3) {
            return code === searchCode;
          }
          
          // For longer search terms, allow partial match (starts with or contains)
          return code.startsWith(searchCode) || code.includes(searchCode);
        });
      } else if (params.orderNumber) {
        const beforeFilter = records.length;
        const searchOrder = String(params.orderNumber).trim();
        
        records = records.filter(record => {
          // Check OrderNumber field (RP-numero)
          const orderNum = String(record['OrderNumber'] || record['RP-numero'] || '').trim();
          
          // For RP numbers, always use contains/partial match since they are long
          return orderNum.toLowerCase().includes(searchOrder.toLowerCase());
        });
      } else {
        // Either tampuuriCode or orderNumber required
        logger.warn('GeminiChatService', 'searchTilaus', '⚠️ searchTilaus called without tampuuriCode or orderNumber - returning empty result', undefined, sessionId);
        return {
          success: true,
          data: [],
          count: 0
        };
      }

      const result = {
        success: true,
        data: records.slice(0, params.limit || 10),
        count: records.length
      };
      
      // Log result to continuous improvement
      if (sessionId) {
        await addTechnicalLog(sessionId, {
          eventType: 'function_result',
          functionName: 'searchTilaus',
          result: {
            success: result.success,
            recordCount: result.data.length,
            totalFound: result.count
          },
          timestamp: new Date()
        });
      }
      
      return result;
    } catch (error) {
      logger.error('GeminiChatService', 'searchTilaus', '❌ searchTilaus failed', error, sessionId);
      
      // Log error to continuous improvement
      if (sessionId) {
        await addTechnicalLog(sessionId, {
          eventType: 'function_error',
          functionName: 'searchTilaus',
          error: error instanceof Error ? error.message : 'Search failed',
          timestamp: new Date()
        });
      }
      
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
    // Only log if there's an issue or it's critical
    logger.debug('GeminiChatService', 'sendMessage', '💬 Processing message', { 
      messageLength: message.length,
      hasData: ostolaskuExcelData.length > 0
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
          
          // Validate initial response
          if (response) {
            // Tallenna LLM-interaktio
            const responseText = response.text();
            logger.logLLMInteraction(
              sessionId,
              fullMessage,
              responseText,
              'gemini-1.5-flash',
              response.functionCalls()
            );
            break;
          }
          
          initialRetries++;
          logger.warn('GeminiChatService', 'sendMessage', '⚠️ Empty initial response, retry', { retryCount: initialRetries, maxRetries: maxInitialRetries }, sessionId);
          if (initialRetries <= maxInitialRetries) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        } catch (error) {
          initialRetries++;
          logger.error('GeminiChatService', 'sendMessage', '❌ Initial request failed, retry', { retryCount: initialRetries, maxRetries: maxInitialRetries, error }, sessionId);
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
        
        for (const call of functionCallsArray) {
          const functionName = call.name;
          const args = call.args;
          
          
          let functionResult;
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