import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { storageService } from '../lib/storageService';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Database, MessageSquare, FileText, Download, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';
import { ChatAI } from './ChatAI';

interface DatabaseRecord {
  id: string;
  [key: string]: unknown;
}

interface KnowledgeDocument {
  id: string;
  name: string;
  content: string;
  uploadedAt: Date;
}

export const ChatLayout: React.FC = () => {
  const [hinnastoData, setHinnastoData] = useState<DatabaseRecord[]>([]);
  const [tilausData, setTilausData] = useState<DatabaseRecord[]>([]);
  const [myyntilaskutData, setMyyntilaskutData] = useState<DatabaseRecord[]>([]);
  const [knowledgeDocuments, setKnowledgeDocuments] = useState<KnowledgeDocument[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<KnowledgeDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeDataTab, setActiveDataTab] = useState<'hinnasto' | 'tilaus' | 'myyntilaskut'>('hinnasto');
  const { user } = useAuth();

  const loadDatabaseData = async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      // Load hinnasto data
      const hinnastoDocuments = await storageService.getUserHinnastoDocuments(user.uid);
      const hinnastoRecords = hinnastoDocuments.flatMap(doc => 
        doc.jsonData?.map((record, index) => ({
          id: `${doc.id}_${index}`,
          ...record
        })) || []
      );
      setHinnastoData(hinnastoRecords.slice(0, 20)); // Show first 20 records

      // Load tilaus data
      const tilausDocuments = await storageService.getUserTilausDocuments(user.uid);
      const tilausRecords = tilausDocuments.flatMap(doc => 
        doc.jsonData?.map((record, index) => ({
          id: `${doc.id}_${index}`,
          ...record
        })) || []
      );
      setTilausData(tilausRecords.slice(0, 20)); // Show first 20 records

      // Load myyntilaskut data
      const myyntilaskutDocuments = await storageService.getUserMyyntilaskutDocuments(user.uid);
      const myyntilaskutRecords = myyntilaskutDocuments.flatMap(doc => 
        doc.jsonData?.map((record, index) => ({
          id: `${doc.id}_${index}`,
          ...record
        })) || []
      );
      setMyyntilaskutData(myyntilaskutRecords.slice(0, 20)); // Show first 20 records

      // Load knowledge documents
      const knowledgeDocs = await storageService.getUserDocuments(user.uid);
      setKnowledgeDocuments(knowledgeDocs);
      if (knowledgeDocs.length > 0 && !selectedDocument) {
        setSelectedDocument(knowledgeDocs[0]);
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadDatabaseData();
    }
  }, [user]);

  const downloadAsCSV = (data: DatabaseRecord[], filename: string) => {
    if (data.length === 0) return;
    
    const headers = Object.keys(data[0]).filter(key => !['id'].includes(key));
    const csvContent = [
      headers.join(','),
      ...data.map(row => 
        headers.map(header => `"${String(row[header] || '').replace(/"/g, '""')}"`).join(',')
      )
    ].join('\\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const renderDataTable = (data: DatabaseRecord[], title: string) => {
    if (data.length === 0) {
      const emptyMessage = title === 'Myyntilaskut' 
        ? 'Luo myyntilasku pyytämällä myyntilaskun AI genrointia chatbotilta'
        : 'Lataa data Admin-sivun kautta';
      
      return (
        <div className="text-center py-8 text-gray-500">
          <Database className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p>Ei {title.toLowerCase()}-dataa saatavilla</p>
          <p className="text-sm">{emptyMessage}</p>
        </div>
      );
    }

    const headers = Object.keys(data[0]).filter(key => !['id'].includes(key));
    const displayHeaders = headers.slice(0, 4); // Show max 4 columns

    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{data.length} riviä</Badge>
            {headers.length > 4 && (
              <Badge variant="outline">+{headers.length - 4} saraketta</Badge>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadAsCSV(data, title.toLowerCase())}
          >
            <Download className="w-4 h-4 mr-2" />
            CSV
          </Button>
        </div>
        
        <div className="overflow-x-auto max-h-96">
          <table className="w-full text-sm border-collapse border border-gray-300">
            <thead>
              <tr className="bg-gray-100">
                {displayHeaders.map(header => (
                  <th key={header} className="border border-gray-300 px-2 py-1 text-left font-medium">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.slice(0, 10).map((record, index) => (
                <tr key={record.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  {displayHeaders.map(header => (
                    <td key={header} className="border border-gray-300 px-2 py-1">
                      {String(record[header] || '-')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {data.length > 10 && (
            <p className="text-xs text-gray-500 mt-2 text-center">
              ... ja {data.length - 10} riviä lisää
            </p>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="h-full grid grid-cols-2 gap-4">
      {/* Left Column - Database Data (Top) and Knowledge Documents (Bottom) */}
      <div className="flex flex-col gap-4">
        {/* Top: Database Data */}
        <Card className="flex-1 min-h-0">
          <CardHeader className="pb-3">
            <div className="flex justify-between items-center">
              <CardTitle className="flex items-center gap-2">
                <Database className="w-5 h-5" />
                ERP Data
              </CardTitle>
              <CardDescription className="mt-2">
                Katso erp:ssä olevila laskutuksen lähtötietoja ja editoi luomiasi laskuja
              </CardDescription>
              <Button
                variant="outline"
                size="sm"
                onClick={loadDatabaseData}
                disabled={loading}
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0 flex-1 min-h-0">
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            <Tabs value={activeDataTab} onValueChange={(value) => setActiveDataTab(value as 'hinnasto' | 'tilaus' | 'myyntilaskut')}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="hinnasto">Hinnasto</TabsTrigger>
                <TabsTrigger value="tilaus">Tilaukset</TabsTrigger>
                <TabsTrigger value="myyntilaskut">Myyntilaskut</TabsTrigger>
              </TabsList>
              
              <TabsContent value="hinnasto" className="mt-4">
                {renderDataTable(hinnastoData, 'Hinnasto')}
              </TabsContent>
              
              <TabsContent value="tilaus" className="mt-4">
                {renderDataTable(tilausData, 'Tilaus')}
              </TabsContent>
              
              <TabsContent value="myyntilaskut" className="mt-4">
                {renderDataTable(myyntilaskutData, 'Myyntilaskut')}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Bottom: Knowledge Documents */}
        <Card className="flex-1 min-h-0">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Tietämyksen Dokumentit
            </CardTitle>
            {knowledgeDocuments.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {knowledgeDocuments.map(doc => (
                  <Button
                    key={doc.id}
                    variant={selectedDocument?.id === doc.id ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedDocument(doc)}
                  >
                    {doc.name}
                  </Button>
                ))}
              </div>
            )}
          </CardHeader>
          <CardContent className="pt-0 flex-1 min-h-0">
            {selectedDocument ? (
              <div className="h-full overflow-y-auto">
                <div className="prose prose-sm max-w-none">
                  <pre className="whitespace-pre-wrap text-sm bg-gray-50 p-4 rounded border">
                    {selectedDocument.content}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>Ei dokumentteja saatavilla</p>
                <p className="text-sm">Lataa markdown-dokumentteja Admin-sivun kautta</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Right Column - Chatbot */}
      <Card className="flex flex-col min-h-0">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Myyntilaskujen AI generoija
          </CardTitle>
          <CardDescription>
            Anna AI:lle tehtäviä laskujen ja lasku selvitysten generoimiseksi.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0 flex-1 min-h-0">
          <ChatAI className="h-full" />
        </CardContent>
      </Card>
    </div>
  );
};