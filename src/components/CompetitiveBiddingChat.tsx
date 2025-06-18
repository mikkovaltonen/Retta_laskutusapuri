import React, { useState, useRef } from 'react';
import { GoogleGenerativeAI, Part } from '@google/generative-ai';
import { Loader2, Send, RotateCcw, Bot, LogOut, Settings, ThumbsUp, ThumbsDown } from "lucide-react";
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

interface CompetitiveBiddingChatProps {
  onLogout?: () => void;
  hideNavigation?: boolean;
}

const apiKey = import.meta.env.VITE_GEMINI_API_KEY || '';
const geminiModel = import.meta.env.VITE_GEMINI_MODEL || 'gemini-2.5-flash-preview-04-17';

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
    citationSources.forEach((source, index) => {
      if (source.uri && source.title) {
        formattedSources.push(`[${index + 1}. ${source.title}](${source.uri})`);
      }
    });
  }

  return { originalText, formattedSources };
};

const CompetitiveBiddingChat: React.FC<CompetitiveBiddingChatProps> = ({
  onLogout,
  hideNavigation = false
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionInitializing, setSessionInitializing] = useState(false);
  const [sessionActive, setSessionActive] = useState(false);
  const [chatSession, setChatSession] = useState<ChatSession | null>(null);
  const [continuousImprovementSessionId, setContinuousImprovementSessionId] = useState<string | null>(null);
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);
  const [feedbackMessageIndex, setFeedbackMessageIndex] = useState<number | null>(null);
  const [feedbackType, setFeedbackType] = useState<'positive' | 'negative' | null>(null);
  const [feedbackComment, setFeedbackComment] = useState('');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { currentWorkspace, workspaceConfig } = useWorkspace();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  React.useEffect(() => {
    scrollToBottom();
  }, [messages]);

  React.useEffect(() => {
    if (user && currentWorkspace === 'competitive_bidding') {
      initializeSession();
    }
  }, [user, currentWorkspace]);

  const initializeSession = async () => {
    if (user) {
      setSessionInitializing(true);
      setSessionActive(false);
      setMessages([]);
      setChatSession(null);
      
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
              ? `🎉 **Tervetuloa Propertius Kilpailuttajaan!**

Olen erikoistunut kilpailutukseen ja markkinatietojen hankintaan kiinteistöhallinnassa. Autan sinua löytämään parhaat toimittajat, hinnat ja markkinatrendit.

**🎯 Mitä osaan:**
• **Markkinakartoitus**: Etsin ajankohtaiset hinnat ja toimittajat
• **Kilpailuttaminen**: Autan kilpailutusten suunnittelussa ja toteutuksessa  
• **Toimittaja-analyysi**: Arvioin toimittajien luotettavuuden ja maineen
• **Hintatrendien seuranta**: Analysoin markkinoiden kehitystä

**💡 Kokeile kysyä:**
• "Etsi kattoremonttitoimittajat Helsingissä ja vertaile hintoja"
• "Mikä on kiinteistöhuollon hintataso tällä hetkellä?"
• "Analysoi Huolto-Karhu Oy:n maine ja asiakaspalautteet"

Miten voin auttaa kilpailutuksessa tänään?`
              : `Hei! Olen Propertius Kilpailutusavustajasi. Olen täällä auttamassa sinua markkinatietojen haussa ja kilpailutuksessa.

📚 **Tietokanta ladattu:** ${session.documentsUsed.length} dokumentti(a) käytettävissä.

Miten voin auttaa sinua tänään?`
          }]
        };
        setMessages([welcomeMessage]);
        setSessionActive(true);
        
        if (isLikelyNewUser) {
          toast.success("🎉 Tervetuloa! Kilpailutusavustajasi on valmis. Käy Admin-paneelissa lataamassa esimerkkidataa.", {
            duration: 6000
          });
        } else {
          toast.success(`Kilpailutusistunto alustettu ${session.documentsUsed.length} tietokannan dokumentilla`);
        }
      } catch (error) {
        console.error('Failed to initialize session:', error);
        
        if (error instanceof Error && error.message.includes('No system prompt configured')) {
          toast.error(`No ${currentWorkspace} system prompt found. Please create one in the Admin panel.`);
        } else {
          toast.error('Database loading failed. Check system prompt settings in Admin panel.');
        }
        
        setMessages([]);
        setSessionActive(false);
      } finally {
        setSessionInitializing(false);
      }
    }
  };

  const initializeContinuousImprovement = async () => {
    if (user && !continuousImprovementSessionId) {
      try {
        const sessionId = await createContinuousImprovementSession(user.uid, currentWorkspace);
        setContinuousImprovementSessionId(sessionId);
        console.log('📊 Continuous improvement session initialized:', sessionId);
      } catch (error) {
        console.error('Failed to initialize continuous improvement session:', error);
      }
    }
  };

  const handleSendMessage = async (textToSend?: string) => {
    if (!sessionActive || !chatSession) {
      toast.error('Session not initialized. Please wait for initialization to complete.');
      return;
    }

    if (!user) {
      toast.error('Please log in to continue chatting.');
      return;
    }

    const text = textToSend || inputValue.trim();
    if (!text) return;

    // Initialize continuous improvement session on first message
    if (!continuousImprovementSessionId) {
      await initializeContinuousImprovement();
    }

    setIsLoading(true);
    setInputValue('');

    const userMessage: Message = {
      role: 'user',
      parts: [{ text }]
    };

    setMessages(prev => [...prev, userMessage]);

    try {
      const systemPrompt = chatSession.systemPrompt || await loadLatestPrompt(currentWorkspace);
      
      // Use Google Search model only for competitive bidding
      const model = genAI.getGenerativeModel({
        model: geminiModel,
        generationConfig: { temperature: 0.1 },
        tools: [{ googleSearch: {} }]
      });

      const history = messages.map(msg => ({ role: msg.role, parts: msg.parts }));
      const result = await model.generateContent({
        contents: [
          { role: 'user', parts: [{ text: systemPrompt }] },
          ...history, 
          { role: 'user', parts: [{ text }] }
        ]
      });

      const response = result.response;
      if (response && response.candidates && response.candidates.length > 0) {
        const candidate = response.candidates[0];
        if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
          const aiMessage: Message = {
            role: 'model',
            parts: candidate.content.parts,
            citationMetadata: candidate.citationMetadata
          };
          
          setMessages(prev => [...prev, aiMessage]);
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => [
        ...prev,
        {
          role: 'model',
          parts: [{ text: `Error: ${error.message || 'Failed to process your request. Please try again.'}` }]
        }
      ]);
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

  const clearMessages = () => {
    setMessages([]);
    initializeSession();
  };

  const handleFeedback = (messageIndex: number, type: 'positive' | 'negative') => {
    setFeedbackMessageIndex(messageIndex);
    setFeedbackType(type);
    setFeedbackDialogOpen(true);
  };

  const submitFeedback = async () => {
    if (feedbackMessageIndex === null || !feedbackType || !continuousImprovementSessionId) return;
    
    try {
      await setUserFeedback(
        continuousImprovementSessionId, 
        feedbackMessageIndex, 
        feedbackType, 
        feedbackComment,
        currentWorkspace
      );
      
      toast.success('Kiitos palautteestasi! Se auttaa parantamaan avustajaa.');
      setFeedbackDialogOpen(false);
      setFeedbackComment('');
      setFeedbackMessageIndex(null);
      setFeedbackType(null);
    } catch (error) {
      console.error('Error submitting feedback:', error);
      toast.error('Palautteen lähettäminen epäonnistui. Yritä uudelleen.');
    }
  };

  const quickActions = [
    "Etsi kattoremonttitoimittajat ja hinnat",
    "Vertaile LVIS-palveluntarjoajien hintoja",
    "Analysoi kiinteistöhuollon markkinatilanne",
    "Hae sähkötyöurakoitsijoiden arvostelut",
    "Selvitä siivouspalvelujen hintatrendit"
  ];

  const handleQuickAction = (action: string) => {
    setInputValue(action);
    handleSendMessage(action);
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Navigation Header */}
      {!hideNavigation && (
        <div className="bg-white shadow-sm border-b">
          <div className="flex justify-between items-center px-8 py-4">
            <div>
              <h1 className="text-2xl font-light" style={{color: '#003d3b'}}>
                {workspaceConfig[currentWorkspace]?.chatTitle || 'Kilpailutusavustaja'}
              </h1>
              <p className="text-sm text-gray-600">Markkinatietojen ja kilpailutuksen asiantuntija</p>
            </div>
            <div className="flex gap-4">
              <Button 
                variant="ghost" 
                onClick={clearMessages}
                className="text-gray-700 hover:bg-gray-100"
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Tyhjennä keskustelu
              </Button>
              <Button 
                variant="ghost" 
                onClick={() => navigate('/admin')}
                className="text-gray-700 hover:bg-gray-100"
              >
                <Settings className="mr-2 h-4 w-4" />
                Admin
              </Button>
              {onLogout && (
                <Button 
                  variant="ghost" 
                  onClick={onLogout}
                  className="text-gray-700 hover:bg-gray-100"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Kirjaudu ulos
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Quick Action Pills */}
      <div className="bg-white border-b p-6">
        <div className="flex flex-wrap gap-3 justify-center max-w-6xl mx-auto">
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
                  <span className="text-sm text-gray-600">Initializing competitive bidding assistant...</span>
                </div>
              </div>
            </div>
          )}
          
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className="flex items-start space-x-3 max-w-5xl">
                {message.role === 'model' && (
                  <div className="flex-shrink-0 w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                    <Bot className="h-5 w-5 text-gray-700" />
                  </div>
                )}
                <div
                  className={`rounded-2xl px-6 py-4 shadow-sm border ${
                    message.role === 'user'
                      ? 'bg-gray-900 text-white'
                      : 'bg-white text-gray-900'
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
                                <tbody className="divide-y divide-gray-200 bg-white">
                                  {children}
                                </tbody>
                              ),
                              tr: ({ children, ...props }) => {
                                // Check if this is a header row or data row
                                const isHeaderRow = props.node?.tagName === 'tr' && props.node?.parentNode?.tagName === 'thead';
                                return (
                                  <tr className={isHeaderRow ? "" : "hover:bg-blue-50/50 transition-colors duration-200 even:bg-gray-50/30"}>
                                    {children}
                                  </tr>
                                );
                              },
                              th: ({ children }) => (
                                <th className="px-8 py-5 text-left text-sm font-bold text-white uppercase tracking-wider first:rounded-tl-xl last:rounded-tr-xl">
                                  {children}
                                </th>
                              ),
                              td: ({ children }) => (
                                <td className="px-8 py-5 text-sm text-gray-800 font-medium border-b border-gray-100/80">
                                  {children}
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
                      onClick={() => handleFeedback(index, 'positive')}
                      className="h-6 w-6 p-0 hover:bg-green-100"
                    >
                      <ThumbsUp className="h-3 w-3 text-green-600" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleFeedback(index, 'negative')}
                      className="h-6 w-6 p-0 hover:bg-red-100"
                    >
                      <ThumbsDown className="h-3 w-3 text-red-600" />
                    </Button>
                  </div>
                )}
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
                  <span className="text-sm text-gray-600">Haen markkinatietoja...</span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="bg-white border-t p-6">
        <div className="max-w-6xl mx-auto flex space-x-3">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Kysy markkinatiedoista, hinnoista tai kilpailutuksesta..."
            className="flex-1 text-base py-3 px-4 rounded-full border-gray-300 focus:border-gray-500 focus:ring-gray-500"
            disabled={isLoading || !sessionActive}
          />
          <Button
            onClick={() => handleSendMessage()}
            disabled={isLoading || !inputValue.trim() || !sessionActive}
            className="px-6 py-3 rounded-full"
            style={{backgroundColor: '#003d3b'}}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Feedback Dialog */}
      <Dialog open={feedbackDialogOpen} onOpenChange={setFeedbackDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Give Feedback</DialogTitle>
            <DialogDescription>
              Help us improve the assistant by sharing your feedback on this response.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="feedback-comment">Comment (optional)</Label>
              <Textarea
                id="feedback-comment"
                value={feedbackComment}
                onChange={(e) => setFeedbackComment(e.target.value)}
                placeholder="Tell us what was good or what could be improved..."
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFeedbackDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitFeedback}>
              Submit Feedback
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CompetitiveBiddingChat;