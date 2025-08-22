import React from 'react';

interface VerificationTableRendererProps {
  content: string;
}

export const VerificationTableRenderer: React.FC<VerificationTableRendererProps> = ({ content }) => {
  // Parse the markdown table
  const lines = content.split('\n').filter(line => line.trim());
  const headerLine = lines.find(line => line.includes('| Tampuuri') && line.includes('| RP-numero'));
  
  if (!headerLine) {
    // Check if content is already a table string
    if (content.includes('| Tampuuri') && content.includes('| RP-numero')) {
      const tableLines = content.split('|').join('\n|').split('\n').filter(l => l.trim());
      return processTableContent(tableLines);
    }
    return null;
  }
  
  return processTableContent(lines);
};

function processTableContent(lines: string[]) {
  const headerLine = lines.find(line => line.includes('| Tampuuri') && line.includes('| RP-numero'));
  
  if (!headerLine) {
    return null;
  }
  
  const dataLines = lines.filter(line => 
    line.includes('|') && 
    !line.includes('---') && 
    line !== headerLine &&
    line.trim() !== ''
  );
  
  if (dataLines.length === 0) {
    return null;
  }
  
  return (
    <div className="space-y-3 my-4">
      {dataLines.map((line, idx) => {
        const cells = line.split('|').filter(c => c.trim());
        if (cells.length < 10) return null;
        
        // Parse values
        const tampuuri = cells[0].trim();
        const rpNumero = cells[1].trim();
        const kohde = cells[2].trim();
        const tuote = cells[3].trim();
        const ostohinta = cells[4].trim();
        const ostohintaHinnasto = cells[5].trim();
        const asiakashinta = cells[6].trim();
        const myyntihintaHinnasto = cells[7].trim();
        const myyntihintaTilaus = cells[8].trim();
        const status = cells[9].trim();
        
        // Check if prices match for status color or if customer has moved
        const isMatching = status.toLowerCase().includes('täsmää') || 
                          status.toLowerCase().includes('ok');
        const isCustomerMoved = status.toLowerCase().includes('asiakas siirtynyt') || 
                                status.toLowerCase().includes('ei laskuteta') ||
                                status.includes('⛔');
        
        return (
          <div key={idx} className={`border rounded-lg shadow-sm hover:shadow-md transition-all duration-200 ${
            isCustomerMoved 
              ? 'bg-red-50 border-red-300' 
              : 'bg-white border-gray-200'
          }`}>
            {/* Header Section */}
            <div className="bg-gradient-to-r from-gray-50 to-white px-4 py-3 border-b border-gray-100">
              <div className="flex flex-wrap gap-4 items-start">
                <div className="flex-1 min-w-[200px]">
                  <div className="text-xs text-gray-500 mb-1">Kohde</div>
                  <div className="font-medium text-gray-900">{kohde}</div>
                </div>
                <div className="flex gap-4">
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Tampuuri</div>
                    <div className="font-mono text-sm font-medium">{tampuuri}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">RP-numero</div>
                    <div className="font-mono text-sm">{rpNumero}</div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Product Section */}
            <div className="px-4 py-3 border-b border-gray-100">
              <div className="text-xs text-gray-500 mb-1">Tuote</div>
              <div className="text-sm text-gray-800">{tuote}</div>
            </div>
            
            {/* Prices Grid */}
            <div className="p-4">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                {/* Purchase Prices */}
                <div className="space-y-2">
                  <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Ostohinta</div>
                  <div className="bg-gray-50 rounded-md p-2 border border-gray-200">
                    <div className="font-semibold text-gray-900">{ostohinta}</div>
                    <div className="text-xs text-gray-500">Ostolasku</div>
                  </div>
                  <div className="bg-gray-50 rounded-md p-2 border border-gray-200">
                    <div className="font-semibold text-gray-900">{ostohintaHinnasto}</div>
                    <div className="text-xs text-gray-500">Hinnasto</div>
                  </div>
                </div>
                
                {/* Customer Price */}
                <div className="space-y-2">
                  <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Asiakashinta</div>
                  <div className="bg-blue-50 rounded-md p-2 border border-blue-200">
                    <div className="font-semibold text-blue-900">{asiakashinta}</div>
                    <div className="text-xs text-blue-600">Ostolasku</div>
                  </div>
                </div>
                
                {/* Sales Prices */}
                <div className="space-y-2">
                  <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Myyntihinta</div>
                  <div className="bg-green-50 rounded-md p-2 border border-green-200">
                    <div className="font-semibold text-green-900">{myyntihintaHinnasto}</div>
                    <div className="text-xs text-green-600">Hinnasto</div>
                  </div>
                  <div className="bg-green-50 rounded-md p-2 border border-green-200">
                    <div className="font-semibold text-green-900">{myyntihintaTilaus}</div>
                    <div className="text-xs text-green-600">Tilaus</div>
                  </div>
                </div>
                
                {/* Status */}
                <div className="col-span-2 lg:col-span-2">
                  <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Tarkastus</div>
                  <div className={`rounded-md p-3 border ${
                    isCustomerMoved
                      ? 'bg-red-50 border-red-300 text-red-800'
                      : isMatching 
                      ? 'bg-green-50 border-green-300 text-green-800' 
                      : 'bg-yellow-50 border-yellow-300 text-yellow-800'
                  }`}>
                    <div className="flex items-center gap-2">
                      {isCustomerMoved ? (
                        <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                        </svg>
                      ) : isMatching ? (
                        <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                      )}
                      <span className="text-sm font-medium">{status}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      }).filter(Boolean)}
    </div>
  );
}