import React, { useState } from 'react';
import { erpApiService, SearchCriteria, SearchResult } from '../lib/erpApiService';
import { useAuth } from '../hooks/useAuth';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { Search, Database, Clock, FileText, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';

export const ERPApiTester: React.FC = () => {
  const [searchCriteria, setSearchCriteria] = useState<SearchCriteria>({});
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableFields, setAvailableFields] = useState<string[]>([]);
  const { user } = useAuth();

  const handleInputChange = (field: keyof SearchCriteria, value: string) => {
    setSearchCriteria(prev => ({
      ...prev,
      [field]: value || undefined
    }));
  };

  const handleSearch = async () => {
    if (!user) {
      setError('Please log in to test the API');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await erpApiService.searchRecords(user.uid, searchCriteria);
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
      const fields = await erpApiService.getAvailableFields(user.uid);
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
            ERP API Tester
          </CardTitle>
          <CardDescription>
            Test the internal ERP API with different search criteria
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
            <h4 className="font-medium text-green-800 mb-3">📋 Purchase Order API Field Mapping</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <h5 className="font-medium text-green-700 mb-2">📦 Supplier Name Filter</h5>
                <p className="text-green-600 mb-1">
                  <strong>Searches column:</strong> "Supplier Name"
                </p>
                <p className="text-green-600 text-xs">
                  Finds suppliers like "Huolto-Karhu Oy", "TechCorp", etc.
                </p>
              </div>
              
              <div>
                <h5 className="font-medium text-green-700 mb-2">🛍️ Product/Service Description</h5>
                <p className="text-green-600 mb-1">
                  <strong>Searches column:</strong> "Description"
                </p>
                <p className="text-green-600 text-xs">
                  Finds services like "Kattoremontti", "Putkiston huolto", etc.
                </p>
              </div>
              
              <div>
                <h5 className="font-medium text-green-700 mb-2">📅 Delivery Date Filter</h5>
                <p className="text-green-600 mb-1">
                  <strong>Searches column:</strong> "Receive By"
                </p>
                <p className="text-green-600 text-xs">
                  Filter by when service/product should be delivered
                </p>
              </div>
              
              <div>
                <h5 className="font-medium text-green-700 mb-2">👤 Property Manager</h5>
                <p className="text-green-600 mb-1">
                  <strong>Searches column:</strong> "Buyer Name"
                </p>
                <p className="text-green-600 text-xs">
                  Find orders by property manager like "Erika Sundström"
                </p>
              </div>
              
              <div>
                <h5 className="font-medium text-green-700 mb-2">📋 PO Number</h5>
                <p className="text-green-600 mb-1">
                  <strong>Available in results:</strong> "PO Number"
                </p>
                <p className="text-green-600 text-xs">
                  Unique purchase order identifier (e.g., 107000)
                </p>
              </div>
              
              <div>
                <h5 className="font-medium text-green-700 mb-2">💰 Pricing Info</h5>
                <p className="text-green-600 mb-1">
                  <strong>Available:</strong> Unit Price, Line Amount, VAT %
                </p>
                <p className="text-green-600 text-xs">
                  Complete pricing breakdown per order line
                </p>
              </div>
            </div>
            <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded">
              <p className="text-blue-700 text-sm">
                <strong>💡 Searchable Fields:</strong> Supplier Name, Description, Receive By, Buyer Name
              </p>
              <p className="text-blue-700 text-xs mt-1">
                <strong>📊 All Available Data:</strong> PO Number, Supplier Details, Product Code, Quantity, Unit, Pricing, Contact Info, Invoice Details
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
                📦 Supplier Name
                <span className="text-xs text-gray-500">(searches: "Supplier Name")</span>
              </Label>
              <Input
                id="supplier"
                placeholder="e.g., Huolto-Karhu, TechCorp, Kiinteistopalvelut"
                value={searchCriteria.supplierName || ''}
                onChange={(e) => handleInputChange('supplierName', e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="product" className="flex items-center gap-2">
                🛍️ Service/Product Description
                <span className="text-xs text-gray-500">(searches: "Description")</span>
              </Label>
              <Input
                id="product"
                placeholder="e.g., Kattoremontti, Putkiston huolto, Sähkötyöt"
                value={searchCriteria.productDescription || ''}
                onChange={(e) => handleInputChange('productDescription', e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="buyer" className="flex items-center gap-2">
                👤 Property Manager
                <span className="text-xs text-gray-500">(searches: "Buyer Name")</span>
              </Label>
              <Input
                id="buyer"
                placeholder="e.g., Erika, Mikael, property manager name"
                value={searchCriteria.buyerName || ''}
                onChange={(e) => handleInputChange('buyerName', e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="dateFrom">📅 Delivery Date From</Label>
              <Input
                id="dateFrom"
                type="date"
                value={searchCriteria.dateFrom || ''}
                onChange={(e) => handleInputChange('dateFrom', e.target.value)}
              />
              <p className="text-xs text-gray-500">Service delivery date range start</p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="dateTo">📅 Delivery Date To</Label>
              <Input
                id="dateTo"
                type="date"
                value={searchCriteria.dateTo || ''}
                onChange={(e) => handleInputChange('dateTo', e.target.value)}
              />
              <p className="text-xs text-gray-500">Service delivery date range end</p>
            </div>
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