import React, { useState, useEffect } from 'react';
import { storageService, ERPDocument } from '../lib/storageService';
import { useAuth } from '../hooks/useAuth';
import { useWorkspace } from '../hooks/useWorkspace';
import { ERPUpload } from './ERPUpload';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { FileSpreadsheet, Download, Trash2, AlertCircle, Eye, Database } from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog';

export const ERPManager: React.FC = () => {
  const [documents, setDocuments] = useState<ERPDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<ERPDocument | null>(null);
  const { user } = useAuth();
  const { currentWorkspace, workspaceConfig } = useWorkspace();

  const loadDocuments = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const userDocs = await storageService.getUserERPDocuments(user.uid, currentWorkspace);
      setDocuments(userDocs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load ERP documents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, [user]);


  const handleUploadComplete = (newDoc: ERPDocument) => {
    setDocuments([newDoc]); // Replace existing document
  };

  const handleDelete = async (doc: ERPDocument) => {
    if (!doc.id || !confirm(`Delete "${doc.name}"? This will remove your ERP simulation data.`)) return;

    try {
      await storageService.deleteERPDocument(doc.id, doc.storageUrl, currentWorkspace);
      setDocuments([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete document');
    }
  };

  const handleReplaceData = () => {
    if (documents.length > 0 && !confirm('Replace current ERP data? This will delete your existing data. After confirming, use the drag & drop area above to upload a new file.')) {
      return;
    }
    // Just delete current data, user can then drag & drop new file
    if (documents[0]?.id) {
      handleDelete(documents[0]);
    }
  };

  const handleClearAllDocuments = async () => {
    if (!user) return;
    
    if (!confirm(`Clear all ${currentWorkspace} ERP documents? This will delete ALL your existing data in this workspace.`)) {
      return;
    }
    
    try {
      setLoading(true);
      await storageService.deleteUserERPDocuments(user.uid, currentWorkspace);
      await loadDocuments(); // Refresh the list
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear documents');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (doc: ERPDocument) => {
    try {
      const content = await storageService.downloadERPDocument(doc);
      
      // Create blob and download as CSV
      const blob = new Blob([content], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.name.replace(/\.(xlsx|xls)$/, '.csv');
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to download document');
    }
  };

  const handlePreview = (doc: ERPDocument) => {
    setPreviewDoc(doc);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const renderPreviewTable = (doc: ERPDocument) => {
    if (!doc.jsonData || doc.jsonData.length === 0) return null;
    
    const maxRows = 10; // Limit preview to first 10 rows
    const previewData = doc.jsonData.slice(0, maxRows);
    const headers = Object.keys(doc.jsonData[0] || {});
    
    return (
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm border-collapse border border-gray-300">
          <thead>
            <tr className="bg-gray-50">
              {headers.map((header, index) => (
                <th key={index} className="border border-gray-300 px-2 py-1 text-left font-medium">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {previewData.map((row, rowIndex) => (
              <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                {headers.map((header, colIndex) => (
                  <td key={colIndex} className="border border-gray-300 px-2 py-1">
                    {String(row[header] || '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {doc.jsonData.length > maxRows && (
          <p className="text-xs text-gray-500 mt-2">
            Showing first {maxRows} rows of {doc.jsonData.length} total rows
          </p>
        )}
      </div>
    );
  };

  if (!user) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-gray-600">Please log in to manage ERP documents</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <ERPUpload onUploadComplete={handleUploadComplete} />
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            {workspaceConfig[currentWorkspace].erpTitle}
          </CardTitle>
          <CardDescription>
            {currentWorkspace === 'purchaser' 
              ? 'Your uploaded Excel file simulates purchase order data from your ERP system'
              : 'Your uploaded Excel file simulates sales invoice data from your ERP system'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {loading ? (
            <p className="text-center py-8 text-gray-600">Loading ERP data...</p>
          ) : documents.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-600 mb-4">
                No ERP data uploaded yet. Use the drag & drop area above to upload your structured Excel file.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-between items-center mb-4">
                <p className="text-sm text-gray-600">
                  <strong>Current ERP simulation data:</strong> Only one Excel file can be active at a time.
                </p>
                <div className="flex gap-2">
                  <Button 
                    onClick={handleClearAllDocuments} 
                    variant="outline"
                    className="text-red-600 border-red-200 hover:bg-red-50"
                    size="sm"
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Clear All
                  </Button>
                  <Button 
                    onClick={handleReplaceData} 
                    variant="outline"
                    className="text-blue-600 border-blue-200 hover:bg-blue-50"
                  >
                    Replace Data
                  </Button>
                </div>
              </div>
              
              {documents.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between p-4 border rounded-lg bg-green-50 border-green-200">
                  <div className="flex items-center space-x-3">
                    <FileSpreadsheet className="w-8 h-8 text-green-500" />
                    <div>
                      <h3 className="font-medium">{doc.name}</h3>
                      <div className="flex items-center space-x-2 text-sm text-gray-500">
                        <Badge variant="secondary">{doc.originalFormat}</Badge>
                        <span>{formatFileSize(doc.size)}</span>
                        <span>•</span>
                        <span>{new Date(doc.uploadedAt).toLocaleDateString()}</span>
                        {doc.headers && (
                          <>
                            <span>•</span>
                            <span>{doc.headers.length} columns</span>
                          </>
                        )}
                        {doc.rawData && (
                          <>
                            <span>•</span>
                            <span>{doc.rawData.length} rows</span>
                          </>
                        )}
                        {doc.sheets && doc.sheets.length > 1 && (
                          <>
                            <span>•</span>
                            <span>{doc.sheets.length} sheets</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePreview(doc)}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          Preview
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>Data Preview: {doc.name}</DialogTitle>
                          <DialogDescription>
                            Preview of the processed Excel/CSV data
                          </DialogDescription>
                        </DialogHeader>
                        {renderPreviewTable(doc)}
                      </DialogContent>
                    </Dialog>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownload(doc)}
                    >
                      <Download className="w-4 h-4 mr-1" />
                      CSV
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(doc)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};