import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useWorkspace } from '../hooks/useWorkspace';
import { geminiChatService, ChatMessage, ChatContext } from '../lib/geminiChatService';
import { loadLatestPrompt, setUserFeedback, createContinuousImprovementSession } from '../lib/firestoreService';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { Send, Bot, User, Settings, RefreshCw, ThumbsUp, ThumbsDown, Upload, RotateCcw } from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';
import { ScrollArea } from './ui/scroll-area';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

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
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadSystemPrompt = async () => {
    if (!user) return;

    try {
      // Get the latest system prompt version - NO FALLBACK!
      const latestPrompt = await loadLatestPrompt(user.uid, currentWorkspace);
      if (!latestPrompt) {
        throw new Error(`No system prompt found for workspace '${currentWorkspace}'. Please configure system prompt in Admin panel first.`);
      }
      setSystemPrompt(latestPrompt);
    } catch (err) {
      console.error('Failed to load system prompt:', err);
      setError('Failed to load system configuration');
    }
  };

  const initializeChat = async () => {
    if (!user || !systemPrompt || isInitialized) {
      console.log('🔄 Skipping chat initialization:', { 
        hasUser: !!user, 
        hasPrompt: !!systemPrompt, 
        isInitialized 
      });
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
        sessionId: newSessionId
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

      // Add welcome message
      const welcomeMessage: ChatMessage = {
        id: 'welcome',
        role: 'assistant',
        content: '👋 Hei! Olen Retta-laskutusavustajasi kuukausittaiseen kulujen edelleenlaskutukseen.\n\nLataa ostolaskuja JSON-muodossa ja voin luoda sen pohjalta myyntilaskun oikeilla hinnoilla ja tuotteilla.\n\nMiten voin auttaa?',
        timestamp: new Date()
      };

      setMessages([welcomeMessage]);
      console.log('✅ Chat initialization complete');
    } catch (err) {
      console.error('❌ Failed to initialize chat:', err);
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

  // Reload prompt when workspace changes
  useEffect(() => {
    if (user && currentWorkspace) {
      setIsInitialized(false);
      setMessages([]);
      setSystemPrompt('');
      loadSystemPrompt();
    }
  }, [currentWorkspace]);

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
      console.error('❌ Error in sendMessage:', err);
      setError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setLoading(false);
    }
  };

  const handleFeedback = async (messageId: string, feedback: 'thumbs_up' | 'thumbs_down') => {
    if (!currentSessionKey || !user) return;

    try {
      // Update local state
      setMessageFeedback(prev => ({ ...prev, [messageId]: feedback }));
      
      // Save feedback to Firestore
      await setUserFeedback(currentSessionKey, feedback);
      
      console.log(`Feedback ${feedback} saved for message ${messageId}`);
    } catch (error) {
      console.error('Failed to save feedback:', error);
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
    if (!file.name.endsWith('.json')) {
      setError('Vain JSON-tiedostot ovat sallittuja');
      return;
    }

    try {
      const text = await file.text();
      const jsonData = JSON.parse(text);
      
      // Validate it's an array
      if (!Array.isArray(jsonData)) {
        setError('JSON-tiedoston tulee olla taulukko (array)');
        return;
      }

      setOstolaskuData(jsonData);
      setUploadedFileName(file.name);
      setError(null);
      
      console.log('✅ Ostolasku JSON uploaded:', {
        fileName: file.name,
        recordCount: jsonData.length
      });

      // File uploaded successfully - status is shown in the upload indicator below
      
    } catch (err) {
      console.error('❌ JSON parsing failed:', err);
      setError('Virheellinen JSON-tiedosto. Tarkista tiedoston muoto.');
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const triggerFileUpload = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Header */}
      <div className="flex justify-between items-center p-4 border-b">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5" />
          <span className="font-medium">Retta AI Assistant</span>
          {isInitialized && (
            <Badge variant="secondary" className="text-xs">
              Gemini 2.5 Pro
            </Badge>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={triggerFileUpload}
            disabled={loading}
            title="Lataa edelleen laskutettava ostolasku"
            className="flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            <span className="hidden sm:inline">Lataa ostolasku</span>
          </Button>
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
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
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
        accept=".json"
        onChange={handleFileUpload}
        style={{ display: 'none' }}
      />

      {/* Uploaded file indicator */}
      {uploadedFileName && (
        <div className="px-4 py-2 bg-green-50 border-t border-green-200">
          <div className="flex items-center gap-2 text-sm text-green-700">
            <Upload className="w-4 h-4" />
            <span>Ladattu: {uploadedFileName}</span>
            <Badge variant="secondary" className="text-xs">
              {ostolaskuData.length} riviä
            </Badge>
          </div>
        </div>
      )}

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