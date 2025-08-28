# MyyntiExcel Generation - Functional Specification

## Overview
The MyyntiExcel button is a key feature in the Retta Invoicing Assistant that converts verified pricing data from the TARKASTUSTAULUKKO (Verification Table) into an Excel file format compatible with the Housewise billing system.

## Purpose
Transform AI-verified pricing data from purchase invoices (OstolaskuExcel) into sales invoices (MyyntiExcel) that can be directly imported into the Housewise property management billing system.

## User Interface

### Button Location
- **Position**: Main chat interface toolbar
- **Label**: "MyyntiExcel" 
- **Icon**: Download icon (↓)
- **Tooltip**: "Lataa MyyntiExcel TARKASTUSTAULUKOSTA" (Download MyyntiExcel from VERIFICATION TABLE)
- **State**: Enabled when chat history contains TARKASTUSTAULUKKO data

### Visual Design
```html
<Button variant="outline" title="Download MyyntiExcel from VERIFICATION TABLE">
  <Download className="w-4 h-4 mr-1" />
  MyyntiExcel
</Button>
```

## Functional Requirements

### 1. Data Source Detection
The function scans the entire chat history to locate TARKASTUSTAULUKKO tables:
- **Search Pattern**: Case-insensitive search for "tarkastustaulukko"
- **Source**: Assistant messages only (role === 'assistant')
- **Processing**: Extracts the first valid table found

### 2. Table Structure Recognition

#### Expected TARKASTUSTAULUKKO Format
| Column | Field Name | Description | Maps To |
|--------|------------|-------------|---------|
| 1 | Tampuuri | Customer property ID | asiakasnumero |
| 2 | RP-numero | Order number | tilausnumero |
| 3 | Tuote | Product description (max 80 chars) | kuvaus |
| 4 | O.hinta (o) | Purchase price from invoice | - |
| 5 | O.hinta (h) | Purchase price from price list | - |
| 6 | M.hinta (o) | Sales price from invoice | - |
| 7 | M.hinta (h) | Sales price from price list | - |
| 8 | M.hinta (t) | Sales price from order | - |
| 9 | Tarkastus | Verification notes | - |
| 10 | A-hinta | Final approved price | ahinta |
| 11 | Määrä | Quantity | määrä |
| 12 | Yksikkö | Unit of measure | yksikkö |
| 13 | ALV-koodi | VAT code | alvkoodi |

### 3. Data Transformation Rules

#### Field Mapping
```javascript
{
  asiakasnumero: tampuuri,        // Column 1: Customer ID
  reskontra: 'MK',                // Fixed value
  tuotekoodi: '',                 // Always empty
  määrä: määrä,                   // Column 11: Quantity
  ahinta: a_hinta,                // Column 10: Unit price
  yhteensä: määrä * a_hinta,     // Calculated: total
  kuvaus: tuote,                  // Column 3: Product description
  yksikkö: yksikkö,              // Column 12: Unit
  tuotenimi: '',                  // Always empty
  alvkoodi: alvkoodi,            // Column 13: VAT code (without %)
  isännöitsijä: '',              // Always empty
  kustannuspaikka: '',           // Always empty
  tilausnumero: rp_numero        // Column 2: Order number
}
```

#### Data Validation Rules
1. **Tampuuri (Customer ID)**: Required, non-empty
2. **A-hinta (Price)**: Must be > 0
3. **Määrä (Quantity)**: Default to 1 if missing or invalid
4. **Yksikkö (Unit)**: Default to 'kpl' if missing
5. **ALV-koodi (VAT)**: Default to '24' if missing, remove % sign
6. **RP-numero**: Replace "---" patterns with empty string

### 4. Row Processing Logic

#### Skip Conditions
Rows are skipped if:
- No Tampuuri (customer ID) present
- A-hinta (price) is 0 or invalid
- Row contains separator lines (|:---)
- Insufficient columns in the row

#### Processing Steps
1. Split table line by pipe (|) delimiter
2. Trim whitespace from each cell
3. Validate minimum column count
4. Parse numeric values (handle comma as decimal)
5. Apply validation rules
6. Transform to output format

### 5. Excel Generation

#### Output Format
- **File Type**: .xlsx (Excel 2007+)
- **Sheet Name**: "MyyntiExcel"
- **Encoding**: UTF-8
- **Filename Pattern**: `MyyntiExcel_YYYY-MM-DD_HH-MM-SS.xlsx`

#### Column Structure
| Column | Header | Type | Format |
|--------|--------|------|--------|
| A | Asiakasnumero | Text | String |
| B | Reskontra | Text | "MK" |
| C | Tuotekoodi | Text | Empty |
| D | Määrä | Number | Decimal |
| E | A-hinta | Number | Currency (€) |
| F | Yhteensä | Number | Currency (€) |
| G | Kuvaus | Text | String (max 80 chars) |
| H | Yksikkö | Text | String |
| I | Tuotenimi | Text | Empty |
| J | ALV-koodi | Text | Number as string |
| K | Isännöitsijä | Text | Empty |
| L | Kustannuspaikka | Text | Empty |
| M | Tilausnumero | Text | String |

