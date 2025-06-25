import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { storageService } from '../lib/storageService';
import { deleteDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
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


export const ChatLayout: React.FC = () => {
  const [hinnastoData, setHinnastoData] = useState<DatabaseRecord[]>([]);
  const [tilausData, setTilausData] = useState<DatabaseRecord[]>([]);
  const [myyntilaskutData, setMyyntilaskutData] = useState<DatabaseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeDataTab, setActiveDataTab] = useState<'hinnasto' | 'tilaus' | 'myyntilaskut'>('hinnasto');
  const [leftPanelWidth, setLeftPanelWidth] = useState(50); // Percentage
  const [isDragging, setIsDragging] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [editingCell, setEditingCell] = useState<{rowId: string, field: string} | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const { user } = useAuth();

  const handleMouseDown = useCallback(() => {
    setIsDragging(true);
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    
    const container = document.getElementById('chat-layout-container');
    if (!container) return;
    
    const containerRect = container.getBoundingClientRect();
    const percentage = ((e.clientX - containerRect.left) / containerRect.width) * 100;
    
    // Limit between 25% and 75%
    const clampedPercentage = Math.max(25, Math.min(75, percentage));
    setLeftPanelWidth(clampedPercentage);
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    } else {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

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

      // Load myyntilaskut data in hierarchical format
      const myyntilaskutDocuments = await storageService.getUserMyyntilaskutDocuments(user.uid);
      const invoiceHeaders = myyntilaskutDocuments.flatMap(doc => 
        doc.jsonData?.map((lasku, laskuIndex) => ({
          id: `${doc.id}_${laskuIndex}`,
          docId: doc.id,
          firestoreDocId: lasku.id, // The real Firestore document ID
          asiakasnumero: lasku.asiakasnumero,
          laskuotsikko: lasku.laskuotsikko || 'Myyntilasku',
          luontipaiva: lasku.luontipaiva,
          kokonaissumma: lasku.kokonaissumma,
          rivienMaara: lasku.laskurivit?.length || 0,
          laskurivit: lasku.laskurivit?.map((rivi, riviIndex) => ({
            id: `${doc.id}_${laskuIndex}_${riviIndex}`,
            invoiceId: `${doc.id}_${laskuIndex}`,
            ...rivi
          })) || []
        })) || []
      );
      setMyyntilaskutData(invoiceHeaders.slice(0, 20)); // Show first 20 invoices

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

  // Force re-render of tables when panel width changes
  useEffect(() => {
    // This useEffect will trigger re-render when leftPanelWidth changes
    // The tables will automatically recalculate visible columns
  }, [leftPanelWidth]);

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

  const calculateVisibleColumns = (panelWidth: number) => {
    // Calculate how many columns can fit based on panel width
    // Account for card padding, gaps, and minimum readable width
    const availableWidth = (panelWidth * window.innerWidth / 100) - 80; // Subtract padding
    const columnWidth = 120; // Minimum readable column width
    const minColumns = 2;
    const maxColumns = Math.floor(availableWidth / columnWidth);
    return Math.max(minColumns, Math.min(maxColumns, 10)); // Cap at 10 columns for performance
  };

  const saveCell = async (rowId: string, field: string, value: string) => {
    if (!user) return;
    
    try {
      // Find the invoice and update the specific field
      const updatedData = myyntilaskutData.map(invoice => {
        if (invoice.id === rowId) {
          return { ...invoice, [field]: value };
        }
        // Also check if it's a line item
        if (invoice.laskurivit) {
          const updatedLines = invoice.laskurivit.map(line => {
            if (line.id === rowId) {
              return { ...line, [field]: value };
            }
            return line;
          });
          if (updatedLines !== invoice.laskurivit) {
            return { ...invoice, laskurivit: updatedLines };
          }
        }
        return invoice;
      });
      
      setMyyntilaskutData(updatedData);
      // TODO: Save to Firestore
      console.log('Saved:', { rowId, field, value });
    } catch (error) {
      console.error('Failed to save:', error);
    }
  };

  const deleteInvoiceHeader = async (invoiceId: string) => {
    if (!user || !confirm('Oletko varma että haluat poistaa laskun ja kaikki sen rivit?')) return;
    
    try {
      // Find the invoice to get its firestoreDocId
      const invoice = myyntilaskutData.find(inv => inv.id === invoiceId);
      if (!invoice || !invoice.firestoreDocId) {
        throw new Error('Invoice not found or missing Firestore document ID');
      }
      
      console.log('Deleting invoice from Firestore:', { 
        invoiceId, 
        docId: invoice.docId, 
        firestoreDocId: invoice.firestoreDocId 
      });
      
      // Delete from Firestore using the real Firestore document ID
      await deleteDoc(doc(db, 'myyntilaskut', invoice.firestoreDocId));
      
      // Update UI state
      const updatedData = myyntilaskutData.filter(inv => inv.id !== invoiceId);
      setMyyntilaskutData(updatedData);
      if (selectedInvoiceId === invoiceId) {
        setSelectedInvoiceId(null);
      }
      
      console.log('✅ Invoice deleted successfully:', invoiceId);
    } catch (error) {
      console.error('❌ Failed to delete invoice:', error);
      setError(error instanceof Error ? error.message : 'Failed to delete invoice');
    }
  };

  const deleteInvoiceLine = async (invoiceId: string, lineId: string) => {
    if (!user || !confirm('Oletko varma että haluat poistaa tämän laskurivin?')) return;
    
    try {
      const updatedData = myyntilaskutData.map(invoice => {
        if (invoice.id === invoiceId && invoice.laskurivit) {
          const updatedLines = invoice.laskurivit.filter(line => line.id !== lineId);
          return { ...invoice, laskurivit: updatedLines, rivienMaara: updatedLines.length };
        }
        return invoice;
      });
      setMyyntilaskutData(updatedData);
      // TODO: Save to Firestore
      console.log('Deleted line:', lineId);
    } catch (error) {
      console.error('Failed to delete line:', error);
    }
  };

  const handleCellEdit = (rowId: string, field: string, currentValue: string) => {
    setEditingCell({ rowId, field });
    setEditValue(currentValue);
  };

  const handleCellSave = () => {
    if (editingCell) {
      saveCell(editingCell.rowId, editingCell.field, editValue);
    }
    setEditingCell(null);
    setEditValue('');
  };

  const handleCellCancel = () => {
    setEditingCell(null);
    setEditValue('');
  };

  const renderInvoiceEditor = () => {
    if (myyntilaskutData.length === 0) {
      return (
        <div className="text-center py-8 text-gray-500">
          <Database className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p>Ei myyntilaskuja saatavilla</p>
          <p className="text-sm">Luo myyntilasku pyytämällä AI:ta</p>
        </div>
      );
    }

    const selectedInvoice = myyntilaskutData.find(inv => inv.id === selectedInvoiceId);

    return (
      <div className="space-y-4">
        {/* Invoice Headers List */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <Badge variant="secondary">{myyntilaskutData.length} laskua</Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => downloadAsCSV(myyntilaskutData, 'myyntilaskut')}
            >
              <Download className="w-4 h-4 mr-2" />
              CSV
            </Button>
          </div>
          
          <div className="max-h-40 overflow-y-auto border rounded">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-100 sticky top-0">
                  <th className="border-b px-2 py-1 text-left font-medium text-xs">Valitse</th>
                  <th className="border-b px-2 py-1 text-left font-medium text-xs">Asiakas</th>
                  <th className="border-b px-2 py-1 text-left font-medium text-xs">Otsikko</th>
                  <th className="border-b px-2 py-1 text-left font-medium text-xs">Päivämäärä</th>
                  <th className="border-b px-2 py-1 text-left font-medium text-xs">Summa</th>
                  <th className="border-b px-2 py-1 text-left font-medium text-xs">Rivit</th>
                  <th className="border-b px-2 py-1 text-left font-medium text-xs">Toiminnot</th>
                </tr>
              </thead>
              <tbody>
                {myyntilaskutData.map((invoice, index) => (
                  <tr 
                    key={invoice.id} 
                    className={`cursor-pointer hover:bg-gray-50 ${selectedInvoiceId === invoice.id ? 'bg-blue-100' : index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                    onClick={() => setSelectedInvoiceId(invoice.id)}
                  >
                    <td className="border-b px-2 py-1">
                      <input 
                        type="radio" 
                        checked={selectedInvoiceId === invoice.id}
                        onChange={() => setSelectedInvoiceId(invoice.id)}
                        className="w-3 h-3"
                      />
                    </td>
                    <td className="border-b px-2 py-1 text-xs">
                      {invoice.asiakasnumero || '-'}
                    </td>
                    <td className="border-b px-2 py-1 text-xs truncate max-w-[100px]" title={invoice.laskuotsikko}>
                      {invoice.laskuotsikko}
                    </td>
                    <td className="border-b px-2 py-1 text-xs">
                      {invoice.luontipaiva ? (() => {
                        // Handle Firebase Timestamp
                        if (invoice.luontipaiva && typeof invoice.luontipaiva === 'object' && 'seconds' in invoice.luontipaiva) {
                          const date = new Date(invoice.luontipaiva.seconds * 1000);
                          return date.toLocaleDateString('fi-FI');
                        }
                        // Handle Excel date format (number of days since 1900-01-01)
                        if (typeof invoice.luontipaiva === 'number') {
                          const excelEpoch = new Date(1900, 0, 1);
                          const date = new Date(excelEpoch.getTime() + (invoice.luontipaiva - 2) * 24 * 60 * 60 * 1000);
                          return date.toLocaleDateString('fi-FI');
                        }
                        // Handle normal ISO date string
                        return new Date(invoice.luontipaiva).toLocaleDateString('fi-FI');
                      })() : '-'}
                    </td>
                    <td className="border-b px-2 py-1 text-xs">
                      {invoice.kokonaissumma ? `${invoice.kokonaissumma}€` : '-'}
                    </td>
                    <td className="border-b px-2 py-1 text-xs">
                      {invoice.rivienMaara || 0} kpl
                    </td>
                    <td className="border-b px-2 py-1">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteInvoiceHeader(invoice.id);
                        }}
                        className="h-6 w-6 p-0"
                      >
                        🗑️
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Selected Invoice Line Items */}
        {selectedInvoice && selectedInvoice.laskurivit && selectedInvoice.laskurivit.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Laskurivit: {selectedInvoice.laskuotsikko}</h4>
            <div className="max-h-60 overflow-y-auto border rounded">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-100 sticky top-0">
                    <th className="border-b px-1 py-1 text-left font-medium text-xs">Tuotekoodi</th>
                    <th className="border-b px-1 py-1 text-left font-medium text-xs">Määrä</th>
                    <th className="border-b px-1 py-1 text-left font-medium text-xs">á-hinta</th>
                    <th className="border-b px-1 py-1 text-left font-medium text-xs">Kuvaus</th>
                    <th className="border-b px-1 py-1 text-left font-medium text-xs">Toiminnot</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedInvoice.laskurivit.map((line, index) => (
                    <tr key={line.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="border-b px-1 py-1 text-xs">
                        {editingCell?.rowId === line.id && editingCell?.field === 'tuotekoodi' ? (
                          <div className="flex gap-1">
                            <input
                              type="text"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              className="w-20 px-1 text-xs border rounded"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleCellSave();
                                if (e.key === 'Escape') handleCellCancel();
                              }}
                              autoFocus
                            />
                            <Button size="sm" onClick={handleCellSave} className="h-5 w-5 p-0 text-xs">✓</Button>
                            <Button size="sm" variant="outline" onClick={handleCellCancel} className="h-5 w-5 p-0 text-xs">✕</Button>
                          </div>
                        ) : (
                          <span 
                            className="cursor-pointer hover:bg-gray-200 px-1 rounded"
                            onClick={() => handleCellEdit(line.id, 'tuotekoodi', String(line.tuotekoodi || ''))}
                          >
                            {line.tuotekoodi || '-'}
                          </span>
                        )}
                      </td>
                      <td className="border-b px-1 py-1 text-xs">
                        {editingCell?.rowId === line.id && editingCell?.field === 'määrä' ? (
                          <div className="flex gap-1">
                            <input
                              type="number"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              className="w-16 px-1 text-xs border rounded"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleCellSave();
                                if (e.key === 'Escape') handleCellCancel();
                              }}
                              autoFocus
                            />
                            <Button size="sm" onClick={handleCellSave} className="h-5 w-5 p-0 text-xs">✓</Button>
                            <Button size="sm" variant="outline" onClick={handleCellCancel} className="h-5 w-5 p-0 text-xs">✕</Button>
                          </div>
                        ) : (
                          <span 
                            className="cursor-pointer hover:bg-gray-200 px-1 rounded"
                            onClick={() => handleCellEdit(line.id, 'määrä', String(line.määrä || ''))}
                          >
                            {line.määrä || '-'}
                          </span>
                        )}
                      </td>
                      <td className="border-b px-1 py-1 text-xs">
                        {editingCell?.rowId === line.id && editingCell?.field === 'ahinta' ? (
                          <div className="flex gap-1">
                            <input
                              type="number"
                              step="0.01"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              className="w-20 px-1 text-xs border rounded"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleCellSave();
                                if (e.key === 'Escape') handleCellCancel();
                              }}
                              autoFocus
                            />
                            <Button size="sm" onClick={handleCellSave} className="h-5 w-5 p-0 text-xs">✓</Button>
                            <Button size="sm" variant="outline" onClick={handleCellCancel} className="h-5 w-5 p-0 text-xs">✕</Button>
                          </div>
                        ) : (
                          <span 
                            className="cursor-pointer hover:bg-gray-200 px-1 rounded"
                            onClick={() => handleCellEdit(line.id, 'ahinta', String(line.ahinta || ''))}
                          >
                            {line.ahinta ? `${line.ahinta}€` : '-'}
                          </span>
                        )}
                      </td>
                      <td className="border-b px-1 py-1 text-xs max-w-[120px] truncate" title={line.kuvaus}>
                        {editingCell?.rowId === line.id && editingCell?.field === 'kuvaus' ? (
                          <div className="flex gap-1">
                            <input
                              type="text"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              className="w-24 px-1 text-xs border rounded"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleCellSave();
                                if (e.key === 'Escape') handleCellCancel();
                              }}
                              autoFocus
                            />
                            <Button size="sm" onClick={handleCellSave} className="h-5 w-5 p-0 text-xs">✓</Button>
                            <Button size="sm" variant="outline" onClick={handleCellCancel} className="h-5 w-5 p-0 text-xs">✕</Button>
                          </div>
                        ) : (
                          <span 
                            className="cursor-pointer hover:bg-gray-200 px-1 rounded"
                            onClick={() => handleCellEdit(line.id, 'kuvaus', String(line.kuvaus || ''))}
                          >
                            {line.kuvaus || '-'}
                          </span>
                        )}
                      </td>
                      <td className="border-b px-1 py-1">
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => deleteInvoiceLine(selectedInvoice.id, line.id)}
                          className="h-5 w-5 p-0 text-xs"
                        >
                          🗑️
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {selectedInvoice && (!selectedInvoice.laskurivit || selectedInvoice.laskurivit.length === 0) && (
          <div className="text-center py-4 text-gray-500">
            <p className="text-sm">Valitulla laskulla ei ole laskurivejä</p>
          </div>
        )}

        {!selectedInvoice && (
          <div className="text-center py-4 text-gray-500">
            <p className="text-sm">Valitse lasku nähdäksesi sen rivit</p>
          </div>
        )}
      </div>
    );
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
    const maxVisibleColumns = calculateVisibleColumns(leftPanelWidth);
    const displayHeaders = headers.slice(0, maxVisibleColumns);

    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{data.length} riviä</Badge>
            <Badge variant="outline">{displayHeaders.length}/{headers.length} saraketta</Badge>
            {headers.length > displayHeaders.length && (
              <Badge variant="secondary">+{headers.length - displayHeaders.length} piilotettu</Badge>
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
                  <th key={header} className="border border-gray-300 px-1 py-1 text-left font-medium text-xs truncate max-w-[120px]" title={header}>
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.slice(0, 10).map((record, index) => (
                <tr key={record.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  {displayHeaders.map(header => (
                    <td key={header} className="border border-gray-300 px-1 py-1 text-xs truncate max-w-[120px]" title={String(record[header] || '-')}>
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
    <div id="chat-layout-container" className="h-full flex gap-2">
      {/* Left Column - Database Data */}
      <div 
        className="flex flex-col gap-4 transition-all duration-200"
        style={{ width: `${leftPanelWidth}%` }}
      >
        {/* Database Data */}
        <Card className="flex-1 min-h-0">
          <CardHeader className="pb-3">
            <div className="flex justify-between items-center">
              <CardTitle className="flex items-center gap-2">
                <Database className="w-5 h-5" />
                ERP Data
              </CardTitle>
              <CardDescription className="mt-2">
                Katso ERPiin ylläpidettyjä laskutuksen lähtötietoja ja editoi AI:n generoimia myyntilaskuja
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
                {renderInvoiceEditor()}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Resizable Divider */}
      <div 
        className="w-2 bg-gray-200 hover:bg-blue-400 cursor-col-resize transition-colors duration-200 flex-shrink-0 rounded-full"
        onMouseDown={handleMouseDown}
        title="Vedä muuttaaksesi paneelien kokoa"
      />

      {/* Right Column - Chatbot */}
      <Card 
        className="flex flex-col min-h-0 transition-all duration-200"
        style={{ width: `${100 - leftPanelWidth}%` }}
      >
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