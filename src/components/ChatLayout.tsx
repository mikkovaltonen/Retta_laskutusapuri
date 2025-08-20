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
  const [myyntilaskutData, setMyyntilaskutData] = useState<DatabaseRecord[]>([]);
  const [ostolaskuData, setOstolaskuData] = useState<DatabaseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeDataTab, setActiveDataTab] = useState<'hinnasto' | 'tilaus' | 'myyntilaskut' | 'ostolasku'>('hinnasto');
  const [leftPanelWidth, setLeftPanelWidth] = useState(50); // Percentage
  const [isDragging, setIsDragging] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [editingCell, setEditingCell] = useState<{rowId: string, field: string} | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [productNumberFilter, setProductNumberFilter] = useState<string>('');
  const [orderCodeFilter, setOrderCodeFilter] = useState<string>('');
  const [ostolaskuTampuuriFilter, setOstolaskuTampuuriFilter] = useState<string>('');
  const [ostolaskuProductFilter, setOstolaskuProductFilter] = useState<string>('');
  const [columnOffset, setColumnOffset] = useState<Record<string, number>>({});
  const { user } = useAuth();

  // Filter handlers with useCallback to prevent re-renders
  const handleOstolaskuTampuuriFilterChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('🔍 Tampuuri filter onChange triggered:', {
      newValue: e.target.value,
      oldValue: ostolaskuTampuuriFilter,
      activeElement: document.activeElement?.tagName,
      activeElementId: (document.activeElement as HTMLElement)?.id
    });
    setOstolaskuTampuuriFilter(e.target.value);
  }, [ostolaskuTampuuriFilter]);

  const handleOstolaskuProductFilterChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('🔍 Product filter onChange triggered:', {
      newValue: e.target.value,
      oldValue: ostolaskuProductFilter,
      activeElement: document.activeElement?.tagName,
      activeElementId: (document.activeElement as HTMLElement)?.id
    });
    setOstolaskuProductFilter(e.target.value);
  }, [ostolaskuProductFilter]);

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

      // Load myyntilaskut data in hierarchical format
      const myyntilaskutDocuments = await storageService.getUserMyyntilaskutDocuments(user.uid);
      
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
      
      const invoiceHeaders = myyntilaskutDocuments.flatMap(doc => 
        doc.jsonData?.map((lasku, laskuIndex) => {
          // Look up tilaus data using asiakasnumero (which corresponds to Tampuurinumero)
          const tilausInfo = tilausLookup.get(String(lasku.asiakasnumero || '').trim()) || {
            tilaustunnus: '',
            yhtiönNimi: '',
            tilaajanNimi: ''
          };
          
          return {
            id: `${doc.id}_${laskuIndex}`,
            docId: doc.id,
            firestoreDocId: lasku.id, // The real Firestore document ID
            asiakasnumero: lasku.asiakasnumero,
            laskuotsikko: lasku.laskuotsikko || 'Myyntilasku',
            luontipaiva: lasku.luontipaiva,
            kokonaissumma: lasku.kokonaissumma,
            rivienMaara: lasku.laskurivit?.length || 0,
            // Add tilaus information
            tilaustunnus: tilausInfo.tilaustunnus,
            yhtiönNimi: tilausInfo.yhtiönNimi,
            tilaajanNimi: tilausInfo.tilaajanNimi,
            laskurivit: lasku.laskurivit?.map((rivi, riviIndex) => {
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
                ...rivi
              };
            }) || []
          };
        }) || []
      );
      setMyyntilaskutData(invoiceHeaders.slice(0, 20)); // Show first 20 invoices

      // Ostolaskut are session-specific, loaded directly in ChatAI component
      // Initial empty state - will be updated via callback from ChatAI
      setOstolaskuData([]);

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
    const isInvoiceData = filename === 'myyntilaskut' && data.some(item => item.laskurivit);
    
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
              // Invoice header fields
              asiakasnumero: headerData.asiakasnumero,
              tilaustunnus: headerData.tilaustunnus,
              yhtiönNimi: headerData.yhtiönNimi,
              tilaajanNimi: headerData.tilaajanNimi,
              laskuotsikko: headerData.laskuotsikko,
              luontipaiva: headerData.luontipaiva,
              rivienMaara: headerData.rivienMaara,
              docId: headerData.docId,
              // Invoice line fields
              tuotekoodi: line.tuotekoodi,
              tuotenimi: line.tuotenimi,
              määrä: line.määrä,
              yksikkö: line.yksikkö,
              ahinta: line.ahinta,
              rivihinta: line.rivihinta || (Number(line.määrä) * Number(line.ahinta)),
              kuvaus: line.kuvaus,
              selvitys: line.selvitys,
              alvkoodi: line.alvkoodi,
              reskontra: line.reskontra,
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
    const sheetName = isInvoiceData ? 'Myyntilaskut' : filename;
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
      // Check if field name suggests it's a price or amount
      const priceFields = ['price', 'hinta', 'amount', 'summa', 'total', 'cost', 'kustannus'];
      const isPriceField = priceFields.some(field => 
        header.toLowerCase().includes(field.toLowerCase())
      );
      
      if (isPriceField) {
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
              onClick={() => downloadAsExcel(myyntilaskutData, 'myyntilaskut')}
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
                  <th className="border-b px-1 py-1 text-left font-medium text-xs">Asiakas</th>
                  <th className="border-b px-1 py-1 text-left font-medium text-xs">Tilaustunnus</th>
                  <th className="border-b px-1 py-1 text-left font-medium text-xs">Yhtiön nimi</th>
                  <th className="border-b px-1 py-1 text-left font-medium text-xs">Tilaajan nimi</th>
                  <th className="border-b px-1 py-1 text-left font-medium text-xs">Otsikko</th>
                  <th className="border-b px-1 py-1 text-left font-medium text-xs">Päivämäärä</th>
                  <th className="border-b px-1 py-1 text-left font-medium text-xs">Summa</th>
                  <th className="border-b px-1 py-1 text-left font-medium text-xs">Rivit</th>
                  <th className="border-b px-1 py-1 text-left font-medium text-xs">Toiminnot</th>
                </tr>
              </thead>
              <tbody>
                {myyntilaskutData.map((invoice, index) => (
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
                    <td className="border-b px-1 py-1 text-xs truncate max-w-[80px]" title={invoice.tilaustunnus}>
                      {invoice.tilaustunnus || '-'}
                    </td>
                    <td className="border-b px-1 py-1 text-xs truncate max-w-[100px]" title={invoice.yhtiönNimi}>
                      {invoice.yhtiönNimi || '-'}
                    </td>
                    <td className="border-b px-1 py-1 text-xs truncate max-w-[100px]" title={invoice.tilaajanNimi}>
                      {invoice.tilaajanNimi || '-'}
                    </td>
                    <td className="border-b px-1 py-1 text-xs truncate max-w-[80px]" title={invoice.laskuotsikko}>
                      {invoice.laskuotsikko}
                    </td>
                    <td className="border-b px-1 py-1 text-xs">
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
                    <td className="border-b px-1 py-1 text-xs">
                      {invoice.kokonaissumma ? `${invoice.kokonaissumma}€` : '-'}
                    </td>
                    <td className="border-b px-1 py-1 text-xs">
                      {invoice.rivienMaara || 0} kpl
                    </td>
                    <td className="border-b px-1 py-1">
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
                    <th className="border-b px-2 py-1 text-left font-medium text-xs min-w-[150px]">Kuvaus</th>
                    <th className="border-b px-2 py-1 text-left font-medium text-xs min-w-[150px]">Tilattu tuote</th>
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
                      <td className="border-b px-2 py-1 text-xs min-w-[150px] max-w-[250px]">
                        <div className="group relative">
                          <span className="block break-words whitespace-normal">
                            {line.tilattuTuote || '-'}
                          </span>
                          {line.tilattuTuote && line.tilattuTuote.length > 50 && (
                            <div className="absolute z-10 hidden group-hover:block bg-white border border-gray-300 rounded shadow-lg p-2 mt-1 max-w-md">
                              <span className="text-xs">{line.tilattuTuote}</span>
                            </div>
                          )}
                        </div>
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

        {/* Selected Line Item Explanation */}
        {selectedInvoice && selectedLineId && (() => {
          const selectedLine = selectedInvoice.laskurivit?.find(line => line.id === selectedLineId);
          if (!selectedLine) return null;
          
          return (
            <div className="space-y-2 mt-4">
              <h4 className="font-medium text-sm">Laskutusselvitys: {selectedLine.tuotenimi}</h4>
              <div className="border rounded p-3 bg-gray-50 max-h-96 overflow-y-auto">
                <div className="text-sm prose prose-sm max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {selectedLine.selvitys || 'Selvitystä ei ole saatavilla tälle laskuriville.'}
                  </ReactMarkdown>
                </div>
              </div>
              <p className="text-xs text-gray-500">
                Klikkaa laskuriviä nähdäksesi sen selvityksen. Klikkaa uudelleen piilottaaksesi.
              </p>
            </div>
          );
        })()}

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
    console.log(`🔄 renderDataTable called for ${title}:`, {
      dataLength: data.length,
      title,
      ostolaskuTampuuriFilter,
      ostolaskuProductFilter,
      timestamp: new Date().toISOString()
    });
    
    // Apply filters based on tab
    let filteredData = data;
    
    // Apply product name filter for Hinnasto
    if (title === 'Hinnasto' && productNumberFilter) {
      filteredData = data.filter(record => {
        // Check ProductName field with advanced text matching
        const productName = String(record['ProductName'] || '').trim();
        
        // Normalize for comparison (case-insensitive, remove extra spaces)
        const searchTerms = productNumberFilter.toLowerCase().replace(/\s+/g, ' ').trim().split(' ');
        const normalizedItemName = productName.toLowerCase().replace(/\s+/g, ' ');
        
        // Check if all search terms are found in the product name
        // This allows searching for "kunto pts" to find "Kuntotutkimus ja PTS"
        const allTermsMatch = searchTerms.every(term => normalizedItemName.includes(term));
        
        // Also check for exact substring match
        const exactMatch = normalizedItemName.includes(productNumberFilter.toLowerCase().replace(/\s+/g, ' ').trim());
        
        return allTermsMatch || exactMatch;
      });
    }
    
    // Apply filters for Tilaus
    if (title === 'Tilaus') {
      // Apply Code (tampuurinumero) filter
      if (orderCodeFilter) {
        filteredData = filteredData.filter(record => {
          // Check Code field (tampuurinumero)
          const code = record['Code'] || record['Tampuurinumero'] || '';
          return String(code).toLowerCase().includes(orderCodeFilter.toLowerCase());
        });
      }
    }
    
    // Apply filters for Ostolasku
    if (title === 'Ostolasku') {
      console.log('🔍 Ostolasku filtering:', {
        originalDataLength: data.length,
        tampuuriFilter: ostolaskuTampuuriFilter,
        productFilter: ostolaskuProductFilter,
        firstRecordKeys: data[0] ? Object.keys(data[0]) : 'no data',
        firstRecordValues: data[0] ? data[0] : 'no data',
        sampleRecord: data[0] ? JSON.stringify(data[0], null, 2) : 'no data'
      });
      
      // Apply tampuurinumero filter - search in "tampuuri" field
      if (ostolaskuTampuuriFilter) {
        const beforeFilter = filteredData.length;
        filteredData = filteredData.filter((record, index) => {
          // Get the tampuuri field value
          const tampuuri = record['tampuuri'] || '';
          
          const matches = String(tampuuri).toLowerCase().includes(ostolaskuTampuuriFilter.toLowerCase());
          
          if (index === 0) {
            console.log('🔎 First record tampuuri check:', {
              tampuuri,
              filter: ostolaskuTampuuriFilter,
              matches,
              recordFields: Object.keys(record)
            });
          }
          
          return matches;
        });
        console.log(`📊 Tampuuri filter result: ${beforeFilter} -> ${filteredData.length} records`);
      }
      
      // Apply product description filter - search in "Tuote" field
      if (ostolaskuProductFilter) {
        const beforeFilter = filteredData.length;
        filteredData = filteredData.filter((record, index) => {
          // Get the Tuote field value
          const tuote = record['Tuote'] || '';
          
          const matches = String(tuote).toLowerCase().includes(ostolaskuProductFilter.toLowerCase());
          
          if (index === 0) {
            console.log('🔎 First record tuote check:', {
              tuote,
              filter: ostolaskuProductFilter,
              matches
            });
          }
          
          return matches;
        });
        console.log(`📊 Tuote filter result: ${beforeFilter} -> ${filteredData.length} records`);
      }
    }
    
    if (filteredData.length === 0) {
      const emptyMessage = title === 'Myyntilaskut' 
        ? 'Luo myyntilasku pyytämällä myyntilaskun AI genrointia chatbotilta'
        : title === 'Ostolasku'
        ? (ostolaskuTampuuriFilter || ostolaskuProductFilter)
          ? ostolaskuTampuuriFilter && ostolaskuProductFilter
            ? `Ei tuloksia tampuurinumerolle "${ostolaskuTampuuriFilter}" ja tuotekuvaukselle "${ostolaskuProductFilter}"`
            : ostolaskuTampuuriFilter
            ? `Ei tuloksia tampuurinumerolle "${ostolaskuTampuuriFilter}"`
            : `Ei tuloksia tuotekuvaukselle "${ostolaskuProductFilter}"`
          : 'Lataa ostolasku käyttämällä "Lataa ostolasku" -painiketta Chat AI -näkymässä'
        : productNumberFilter && title === 'Hinnasto'
        ? `Ei tuloksia tuotetunnukselle "${productNumberFilter}"`
        : orderCodeFilter && title === 'Tilaus'
        ? `Ei tuloksia tampuurinumerolle "${orderCodeFilter}"`
        : 'Lataa data Admin-sivun kautta';
      
      return (
        <div className="space-y-4">
          {title === 'Hinnasto' && (
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Suodata tuotteen nimellä..."
                value={productNumberFilter}
                onChange={(e) => setProductNumberFilter(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {productNumberFilter && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setProductNumberFilter('')}
                >
                  Tyhjennä
                </Button>
              )}
            </div>
          )}
          {title === 'Tilaus' && (
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Suodata tampuurinumerolla (Code)..."
                value={orderCodeFilter}
                onChange={(e) => setOrderCodeFilter(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {orderCodeFilter && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setOrderCodeFilter('')}
                >
                  Tyhjennä
                </Button>
              )}
            </div>
          )}
          {title === 'Ostolasku' && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Suodata tampuurinumerolla (Code)..."
                  value={ostolaskuTampuuriFilter}
                  onChange={(e) => setOstolaskuTampuuriFilter(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {ostolaskuTampuuriFilter && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setOstolaskuTampuuriFilter('')}
                  >
                    Tyhjennä
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Suodata tuotekuvauksella..."
                  value={ostolaskuProductFilter}
                  onChange={(e) => setOstolaskuProductFilter(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {ostolaskuProductFilter && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setOstolaskuProductFilter('')}
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
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Suodata tuotteen nimellä..."
              value={productNumberFilter}
              onChange={(e) => setProductNumberFilter(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {productNumberFilter && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setProductNumberFilter('')}
              >
                Tyhjennä
              </Button>
            )}
          </div>
        )}
        
        {title === 'Tilaus' && (
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Suodata tampuurinumerolla (Code)..."
              value={orderCodeFilter}
              onChange={(e) => setOrderCodeFilter(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {orderCodeFilter && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setOrderCodeFilter('')}
              >
                Tyhjennä
              </Button>
            )}
          </div>
        )}
        
        {title === 'Ostolasku' && (
          <div className="space-y-2">
            {data.length > 0 && (
              <Alert className="bg-green-50 border-green-200">
                <AlertDescription className="text-sm text-green-700">
                  ✅ Sessiokohtaista ostolaskudataa ladattu: {data.length} riviä
                </AlertDescription>
              </Alert>
            )}
            <div className="flex gap-2">
              <Input
                id="ostolasku-tampuuri-filter"
                key="ostolasku-tampuuri-filter"
                type="text"
                placeholder="Suodata tampuurinumerolla..."
                value={ostolaskuTampuuriFilter}
                onChange={handleOstolaskuTampuuriFilterChange}
                className="flex-1"
              />
              {ostolaskuTampuuriFilter && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setOstolaskuTampuuriFilter('')}
                >
                  Tyhjennä
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Input
                id="ostolasku-product-filter"
                key="ostolasku-product-filter"
                type="text"
                placeholder="Suodata tuotteella..."
                value={ostolaskuProductFilter}
                onChange={handleOstolaskuProductFilterChange}
                className="flex-1"
              />
              {ostolaskuProductFilter && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setOstolaskuProductFilter('')}
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
              {(productNumberFilter && title === 'Hinnasto') || (orderCodeFilter && title === 'Tilaus') || ((ostolaskuTampuuriFilter || ostolaskuProductFilter) && title === 'Ostolasku')
                ? `${filteredData.length} / ${data.length} riviä` 
                : `${filteredData.length} riviä`}
            </Badge>
            <Badge variant="outline">{displayHeaders.length}/{headers.length} saraketta</Badge>
            {headers.length > displayHeaders.length && (
              <Badge variant="secondary">+{headers.length - displayHeaders.length} piilotettu</Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Column navigation arrows */}
            {headers.length > maxVisibleColumns && (
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
                {displayHeaders.map(header => {
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
                  {displayHeaders.map(header => {
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
  }, [ostolaskuTampuuriFilter, ostolaskuProductFilter, productNumberFilter, orderCodeFilter, editingCell, columnOffset, leftPanelWidth]);

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
            
            <Tabs value={activeDataTab} onValueChange={(value) => setActiveDataTab(value as 'hinnasto' | 'tilaus' | 'myyntilaskut' | 'ostolasku')}>
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="hinnasto">Hinnasto</TabsTrigger>
                <TabsTrigger value="tilaus">Tilaukset</TabsTrigger>
                <TabsTrigger value="ostolasku">Ostolaskut</TabsTrigger>
                <TabsTrigger value="myyntilaskut">Myyntilaskut</TabsTrigger>
              </TabsList>
              
              <TabsContent value="hinnasto" className="mt-4">
                {renderDataTable(hinnastoData, 'Hinnasto')}
              </TabsContent>
              
              <TabsContent value="tilaus" className="mt-4">
                {renderDataTable(tilausData, 'Tilaus')}
              </TabsContent>
              
              <TabsContent value="ostolasku" className="mt-4">
                {renderDataTable(ostolaskuData, 'Ostolasku')}
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
          <ChatAI 
            className="h-full" 
            onOstolaskuDataChange={(data) => setOstolaskuData(data)}
          />
        </CardContent>
      </Card>
    </div>
  );
};