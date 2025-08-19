import { GoogleGenerativeAI, GenerativeModel, ChatSession } from '@google/generative-ai';
import { collection, query, where, getDocs, limit, addDoc } from 'firebase/firestore';
import { db } from './firebase';
import { storageService } from './storageService';
import { addTechnicalLog } from './firestoreService';

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
  ostolaskuData?: any[];
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
              description: 'Search price list data by product number only. Returns product details including ProductName, SalePrice, and BuyPrice.',
              parameters: {
                type: 'object',
                properties: {
                  productNumber: {
                    type: 'string',
                    description: 'Product number (ProductNumber field) to search for (partial match supported)'
                  },
                  limit: {
                    type: 'number',
                    description: 'Maximum number of results to return (default 10)'
                  }
                },
                required: ['productNumber']
              }
            },
            {
              name: 'searchTilaus',
              description: 'Search or list order data (tilaus_data). Can search by order number or list all.',
              parameters: {
                type: 'object',
                properties: {
                  orderNumber: {
                    type: 'string',
                    description: 'Optional: Order number (RP-tunnus/tilausnumero) to search for (partial match). Leave empty to list all.'
                  },
                  limit: {
                    type: 'number',
                    description: 'Maximum number of results to return (default 10)'
                  }
                },
                required: []
              }
            },
            {
              name: 'createLasku',
              description: 'Create and save new invoice with header and lines. Creates one invoice per unique customer.',
              parameters: {
                type: 'object',
                properties: {
                  asiakasnumero: { 
                    type: 'string', 
                    description: 'Customer number (header level) - all lines must be for this customer' 
                  },
                  laskuotsikko: {
                    type: 'string',
                    description: 'Invoice title or description (header level)'
                  },
                  laskurivit: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        reskontra: { type: 'string', description: 'Account type (e.g., MK)' },
                        tuotekoodi: { type: 'string', description: 'Product code' },
                        määrä: { type: 'number', description: 'Quantity' },
                        ahinta: { type: 'number', description: 'Unit price' },
                        kuvaus: { type: 'string', description: 'Description of the service/product' },
                        yksikkö: { type: 'string', description: 'Unit (e.g., kpl, h)' },
                        tuotenimi: { type: 'string', description: 'Product name' },
                        alvkoodi: { type: 'string', description: 'VAT code (optional)' },
                        Tilausnumero: { type: 'string', description: 'Order number' }
                      },
                      required: ['tuotekoodi', 'määrä', 'ahinta', 'kuvaus', 'tuotenimi']
                    },
                    description: 'Array of invoice lines for this customer'
                  }
                },
                required: ['asiakasnumero', 'laskurivit']
              }
            }
          ]
        }
      ]
    });
  }

  // Function implementations for Gemini to call
  private async searchHinnasto(userId: string, params: Record<string, any>, sessionId?: string) {
    console.log('🔍 searchHinnasto called with params:', { userId, params });
    
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

      console.log('📊 Querying shared hinnasto collection');
      const querySnapshot = await getDocs(q);
      console.log('📊 Found', querySnapshot.docs.length, 'documents in hinnasto collection');
      
      let records = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Apply filter - check multiple field names like the UI does
      if (params.productNumber) {
        console.log('🔎 Filtering by productNumber:', params.productNumber);
        const beforeFilter = records.length;
        records = records.filter(record => {
          // Check various possible field names for product number (same as UI)
          const productNumber = 
            record['ProductNumber'] || 
            record['Tuotetunnus'] || 
            record['tuotetunnus'] || 
            record['Product Number'] ||
            record['product_number'] ||
            '';
          return String(productNumber).toLowerCase().includes(params.productNumber.toLowerCase());
        });
        console.log(`📊 Filtered from ${beforeFilter} to ${records.length} records`);
        if (records.length > 0) {
          console.log('🔍 Sample matching records:', 
            records.slice(0, 3).map(r => ({
              ProductNumber: r['ProductNumber'],
              Tuotetunnus: r['Tuotetunnus'],
              ProductName: r['ProductName'] || r['Tuote']
            })));
        }
      } else {
        // productNumber is now required, so this shouldn't happen
        console.warn('⚠️ searchHinnasto called without productNumber - returning empty result');
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
      
      console.log('✅ searchHinnasto result:', {
        success: result.success,
        resultCount: result.data.length,
        totalFound: result.count
      });
      
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
      console.error('❌ searchHinnasto failed:', error);
      
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
    console.log('🔍 searchTilaus called with params:', { userId, params });
    
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
      // Query ALL tilaus_data records (shared data)
      const q = query(
        collection(db, 'tilaus_data'),
        limit(params.limit || 100) // Increased limit for shared data
      );

      console.log('📊 Querying shared tilaus_data collection');
      const querySnapshot = await getDocs(q);
      console.log('📊 Found', querySnapshot.docs.length, 'documents in tilaus_data collection');
      
      let records = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Apply filter - only search by OrderNumber field (same as UI)
      if (params.orderNumber) {
        console.log('🔎 Filtering by orderNumber:', params.orderNumber);
        const beforeFilter = records.length;
        records = records.filter(record => {
          // Check various possible field names for order number (same as UI)
          const orderNumber = 
            record['OrderNumber'] || 
            record['RP-tunnus'] || 
            record['RP-tunnus (tilausnumero)'] || 
            record['Tilausnumero'] || 
            record['tilausnumero'] ||
            record['Tilaustunnus'] ||
            '';
          return String(orderNumber).toLowerCase().includes(params.orderNumber.toLowerCase());
        });
        console.log(`📊 Filtered from ${beforeFilter} to ${records.length} records`);
      }

      const result = {
        success: true,
        data: records.slice(0, params.limit || 10),
        count: records.length
      };
      
      console.log('✅ searchTilaus result:', {
        success: result.success,
        resultCount: result.data.length,
        totalFound: result.count
      });
      
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
      console.error('❌ searchTilaus failed:', error);
      
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



  private async fetchTilausDataForCustomer(userId: string, asiakasnumero: string): Promise<any[]> {
    try {
      // Query ALL tilaus_data records (shared data)
      const q = query(
        collection(db, 'tilaus_data')
      );
      
      const querySnapshot = await getDocs(q);
      const tilausRecords = querySnapshot.docs.map(doc => doc.data());
      
      // Filter for this customer by finding matching company ID field
      const customerTilaukset = tilausRecords.filter(record => {
        const companyIdField = Object.keys(record).find(key => 
          key.includes('Yhtiön tunnus') || key.includes('yhtiön tunnus') || 
          key.includes('Yhtiötunnus') || key.includes('yhtiötunnus') ||
          key.toLowerCase().includes('company') && key.toLowerCase().includes('id')
        );
        
        if (companyIdField) {
          return String(record[companyIdField]).trim() === String(asiakasnumero).trim();
        }
        return false;
      });
      
      return customerTilaukset;
    } catch (error) {
      console.error('Failed to fetch tilaus data:', error);
      return [];
    }
  }

  private async createLasku(userId: string, params: Record<string, any>) {
    console.log('💰 createLasku called with params:', { userId, params });
    
    try {
      const { asiakasnumero, laskurivit, laskuotsikko } = params;
      
      // Fetch tilaus data for this customer to match products
      const tilausData = await this.fetchTilausDataForCustomer(userId, asiakasnumero);
      
      // Validate header fields
      if (!asiakasnumero) {
        return {
          success: false,
          error: 'Asiakasnumero on pakollinen header-kenttä'
        };
      }
      
      if (!laskurivit || !Array.isArray(laskurivit) || laskurivit.length === 0) {
        return {
          success: false,
          error: 'Laskurivit array on pakollinen ja ei saa olla tyhjä'
        };
      }

      // Validate each laskurivi (asiakasnumero no longer in line level)
      for (let i = 0; i < laskurivit.length; i++) {
        const rivi = laskurivit[i];
        const requiredFields = ['tuotekoodi', 'määrä', 'ahinta', 'kuvaus', 'tuotenimi'];
        
        for (const field of requiredFields) {
          if (!rivi[field]) {
            return {
              success: false,
              error: `Laskurivi ${i + 1}: Pakollinen kenttä '${field}' puuttuu`
            };
          }
        }

        // Validate numeric fields
        if (isNaN(Number(rivi.määrä)) || Number(rivi.määrä) <= 0) {
          return {
            success: false,
            error: `Laskurivi ${i + 1}: Määrä ei ole kelvollinen positiivinen numero`
          };
        }

        if (isNaN(Number(rivi.ahinta)) || Number(rivi.ahinta) <= 0) {
          return {
            success: false,
            error: `Laskurivi ${i + 1}: Ahinta ei ole kelvollinen positiivinen numero`
          };
        }
      }

      // Generate detailed explanations for each line item with product matching
      const laskurivitWithSelvitys = await Promise.all(laskurivit.map(async (rivi, index) => {
        // Find matching "Tilattu tuote" from tilaus data
        let tilattuTuote = 'ei löydy';
        
        if (tilausData.length > 0) {
          // Extract all available ordered products for this customer
          const availableProducts = tilausData
            .map(tilaus => tilaus['Tilattu tuote'] || tilaus['tilattu tuote'] || tilaus['Product'])
            .filter(product => product && String(product).trim() !== '')
            .map(product => String(product).trim());
          
          if (availableProducts.length > 0) {
            const tuotenimi = String(rivi.tuotenimi || '').toLowerCase().trim();
            const kuvaus = String(rivi.kuvaus || '').toLowerCase().trim();
            
            // Find best match by checking similarity with tuotenimi (primary) and kuvaus (secondary)
            const bestMatch = availableProducts.find(product => {
              const productLower = String(product).toLowerCase().trim();
              // Check if product name contains tuotenimi or vice versa
              return tuotenimi.includes(productLower) || 
                     productLower.includes(tuotenimi) ||
                     kuvaus.includes(productLower) ||
                     productLower.includes(kuvaus);
            });
            
            if (bestMatch) {
              tilattuTuote = bestMatch;
            }
          }
        }
        
        const selvitysPrompt = `Luo yksityiskohtainen laskutusselvitys tälle laskuriville Markdown-muodossa:

**Laskurivi ${index + 1}:**
- Tuotekoodi: ${rivi.tuotekoodi}
- Tuotenimi: ${rivi.tuotenimi}
- Kuvaus: ${rivi.kuvaus}
- Määrä: ${rivi.määrä}
- Yksikköhinta: ${rivi.ahinta}€
- Kokonaishinta: ${Number(rivi.määrä) * Number(rivi.ahinta)}€
- Asiakasnumero: ${asiakasnumero}
- Tilattu tuote: ${tilattuTuote}

Kirjoita kattava selvitys joka sisältää:
1. **Laskutusperuste** - Miksi tämä rivi laskutetaan
2. **Hinnoittelulogiikka** - Miten hinta on määritetty (hinnastosta, sopimuksesta tms.)
3. **Määrän peruste** - Miksi tämä määrä laskutetaan
4. **Asiakastiedot** - Kenen vastuulla laskutus on
5. **Tilausperuste** - Mihin tilaukseen tai sopimukseen perustuu

Vastaa pelkästään Markdown-muotoisella selvityksellä ilman johdantoa.`;

        try {
          const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
          const result = await model.generateContent(selvitysPrompt);
          const selvitys = result.response.text() || 'Selvitystä ei voitu generoida.';
          
          return {
            reskontra: rivi.reskontra || 'MK',
            tuotekoodi: rivi.tuotekoodi,
            määrä: Number(rivi.määrä),
            ahinta: Number(rivi.ahinta),
            kuvaus: rivi.kuvaus,
            selvitys: selvitys,
            tilattuTuote: tilattuTuote,
            yksikkö: rivi.yksikkö || 'kpl',
            tuotenimi: rivi.tuotenimi,
            alvkoodi: rivi.alvkoodi || '',
            Tilausnumero: rivi.Tilausnumero || `LASKU-${Date.now()}`
          };
        } catch (error) {
          console.error('Failed to generate selvitys for line', index + 1, error);
          return {
            reskontra: rivi.reskontra || 'MK',
            tuotekoodi: rivi.tuotekoodi,
            määrä: Number(rivi.määrä),
            ahinta: Number(rivi.ahinta),
            kuvaus: rivi.kuvaus,
            selvitys: 'Selvitystä ei voitu generoida automaattisesti.',
            tilattuTuote: tilattuTuote,
            yksikkö: rivi.yksikkö || 'kpl',
            tuotenimi: rivi.tuotenimi,
            alvkoodi: rivi.alvkoodi || '',
            Tilausnumero: rivi.Tilausnumero || `LASKU-${Date.now()}`
          };
        }
      }));

      // Prepare document to save (new structure with header-level customer)
      const laskuDocument = {
        userId,
        asiakasnumero, // Header level customer number
        laskuotsikko: laskuotsikko || 'Edelleenlaskutus',
        laskurivit: laskurivitWithSelvitys,
        luontipaiva: new Date().toISOString(),
        kokonaissumma: laskurivit.reduce((sum, rivi) => sum + (Number(rivi.määrä) * Number(rivi.ahinta)), 0)
      };

      // Save to Firestore 'myyntilaskut' collection
      console.log('💾 Saving invoice to myyntilaskut collection...');
      const docRef = await addDoc(collection(db, 'myyntilaskut'), laskuDocument);
      
      console.log('✅ Invoice saved successfully with ID:', docRef.id);

      return {
        success: true,
        data: {
          laskuId: docRef.id,
          rivienMaara: laskurivit.length,
          kokonaissumma: laskuDocument.kokonaissumma,
          laskuotsikko: laskuDocument.laskuotsikko,
          laskurivit: laskuDocument.laskurivit
        }
      };

    } catch (error) {
      console.error('❌ createLasku failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Laskun luonti epäonnistui'
      };
    }
  }

  async initializeSession(context: ChatContext): Promise<string> {
    console.log('🚀 Initializing chat session:', {
      sessionId: context.sessionId,
      userId: context.userId,
      promptLength: context.systemPrompt.length,
      hasOstolaskuData: !!context.ostolaskuData
    });
    
    try {
      // Build the system prompt with ostolasku data if available
      let fullSystemPrompt = context.systemPrompt;
      
      if (context.ostolaskuData && context.ostolaskuData.length > 0) {
        const ostolaskuJson = JSON.stringify(context.ostolaskuData, null, 2);
        fullSystemPrompt += `\n\n=== LADATTU OSTOLASKU DATA ===\nSeuraava ostolasku on ladattu ja analyysiä varten:\n\`\`\`json\n${ostolaskuJson}\n\`\`\`\n\nTämä data on nyt käytettävissä suoraan. Et tarvitse searchOstolasku funktiota - voit viitata suoraan tähän dataan vastauksissa.`;
      }
      
      const chat = this.model.startChat({
        history: [
          {
            role: 'user',
            parts: [{ text: fullSystemPrompt }]
          },
          {
            role: 'model',
            parts: [{ text: 'Ymmärsin. Olen valmis auttamaan hinnasto- ja tilausdatan kanssa. Voin hakea tietoja, laskea yhteissummia ja analysoida dataa. Miten voin auttaa?' }]
          }
        ]
      });

      this.activeSessions.set(context.sessionId, chat);
      console.log('✅ Chat session initialized successfully:', context.sessionId);
      
      return context.sessionId;
    } catch (error) {
      console.error('❌ Failed to initialize chat session:', error);
      throw new Error(`Failed to initialize chat session: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async sendMessage(sessionId: string, message: string, userId: string, ostolaskuData: any[] = []): Promise<ChatMessage> {
    console.log('💬 sendMessage called:', { 
      sessionId, 
      message: message.substring(0, 100) + '...', 
      userId,
      hasOstolaskuData: ostolaskuData.length > 0,
      ostolaskuRowCount: ostolaskuData.length
    });
    
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      console.error('❌ Chat session not found:', sessionId);
      throw new Error('Chat session not found');
    }

    try {
      // Note: Ostolasku data was already provided during session initialization
      // We only need to inform the AI about the current availability status
      let contextNote = '';
      
      if (ostolaskuData && ostolaskuData.length > 0) {
        contextNote = `\n\n[MUISTUTUS: Sinulla on käytettävissä ostolasku data ${ostolaskuData.length} rivillä session-kontekstissa]`;
        console.log(`ℹ️ Ostolasku data available: ${ostolaskuData.length} rows`);
      } else {
        contextNote = '\n\n[MUISTUTUS: Ei ostolaskudataa saatavilla tässä sessiossa]';
        console.log('ℹ️ No ostolasku data available');
      }
      
      const fullMessage = message + contextNote;
      
      console.log('🔄 Sending message to Gemini...');
      const result = await session.sendMessage(fullMessage);
      const response = result.response;
      
      console.log('📦 Initial response received, checking for function calls...');
      
      // Handle function calls
      const functionCalls: string[] = [];
      let finalContent = '';
      
      const functionCallsArray = response.functionCalls && typeof response.functionCalls === 'function' ? response.functionCalls() : null;
      if (functionCallsArray && Array.isArray(functionCallsArray) && functionCallsArray.length > 0) {
        console.log('🔧 Function calls detected:', functionCallsArray.length);
        
        const functionResponses = [];
        
        for (const call of functionCallsArray) {
          const functionName = call.name;
          const args = call.args;
          
          console.log(`🔧 Executing function: ${functionName} with args:`, args);
          
          let functionResult;
          switch (functionName) {
            case 'searchHinnasto':
              functionResult = await this.searchHinnasto(userId, args, sessionId);
              break;
            case 'searchTilaus':
              functionResult = await this.searchTilaus(userId, args, sessionId);
              break;
            case 'createLasku':
              functionResult = await this.createLasku(userId, args);
              break;
            default:
              console.error('❌ Unknown function called:', functionName);
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
        
        // Send all function results back to model at once
        console.log('📤 Sending function results back to Gemini...');
        const finalResult = await session.sendMessage(functionResponses);
        finalContent = finalResult.response.text();
        console.log('✅ Final response received from Gemini');
      } else {
        // No function calls, use the original response
        console.log('💭 No function calls, using direct response');
        finalContent = response.text();
      }
      
      // Ensure we have content to return
      if (!finalContent || finalContent.trim() === '') {
        console.log('⚠️ Empty response detected, using fallback message');
        finalContent = 'Anteeksi, vastaukseni jäi kesken. Voisitko toistaa kysymyksen?';
      }
      
      const chatMessage = {
        id: Date.now().toString(),
        role: 'assistant' as const,
        content: finalContent,
        timestamp: new Date(),
        functionCalls: functionCalls.length > 0 ? functionCalls : undefined
      };
      
      console.log('✅ Message processing complete:', {
        messageId: chatMessage.id,
        contentLength: chatMessage.content.length,
        functionCallsCount: functionCalls.length
      });
      
      return chatMessage;
    } catch (error) {
      console.error('❌ sendMessage failed:', error);
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