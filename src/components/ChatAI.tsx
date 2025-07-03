import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { geminiChatService, ChatMessage, ChatContext } from '../lib/geminiChatService';
import { loadLatestPrompt, setUserFeedback, createContinuousImprovementSession } from '../lib/firestoreService';
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
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';

interface ChatAIProps {
  className?: string;
}

export const ChatAI: React.FC<ChatAIProps> = ({ className }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string>('');
  const [systemPrompt, setSystemPrompt] = useState<string>('');
  const [isInitialized, setIsInitialized] = useState(false);
  const [currentSessionKey, setCurrentSessionKey] = useState<string>('');
  const [messageFeedback, setMessageFeedback] = useState<Record<string, 'thumbs_up' | 'thumbs_down'>>({});
  const [ostolaskuData, setOstolaskuData] = useState<any[]>([]);
  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  const [uploadedWorkbook, setUploadedWorkbook] = useState<any>(null);
  const [showSheetSelector, setShowSheetSelector] = useState(false);
  const [availableSheets, setAvailableSheets] = useState<string[]>([]);
  const [showInfoDialog, setShowInfoDialog] = useState(false);
  const [showNegativeFeedbackDialog, setShowNegativeFeedbackDialog] = useState(false);
  const [selectedMessageForFeedback, setSelectedMessageForFeedback] = useState<string>('');
  const [feedbackComment, setFeedbackComment] = useState<string>('');
  const { user } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Enhanced error logging utility
  const logError = (context: string, error: unknown, additionalInfo?: Record<string, any>) => {
    const errorDetails = {
      context,
      timestamp: new Date().toISOString(),
      userId: user?.uid,
      sessionId,
      error: {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : 'Unknown'
      },
      ...additionalInfo
    };
    
    console.error(`❌ [${context}]`, errorDetails);
    
    // Optional: Send to monitoring service in production
    // if (process.env.NODE_ENV === 'production') {
    //   // Send to analytics/monitoring service
    // }
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
    
    console.log('🔄 Updating welcome message with ostolasku status', {
      ostolaskuDataLength: ostolaskuData.length,
      uploadedFileName,
      currentMessagesCount: messages.length
    });
    
    // Create updated welcome message with current ostolasku status
    const ostolaskuStatus = ostolaskuData.length > 0 
      ? `\n\n✅ **Ostolaskudata ladattu**: ${ostolaskuData.length} riviä tiedostosta "${uploadedFileName}"\n\n**Vaihe 1 - Tarkasta tiedot:**\n• "Tarkista hinnat ja tilaukset"\n• "Onko meillä hinnat hinnastossa ja tilaus tilausrekisterissä?"\n\n*Botti ehdottaa myyntilaskun luomista kun tiedot on tarkastettu.*`
      : '\n\n❌ **Ei ostolaskudataa**: Lataa ensin ostolasku (JSON/Excel) painikkeesta yllä';
      
    const welcomeContent = `👋 Hei! Olen Retta-laskutusavustajasi.${ostolaskuStatus}\n\nMiten voin auttaa?`;
      
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
      console.log('🔄 Skipping chat initialization:', { 
        hasUser: !!user, 
        isInitialized 
      });
      return;
    }

    // Don't initialize if no system prompt
    if (!systemPrompt) {
      console.log('❌ No system prompt configured - cannot initialize chat');
      return;
    }

    console.log('🚀 Initializing chat for user:', user.uid);

    try {
      setLoading(true);
      setError(null);

      const newSessionId = `session_${user.uid}_${Date.now()}`;
      
      const context: ChatContext = {
        userId: user.uid,
        systemPrompt,
        sessionId: newSessionId,
        ostolaskuData: ostolaskuData.length > 0 ? ostolaskuData : undefined
      };

      console.log('📡 Calling geminiChatService.initializeSession...');
      await geminiChatService.initializeSession(context);
      setSessionId(newSessionId);
      setIsInitialized(true);
      console.log('✅ Chat session initialized successfully');

      // Create continuous improvement session
      console.log('📝 Creating continuous improvement session...');
      const sessionKey = await createContinuousImprovementSession(
        `prompt_${user.uid}_${Date.now()}`,
        newSessionId,
        user.uid
      );
      setCurrentSessionKey(sessionKey);
      console.log('✅ Continuous improvement session created');

      // Add welcome message with ostolasku status
      const ostolaskuStatus = ostolaskuData.length > 0 
        ? `\n\n✅ **Ostolaskudata ladattu**: ${ostolaskuData.length} riviä tiedostosta "${uploadedFileName}"\n\n**Vaihe 1 - Tarkasta tiedot:**\n• "Tarkista hinnat ja tilaukset"\n• "Onko meillä hinnat hinnastossa ja tilaus tilausrekisterissä?"\n\n*Botti ehdottaa myyntilaskun luomista kun tiedot on tarkastettu.*`
        : '\n\n❌ **Ei ostolaskudataa**: Lataa ensin ostolasku (JSON/Excel) painikkeesta yllä';
        
      const welcomeContent = `👋 Hei! Olen Retta-laskutusavustajasi.${ostolaskuStatus}\n\nMiten voin auttaa?`;
        
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


  const sendMessage = async () => {
    if (!inputMessage.trim() || !sessionId || !user || loading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: inputMessage,
      timestamp: new Date()
    };

    console.log('🎯 User message:', userMessage);
    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setLoading(true);
    setError(null);

    try {
      console.log('📨 Sending message to geminiChatService...');
      const response = await geminiChatService.sendMessage(sessionId, inputMessage, user.uid, ostolaskuData);
      console.log('✅ Received response from geminiChatService:', response);
      setMessages(prev => [...prev, response]);
    } catch (err) {
      logError('SendMessage', err, { 
        messageLength: inputMessage.length,
        hasOstolaskuData: ostolaskuData.length > 0,
        sessionId 
      });
      setError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setLoading(false);
    }
  };

  const resetChat = () => {
    // Clear all chat data including ostolasku
    if (sessionId) {
      geminiChatService.clearSession(sessionId);
    }
    setMessages([]);
    setSessionId('');
    setIsInitialized(false);
    setError(null);
    setMessageFeedback({});
    setCurrentSessionKey('');
    
    // Clear ostolasku data
    setOstolaskuData([]);
    setUploadedFileName('');
    
    // Reinitialize fresh chat
    if (user && systemPrompt) {
      initializeChat();
    }
    
    console.log('🔄 Chat reset: All data cleared and reinitialized');
  };

  const handleFeedback = async (messageId: string, feedback: 'thumbs_up' | 'thumbs_down') => {
    if (!currentSessionKey) {
      console.warn('No session key available for feedback');
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

      // Save feedback to database
      await setUserFeedback(currentSessionKey, feedback, undefined, 'invoicer');
      
      console.log(`✅ Feedback saved: ${feedback} for message ${messageId}`);
    } catch (error) {
      logError('FeedbackSave', error, { 
        messageId, 
        feedback, 
        sessionKey: currentSessionKey 
      });
      
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
    if (!selectedMessageForFeedback || !currentSessionKey) {
      return;
    }

    try {
      // Update local state immediately for UI feedback
      setMessageFeedback(prev => ({
        ...prev,
        [selectedMessageForFeedback]: 'thumbs_down'
      }));

      // Collect comprehensive session data
      const comprehensiveData = {
        messageId: selectedMessageForFeedback,
        userComment: feedbackComment,
        sessionId: sessionId,
        currentSessionKey: currentSessionKey,
        systemPrompt: systemPrompt,
        conversationHistory: messages,
        ostolaskuData: ostolaskuData,
        uploadedFileName: uploadedFileName,
        timestamp: new Date().toISOString(),
        userId: user?.uid,
        userEmail: user?.email,
        // Technical context
        sessionContext: {
          isInitialized,
          hasOstolaskuData: ostolaskuData.length > 0,
          messageCount: messages.length,
          lastMessageTimestamp: messages[messages.length - 1]?.timestamp
        }
      };

      // Save detailed negative feedback to invoicer_continuous_improvement collection
      await setUserFeedback(
        currentSessionKey, 
        'thumbs_down', 
        JSON.stringify(comprehensiveData), 
        'invoicer'
      );

      console.log('✅ Comprehensive negative feedback saved:', {
        messageId: selectedMessageForFeedback,
        commentLength: feedbackComment.length,
        dataSize: JSON.stringify(comprehensiveData).length
      });

      // Close dialog and reset state
      setShowNegativeFeedbackDialog(false);
      setSelectedMessageForFeedback('');
      setFeedbackComment('');

    } catch (error) {
      logError('NegativeFeedbackSave', error, { 
        messageId: selectedMessageForFeedback,
        commentLength: feedbackComment.length,
        sessionKey: currentSessionKey 
      });
      
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

      setOstolaskuData(jsonData);
      setUploadedFileName(file.name);
      setError(null);
      
      console.log('✅ Ostolasku uploaded:', {
        fileName: file.name,
        recordCount: jsonData.length,
        fileType: isJson ? 'JSON' : 'Excel'
      });

      // Add a success message and re-initialize session with ostolasku data
      if (user && systemPrompt) {
        console.log('🔄 Re-initializing chat with ostolasku data...');
        
        // Add a success message about loaded ostolasku
        const successMessage: ChatMessage = {
          id: `ostolasku-loaded-${Date.now()}`,
          role: 'assistant',
          content: `✅ **Ostolasku ladattu onnistuneesti!**\n\n📄 Tiedosto: "${file.name}"\n📊 Rivejä: ${jsonData.length}\n\n**Vaihe 1 - Pyydä tietojen tarkastus:**\n• "Tarkista hinnat ja tilaukset"\n• "Onko meillä hinnat hinnastossa ja tilaus tilausrekisterissä?"\n\n*Tarkistan tiedot ja ehdotan myyntilaskun luomista.*`,
          timestamp: new Date()
        };
        
        setMessages(prev => [...prev, successMessage]);
        
        // Re-initialize session with ostolasku data
        const newSessionId = `session_${user.uid}_${Date.now()}`;
        
        const context: ChatContext = {
          userId: user.uid,
          systemPrompt,
          sessionId: newSessionId,
          ostolaskuData: jsonData
        };

        try {
          await geminiChatService.initializeSession(context);
          setSessionId(newSessionId);
          console.log('✅ Chat re-initialized with ostolasku data');
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

      setOstolaskuData(jsonData);
      setError(null);
      setShowSheetSelector(false);
      
      toast.success(`Ladattu ${jsonData.length} riviä välilehdeltä "${sheetName}"`);
      
      console.log('✅ Ostolasku sheet selected:', {
        fileName: uploadedFileName,
        sheetName,
        recordCount: jsonData.length
      });

      // Add a success message and re-initialize session with ostolasku data
      if (user && systemPrompt) {
        console.log('🔄 Re-initializing chat with ostolasku data...');
        
        // Add a success message about loaded ostolasku
        const successMessage: ChatMessage = {
          id: `ostolasku-loaded-${Date.now()}`,
          role: 'assistant',
          content: `✅ **Ostolasku ladattu onnistuneesti!**\n\n📄 Tiedosto: "${file.name}"\n📊 Rivejä: ${jsonData.length}\n\n**Vaihe 1 - Pyydä tietojen tarkastus:**\n• "Tarkista hinnat ja tilaukset"\n• "Onko meillä hinnat hinnastossa ja tilaus tilausrekisterissä?"\n\n*Tarkistan tiedot ja ehdotan myyntilaskun luomista.*`,
          timestamp: new Date()
        };
        
        setMessages(prev => [...prev, successMessage]);
        
        // Re-initialize session with ostolasku data
        const newSessionId = `session_${user.uid}_${Date.now()}`;
        
        const context: ChatContext = {
          userId: user.uid,
          systemPrompt,
          sessionId: newSessionId,
          ostolaskuData: jsonData
        };

        try {
          await geminiChatService.initializeSession(context);
          setSessionId(newSessionId);
          console.log('✅ Chat re-initialized with ostolasku data');
        } catch (err) {
          console.error('❌ Failed to re-initialize chat:', err);
        }
      }
      
    } catch (err) {
      console.error('❌ Sheet processing failed:', err);
      setError('Välilehden käsittely epäonnistui');
    }
  };

  const loadExampleOstolasku = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch the example Excel file
      const response = await fetch('/Ostomyynti_AI_botti_testi_excel.xlsx');
      if (!response.ok) {
        throw new Error('Esimerkkitiedoston lataus epäonnistui');
      }
      
      const arrayBuffer = await response.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      
      // Look for 'Ostolasku' sheet
      const sheetName = workbook.SheetNames.includes('Ostolasku') 
        ? 'Ostolasku' 
        : workbook.SheetNames[0];
      
      if (!sheetName) {
        throw new Error('Ostolasku-välilehteä ei löytynyt');
      }
      
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);
      
      if (jsonData.length === 0) {
        throw new Error('Esimerkkitiedosto on tyhjä');
      }
      
      setOstolaskuData(jsonData);
      setUploadedFileName('esimerkki_ostolasku.xlsx');
      
      toast.success(`Esimerkkiostolasku ladattu: ${jsonData.length} riviä`);
      
      // Add a success message and re-initialize session with ostolasku data
      if (user && systemPrompt) {
        console.log('🔄 Re-initializing chat with example ostolasku data...');
        
        // Add a success message about loaded ostolasku
        const successMessage: ChatMessage = {
          id: `ostolasku-loaded-${Date.now()}`,
          role: 'assistant',
          content: `✅ **Esimerkkiostolasku ladattu onnistuneesti!**\n\n📄 Tiedosto: "esimerkki_ostolasku.xlsx"\n📊 Rivejä: ${jsonData.length}\n\n**Vaihe 1 - Pyydä tietojen tarkastus:**\n• "Tarkista hinnat ja tilaukset"\n• "Onko meillä hinnat hinnastossa ja tilaus tilausrekisterissä?"\n\n*Tarkistan tiedot ja ehdotan myyntilaskun luomista.*`,
          timestamp: new Date()
        };
        
        setMessages(prev => [...prev, successMessage]);
        
        // Re-initialize session with ostolasku data
        const newSessionId = `session_${user.uid}_${Date.now()}`;
        
        const context: ChatContext = {
          userId: user.uid,
          systemPrompt,
          sessionId: newSessionId,
          ostolaskuData: jsonData
        };

        await geminiChatService.initializeSession(context);
        setSessionId(newSessionId);
        console.log('✅ Example ostolasku loaded and chat re-initialized');
      }
      
    } catch (err) {
      console.error('❌ Failed to load example:', err);
      setError(err instanceof Error ? err.message : 'Esimerkin lataus epäonnistui');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`flex flex-col h-full ${className}`}>
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
              title="Lataa edelleen laskutettava ostolasku (JSON tai Excel)"
              className="flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              <span className="hidden sm:inline">Lataa ostolasku</span>
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowInfoDialog(true)}
              title="Näytä tuettu ostolaskujen sarakerakenne"
              className="flex items-center"
            >
              <Info className="w-4 h-4" />
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={loadExampleOstolasku}
              disabled={loading}
              title="Lataa esimerkki ostolasku"
              className="flex items-center gap-2"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span className="hidden sm:inline">Lataa esimerkki</span>
            </Button>
            
            {uploadedFileName && (
              <div className="flex items-center gap-1 px-2 py-1 bg-green-100 rounded-md text-xs text-green-700">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="truncate max-w-20">{uploadedFileName}</span>
                <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">
                  {ostolaskuData.length}
                </Badge>
              </div>
            )}
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={resetChat}
            disabled={loading}
            title="Resetoi chat ja poista ladattu ostolasku"
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
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`flex gap-3 max-w-[80%] ${message.role === 'user' ? 'flex-row-reverse' : ''}`}>
                {/* Avatar */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  message.role === 'user' 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-gray-200 text-gray-600'
                }`}>
                  {message.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>
                
                {/* Message Content */}
                <div className={`rounded-lg p-3 ${
                  message.role === 'user'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-900'
                }`}>
                  <div className="text-sm prose prose-sm max-w-none">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        // Customize table styling with better visibility
                        table: ({ children }) => (
                          <div className="overflow-x-auto my-4">
                            <table className="w-full border-collapse border border-gray-300 shadow-lg rounded-lg overflow-hidden">
                              {children}
                            </table>
                          </div>
                        ),
                        thead: ({ children }) => (
                          <thead className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
                            {children}
                          </thead>
                        ),
                        th: ({ children }) => (
                          <th className="border-r border-blue-400 px-4 py-3 text-left font-semibold text-sm uppercase tracking-wide">
                            {children}
                          </th>
                        ),
                        td: ({ children, ...props }) => {
                          // Check if content looks like a number (for right-alignment)
                          const content = String(children).trim();
                          const isNumber = /^\d+([.,]\d+)?$/.test(content);
                          
                          return (
                            <td className={`border-r border-b border-gray-200 px-4 py-3 text-sm ${
                              isNumber ? 'text-right font-medium' : 'text-left'
                            }`}>
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
                        // Preserve other styling
                        p: ({ children }) => <p className="mb-2">{children}</p>,
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

      {/* Info Dialog - Ostolaskujen sarakerakenne */}
      <Dialog open={showInfoDialog} onOpenChange={setShowInfoDialog}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Tuettu ostolaskujen sarakerakenne</DialogTitle>
            <DialogDescription>
              Ohje ostolaskutiedostojen rakenteesta. Voit käyttää joko JSON- tai Excel-tiedostoja.
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
                <div>• Voit ladata esimerkkitiedoston "Lataa esimerkki" -painikkeesta</div>
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
              Excel-tiedostossa on useita välilehtiä. Valitse mikä sisältää ostolasku-datan.
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
              <TabsTrigger value="data">Ostolaskudata</TabsTrigger>
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
                  Ostolaskudata ({ostolaskuData.length > 0 ? `${ostolaskuData.length} riviä` : 'Ei dataa'}):
                </h4>
                {ostolaskuData.length > 0 ? (
                  <div className="space-y-2">
                    <div className="text-xs text-gray-600">
                      📁 Tiedosto: {uploadedFileName || 'Tuntematon'}
                    </div>
                    <div className="bg-gray-50 p-3 rounded border max-h-[300px] overflow-y-auto">
                      <pre className="text-xs">
                        {JSON.stringify(ostolaskuData.slice(0, 3), null, 2)}
                        {ostolaskuData.length > 3 && `\n... ja ${ostolaskuData.length - 3} riviä lisää`}
                      </pre>
                    </div>
                  </div>
                ) : (
                  <div className="bg-yellow-50 p-3 rounded border">
                    <p className="text-sm text-yellow-700">❌ Ei ostolaskudataa ladattu</p>
                    <p className="text-xs text-yellow-600 mt-1">Tämä saattaa olla syy ongelmaan - AI ei pysty käsittelemään ostolaskuja ilman dataa.</p>
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