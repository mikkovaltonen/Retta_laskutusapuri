import React, { useState, useRef } from 'react';
import { GoogleGenerativeAI, Part } from '@google/generative-ai';
import { Loader2, Send, RotateCcw, Paperclip, Bot, LogOut, Settings, ThumbsUp, ThumbsDown } from "lucide-react";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { useWorkspace } from '../hooks/useWorkspace';
import { toast } from 'sonner';
import { loadLatestPrompt, createContinuousImprovementSession, addTechnicalLog, setUserFeedback } from '../lib/firestoreService';
import { sessionService, ChatSession } from '../lib/sessionService';
import { erpApiService } from '../lib/erpApiService';
import { salesInvoiceApiService } from '../lib/salesInvoiceApiService';

interface UploadedFile {
  name: string;
  type: string;
  size: number;
  content: string | ArrayBuffer;
  url?: string;
}

interface PropertyManagerChatProps {
  onLogout?: () => void;
  hideNavigation?: boolean;
  uploadedFiles?: UploadedFile[];
}

const apiKey = import.meta.env.VITE_GEMINI_API_KEY || '';
const geminiModel = import.meta.env.VITE_GEMINI_MODEL || 'gemini-2.5-flash-preview-04-17';

// Purchase Order Function Definition for Gemini
const searchPurchaseOrdersFunction = {
  name: "search_purchase_orders", 
  description: "Search and DISPLAY purchase order data for property management. ALWAYS show the actual data found to the user in a clear, formatted way. Include specific details like supplier names, products, prices, dates, and quantities from the results.",
  parameters: {
    type: "object",
    properties: {
      supplierName: {
        type: "string",
        description: "Supplier/contractor name or partial name (e.g., 'Huolto-Karhu', 'TechCorp', 'Kiinteistopalvelut')"
      },
      productDescription: {
        type: "string", 
        description: "Service or product description or partial description (e.g., 'Kattoremontti', 'Putkiston huolto', 'Sähkötyöt', 'maintenance', 'repair')"
      },
      dateFrom: {
        type: "string",
        description: "Search from delivery date (YYYY-MM-DD format). Filters by 'Receive By' column for service delivery dates."
      },
      dateTo: {
        type: "string",
        description: "Search to delivery date (YYYY-MM-DD format). Filters by 'Receive By' column for service delivery dates."
      },
      buyerName: {
        type: "string",
        description: "Property manager name or partial name who placed the order (e.g., 'Erika', 'Mikael', 'Sundström')"
      }
    }
  }
};


// Invoice Function Definition for Gemini  
const searchInvoicesFunction = {
  name: "search_invoices",
  description: "Search and DISPLAY invoice data for property management. ALWAYS show the actual data found to the user in a clear, formatted way. Include specific details like supplier names, amounts, due dates, payment status, and invoice numbers from the results.",
  parameters: {
    type: "object",
    properties: {
      customerName: {
        type: "string",
        description: "Customer name or partial name (e.g., 'Asunto Oy Kukkakatu', 'Kiinteistö Oy Metsäkoti', 'Taloyhtiö Oy')"
      },
      serviceDescription: {
        type: "string",
        description: "Service or product description or partial description (e.g., 'Kattoremontti', 'Siivouspalvelut', 'Sähkötyöt', 'cleaning', 'maintenance')"
      },
      dateFrom: {
        type: "string", 
        description: "Search from invoice date (YYYY-MM-DD format). Filters by 'Invoice Date' column for billing dates."
      },
      dateTo: {
        type: "string",
        description: "Search to invoice date (YYYY-MM-DD format). Filters by 'Invoice Date' column for billing dates."
      },
      dueDateFrom: {
        type: "string",
        description: "Search from due date (YYYY-MM-DD format). Filters by 'Due Date' column for payment deadlines."
      },
      dueDateTo: {
        type: "string", 
        description: "Search to due date (YYYY-MM-DD format). Filters by 'Due Date' column for payment deadlines."
      },
      approverName: {
        type: "string",
        description: "Invoice approver name or partial name who approved the invoice (e.g., 'Erika', 'Mikael', 'Talousosasto')"
      },
      paymentStatus: {
        type: "string",
        description: "Payment status (e.g., 'Paid', 'Pending', 'Overdue', 'Approved')"
      }
    }
  }
};

