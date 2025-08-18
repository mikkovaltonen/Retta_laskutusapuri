import React, { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { storageService, ERPDocument } from '../lib/storageService';
import { useAuth } from '../hooks/useAuth';
import { useWorkspace } from '../hooks/useWorkspace';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { Upload, FileSpreadsheet, AlertCircle, Database, Download, Trash2, Eye, Info } from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog';
import { toast } from 'sonner';

interface PriceListUploadProps {
  onUploadComplete?: (document: ERPDocument) => void;
}

export const PriceListUpload: React.FC<PriceListUploadProps> = ({
  onUploadComplete
}) => {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [documents, setDocuments] = useState<ERPDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewDoc, setPreviewDoc] = useState<ERPDocument | null>(null);
  const [showFormatDialog, setShowFormatDialog] = useState(false);
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();

  const loadDocuments = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const userDocs = await storageService.getUserHinnastoDocuments(user.uid);
      setDocuments(userDocs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load hinnasto documents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, [user]);

  const handleUploadComplete = (newDoc: ERPDocument) => {
    setDocuments([newDoc]); // Replace existing document
    onUploadComplete?.(newDoc);
  };

  const handleDeleteDocument = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      await storageService.deleteHinnastoDocuments(user.uid);
      setDocuments([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete documents');
    } finally {
      setLoading(false);
    }
  };

  const downloadAsCSV = (document: ERPDocument) => {
    if (!document.jsonData || document.jsonData.length === 0) return;
    
    const headers = Object.keys(document.jsonData[0]);
    const csvContent = [
      headers.join(','),
      ...document.jsonData.map(row => 
        headers.map(header => `"${String(row[header] || '').replace(/"/g, '""')}"`).join(',')
      )
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${document.name.replace(/\.[^/.]+$/, '')}_hinnasto.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (!user) {
      setError('Please log in to upload files');
      return;
    }

    const file = acceptedFiles[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['.xlsx', '.xls'];
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    
    if (!allowedTypes.includes(fileExtension)) {
      setError('Only Excel (.xlsx, .xls) files are supported');
      return;
    }

    // Validate file size (25MB limit for Excel files)
    if (file.size > 25 * 1024 * 1024) {
      setError('File size must be less than 25MB');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const uploadedDoc = await storageService.uploadHinnastoDocument(file, user.uid);
      handleUploadComplete(uploadedDoc);
      toast.success('Hinnasto data ladattu onnistuneesti!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }, [user, onUploadComplete, currentWorkspace]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls']
    },
    multiple: false,
    disabled: uploading || !user
  });

  const loadSamplePriceListData = async () => {
    if (!user) {
      toast.error('Please log in to load sample data');
      return;
    }
    
    try {
      setUploading(true);
      setError(null);
      
      // Fetch the sample Excel file from public directory with cache busting
      const cacheBuster = Date.now() + Math.random().toString(36).substring(7);
      const sampleFile = 'Ostomyynti_AI_botti_testi_excel.xlsx';
      const response = await fetch(`/${sampleFile}?v=${cacheBuster}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch sample data: ${response.status}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      
      // Create a File-like object from the fetched data - keep original filename
      const fileName = `hinnasto_${sampleFile}`;
      
      const fileObject = {
        name: fileName,
        size: arrayBuffer.byteLength,
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        lastModified: Date.now(),
        arrayBuffer: async () => arrayBuffer,
        // Required for File interface compatibility
        webkitRelativePath: '',
        text: async () => '', // Not used for Excel files
        stream: () => new Blob([arrayBuffer]).stream(),
        slice: (start?: number, end?: number) => new Blob([arrayBuffer]).slice(start, end)
      } as File;
      
      // Upload using the hinnasto upload function
      const uploadedDoc = await storageService.uploadHinnastoDocument(fileObject, user.uid);
      handleUploadComplete(uploadedDoc);
      toast.success('Hinnasto data ladattu onnistuneesti!');
      console.log('✅ Successfully loaded sample price list data');
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load sample price list data';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5" />
              Hinnasto Datan Lataus
            </CardTitle>
            <CardDescription>
              Lataa Excel-tiedostosi hinnasto-datalla
            </CardDescription>
          </div>
          <Dialog open={showFormatDialog} onOpenChange={setShowFormatDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Info className="w-4 h-4 mr-2" />
                Tiedostomuoto
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Hinnaston tiedostomuoto</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Tuetut tiedostotyypit:</h4>
                  <Badge variant="secondary">.xlsx</Badge>
                  <Badge variant="secondary" className="ml-2">.xls</Badge>
                </div>
                
                <div>
                  <h4 className="font-medium mb-2">Vaaditut sarakkeet:</h4>
                  <div className="bg-gray-50 p-3 rounded-md">
                    <table className="text-sm w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left pb-2">Sarake</th>
                          <th className="text-left pb-2">Kuvaus</th>
                        </tr>
                      </thead>
                      <tbody className="space-y-1">
                        <tr>
                          <td className="font-mono py-1">Tuotetunnus</td>
                          <td className="text-gray-600">Tuotteen koodi</td>
                        </tr>
                        <tr>
                          <td className="font-mono py-1">Tuote</td>
                          <td className="text-gray-600">Tuotteen nimi</td>
                        </tr>
                        <tr>
                          <td className="font-mono py-1">Myyntihinta</td>
                          <td className="text-gray-600">Asiakashinta (€)</td>
                        </tr>
                        <tr>
                          <td className="font-mono py-1">Ostohinta</td>
                          <td className="text-gray-600">Sisäänostohinta (€)</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
                
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    Excel-tiedostossa tulee olla "Hinnasto" niminen välilehti
                  </AlertDescription>
                </Alert>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div
          {...getRootProps()}
          className={`
            border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
            ${isDragActive ? 'border-primary bg-primary/5' : 'border-gray-300'}
            ${uploading ? 'opacity-50 cursor-not-allowed' : ''}
            ${!user ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          <input {...getInputProps()} />
          
          <FileSpreadsheet className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          
          {uploading ? (
            <p className="text-gray-600">Käsitellään tiedostoa...</p>
          ) : !user ? (
            <p className="text-gray-600">Kirjaudu sisään ladataksesi tiedostoja</p>
          ) : isDragActive ? (
            <p className="text-primary">Pudota tiedosto tähän...</p>
          ) : (
            <>
              <p className="text-gray-600 mb-2">
                Vedä Excel-tiedosto tähän tai klikkaa valitaksesi
              </p>
              <Badge variant="outline" className="text-xs">
                Excel .xlsx/.xls • max 25MB
              </Badge>
            </>
          )}
        </div>

        <div className="mt-4">
          <Button
            onClick={loadSamplePriceListData}
            disabled={uploading}
            className="w-full bg-green-600 hover:bg-green-700 text-white"
          >
            📊 Lataa esimerkki hinnasto data
          </Button>
        </div>

        {/* File Management Section */}
        {documents.length > 0 && (
          <>
            <Separator className="my-6" />
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Ladatut Hinnasto Tiedostot</h3>
              
              {loading ? (
                <div className="text-center py-4">Loading files...</div>
              ) : (
                <div className="space-y-3">
                  {documents.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between p-4 border rounded-lg bg-gray-50">
                      <div className="flex items-center space-x-3">
                        <FileSpreadsheet className="w-8 h-8 text-green-600" />
                        <div>
                          <p className="font-medium text-gray-900">{doc.name}</p>
                          <div className="flex items-center space-x-2 text-sm text-gray-500">
                            <Badge variant="secondary">{doc.originalFormat?.toUpperCase()}</Badge>
                            <span>{doc.jsonData?.length || 0} rivit</span>
                            <span>{new Date(doc.uploadedAt).toLocaleDateString('fi-FI')}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setPreviewDoc(doc)}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="sm:max-w-[800px] max-h-[600px]">
                            <DialogHeader>
                              <DialogTitle>Hinnasto Preview: {doc.name}</DialogTitle>
                              <DialogDescription>
                                Ensimmäiset 10 riviä datasta
                              </DialogDescription>
                            </DialogHeader>
                            {doc.jsonData && doc.jsonData.length > 0 && (
                              <div className="overflow-auto max-h-[400px]">
                                <table className="w-full text-sm border-collapse border border-gray-300">
                                  <thead>
                                    <tr className="bg-gray-100">
                                      {Object.keys(doc.jsonData[0]).map((header) => (
                                        <th key={header} className="border border-gray-300 px-2 py-1 text-left font-medium">
                                          {header}
                                        </th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {doc.jsonData.slice(0, 10).map((row, index) => (
                                      <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                        {Object.keys(doc.jsonData[0]).map((header) => (
                                          <td key={header} className="border border-gray-300 px-2 py-1">
                                            {String(row[header] || '')}
                                          </td>
                                        ))}
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                                {doc.jsonData.length > 10 && (
                                  <p className="text-sm text-gray-500 mt-2 text-center">
                                    ... ja {doc.jsonData.length - 10} riviä lisää
                                  </p>
                                )}
                              </div>
                            )}
                          </DialogContent>
                        </Dialog>
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => downloadAsCSV(doc)}
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleDeleteDocument}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

      </CardContent>
    </Card>
  );
};