# Claude Code Instructions

## Project Overview
This is a Retta Laskutusapuri (Invoicing Assistant) application built with React, TypeScript, and Vite. It provides AI-powered document analysis and invoicing intelligence capabilities with user authentication.

## Development Commands

### Testing & Quality Assurance
```bash
# Run TypeScript type checking
npx tsc --noEmit

# Run linting
npm run lint

# Run tests
npm test
npm run test:openai
```

### Development
```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Key Technologies
- **Frontend**: React 18, TypeScript, Vite
- **UI**: Tailwind CSS, shadcn/ui components
- **AI Integration**: Google Gemini
- **State Management**: React Hooks
- **Authentication**: Custom auth system
- **File Processing**: Support for PDF, Excel, CSV, Word documents for invoicing
- **Database**: Firebase Firestore for prompt versioning

## Project Structure
- `src/components/` - React components
- `src/lib/` - Utility functions and services
- `src/pages/` - Page components
- `src/types/` - TypeScript type definitions
- `src/hooks/` - Custom React hooks
- `api/` - API proxy functions
- `docs/` - Project documentation

## Important Notes
- The project uses environment variables for API keys (see .env.example)
- The application uses Google Gemini for AI document analysis focused on invoicing
- Authentication is required for most features
- Data processing includes invoice document upload and AI analysis
- System prompt versioning is stored in Firebase Firestore

## Known Issues
- Some TypeScript `any` types need to be properly typed
- ESLint warnings for React hooks dependencies
- Some UI components have empty interface types
- Firebase configuration is required for prompt versioning feature

## Development Guidelines
- Always run type checking before committing
- Fix ESLint errors before creating pull requests
- Follow the established component patterns
- Use proper TypeScript types instead of `any`
- Test AI integrations thoroughly
- Ensure Firebase configuration is properly set up for prompt versioning

## Document Analysis Features

### File Processing
- **Supported formats**: PDF, Excel (.xlsx, .xls), CSV, Word (.doc, .docx)
- **Upload methods**: Drag & drop or file picker
- **File validation**: Type and size checking
- **Preview capability**: For supported document types

### AI Analysis
- **Document intelligence**: Extract key information from invoice documents
- **Structured output**: Format data for easy consumption
- **Interactive chat**: Natural language questions about invoices and data
- **Function calling**: Automated database queries based on user questions
- **Invoice generation**: AI-powered MyyntiExcel creation from OstolaskuExcel
- **Data correlation**: Cross-reference between price lists, orders, and purchase invoices

### System Prompt Versioning
- **Version management**: Automatic versioning with sequential numbers
- **Evaluation tracking**: User notes and assessments for each version
- **History browsing**: View and compare all previous versions
- **Model selection**: Choose different AI models for testing

### Database Schema (Firebase)

#### System Prompt Versioning
- `version` - Sequential version number
- `systemPrompt` - The prompt text
- `evaluation` - User's assessment notes
- `savedDate` - Timestamp of creation
- `aiModel` - AI model used
- `userId` - User identifier

#### Data Collections
- **`hinnasto`** - Price list data with product codes, names, sales/purchase prices
- **`tilaus_data`** - Order data with customer information, order details
- **`myyntiExcel`** - Generated MyyntiExcel invoices with line items and totals
- **`knowledge`** - User-uploaded markdown documents for context

## AI Functions Available

The chatbot has access to the following Gemini AI functions:

### 1. searchHinnasto
**Description**: Search price list data by product name, price list name, or supplier (any combination)

**Parameters**:
- `productName` (string, optional) - Product name to search for (partial match supported)
- `priceListName` (string, optional) - Price list name to search for (partial match supported)
- `priceListSupplier` (string, optional) - Price list supplier to search for (partial match supported)
- `limit` (number) - Maximum results to return (default 10 for product search, 50 for price list search)

**Returns**: ProductNumber, ProductName, PriceListSupplier, PriceListName, BuyPrice, SalePrice, SalePriceVat

**Usage**: 
- "Mikä on Kuntotutkimus ja PTS hinta?" (uses productName)
- "Hae tuote pelastussuunnitelma" (uses productName)
- "Hae kaikki tuotteet Yleishinnasto 2024 listalta" (uses priceListName)
- "Näytä kaikki tuotteet toimittajalta Retta" (uses priceListSupplier)

**Note**: At least one search parameter must be provided. Searches can combine multiple parameters for more specific results.

### 2. searchTilaus
**Description**: Search order data by Tampuuri code OR RP-number

**Parameters**:
- `tampuuriCode` (string, optional) - Tampuuri code to search for (Code field - partial match supported)
- `orderNumber` (string, optional) - RP-number to search for (OrderNumber field - partial match supported)
- `limit` (number) - Maximum results to return (default 10)

**Returns**: OrderNumber, Code, Name, ProductName, SalePrice (without VAT), TotalSellPrice (with VAT, calculated), PriceListName

**Usage**: "Hae tilaus RP-0201251024330417" or "Hae tampuurinumero 12345" or "Näytä tilaus 567"

**Note**: Searches by either tampuuriCode (Code/Tampuurinumero fields) OR orderNumber (OrderNumber/RP-tunnus fields). At least one search parameter must be provided.

### 3. searchOstolaskuExcel
**Description**: Search uploaded OstolaskuExcel data (when JSON file is loaded)

**Parameters**:
- `searchField` (string) - Field name to search in
- `searchValue` (string) - Value to search for
- `tuotekoodi` (string) - Filter by product code
- `asiakasnumero` (string) - Filter by customer number
- `minAmount` (number) - Minimum price filter
- `maxAmount` (number) - Maximum price filter
- `limit` (number) - Maximum results to return (default 10)

**Usage**: "Näytä kaikki OstolaskuExcel-rivit" or "Hae tuotekoodi 2078"

### 4. createLasku
**Description**: Create and save new MyyntiExcel to the myyntiExcel collection

**Processing Logic**:
1. **Product Matching**: Uses product description (`tuotenimi`) to find matching `ProductName` in price list
2. **Price Validation**: Verifies purchase price matches price list `BuyPrice` 
3. **Sales Price**: Retrieves `SalePrice` from matched price list item
4. **Error Handling**: Fails if product not found or prices don't match

**CRITICAL Product Matching Instructions for AI**:

When creating invoices (createLasku), you MUST intelligently match products:

1. **First, search the hinnasto (price list) to find the correct product**
   - Use searchHinnasto to find products with matching prices
   - If the purchase price (ostohinta) matches a BuyPrice in hinnasto, that's likely the correct product

2. **When calling createLasku, use the EXACT ProductName from hinnasto**
   - Do NOT use the product name from ostolasku directly
   - Instead, find the matching product in hinnasto and use that ProductName
   - The system expects the exact ProductName as it appears in the price list

3. **Intelligent Matching Examples**:
   - OstolaskuExcel: "Retta Pelastussuunnitelman digitointi ja päivityspalvelu/KOy"
   - Hinnasto: "Pelastussuunnitelman digitointi ja päivityspalvelu. Asuinrakennukset"
   - **You should use**: "Pelastussuunnitelman digitointi ja päivityspalvelu. Asuinrakennukset"

4. **Matching Strategy**:
   - Ignore company prefixes like "Retta", suffixes like "/KOy", "/Oy"
   - Focus on the core service name
   - When BuyPrice matches the purchase price, trust that match
   - If multiple products could match, choose the one where BuyPrice validates

5. **In the createLasku call**:
   - `tuotenimi` field should contain the EXACT ProductName from hinnasto
   - This ensures the system can find and validate the product correctly

**Parameters**:
- `laskurivit` (array) - Array of invoice line items with required fields:
  - `asiakasnumero` (string, required) - Customer number  
  - `tuotenimi` (string, required) - Product name/description (used for ProductName matching)
  - `määrä` (number, required) - Quantity
  - `ahinta` (number, optional) - Purchase price for validation (matched against BuyPrice)
  - `kuvaus` (string, required) - Description
  - `tuotekoodi` (string, optional) - Product code (retrieved from price list if not provided)
  - `selvitys` (string, auto-generated) - Detailed billing justification and pricing logic explanation
  - `tilattuTuote` (string, optional) - Ordered product name from order data
  - `reskontra` (string, optional) - Account type (default: MK)
  - `yksikkö` (string, optional) - Unit (default: kpl)
  - `alvkoodi` (string, optional) - VAT code
  - `Tilausnumero` (string, optional) - Order number
- `laskuotsikko` (string, optional) - Invoice title/description

**Usage**: "Luo lasku asiakkaalle 11111 tuotteesta [tuotekuvaus]" or "Tee MyyntiExcel OstolaskuExcelin perusteella"

**Note**: The function automatically fetches the sales price from the price list based on product name matching

## Function Integration

### Data Flow
1. **Upload Phase**: Users upload Excel files containing hinnasto and tilaus data via Admin page
2. **Storage**: Data is parsed and stored in respective Firestore collections
3. **Query Phase**: AI chatbot uses functions to search stored data
4. **Analysis**: AI provides insights, calculations, and recommendations
5. **Invoice Creation**: AI can generate MyyntiExcel based on analysis

### Response Format
All functions return results in table format using Markdown syntax:
- **Hinnasto**: Tuotetunnus | Tuote | Hintalistan toimittaja | Hintalista | Ostohinta (€) | Myyntihinta (€) | Myyntihinta ALV (€)
- **Tilaus**: Dynamic columns based on data structure
- **OstolaskuExcel**: Asiakasnumero | Tuotekoodi | Tuotenimi | Määrä | Hinta (€) | Kuvaus
- **Created Invoice**: Returns invoice ID, line count, and total amount

## UI Components and Configuration

### Chatbot Welcome Message
**Location**: `/src/components/ChatAI.tsx` (lines 194-200)

**Purpose**: The initial greeting message that appears when users start a new chat session

**Current Message**:
```
👋 Hei! Olen Retta-laskutusavustajasi. Voin auttaa sinua ostolaskujen edelleenlaskutuksessa ja laskutustyökaluissa. Kysy minulta esimerkiksi:

