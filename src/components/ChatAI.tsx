import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { geminiChatService, ChatMessage, ChatContext } from '../lib/geminiChatService';
import { loadLatestPrompt, setUserFeedback, saveChatSessionLog, createContinuousImprovementSession } from '../lib/firestoreService';
import { logger } from '../lib/loggingService';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { Send, Bot, User, Settings, RefreshCw, ThumbsUp, ThumbsDown, Upload, RotateCcw, FileSpreadsheet, Info } from 'lucide-react';
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
  const [showInfoDialog, setShowInfoDialog] = useState(false);
  const [showNegativeFeedbackDialog, setShowNegativeFeedbackDialog] = useState(false);
  const [selectedMessageForFeedback, setSelectedMessageForFeedback] = useState<string>('');
  const [feedbackComment, setFeedbackComment] = useState<string>('');
  const [quickActionUsed, setQuickActionUsed] = useState(false);
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
      ? `\n\n✅ **OstolaskuExceldata ladattu**: ${ostolaskuExcelData.length} riviä tiedostosta "${uploadedFileName}"\n\n**Vaihe 1 - Tarkasta tiedot:**\n• "Tarkista hinnat ja tilaukset"\n• "Onko meillä hinnat hinnastossa ja tilaus tilausrekisterissä?"\n\n*Botti ehdottaa MyyntiExcelin luomista kun tiedot on tarkastettu.*`
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

      // Create continuous improvement session
      logger.debug('ChatAI', 'initializeChat', 'Creating improvement session', null, newSessionId);
      const sessionKey = await createContinuousImprovementSession(
        `prompt_${user.uid}_${Date.now()}`,
        newSessionId,
        user.uid
      );
      setCurrentSessionKey(sessionKey);
      logger.info('ChatAI', 'initializeChat', 'Improvement session created', { sessionKey }, newSessionId);

      // Add welcome message with OstolaskuExcel status
      const ostolaskuExcelStatus = ostolaskuExcelData.length > 0 
        ? `\n\n✅ **OstolaskuExceldata ladattu**: ${ostolaskuExcelData.length} riviä tiedostosta "${uploadedFileName}"\n\n**Vaihe 1 - Tarkasta tiedot:**\n• "Tarkista hinnat ja tilaukset"\n• "Onko meillä hinnat hinnastossa ja tilaus tilausrekisterissä?"\n\n*Botti ehdottaa MyyntiExcelin luomista kun tiedot on tarkastettu.*`
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

  const sendMessage = async () => {
    if (!inputMessage.trim() || !sessionId || !user || loading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: inputMessage,
      timestamp: new Date()
    };

    // Only log if message is very short (potential issue)
    if (userMessage.content.trim().length < 5) {
      logger.warn('ChatAI', 'sendMessage', 'Very short user message', { message: userMessage.content }, sessionId);
    }
    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setLoading(true);
    setError(null);

    try {
      const response = await geminiChatService.sendMessage(sessionId, inputMessage, user.uid, ostolaskuExcelData);
      
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
        messageLength: inputMessage.length,
        hasOstolaskuExcelData: ostolaskuExcelData.length > 0,
        sessionId 
      });
      setError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setLoading(false);
    }
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

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const isJson = file.name.endsWith('.json');
    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
    
    if (!isJson && !isExcel) {
      setError('Vain JSON- ja Excel-tiedostot ovat sallittuja');
      return;
    }

    try {
      let jsonData: any[];
      
      if (isJson) {
        // Handle JSON file
        const text = await file.text();
        jsonData = JSON.parse(text);
        
        // Validate it's an array
        if (!Array.isArray(jsonData)) {
          setError('JSON-tiedoston tulee olla taulukko (array)');
          return;
        }
      } else {
        // Handle Excel file
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        
        if (workbook.SheetNames.length === 0) {
          setError('Excel-tiedostossa ei ole yhtään välilehteä');
          return;
        }
        
        // If multiple sheets, show selector
        if (workbook.SheetNames.length > 1) {
          setUploadedWorkbook(workbook);
          setAvailableSheets(workbook.SheetNames);
          setUploadedFileName(file.name);
          setShowSheetSelector(true);
          return;
        }
        
        // Single sheet - process directly
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        jsonData = XLSX.utils.sheet_to_json(worksheet);
        
        if (jsonData.length === 0) {
          setError('Excel-tiedosto on tyhjä');
          return;
        }
        
        toast.success(`Ladattu ${jsonData.length} riviä välilehdeltä "${sheetName}"`);
      }

      setOstolaskuExcelData(jsonData);
      setUploadedFileName(file.name);
      setError(null);
      
      console.log('✅ OstolaskuExcel uploaded:', {
        fileName: file.name,
        recordCount: jsonData.length,
        fileType: isJson ? 'JSON' : 'Excel'
      });

      // Add a success message and re-initialize session with OstolaskuExcel data
      if (user && systemPrompt) {
        console.log('🔄 Re-initializing chat with OstolaskuExcel data...');
        
        // Add a success message about loaded OstolaskuExcel
        const successMessage: ChatMessage = {
          id: `OstolaskuExcel-loaded-${Date.now()}`,
          role: 'assistant',
          content: `✅ **OstolaskuExcel ladattu onnistuneesti!**\n\n📄 Tiedosto: "${file.name}"\n📊 Rivejä: ${jsonData.length}\n\n**Vaihe 1 - Pyydä tietojen tarkastus:**\n• "Tarkista hinnat ja tilaukset"\n• "Onko meillä hinnat hinnastossa ja tilaus tilausrekisterissä?"\n\n*Tarkistan tiedot ja ehdotan MyyntiExcelin luomista.*`,
          timestamp: new Date()
        };
        
        setMessages(prev => [...prev, successMessage]);
        
        // Re-initialize session with OstolaskuExcel data
        const newSessionId = `session_${user.uid}_${Date.now()}`;
        
        const context: ChatContext = {
          userId: user.uid,
          systemPrompt,
          sessionId: newSessionId,
          ostolaskuExcelData: jsonData
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

  const handleSheetSelection = async (sheetName: string) => {
    if (!uploadedWorkbook) return;

    try {
      const worksheet = uploadedWorkbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);
      
      if (jsonData.length === 0) {
        setError('Valittu välilehti on tyhjä');
        return;
      }

      setOstolaskuExcelData(jsonData);
      
      // Notify parent component about data change
      if (onOstolaskuExcelDataChange) {
        onOstolaskuExcelDataChange(jsonData);
      }
      
      setError(null);
      setShowSheetSelector(false);
      
      toast.success(`Ladattu ${jsonData.length} riviä välilehdeltä "${sheetName}"`);
      
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
          content: `✅ **OstolaskuExcel ladattu onnistuneesti!**\n\n📄 Tiedosto: "${uploadedFileName || 'OstolaskuExcel.xlsx'}"\n📊 Rivejä: ${jsonData.length}\n\n**Vaihe 1 - Pyydä tietojen tarkastus:**\n• "Tarkista hinnat ja tilaukset"\n• "Onko meillä hinnat hinnastossa ja tilaus tilausrekisterissä?"\n\n*Tarkistan tiedot ja ehdotan MyyntiExcelin luomista.*`,
          timestamp: new Date()
        };
        
        setMessages(prev => [...prev, successMessage]);
        
        // Re-initialize session with OstolaskuExcel data
        const newSessionId = `session_${user.uid}_${Date.now()}`;
        
        const context: ChatContext = {
          userId: user.uid,
          systemPrompt,
          sessionId: newSessionId,
          ostolaskuExcelData: jsonData
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
                  <div className="text-sm">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        // Wrap tables in scrollable container with smaller font
                        table: ({ children }) => (
                          <div className="overflow-x-auto -mx-3 max-w-full">
                            <div className="inline-block min-w-full align-middle">
                              <div className="overflow-hidden">
                                <table className="min-w-full divide-y divide-gray-200" style={{ fontSize: '0.6rem', lineHeight: '0.85rem' }}>
                                  {children}
                                </table>
                              </div>
                            </div>
                          </div>
                        ),
                        thead: ({ children }) => (
                          <thead className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
                            {children}
                          </thead>
                        ),
                        th: ({ children }) => (
                          <th className="border-r border-blue-400 text-left font-semibold uppercase tracking-wide whitespace-nowrap" style={{ fontSize: '0.55rem', padding: '0.15rem 0.25rem' }}>
                            {children}
                          </th>
                        ),
                        td: ({ children, ...props }) => {
                          // Check if content looks like a number (for right-alignment)
                          const content = String(children).trim();
                          const isNumber = /^\d+([.,]\d+)?$/.test(content);
                          
                          return (
                            <td className={`border-r border-b border-gray-200 whitespace-nowrap ${
                              isNumber ? 'text-right font-medium' : 'text-left'
                            }`} style={{ fontSize: '0.6rem', padding: '0.15rem 0.25rem', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {children}
                            </td>
                          );
                        },
                        tr: ({ children }) => (
                          <tr className="hover:bg-blue-50 transition-colors duration-150">
                            {children}
                          </tr>
                        ),
                        tbody: ({ children }) => (
                          <tbody className="bg-white divide-y divide-gray-200">
                            {children}
                          </tbody>
                        ),
                        // Preserve paragraph styling
                        p: ({ children }) => {
                          const content = String(children);
                          // Don't wrap tables in p tags
                          if (content.includes('|') && content.split('|').length > 3) {
                            return null;
                          }
                          return <p className="mb-2">{children}</p>;
                        },
                        ul: ({ children }) => <ul className="list-disc ml-4 mb-2">{children}</ul>,
                        li: ({ children }) => <li className="mb-1">{children}</li>,
                        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
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
        accept=".json,.xlsx,.xls"
        onChange={handleFileUpload}
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
            <DialogTitle>Valitse Excel välilehti</DialogTitle>
            <DialogDescription>
              Excel-tiedostossa on useita välilehtiä. Valitse mikä sisältää OstolaskuExcel-datan.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-4">
            {availableSheets.map((sheetName) => (
              <Button
                key={sheetName}
                variant="outline"
                onClick={() => handleSheetSelection(sheetName)}
                className="justify-start h-auto p-4"
              >
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                <div className="text-left">
                  <div className="font-medium">{sheetName}</div>
                  <div className="text-xs text-gray-500">Excel välilehti</div>
                </div>
              </Button>
            ))}
          </div>
          <div className="flex justify-end">
            <Button 
              variant="ghost" 
              onClick={() => {
                setShowSheetSelector(false);
                setUploadedWorkbook(null);
                setAvailableSheets([]);
                setUploadedFileName('');
              }}
            >
              Peruuta
            </Button>
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