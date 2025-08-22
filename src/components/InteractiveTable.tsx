import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface InteractiveTableProps {
  content: string;
}

export const InteractiveTable: React.FC<InteractiveTableProps> = ({ content }) => {
  const [currentPage, setCurrentPage] = React.useState(0);
  const columnsPerPage = 5; // Show 5 columns at a time on mobile, more on desktop
  
  // Parse markdown table
  const lines = content.split('\n').filter(line => line.trim() && line.includes('|'));
  
  if (lines.length < 2) {
    // Not a valid table
    return <pre className="text-xs overflow-x-auto">{content}</pre>;
  }
  
  // Extract headers and data
  const headerLine = lines[0];
  const dataLines = lines.filter((line, index) => 
    index > 0 && !line.includes('---') && line.trim() !== ''
  );
  
  // Parse headers
  const headers = headerLine
    .split('|')
    .map(h => h.trim())
    .filter(h => h);
    
  // Parse data rows
  const rows = dataLines.map(line => {
    const cells = line
      .split('|')
      .map(c => c.trim())
      .filter(c => c !== '');
    return cells;
  });
  
  if (headers.length === 0 || rows.length === 0) {
    return <pre className="text-xs overflow-x-auto">{content}</pre>;
  }
  
  // Calculate pagination
  const totalPages = Math.ceil(headers.length / columnsPerPage);
  const startCol = currentPage * columnsPerPage;
  const endCol = Math.min(startCol + columnsPerPage, headers.length);
  const visibleHeaders = headers.slice(startCol, endCol);
  
  return (
    <div className="my-4 bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
      {/* Navigation Bar */}
      <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">
            Taulukko ({rows.length} riviä, {headers.length} saraketta)
          </span>
        </div>
        
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
              disabled={currentPage === 0}
              className="p-1 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Edellinen"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            
            <span className="text-xs text-gray-600">
              {currentPage + 1} / {totalPages}
            </span>
            
            <button
              onClick={() => setCurrentPage(Math.min(totalPages - 1, currentPage + 1))}
              disabled={currentPage === totalPages - 1}
              className="p-1 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Seuraava"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
      
      {/* Table Container with Horizontal Scroll */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
              {visibleHeaders.map((header, index) => (
                <th
                  key={`${startCol + index}-${header}`}
                  className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider border-r border-blue-400 last:border-r-0"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {rows.map((row, rowIndex) => (
              <tr 
                key={rowIndex} 
                className="hover:bg-gray-50 transition-colors"
              >
                {visibleHeaders.map((_, colIndex) => {
                  const actualColIndex = startCol + colIndex;
                  const cellValue = row[actualColIndex] || '';
                  const isNumber = /^[\d,.\s€$%]+$/.test(cellValue);
                  
                  // Special styling for status columns
                  const isStatus = headers[actualColIndex]?.toLowerCase().includes('täsmää') ||
                                  headers[actualColIndex]?.toLowerCase().includes('status');
                  
                  let statusClass = '';
                  if (isStatus) {
                    if (cellValue.toLowerCase().includes('ok') || 
                        cellValue.toLowerCase().includes('täsmää')) {
                      statusClass = 'text-green-600 font-medium';
                    } else if (cellValue.toLowerCase().includes('ei') || 
                               cellValue.toLowerCase().includes('virhe')) {
                      statusClass = 'text-red-600 font-medium';
                    } else if (cellValue.includes('⛔')) {
                      statusClass = 'text-red-600 font-bold';
                    }
                  }
                  
                  return (
                    <td
                      key={`${rowIndex}-${actualColIndex}`}
                      className={`px-3 py-2 text-xs border-r border-gray-200 last:border-r-0 ${
                        isNumber ? 'text-right font-mono' : 'text-left'
                      } ${statusClass}`}
                    >
                      {cellValue}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Mobile swipe hint */}
      {totalPages > 1 && (
        <div className="bg-gray-50 px-4 py-2 border-t border-gray-200">
          <p className="text-xs text-gray-500 text-center">
            💡 Käytä nuolia selataksesi sarakkeita
          </p>
        </div>
      )}
    </div>
  );
};