### 6. File Download Mechanism

#### Modern Browsers (Chrome, Edge)
Uses File System Access API:
```javascript
window.showSaveFilePicker({
  suggestedName: filename,
  types: [{
    description: 'Excel Files',
    accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] }
  }]
})
```

#### Fallback Method
For browsers without File System Access API:
- Uses XLSX.writeFile() for direct download
- Files saved to default Downloads folder

### 7. User Feedback

#### Success Messages
- **With Save Dialog**: "MyyntiExcel tallennettu: [X] riviä" (Saved: X rows)
- **Direct Download**: "MyyntiExcel ladattu: [X] riviä" (Downloaded: X rows)
- **Fallback**: "MyyntiExcel ladattu Downloads-kansioon: [X] riviä"

#### Error Messages
- **No Data**: "TARKASTUSTAULUKKOA ei löytynyt keskusteluhistoriasta"
- **Processing Error**: Console error with details

### 8. Logging and Debugging

#### Console Output
```javascript
console.log('🔍 Scanning chat history for TARKASTUSTAULUKKO...');
console.log('✅ Found TARKASTUSTAULUKKO in message:', messageId);
console.log('📊 Found X table lines');
console.log('📊 Processing summary: X processed, Y skipped');
console.log('✅ MyyntiExcel saved: filename');
```

## Technical Implementation

### Dependencies
- **XLSX Library**: SheetJS for Excel file generation
- **React**: For UI components
- **Toast**: For user notifications

### Key Functions
```typescript
generateMyyntiExcelFromTarkastustaulukko(): Promise<void>
- Scans chat history
- Extracts table data
- Transforms to Excel format
- Handles file download

parseTableRow(line: string): RowData | null
- Parses individual table rows
- Validates data
- Returns structured data or null

createExcelWorkbook(data: RowData[]): Workbook
- Creates Excel workbook
- Formats data
- Sets column headers
```

## Business Rules

### Price Determination Hierarchy
1. **Order Price (RP-numero)**: If order exists, use order pricing
2. **Price List Match**: If product and buy price match, use sale price
3. **Invoice Price**: Use "Retta asiakashinta" if available
4. **Margin Calculation**: Apply supplier margin table
5. **Manual Review**: Flag for manual verification if no match

### VAT Code Determination
- **Default**: 24% (general rate in Finland)
- **Special Cases**: 
  - 14% (reduced rate)
  - 10% (reduced rate) 
  - 0% (zero rate)
- **Detection**: Compare SalePrice vs SalePriceVat to determine rate

### Customer Validation
- Skip rows where customer name contains "POISTA" (deleted/moved customers)
- Validate RP-numbers against order system
- Flag mismatches for manual review

## Integration Points

### Input Sources
1. **OstolaskuExcel**: Original purchase invoice data
2. **Hinnasto**: Price list database
3. **Tilaus**: Order management system
4. **AI Verification**: TARKASTUSTAULUKKO from chat

### Output Destination
- **Housewise System**: Property management billing platform
- **Manual Import**: User uploads generated Excel to Housewise

## Error Handling

### Data Errors
- Missing required fields → Skip row, log warning
- Invalid numeric values → Use defaults, flag for review
- Mismatched references → Include in summary report

### System Errors
- File generation failure → Show error toast, log details
- Download failure → Fallback to alternative method
- Browser compatibility → Graceful degradation

## Performance Considerations

### Limits
- **Max Rows**: No hard limit, tested up to 1000 rows
- **Processing Time**: < 2 seconds for typical 50-100 rows
- **File Size**: Typically < 100KB for standard invoices

### Optimization
- Process first table found (avoid duplicates)
- Stream processing for large datasets
- Minimal memory footprint

## Security Considerations

### Data Privacy
- No data sent to external servers
- Processing entirely client-side
- No persistent storage of generated files

### Validation
- Sanitize all input data
- Prevent formula injection in Excel
- Validate numeric ranges

## Future Enhancements

### Planned Features
1. **Batch Processing**: Handle multiple TARKASTUSTAULUKKO tables
2. **Template Support**: Customizable Excel templates
3. **Direct Integration**: API connection to Housewise
4. **Audit Trail**: Track all transformations
5. **Validation Report**: Detailed verification summary

### Potential Improvements
- Multi-language support
- Custom field mapping
- Advanced filtering options
- Historical data comparison
- Automated email delivery

## Testing Requirements

### Unit Tests
- Table parsing accuracy
- Data transformation logic
- Numeric calculations
- Edge cases handling

### Integration Tests
- Chat history scanning
- Excel file generation
- Download mechanisms
- Error scenarios

### User Acceptance Criteria
- Generated Excel imports successfully to Housewise
- All required fields populated correctly
- Calculations match manual verification
- File format compatible with target system

## Documentation References

### Related Documents
- `/public/invoicing_prompt.md` - AI pricing logic
- `/CLAUDE.md` - System overview
- `/src/components/ChatAI.tsx` - Implementation code

### External Systems
- Housewise API Documentation
- Finnish VAT regulations
- Property management standards

---

*Last Updated: 2025-08-28*
*Version: 1.0*
*Author: Retta Development Team*