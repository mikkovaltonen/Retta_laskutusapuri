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

interface HinnastoSearchCriteria {
  tuotetunnus?: string;
  tuote?: string;
  minMyyntihinta?: number;
  maxMyyntihinta?: number;
  minOstohinta?: number;
  maxOstohinta?: number;
}

interface HinnastoRecord {
  id: string;
  Tuotetunnus?: string;
  Tuote?: string;
  Myyntihinta?: number;
  Ostohinta?: number;
  [key: string]: unknown;
}

interface HinnastoSearchResult {
  records: HinnastoRecord[];
  totalFound: number;
  executionTime: number;
  searchCriteria: HinnastoSearchCriteria;
}

export const HinnastoApiTester: React.FC = () => {
  const [searchCriteria, setSearchCriteria] = useState<HinnastoSearchCriteria>({});
  const [searchResult, setSearchResult] = useState<HinnastoSearchResult | null>(null);
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
      // Build Firestore query
      let q = query(
        collection(db, 'hinnasto'),
        where('userId', '==', user.uid)
      );

      // Add search filters
      if (searchCriteria.tuotetunnus) {
        q = query(q, where('Tuotetunnus', '>=', searchCriteria.tuotetunnus));
        q = query(q, where('Tuotetunnus', '<=', searchCriteria.tuotetunnus + '\uf8ff'));
      }

      // Add limit to prevent large queries
      q = query(q, limit(100));

      const querySnapshot = await getDocs(q);
      let records: HinnastoRecord[] = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as HinnastoRecord[];

      // Apply client-side filtering for complex criteria
      if (searchCriteria.tuote) {
        records = records.filter(record => 
          record.Tuote?.toString().toLowerCase().includes(searchCriteria.tuote!.toLowerCase())
        );
      }

      if (searchCriteria.minMyyntihinta !== undefined) {
        records = records.filter(record => {
          const price = Number(record.Myyntihinta);
          return !isNaN(price) && price >= searchCriteria.minMyyntihinta!;
        });
      }

      if (searchCriteria.maxMyyntihinta !== undefined) {
        records = records.filter(record => {
          const price = Number(record.Myyntihinta);
          return !isNaN(price) && price <= searchCriteria.maxMyyntihinta!;
        });
      }

      if (searchCriteria.minOstohinta !== undefined) {
        records = records.filter(record => {
          const price = Number(record.Ostohinta);
          return !isNaN(price) && price >= searchCriteria.minOstohinta!;
        });
      }

      if (searchCriteria.maxOstohinta !== undefined) {
        records = records.filter(record => {
          const price = Number(record.Ostohinta);
          return !isNaN(price) && price <= searchCriteria.maxOstohinta!;
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
      const q = query(
        collection(db, 'hinnasto'),
        where('userId', '==', user.uid),
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
            Hinnasto API Testaus
          </CardTitle>
          <CardDescription>
            Testaa hinnasto-datan hakutoiminnallisuutta eri hakukriteereillä
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

          {/* Search Form */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tuotetunnus">Tuotetunnus</Label>
              <Input
                id="tuotetunnus"
                placeholder="esim. 27A1008"
                value={searchCriteria.tuotetunnus || ''}
                onChange={(e) => handleInputChange('tuotetunnus', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tuote">Tuote (sisältää)</Label>
              <Input
                id="tuote"
                placeholder="esim. Vuosihuolto"
                value={searchCriteria.tuote || ''}
                onChange={(e) => handleInputChange('tuote', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="minMyyntihinta">Min Myyntihinta</Label>
              <Input
                id="minMyyntihinta"
                type="number"
                placeholder="esim. 100"
                value={searchCriteria.minMyyntihinta || ''}
                onChange={(e) => handleInputChange('minMyyntihinta', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxMyyntihinta">Max Myyntihinta</Label>
              <Input
                id="maxMyyntihinta"
                type="number"
                placeholder="esim. 500"
                value={searchCriteria.maxMyyntihinta || ''}
                onChange={(e) => handleInputChange('maxMyyntihinta', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="minOstohinta">Min Ostohinta</Label>
              <Input
                id="minOstohinta"
                type="number"
                placeholder="esim. 50"
                value={searchCriteria.minOstohinta || ''}
                onChange={(e) => handleInputChange('minOstohinta', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxOstohinta">Max Ostohinta</Label>
              <Input
                id="maxOstohinta"
                type="number"
                placeholder="esim. 300"
                value={searchCriteria.maxOstohinta || ''}
                onChange={(e) => handleInputChange('maxOstohinta', e.target.value)}
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSearch} disabled={loading || !user}>
              <Search className="w-4 h-4 mr-2" />
              {loading ? 'Searching...' : 'Hae Hinnastosta'}
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
                      <th className="border border-gray-300 px-3 py-2 text-left">Tuotetunnus</th>
                      <th className="border border-gray-300 px-3 py-2 text-left">Tuote</th>
                      <th className="border border-gray-300 px-3 py-2 text-right">Myyntihinta</th>
                      <th className="border border-gray-300 px-3 py-2 text-right">Ostohinta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {searchResult.records.map((record, index) => (
                      <tr key={record.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="border border-gray-300 px-3 py-2">
                          {record.Tuotetunnus || '-'}
                        </td>
                        <td className="border border-gray-300 px-3 py-2">
                          {record.Tuote || '-'}
                        </td>
                        <td className="border border-gray-300 px-3 py-2 text-right">
                          {record.Myyntihinta ? `${record.Myyntihinta} €` : '-'}
                        </td>
                        <td className="border border-gray-300 px-3 py-2 text-right">
                          {record.Ostohinta ? `${record.Ostohinta} €` : '-'}
                        </td>
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