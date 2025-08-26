import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { storageService } from '../lib/storageService';
import { deleteDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Database, MessageSquare, FileText, Download, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';
import { ChatAI } from './ChatAI';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import * as XLSX from 'xlsx';

interface DatabaseRecord {
  id: string;
  [key: string]: unknown;
}


export const ChatLayout: React.FC = () => {
  const [hinnastoData, setHinnastoData] = useState<DatabaseRecord[]>([]);
  const [tilausData, setTilausData] = useState<DatabaseRecord[]>([]);
  const [myyntiExcelData, setMyyntiExcelData] = useState<DatabaseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeDataTab, setActiveDataTab] = useState<'hinnasto' | 'tilaus' | 'myyntiExcel'>('hinnasto');
  const [leftPanelWidth, setLeftPanelWidth] = useState(50); // Percentage
  const [isDragging, setIsDragging] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [editingCell, setEditingCell] = useState<{rowId: string, field: string} | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [productNameFilter, setProductNameFilter] = useState<string>('');  // Aligned with searchHinnasto function
  const [priceListNameFilter, setPriceListNameFilter] = useState<string>('');  // Aligned with searchHinnasto function
  const [priceListSupplierFilter, setPriceListSupplierFilter] = useState<string>('');  // Aligned with searchHinnasto function
  const [tampuuriCodeFilter, setTampuuriCodeFilter] = useState<string>('');  // Aligned with searchTilaus function
  const [orderRPFilter, setOrderRPFilter] = useState<string>('');
  const [columnOffset, setColumnOffset] = useState<Record<string, number>>({});
  const [isLeftPanelVisible, setIsLeftPanelVisible] = useState(true);
  const [isRightPanelVisible, setIsRightPanelVisible] = useState(true);
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

  // Add keyboard shortcuts for panel toggling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + B toggles left panel (like VS Code sidebar)
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        setIsLeftPanelVisible(prev => !prev);
      }
      // Ctrl/Cmd + J toggles right panel (similar to VS Code panel)
      if ((e.ctrlKey || e.metaKey) && e.key === 'j') {
        e.preventDefault();
        setIsRightPanelVisible(prev => !prev);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

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
      setHinnastoData(hinnastoRecords); // Store all records, will filter in display

      // Load tilaus data
      const tilausDocuments = await storageService.getUserTilausDocuments(user.uid);
      const tilausRecords = tilausDocuments.flatMap(doc => 
        doc.jsonData?.map((record, index) => ({
          id: `${doc.id}_${index}`,
          ...record
        })) || []
      );
      setTilausData(tilausRecords); // Store all records, will filter in display

      // Load myyntiExcel data in hierarchical format
      const myyntiExcelDocuments = await storageService.getUserMyyntiExcelDocuments(user.uid);
      
      // Create a lookup map from tilaus data for joining
      const tilausLookup = new Map();
      const tilausProductLookup = new Map(); // For product matching
      
      tilausRecords.forEach(tilausRecord => {
        // Try to find the company ID field - could be various names
        const companyIdField = Object.keys(tilausRecord).find(key => 
          key.includes('Yhtiön tunnus') || key.includes('yhtiön tunnus') || 
          key.includes('Yhtiötunnus') || key.includes('yhtiötunnus') ||
          key.toLowerCase().includes('company') && key.toLowerCase().includes('id')
        );
        
        if (companyIdField && tilausRecord[companyIdField]) {
          const companyId = String(tilausRecord[companyIdField]).trim();
          
          // Store header info
          if (!tilausLookup.has(companyId)) {
            tilausLookup.set(companyId, {
              tilaustunnus: tilausRecord['Tilaustunnus'] || tilausRecord['tilaustunnus'] || tilausRecord['Order'] || '',
              yhtiönNimi: tilausRecord['Yhtiön nimi'] || tilausRecord['yhtiön nimi'] || tilausRecord['Company'] || '',
              tilaajanNimi: tilausRecord['Tilaajan nimi'] || tilausRecord['tilaajan nimi'] || tilausRecord['Orderer'] || ''
            });
          }
          
          // Store product info for matching
          const tilattuTuote = tilausRecord['Tilattu tuote'] || tilausRecord['tilattu tuote'] || tilausRecord['Product'] || '';
          if (tilattuTuote) {
            if (!tilausProductLookup.has(companyId)) {
              tilausProductLookup.set(companyId, []);
            }
            tilausProductLookup.get(companyId).push(String(tilattuTuote).trim());
          }
        }
      });
      
      const invoiceHeaders = myyntiExcelDocuments.flatMap(doc => 
        doc.jsonData?.map((lasku, laskuIndex) => {
          // Look up tilaus data using asiakasnumero (which corresponds to Tampuurinumero)
          const tilausInfo = tilausLookup.get(String(lasku.asiakasnumero || '').trim()) || {
            tilaustunnus: '',
            yhtiönNimi: '',
            tilaajanNimi: ''
          };
          
          // Handle both old structure (laskurivit) and new structure (rivit)
          const rows = lasku.rivit || lasku.laskurivit || [];
          
          return {
            id: `${doc.id}_${laskuIndex}`,
            docId: doc.id,
            firestoreDocId: lasku.id, // The real Firestore document ID
            // Header fields from new structure
            asiakasnumero: lasku.asiakasnumero,
            Tilausnumero: lasku.Tilausnumero || lasku.tilausnumero || '',
            Laskutusselvitys: lasku.Laskutusselvitys || '',
            reskontra: lasku.reskontra || 'MK',
            // Legacy fields for compatibility
            laskuotsikko: lasku.laskuotsikko || 'Myyntilasku',
            luontipaiva: lasku.luontipaiva,
            kokonaissumma: lasku.kokonaissumma,
            rivienMaara: rows.length,
            // Add tilaus information
            tilaustunnus: tilausInfo.tilaustunnus,
            yhtiönNimi: tilausInfo.yhtiönNimi,
            tilaajanNimi: tilausInfo.tilaajanNimi,
            // Map rows with new structure
            laskurivit: rows.map((rivi, riviIndex) => {
              // Find matching "Tilattu tuote" based on description similarity
              const customerProducts = tilausProductLookup.get(String(lasku.asiakasnumero || '').trim()) || [];
              let tilattuTuote = '';
              
              if (customerProducts.length > 0 && rivi.kuvaus) {
                const description = String(rivi.kuvaus).toLowerCase().trim();
                // Find best match by checking if tilaus product name is contained in description
                const bestMatch = customerProducts.find(product => 
                  description.includes(String(product).toLowerCase().trim()) ||
                  String(product).toLowerCase().trim().includes(description)
                );
                tilattuTuote = bestMatch || '';
              }
              
              return {
                id: `${doc.id}_${laskuIndex}_${riviIndex}`,
                invoiceId: `${doc.id}_${laskuIndex}`,
                tilattuTuote,
                // New structure fields
                määrä: rivi.määrä || 0,
                ahinta: rivi.ahinta || 0,
                Yhteensä: rivi.Yhteensä || (rivi.määrä * rivi.ahinta) || 0,
                kuvaus: rivi.kuvaus || '',
                yksikkö: rivi.yksikkö || '',
                tuotenimi: rivi.tuotenimi || '',
                alvkoodi: rivi.alvkoodi || '',
                // Keep any other fields that might exist
                ...rivi
              };
            })
          };
        }) || []
      );
      setMyyntiExcelData(invoiceHeaders.slice(0, 20)); // Show first 20 invoices


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

  const downloadAsExcel = (data: DatabaseRecord[], filename: string) => {
    if (data.length === 0) return;
    
    // Check if this is invoice data with line items
    const isInvoiceData = filename === 'myyntiExcel' && data.some(item => item.laskurivit);
    
    let exportData: DatabaseRecord[] = [];
    
    if (isInvoiceData) {
      // Flatten invoice data: one row per invoice line
      data.forEach(invoice => {
        const headerData = { ...invoice };
        delete headerData.laskurivit; // Remove the nested array
        
        if (Array.isArray(invoice.laskurivit)) {
          // Create a row for each invoice line
          (invoice.laskurivit as DatabaseRecord[]).forEach(line => {
            exportData.push({
              // Header fields (new structure)
              asiakasnumero: headerData.asiakasnumero,
              Tilausnumero: headerData.Tilausnumero || '',
              reskontra: headerData.reskontra || 'MK',
              // Row fields (new structure)
              määrä: line.määrä,
              ahinta: line.ahinta,
              Yhteensä: line.Yhteensä || (Number(line.määrä) * Number(line.ahinta)),
              kuvaus: line.kuvaus,
              yksikkö: line.yksikkö || '',
              tuotenimi: line.tuotenimi || '',
              alvkoodi: line.alvkoodi || '',
              // Additional info for reference
              luontipaiva: headerData.luontipaiva,
              yhtiönNimi: headerData.yhtiönNimi || '',
              docId: headerData.docId,
              tilattuTuote: line.tilattuTuote
            });
          });
        } else {
          // If no line items, just add the header
          exportData.push(headerData);
        }
      });
    } else {
      // For non-invoice data, use as-is
      exportData = data;
    }
    
    // Create a new workbook
    const workbook = XLSX.utils.book_new();
    
    // Convert data to worksheet
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    
    // Add worksheet to workbook
    const sheetName = isInvoiceData ? 'MyyntiExcel' : filename;
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    
    // Write workbook to buffer
    const buffer = XLSX.write(workbook, { 
      bookType: 'xlsx', 
      type: 'array' 
    });
    
    // Create blob and download
    const blob = new Blob([buffer], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}.xlsx`);
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

  const formatCellValue = (value: unknown, header: string) => {
    if (value === null || value === undefined) return '-';
    
    // Check if this is a date field by header name - be more inclusive
    const dateFields = ['tilauspäivä', 'tilauspvm', 'luontipaiva', 'päivämäärä', 'date', 'pvm'];
    const isDateField = dateFields.some(field => 
      header.toLowerCase().includes(field.toLowerCase())
    );
    
    // Handle Excel date conversion for date fields
    if (isDateField && typeof value === 'number' && value > 1000) {
      try {
        // Excel date serial number to JavaScript Date
        const excelEpoch = new Date(1900, 0, 1);
        const date = new Date(excelEpoch.getTime() + (value - 2) * 24 * 60 * 60 * 1000);
        return date.toLocaleDateString('fi-FI');
      } catch {
        return String(value);
      }
    }
    
    // Handle OrderMargin field - show as percentage
    if (header === 'OrderMargin' || header === 'OrderMargin%' || header.toLowerCase().includes('margin')) {
      if (typeof value === 'number') {
        // If value is between 0 and 1, assume it's a decimal percentage
        if (value >= 0 && value <= 1) {
          return `${Math.round(value * 100)}%`;
        }
        // Otherwise assume it's already a percentage value
        return `${Math.round(value)}%`;
      }
    }
    
    // Handle numeric values - remove decimals for display
    if (typeof value === 'number') {
      // Skip currency formatting for kustannuspaikka (cost center) fields
      if (header.toLowerCase().includes('kustannuspaikka')) {
        return String(value);
      }
      
      // Check if field name suggests it's a price or amount
      const priceFields = ['price', 'hinta', 'amount', 'summa', 'total', 'cost'];
      const isPriceField = priceFields.some(field => 
        header.toLowerCase().includes(field.toLowerCase())
      );
      
      // Also check for specific price patterns
      const hasPricePattern = header.toLowerCase().includes('alv') && 
                              (header.toLowerCase().includes('hinta') || header.toLowerCase().includes('€'));
      
      if (isPriceField || hasPricePattern) {
        // Round to whole euros for prices
        return `${Math.round(value)}€`;
      }
      
      // For other numbers, just round to integer
      return String(Math.round(value));
    }
    
    return String(value);
  };

  const saveCell = async (rowId: string, field: string, value: string) => {
    if (!user) return;
    
    try {
      // Find the invoice and update the specific field
      const updatedData = myyntiExcelData.map(invoice => {
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
      
      setMyyntiExcelData(updatedData);
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
      const invoice = myyntiExcelData.find(inv => inv.id === invoiceId);
      if (!invoice || !invoice.firestoreDocId) {
        throw new Error('Invoice not found or missing Firestore document ID');
      }
      
      console.log('Deleting invoice from Firestore:', { 
        invoiceId, 
        docId: invoice.docId, 
        firestoreDocId: invoice.firestoreDocId 
      });
      
      // Delete from Firestore using the real Firestore document ID
      await deleteDoc(doc(db, 'myyntiExcel', invoice.firestoreDocId));
      
      // Update UI state
      const updatedData = myyntiExcelData.filter(inv => inv.id !== invoiceId);
      setMyyntiExcelData(updatedData);
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
      const updatedData = myyntiExcelData.map(invoice => {
        if (invoice.id === invoiceId && invoice.laskurivit) {
          const updatedLines = invoice.laskurivit.filter(line => line.id !== lineId);
          return { ...invoice, laskurivit: updatedLines, rivienMaara: updatedLines.length };
        }
        return invoice;
      });
      setMyyntiExcelData(updatedData);
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
    if (myyntiExcelData.length === 0) {
      return (
        <div className="text-center py-8 text-gray-500">
          <Database className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p>Ei myyntilaskuja saatavilla</p>
          <p className="text-sm">Luo myyntilasku pyytämällä AI:ta</p>
        </div>
      );
    }

    const selectedInvoice = myyntiExcelData.find(inv => inv.id === selectedInvoiceId);

    return (
      <div className="space-y-4">
        {/* Invoice Headers List */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <Badge variant="secondary">{myyntiExcelData.length} laskua</Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => downloadAsExcel(myyntiExcelData, 'myyntiExcel')}
            >
              <Download className="w-4 h-4 mr-2" />
              Excel
            </Button>
          </div>
          
          <div className="max-h-40 overflow-y-auto border rounded">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-100 sticky top-0">
                  <th className="border-b px-1 py-1 text-left font-medium text-xs">Valitse</th>
                  <th className="border-b px-1 py-1 text-left font-medium text-xs">Tampuuri</th>
                  <th className="border-b px-1 py-1 text-left font-medium text-xs">RP-numero</th>
                  <th className="border-b px-1 py-1 text-left font-medium text-xs">Toiminnot</th>
                </tr>
              </thead>
              <tbody>
                {myyntiExcelData.map((invoice, index) => (
                  <tr 
                    key={invoice.id} 
                    className={`cursor-pointer hover:bg-gray-50 ${selectedInvoiceId === invoice.id ? 'bg-blue-100' : index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                    onClick={() => setSelectedInvoiceId(invoice.id)}
                  >
                    <td className="border-b px-1 py-1">
                      <input 
                        type="radio" 
                        checked={selectedInvoiceId === invoice.id}
                        onChange={() => setSelectedInvoiceId(invoice.id)}
                        className="w-3 h-3"
                      />
                    </td>
                    <td className="border-b px-1 py-1 text-xs">
                      {invoice.asiakasnumero || '-'}
                    </td>
                    <td className="border-b px-1 py-1 text-xs truncate max-w-[120px]" title={invoice.Tilausnumero}>
                      {invoice.Tilausnumero || '-'}
                    </td>
                    <td className="border-b px-1 py-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteInvoice(invoice.id);
                        }}
                        className="h-6 w-6 p-0 text-red-600 hover:text-red-800"
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

        {/* Invoice-level Laskutusselvitys */}
        {selectedInvoice && selectedInvoice.Laskutusselvitys && (
          <div className="space-y-2 mb-4">
            <h4 className="font-medium text-sm">Laskutusselvitys</h4>
            <div className="border rounded p-3 bg-gray-50 max-h-40 overflow-y-auto">
              <div className="text-sm prose prose-sm max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {selectedInvoice.Laskutusselvitys}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        )}

        {/* Selected Invoice Line Items */}
        {selectedInvoice && selectedInvoice.laskurivit && selectedInvoice.laskurivit.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Laskurivit: {selectedInvoice.laskuotsikko || 'Myyntilasku'}</h4>
            <div className="max-h-60 overflow-y-auto border rounded">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-100 sticky top-0">
                    <th className="border-b px-1 py-1 text-left font-medium text-xs">Määrä</th>
                    <th className="border-b px-1 py-1 text-left font-medium text-xs">á-hinta</th>
                    <th className="border-b px-1 py-1 text-left font-medium text-xs">Yhteensä</th>
                    <th className="border-b px-2 py-1 text-left font-medium text-xs min-w-[150px]">Kuvaus</th>
                    <th className="border-b px-1 py-1 text-left font-medium text-xs">Yksikkö</th>
                    <th className="border-b px-1 py-1 text-left font-medium text-xs">Toiminnot</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedInvoice.laskurivit.map((line, index) => (
                    <tr 
                      key={line.id} 
                      className={`cursor-pointer ${selectedLineId === line.id ? 'bg-blue-100' : index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50`}
                      onClick={() => setSelectedLineId(selectedLineId === line.id ? null : line.id)}
                    >
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
                      <td className="border-b px-1 py-1 text-xs">
                        {line.Yhteensä ? `${line.Yhteensä.toFixed(2)}€` : '-'}
                      </td>
                      <td className="border-b px-2 py-1 text-xs min-w-[150px] max-w-[250px]">
                        {editingCell?.rowId === line.id && editingCell?.field === 'kuvaus' ? (
                          <div className="flex gap-1">
                            <input
                              type="text"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              className="w-full px-1 text-xs border rounded"
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
                          <div className="group relative">
                            <span 
                              className="cursor-pointer hover:bg-gray-200 px-1 rounded block break-words whitespace-normal"
                              onClick={() => handleCellEdit(line.id, 'kuvaus', String(line.kuvaus || ''))}
                            >
                              {line.kuvaus || '-'}
                            </span>
                            {line.kuvaus && line.kuvaus.length > 50 && (
                              <div className="absolute z-10 hidden group-hover:block bg-white border border-gray-300 rounded shadow-lg p-2 mt-1 max-w-md">
                                <span className="text-xs">{line.kuvaus}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="border-b px-1 py-1 text-xs">
                        {line.yksikkö || '-'}
                      </td>
                      <td className="border-b px-1 py-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteInvoiceLine(selectedInvoice.id, line.id)}
                          className="h-5 w-5 p-0 text-red-600 hover:text-red-800"
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

  const renderDataTable = useCallback((data: DatabaseRecord[], title: string) => {
    
    // Apply filters based on tab
    let filteredData = data;
    
    // Apply product name filter for Hinnasto (aligned with searchHinnasto function)
    if (title === 'Hinnasto' && productNameFilter) {
      filteredData = filteredData.filter(record => {
        // Check ProductName field with advanced text matching
        const productName = String(record['ProductName'] || record['Tuote'] || record['tuote'] || record['Product Name'] || record['product_name'] || '').trim();
        
        // Normalize for comparison (case-insensitive, remove extra spaces)
        const searchTerms = productNameFilter.toLowerCase().replace(/\s+/g, ' ').trim().split(' ');
        const normalizedItemName = productName.toLowerCase().replace(/\s+/g, ' ');
        
        // Check if all search terms are found in the product name
        // This allows searching for "kunto pts" to find "Kuntotutkimus ja PTS"
        const allTermsMatch = searchTerms.every(term => normalizedItemName.includes(term));
        
        // Also check for exact substring match
        const exactMatch = normalizedItemName.includes(productNameFilter.toLowerCase().replace(/\s+/g, ' ').trim());
        
        return allTermsMatch || exactMatch;
      });
    }
    
    // Apply priceListName filter for Hinnasto (partial match)
    if (title === 'Hinnasto' && priceListNameFilter) {
      filteredData = filteredData.filter(record => {
        try {
          // Match the exact field mappings from geminiChatService
          const priceListName = String(
            record['PriceListName'] || 
            record['Hintalista'] || 
            record['hintalista'] || 
            record['Price List Name'] || 
            record['price_list_name'] || 
            ''
          ).trim().toLowerCase();
          // Use partial matching (includes) instead of exact match
          return priceListName.includes(priceListNameFilter.trim().toLowerCase());
        } catch (e) {
          console.error('Error filtering by priceListName:', e);
          return false;
        }
      });
    }
    
    // Apply priceListSupplier filter for Hinnasto (partial match for consistency)
    if (title === 'Hinnasto' && priceListSupplierFilter) {
      filteredData = filteredData.filter(record => {
        try {
          // Match the exact field mappings from geminiChatService
          const priceListSupplier = String(
            record['PriceListSupplier'] || 
            record['Hintalistan_toimittaja'] || 
            record['hintalistan_toimittaja'] || 
            record['Price List Supplier'] || 
            record['price_list_supplier'] || 
            ''
          ).trim().toLowerCase();
          // Use partial matching for better usability
          return priceListSupplier.includes(priceListSupplierFilter.trim().toLowerCase());
        } catch (e) {
          console.error('Error filtering by priceListSupplier:', e);
          return false;
        }
      });
    }
    
    // Apply filters for Tilaus (aligned with searchTilaus function)
    // searchTilaus function searches by either tampuuriCode OR orderNumber
    if (title === 'Tilaus') {
      // Apply tampuuriCode filter - matching searchTilaus function parameter
      if (tampuuriCodeFilter) {
        filteredData = filteredData.filter(record => {
          // Check Code field (tampuurinumero) - same as searchTilaus function
          const code = record['Code'] || record['Tampuurinumero'] || '';
          return String(code).toLowerCase().includes(tampuuriCodeFilter.toLowerCase());
        });
      }
      
      // Apply RP-numero filter
      if (orderRPFilter) {
        filteredData = filteredData.filter(record => {
          const rpNumero = record['OrderNumber'] || 
                           record['RP-numero'] ||
                           record['RP-tunnus'] ||
                           '';
          return String(rpNumero).toLowerCase().includes(orderRPFilter.toLowerCase());
        });
      }
    }
    
    if (filteredData.length === 0) {
      const emptyMessage = title === 'MyyntiExcel' 
        ? 'Luo myyntilasku pyytämällä myyntilaskun AI genrointia chatbotilta'
        : (productNameFilter || priceListNameFilter || priceListSupplierFilter) && title === 'Hinnasto'
        ? (() => {
            const filters = [];
            if (productNameFilter) filters.push(`tuote: "${productNameFilter}"`);
            if (priceListNameFilter) filters.push(`hintalista: "${priceListNameFilter}"`);
            if (priceListSupplierFilter) filters.push(`toimittaja: "${priceListSupplierFilter}"`);
            return `Ei tuloksia hakuehdoilla: ${filters.join(', ')}`;
          })()
        : tampuuriCodeFilter && title === 'Tilaus'
        ? `Ei tuloksia tampuurinumerolle "${tampuuriCodeFilter}"`
        : 'Lataa data Admin-sivun kautta';
      
      return (
        <div className="space-y-4">
          {title === 'Hinnasto' && (
            <div className="space-y-2">
              <Alert className="bg-blue-50 border-blue-200">
                <AlertDescription className="text-sm text-blue-700">
                  searchHinnasto: Hae tuotenimellä, hintalistalla TAI toimittajalla (kaikki osittainen haku, AND-logiikka kun useita)
                </AlertDescription>
              </Alert>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Suodata tuotteen nimellä (osittainen haku)..."
                  value={productNameFilter}
                  onChange={(e) => setProductNameFilter(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {productNameFilter && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setProductNameFilter('')}
                  >
                    Tyhjennä
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Suodata hintalistan nimellä (osittainen haku)..."
                  value={priceListNameFilter}
                  onChange={(e) => setPriceListNameFilter(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {priceListNameFilter && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPriceListNameFilter('')}
                  >
                    Tyhjennä
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Suodata toimittajan nimellä (osittainen haku)..."
                  value={priceListSupplierFilter}
                  onChange={(e) => setPriceListSupplierFilter(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {priceListSupplierFilter && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPriceListSupplierFilter('')}
                  >
                    Tyhjennä
                  </Button>
                )}
              </div>
            </div>
          )}
          {title === 'Tilaus' && (
            <div className="space-y-2">
              <Alert className="bg-blue-50 border-blue-200">
                <AlertDescription className="text-sm text-blue-700">
                  searchTilaus: Hae RP-numerolla TAI Tampuurilla (OR-logiikka) | Tulokset: OrderNumber, Code, Name, ProductName, TotalSellPrice, PriceListName
                </AlertDescription>
              </Alert>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Suodata tampuurinumerolla (Code)..."
                  value={tampuuriCodeFilter}
                  onChange={(e) => setTampuuriCodeFilter(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {tampuuriCodeFilter && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setTampuuriCodeFilter('')}
                  >
                    Tyhjennä
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Suodata RP-numerolla..."
                  value={orderRPFilter}
                  onChange={(e) => setOrderRPFilter(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {orderRPFilter && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setOrderRPFilter('')}
                  >
                    Tyhjennä
                  </Button>
                )}
              </div>
            </div>
          )}
          <div className="text-center py-8 text-gray-500">
            <Database className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>Ei {title.toLowerCase()}-dataa saatavilla</p>
            <p className="text-sm">{emptyMessage}</p>
          </div>
        </div>
      );
    }

    const headers = Object.keys(filteredData[0]).filter(key => !['id'].includes(key));
    const maxVisibleColumns = calculateVisibleColumns(leftPanelWidth);
    const currentOffset = columnOffset[title] || 0;
    const displayHeaders = headers.slice(currentOffset, currentOffset + maxVisibleColumns);
    const displayData = filteredData.slice(0, 20); // Show first 20 filtered records
    
    // Check if navigation arrows should be shown
    const canGoLeft = currentOffset > 0;
    const canGoRight = currentOffset + maxVisibleColumns < headers.length;
    
    const handleColumnNavigation = (direction: 'left' | 'right') => {
      const newOffset = direction === 'left' 
        ? Math.max(0, currentOffset - 1)
        : Math.min(headers.length - maxVisibleColumns, currentOffset + 1);
      
      setColumnOffset(prev => ({
        ...prev,
        [title]: newOffset
      }));
    };

    return (
      <div className="space-y-4">
        {title === 'Hinnasto' && (
          <div className="space-y-2">
            <Alert className="bg-blue-50 border-blue-200">
              <AlertDescription className="text-sm text-blue-700">
                searchHinnasto: Hae tuotenimellä, hintalistalla TAI toimittajalla (kaikki osittainen haku, AND-logiikka kun useita)
              </AlertDescription>
            </Alert>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Suodata tuotteen nimellä (osittainen haku)..."
                value={productNameFilter}
                onChange={(e) => setProductNameFilter(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {productNameFilter && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setProductNameFilter('')}
                >
                  Tyhjennä
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Suodata hintalistan nimellä (osittainen haku)..."
                value={priceListNameFilter}
                onChange={(e) => setPriceListNameFilter(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {priceListNameFilter && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPriceListNameFilter('')}
                >
                  Tyhjennä
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Suodata toimittajan nimellä (osittainen haku)..."
                value={priceListSupplierFilter}
                onChange={(e) => setPriceListSupplierFilter(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {priceListSupplierFilter && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPriceListSupplierFilter('')}
                >
                  Tyhjennä
                </Button>
              )}
            </div>
          </div>
        )}
        
        {title === 'Tilaus' && (
          <div className="space-y-2">
            <Alert className="bg-blue-50 border-blue-200">
              <AlertDescription className="text-sm text-blue-700">
                searchTilaus: Hae RP-numerolla TAI Tampuurilla (OR-logiikka)
              </AlertDescription>
            </Alert>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Suodata tampuurinumerolla (Code)..."
                value={tampuuriCodeFilter}
              onChange={(e) => setTampuuriCodeFilter(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {tampuuriCodeFilter && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setTampuuriCodeFilter('')}
              >
                Tyhjennä
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Suodata RP-numerolla..."
              value={orderRPFilter}
              onChange={(e) => setOrderRPFilter(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {orderRPFilter && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setOrderRPFilter('')}
              >
                Tyhjennä
              </Button>
            )}
          </div>
          </div>
        )}
        
        
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">
              {(productNameFilter && title === 'Hinnasto') || (priceListNameFilter && title === 'Hinnasto') || (priceListSupplierFilter && title === 'Hinnasto') || (tampuuriCodeFilter && title === 'Tilaus')
                ? `${filteredData.length} / ${data.length} riviä` 
                : `${filteredData.length} riviä`}
            </Badge>
            {/* Don't show column info for fixed-column tabs (Tilaus/Hinnasto) */}
            {title !== 'Tilaus' && title !== 'Hinnasto' && (
              <>
                <Badge variant="outline">{displayHeaders.length}/{headers.length} saraketta</Badge>
                {headers.length > displayHeaders.length && (
                  <Badge variant="secondary">+{headers.length - displayHeaders.length} piilotettu</Badge>
                )}
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Column navigation arrows - only for tabs with many dynamic columns */}
            {title !== 'Tilaus' && title !== 'Hinnasto' && headers.length > maxVisibleColumns && (
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleColumnNavigation('left')}
                  disabled={!canGoLeft}
                  className="h-8 w-8 p-0"
                  title="Näytä edelliset sarakkeet"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-xs text-gray-500 px-1">
                  Sarakkeet {currentOffset + 1}-{Math.min(currentOffset + maxVisibleColumns, headers.length)}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleColumnNavigation('right')}
                  disabled={!canGoRight}
                  className="h-8 w-8 p-0"
                  title="Näytä seuraavat sarakkeet"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => downloadAsExcel(filteredData, title.toLowerCase())}
            >
              <Download className="w-4 h-4 mr-2" />
              Excel
            </Button>
          </div>
        </div>
        
        <div className="overflow-x-auto max-h-96">
          <table className="w-full text-sm border-collapse border border-gray-300">
            <thead>
              <tr className="bg-gray-100">
                {title === 'Hinnasto' ? (
                  // Custom headers for searchHinnasto function output
                  <>
                    <th className="border border-gray-300 px-2 py-1 text-left font-medium text-xs">ProductNumber</th>
                    <th className="border border-gray-300 px-2 py-1 text-left font-medium text-xs min-w-[200px]">ProductName</th>
                    <th className="border border-gray-300 px-2 py-1 text-left font-medium text-xs">PriceListSupplier</th>
                    <th className="border border-gray-300 px-2 py-1 text-left font-medium text-xs">PriceListName</th>
                    <th className="border border-gray-300 px-2 py-1 text-right font-medium text-xs">BuyPrice</th>
                    <th className="border border-gray-300 px-2 py-1 text-right font-medium text-xs">SalePrice</th>
                    <th className="border border-gray-300 px-2 py-1 text-right font-medium text-xs">SalePriceVat</th>
                  </>
                ) : title === 'Tilaus' ? (
                  // Custom headers for searchTilaus function output
                  <>
                    <th className="border border-gray-300 px-2 py-1 text-left font-medium text-xs">OrderNumber</th>
                    <th className="border border-gray-300 px-2 py-1 text-left font-medium text-xs">Code</th>
                    <th className="border border-gray-300 px-2 py-1 text-left font-medium text-xs">Name</th>
                    <th className="border border-gray-300 px-2 py-1 text-left font-medium text-xs min-w-[200px]">ProductName</th>
                    <th className="border border-gray-300 px-2 py-1 text-right font-medium text-xs">TotalSellPrice</th>
                    <th className="border border-gray-300 px-2 py-1 text-left font-medium text-xs">PriceListName</th>
                  </>
                ) : displayHeaders.map(header => {
                  // Make ProductName and Tuote columns wider to show full text
                  const isProductColumn = header === 'ProductName' || header === 'Tuote' || 
                                         header === 'Tuotekuvaus' || header === 'tuote' || 
                                         header === 'Product Name' || header === 'product_name';
                  
                  const columnClass = isProductColumn 
                    ? "border border-gray-300 px-2 py-1 text-left font-medium text-xs min-w-[200px]"
                    : "border border-gray-300 px-1 py-1 text-left font-medium text-xs max-w-[120px] truncate";
                  
                  return (
                    <th key={header} className={columnClass} title={header}>
                      {header}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {displayData.map((record, index) => (
                <tr key={record.id || `row-${index}`} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  {title === 'Hinnasto' ? (
                    // Custom columns for searchHinnasto function output
                    <>
                      <td className="border border-gray-300 px-2 py-1 text-xs">
                        {record['ProductNumber'] || record['Tuotetunnus'] || record['tuotetunnus'] || record['Tuotenumero'] || record['Product Number'] || record['product_number'] || '-'}
                      </td>
                      <td className="border border-gray-300 px-2 py-1 text-xs min-w-[200px] break-words whitespace-normal">
                        {record['ProductName'] || record['Tuote'] || record['tuote'] || record['Tuotenimi'] || record['Product Name'] || record['product_name'] || '-'}
                      </td>
                      <td className="border border-gray-300 px-2 py-1 text-xs">
                        {record['PriceListSupplier'] || record['Hintalistan_toimittaja'] || record['hintalistan_toimittaja'] || record['Hintalistan toimittaja'] || record['Toimittaja'] || record['toimittaja'] || record['Price List Supplier'] || record['price_list_supplier'] || '-'}
                      </td>
                      <td className="border border-gray-300 px-2 py-1 text-xs">
                        {record['PriceListName'] || record['Hintalista'] || record['hintalista'] || record['Hintalistan nimi'] || record['hintalistan_nimi'] || record['Price List Name'] || record['price_list_name'] || '-'}
                      </td>
                      <td className="border border-gray-300 px-2 py-1 text-xs text-right">
                        {record['BuyPrice'] !== undefined ? `${record['BuyPrice']}€` : (record['Ostohinta'] !== undefined ? `${record['Ostohinta']}€` : (record['ostohinta'] !== undefined ? `${record['ostohinta']}€` : (record['Buy Price'] || record['buy_price'] || '-')))}
                      </td>
                      <td className="border border-gray-300 px-2 py-1 text-xs text-right">
                        {record['SalePrice'] !== undefined ? `${record['SalePrice']}€` : (record['Myyntihinta'] !== undefined ? `${record['Myyntihinta']}€` : (record['myyntihinta'] !== undefined ? `${record['myyntihinta']}€` : (record['Sale Price'] || record['sale_price'] || '-')))}
                      </td>
                      <td className="border border-gray-300 px-2 py-1 text-xs text-right">
                        {record['SalePriceVat'] !== undefined ? `${record['SalePriceVat']}€` : (record['Myyntihinta_alv'] !== undefined ? `${record['Myyntihinta_alv']}€` : (record['myyntihinta_alv'] !== undefined ? `${record['myyntihinta_alv']}€` : (record['Myyntihinta ALV'] !== undefined ? `${record['Myyntihinta ALV']}€` : (record['Sale Price VAT'] || record['sale_price_vat'] || '-'))))}
                      </td>
                    </>
                  ) : title === 'Tilaus' ? (
                    // Custom columns for searchTilaus function output
                    <>
                      <td className="border border-gray-300 px-2 py-1 text-xs">
                        {record['OrderNumber'] || record['RP-tunnus'] || record['RP-tunnus (tilausnumero)'] || record['Tilausnumero'] || '-'}
                      </td>
                      <td className="border border-gray-300 px-2 py-1 text-xs">
                        {record['Code'] || record['Tampuurinumero'] || '-'}
                      </td>
                      <td className="border border-gray-300 px-2 py-1 text-xs">
                        {record['Name'] || record['Asiakas'] || record['Asiakasnimi'] || '-'}
                      </td>
                      <td className="border border-gray-300 px-2 py-1 text-xs min-w-[200px] break-words whitespace-normal">
                        {record['ProductName'] || record['Tuote'] || record['Tuotenimi'] || '-'}
                      </td>
                      <td className="border border-gray-300 px-2 py-1 text-xs text-right">
                        {record['TotalSellPrice'] !== undefined ? `${record['TotalSellPrice']}€` : (record['Myyntihinta yhteensä'] || '-')}
                      </td>
                      <td className="border border-gray-300 px-2 py-1 text-xs">
                        {record['PriceListName'] || record['Hintalista'] || '-'}
                      </td>
                    </>
                  ) : displayHeaders.map(header => {
                    const formattedValue = formatCellValue(record[header], header);
                    
                    // Make ProductName and Tuote columns show full text with wrapping
                    const isProductColumn = header === 'ProductName' || header === 'Tuote' || 
                                           header === 'Tuotekuvaus' || header === 'tuote' || 
                                           header === 'Product Name' || header === 'product_name';
                    
                    const cellClass = isProductColumn
                      ? "border border-gray-300 px-2 py-1 text-xs min-w-[200px] break-words whitespace-normal"
                      : "border border-gray-300 px-1 py-1 text-xs max-w-[120px] truncate";
                    
                    return (
                      <td 
                        key={header} 
                        className={cellClass} 
                        title={formattedValue}
                        style={isProductColumn ? { maxWidth: '300px' } : {}}
                      >
                        {isProductColumn ? (
                          <div className="group relative">
                            <span className="block">{formattedValue}</span>
                            {formattedValue.length > 50 && (
                              <div className="absolute z-10 hidden group-hover:block bg-white border border-gray-300 rounded shadow-lg p-2 mt-1 max-w-md">
                                <span className="text-xs">{formattedValue}</span>
                              </div>
                            )}
                          </div>
                        ) : (
                          formattedValue
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {filteredData.length > 20 && (
            <p className="text-xs text-gray-500 mt-2 text-center">
              ... ja {filteredData.length - 20} riviä lisää
            </p>
          )}
        </div>
      </div>
    );
  }, [productNameFilter, priceListNameFilter, priceListSupplierFilter, tampuuriCodeFilter, orderRPFilter, editingCell, columnOffset]);

  return (
    <div id="chat-layout-container" className="h-full flex gap-2 relative">
      {/* Toggle Buttons - VS Code Style */}
      <div className="absolute top-2 left-2 z-20 flex gap-1">
        <button
          onClick={() => setIsLeftPanelVisible(!isLeftPanelVisible)}
          className={`p-1 rounded border hover:bg-gray-100 transition-all ${
            !isLeftPanelVisible ? 'bg-gray-200 border-gray-400' : 'bg-white border-gray-300'
          }`}
          title={isLeftPanelVisible ? 'Piilota ERP Data (Ctrl+B)' : 'Näytä ERP Data (Ctrl+B)'}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            {isLeftPanelVisible ? (
              // Left panel visible - show hide icon
              <>
                <rect x="1" y="2" width="5" height="12" fill="#374151" />
                <rect x="7" y="2" width="8" height="12" fill="none" stroke="#374151" strokeWidth="1" />
              </>
            ) : (
              // Left panel hidden - show reveal icon
              <>
                <rect x="1" y="2" width="5" height="12" fill="none" stroke="#374151" strokeWidth="1" />
                <rect x="7" y="2" width="8" height="12" fill="#374151" />
              </>
            )}
          </svg>
        </button>
      </div>
      
      <div className="absolute top-2 right-2 z-20 flex gap-1">
        <button
          onClick={() => setIsRightPanelVisible(!isRightPanelVisible)}
          className={`p-1 rounded border hover:bg-gray-100 transition-all ${
            !isRightPanelVisible ? 'bg-gray-200 border-gray-400' : 'bg-white border-gray-300'
          }`}
          title={isRightPanelVisible ? 'Piilota Chat (Ctrl+J)' : 'Näytä Chat (Ctrl+J)'}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            {isRightPanelVisible ? (
              // Right panel visible - show hide icon
              <>
                <rect x="1" y="2" width="8" height="12" fill="none" stroke="#374151" strokeWidth="1" />
                <rect x="10" y="2" width="5" height="12" fill="#374151" />
              </>
            ) : (
              // Right panel hidden - show reveal icon
              <>
                <rect x="1" y="2" width="8" height="12" fill="#374151" />
                <rect x="10" y="2" width="5" height="12" fill="none" stroke="#374151" strokeWidth="1" />
              </>
            )}
          </svg>
        </button>
      </div>

      {/* Left Column - Database Data */}
      <div 
        className="flex flex-col gap-4 transition-all duration-200 h-full overflow-hidden"
        style={{ 
          display: isLeftPanelVisible ? 'flex' : 'none',
          width: isRightPanelVisible ? `${leftPanelWidth}%` : '100%'
        }}
      >
        {/* Database Data */}
        <Card className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <CardHeader className="pb-3 flex-shrink-0 sticky top-0 bg-white z-10 border-b">
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
          <CardContent className="pt-0 flex-1 overflow-auto">
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            <Tabs value={activeDataTab} onValueChange={(value) => setActiveDataTab(value as 'hinnasto' | 'tilaus' | 'myyntiExcel')} className="flex flex-col h-full">
              <TabsList className="grid w-full grid-cols-3 flex-shrink-0 sticky top-0 bg-white z-10">
                <TabsTrigger value="hinnasto">searchHinnasto</TabsTrigger>
                <TabsTrigger value="tilaus">searchTilaus</TabsTrigger>
                <TabsTrigger value="myyntiExcel">MyyntiExcel</TabsTrigger>
              </TabsList>
              
              <TabsContent value="hinnasto" className="mt-4 flex-1 overflow-auto">
                {renderDataTable(hinnastoData, 'Hinnasto')}
              </TabsContent>
              
              <TabsContent value="tilaus" className="mt-4 flex-1 overflow-auto">
                {renderDataTable(tilausData, 'Tilaus')}
              </TabsContent>
              
              
              <TabsContent value="myyntiExcel" className="mt-4 flex-1 overflow-auto">
                {renderInvoiceEditor()}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Resizable Divider - only show when both panels are visible */}
      {isLeftPanelVisible && isRightPanelVisible && (
        <div 
          className="w-2 bg-gray-200 hover:bg-blue-400 cursor-col-resize transition-colors duration-200 flex-shrink-0 rounded-full"
          onMouseDown={handleMouseDown}
          title="Vedä muuttaaksesi paneelien kokoa"
        />
      )}

      {/* Right Column - Chatbot */}
      <Card 
          className="flex flex-col h-full overflow-hidden transition-all duration-300"
        style={{ 
          display: isRightPanelVisible ? 'flex' : 'none',
          width: isLeftPanelVisible ? `${100 - leftPanelWidth}%` : 'calc(100% - 8px)',
          marginLeft: !isLeftPanelVisible ? '4px' : '0',
          marginRight: !isLeftPanelVisible ? '4px' : '0'
        }}
        >
        <CardHeader className="pb-3 flex-shrink-0 sticky top-0 bg-white z-10 border-b">
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Myyntilaskujen AI generoija
          </CardTitle>
          <CardDescription>
            Anna AI:lle tehtäviä laskujen ja lasku selvitysten generoimiseksi.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0 flex-1 overflow-hidden p-0">
          <ChatAI 
            className="h-full" 
          />
        </CardContent>
      </Card>
    </div>
  );
};