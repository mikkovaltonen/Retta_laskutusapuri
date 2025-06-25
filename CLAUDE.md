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
- **Invoice generation**: AI-powered sales invoice creation from purchase invoices
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
- **`myyntilaskut`** - Generated sales invoices with line items and totals
- **`knowledge`** - User-uploaded markdown documents for context

## AI Functions Available

The chatbot has access to the following Gemini AI functions:

### 1. searchHinnasto
**Description**: Search price list data by product code, product name, or price range

**Parameters**:
- `tuotetunnus` (string) - Product code to search for
- `tuote` (string) - Product name or partial name to search for
- `minMyyntihinta` (number) - Minimum sales price
- `maxMyyntihinta` (number) - Maximum sales price
- `minOstohinta` (number) - Minimum purchase price
- `maxOstohinta` (number) - Maximum purchase price
- `limit` (number) - Maximum results to return (default 10)

**Usage**: "Mikä on tuotteen 27A1008 hinta?" or "Näytä kaikki tuotteet alle 100€"

### 2. searchTilaus
**Description**: Search order data by any field

**Parameters**:
- `searchField` (string) - Field name to search in
- `searchValue` (string) - Value to search for
- `limit` (number) - Maximum results to return (default 10)

**Usage**: "Hae tilaukset asiakkaalta X" or "Näytä tilaukset tammikuulta"

### 3. searchOstolasku
**Description**: Search uploaded purchase invoice data (when JSON file is loaded)

**Parameters**:
- `searchField` (string) - Field name to search in
- `searchValue` (string) - Value to search for
- `tuotekoodi` (string) - Filter by product code
- `asiakasnumero` (string) - Filter by customer number
- `minAmount` (number) - Minimum price filter
- `maxAmount` (number) - Maximum price filter
- `limit` (number) - Maximum results to return (default 10)

**Usage**: "Näytä kaikki ostolaskurivit" or "Hae tuotekoodi 2078"

### 4. createLasku
**Description**: Create and save new sales invoice to the myyntilaskut collection

**Parameters**:
- `laskurivit` (array) - Array of invoice line items with required fields:
  - `asiakasnumero` (string, required) - Customer number
  - `tuotekoodi` (string, required) - Product code
  - `määrä` (number, required) - Quantity
  - `ahinta` (number, required) - Unit price
  - `kuvaus` (string, required) - Description
  - `tuotenimi` (string, required) - Product name
  - `selvitys` (string, auto-generated) - Detailed billing justification and pricing logic explanation
  - `tilattuTuote` (string, optional) - Ordered product name from order data
  - `reskontra` (string, optional) - Account type (default: MK)
  - `yksikkö` (string, optional) - Unit (default: kpl)
  - `alvkoodi` (string, optional) - VAT code
  - `Tilausnumero` (string, optional) - Order number
- `laskuotsikko` (string, optional) - Invoice title/description

**Usage**: "Luo lasku asiakkaalle 11111 tuotteesta 2078" or "Tee myyntilasku ostolaskun perusteella"

## Function Integration

### Data Flow
1. **Upload Phase**: Users upload Excel files containing hinnasto and tilaus data via Admin page
2. **Storage**: Data is parsed and stored in respective Firestore collections
3. **Query Phase**: AI chatbot uses functions to search stored data
4. **Analysis**: AI provides insights, calculations, and recommendations
5. **Invoice Creation**: AI can generate sales invoices based on analysis

### Response Format
All functions return results in table format using Markdown syntax:
- **Hinnasto**: Tuotetunnus | Tuote | Myyntihinta (€) | Ostohinta (€)
- **Tilaus**: Dynamic columns based on data structure
- **Ostolasku**: Asiakasnumero | Tuotekoodi | Tuotenimi | Määrä | Hinta (€) | Kuvaus
- **Created Invoice**: Returns invoice ID, line count, and total amount

## UI Components and Configuration

### Chatbot Welcome Message
**Location**: `/src/components/ChatAI.tsx` (lines 194-200)

**Purpose**: The initial greeting message that appears when users start a new chat session

**Current Message**:
```
👋 Hei! Olen Retta-laskutusavustajasi. Voin auttaa sinua ostolaskujen edelleenlaskutuksessa ja laskutustyökaluissa. Kysy minulta esimerkiksi:

• "Luo myyntilasku ostolaskun pohjalta"
• "Mikä on tuotteen 2078 myyntihinta?"
• "Hae asiakkaan 11111 ostolaskut"
• "Tarkista tuotteiden saatavuus hinnastossa"
• "Näytä kaikki myyntilaskut"

Voit myös ladata ostolaskuja JSON-muodossa ja pyytää minua luomaan niiden pohjalta kannattavia myyntilaskuja!

Miten voin auttaa?
```

**Technical Implementation**:
- Defined in the `initializeChat()` function
- Created as a `ChatMessage` object with `id: 'welcome'` and `role: 'assistant'`
- Automatically added to the chat when a new session is initialized
- Uses line breaks (`\n`) for proper formatting in the chat interface

**Key Features Highlighted**:
1. **Core Functionality**: Purchase invoice re-billing ("ostolaskujen edelleenlaskutus")
2. **Main Use Case**: "Luo myyntilasku ostolaskun pohjalta" (Create sales invoice from purchase invoice)
3. **Pricing Queries**: Product price lookups from price list
4. **Data Search**: Customer and invoice searches
5. **Pricing**: Product price lookups and comparisons
6. **Results Tracking**: View created sales invoices
7. **File Upload**: JSON upload functionality for purchase invoices

**When to Update**:
- When adding new AI functions
- When changing core application functionality
- When adding new example use cases
- When updating application branding or terminology

**Related Files**:
- System prompt configuration is managed through Admin panel or default prompt in same file (lines 54-108)
- Chat initialization logic in same file (lines 116-172)