• "Luo MyyntiExcel OstolaskuExcelin pohjalta"
• "Mikä on tuotteen 2078 myyntihinta?"
• "Hae asiakkaan 11111 OstolaskuExcel-tiedot"
• "Tarkista tuotteiden saatavuus hinnastossa"
• "Näytä kaikki MyyntiExcel-tiedot"

Voit myös ladata OstolaskuExcel-tiedostoja JSON-muodossa ja pyytää minua luomaan niiden pohjalta kannattavia MyyntiExcel-tiedostoja!

Miten voin auttaa?
```

**Technical Implementation**:
- Defined in the `initializeChat()` function
- Created as a `ChatMessage` object with `id: 'welcome'` and `role: 'assistant'`
- Automatically added to the chat when a new session is initialized
- Uses line breaks (`\n`) for proper formatting in the chat interface

**Key Features Highlighted**:
1. **Core Functionality**: OstolaskuExcel re-billing ("OstolaskuExcel edelleenlaskutus")
2. **Main Use Case**: "Luo MyyntiExcel OstolaskuExcelin pohjalta" (Create MyyntiExcel from OstolaskuExcel)
3. **Pricing Queries**: Product price lookups from price list
4. **Data Search**: Customer and invoice searches
5. **Pricing**: Product price lookups and comparisons
6. **Results Tracking**: View created MyyntiExcel
7. **File Upload**: JSON upload functionality for OstolaskuExcel invoices

**When to Update**:
- When adding new AI functions
- When changing core application functionality
- When adding new example use cases
- When updating application branding or terminology

**Related Files**:
- System prompt configuration is managed through Admin panel ONLY (stored in Firestore)
- No default prompt - error shown if prompt is missing
- Chat initialization logic in same file