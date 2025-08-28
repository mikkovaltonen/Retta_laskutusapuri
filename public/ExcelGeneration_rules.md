# MyyntiExcel Generation - Functional Specification

## Overview
The MyyntiExcel button is a key feature in the Retta Invoicing Assistant that converts verified pricing data from the TARKASTUSTAULUKKO (Verification Table) into an Excel file format compatible with the Housewise billing system.


## Functional Requirements


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

## Future Functionality Requirements

### 1. TarkastusExcel Tab Generation
**Requirement**: Generate an additional "TarkastusExcel" worksheet containing the same data as TARKASTUSTAULUKKO

**Implementation Details**:
- Add a second worksheet to the Excel file named "TarkastusExcel"
- Include all 13 columns from TARKASTUSTAULUKKO with original headers
- Preserve verification notes and comparison data (O.hinta, M.hinta variants)
- Maintain original formatting and column widths

**Structure**:
| Column | Header | Content |
|--------|--------|---------|
| A | Tampuuri | Customer property ID |
| B | RP-numero | Order number |
| C | Tuote | Product description |
| D | O.hinta (o) | Purchase price from invoice |
| E | O.hinta (h) | Purchase price from price list |
| F | M.hinta (o) | Sales price from invoice |
| G | M.hinta (h) | Sales price from price list |
| H | M.hinta (t) | Sales price from order |
| I | Tarkastus | Verification notes |
| J | A-hinta | Final approved price |
| K | Määrä | Quantity |
| L | Yksikkö | Unit |
| M | ALV-koodi | VAT code |

### 2. Property Manager-Specific Structures
**Requirement**: MyyntiExcel structure must vary based on property manager type

**Three Structure Types**:
1. **Subsidiary Structure** (Tytäryhtiö): For Kontu and Onni
2. **Retta Management Structure**: For Retta Management properties  
3. **HOAS Structure**: For HOAS properties

**Missing Input Needed**:
- Property manager identification field in OstolaskuExcel or separate configuration
- Detailed column specifications for each structure type
- Field mapping rules for each property manager type
- Business rules for determining which structure to use

### 3. Subsidiary Invoice Splitting
**Requirement**: For subsidiary property managers (Kontu and Onni), split one month's OstolaskuExcel into four separate files

**Output Files**:
1. **Kontu MyyntiExcel** - For centralized billing to Kontu
2. **Onni MyyntiExcel** - For centralized billing to Onni
3. **Kontu LaskuerittelyExcel** - Detailed invoice breakdown for Kontu
4. **Onni LaskuerittelyExcel** - Detailed invoice breakdown for Onni

**Missing Input Needed**:
- Property-to-subsidiary mapping (which properties belong to Kontu vs Onni)
- LaskuerittelyExcel format specification
- Splitting logic (how to separate items between subsidiaries)
- Centralized vs detailed invoice field differences

## Missing Inputs Summary

### Critical Missing Data
1. **Property Manager Identification**
   - Field name in source data to identify property manager
   - List of property managers and their types
   - Mapping of Tampuuri codes to property managers

2. **Structure Specifications**
   - Detailed column layouts for each of the three structures
   - Required vs optional fields per structure
   - Validation rules specific to each structure

3. **Subsidiary Configuration**
   - Complete list of Kontu properties (Tampuuri codes)
   - Complete list of Onni properties (Tampuuri codes)
   - Rules for handling properties not belonging to either

4. **LaskuerittelyExcel Format**
   - Column structure for detailed invoices
   - Difference between MyyntiExcel and LaskuerittelyExcel
   - Aggregation rules for centralized billing

5. **Business Rules**
   - How to handle mixed property manager invoices
   - Default structure when property manager cannot be determined
   - Error handling for ambiguous cases

### Proposed Solution Architecture

```javascript
// Configuration object needed
const propertyManagerConfig = {
  structures: {
    subsidiary: {
      kontu: {
        properties: [], // List of Tampuuri codes
        myyntiColumns: [], // Column specification
        erittelyColumns: [] // Detailed invoice columns
      },
      onni: {
        properties: [], // List of Tampuuri codes
        myyntiColumns: [], // Column specification
        erittelyColumns: [] // Detailed invoice columns
      }
    },
    rettaManagement: {
      properties: [], // List of Tampuuri codes
      columns: [] // Column specification
    },
    hoas: {
      properties: [], // List of Tampuuri codes
      columns: [] // Column specification
    }
  }
};

// Function to determine structure
function determineStructure(tampuuri) {
  // Logic to identify which structure to use
  // Returns: 'kontu', 'onni', 'rettaManagement', 'hoas'
}

// Function to generate appropriate files
function generateFiles(tarkastusData) {
  const filesByManager = groupByPropertyManager(tarkastusData);
  const outputFiles = [];
  
  for (const [manager, data] of Object.entries(filesByManager)) {
    switch(manager) {
      case 'kontu':
      case 'onni':
        outputFiles.push(generateMyyntiExcel(data, manager));
        outputFiles.push(generateLaskuerittelyExcel(data, manager));
        break;
      default:
        outputFiles.push(generateMyyntiExcel(data, manager));
    }
  }
  
  return outputFiles;
}
```

### Implementation Phases

**Phase 1**: Basic TarkastusExcel tab addition
- Add second worksheet with verification data
- No structural changes to MyyntiExcel

**Phase 2**: Property manager identification
- Add configuration for property manager mapping
- Implement structure detection logic

**Phase 3**: Multiple structure support
- Implement three different column structures
- Add structure-specific validation

**Phase 4**: Subsidiary splitting
- Implement four-file generation for subsidiaries
- Add LaskuerittelyExcel format

### Testing Requirements

1. **Unit Tests**
   - Property manager detection accuracy
   - Structure selection logic
   - File splitting for subsidiaries

2. **Integration Tests**
   - Multi-file generation
   - Cross-structure compatibility
   - Data consistency across splits

3. **Acceptance Criteria**
   - All property managers correctly identified
   - Appropriate structure applied for each
   - Subsidiary invoices properly split
   - TarkastusExcel matches original table

*Last Updated: 2025-08-28*
*Version: 1.1*
*Author: Retta Development Team*