// Create Purchase Order Function Definition for Gemini
const createPurchaseOrderFunction = {
  name: "create_purchase_order",
  description: "Create a new purchase order with multiple product rows and generate Excel file for download. Use this when the user wants to create, write, or generate a purchase order with specific products and quantities.",
  parameters: {
    type: "object",
    properties: {
      orderNumber: {
        type: "string",
        description: "Unique purchase order number (e.g., 'PO-2024-001', 'TILAUS-240618-1')"
      },
      supplierName: {
        type: "string", 
        description: "Supplier/contractor name (e.g., 'Huolto-Karhu Oy', 'TechCorp', 'Kiinteistopalvelut Lahtinen')"
      },
      buyerName: {
        type: "string",
        description: "Name of the person creating/responsible for the purchase order"
      },
      orderDate: {
        type: "string",
        description: "Order creation date in YYYY-MM-DD format (e.g., '2024-06-18')"
      },
      receiveByDate: {
        type: "string",
        description: "Expected delivery/completion date in YYYY-MM-DD format (optional)"
      },
      rows: {
        type: "array",
        description: "Array of product/service rows for the purchase order",
        items: {
          type: "object",
          properties: {
            productDescription: {
              type: "string",
              description: "Product or service description (e.g., 'Kattoremontti', 'LED-valaisimet 10kpl', 'Putkiston huolto')"
            },
            quantity: {
              type: "number",
              description: "Quantity of the product/service"
            },
            unitPrice: {
              type: "number", 
              description: "Price per unit in euros (e.g., 150.50 for €150.50)"
            },
            notes: {
              type: "string",
              description: "Additional notes or specifications for this row (optional)"
            }
          },
          required: ["productDescription", "quantity", "unitPrice"]
        }
      }
    },
    required: ["orderNumber", "supplierName", "buyerName", "orderDate", "rows"]
  }
};

// Debug: Log Gemini API config
console.log('Gemini API config:', {
  apiKey: apiKey ? `${apiKey.substring(0, 10)}...` : 'undefined',
  model: geminiModel
});

const genAI = new GoogleGenerativeAI(apiKey);

interface CitationSource {
  startIndex?: number;
  endIndex?: number;
  uri?: string;
  title?: string;
}

interface Message {
  role: 'user' | 'model';
  parts: Part[];
  citationMetadata?: {
    citationSources: CitationSource[];
  };
}

const processTextWithCitations = (text: string, citationSources?: CitationSource[]) => {
  const originalText = text;
  const formattedSources: string[] = [];

  if (citationSources && citationSources.length > 0) {
    const uniqueUris = new Set<string>();
    let sourceNumber = 1;
    citationSources.forEach((source) => {
      if (source.uri && !uniqueUris.has(source.uri)) {
        const linkDescription = source.title && source.title.trim() !== '' ? source.title : source.uri;
        formattedSources.push(`[Source ${sourceNumber}: ${linkDescription}](${source.uri})`);
        uniqueUris.add(source.uri);
        sourceNumber++;
      }
    });
  }

  return { originalText, formattedSources };
};

