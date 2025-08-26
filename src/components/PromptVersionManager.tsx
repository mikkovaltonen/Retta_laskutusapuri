import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, Save, History, Clock, Maximize2, Minimize2 } from "lucide-react";
import { toast } from "sonner";
import { 
  SystemPromptVersion, 
  savePromptVersion, 
  loadLatestPrompt, 
  getPromptHistory,
  getPromptVersion
} from "@/lib/firestoreService";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface PromptVersionManagerProps {
  onPromptChange?: (prompt: string) => void;
  currentPrompt?: string;
}

const PromptVersionManager: React.FC<PromptVersionManagerProps> = ({ 
  onPromptChange, 
  currentPrompt = '' 
}) => {
  const { user } = useAuth();
  const [prompt, setPrompt] = useState(currentPrompt);
  const [evaluation, setEvaluation] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [versions, setVersions] = useState<SystemPromptVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<SystemPromptVersion | null>(null);
  const [activeTab, setActiveTab] = useState<'editor' | 'history'>('editor');
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Sample prompt - loaded from file or fallback
  const [samplePrompt, setSamplePrompt] = useState<string>('');

  // Load sample prompt from file
  useEffect(() => {
    const loadSamplePrompt = async () => {
      try {
        const response = await fetch('/invoicing_prompt.md');
        if (response.ok) {
          const content = await response.text();
          setSamplePrompt(content.trim());
        } else {
          console.error(`Failed to load sample prompt: HTTP ${response.status}`);
        }
      } catch (error) {
        console.error('Failed to load sample prompt:', error);
      }
    };

    loadSamplePrompt();
  }, []);

  // Load initial data
  useEffect(() => {
    if (user?.uid) {
      loadInitialData();
    }
  }, [user?.uid]);

  // Update parent when prompt changes
  useEffect(() => {
    if (onPromptChange) {
      onPromptChange(prompt);
    }
  }, [prompt, onPromptChange]);

  const loadInitialData = async () => {
    if (!user?.uid) return;

    setIsLoading(true);
    try {
      // Load latest prompt for this user
      const latestPrompt = await loadLatestPrompt(user.uid, 'invoicer');
      if (latestPrompt) {
        setPrompt(latestPrompt);
      } else {
        // No default prompt - user needs to create or download sample
        setPrompt('');
      }

      // Load version history
      await loadVersionHistory();
    } catch (error) {
      console.error('Error loading initial data:', error);
      toast.error('Failed to load prompt data');
    } finally {
      setIsLoading(false);
    }
  };

  const loadVersionHistory = async () => {
    if (!user?.uid) return;

    try {
      const history = await getPromptHistory(user.uid, 'invoicer');
      setVersions(history);
    } catch (error) {
      console.error('Error loading version history:', error);
    }
  };

  const handleSaveVersion = async () => {
    if (!user?.uid) {
      toast.error('User not authenticated');
      return;
    }

    if (!prompt.trim()) {
      toast.error('Prompt cannot be empty');
      return;
    }

    setIsLoading(true);
    try {
      const versionNumber = await savePromptVersion(
        user.uid,
        prompt,
        evaluation,
        undefined, // Use default AI model from environment
        user.email || undefined,
        'invoicer'
      );
      
      toast.success(`Saved as version ${versionNumber}`);
      setEvaluation(''); // Clear evaluation after saving
      await loadVersionHistory(); // Reload history
    } catch (error) {
      console.error('Error saving prompt version:', error);
      toast.error('Failed to save prompt version');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadVersion = async (version: SystemPromptVersion) => {
    setSelectedVersion(version);
    setPrompt(version.systemPrompt);
    setEvaluation(version.evaluation);
    setActiveTab('editor');
    toast.success(`Loaded version ${version.version}`);
  };

  const handleLoadLatest = async () => {
    if (!user?.uid) {
      toast.error('User not authenticated');
      return;
    }

    setIsLoading(true);
    try {
      const latestPrompt = await loadLatestPrompt(user.uid, 'invoicer');
      if (latestPrompt) {
        setPrompt(latestPrompt);
        setEvaluation('');
        setSelectedVersion(null);
        toast.success('Loaded latest prompt version');
      } else {
        toast.info('No saved prompts found');
      }
    } catch (error) {
      console.error('Error loading latest prompt:', error);
      toast.error('Failed to load latest prompt');
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };


  const handleLoadSamplePrompt = () => {
    if (samplePrompt.trim()) {
      setPrompt(samplePrompt);
      toast.success('Sample invoicing prompt loaded! You can now edit and save it.');
    } else {
      toast.error('Sample prompt file is empty or missing. Please add content to /public/invoicing_prompt.md');
      console.error('Sample prompt file /public/invoicing_prompt.md is empty or missing');
    }
  };

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'editor' | 'history')}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="editor">Prompt Editor</TabsTrigger>
          <TabsTrigger value="history">Version History</TabsTrigger>
        </TabsList>

        <TabsContent value="editor" className="space-y-4">
          <Card>
            <CardHeader className="flex items-center justify-between">
              <CardTitle>
                <div className="flex items-center gap-2">
                  <Save className="h-5 w-5" />
                  System Prompt Editor
                  {selectedVersion && (
                    <Badge variant="outline">
                      Version {selectedVersion.version}
                    </Badge>
                  )}
                </div>
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsFullscreen(true)}
                title="Open in fullscreen"
                className="h-8 w-8 p-0"
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="prompt">System Prompt (Invoicing Assistant)</Label>
                  <span className="text-xs text-gray-500">{prompt.length} characters</span>
                </div>
                <Textarea
                  id="prompt"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Enter your system prompt for the invoicing AI assistant..."
                  className="min-h-[200px] font-mono text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="evaluation">Evaluation Notes</Label>
                <Textarea
                  id="evaluation"
                  value={evaluation}
                  onChange={(e) => setEvaluation(e.target.value)}
                  placeholder="Add your evaluation notes for this prompt version..."
                  className="min-h-[100px]"
                />
              </div>

              {/* Sample prompt buttons - show when no prompt exists */}
              {!prompt.trim() && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
                  <p className="text-sm text-blue-800">
                    <strong>Get started:</strong> Load a sample invoicing prompt or create your own from scratch.
                  </p>
                  <div className="flex gap-2">
                    <Button 
                      onClick={handleLoadSamplePrompt} 
                      variant="outline"
                      className="flex-1 border-blue-300 text-blue-700 hover:bg-blue-100"
                    >
                      Load Sample Invoicing Prompt
                    </Button>
                  </div>
                </div>
              )}

              {/* Reset button for existing users */}
              {prompt.trim() && samplePrompt.trim() && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3">
                  <p className="text-sm text-amber-800">
                    <strong>Note:</strong> You can reset to the latest sample invoicing prompt if you want to start fresh.
                  </p>
                  <Button 
                    onClick={() => {
                      setPrompt(samplePrompt);
                      setEvaluation('Resetted to latest sample prompt');
                      toast.success('Resetted to latest sample invoicing prompt! Remember to save as a new version.');
                    }} 
                    variant="outline"
                    className="w-full border-amber-300 text-amber-700 hover:bg-amber-100"
                  >
                    Reset to Latest Sample Prompt
                  </Button>
                </div>
              )}

              <div className="flex gap-2">
                <Button 
                  onClick={handleSaveVersion} 
                  disabled={isLoading || !prompt.trim()}
                  className="flex-1"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save New Version
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Version History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : versions.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No versions saved yet. Create your first version in the editor.
                </div>
              ) : (
                <div className="space-y-3">
                  {versions.map((version) => (
                    <Card 
                      key={version.id} 
                      className={`cursor-pointer transition-colors hover:bg-gray-50 ${
                        selectedVersion?.id === version.id ? 'ring-2 ring-blue-500' : ''
                      }`}
                      onClick={() => handleLoadVersion(version)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center gap-2">
                              <Badge>v{version.version}</Badge>
                              {version.version === Math.max(...versions.map(v => v.version)) && (
                                <Badge variant="default">Latest</Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-500">
                              <Clock className="h-4 w-4" />
                              {formatDate(version.savedDate)}
                            </div>
                            {version.evaluation && (
                              <div className="text-sm text-gray-700 mt-2">
                                <strong>Evaluation:</strong> {version.evaluation.substring(0, 100)}
                                {version.evaluation.length > 100 && '...'}
                              </div>
                            )}
                          </div>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleLoadVersion(version);
                            }}
                          >
                            Load
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Fullscreen Dialog */}
      <Dialog open={isFullscreen} onOpenChange={setIsFullscreen}>
        <DialogContent className="max-w-none w-[95vw] h-[95vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Save className="h-5 w-5" />
                System Prompt Editor (Fullscreen)
                {selectedVersion && (
                  <Badge variant="outline">
                    Version {selectedVersion.version}
                  </Badge>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsFullscreen(false)}
                title="Exit fullscreen"
              >
                <Minimize2 className="h-4 w-4" />
              </Button>
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto space-y-4 py-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="prompt-fullscreen">System Prompt (Invoicing Assistant)</Label>
                <span className="text-xs text-gray-500">{prompt.length} characters</span>
              </div>
              <Textarea
                id="prompt-fullscreen"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Enter your system prompt for the invoicing AI assistant..."
                className="min-h-[400px] font-mono text-sm resize-none"
                style={{ height: 'calc(100vh - 400px)' }}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="evaluation-fullscreen">Evaluation Notes</Label>
              <Textarea
                id="evaluation-fullscreen"
                value={evaluation}
                onChange={(e) => setEvaluation(e.target.value)}
                placeholder="Add your evaluation notes for this prompt version..."
                className="min-h-[100px]"
              />
            </div>

            {/* Sample prompt section in fullscreen */}
            {prompt.trim() && samplePrompt.trim() && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <Button 
                  onClick={() => {
                    setPrompt(samplePrompt);
                    setEvaluation('Resetted to latest sample prompt');
                    toast.success('Resetted to latest sample invoicing prompt!');
                  }} 
                  variant="outline"
                  size="sm"
                  className="border-amber-300 text-amber-700 hover:bg-amber-100"
                >
                  Reset to Latest Sample Prompt
                </Button>
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-4 border-t flex-shrink-0">
            <Button 
              onClick={handleSaveVersion} 
              disabled={isLoading || !prompt.trim()}
              className="flex-1"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save New Version'
              )}
            </Button>
            <Button 
              onClick={handleLoadLatest} 
              disabled={isLoading}
              variant="outline"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading...
                </>
              ) : (
                'Load Latest'
              )}
            </Button>
            <Button 
              onClick={() => setIsFullscreen(false)}
              variant="ghost"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PromptVersionManager;