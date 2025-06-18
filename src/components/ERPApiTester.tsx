import React, { useState } from 'react';
import { erpApiService, SearchCriteria, SearchResult } from '../lib/erpApiService';
import { salesInvoiceApiService, InvoiceSearchCriteria, InvoiceSearchResult } from '../lib/salesInvoiceApiService';
import { useAuth } from '../hooks/useAuth';
import { useWorkspace } from '../hooks/useWorkspace';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { Search, Database, Clock, FileText, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';

export const ERPApiTester: React.FC = () => {
  const [purchaseSearchCriteria, setPurchaseSearchCriteria] = useState<SearchCriteria>({});
  const [invoiceSearchCriteria, setInvoiceSearchCriteria] = useState<InvoiceSearchCriteria>({});
  const [searchResult, setSearchResult] = useState<SearchResult | InvoiceSearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableFields, setAvailableFields] = useState<string[]>([]);
  const { user } = useAuth();
  const { currentWorkspace, workspaceConfig } = useWorkspace();

  const isPurchaseWorkspace = currentWorkspace === 'purchaser';
  const searchCriteria = isPurchaseWorkspace ? purchaseSearchCriteria : invoiceSearchCriteria;

  const handleInputChange = (field: string, value: string) => {
    if (isPurchaseWorkspace) {
      setPurchaseSearchCriteria(prev => ({
        ...prev,
        [field]: value || undefined
      }));
    } else {
      setInvoiceSearchCriteria(prev => ({
        ...prev,
        [field]: value || undefined
      }));
    }
  };

  const handleSearch = async () => {
    if (!user) {
      setError('Please log in to test the API');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = isPurchaseWorkspace
        ? await erpApiService.searchRecords(user.uid, purchaseSearchCriteria, currentWorkspace)
        : await salesInvoiceApiService.searchInvoices(user.uid, invoiceSearchCriteria);
      setSearchResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableFields = async () => {
    if (!user) return;

    try {
      const fields = isPurchaseWorkspace
        ? await erpApiService.getAvailableFields(user.uid, currentWorkspace)
        : await salesInvoiceApiService.getAvailableFields(user.uid);
      setAvailableFields(fields);
    } catch (err) {
      console.error('Failed to load available fields:', err);
    }
  };


  React.useEffect(() => {
    if (user) {
      loadAvailableFields();
    }
  }, [user]);

  if (!user) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-gray-600">Please log in to test the ERP API</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            {workspaceConfig[currentWorkspace].apiTestTitle}
          </CardTitle>
          <CardDescription>
            {currentWorkspace === 'purchaser' 
              ? 'Test the internal ERP API with different purchase order search criteria'
              : 'Test the internal ERP API with different sales invoice search criteria'
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Filter Documentation */}
          <div className="p-4 bg-green-50 border border-green-200 rounded">
            <h4 className="font-medium text-green-800 mb-3">
              📋 {isPurchaseWorkspace ? 'Purchase Order' : 'Sales Invoice'} API Field Mapping
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <h5 className="font-medium text-green-700 mb-2">
                  {isPurchaseWorkspace ? '📦 Supplier Name Filter' : '🏢 Customer Name Filter'}
                </h5>
                <p className="text-green-600 mb-1">
                  <strong>Searches column:</strong> "{isPurchaseWorkspace ? 'Supplier Name' : 'Customer Name'}"
                </p>
                <p className="text-green-600 text-xs">
                  {isPurchaseWorkspace 
                    ? 'Finds suppliers like "Huolto-Karhu Oy", "TechCorp", etc.'
                    : 'Finds customers like "Asunto Oy Kukkakatu", "Kiinteistö Oy Metsäkoti", etc.'
                  }
                </p>
              </div>
              
              {isPurchaseWorkspace ? (
                <>
                  <div>
                    <h5 className="font-medium text-green-700 mb-2">🛍️ Product Description</h5>
                    <p className="text-green-600 mb-1">
                      <strong>Searches column:</strong> "Description"
                    </p>
                    <p className="text-green-600 text-xs">
                      Finds products like "Kattoremontti", "Putkiston huolto", etc.
                    </p>
                  </div>
                  
                  <div>
                    <h5 className="font-medium text-green-700 mb-2">📅 Delivery Date Filter</h5>
                    <p className="text-green-600 mb-1">
                      <strong>Searches column:</strong> "Receive By"
                    </p>
                    <p className="text-green-600 text-xs">
                      Filter by when product should be delivered
                    </p>
                  </div>
                  
                  <div>
                    <h5 className="font-medium text-green-700 mb-2">👤 Buyer Name</h5>
                    <p className="text-green-600 mb-1">
                      <strong>Searches column:</strong> "Buyer Name"
                    </p>
                    <p className="text-green-600 text-xs">
                      Find orders by buyer like "Erika Sundström"
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <h5 className="font-medium text-green-700 mb-2">🛍️ Service Description</h5>
                    <p className="text-green-600 mb-1">
                      <strong>Searches column:</strong> "Service Description"
                    </p>
                    <p className="text-green-600 text-xs">
                      Finds services like "Kattoremontti", "Siivouspalvelut", etc.
                    </p>
                  </div>
                  
                  <div>
                    <h5 className="font-medium text-green-700 mb-2">📅 Invoice Date Filter</h5>
                    <p className="text-green-600 mb-1">
                      <strong>Searches column:</strong> "Invoice Date"
                    </p>
                    <p className="text-green-600 text-xs">
                      Filter by invoice billing date
                    </p>
                  </div>
                  
                  <div>
                    <h5 className="font-medium text-green-700 mb-2">⏰ Due Date Filter</h5>
                    <p className="text-green-600 mb-1">
                      <strong>Searches column:</strong> "Due Date"
                    </p>
                    <p className="text-green-600 text-xs">
                      Filter by payment due date
                    </p>
                  </div>
                  
                  <div>
                    <h5 className="font-medium text-green-700 mb-2">👤 Approver Name</h5>
                    <p className="text-green-600 mb-1">
                      <strong>Searches column:</strong> "Approved By"
                    </p>
                    <p className="text-green-600 text-xs">
                      Find invoices by approver like "Erika Sundström"
                    </p>
                  </div>
                  
                  <div>
                    <h5 className="font-medium text-green-700 mb-2">💳 Payment Status</h5>
                    <p className="text-green-600 mb-1">
                      <strong>Searches column:</strong> "Payment Status"
                    </p>
                    <p className="text-green-600 text-xs">
                      Filter by status: "Paid", "Pending", "Overdue"
                    </p>
                  </div>
                </>
              )}
            </div>
            <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded">
              <p className="text-blue-700 text-sm">
                <strong>💡 Searchable Fields:</strong> {
                  isPurchaseWorkspace 
                    ? 'Supplier Name, Description, Receive By, Buyer Name'
                    : 'Customer Name, Service Description, Invoice Date, Due Date, Approver Name, Payment Status'
                }
              </p>
              <p className="text-blue-700 text-xs mt-1">
                <strong>📊 All Available Data:</strong> {
                  isPurchaseWorkspace
                    ? 'PO Number, Supplier Details, Product Code, Quantity, Unit, Pricing, Contact Info'
                    : 'Invoice Number, Supplier Details, Service Details, Amount, Due Dates, Payment Status, Approver Info'
                }
              </p>
            </div>
          </div>

          {/* Available Fields Info */}
          {availableFields.length > 0 && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded">
              <h4 className="font-medium text-blue-800 mb-2">📊 Available Fields in Your Data:</h4>
              <div className="flex flex-wrap gap-2">
                {availableFields.map((field, index) => (
                  <Badge key={index} variant="secondary" className="text-xs">
                    {field}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Search Form */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="supplier" className="flex items-center gap-2">
                {isPurchaseWorkspace ? '📦 Supplier Name' : '🏢 Customer Name'}
                <span className="text-xs text-gray-500">
                  (searches: "{isPurchaseWorkspace ? 'Supplier Name' : 'Customer Name'}")
                </span>
              </Label>
              <Input
                id="supplier"
                placeholder={isPurchaseWorkspace 
                  ? "e.g., Huolto-Karhu, TechCorp, Kiinteistopalvelut"
                  : "e.g., Asunto Oy Kukkakatu, Kiinteistö Oy Metsäkoti"
                }
                value={isPurchaseWorkspace 
                  ? (searchCriteria as SearchCriteria).supplierName || ''
                  : (searchCriteria as InvoiceSearchCriteria).customerName || ''
                }
                onChange={(e) => handleInputChange(
                  isPurchaseWorkspace ? 'supplierName' : 'customerName', 
                  e.target.value
                )}
              />
            </div>
            
            {isPurchaseWorkspace ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="product" className="flex items-center gap-2">
                    🛍️ Product Description
                    <span className="text-xs text-gray-500">(searches: "Description")</span>
                  </Label>
                  <Input
                    id="product"
                    placeholder="e.g., Kattoremontti, Putkiston huolto, Sähkötyöt"
                    value={purchaseSearchCriteria.productDescription || ''}
                    onChange={(e) => handleInputChange('productDescription', e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="buyer" className="flex items-center gap-2">
                    👤 Buyer Name
                    <span className="text-xs text-gray-500">(searches: "Buyer Name")</span>
                  </Label>
                  <Input
                    id="buyer"
                    placeholder="e.g., Erika, Mikael, buyer name"
                    value={purchaseSearchCriteria.buyerName || ''}
                    onChange={(e) => handleInputChange('buyerName', e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="dateFrom">📅 Delivery Date From</Label>
                  <Input
                    id="dateFrom"
                    type="date"
                    value={purchaseSearchCriteria.dateFrom || ''}
                    onChange={(e) => handleInputChange('dateFrom', e.target.value)}
                  />
                  <p className="text-xs text-gray-500">Product delivery date range start</p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="dateTo">📅 Delivery Date To</Label>
                  <Input
                    id="dateTo"
                    type="date"
                    value={purchaseSearchCriteria.dateTo || ''}
                    onChange={(e) => handleInputChange('dateTo', e.target.value)}
                  />
                  <p className="text-xs text-gray-500">Product delivery date range end</p>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="service" className="flex items-center gap-2">
                    🛍️ Service Description
                    <span className="text-xs text-gray-500">(searches: "Service Description")</span>
                  </Label>
                  <Input
                    id="service"
                    placeholder="e.g., Kattoremontti, Siivouspalvelut, Sähkötyöt"
                    value={invoiceSearchCriteria.serviceDescription || ''}
                    onChange={(e) => handleInputChange('serviceDescription', e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="approver" className="flex items-center gap-2">
                    👤 Approver Name
                    <span className="text-xs text-gray-500">(searches: "Approved By")</span>
                  </Label>
                  <Input
                    id="approver"
                    placeholder="e.g., Erika, Mikael, approver name"
                    value={invoiceSearchCriteria.approverName || ''}
                    onChange={(e) => handleInputChange('approverName', e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="invoiceDateFrom">📅 Invoice Date From</Label>
                  <Input
                    id="invoiceDateFrom"
                    type="date"
                    value={invoiceSearchCriteria.invoiceDateFrom || ''}
                    onChange={(e) => handleInputChange('invoiceDateFrom', e.target.value)}
                  />
                  <p className="text-xs text-gray-500">Invoice billing date range start</p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="invoiceDateTo">📅 Invoice Date To</Label>
                  <Input
                    id="invoiceDateTo"
                    type="date"
                    value={invoiceSearchCriteria.invoiceDateTo || ''}
                    onChange={(e) => handleInputChange('invoiceDateTo', e.target.value)}
                  />
                  <p className="text-xs text-gray-500">Invoice billing date range end</p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="dueDateFrom">⏰ Due Date From</Label>
                  <Input
                    id="dueDateFrom"
                    type="date"
                    value={invoiceSearchCriteria.dueDateFrom || ''}
                    onChange={(e) => handleInputChange('dueDateFrom', e.target.value)}
                  />
                  <p className="text-xs text-gray-500">Payment due date range start</p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="dueDateTo">⏰ Due Date To</Label>
                  <Input
                    id="dueDateTo"
                    type="date"
                    value={invoiceSearchCriteria.dueDateTo || ''}
                    onChange={(e) => handleInputChange('dueDateTo', e.target.value)}
                  />
                  <p className="text-xs text-gray-500">Payment due date range end</p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="paymentStatus" className="flex items-center gap-2">
                    💳 Payment Status
                    <span className="text-xs text-gray-500">(searches: "Payment Status")</span>
                  </Label>
                  <Input
                    id="paymentStatus"
                    placeholder="e.g., Paid, Pending, Overdue"
                    value={invoiceSearchCriteria.paymentStatus || ''}
                    onChange={(e) => handleInputChange('paymentStatus', e.target.value)}
                  />
                </div>
              </>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3">
            <Button 
              onClick={handleSearch} 
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Search className="w-4 h-4 mr-2" />
              Search Records
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Search Results */}
      {searchResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Search Results
            </CardTitle>
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <span>Found: <strong>{searchResult.totalCount}</strong> records</span>
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {searchResult.processingTimeMs}ms
              </span>
              <span>{searchResult.executedAt.toLocaleTimeString()}</span>
            </div>
          </CardHeader>
          <CardContent>
            {searchResult.records.length === 0 ? (
              <p className="text-gray-600 text-center py-4">No records found matching the search criteria</p>
            ) : (
              <div className="space-y-4">
                {searchResult.records.slice(0, 10).map((record, index) => (
                  <div key={index} className="p-4 border rounded-lg bg-gray-50">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="outline">Row {record.rowIndex}</Badge>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 text-sm">
                      {Object.entries(record).map(([key, value]) => {
                        if (key === 'rowIndex') return null;
                        return (
                          <div key={key} className="truncate">
                            <strong>{key}:</strong> {String(value)}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
                
                {searchResult.records.length > 10 && (
                  <p className="text-center text-gray-600 text-sm">
                    Showing first 10 of {searchResult.totalCount} results
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};