const PropertyManagerChat: React.FC<PropertyManagerChatProps> = ({ onLogout, hideNavigation = false }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionActive, setSessionActive] = useState(false);
  const [chatSession, setChatSession] = useState<ChatSession | null>(null);
  const [sessionInitializing, setSessionInitializing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { currentWorkspace } = useWorkspace();
  
  // Continuous improvement tracking
  const [continuousImprovementSessionId, setContinuousImprovementSessionId] = useState<string | null>(null);
  const [chatSessionKey] = useState<string>(() => `chat_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`);
  const [currentPromptKey, setCurrentPromptKey] = useState<string | null>(null);
  
  // Feedback dialog
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);
  const [pendingFeedback, setPendingFeedback] = useState<'thumbs_up' | 'thumbs_down' | null>(null);
  const [pendingMessageIndex, setPendingMessageIndex] = useState<number | null>(null);
  const [feedbackComment, setFeedbackComment] = useState('');

  // Initialize chat session with context
  React.useEffect(() => {
    const initializeSession = async () => {
      // Force reinitialization when workspace changes or on first load
      if (user) {
        setSessionInitializing(true);
        setSessionActive(false); // Reset session state
        setMessages([]); // Clear existing messages
        setChatSession(null); // Clear existing session
        
        try {
          // Initialize session with system prompt + knowledge documents
          const session = await sessionService.initializeChatSession(user.uid, currentWorkspace);
          setChatSession(session);
          
          // Check if this is a new user (no documents loaded)
          const isLikelyNewUser = session.documentsUsed.length === 0;
          
          const welcomeMessage: Message = {
            role: 'model',
            parts: [{
              text: isLikelyNewUser 
                ? `🎉 **Tervetuloa Propertiukseen!**

Tutustu tekoälyavustajaan korkeatasoista kiinteistönhallintaa varten. Olen täällä auttamassa sinua ${currentWorkspace === 'purchaser' ? 'edistyneessä hankintojen optimoinnissa ja toimittaja-älyssä' : 'älykkäässä laskutusautomaatiossa ja talousoperaatioissa'}.

**🎯 Pikaopas:**
• **Lataa esimerkkidataa**: Käy Admin-paneelissa → Lataa esimerkkitiedostoja ja ${currentWorkspace === 'purchaser' ? 'ostotilaus' : 'lasku'}dataa tutkittavaksi
• **Lataa omaa dataa**: Lisää omat ${currentWorkspace === 'purchaser' ? 'hankintakäytäntösi ja ostotilaus' : 'laskutusprosessisi ja myyntilasku'}tiedostosi
• **Kysy kysymyksiä**: "${currentWorkspace === 'purchaser' ? 'Mitä toimittajia me käytämme?' : 'Näytä viimeaikaiset laskut'}" tai "${currentWorkspace === 'purchaser' ? 'Etsi huoltosopimukset viime vuosineljännekseltä' : 'Seuraa erääntyneitä maksuja'}"

**💡 Edistyneet ominaisuudet:**
✅ Reaaliaikainen pääsy ${currentWorkspace === 'purchaser' ? 'ostotilaus' : 'lasku'}dataasi edistyneen funktiokutsujen kautta
✅ Sisäisten ${currentWorkspace === 'purchaser' ? 'hankintakäytäntöjesi' : 'laskutusprosessiesi'} ja dokumentaation analysointi  
✅ Ammattimainen kiinteistönhallinnan asiantuntemus ${currentWorkspace === 'purchaser' ? 'kustannusoptimoinnissa ja toimittajahallinnassa' : 'talousoperaatioissa ja maksuseurannassa'}

**Valmis kokeilemaan?** Kokeile kysyä "Lataa esimerkkidataa, jotta näen mitä osaat tehdä" tai käy Admin-paneelissa lataamassa omia tiedostoja!

Miten haluaisit aloittaa?`
                : `Hei! Olen Propertius ${currentWorkspace === 'purchaser' ? 'Hankinta' : 'Laskutus'}avustajasi. Olen täällä auttamassa sinua ammattimaisessa kiinteistönhallinnassa ${currentWorkspace === 'purchaser' ? 'hankintojen optimoinnissa ja kustannussäästöissä' : 'laskutusautomaatiossa ja taloudellisessa seurannassa'}.

📚 **Tietokanta ladattu:** ${session.documentsUsed.length} dokumentti(a) käytettävissä.

Miten voin auttaa sinua tänään?`
            }]
          };
          setMessages([welcomeMessage]);
          setSessionActive(true);
          
          if (isLikelyNewUser) {
            toast.success("🎉 Tervetuloa! Propertius-avustajasi on valmis. Käy Admin-paneelissa lataamassa esimerkkidataa ja tutustumassa ominaisuuksiin.", {
              duration: 6000
            });
          } else {
            toast.success(`Istunto alustettu ${session.documentsUsed.length} tietokannan dokumentilla`);
          }
        } catch (error) {
          console.error('Failed to initialize session:', error);
          
          if (error instanceof Error && error.message.includes('No system prompt configured')) {
            toast.error(`No ${currentWorkspace} system prompt found. Please create one in the Admin panel.`);
          } else {
            toast.error('Database loading failed. Check system prompt settings in Admin panel.');
          }
          
          // No fallback message - user needs to configure system prompt
          setMessages([]);
          setSessionActive(false);
        } finally {
          setSessionInitializing(false);
        }
      }
    };

    initializeSession();
  }, [user?.uid, currentWorkspace]); // Removed sessionInitializing to prevent infinite loop

  const quickActions = [
    "Käytä ennakkoneuvoteltuja alennushintoja",
    "Hanki hyväksynnät helposti ja oikealta henkilöltä", 
    "Löydä suosikkiurakoitsija ja paras hinta/laatu-suhde",
    "Luo huoltotilaukset helposti ja oikein"
  ];

  const handleQuickAction = async (action: string) => {
    setInput(action);
    await handleSendMessage(action);
  };

  const handleSendMessage = async (messageText?: string) => {
    const textToSend = messageText || input;
    if (!textToSend.trim() || isLoading) return;

    // Initialize continuous improvement if not already done
    if (!continuousImprovementSessionId) {
      await initializeContinuousImprovement();
    }

    const userMessage: Message = { role: 'user', parts: [{ text: textToSend }] };
    setMessages(prev => [...prev, userMessage]);
    if (!messageText) setInput('');
    setIsLoading(true);
    
    // Log user message
    if (continuousImprovementSessionId) {
      await addTechnicalLog(continuousImprovementSessionId, {
        event: 'user_message',
        userMessage: textToSend
      }, currentWorkspace);
    }

    try {
      // Use session context if available, otherwise fallback to loading prompt
      let systemPrompt = '';
      
      if (chatSession) {
        // Use the full context from initialized session (system prompt + knowledge documents)
        systemPrompt = chatSession.fullContext;
      } else {
        // Fallback: try to load latest prompt for this user
        if (user?.uid) {
          try {
            const latestPrompt = await loadLatestPrompt(user.uid, currentWorkspace);
            if (latestPrompt) {
              systemPrompt = latestPrompt;
            }
          } catch (error) {
            console.error('Error loading latest prompt:', error);
          }
        }

        // No fallback - if no prompt available, show error
        if (!systemPrompt) {
          throw new Error('No system prompt configured. Please visit Admin panel to set up your prompt.');
        }
      }

      // Select appropriate functions based on workspace
      const availableFunctions = currentWorkspace === 'purchaser' 
        ? [searchPurchaseOrdersFunction, createPurchaseOrderFunction] 
        : [searchPurchaseOrdersFunction, searchInvoicesFunction];
      
      // Use function calling model for ERP data only
      const model = genAI.getGenerativeModel({
        model: geminiModel,
        generationConfig: { temperature: 0.1 },
        tools: [{ functionDeclarations: availableFunctions }]
      });

      const history = messages.map(msg => ({ role: msg.role, parts: msg.parts }));
      const result = await model.generateContent({
        contents: [
          { role: 'user', parts: [{ text: systemPrompt }] },
          ...history, 
          { role: 'user', parts: [{ text: textToSend }] }
        ]
      });

      const response = result.response;
      if (response && response.candidates && response.candidates.length > 0) {
        const candidate = response.candidates[0];
        const content = candidate.content;
        
        // Check for function calls
        if (content?.parts) {
          for (const part of content.parts) {
            if (part.functionCall) {
              const functionName = part.functionCall.name;
              const functionArgs = part.functionCall.args;
              
              if (functionName === 'search_purchase_orders' || functionName === 'search_invoices' || functionName === 'create_purchase_order') {
                const aiRequestId = Math.random().toString(36).substring(2, 8);
                try {
                  
                  // Log AI function call details
                  console.log('🤖 AI FUNCTION CALL [' + aiRequestId + ']:', {
                    triggered_by_user_message: textToSend,
                    function_name: functionName,
                    ai_generated_parameters: functionArgs,
                    timestamp: new Date().toISOString(),
                    ai_request_id: aiRequestId
                  });

                  // Log function call triggered
                  if (continuousImprovementSessionId) {
                    await addTechnicalLog(continuousImprovementSessionId, {
                      event: 'function_call_triggered',
                      userMessage: textToSend,
                      functionName: functionName,
                      functionInputs: functionArgs,
                      aiRequestId: aiRequestId
                    }, currentWorkspace);
                  }

                  // Execute function using appropriate API based on function name
                  let functionResult;
                  if (functionName === 'search_purchase_orders') {
                    functionResult = await erpApiService.searchRecords(user!.uid, functionArgs, currentWorkspace);
                  } else if (functionName === 'search_invoices') {
                    functionResult = await salesInvoiceApiService.searchInvoices(user!.uid, functionArgs);
                  } else if (functionName === 'create_purchase_order') {
                    functionResult = await erpApiService.createPurchaseOrder(user!.uid, functionArgs, currentWorkspace);
                  }
                  
                  // Log consolidated AI + ERP results
                  console.log('🔗 AI-ERP INTEGRATION RESULT [' + aiRequestId + ']:', {
                    user_query: textToSend,
                    ai_function_call: functionName,
                    ai_parameters: functionArgs,
                    erp_result_summary: functionName === 'create_purchase_order' ? {
                      success: functionResult.success,
                      orderNumber: functionResult.orderNumber,
                      rowsAdded: functionResult.rowsAdded,
                      fileName: functionResult.fileName
                    } : {
                      totalRecords: functionResult.totalCount,
                      processingTime: functionResult.processingTimeMs + 'ms',
                      hasData: functionResult.records.length > 0
                    },
                    execution_timestamp: new Date().toISOString(),
                    ai_request_id: aiRequestId
                  });

                  // Log function call success
                  if (continuousImprovementSessionId) {
                    await addTechnicalLog(continuousImprovementSessionId, {
                      event: 'function_call_success',
                      functionName: functionName,
                      functionInputs: functionArgs,
                      functionOutputs: functionName === 'create_purchase_order' ? {
                        success: functionResult.success,
                        orderNumber: functionResult.orderNumber,
                        rowsAdded: functionResult.rowsAdded,
                        fileName: functionResult.fileName,
                        message: functionResult.message
                      } : {
                        totalRecords: functionResult.totalCount,
                        processingTimeMs: functionResult.processingTimeMs,
                        hasData: functionResult.records.length > 0,
                        recordsPreview: functionResult.records.slice(0, 3) // First 3 records as preview
                      },
                      aiRequestId: aiRequestId
                    }, currentWorkspace);
                  }
                  
                  // Create function response with explicit instructions
                  const functionResponse = {
                    role: 'model' as const,
                    parts: [{
                      functionResponse: {
                        name: functionName,
                        response: functionName === 'create_purchase_order' ? {
                          instruction: "IMPORTANT: Inform the user that the purchase order has been created successfully. Show the order details including order number, supplier, total value, and provide the download link for the Excel file.",
                          success: functionResult.success,
                          orderNumber: functionResult.orderNumber,
                          fileName: functionResult.fileName,
                          downloadUrl: functionResult.downloadUrl,
                          rowsAdded: functionResult.rowsAdded,
                          message: functionResult.message
                        } : {
                          instruction: "IMPORTANT: Present this data to the user in a clear, formatted way. Show specific details from each record including supplier names, products, prices, and dates. Do not just say you are 'checking' - show the actual results found.",
                          records: functionResult.records,
                          totalCount: functionResult.totalCount,
                          processingTimeMs: functionResult.processingTimeMs
                        }
                      }
                    }]
                  };
                  
                  
                  // Generate follow-up response with function results
                  const followUpResult = await model.generateContent({
                    contents: [
                      { role: 'user', parts: [{ text: systemPrompt }] },
                      ...history,
                      { role: 'user', parts: [{ text: textToSend }] },
                      { role: 'model', parts: [part] }, // Original function call
                      functionResponse // Function response
                    ]
                  });
                  
                  const followUpResponse = followUpResult.response;
                  if (followUpResponse?.candidates?.[0]?.content) {
                    const aiResponseText = followUpResponse.candidates[0].content?.parts?.[0]?.text || "No response text";
                    
                    // Log AI's final response
                    console.log('💬 AI FINAL RESPONSE [' + aiRequestId + ']:', {
                      response_text_length: aiResponseText.length,
                      response_preview: aiResponseText.substring(0, 200) + (aiResponseText.length > 200 ? '...' : ''),
                      included_erp_data: functionName !== 'create_purchase_order' && functionResult.totalCount > 0,
                      timestamp: new Date().toISOString(),
                      ai_request_id: aiRequestId
                    });

                    // Log AI response
                    if (continuousImprovementSessionId) {
                      await addTechnicalLog(continuousImprovementSessionId, {
                        event: 'ai_response',
                        aiResponse: aiResponseText.substring(0, 500), // First 500 chars to avoid too much data
                        aiRequestId: aiRequestId
                      }, currentWorkspace);
                    }
                    
                    setMessages(prev => [...prev, {
                      role: 'model',
                      parts: followUpResponse.candidates[0].content?.parts || [{ text: "I executed the search but couldn't format the response." }]
                    }]);
                  }
                  return;
                } catch (functionError) {
                  // Log AI function call error
                  console.log('❌ AI FUNCTION CALL ERROR [' + aiRequestId + ']:', {
                    user_query: textToSend,
                    function_name: functionName,
                    ai_parameters: functionArgs,
                    error: functionError instanceof Error ? functionError.message : 'Unknown error',
                    timestamp: new Date().toISOString(),
                    ai_request_id: aiRequestId
                  });

                  // Log function call error
                  if (continuousImprovementSessionId) {
                    await addTechnicalLog(continuousImprovementSessionId, {
                      event: 'function_call_error',
                      functionName: functionName,
                      functionInputs: functionArgs,
                      errorMessage: functionError instanceof Error ? functionError.message : 'Unknown error',
                      aiRequestId: aiRequestId
                    }, currentWorkspace);
                  }
                  
                  console.error('Function execution failed:', functionError);
                  setMessages(prev => [...prev, {
                    role: 'model',
                    parts: [{ text: `I tried to search your ERP data but encountered an error: ${functionError instanceof Error ? functionError.message : 'Unknown error'}. Please make sure you have uploaded your ERP data in the Admin panel.` }]
                  }]);
                  return;
                }
              }
            }
          }
        }
        
        let processedCitationMetadata: { citationSources: CitationSource[] } | undefined = undefined;
        if (candidate.citationMetadata && candidate.citationMetadata.citationSources) {
          processedCitationMetadata = candidate.citationMetadata;
        }

        // Log regular AI response (non-function call)
        const aiResponseText = content?.parts?.[0]?.text || "No response text";
        if (continuousImprovementSessionId) {
          await addTechnicalLog(continuousImprovementSessionId, {
            event: 'ai_response',
            aiResponse: aiResponseText.substring(0, 500) // First 500 chars to avoid too much data
          }, currentWorkspace);
        }

        setMessages(prev => [...prev, {
          role: 'model',
          parts: content?.parts || [{ text: "I couldn't generate a response." }],
          citationMetadata: processedCitationMetadata
        }]);
      } else {
        throw new Error('No response from AI model');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => [...prev, {
        role: 'model',
        parts: [{ text: "Error processing your request. Please try again." }]
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleResetChat = async () => {
    setMessages([]);
    setSessionActive(false);
    setChatSession(null);
    setInput('');
    toast.success('Chat reset successfully');
    
    // Reinitialize session with fresh context
    if (user) {
      setSessionInitializing(true);
      try {
        const session = await sessionService.initializeChatSession(user.uid, currentWorkspace);
        setChatSession(session);
        
        // Create welcome message after reset
        const isLikelyNewUser = session.documentsUsed.length === 0;
        const welcomeMessage: Message = {
          role: 'model',
          parts: [{
            text: isLikelyNewUser 
              ? `🎉 **Welcome to Propertius!**

Meet your AI assistant for high standard professional property management. I'm here to help you with ${currentWorkspace === 'purchaser' ? 'advanced procurement optimization and supplier intelligence' : 'intelligent invoicing automation and financial operations'}.

**🎯 Quick Start Guide:**
• **Load Sample Data**: Visit Admin panel → Load example files and ${currentWorkspace === 'purchaser' ? 'purchase order' : 'invoice'} data to explore
• **Upload Your Data**: Add your own ${currentWorkspace === 'purchaser' ? 'procurement policies and purchase order' : 'invoicing processes and sales invoice'} files
• **Ask Questions**: "${currentWorkspace === 'purchaser' ? 'What suppliers do we use?' : 'Show me recent invoices'}" or "${currentWorkspace === 'purchaser' ? 'Find maintenance contracts from last quarter' : 'Track overdue payments'}"

**💡 Advanced Features:**
✅ Real-time access to your ${currentWorkspace === 'purchaser' ? 'purchase order' : 'invoice'} data through advanced function calling
✅ Analysis of your internal ${currentWorkspace === 'purchaser' ? 'procurement policies' : 'billing processes'} and documentation  
✅ Professional property management expertise for ${currentWorkspace === 'purchaser' ? 'cost optimization and supplier management' : 'financial operations and payment tracking'}

**Ready to explore?** Try asking "Load sample data so I can see what you can do" or visit the Admin panel to upload your own files!

How would you like to get started?`
              : `Hello! I'm your Propertius ${currentWorkspace === 'purchaser' ? 'Procurement' : 'Invoicing'} assistant. I'm here to help you with professional property management ${currentWorkspace === 'purchaser' ? 'procurement optimization and cost savings' : 'invoicing automation and financial tracking'}.

📚 **Knowledge Base Loaded:** ${session.documentsUsed.length} document(s) available.

How can I help you today?`
          }]
        };
        setMessages([welcomeMessage]);
        setSessionActive(true);
        
        toast.success('Session refreshed with latest knowledge base');
      } catch (error) {
        console.error('Failed to refresh session:', error);
        toast.error('Failed to refresh session');
      } finally {
        setSessionInitializing(false);
      }
    }
  };

  const handleAttachDocuments = () => {
    navigate('/admin');
  };

  const handleOpenAdmin = () => {
    navigate('/admin');
  };
  
  // Initialize continuous improvement session when user starts chatting
  const initializeContinuousImprovement = async () => {
    if (!user || continuousImprovementSessionId) return;
    
    try {
      // For now, use a default prompt key if we don't have the actual one
      // This should be updated when the user selects/creates a prompt version
      const promptKey = currentPromptKey || `${user.email?.split('@')[0] || 'user'}_v1`;
      const sessionId = await createContinuousImprovementSession(promptKey, chatSessionKey, user.uid, currentWorkspace);
      setContinuousImprovementSessionId(sessionId);
      console.log('📊 Continuous improvement session initialized:', sessionId);
    } catch (error) {
      console.error('Failed to initialize continuous improvement session:', error);
    }
  };

  // Handle user feedback for specific message - opens dialog
  const handleFeedback = async (feedback: 'thumbs_up' | 'thumbs_down', messageIndex: number) => {
    if (!continuousImprovementSessionId) {
      await initializeContinuousImprovement();
    }
    
    // Store pending feedback and open dialog
    setPendingFeedback(feedback);
    setPendingMessageIndex(messageIndex);
    setFeedbackComment('');
    setFeedbackDialogOpen(true);
  };

  // Submit feedback with optional comment
  const submitFeedback = async () => {
    if (!continuousImprovementSessionId || !pendingFeedback || pendingMessageIndex === null) {
      return;
    }

    try {
      // Add message context to the feedback log
      await addTechnicalLog(continuousImprovementSessionId, {
        event: 'ai_response',
        aiResponse: `User feedback for message ${pendingMessageIndex}: ${pendingFeedback}${feedbackComment ? ` - Comment: ${feedbackComment}` : ''}`,
      }, currentWorkspace);
      
      await setUserFeedback(continuousImprovementSessionId, pendingFeedback, feedbackComment || undefined, currentWorkspace);
      
      setFeedbackDialogOpen(false);
      setPendingFeedback(null);
      setPendingMessageIndex(null);
      setFeedbackComment('');
      
      toast.success(pendingFeedback === 'thumbs_up' ? '👍 Thanks for the positive feedback!' : '👎 Thanks for the feedback - we\'ll improve!');
    } catch (error) {
      console.error('Failed to save feedback:', error);
      toast.error('Failed to save feedback');
    }
  };

  // Cancel feedback dialog
  const cancelFeedback = () => {
    setFeedbackDialogOpen(false);
    setPendingFeedback(null);
    setPendingMessageIndex(null);
    setFeedbackComment('');
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-black text-white p-8 text-center relative">
        {/* User info top left */}
        {user && (
          <div className="absolute top-4 left-4 text-sm text-gray-300">
            <span className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-400 rounded-full"></div>
              Kirjautunut käyttäjänä: <span className="text-white font-medium">{user.email}</span>
            </span>
          </div>
        )}
        
        {/* Action buttons top right */}
        {!hideNavigation && (
          <div className="absolute top-4 right-4 flex gap-2">
            <Button
              variant="ghost"
              onClick={handleOpenAdmin}
              className="text-white hover:bg-white/20"
            >
              <Settings className="h-4 w-4 mr-2" />
              Admin
            </Button>
            {onLogout && (
              <Button
                variant="ghost"
                onClick={onLogout}
                className="text-white hover:bg-white/20"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            )}
          </div>
        )}
        <div className="flex items-center justify-center mb-4">
          <Bot className="h-8 w-8 mr-3" />
          <h1 className="text-3xl font-bold">
            {currentWorkspace === 'purchaser' 
              ? 'Propertius Hankinta-AI' 
              : 'Propertius Laskutus-AI'
            }
          </h1>
        </div>
        <p className="text-gray-300 text-lg max-w-4xl mx-auto">
          Tutustu Propertiukseen – tekoälyavustajasi korkeatasoista kiinteistönhallintaa varten. 
          {currentWorkspace === 'purchaser' 
            ? ' Edistynyt hankintojen optimointi, toimittaja-äly ja kustannushallinta.'
            : ' Älykäs laskutusautomaatio, maksuseuranta ja talousoperaatiot.'
          }
        </p>
      </div>

      {/* Action Buttons */}
      <div className="bg-white border-b p-4">
        <div className="flex gap-3 justify-center">
          <Button 
            variant="outline" 
            onClick={handleResetChat}
            className="text-red-600 border-red-200 hover:bg-red-50"
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Nollaa keskustelu
          </Button>
          <Button 
            variant="outline" 
            onClick={handleAttachDocuments}
            className="text-gray-700 border-gray-300 hover:bg-gray-100"
          >
            <Paperclip className="mr-2 h-4 w-4" />
            Lataa dokumentteja
          </Button>
        </div>
      </div>

      {/* Quick Action Pills */}
      <div className="bg-white border-b p-6">
        <div className="flex flex-wrap gap-3 justify-center max-w-4xl mx-auto">
          {quickActions.map((action, index) => (
            <Button
              key={index}
              variant="outline"
              className="rounded-full px-6 py-2 text-sm bg-white border-gray-300 text-gray-700 hover:bg-gray-100"
              onClick={() => handleQuickAction(action)}
            >
              {action}
            </Button>
          ))}
        </div>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="max-w-6xl mx-auto space-y-6">
          {sessionInitializing && (
            <div className="flex justify-start">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                  <Bot className="h-5 w-5 text-gray-700" />
                </div>
                <div className="bg-white shadow-sm border rounded-2xl px-6 py-4 flex items-center space-x-2">
                  <Loader2 className="h-4 w-4 animate-spin text-gray-700" />
                  <span className="text-sm text-gray-600">Initializing AI with your knowledge base...</span>
                </div>
              </div>
            </div>
          )}
          
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className="flex items-start space-x-3 max-w-5xl w-full">
                {message.role === 'model' && (
                  <div className="flex-shrink-0 w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                    <Bot className="h-5 w-5 text-gray-700" />
                  </div>
                )}
                <div className="flex flex-col space-y-2 flex-1">
                  <div
                    className={`px-6 py-4 rounded-2xl ${
                      message.role === 'user'
                        ? 'bg-black text-white ml-auto max-w-lg'
                        : 'bg-white shadow-sm border'
                    }`}
                  >
                    {message.parts.map((part, partIndex) => (
                      <div key={partIndex}>
                        {part.text && (
                          <div className={`prose ${message.role === 'user' ? 'prose-invert' : ''} prose-sm max-w-none prose-table`}>
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              components={{
                                table: ({ children }) => (
                                  <div className="overflow-x-auto my-8 rounded-xl shadow-xl border border-gray-200 bg-white">
                                    <table className="min-w-full table-auto">
                                      {children}
                                    </table>
                                  </div>
                                ),
                                thead: ({ children }) => (
                                  <thead className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
                                    {children}
                                  </thead>
                                ),
                                tbody: ({ children }) => (
                                  <tbody className="divide-y divide-gray-100 bg-white">
                                    {children}
                                  </tbody>
                                ),
                                tr: ({ children, ...props }) => {
                                  // Check if this is a header row or data row
                                  const isHeaderRow = props.node?.tagName === 'tr' && props.node?.parentNode?.tagName === 'thead';
                                  return (
                                    <tr className={isHeaderRow ? "" : "hover:bg-blue-25 hover:shadow-sm transition-all duration-200"}>
                                      {children}
                                    </tr>
                                  );
                                },
                                th: ({ children }) => (
                                  <th className="px-8 py-5 text-left text-sm font-bold text-white uppercase tracking-wider">
                                    {children}
                                  </th>
                                ),
                                td: ({ children }) => (
                                  <td className="px-8 py-5 text-sm text-gray-800 leading-relaxed">
                                    <div className="max-w-md">
                                      {children}
                                    </div>
                                  </td>
                                )
                              }}
                            >
                              {(() => {
                                const { originalText, formattedSources } = processTextWithCitations(
                                  part.text,
                                  message.citationMetadata?.citationSources
                                );
                                return originalText + (formattedSources.length > 0 ? '\n\n**Sources:**\n' + formattedSources.join('\n') : '');
                              })()}
                            </ReactMarkdown>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  
                  {/* Feedback buttons for AI responses only */}
                  {message.role === 'model' && (
                    <div className="flex items-center space-x-2 ml-2">
                      <span className="text-xs text-gray-500">Was this helpful?</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleFeedback('thumbs_up', index)}
                        className="text-gray-500 hover:text-green-600 hover:bg-green-50 p-1 h-auto"
                        title="Good response"
                      >
                        <ThumbsUp className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleFeedback('thumbs_down', index)}
                        className="text-gray-500 hover:text-red-600 hover:bg-red-50 p-1 h-auto"
                        title="Poor response"
                      >
                        <ThumbsDown className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                  <Bot className="h-5 w-5 text-gray-700" />
                </div>
                <div className="bg-white shadow-sm border rounded-2xl px-6 py-4 flex items-center space-x-2">
                  <Loader2 className="h-4 w-4 animate-spin text-gray-700" />
                  <span className="text-sm text-gray-600">AI is thinking...</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input Area */}
      <div className="bg-white border-t p-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex space-x-4 items-end">
            <div className="flex-1">
              <Input
                ref={inputRef}
                type="text"
                placeholder="Ask about property management strategies, cost optimization, contractor management..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={isLoading}
                className="w-full h-12 px-4 text-lg border-gray-300 rounded-xl focus:ring-2 focus:ring-black focus:border-transparent"
              />
            </div>
            <Button
              onClick={() => handleSendMessage()}
              disabled={!input.trim() || isLoading}
              className="h-12 px-6 bg-black hover:bg-gray-800 text-white rounded-xl"
            >
              <Send className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Feedback Dialog */}
      <Dialog open={feedbackDialogOpen} onOpenChange={setFeedbackDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {pendingFeedback === 'thumbs_up' ? (
                <ThumbsUp className="h-5 w-5 text-green-600" />
              ) : (
                <ThumbsDown className="h-5 w-5 text-red-600" />
              )}
              {pendingFeedback === 'thumbs_up' ? 'Positive feedback' : 'Feedback for improvement'}
            </DialogTitle>
            <DialogDescription>
              {pendingFeedback === 'thumbs_up' 
                ? 'Great! What did you like about this response?' 
                : 'Help us improve! What could be better about this response?'
              }
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            
            <div className="space-y-2">
              <Label htmlFor="feedback-comment">Comment (optional)</Label>
              <Textarea
                id="feedback-comment"
                placeholder={pendingFeedback === 'thumbs_up' 
                  ? 'What worked well? Any specific aspects you found helpful?'
                  : 'What was missing or incorrect? How could we improve?'
                }
                value={feedbackComment}
                onChange={(e) => setFeedbackComment(e.target.value)}
                className="min-h-[100px]"
              />
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={cancelFeedback}
            >
              Skip
            </Button>
            <Button
              onClick={submitFeedback}
              className={pendingFeedback === 'thumbs_up' ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'}
            >
              Submit Feedback
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PropertyManagerChat;