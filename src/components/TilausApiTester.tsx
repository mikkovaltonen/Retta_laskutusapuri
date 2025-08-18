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
import { Search, Database, Clock, FileText, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';

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
      // Build Firestore query - Query ALL tilaus records (shared data)
      const q = query(
        collection(db, 'tilaus_data'),
        limit(100) // Prevent large queries
      );

      const querySnapshot = await getDocs(q);
      let records: TilausRecord[] = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as TilausRecord[];

      // Apply client-side filtering for all search criteria
      Object.entries(searchCriteria).forEach(([field, value]) => {
        if (value !== undefined && value !== '') {
          records = records.filter(record => {
            const recordValue = record[field];
            
            if (recordValue === undefined || recordValue === null) {
              return false;
            }
            
            const recordStr = String(recordValue).toLowerCase();
            const searchStr = String(value).toLowerCase();
            
            // For numbers, try exact match first, then partial match
            if (!isNaN(Number(value)) && !isNaN(Number(recordValue))) {
              return Number(recordValue) === Number(value) || recordStr.includes(searchStr);
            }
            
            // For strings, partial match
            return recordStr.includes(searchStr);
          });
        }
      });

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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            Tilaus API Testaus
          </CardTitle>
          <CardDescription>
            Testaa tilaus-datan hakutoiminnallisuutta eri hakukriteereillä
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

          {/* Dynamic Search Form based on available fields */}
          {availableFields.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {availableFields.slice(0, 9).map(field => ( // Show max 9 fields
                <div key={field} className="space-y-2">
                  <Label htmlFor={field}>{field}</Label>
                  <Input
                    id={field}
                    placeholder={`Hae ${field}...`}
                    value={searchCriteria[field] || ''}
                    onChange={(e) => handleInputChange(field, e.target.value)}
                  />
                </div>
              ))}
            </div>
          )}

          {availableFields.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <Database className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>Ei tilaus-dataa saatavilla</p>
              <p className="text-sm">Lataa ensin tilaus-data Admin-sivun kautta</p>
            </div>
          )}

          <div className="flex gap-2">
            <Button onClick={handleSearch} disabled={loading || !user || availableFields.length === 0}>
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
    </div>
  );
};