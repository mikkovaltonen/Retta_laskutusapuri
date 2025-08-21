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
              description: 'Search price list data by product name. Returns product details including ProductNumber, ProductName, SalePrice, and BuyPrice.',
              parameters: {
                type: 'object',
                properties: {
                  productName: {
                    type: 'string',
                    description: 'Product name to search for (checks fields: ProductName, Tuote, etc. - partial match supported)'
                  },
                  limit: {
                    type: 'number',
                    description: 'Maximum number of results to return (default 10)'
                  }
                },
                required: ['productName']
              }
            },
            {
              name: 'searchTilaus',
              description: 'Search order data by Tampuuri code. Returns order details including OrderNumber, ProductName, TotalSellPrice, TotalBuyPrice, Supplier, and customer Name.',
              parameters: {
                type: 'object',
                properties: {
                  tampuuriCode: {
                    type: 'string',
                    description: 'Tampuuri code to search for (Code field - partial match supported)'
                  },
                  limit: {
                    type: 'number',
                    description: 'Maximum number of results to return (default 10)'
                  }
                },
                required: ['tampuuriCode']
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
      
      let records = querySnapshot.docs.map(doc => {
        const data = doc.data();
        // Return only the fields needed for pricing verification
        return {
          id: doc.id,
          ProductName: data.ProductName || '',
          SalePrice: data.SalePrice || 0,
          BuyPrice: data.BuyPrice || 0
        };
      });

      // Apply filter - search by ProductName field only
      if (params.productName) {
        console.log('🔎 Filtering by productName:', params.productName);
        const beforeFilter = records.length;
        const searchTerm = params.productName.toLowerCase();
        
        records = records.filter(record => {
          // Check various possible field names for product name
          const productName = 
            record['ProductName'] || 
            record['Tuote'] || 
            record['tuote'] || 
            record['Product Name'] ||
            record['product_name'] ||
            '';
          return String(productName).toLowerCase().includes(searchTerm);
        });
        
        console.log(`📊 Filtered from ${beforeFilter} to ${records.length} records`);
        if (records.length > 0) {
          console.log('🔍 Sample matching records:', 
            records.slice(0, 3).map(r => ({
              ProductNumber: r['ProductNumber'] || r['Tuotetunnus'],
              ProductName: r['ProductName'] || r['Tuote'],
              SalePrice: r['SalePrice'],
              BuyPrice: r['BuyPrice']
            })));
        }
      } else {
        // productName is now required
        console.warn('⚠️ searchHinnasto called without productName - returning empty result');
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
      // Query ALL tilaus_data records without limit to match UI behavior
      const q = query(
        collection(db, 'tilaus_data')
        // No limit - get all records like the UI does
      );

      console.log('📊 Querying shared tilaus_data collection');
      const querySnapshot = await getDocs(q);
      console.log('📊 Found', querySnapshot.docs.length, 'documents in tilaus_data collection');
      
      let records = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Apply filter - search by Code (Tampuurinumero) OR OrderNumber (RP-numero)
      if (params.tampuuriCode) {
        console.log('🔎 Filtering by Code (Tampuurinumero) field:', params.tampuuriCode);
        const beforeFilter = records.length;
        const searchCode = String(params.tampuuriCode).trim();
        
        records = records.filter(record => {
          // Check Code field (Tampuurinumero) - exact match or starts with for longer codes
          const code = String(record['Code'] || record['Tampuurinumero'] || '').trim();
          
          // Debug logging for first few records
          if (records.indexOf(record) < 3) {
            console.log(`  Comparing: searchCode="${searchCode}" with code="${code}"`);
          }
          
          // For short search terms (1-3 chars), require exact match
          if (searchCode.length <= 3) {
            return code === searchCode;
          }
          
          // For longer search terms, allow partial match (starts with or contains)
          return code.startsWith(searchCode) || code.includes(searchCode);
        });
        console.log(`📊 Filtered by tampuuriCode from ${beforeFilter} to ${records.length} records`);
      } else if (params.orderNumber) {
        console.log('🔎 Filtering by OrderNumber (RP-numero) field:', params.orderNumber);
        const beforeFilter = records.length;
        const searchOrder = String(params.orderNumber).trim();
        
        records = records.filter(record => {
          // Check OrderNumber field (RP-numero)
          const orderNum = String(record['OrderNumber'] || record['RP-numero'] || '').trim();
          
          // For RP numbers, always use contains/partial match since they are long
          return orderNum.toLowerCase().includes(searchOrder.toLowerCase());
        });
        console.log(`📊 Filtered by orderNumber from ${beforeFilter} to ${records.length} records`);
      } else {
        // Either tampuuriCode or orderNumber required
        console.warn('⚠️ searchTilaus called without tampuuriCode or orderNumber - returning empty result');
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
      
      // Fetch hinnasto data to validate prices and get sales prices
      const hinnastoQuery = query(collection(db, 'hinnasto'));
      const hinnastoSnapshot = await getDocs(hinnastoQuery);
      const hinnastoData = hinnastoSnapshot.docs.map(doc => doc.data());
      console.log('📊 Loaded', hinnastoData.length, 'price list items for validation');
      
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

      // Validate and process each laskurivi with price lookup
      const processedLaskurivit = [];
      
      for (let i = 0; i < laskurivit.length; i++) {
        const rivi = laskurivit[i];
        
        // Required fields updated - tuotekoodi is optional now
        const requiredFields = ['määrä', 'tuotenimi'];
        
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
        
        // Find matching product in hinnasto by ProductName
        const productDescription = String(rivi.tuotenimi || '').trim();
        console.log(`🔍 Looking for product: "${productDescription}" in price list`);
        
        // Find matching hinnasto item by ProductName - let AI handle intelligent matching
        // AI should already provide the correct ProductName that exists in hinnasto
        const matchingHinnastoItem = hinnastoData.find(item => {
          const itemProductName = String(item['ProductName'] || '').trim().toLowerCase();
          const searchProduct = productDescription.toLowerCase().trim();
          
          // Simple exact match first (AI should provide exact name when possible)
          if (itemProductName === searchProduct) {
            return true;
          }
          
          // Allow partial match if core service name is the same
          // This is a fallback - AI should ideally provide the exact ProductName from hinnasto
          const itemCore = itemProductName.replace(/[.\-,]/g, ' ').replace(/\s+/g, ' ');
          const searchCore = searchProduct.replace(/[.\-,]/g, ' ').replace(/\s+/g, ' ');
          
          // Check if one contains the other (for flexibility)
          return itemCore.includes(searchCore) || searchCore.includes(itemCore);
        });
        
        if (!matchingHinnastoItem) {
          return {
            success: false,
            error: `Laskurivi ${i + 1}: Tuotetta "${productDescription}" ei löydy hinnastosta (ProductName)`
          };
        }
        
        // Validate that purchase price matches (if ahinta is provided in input)
        const hinnastoBuyPrice = Number(matchingHinnastoItem['BuyPrice'] || 0);
        const inputBuyPrice = Number(rivi.ahinta || 0);
        
        if (rivi.ahinta && Math.abs(hinnastoBuyPrice - inputBuyPrice) > 0.01) {
          return {
            success: false,
            error: `Laskurivi ${i + 1}: Ostohinta ei täsmää! Hinnastossa: ${hinnastoBuyPrice}€, Ostolaskulla: ${inputBuyPrice}€`
          };
        }
        
        // Get the sales price from hinnasto
        const salePrice = Number(matchingHinnastoItem['SalePrice'] || 0);
        
        if (salePrice <= 0) {
          return {
            success: false,
            error: `Laskurivi ${i + 1}: Myyntihintaa ei löydy hinnastosta tuotteelle "${productDescription}"`
          };
        }
        
        // Use product code from hinnasto if available
        const productCode = matchingHinnastoItem['ProductNumber'] || 
                           matchingHinnastoItem['Tuotetunnus'] || 
                           matchingHinnastoItem['tuotetunnus'] || 
                           rivi.tuotekoodi || 
                           'N/A';
        
        console.log(`✅ Found matching product: ${productDescription} -> Code: ${productCode}, Sale price: ${salePrice}€`);
        
        // Add processed line with sales price from hinnasto
        processedLaskurivit.push({
          ...rivi,
          tuotekoodi: productCode,
          ahinta: salePrice, // Use sales price from hinnasto
          ostohinta: hinnastoBuyPrice, // Store original buy price for reference
          kuvaus: rivi.kuvaus || `${productDescription} - Edelleenlaskutus`
        });
      }

      // Generate detailed explanations for each line item with product matching
      const laskurivitWithSelvitys = await Promise.all(processedLaskurivit.map(async (rivi, index) => {
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
- Myyntihinta: ${rivi.ahinta}€
- Ostohinta: ${rivi.ostohinta}€
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
        kokonaissumma: processedLaskurivit.reduce((sum, rivi) => sum + (Number(rivi.määrä) * Number(rivi.ahinta)), 0)
      };

      // Save to Firestore 'myyntilaskut' collection
      console.log('💾 Saving invoice to myyntilaskut collection...');
      const docRef = await addDoc(collection(db, 'myyntilaskut'), laskuDocument);
      
      console.log('✅ Invoice saved successfully with ID:', docRef.id);

      return {
        success: true,
        data: {
          laskuId: docRef.id,
          rivienMaara: processedLaskurivit.length,
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
    // Reduce logging for production
    if (process.env.NODE_ENV === 'development') {
      console.log('💬 sendMessage called:', { 
        sessionId, 
        message: message.substring(0, 100) + '...', 
        userId,
        hasOstolaskuData: ostolaskuData.length > 0,
        ostolaskuRowCount: ostolaskuData.length
      });
    }
    
    let session = this.activeSessions.get(sessionId);
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
        if (process.env.NODE_ENV === 'development') {
          console.log(`ℹ️ Ostolasku data available: ${ostolaskuData.length} rows`);
        }
      } else {
        contextNote = '\n\n[MUISTUTUS: Ei ostolaskudataa saatavilla tässä sessiossa]';
        console.log('ℹ️ No ostolasku data available');
      }
      
      const fullMessage = message + contextNote;
      
      if (process.env.NODE_ENV === 'development') {
        console.log('🔄 Sending message to Gemini...');
      }
      
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
            console.log('📦 Initial response received, checking for function calls...');
            break;
          }
          
          initialRetries++;
          console.log(`⚠️ Empty initial response, retry ${initialRetries}/${maxInitialRetries}`);
          if (initialRetries <= maxInitialRetries) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        } catch (error) {
          initialRetries++;
          console.error(`❌ Initial request failed, retry ${initialRetries}/${maxInitialRetries}:`, error);
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
        
        // Send all function results back to model at once with retry logic
        console.log('📤 Sending function results back to Gemini...');
        let retryCount = 0;
        const maxRetries = 3;
        
        while (retryCount < maxRetries) {
          try {
            const finalResult = await session.sendMessage(functionResponses);
            finalContent = finalResult.response.text();
            
            // Check if response is valid
            if (finalContent && finalContent.trim() !== '') {
              console.log('✅ Final response received from Gemini');
              break;
            } else {
              retryCount++;
              console.log(`⚠️ Empty response on attempt ${retryCount}/${maxRetries}, retrying...`);
              if (retryCount < maxRetries) {
                // Wait before retry (exponential backoff)
                await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount - 1)));
              }
            }
          } catch (retryError) {
            retryCount++;
            console.error(`❌ Retry ${retryCount}/${maxRetries} failed:`, retryError);
            if (retryCount >= maxRetries) {
              throw retryError;
            }
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount - 1)));
          }
        }
        
        if (!finalContent || finalContent.trim() === '') {
          console.log('⚠️ All retries exhausted, generating detailed fallback');
          // Generate more detailed fallback based on function results
          if (functionCalls.length > 0) {
            finalContent = `Käsittelin ${functionCalls.length} funktiokutsua. Tarkista taulukko tuloksista yllä. Voin auttaa lisää tarvittaessa.`;
          } else {
            finalContent = 'Anteeksi, vastaukseni jäi kesken. Voisitko toistaa kysymyksen?';
          }
        }
      } else {
        // No function calls, use the original response
        console.log('💭 No function calls, using direct response');
        finalContent = response.text();
      }
      
      // Final validation and safety check
      if (!finalContent || finalContent.trim() === '') {
        console.log('⚠️ Empty response detected after all attempts, using fallback message');
        finalContent = 'Anteeksi, tekninen ongelma esti vastauksen. Yritä uudelleen hetken kuluttua.';
      }
      
      // Check for incomplete responses (common patterns)
      const incompletePatterns = [
        /^\*\*$/,  // Just asterisks
        /^#{1,6}\s*$/,  // Just markdown headers
        /^\|\s*$/,  // Just table start
        /^```$/,  // Just code block start
        /^-\s*$/,  // Just list item start
      ];
      
      if (incompletePatterns.some(pattern => pattern.test(finalContent.trim()))) {
        console.log('⚠️ Incomplete response pattern detected, appending notice');
        finalContent += '\n\n*[Vastaus jäi kesken. Pyydä jatkoa kirjoittamalla "jatka"]*';
      }
      
      // Check if response seems cut off (ends mid-sentence)
      const lastChar = finalContent.trim().slice(-1);
      const midSentenceEndings = [',', ':', '-', '(', '[', '{'];
      if (midSentenceEndings.includes(lastChar) || 
          (finalContent.length > 100 && !['!', '.', '?', '```'].some(end => finalContent.trim().endsWith(end)))) {
        console.log('⚠️ Response appears to be cut off mid-sentence');
        finalContent += '\n\n*[Vastaus saattoi jäädä kesken. Kirjoita "jatka" jos haluat lisää tietoa]*';
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