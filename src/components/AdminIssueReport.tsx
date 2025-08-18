import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Loader2, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  MessageCircle, 
  Search,
  FileText,
  Database,
  Bot
} from "lucide-react";
import { toast } from "sonner";
import { 
  ContinuousImprovementSession, 
  getNegativeFeedbackSessions,
  updateIssueStatus
} from "@/lib/firestoreService";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";
import ChatHistoryDialog from "./ChatHistoryDialog";

const AdminIssueReport: React.FC = () => {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const [issues, setIssues] = useState<ContinuousImprovementSession[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'fixed' | 'not_fixed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [chatDialogOpen, setChatDialogOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<ContinuousImprovementSession | null>(null);
  const [expandedIssue, setExpandedIssue] = useState<string | null>(null);

  useEffect(() => {
    loadIssues();
  }, []);

  const loadIssues = async () => {
    setIsLoading(true);
    try {
      // Load ALL users' negative feedback (admin view)
      const negativeFeedback = await getNegativeFeedbackSessions(undefined, 'invoicer');
      setIssues(negativeFeedback);
    } catch (error) {
      console.error('Error loading issues:', error);
      toast.error('Failed to load issues');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusChange = async (sessionId: string, newStatus: 'fixed' | 'not_fixed') => {
    try {
      await updateIssueStatus(sessionId, newStatus, 'invoicer');
      
      // Update local state
      setIssues(prev => prev.map(issue => 
        issue.id === sessionId 
          ? { ...issue, issueStatus: newStatus }
          : issue
      ));
      
      toast.success(`Issue marked as ${newStatus === 'fixed' ? 'fixed' : 'not fixed'}`);
    } catch (error) {
      console.error('Error updating issue status:', error);
      toast.error('Failed to update issue status');
    }
  };

  const getStatusBadge = (status?: 'fixed' | 'not_fixed') => {
    if (!status) {
      return (
        <Badge variant="outline" className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          Pending
        </Badge>
      );
    }
    
    return status === 'fixed' ? (
      <Badge variant="default" className="bg-green-600 flex items-center gap-1">
        <CheckCircle className="h-3 w-3" />
        Fixed
      </Badge>
    ) : (
      <Badge variant="destructive" className="flex items-center gap-1">
        <AlertTriangle className="h-3 w-3" />
        Not Fixed
      </Badge>
    );
  };

  const parseComprehensiveData = (userComment: string) => {
    try {
      const data = JSON.parse(userComment);
      return {
        userComment: data.userComment || '',
        systemPrompt: data.systemPrompt || '',
        conversationHistory: data.conversationHistory || [],
        ostolaskuData: data.ostolaskuData || [],
        uploadedFileName: data.uploadedFileName || '',
        sessionContext: data.sessionContext || {}
      };
    } catch {
      return {
        userComment: userComment,
        systemPrompt: '',
        conversationHistory: [],
        ostolaskuData: [],
        uploadedFileName: '',
        sessionContext: {}
      };
    }
  };

  const filteredIssues = issues.filter(issue => {
    const statusMatch = statusFilter === 'all' || 
      (statusFilter === 'fixed' && issue.issueStatus === 'fixed') ||
      (statusFilter === 'not_fixed' && (!issue.issueStatus || issue.issueStatus === 'not_fixed'));
    
    if (!searchQuery) return statusMatch;
    
    const data = parseComprehensiveData(issue.userComment || '');
    const searchText = `${data.userComment} ${issue.userId} ${data.uploadedFileName}`.toLowerCase();
    
    return statusMatch && searchText.includes(searchQuery.toLowerCase());
  });

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('fi-FI', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const handleViewChat = (session: ContinuousImprovementSession) => {
    setSelectedSession(session);
    setChatDialogOpen(true);
  };

  const toggleExpanded = (issueId: string) => {
    setExpandedIssue(expandedIssue === issueId ? null : issueId);
  };

  const renderIssueDetails = (issue: ContinuousImprovementSession) => {
    const data = parseComprehensiveData(issue.userComment || '');
    
    return (
      <div className="mt-4 border-t pt-4">
        <Tabs defaultValue="comment" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="comment">Käyttäjän kommentti</TabsTrigger>
            <TabsTrigger value="prompt">AI Prompti</TabsTrigger>
            <TabsTrigger value="conversation">Keskustelu</TabsTrigger>
            <TabsTrigger value="data">Ostolaskudata</TabsTrigger>
          </TabsList>
          
          <TabsContent value="comment" className="space-y-4">
            <div className="bg-red-50 p-4 rounded border">
              <h4 className="font-medium text-red-800 mb-2">🔴 Käyttäjän palaute:</h4>
              <p className="text-sm text-red-700">
                {data.userComment || 'Ei kommenttia annettu (vain thumbs down)'}
              </p>
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <strong>Käyttäjä:</strong> {issue.userId?.substring(0, 12)}...
              </div>
              <div>
                <strong>Aika:</strong> {formatDate(issue.createdDate)}
              </div>
              <div>
                <strong>Session:</strong> {issue.chatSessionKey?.substring(0, 20)}...
              </div>
              <div>
                <strong>Tiedosto:</strong> {data.uploadedFileName || 'Ei tiedostoa'}
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="prompt" className="space-y-4">
            <div>
              <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                <Bot className="h-4 w-4" />
                Käytetty AI-järjestelmäprompti:
              </h4>
              <div className="bg-gray-50 p-3 rounded border max-h-[200px] overflow-y-auto">
                <pre className="text-xs whitespace-pre-wrap">
                  {data.systemPrompt || 'Ei promptia tallennettu'}
                </pre>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="conversation" className="space-y-4">
            <div>
              <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                <MessageCircle className="h-4 w-4" />
                Keskusteluhistoria ({data.conversationHistory.length} viestiä):
              </h4>
              <div className="bg-gray-50 p-3 rounded border max-h-[200px] overflow-y-auto space-y-2">
                {data.conversationHistory.map((msg: {
                  role: string;
                  timestamp: string;
                  content: string;
                  functionCalls?: Array<{ name: string }>;
                }, index: number) => (
                  <div key={index} className="border-b pb-2 last:border-b-0">
                    <div className="text-xs font-medium text-gray-600">
                      {msg.role === 'user' ? '👤 Käyttäjä' : '🤖 AI'} - {new Date(msg.timestamp).toLocaleTimeString()}
                    </div>
                    <div className="text-xs mt-1 text-gray-800">
                      {msg.content?.substring(0, 150)}{msg.content?.length > 150 ? '...' : ''}
                    </div>
                    {msg.functionCalls && msg.functionCalls.length > 0 && (
                      <div className="text-xs text-blue-600 mt-1">
                        🔧 Funktiokutsut: {msg.functionCalls.map((fc) => fc.name).join(', ')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="data" className="space-y-4">
            <div>
              <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                <Database className="h-4 w-4" />
                Ostolaskudata ({data.ostolaskuData.length} riviä):
              </h4>
              {data.ostolaskuData.length > 0 ? (
                <div className="space-y-2">
                  <div className="text-xs text-gray-600">
                    📁 Tiedosto: {data.uploadedFileName || 'Tuntematon'}
                  </div>
                  <div className="bg-gray-50 p-3 rounded border max-h-[200px] overflow-y-auto">
                    <pre className="text-xs">
                      {JSON.stringify(data.ostolaskuData.slice(0, 2), null, 2)}
                      {data.ostolaskuData.length > 2 && `\n... ja ${data.ostolaskuData.length - 2} riviä lisää`}
                    </pre>
                  </div>
                </div>
              ) : (
                <div className="bg-yellow-50 p-3 rounded border">
                  <p className="text-sm text-yellow-700">❌ Ei ostolaskudataa ladattu</p>
                  <p className="text-xs text-yellow-600 mt-1">Tämä saattaa olla syy ongelmaan.</p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              Admin: All User Issues & Negative Feedback
            </CardTitle>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Hae käyttäjän kommentista, user ID:stä..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-64"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Status:</span>
                <Select value={statusFilter} onValueChange={(value: 'all' | 'fixed' | 'not_fixed') => setStatusFilter(value)}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="not_fixed">Not Fixed</SelectItem>
                    <SelectItem value="fixed">Fixed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button 
                variant="outline" 
                onClick={loadIssues}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : filteredIssues.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {statusFilter === 'all' 
                ? 'No issues reported yet.' 
                : `No ${statusFilter === 'fixed' ? 'fixed' : 'unfixed'} issues found.`
              }
            </div>
          ) : (
            <div className="space-y-4">
              {filteredIssues.map((issue, index) => {
                const data = parseComprehensiveData(issue.userComment || '');
                const isExpanded = expandedIssue === issue.id;
                
                return (
                  <Card key={issue.id} className="border-l-4 border-l-red-500">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <Badge variant="outline">#{index + 1}</Badge>
                            {getStatusBadge(issue.issueStatus)}
                            <span className="text-xs text-gray-500">
                              {formatDate(issue.createdDate)}
                            </span>
                            <span className="text-xs text-gray-500">
                              User: {issue.userId?.substring(0, 8)}...
                            </span>
                          </div>
                          
                          <div className="mb-3">
                            <h4 className="font-medium text-sm mb-1">Käyttäjän kommentti:</h4>
                            <p className="text-sm text-gray-700">
                              {data.userComment || 'Ei kommenttia annettu (vain thumbs down)'}
                            </p>
                          </div>
                          
                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            <span>📁 {data.uploadedFileName || 'Ei tiedostoa'}</span>
                            <span>💬 {data.conversationHistory.length} viestiä</span>
                            <span>📊 {data.ostolaskuData.length} ostolaskuriviä</span>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2 ml-4">
                          <Select 
                            value={issue.issueStatus || 'not_fixed'} 
                            onValueChange={(value: 'fixed' | 'not_fixed') => 
                              issue.id && handleStatusChange(issue.id, value)
                            }
                          >
                            <SelectTrigger className="w-28">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="not_fixed">Not Fixed</SelectItem>
                              <SelectItem value="fixed">Fixed</SelectItem>
                            </SelectContent>
                          </Select>
                          
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewChat(issue)}
                            className="flex items-center gap-1"
                          >
                            <MessageCircle className="h-4 w-4" />
                            Chat
                          </Button>
                          
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => toggleExpanded(issue.id!)}
                            className="flex items-center gap-1"
                          >
                            <FileText className="h-4 w-4" />
                            {isExpanded ? 'Piilota' : 'Näytä'} data
                          </Button>
                        </div>
                      </div>
                      
                      {isExpanded && renderIssueDetails(issue)}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Issues</p>
                <p className="text-2xl font-bold">{issues.length}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Fixed Issues</p>
                <p className="text-2xl font-bold text-green-600">
                  {issues.filter(i => i.issueStatus === 'fixed').length}
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Pending Issues</p>
                <p className="text-2xl font-bold text-red-600">
                  {issues.filter(i => !i.issueStatus || i.issueStatus === 'not_fixed').length}
                </p>
              </div>
              <Clock className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chat History Dialog */}
      <ChatHistoryDialog
        open={chatDialogOpen}
        onOpenChange={setChatDialogOpen}
        session={selectedSession}
      />
    </div>
  );
};

export default AdminIssueReport;