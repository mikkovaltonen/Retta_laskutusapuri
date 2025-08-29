import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { geminiChatService, ChatMessage, ChatContext } from '../lib/geminiChatService';
import { loadLatestPrompt, saveChatSessionLog } from '../lib/firestoreService';
import { logger } from '../lib/loggingService';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Send, Bot, User, Settings, RefreshCw, ThumbsUp, ThumbsDown, Upload, RotateCcw, FileSpreadsheet, Info, CheckCircle, Download } from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';
import { ScrollArea } from './ui/scroll-area';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Textarea } from './ui/textarea';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { InteractiveTable } from './InteractiveTable';

interface ChatAIProps {
  className?: string;
  onOstolaskuExcelDataChange?: (data: any[]) => void;
}

export const ChatAI: React.FC<ChatAIProps> = ({ className, onOstolaskuExcelDataChange }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string>('');
  const [systemPrompt, setSystemPrompt] = useState<string>('');
  const [isInitialized, setIsInitialized] = useState(false);
  const [currentSessionKey, setCurrentSessionKey] = useState<string>('');
  const [messageFeedback, setMessageFeedback] = useState<Record<string, 'thumbs_up' | 'thumbs_down'>>({});
  const [ostolaskuExcelData, setOstolaskuExcelData] = useState<any[]>([]);
  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  const [uploadedWorkbook, setUploadedWorkbook] = useState<any>(null);
  const [showSheetSelector, setShowSheetSelector] = useState(false);
  const [availableSheets, setAvailableSheets] = useState<string[]>([]);
  const [selectedSheets, setSelectedSheets] = useState<string[]>([]);
  const [showInfoDialog, setShowInfoDialog] = useState(false);
  const [showNegativeFeedbackDialog, setShowNegativeFeedbackDialog] = useState(false);
  const [selectedMessageForFeedback, setSelectedMessageForFeedback] = useState<string>('');
  const [feedbackComment, setFeedbackComment] = useState<string>('');
  const [quickActionUsed, setQuickActionUsed] = useState(false);
  const [propertyManagerType, setPropertyManagerType] = useState<'hoas' | 'kontu-onni' | 'retta-management'>('retta-management');
  const [showExcelOptions, setShowExcelOptions] = useState(false);
  const { user } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Legacy error logging utility - redirects to logger service
  const logError = (context: string, error: unknown, additionalInfo?: Record<string, any>) => {
    logger.error('ChatAI', context, error instanceof Error ? error.message : String(error), {
      ...additionalInfo,
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name
      } : { message: String(error) }
    }, sessionId);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadSystemPrompt = async () => {
    if (!user) return;

    try {
      // Get the latest system prompt version
      const latestPrompt = await loadLatestPrompt(user.uid, 'invoicer');
      if (!latestPrompt) {
        // No prompt configured - show error
        setError('Järjestelmäprompti puuttuu. Pyydä ylläpitäjää määrittämään järjestelmäprompti Admin-sivulta.');
        setSystemPrompt('');
      } else {
        setSystemPrompt(latestPrompt);
      }
    } catch (err) {
      logError('SystemPromptLoad', err, { workspace: 'invoicer' });
      setError('Järjestelmän alustuksessa tapahtui virhe. Yritä päivittää sivu.');
    }
  };

  const updateWelcomeMessage = () => {
    if (!user) return;
    
    console.log('🔄 Updating welcome message with OstolaskuExcel status', {
      ostolaskuExcelDataLength: ostolaskuExcelData.length,
      uploadedFileName,
      currentMessagesCount: messages.length
    });
    
    // Create updated welcome message with current OstolaskuExcel status
    const ostolaskuExcelStatus = ostolaskuExcelData.length > 0 
      ? `\n\n✅ **OstolaskuExceldata ladattu**: ${ostolaskuExcelData.length} riviä tiedostosta "${uploadedFileName}"\n\n**Seuraava vaihe:**\n👉 Paina **"Tarkasta"** -nappia alapalkista tarkistaaksesi hinnat ja tilaukset\n\n*Botti luo TARKASTUSTAULUKON ja ehdottaa MyyntiExcelin luomista kun tiedot on tarkastettu.*`
      : '\n\n❌ **Ei OstolaskuExceldataa**: Lataa ensin OstolaskuExcel (JSON/Excel) painikkeesta yllä';
      
    const welcomeContent = `👋 Hei! Olen Retta-laskutusavustajasi.${ostolaskuExcelStatus}\n\nMiten voin auttaa?`;
      
    const welcomeMessage: ChatMessage = {
      id: 'welcome',
      role: 'assistant',
      content: welcomeContent,
      timestamp: new Date()
    };

    // Update only the welcome message, keep other messages
    setMessages(prev => {
      const updatedMessages = [...prev];
      const welcomeIndex = updatedMessages.findIndex(msg => msg.id === 'welcome');
      
      if (welcomeIndex !== -1) {
        // Update existing welcome message
        updatedMessages[welcomeIndex] = welcomeMessage;
      } else {
        // Add welcome message at the beginning if it doesn't exist
        updatedMessages.unshift(welcomeMessage);
      }
      
      return updatedMessages;
    });
    console.log('✅ Welcome message updated', {
      messageContentPreview: welcomeMessage.content.substring(0, 100) + '...'
    });
  };

  const initializeChat = async () => {
    if (!user || isInitialized) {
      logger.debug('ChatAI', 'initializeChat', 'Skipping initialization', { 
        hasUser: !!user, 
        isInitialized 
      });
      return;
    }

    // Don't initialize if no system prompt
    if (!systemPrompt) {
      logger.warn('ChatAI', 'initializeChat', 'No system prompt configured');
      return;
    }

    const newSessionId = `session_${user.uid}_${Date.now()}`;
    logger.info('ChatAI', 'initializeChat', 'Starting chat initialization', { userId: user.uid, sessionId: newSessionId });
    
    // Start logging session
    logger.startSession(newSessionId);

    try {
      setLoading(true);
      setError(null);
      
      const context: ChatContext = {
        userId: user.uid,
        systemPrompt,
        sessionId: newSessionId,
        ostolaskuExcelData: ostolaskuExcelData.length > 0 ? ostolaskuExcelData : undefined
      };

      logger.debug('ChatAI', 'initializeChat', 'Calling geminiChatService', null, newSessionId);
      await geminiChatService.initializeSession(context);
      setSessionId(newSessionId);
      setIsInitialized(true);
      logger.info('ChatAI', 'initializeChat', 'Chat session initialized', null, newSessionId);

      // Use session ID as session key directly
      setCurrentSessionKey(newSessionId);
      logger.info('ChatAI', 'initializeChat', 'Session key set', { sessionKey: newSessionId }, newSessionId);

      // Add welcome message with OstolaskuExcel status
      const ostolaskuExcelStatus = ostolaskuExcelData.length > 0 
        ? `\n\n✅ **OstolaskuExceldata ladattu**: ${ostolaskuExcelData.length} riviä tiedostosta "${uploadedFileName}"\n\n**Seuraava vaihe:**\n👉 Paina **"Tarkasta"** -nappia alapalkista tarkistaaksesi hinnat ja tilaukset\n\n*Botti luo TARKASTUSTAULUKON ja ehdottaa MyyntiExcelin luomista kun tiedot on tarkastettu.*`
        : '\n\n❌ **Ei OstolaskuExceldataa**: Lataa ensin OstolaskuExcel (JSON/Excel) painikkeesta yllä';
        
      const welcomeContent = `👋 Hei! Olen Retta-laskutusavustajasi.${ostolaskuExcelStatus}\n\nMiten voin auttaa?`;
        
      const welcomeMessage: ChatMessage = {
        id: 'welcome',
        role: 'assistant',
        content: welcomeContent,
        timestamp: new Date()
      };

      setMessages([welcomeMessage]);
      console.log('✅ Chat initialization complete');
    } catch (err) {
      logError('ChatInitialization', err, { 
        hasSystemPrompt: !!systemPrompt,
        sessionId: sessionId 
      });
      setError(err instanceof Error ? err.message : 'Failed to initialize chat');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadSystemPrompt();
    }
  }, [user]);

  useEffect(() => {
    if (systemPrompt && user && !isInitialized) {
      initializeChat();
    }
  }, [systemPrompt, user, isInitialized]);

  // Removed useEffect to prevent double loading

  const handleQuickAction = async (message: string) => {
    if (!message || loading || !sessionId || !user) return;
    
    // Mark quick action as used
    setQuickActionUsed(true);
    
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: message,
      timestamp: new Date()
    };

    logger.debug('ChatAI', 'handleQuickAction', 'Quick action used', { message }, sessionId);
    setMessages(prev => [...prev, userMessage]);
    setLoading(true);
    setError(null);

    try {
      logger.debug('ChatAI', 'handleQuickAction', 'Sending to Gemini', null, sessionId);
      const response = await geminiChatService.sendMessage(sessionId, message, user.uid, ostolaskuExcelData);
      logger.debug('ChatAI', 'handleQuickAction', 'Response received', { responseLength: response.content.length }, sessionId);
      setMessages(prev => [...prev, response]);
    } catch (err) {
      logError('QuickActionSend', err, { message });
      setError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setLoading(false);
    }
  };

  const sendMessageWithText = async (messageText: string) => {
    if (!messageText.trim() || !sessionId || !user || loading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: messageText,
      timestamp: new Date()
    };

    // Log debug info for very short messages
    if (userMessage.content.trim().length < 5) {
      logger.debug('ChatAI', 'sendMessage', 'Short user message', { message: userMessage.content }, sessionId);
    }
    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setLoading(true);
    setError(null);

    try {
      const response = await geminiChatService.sendMessage(sessionId, messageText, user.uid, ostolaskuExcelData);
      
      // Log if response is empty or very short (critical issue)
      if (!response.content || response.content.trim().length < 10) {
        logger.error('ChatAI', 'sendMessage', 'Empty or very short response received', { 
          responseLength: response.content?.length || 0,
          content: response.content,
          messageId: response.id
        }, sessionId);
      }
      setMessages(prev => [...prev, response]);
    } catch (err) {
      logError('SendMessage', err, { 
        messageLength: messageText.length,
        hasOstolaskuExcelData: ostolaskuExcelData.length > 0,
        sessionId 
      });
      setError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim()) return;
    await sendMessageWithText(inputMessage);
  };

  const resetChat = () => {
    // Clear all chat data including OstolaskuExcel
    if (sessionId) {
      geminiChatService.clearSession(sessionId);
    }
    setMessages([]);
    setSessionId('');
    setIsInitialized(false);
    setError(null);
    setMessageFeedback({});
    setCurrentSessionKey('');
    setQuickActionUsed(false); // Reset quick action state
    
    // Clear OstolaskuExcel data
    setOstolaskuExcelData([]);
    setUploadedFileName('');
    
    // Clear Excel upload states
    setUploadedWorkbook(null);
    setAvailableSheets([]);
    setShowSheetSelector(false);
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    
    // Notify parent component about cleared data
    if (onOstolaskuExcelDataChange) {
      onOstolaskuExcelDataChange([]);
    }
    
    // Reinitialize fresh chat
    if (user && systemPrompt) {
      initializeChat();
    }
    
    console.log('🔄 Chat reset: All data cleared and reinitialized');
  };

  const handleFeedback = async (messageId: string, feedback: 'thumbs_up' | 'thumbs_down') => {
    if (!sessionId) {
      logger.warn('ChatAI', 'handleFeedback', 'No session available for feedback');
      return;
    }

    // For negative feedback, open dialog to collect detailed feedback
    if (feedback === 'thumbs_down') {
      setSelectedMessageForFeedback(messageId);
      setShowNegativeFeedbackDialog(true);
      return;
    }

    // For positive feedback, save immediately
    try {
      // Update local state immediately for UI feedback
      setMessageFeedback(prev => ({
        ...prev,
        [messageId]: feedback
      }));

      // Prepare and save complete session log
      const sessionLog = logger.prepareChatSessionLog(
        sessionId,
        messages,
        systemPrompt,
        uploadedFileName,
        ostolaskuExcelData
      );

      // Add user feedback
      const logWithFeedback = logger.addUserFeedback(sessionLog, feedback);

      // Save to database
      const docId = await saveChatSessionLog(logWithFeedback, 'invoicer');
      
      if (docId) {
        logger.info('ChatAI', 'handleFeedback', 'Positive feedback saved', { 
          messageId, 
          docId 
        }, sessionId);
        toast.success('Kiitos palautteesta! 👍');
      }
    } catch (error) {
      logger.error('ChatAI', 'handleFeedback', 'Failed to save feedback', { 
        messageId, 
        feedback,
        error 
      }, sessionId);
      
      // Revert local state on error
      setMessageFeedback(prev => {
        const newState = { ...prev };
        delete newState[messageId];
        return newState;
      });
      
      setError('Palautteen tallentaminen epäonnistui');
    }
  };

  const handleNegativeFeedbackSubmit = async () => {
    if (!selectedMessageForFeedback || !sessionId) {
      return;
    }

    try {
      // Update local state immediately for UI feedback
      setMessageFeedback(prev => ({
        ...prev,
        [selectedMessageForFeedback]: 'thumbs_down'
      }));

      // Prepare complete session log with all data
      const sessionLog = logger.prepareChatSessionLog(
        sessionId,
        messages,
        systemPrompt,
        uploadedFileName,
        ostolaskuExcelData
      );

      // Add user feedback with comment
      const logWithFeedback = logger.addUserFeedback(
        sessionLog, 
        'thumbs_down', 
        feedbackComment
      );

      // Save comprehensive log to database
      const docId = await saveChatSessionLog(logWithFeedback, 'invoicer');

      if (docId) {
        logger.info('ChatAI', 'handleNegativeFeedbackSubmit', 'Negative feedback saved with comment', {
          messageId: selectedMessageForFeedback,
          commentLength: feedbackComment.length,
          docId
        }, sessionId);
        
        toast.success('Palaute tallennettu. Kiitos arvokkaasta palautteesta! 🙏');
      }

      // Close dialog and reset state
      setShowNegativeFeedbackDialog(false);
      setSelectedMessageForFeedback('');
      setFeedbackComment('');

    } catch (error) {
      logger.error('ChatAI', 'handleNegativeFeedbackSubmit', 'Failed to save negative feedback', {
        messageId: selectedMessageForFeedback,
        commentLength: feedbackComment.length,
        error
      }, sessionId);
      
      // Revert local state on error
      setMessageFeedback(prev => {
        const newState = { ...prev };
        delete newState[selectedMessageForFeedback];
        return newState;
      });
      
      setError('Palautteen tallentaminen epäonnistui');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };


  const generateMyyntiExcelFromTarkastustaulukko = async () => {
    console.log('🔍 Scanning chat history for TARKASTUSTAULUKKO...');
    console.log('📊 Using property manager type:', propertyManagerType);
    
    // Find messages containing TARKASTUSTAULUKKO (case insensitive)
    let tarkastustaulukkoData: any[] = [];
    
    for (const message of messages) {
      if (message.role === 'assistant' && message.content.toLowerCase().includes('tarkastustaulukko')) {
        console.log('✅ Found TARKASTUSTAULUKKO in message:', message.id);
        
        // Find the table after "Tarkastustaulukko" heading
        const tarkastusIndex = message.content.toLowerCase().indexOf('tarkastustaulukko');
        const contentAfterHeading = message.content.substring(tarkastusIndex);
        
        // Extract all table rows
        const tableLines = contentAfterHeading.split('\n').filter(line => line.includes('|'));
        
        if (tableLines.length > 2) {
          console.log(`📊 Found ${tableLines.length} table lines`);
          
          // TARKASTUSTAULUKKO has a fixed column structure:
          // | Tampuuri | RP-numero | Tuote | O.hinta (o) | O.hinta (h) | M.hinta (o) | M.hinta (h) | M.hinta (t) | Tarkastus | A-hinta | Määrä | Yksikkö | ALV-koodi |
          // Columns:  0     1           2        3            4              5             6             7             8           9         10      11        12         13
          // Note: Column 0 is empty due to leading |, so actual data starts at index 1
          const tampuuriIdx = 1;  // Tampuuri → Asiakasnumero
          const rpNumeroIdx = 2;  // RP-numero → Tilausnumero
          const tuoteIdx = 3;     // Tuote → Kuvaus
          const aHintaIdx = 10;   // A-hinta → ahinta
          const maaraIdx = 11;    // Määrä → määrä
          const yksikkoIdx = 12;  // Yksikkö → yksikkö
          const alvKoodiIdx = 13; // ALV-koodi → alvkoodi
          
          console.log('Using fixed column indices for TARKASTUSTAULUKKO:', {
            tampuuri: tampuuriIdx,
            rpNumero: rpNumeroIdx,
            tuote: tuoteIdx,
            aHinta: aHintaIdx,
            maara: maaraIdx,
            yksikko: yksikkoIdx,
            alvKoodi: alvKoodiIdx
          });
          
          // Skip header and separator lines, process data lines
          let skippedRows = 0;
          let processedRows = 0;
          
          for (let i = 2; i < tableLines.length; i++) {
            const line = tableLines[i];
            if (!line.trim() || line.includes('|:---')) {
              console.log(`Skipping row ${i}: separator line`);
              skippedRows++;
              continue;
            }
            
            const cells = line.split('|').map(cell => cell.trim());
            
            // Skip if not enough cells
            if (cells.length < Math.max(tampuuriIdx, rpNumeroIdx, tuoteIdx, aHintaIdx, maaraIdx, yksikkoIdx, alvKoodiIdx)) {
              console.log(`Skipping row ${i}: not enough cells (${cells.length})`);
              skippedRows++;
              continue;
            }
            
            // Extract data based on column positions
            const tampuuri = cells[tampuuriIdx] || '';
            let rpNumero = cells[rpNumeroIdx] || '';
            // Clean up RP-numero - replace dashes with empty string
            if (rpNumero.includes('---')) {
              rpNumero = '';
            }
            const tuote = cells[tuoteIdx] || '';
            const aHintaStr = cells[aHintaIdx] || '0';
            const maaraStr = cells[maaraIdx] || '1';
            const yksikko = cells[yksikkoIdx] || 'kpl';
            const alvKoodi = cells[alvKoodiIdx] || '24';
            
            // Parse numbers
            const aHinta = parseFloat(aHintaStr.replace(',', '.').replace('€', '').trim()) || 0;
            const maara = parseFloat(maaraStr.replace(',', '.')) || 1;
            
            // Skip rows with no valid data (must have tampuuri and valid price)
            if (!tampuuri || aHinta === 0) {
              console.log(`Skipping row ${i}: Missing tampuuri="${tampuuri}" or price="${aHinta}"`);
              skippedRows++;
              continue;
            }
            
            // Map TARKASTUSTAULUKKO fields to MyyntiExcel format
            const row = {
              asiakasnumero: tampuuri, // Tampuuri as Asiakasnumero
              reskontra: 'MK', // Fixed value
              tuotekoodi: '', // Empty as specified
              määrä: maara,
              ahinta: aHinta,
              yhteensä: maara * aHinta, // Calculate total
              kuvaus: tuote, // Product description
              yksikkö: yksikko,
              tuotenimi: '', // Empty as specified
              alvkoodi: alvKoodi.replace('%', '').trim(), // Remove % sign if present
              isännöitsijä: '', // Empty
              kustannuspaikka: '', // Empty
              tilausnumero: rpNumero // RP-numero
            };
            
            tarkastustaulukkoData.push(row);
            processedRows++;
            console.log(`Row ${i-1}: Tampuuri=${tampuuri}, Tuote=${tuote.substring(0,30)}..., A-hinta=${aHinta}, Määrä=${maara}`);
          }
          
          console.log(`📊 Processing summary: ${processedRows} processed, ${skippedRows} skipped out of ${tableLines.length-2} data lines`);
          
          // Only use the first table found
          break;
        }
      }
    }
    
    if (tarkastustaulukkoData.length === 0) {
      toast.error('TARKASTUSTAULUKKOA ei löytynyt keskusteluhistoriasta');
      return;
    }
    
    console.log(`📊 Extracted ${tarkastustaulukkoData.length} rows from TARKASTUSTAULUKKO`);
    
    // Create Excel workbook
    const wb = XLSX.utils.book_new();
    
    // Define column structures based on property manager type
    let wsData: any[][] = [];
    
    if (propertyManagerType === 'hoas') {
      // HOAS structure - 15 columns
      wsData = [
        // Header row
        ['KP', 'Asiakasnumero /Tampuuri nro', 'Laskutettava yhtiö', 'Kohde', 'Reskontra', 
         'Tuotekoodi', 'määrä', 'ahinta alv 0%', 'Kuvaus', 'yksikkö, kpl', 'alvkoodi', 
         'Laskutusaikataulu', 'Verkkolaskuosoite', 'Operaattoritunnus', 'Välittäjä'],
        // Data rows
        ...tarkastustaulukkoData.map(row => [
          720, // Fixed KP value for HOAS
          row.asiakasnumero,
          'Helsingin seudun opiskelija-asuntosäätiö sr', // Fixed for HOAS
          `HOAS ${row.kuvaus}`, // Kohde
          'MM', // Fixed reskontra for HOAS
          1571, // Fixed product code for HOAS
          row.määrä,
          row.ahinta,
          row.kuvaus,
          row.määrä,
          '255SN', // Fixed ALV code for HOAS
          '', // Laskutusaikataulu
          3701011385, // Fixed for HOAS
          'TE003701165149HOAS', // Fixed for HOAS
          'TietoEVRY Oyj' // Fixed for HOAS
        ])
      ];
    } else if (propertyManagerType === 'kontu-onni') {
      // Kontu & Onni structure - 9 columns
      wsData = [
        // Header row
        ['Yhtiö', 'Tuote', 'Määrä', 'alv 0%', 'alv 25,5%', 'Selite', 
         'Työnumero (Safetumin käyttöön)', 'Isännöitsijä', 'Huomautukset'],
        // Data rows
        ...tarkastustaulukkoData.map(row => [
          `Asunto Oy ${row.asiakasnumero}`, // Yhtiö
          row.kuvaus, // Tuote
          row.määrä,
          row.ahinta, // alv 0%
          row.ahinta * 1.255, // alv 25,5% (calculated)
          row.kuvaus, // Selite
          row.tilausnumero || '', // Työnumero
          'Kontu', // Default to Kontu, user can edit later
          '' // Huomautukset
        ])
      ];
    } else {
      // Retta Management structure - 17 columns (default)
      wsData = [
        // Header row
        ['asiakasnumero (kuvaus)', 'reskontra', 'tuotekoodi', 'määrä', 'ahinta', 
         'kuvaus', 'yksikkö', 'tuotenimi', 'alvkoodi', 'Isännöitsijä', 
         'Kustannuspaikka', 'Tilausnumero (kuvaus)', 'Yhteensä', 'Kohde (kuvaus)', 
         'Verkkolaskuosoite', 'Operaatiotunnus', 'Välittäjä'],
        // Data rows
        ...tarkastustaulukkoData.map(row => [
          row.asiakasnumero,
          'MK', // Fixed reskontra for Retta Management
          1578, // Default product code for Retta Management
          row.määrä,
          row.ahinta,
          row.kuvaus,
          row.yksikkö,
          '', // tuotenimi
          '255SN', // Default ALV code
          '', // Isännöitsijä
          '', // Kustannuspaikka
          row.tilausnumero,
          row.määrä * row.ahinta, // Yhteensä (calculated)
          row.kuvaus, // Kohde (kuvaus)
          row.asiakasnumero, // Use customer number as invoice address
          'E204503', // Default operator code
          'OpusCapita Solutions Oy' // Default välittäjä
        ])
      ];
    }
    
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    
    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'MyyntiExcel');
    
    // Generate Excel file with property manager type in filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    const managerTypeLabel = propertyManagerType === 'hoas' ? 'HOAS' : 
                            propertyManagerType === 'kontu-onni' ? 'KontuOnni' : 
                            'RettaManagement';
    const filename = `MyyntiExcel_${managerTypeLabel}_${timestamp}.xlsx`;
    
    // Try to use File System Access API if available (Chrome, Edge)
    if ('showSaveFilePicker' in window) {
      try {
        // Show save dialog where user can choose location
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: filename,
          types: [{
            description: 'Excel Files',
            accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] }
          }]
        });
        
        // Write file to chosen location
        const writable = await handle.createWritable();
        const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
        await writable.write(buffer);
        await writable.close();
        
        const typeText = propertyManagerType === 'hoas' ? 'HOAS' : 
                        propertyManagerType === 'kontu-onni' ? 'Kontu & Onni' : 
                        'Retta Management';
        toast.success(`MyyntiExcel (${typeText}) tallennettu: ${tarkastustaulukkoData.length} riviä`);
        console.log(`✅ MyyntiExcel saved to chosen location: ${filename}`);
      } catch (err) {
        // User cancelled or error occurred, fall back to regular download
        if ((err as any)?.name !== 'AbortError') {
          console.error('Save dialog error:', err);
        }
        // Fall back to regular download
        XLSX.writeFile(wb, filename);
        const typeText = propertyManagerType === 'hoas' ? 'HOAS' : 
                        propertyManagerType === 'kontu-onni' ? 'Kontu & Onni' : 
                        'Retta Management';
        toast.success(`MyyntiExcel (${typeText}) ladattu: ${tarkastustaulukkoData.length} riviä`);
      }
    } else {
      // Browser doesn't support File System Access API, use regular download
      XLSX.writeFile(wb, filename);
      const typeText = propertyManagerType === 'hoas' ? 'HOAS' : 
                      propertyManagerType === 'kontu-onni' ? 'Kontu & Onni' : 
                      'Retta Management';
      toast.info(`MyyntiExcel (${typeText}) ladattu Downloads-kansioon: ${tarkastustaulukkoData.length} riviä`);
    }
    
    console.log(`✅ MyyntiExcel processed: ${filename}`);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    // Support multiple files
    const allData: any[] = [];
    const fileNames: string[] = [];

    try {
      // Process each file
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Validate file type - only Excel allowed
        const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
        
        if (!isExcel) {
          toast.error(`Tiedosto ${file.name} ohitettu - vain Excel-tiedostot sallittuja`);
          continue;
        }
        
        fileNames.push(file.name);
        let jsonData: any[];
        // Handle Excel file
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        
        if (workbook.SheetNames.length === 0) {
          toast.error(`${file.name}: Excel-tiedostossa ei ole yhtään välilehteä`);
          continue;
        }
        
        // If multiple sheets, show selector (only for single file mode)
        if (workbook.SheetNames.length > 1 && files.length === 1) {
          setUploadedWorkbook(workbook);
          setAvailableSheets(workbook.SheetNames);
          setUploadedFileName(file.name);
          setSelectedSheets([]); // Reset selected sheets
          setShowSheetSelector(true);
          return;
        }
        
        // Single sheet or multiple files mode - process first sheet directly
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        jsonData = XLSX.utils.sheet_to_json(worksheet);
        
        if (jsonData.length === 0) {
          toast.warn(`${file.name}: Tyhjä tiedosto ohitettu`);
          continue;
        }
        
        toast.success(`Ladattu ${jsonData.length} riviä: ${file.name} (${sheetName})`);
      
      // Add to combined data
      allData.push(...jsonData);
    } // End of for loop

      // Check if we got any data
      if (allData.length === 0) {
        setError('Ei ladattavia tietoja valituissa tiedostoissa');
        return;
      }
      
      // Calculate final combined data
      let finalData: any[];
      if (ostolaskuExcelData && ostolaskuExcelData.length > 0) {
        finalData = [...ostolaskuExcelData, ...allData];
        toast.info(`Lisätty ${allData.length} riviä (yhteensä ${finalData.length} riviä)`);
      } else {
        finalData = allData;
      }
      
      // Update state with combined data
      setOstolaskuExcelData(finalData);
      setUploadedFileName(fileNames.join(', '));
      setError(null);
      
      console.log('✅ OstolaskuExcel uploaded:', {
        fileNames: fileNames,
        totalRecords: finalData.length,
        fileCount: fileNames.length
      });

      // Add a success message and re-initialize session with OstolaskuExcel data
      if (user && systemPrompt && finalData.length > 0) {
        console.log('🔄 Re-initializing chat with OstolaskuExcel data...');
        
        // Add a success message about loaded OstolaskuExcel
        const successMessage: ChatMessage = {
          id: `OstolaskuExcel-loaded-${Date.now()}`,
          role: 'assistant',
          content: `✅ **OstolaskuExcel ladattu onnistuneesti!**\n\n📄 Tiedostot: ${fileNames.length} kpl\n📊 Rivejä yhteensä: ${finalData.length}\n📁 Ladatut: ${fileNames.join(', ')}\n\n**Lataus onnistui, voit painaa Tarkasta nappia hintojen ja tilausten tarkastamiseksi**`,
          timestamp: new Date()
        };
        
        setMessages(prev => [...prev, successMessage]);
        
        // Re-initialize session with OstolaskuExcel data
        const newSessionId = `session_${user.uid}_${Date.now()}`;
        
        const context: ChatContext = {
          userId: user.uid,
          systemPrompt,
          sessionId: newSessionId,
          ostolaskuExcelData: finalData
        };

        try {
          await geminiChatService.initializeSession(context);
          setSessionId(newSessionId);
          console.log('✅ Chat re-initialized with OstolaskuExcel data');
        } catch (err) {
          console.error('❌ Failed to re-initialize chat:', err);
        }
      }
      
    } catch (err) {
      console.error('❌ File parsing failed:', err);
      setError('Virheellinen tiedosto. Tarkista tiedoston muoto.');
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const triggerFileUpload = () => {
    fileInputRef.current?.click();
  };

  const handleMultipleSheetsSelection = async () => {
    if (!uploadedWorkbook || selectedSheets.length === 0) return;

    try {
      const allData: any[] = [];
      
      // Process each selected sheet
      for (const sheetName of selectedSheets) {
        const worksheet = uploadedWorkbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        
        if (jsonData.length > 0) {
          allData.push(...jsonData);
          toast.success(`Ladattu ${jsonData.length} riviä välilehdeltä "${sheetName}"`);
          
          // Log verification table fields for first row of each sheet
          const firstRow = jsonData[0];
          console.log(`📊 Välilehti "${sheetName}" kentät:`, {
            tampuuri: firstRow['tampuuri'] || firstRow['Tampuurinumero'] || 'EI LÖYDY',
            rpNumero: firstRow['RP-numero'] || firstRow['OrderNumber'] || 'EI LÖYDY',
            availableFields: Object.keys(firstRow).slice(0, 10)
          });
        } else {
          toast.warn(`Välilehti "${sheetName}" on tyhjä, ohitettu`);
        }
      }
      
      if (allData.length === 0) {
        setError('Valituissa välilehdissä ei ole dataa');
        return;
      }
      
      // Calculate combined data with existing data
      let combinedData: any[];
      if (ostolaskuExcelData && ostolaskuExcelData.length > 0) {
        combinedData = [...ostolaskuExcelData, ...allData];
        toast.info(`Lisätty yhteensä ${allData.length} riviä ${selectedSheets.length} välilehdeltä (kokonaismäärä: ${combinedData.length} riviä)`);
      } else {
        combinedData = allData;
        toast.success(`Ladattu yhteensä ${allData.length} riviä ${selectedSheets.length} välilehdeltä`);
      }
      
      // Update state
      setOstolaskuExcelData(combinedData);
      setUploadedFileName(`${uploadedFileName} (${selectedSheets.length} välilehteä)`);
      
      // Notify parent component
      if (onOstolaskuExcelDataChange) {
        onOstolaskuExcelDataChange(combinedData);
      }
      
      setError(null);
      setShowSheetSelector(false);
      setSelectedSheets([]);
      
      console.log('✅ Multiple sheets loaded:', {
        fileName: uploadedFileName,
        sheetsLoaded: selectedSheets,
        totalRecords: combinedData.length
      });
      
      // Re-initialize chat session with combined data
      if (user && systemPrompt && combinedData.length > 0) {
        console.log('🔄 Re-initializing chat with combined Excel data...');
        
        const successMessage: ChatMessage = {
          id: `OstolaskuExcel-loaded-${Date.now()}`,
          role: 'assistant',
          content: `✅ **Excel-välilehdet ladattu onnistuneesti!**\n\n📄 Tiedosto: "${uploadedFileName}"\n📊 Välilehdet: ${selectedSheets.join(', ')}\n📈 Rivejä yhteensä: ${combinedData.length}\n\n**Lataus onnistui, voit painaa Tarkasta nappia hintojen ja tilausten tarkastamiseksi**`,
          timestamp: new Date()
        };
        
        setMessages(prev => [...prev, successMessage]);
        
        const newSessionId = `session_${user.uid}_${Date.now()}`;
        const context: ChatContext = {
          userId: user.uid,
          systemPrompt,
          sessionId: newSessionId,
          ostolaskuExcelData: combinedData
        };
        
        try {
          await geminiChatService.initializeSession(context);
          setSessionId(newSessionId);
          console.log('✅ Chat re-initialized with multi-sheet data');
        } catch (err) {
          console.error('❌ Failed to re-initialize chat:', err);
        }
      }
      
    } catch (err) {
      console.error('❌ Multi-sheet processing failed:', err);
      setError('Välilehtien käsittely epäonnistui');
    } finally {
      // Clean up
      setUploadedWorkbook(null);
      setAvailableSheets([]);
    }
  };

  const handleSheetSelection = async (sheetName: string) => {
    if (!uploadedWorkbook) return;

    try {
      const worksheet = uploadedWorkbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);
      
      if (jsonData.length === 0) {
        setError('Valittu välilehti on tyhjä');
        return;
      }

      // Calculate combined data
      let combinedData: any[];
      if (ostolaskuExcelData && ostolaskuExcelData.length > 0) {
        combinedData = [...ostolaskuExcelData, ...jsonData];
        toast.info(`Välilehti lisätty: ${jsonData.length} riviä (yhteensä ${combinedData.length} riviä)`);
      } else {
        combinedData = jsonData;
        toast.success(`Ladattu ${jsonData.length} riviä välilehdeltä "${sheetName}"`);
      }
      
      // Update state with combined data
      setOstolaskuExcelData(combinedData);
      
      // Notify parent component about data change
      if (onOstolaskuExcelDataChange) {
        onOstolaskuExcelDataChange(combinedData);
      }
      
      setError(null);
      setShowSheetSelector(false);
      
      // Success toast moved to setOstolaskuExcelData callback
      
      console.log('✅ OstolaskuExcel sheet selected:', {
        fileName: uploadedFileName,
        sheetName,
        recordCount: jsonData.length
      });
      
      // Log verification table fields for debugging
      if (jsonData.length > 0) {
        const firstRow = jsonData[0];
        console.log('📊 Tarkastustaulukon kentät ensimmäisessä rivissä:', {
          tampuuri: firstRow['tampuuri'] || firstRow['Tampuurinumero'] || 'EI LÖYDY',
          rpNumero: firstRow['RP-numero'] || firstRow['OrderNumber'] || 'EI LÖYDY',
          kohde: firstRow['Kohde'] || firstRow['Kohteen nimi'] || 'EI LÖYDY',
          tuote: firstRow['Tuote'] || firstRow['Tuotekuvaus'] || 'EI LÖYDY',
          ostohinta: firstRow['á hinta alv 0 %'] || firstRow['Laskutus Rettalle / vuosi'] || 'EI LÖYDY',
          asiakashinta: firstRow['Retta asiakashinta vuosittain'] || 'EI LÖYDY',
          kohteenTampuuriID: firstRow['Kohteen tampuuri ID'] || 'EI LÖYDY',
          availableFields: Object.keys(firstRow)
        });
      }

      // Add a success message and re-initialize session with OstolaskuExcel data
      if (user && systemPrompt) {
        console.log('🔄 Re-initializing chat with OstolaskuExcel data...');
        
        // Add a success message about loaded OstolaskuExcel
        const successMessage: ChatMessage = {
          id: `OstolaskuExcel-loaded-${Date.now()}`,
          role: 'assistant',
          content: `✅ **OstolaskuExcel-välilehti lisätty!**\n\n📄 Tiedosto: "${uploadedFileName || 'OstolaskuExcel.xlsx'}"\n📈 Välilehti: "${sheetName}"\n📊 Lisätty ${jsonData.length} riviä\n\n**Lataus onnistui, voit painaa Tarkasta nappia hintojen ja tilausten tarkastamiseksi**`,
          timestamp: new Date()
        };
        
        setMessages(prev => [...prev, successMessage]);
        
        // Re-initialize session with OstolaskuExcel data
        const newSessionId = `session_${user.uid}_${Date.now()}`;
        
        // Use the combined data we just calculated
        const context: ChatContext = {
          userId: user.uid,
          systemPrompt,
          sessionId: newSessionId,
          ostolaskuExcelData: combinedData && combinedData.length > 0 ? combinedData : undefined
        };

        try {
          await geminiChatService.initializeSession(context);
          setSessionId(newSessionId);
          console.log('✅ Chat re-initialized with OstolaskuExcel data');
        } catch (err) {
          console.error('❌ Failed to re-initialize chat:', err);
        }
      }
      
    } catch (err) {
      console.error('❌ Sheet processing failed:', err);
      setError('Välilehden käsittely epäonnistui');
    }
  };


  return (
    <div className={`flex flex-col h-full overflow-hidden ${className}`}>
      {/* Header */}
      <div className="flex justify-between items-center p-4 border-b">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5" />
          <span className="font-medium">Retta AI Assistant</span>
        </div>
        <div className="flex gap-2">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={triggerFileUpload}
              disabled={loading}
              title="Lataa edelleen laskutettava OstolaskuExcel (JSON tai Excel)"
              className="flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              <span className="hidden sm:inline">Lataa OstolaskuExcel</span>
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowInfoDialog(true)}
              title="Näytä tuettu OstolaskuExceljen sarakerakenne"
              className="flex items-center"
            >
              <Info className="w-4 h-4" />
            </Button>
            
            {uploadedFileName && (
              <div className="flex items-center gap-1 px-2 py-1 bg-green-100 rounded-md text-xs text-green-700">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="truncate max-w-20">{uploadedFileName}</span>
                <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">
                  {ostolaskuExcelData.length}
                </Badge>
              </div>
            )}
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={resetChat}
            disabled={loading}
            title="Resetoi chat ja poista ladattu OstolaskuExcel"
          >
            <RotateCcw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="p-4">
          <Alert variant={error.includes('puuttuu') ? 'default' : 'destructive'}>
            <AlertDescription>
              {error}
              {error.includes('puuttuu') && (
                <div className="mt-2">
                  <p className="text-sm">Voit:</p>
                  <ul className="list-disc list-inside text-sm mt-1">
                    <li>Pyytää ylläpitäjää määrittämään systeemin ohjeistuksen</li>
                    <li>Jos olet ylläpitäjä, siirry <a href="/workspace/invoicer/admin" className="underline font-medium">Admin-sivulle</a> määrittääksesi ohjeistuksen</li>
                  </ul>
                </div>
              )}
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* Messages */}
      <ScrollArea className="flex-1 p-2" style={{ maxWidth: '100%', overflow: 'hidden' }}>
        <div className="space-y-4 w-full" style={{ maxWidth: '100%' }}>
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`flex gap-3 ${message.role === 'user' ? 'max-w-[80%] flex-row-reverse' : 'w-full'}`} style={{ maxWidth: message.role === 'assistant' ? 'calc(100% - 2rem)' : undefined }}>
                {/* Avatar */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  message.role === 'user' 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-gray-200 text-gray-600'
                }`}>
                  {message.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>
                
                {/* Message Content */}
                <div className={`rounded-lg p-3 min-w-0 overflow-hidden ${
                  message.role === 'user'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-900'
                }`} style={{ maxWidth: message.role === 'assistant' ? 'min(calc(100vw - 8rem), 100%)' : '80%' }}>
                  <div className="prose prose-sm max-w-none">
                    <ReactMarkdown 
                      remarkPlugins={[remarkGfm]}
                      components={{
                        table: ({ children }) => (
                          <div className="overflow-x-auto my-2">
                            <table className="min-w-full">
                              {children}
                            </table>
                          </div>
                        ),
                        thead: ({ children }) => (
                          <thead className="bg-gray-50">
                            {children}
                          </thead>
                        ),
                        tbody: ({ children }) => (
                          <tbody className="bg-white divide-y divide-gray-200">
                            {children}
                          </tbody>
                        ),
                        tr: ({ children }) => (
                          <tr className="hover:bg-gray-50">
                            {children}
                          </tr>
                        ),
                        th: ({ children }) => (
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            {children}
                          </th>
                        ),
                        td: ({ children }) => (
                          <td className="px-3 py-2 whitespace-nowrap text-sm">
                            {children}
                          </td>
                        ),
                      }}
                    >
                      {message.content}
                    </ReactMarkdown>
                  </div>
                  
                  {/* Function Calls Badge */}
                  {message.functionCalls && message.functionCalls.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {message.functionCalls.map((call, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          🔧 {call.split('(')[0]}
                        </Badge>
                      ))}
                    </div>
                  )}
                  
                  <div className="text-xs opacity-70 mt-1 flex items-center justify-between">
                    <span>{message.timestamp.toLocaleTimeString('fi-FI')}</span>
                    
                    {/* Feedback buttons for assistant messages only */}
                    {message.role === 'assistant' && message.id !== 'welcome' && (
                      <div className="flex items-center gap-1 ml-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className={`h-6 w-6 p-0 ${
                            messageFeedback[message.id] === 'thumbs_up' 
                              ? 'text-green-600 bg-green-100' 
                              : 'text-gray-400 hover:text-green-600'
                          }`}
                          onClick={() => handleFeedback(message.id, 'thumbs_up')}
                        >
                          <ThumbsUp className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className={`h-6 w-6 p-0 ${
                            messageFeedback[message.id] === 'thumbs_down' 
                              ? 'text-red-600 bg-red-100' 
                              : 'text-gray-400 hover:text-red-600'
                          }`}
                          onClick={() => handleFeedback(message.id, 'thumbs_down')}
                        >
                          <ThumbsDown className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
          
          {loading && (
            <div className="flex gap-3 justify-start">
              <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                <Bot className="w-4 h-4 text-gray-600" />
              </div>
              <div className="bg-gray-100 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span className="text-sm text-gray-600">AI miettii...</span>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        onChange={handleFileUpload}
        multiple
        style={{ display: 'none' }}
      />

      {/* Info Dialog - OstolaskuExceljen sarakerakenne */}
      <Dialog open={showInfoDialog} onOpenChange={setShowInfoDialog}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Tuettu OstolaskuExceljen sarakerakenne</DialogTitle>
            <DialogDescription>
              Ohje OstolaskuExceltiedostojen rakenteesta. Voit käyttää joko JSON- tai Excel-tiedostoja.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <h4 className="font-semibold text-sm mb-2">📋 Suositellut sarakkeet:</h4>
              <div className="bg-gray-50 p-4 rounded-lg text-sm space-y-2">
                <div><strong>Asiakasnumero:</strong> Asiakkaan yksilöivä numero</div>
                <div><strong>Tuotekoodi:</strong> Tuotteen tai palvelun koodi</div>
                <div><strong>Tuotenimi:</strong> Tuotteen tai palvelun nimi</div>
                <div><strong>Määrä:</strong> Tilausmäärä (numero)</div>
                <div><strong>Hinta:</strong> Yksikköhinta (numero)</div>
                <div><strong>Kuvaus:</strong> Tuotteen tai palvelun kuvaus</div>
                <div><strong>Tilausnumero:</strong> Alkuperäinen tilausnumero (valinnainen)</div>
              </div>
            </div>
            
            <div>
              <h4 className="font-semibold text-sm mb-2">📁 Tuetut tiedostomuodot:</h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-green-600" />
                  <span><strong>Excel (.xlsx, .xls):</strong> Voit valita välilehden jos tiedostossa on useita</span>
                </div>
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-blue-600" />
                  <span><strong>JSON:</strong> Taulukkomuotoinen JSON-array</span>
                </div>
              </div>
            </div>
            
            <div>
              <h4 className="font-semibold text-sm mb-2">💡 Vinkit:</h4>
              <div className="bg-blue-50 p-4 rounded-lg text-sm space-y-1">
                <div>• Varmista että sarakkeiden nimet ovat selkeitä</div>
                <div>• Numerot (määrä, hinta) tulee olla numeromuodossa</div>
                <div>• Tyhjät rivit ja sarakkeet ohitetaan automaattisesti</div>
              </div>
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={() => setShowInfoDialog(false)}>
              Sulje
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Sheet Selector Dialog */}
      <Dialog open={showSheetSelector} onOpenChange={setShowSheetSelector}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Valitse Excel välilehdet</DialogTitle>
            <DialogDescription>
              Excel-tiedostossa on useita välilehtiä. Valitse yksi tai useampi välilehti ladattavaksi.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-4 max-h-[400px] overflow-y-auto">
            {availableSheets.map((sheetName) => (
              <div
                key={sheetName}
                className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50"
              >
                <input
                  type="checkbox"
                  id={`sheet-${sheetName}`}
                  checked={selectedSheets.includes(sheetName)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedSheets([...selectedSheets, sheetName]);
                    } else {
                      setSelectedSheets(selectedSheets.filter(s => s !== sheetName));
                    }
                  }}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <label
                  htmlFor={`sheet-${sheetName}`}
                  className="flex-1 cursor-pointer"
                >
                  <div className="flex items-center">
                    <FileSpreadsheet className="w-4 h-4 mr-2" />
                    <div>
                      <div className="font-medium">{sheetName}</div>
                      <div className="text-xs text-gray-500">Excel välilehti</div>
                    </div>
                  </div>
                </label>
              </div>
            ))}
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (selectedSheets.length === availableSheets.length) {
                    setSelectedSheets([]);
                  } else {
                    setSelectedSheets(availableSheets);
                  }
                }}
              >
                {selectedSheets.length === availableSheets.length ? 'Poista kaikki valinnat' : 'Valitse kaikki'}
              </Button>
            </div>
            <div className="flex justify-between items-center">
              <div className="text-sm text-gray-600">
                {selectedSheets.length} / {availableSheets.length} välilehteä valittu
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="ghost" 
                  onClick={() => {
                    setShowSheetSelector(false);
                    setUploadedWorkbook(null);
                    setAvailableSheets([]);
                    setSelectedSheets([]);
                    setUploadedFileName('');
                  }}
                >
                  Peruuta
                </Button>
                <Button
                  onClick={handleMultipleSheetsSelection}
                  disabled={selectedSheets.length === 0}
                >
                  Lataa valitut ({selectedSheets.length})
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Negative Feedback Dialog */}
      <Dialog open={showNegativeFeedbackDialog} onOpenChange={setShowNegativeFeedbackDialog}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Kerro mikä meni pieleen</DialogTitle>
            <DialogDescription>
              Negatiivinen palaute on meille erittäin arvokasta. Kerro tarkemmin mikä vastauksessa ei ollut tyydyttävää, jotta voimme parantaa AI:ta.
            </DialogDescription>
          </DialogHeader>
          
          <Tabs defaultValue="feedback" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="feedback">Palaute</TabsTrigger>
              <TabsTrigger value="prompt">AI Prompti</TabsTrigger>
              <TabsTrigger value="conversation">Keskustelu</TabsTrigger>
              <TabsTrigger value="data">OstolaskuExceldata</TabsTrigger>
            </TabsList>
            
            <TabsContent value="feedback" className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Mikä oli ongelmana? *
                </label>
                <textarea
                  value={feedbackComment}
                  onChange={(e) => setFeedbackComment(e.target.value)}
                  placeholder="Esim: Vastaus oli epätarkka, tuotehinnat olivat vääriä, AI ei ymmärtänyt kysymystäni..."
                  className="w-full min-h-[100px] p-3 border border-gray-300 rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              
              <div className="bg-blue-50 p-3 rounded-md">
                <p className="text-sm text-blue-700">
                  <strong>Kaikki alla olevat välilehdet tallennetaan analyysiä varten</strong>
                </p>
              </div>
            </TabsContent>
            
            <TabsContent value="prompt" className="space-y-4">
              <div>
                <h4 className="font-medium text-sm mb-2">Käytetty AI-järjestelmäprompti:</h4>
                <div className="bg-gray-50 p-3 rounded border max-h-[300px] overflow-y-auto">
                  <pre className="text-xs whitespace-pre-wrap">{systemPrompt || 'Ei promptia ladattu'}</pre>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="conversation" className="space-y-4">
              <div>
                <h4 className="font-medium text-sm mb-2">Keskusteluhistoria ({messages.length} viestiä):</h4>
                <div className="bg-gray-50 p-3 rounded border max-h-[300px] overflow-y-auto space-y-2">
                  {messages.map((msg, index) => (
                    <div key={index} className="border-b pb-2 last:border-b-0">
                      <div className="text-xs font-medium text-gray-600">
                        {msg.role === 'user' ? '👤 Käyttäjä' : '🤖 AI'} - {new Date(msg.timestamp).toLocaleTimeString()}
                      </div>
                      <div className="text-xs mt-1 text-gray-800">
                        {msg.content.substring(0, 200)}{msg.content.length > 200 ? '...' : ''}
                      </div>
                      {msg.functionCalls && msg.functionCalls.length > 0 && (
                        <div className="text-xs text-blue-600 mt-1">
                          🔧 Funktiokutsut: {msg.functionCalls.map(fc => fc.name).join(', ')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="data" className="space-y-4">
              <div>
                <h4 className="font-medium text-sm mb-2">
                  OstolaskuExceldata ({ostolaskuExcelData.length > 0 ? `${ostolaskuExcelData.length} riviä` : 'Ei dataa'}):
                </h4>
                {ostolaskuExcelData.length > 0 ? (
                  <div className="space-y-2">
                    <div className="text-xs text-gray-600">
                      📁 Tiedosto: {uploadedFileName || 'Tuntematon'}
                    </div>
                    <div className="bg-gray-50 p-3 rounded border max-h-[300px] overflow-y-auto">
                      <pre className="text-xs">
                        {JSON.stringify(ostolaskuExcelData.slice(0, 3), null, 2)}
                        {ostolaskuExcelData.length > 3 && `\n... ja ${ostolaskuExcelData.length - 3} riviä lisää`}
                      </pre>
                    </div>
                  </div>
                ) : (
                  <div className="bg-yellow-50 p-3 rounded border">
                    <p className="text-sm text-yellow-700">❌ Ei OstolaskuExceldataa ladattu</p>
                    <p className="text-xs text-yellow-600 mt-1">Tämä saattaa olla syy ongelmaan - AI ei pysty käsittelemään OstolaskuExcelja ilman dataa.</p>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
          
          <div className="flex gap-2 justify-end mt-6">
            <Button
              variant="outline"
              onClick={() => {
                setShowNegativeFeedbackDialog(false);
                setSelectedMessageForFeedback('');
                setFeedbackComment('');
              }}
            >
              Peruuta
            </Button>
            <Button
              onClick={handleNegativeFeedbackSubmit}
              disabled={!feedbackComment.trim()}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Lähetä palaute
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Input */}
      <div className="p-4 border-t">
        {/* Quick Action Button */}
        {!quickActionUsed && ostolaskuExcelData.length > 0 && messages.length <= 1 && (
          <div className="mb-3">
            <Button
              onClick={() => handleQuickAction('Tarkista hinnat ja tilaukset')}
              disabled={loading || !isInitialized}
              variant="outline"
              size="sm"
              className="text-xs bg-blue-50 hover:bg-blue-100 border-blue-200"
            >
              <span className="mr-1">⚡</span>
              Tarkista hinnat ja tilaukset
            </Button>
          </div>
        )}
        
        <div className="flex gap-2">
          <Input
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Kysy jotain hinnasto- tai tilausdatasta..."
            disabled={loading || !isInitialized}
            className="flex-1"
          />
          <Button
            onClick={() => sendMessageWithText('Tarkista hinnat ja tilaukset')}
            disabled={loading || !isInitialized}
            variant="outline"
            title="Tarkista hinnat ja tilaukset"
          >
            <CheckCircle className="w-4 h-4 mr-1" />
            Tarkasta
          </Button>
          <div 
            className="relative"
            onMouseEnter={() => setShowExcelOptions(true)}
            onMouseLeave={() => setShowExcelOptions(false)}
          >
            {!showExcelOptions ? (
              <Button
                disabled={loading}
                variant="outline"
                title="Lataa MyyntiExcel TARKASTUSTAULUKOSTA"
              >
                <Download className="w-4 h-4 mr-1" />
                MyyntiExcel
              </Button>
            ) : (
              <div className="flex gap-1">
                <Button
                  onClick={() => {
                    setPropertyManagerType('hoas');
                    generateMyyntiExcelFromTarkastustaulukko();
                  }}
                  disabled={loading}
                  variant="outline"
                  size="sm"
                  title="HOAS MyyntiExcel"
                >
                  HOAS
                </Button>
                <Button
                  onClick={() => {
                    setPropertyManagerType('kontu-onni');
                    generateMyyntiExcelFromTarkastustaulukko();
                  }}
                  disabled={loading}
                  variant="outline"
                  size="sm"
                  title="Kontu & Onni MyyntiExcel"
                >
                  Kontu
                </Button>
                <Button
                  onClick={() => {
                    setPropertyManagerType('retta-management');
                    generateMyyntiExcelFromTarkastustaulukko();
                  }}
                  disabled={loading}
                  variant="outline"
                  size="sm"
                  title="Retta Management MyyntiExcel"
                >
                  Retta
                </Button>
              </div>
            )}
          </div>
          <Button
            onClick={sendMessage}
            disabled={loading || !isInitialized || !inputMessage.trim()}
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        
        {!isInitialized && (
          <p className="text-xs text-gray-500 mt-2">
            Alustetaan AI-assistenttia...
          </p>
        )}
      </div>
      
    </div>
  );
};