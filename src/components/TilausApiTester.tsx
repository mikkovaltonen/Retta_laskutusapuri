import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { Search, Database, Clock, FileText, AlertCircle, Bot } from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';

interface TilausSearchCriteria {
  [key: string]: string | number | undefined;
}

interface TilausRecord {
  id: string;
  [key: string]: unknown;
}

interface TilausSearchResult {
  records: TilausRecord[];
  totalFound: number;
  executionTime: number;
  searchCriteria: TilausSearchCriteria;
}

export const TilausApiTester: React.FC = () => {
  const [searchCriteria, setSearchCriteria] = useState<TilausSearchCriteria>({});
  const [searchResult, setSearchResult] = useState<TilausSearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableFields, setAvailableFields] = useState<string[]>([]);
  const [functionTestTampuuriCode, setFunctionTestTampuuriCode] = useState('');
  const [functionTestResult, setFunctionTestResult] = useState<any>(null);
  const [functionTestLoading, setFunctionTestLoading] = useState(false);
  const { user } = useAuth();

  const handleInputChange = (field: string, value: string) => {
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
    const startTime = Date.now();

    try {
      // Query ALL tilaus records without limit (same as UI)
      const q = query(
        collection(db, 'tilaus_data')
        // No limit - get all records
      );

      const querySnapshot = await getDocs(q);
      let records: TilausRecord[] = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as TilausRecord[];

      // Apply Code (Tampuurinumero) filter only
      if (searchCriteria.code) {
        records = records.filter(record => {
          const code = record['Code'] || record['Tampuurinumero'] || '';
          return String(code).toLowerCase().includes(searchCriteria.code!.toLowerCase());
        });
      }

      const executionTime = Date.now() - startTime;

      setSearchResult({
        records,
        totalFound: records.length,
        executionTime,
        searchCriteria
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableFields = async () => {
    if (!user) return;

    try {
      // Query ALL tilaus records (shared data)
      const q = query(
        collection(db, 'tilaus_data'),
        limit(1)
      );
      
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const firstDoc = querySnapshot.docs[0].data();
        const fields = Object.keys(firstDoc).filter(key => 
          !['userId', 'uploadedAt', 'createdAt', 'originalFileName', 'rowIndex'].includes(key)
        );
        setAvailableFields(fields);
      }
    } catch (err) {
      console.error('Failed to load available fields:', err);
    }
  };

  useEffect(() => {
    if (user) {
      loadAvailableFields();
    }
  }, [user]);

  const clearSearch = () => {
    setSearchCriteria({});
    setSearchResult(null);
    setError(null);
  };

  // Test the searchTilaus function exactly as the chatbot uses it
  const testSearchTilausFunction = async () => {
    if (!user) {
      setError('Please log in to test the function');
      return;
    }

    setFunctionTestLoading(true);
    setFunctionTestResult(null);
    const startTime = Date.now();

    try {
      console.log('🔧 Testing searchTilaus function with tampuuriCode:', functionTestTampuuriCode);
      
      // Query ALL tilaus_data records without limit - exactly like in geminiChatService
      const q = query(
        collection(db, 'tilaus_data')
        // No limit - get all records
      );

      console.log('📊 Querying shared tilaus_data collection');
      const querySnapshot = await getDocs(q);
      console.log('📊 Found', querySnapshot.docs.length, 'documents in tilaus_data collection');
      
      let records = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Log all unique field names for debugging
      const allFieldNames = new Set<string>();
      records.forEach(record => {
        Object.keys(record).forEach(key => allFieldNames.add(key));
      });
      console.log('📋 All unique field names in collection:', Array.from(allFieldNames));

      // Apply filter - exactly like in geminiChatService
      if (functionTestTampuuriCode) {
        console.log('🔎 Filtering by Code (Tampuurinumero):', functionTestTampuuriCode);
        const beforeFilter = records.length;
        
        // Log what we're checking for each record
        records = records.filter((record, index) => {
          // Check Code field (Tampuurinumero)
          const code = record['Code'] || record['Tampuurinumero'] || '';
          
          // Log the first few records for debugging
          if (index < 3) {
            console.log(`Record ${index}:`, {
              Code: record['Code'],
              Tampuurinumero: record['Tampuurinumero'],
              extractedValue: code,
              searchTerm: functionTestTampuuriCode.toLowerCase(),
              matches: String(code).toLowerCase().includes(functionTestTampuuriCode.toLowerCase())
            });
          }
          
          return String(code).toLowerCase().includes(functionTestTampuuriCode.toLowerCase());
        });
        console.log(`📊 Filtered from ${beforeFilter} to ${records.length} records`);
      }

      const executionTime = Date.now() - startTime;
      
      const result = {
        success: true,
        data: records.slice(0, 10), // Limit to 10 like in the service
        count: records.length,
        executionTime,
        allFieldNames: Array.from(allFieldNames),
        sampleRecord: records[0] || null
      };
      
      console.log('✅ searchTilaus test result:', {
        success: result.success,
        resultCount: result.data.length,
        totalFound: result.count
      });
      
      setFunctionTestResult(result);
    } catch (err) {
      console.error('❌ Function test error:', err);
      setFunctionTestResult({
        success: false,
        error: err instanceof Error ? err.message : 'Test failed'
      });
    } finally {
      setFunctionTestLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="api-test" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="api-test">API Testaus</TabsTrigger>
          <TabsTrigger value="function-test">
            <Bot className="w-4 h-4 mr-2" />
            Function Call Testaus
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="api-test" className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            Tilaus API Testaus
          </CardTitle>
          <CardDescription>
            Hae tilauksia tampuurinumerolla (Code-kenttä)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Available Fields Info */}
          {availableFields.length > 0 && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="font-medium text-blue-800 mb-2">📋 Saatavilla olevat kentät:</h4>
              <div className="flex flex-wrap gap-2">
                {availableFields.map(field => (
                  <Badge key={field} variant="secondary">{field}</Badge>
                ))}
              </div>
            </div>
          )}

          {/* Search Form - Only Code */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code">Hae tampuurinumerolla (Code)</Label>
              <Input
                id="code"
                placeholder="esim. 12345"
                value={searchCriteria.code || ''}
                onChange={(e) => handleInputChange('code', e.target.value)}
              />
              <p className="text-sm text-gray-500">
                Haku toimii osittaisella vastaavuudella tampuurinumerolla (Code-kenttä). Esim. "123" löytää kaikki tilaukset joiden koodi sisältää "123".
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSearch} disabled={loading || !user}>
              <Search className="w-4 h-4 mr-2" />
              {loading ? 'Searching...' : 'Hae Tilauksista'}
            </Button>
            <Button variant="outline" onClick={clearSearch}>
              Clear
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
              Hakutulokset
            </CardTitle>
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <div className="flex items-center gap-1">
                <Database className="w-4 h-4" />
                <span>{searchResult.totalFound} tulosta</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                <span>{searchResult.executionTime}ms</span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {searchResult.records.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse border border-gray-300">
                  <thead>
                    <tr className="bg-gray-100">
                      {availableFields.map(field => (
                        <th key={field} className="border border-gray-300 px-3 py-2 text-left">
                          {field}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {searchResult.records.map((record, index) => (
                      <tr key={record.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        {availableFields.map(field => (
                          <td key={field} className="border border-gray-300 px-3 py-2">
                            {String(record[field] || '-')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                Ei tuloksia hakukriteereillä
              </div>
            )}
          </CardContent>
        </Card>
      )}
        </TabsContent>
        
        <TabsContent value="function-test" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="w-5 h-5" />
                searchTilaus Function Call Testaus
              </CardTitle>
              <CardDescription>
                Testaa searchTilaus-funktiota täsmälleen samalla tavalla kuin chatbot käyttää sitä
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Tämä testeri simuloi chatbotin searchTilaus-funktiokutsua. Se näyttää tarkan debug-lokin siitä, miten funktio käsittelee dataa.
                </AlertDescription>
              </Alert>
              
              <div className="space-y-2">
                <Label htmlFor="functionTestTampuuriCode">Tampuurinumero (Code)</Label>
                <Input
                  id="functionTestTampuuriCode"
                  placeholder="esim. 12345"
                  value={functionTestTampuuriCode}
                  onChange={(e) => setFunctionTestTampuuriCode(e.target.value)}
                />
              </div>
              
              <Button 
                onClick={testSearchTilausFunction} 
                disabled={functionTestLoading || !user}
              >
                <Search className="w-4 h-4 mr-2" />
                {functionTestLoading ? 'Testing...' : 'Test searchTilaus Function'}
              </Button>
              
              {functionTestResult && (
                <div className="space-y-4">
                  <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                    <h4 className="font-medium mb-2">📊 Test Result:</h4>
                    <div className="space-y-2 text-sm">
                      <div>✅ Success: {functionTestResult.success ? 'Yes' : 'No'}</div>
                      {functionTestResult.error && (
                        <div className="text-red-600">❌ Error: {functionTestResult.error}</div>
                      )}
                      {functionTestResult.success && (
                        <>
                          <div>📝 Results found: {functionTestResult.count}</div>
                          <div>⏱️ Execution time: {functionTestResult.executionTime}ms</div>
                          <div>📋 Data returned: {functionTestResult.data?.length || 0} records</div>
                        </>
                      )}
                    </div>
                  </div>
                  
                  {functionTestResult.allFieldNames && (
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <h4 className="font-medium text-blue-800 mb-2">🔍 Detected Field Names in Collection:</h4>
                      <div className="flex flex-wrap gap-2">
                        {functionTestResult.allFieldNames.map((field: string) => (
                          <Badge 
                            key={field} 
                            variant={field.toLowerCase().includes('rp') || field.toLowerCase().includes('tilaus') || field.toLowerCase().includes('order') ? 'default' : 'secondary'}
                          >
                            {field}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {functionTestResult.sampleRecord && (
                    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <h4 className="font-medium text-yellow-800 mb-2">📄 Sample Record Structure:</h4>
                      <pre className="text-xs overflow-x-auto">
                        {JSON.stringify(functionTestResult.sampleRecord, null, 2)}
                      </pre>
                    </div>
                  )}
                  
                  {functionTestResult.data && functionTestResult.data.length > 0 && (
                    <div className="overflow-x-auto">
                      <h4 className="font-medium mb-2">📊 Found Records:</h4>
                      <table className="w-full text-sm border-collapse border border-gray-300">
                        <thead>
                          <tr className="bg-gray-100">
                            <th className="border border-gray-300 px-3 py-2 text-left">Order Number</th>
                            <th className="border border-gray-300 px-3 py-2 text-left">Customer</th>
                            <th className="border border-gray-300 px-3 py-2 text-left">Product</th>
                            <th className="border border-gray-300 px-3 py-2 text-left">Other Fields</th>
                          </tr>
                        </thead>
                        <tbody>
                          {functionTestResult.data.map((record: any, index: number) => {
                            const orderNumber = 
                              record['OrderNumber'] || 
                              record['RP-tunnus'] || 
                              record['RP-tunnus (tilausnumero)'] || 
                              record['Tilausnumero'] ||
                              record['tilausnumero'] ||
                              record['Tilaustunnus'] ||
                              '-';
                            const customer = 
                              record['Asiakas'] || 
                              record['Customer'] || 
                              record['asiakas'] || 
                              record['Asiakasnimi'] ||
                              record['asiakasnimi'] ||
                              '-';
                            const product = 
                              record['Tuote'] || 
                              record['Product'] || 
                              record['tuote'] || 
                              record['Tuotenimi'] ||
                              record['tuotenimi'] ||
                              '-';
                              
                            // Get all other fields
                            const otherFields = Object.entries(record)
                              .filter(([key]) => !['id', 'OrderNumber', 'RP-tunnus', 'RP-tunnus (tilausnumero)', 
                                                   'Tilausnumero', 'tilausnumero', 'Tilaustunnus',
                                                   'Asiakas', 'Customer', 'asiakas', 'Asiakasnimi', 'asiakasnimi',
                                                   'Tuote', 'Product', 'tuote', 'Tuotenimi', 'tuotenimi'].includes(key))
                              .slice(0, 3) // Show max 3 other fields
                              .map(([key, value]) => `${key}: ${value}`)
                              .join(' | ');
                              
                            return (
                              <tr key={record.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                <td className="border border-gray-300 px-3 py-2">
                                  {orderNumber}
                                </td>
                                <td className="border border-gray-300 px-3 py-2">
                                  {customer}
                                </td>
                                <td className="border border-gray-300 px-3 py-2">
                                  {product}
                                </td>
                                <td className="border border-gray-300 px-3 py-2 text-xs">
                                  {otherFields || '-'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                  
                  <div className="p-4 bg-gray-100 rounded-lg">
                    <h4 className="font-medium mb-2">🔍 Console Log:</h4>
                    <p className="text-xs text-gray-600">
                      Avaa selaimen Developer Console (F12) nähdäksesi yksityiskohtaiset debug-lokit
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};