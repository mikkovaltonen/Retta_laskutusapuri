# Retta Laskutusapuri - AI-Powered Invoicing Assistant

Meet the Retta Laskutusapuri – tekoälyapurisi laskutuksen tehostamiseen. Älykkäät laskutusratkaisut automatisoituine prosesseineen ja analytiikoineen.

## Features

### 🏢 **Invoicing-Focused Architecture**
- **Retta Laskutus**: Intelligent billing automation and financial operations
- **Streamlined Interface**: Single-workspace focus on invoicing excellence

### 🤖 **AI-Powered Operations**
- **Document Intelligence**: Upload and analyze PDF, Excel, CSV, and Word documents  
- **Real-time ERP Integration**: Direct access to invoice data via function calling
- **Interactive Chat Interface**: Natural language conversation with invoicing AI assistant
- **Knowledge Base Integration**: Invoicing-specific internal policies and procedures

### 📊 **Data Management**
- **Secure Storage**: Data collections for invoicing documents and analysis
- **System Prompt Versioning**: Track and evaluate different AI configurations
- **Continuous Improvement Tracking**: Monitor AI performance and user feedback
- **Structured Data Export**: Download extracted data as CSV files

## Use Cases

### **Invoicing Operations**
- **Invoice Processing**: Automated analysis and categorization of sales invoices
- **Payment Tracking**: Monitor payment status and overdue invoices  
- **Financial Analytics**: Generate insights from billing data
- **Billing Process Optimization**: Streamline invoicing workflows
- **Document Intelligence**: Extract key information from invoice documents
- **Compliance Monitoring**: Ensure adherence to invoicing policies and procedures

## Technologies

- **Frontend**: React 18, TypeScript, Vite
- **UI**: Tailwind CSS, shadcn/ui components
- **AI Integration**: Google Gemini API with function calling
- **File Processing**: Support for PDF, Excel, CSV, Word documents
- **Database**: Firebase Firestore for prompt versioning and session management
- **State Management**: React Hooks
- **Authentication**: Firebase Auth with custom user management

## AI Configuration

### Gemini Model Settings
- **Model**: gemini-2.5-pro
- **Temperature**: 0.1 (optimized for accuracy and consistency in financial calculations)
- **Max Output Tokens**: 8192
- **Function Calling**: Enabled for data queries and invoice generation

The low temperature (0.1) ensures:
- Maximum accuracy in price calculations
- Consistent and repeatable results
- Minimal creativity/variation in financial data processing
- Reliable function calling behavior

**Why 0.1 Temperature for Invoicing:**
- Financial calculations require precision and consistency
- Same inputs should produce identical outputs for auditing
- Reduces AI "hallucinations" in numerical data
- Ensures predictable function calling patterns

## End-User Workflow Architecture

### 📊 Invoicing Data Processing Pipeline

```
┌─────────────────────────────────────────────────────────────────────┐
│                    LOPPUKÄYTTÄJÄN TYÖNKULKU                        │
└─────────────────────────────────────────────────────────────────────┘

     (1) OSTOLASKU LATAUS
     ┌─────────────────┐
     │ Excel Upload    │
     │ ─────────────── │
     │ • Koontilasku   │ ──→ storageService.uploadERPDocument()
     │ • Taloyhtiö-    │
     │   kohtainen     │
     └─────────────────┘
             ↓
     
     (2) TEKOÄLY ANALYYSI
     ┌──────────────────────────┐
     │ AI Tunnistus & Tarkistus │
     │ ───────────────────────  │
     │ • Tuotekuvaukset         │ ──→ Match by ProductName
     │ • Ostohinta validointi   │ ──→ BuyPrice verification
     │ • Myyntihinta haku       │ ──→ SalePrice from hinnasto
     │ • Tilaus tiedot          │ ──→ searchTilaus(Code)
     └──────────────────────────┘
             ↓
     ┌─────────────────┐
     │   AI RAPORTTI   │
     │ ─────────────── │
     │ ✓ Tuotteet OK?  │
     │ ✓ Hinnat OK?    │
     │ ✓ Tilaukset OK? │
     │ ⚠ Puutteet?     │
     └─────────────────┘
             ↓
             
     (3) KÄYTTÄJÄN HYVÄKSYNTÄ
     ┌─────────────────┐
     │ User Review     │
     │ ─────────────── │
     │ [Hyväksy]       │ ──→ "Luo MyyntiExcel"
     │ [Korjaa]        │
     └─────────────────┘
             ↓
             
     (4) MYYNTIEXCEL GENEROINTI
     ┌──────────────────────────┐
     │   AI Laskun Luonti       │
     │ ───────────────────────  │
     │ • Tuote → ProductName    │ ──→ Match product
     │ • Ostohinta validointi   │ ──→ Verify BuyPrice
     │ • Myyntihinta haku       │ ──→ Use SalePrice
     │ • Tilaus tiedot          │ ──→ createLasku()
     └──────────────────────────┘
             ↓
     ┌─────────────────┐
     │ MYYNTIEXCEL     │
     │ ─────────────── │
     │ JSON/Excel      │ ──→ Download/Save
     └─────────────────┘
```

### 📋 Data Processing Details

#### **1. Ostolasku Upload (Purchase Invoice Upload)**
- **File Types**: Excel (.xlsx, .xls) ostolaskut (purchase invoices)
- **Invoice Types**: 
  - Koontilaskut (consolidated invoices)
  - Taloyhtiökohtaiset laskut (property-specific invoices)
- **Size Limit**: 1MB per file (Firestore document limit)
- **Validation**: File type and structure checking

#### **2. AI Analysis & Verification**
**Automatic Detection:**
- **Product Description Matching**: AI matches invoice product descriptions ("Tuote" field) with price list ProductName
- **Purchase Price Validation**: Verifies invoice price matches price list BuyPrice
- **Sales Price Retrieval**: Gets SalePrice from price list for matched products
- **Order Data**: Retrieves customer and order details from database

**Verification Report:**
- ✅ All products found in price list
- ⚠️ Missing products identified
- ✅ Order data matched and validated
- 📊 Summary of findings for user review

#### **3. User Approval Process**
- Review AI analysis report
- Confirm all data is correct
- Request sales invoice generation
- Option to correct any issues first

#### **4. Sales Invoice Generation**
**Matching Logic:**
1. **Product Matching**: Uses "Tuote" field from purchase invoice to find matching ProductName in price list
2. **Price Validation**: Confirms purchase price (ahinta) matches price list BuyPrice
3. **Sales Price**: Retrieves SalePrice from matched price list item
4. **Error Handling**: Fails if product not found or prices don't match

**Data Sources:**
- **Hinnasto (Price List)**: Official sales and purchase prices for products
- **Tilaus Data (Order Data)**: Customer information and order details

**Output:**
- Complete sales invoice with all line items
- Proper customer information from orders
- Calculated totals and VAT
- Export as JSON or Excel format

### 🔍 **Key Advantages**

- **No File Storage Needed**: Excel data lives as searchable text in Firestore
- **Instant Search**: No need to re-parse Excel files for each search
- **Cross-Document Queries**: AI can find patterns across multiple uploads
- **Version Control**: Each upload is separate, allowing data evolution tracking
- **API Consistency**: Same search interface for uploaded and AI-generated data

### ⚡ **Performance Characteristics**

- **Upload Speed**: Excel → Firestore conversion happens during upload
- **Search Speed**: Fast text-based filtering on pre-processed CSV data  
- **Memory Efficiency**: No need to keep Excel files in memory
- **Scalability**: Limited by Firestore document size (1MB) and pricing

## System Architecture

### System Prompt vs Welcome Message

The application uses two distinct messaging systems:

#### System Prompt (AI Instruction)
- **Source**: Firebase Firestore database
- **Purpose**: Instructs the AI how to behave and respond
- **Visibility**: Hidden from users, sent to AI in every request
- **Management**: Configurable via Admin panel → Prompt Version Manager
- **Content**: AI behavior rules, function calling instructions, domain expertise
- **Location**: `sessionService.initializeChatSession()` → `chatSession.fullContext`

#### Welcome Message (UI Greeting)
- **Source**: Hardcoded in React component
- **Purpose**: Friendly greeting displayed to users in chat interface
- **Visibility**: Visible to users, never sent to AI
- **Management**: Requires code changes to modify
- **Content**: User-facing introduction and feature overview
- **Location**: `PropertyManagerChat.tsx` lines 154-158

#### Function Calling System
- **Price List Search**: `searchHinnasto` function for product pricing data
- **Order Search**: `searchTilaus` function searches by tampuurinumero (Code field) only
- **Purchase Invoice Search**: `searchOstolasku` function for uploaded invoice data
- **Invoice Creation**: `createLasku` function for generating sales invoices
- **Real-time Data**: Direct access to Excel-based pricing and order information
- **Structured Results**: Product details, pricing, customer information, order references

**Note**: The `searchTilaus` function now searches exclusively by the Code field (tampuurinumero), matching the UI's single search field implementation

## Architecture: Function Declarations

### **🔧 Hardcoded Function Declarations (By Design)**

Propertius uses a **hybrid architecture** for AI function calling:

#### **📝 What's Hardcoded:**
- **Function Declarations** (in chat components)
- **Parameter Definitions** and validation schemas
- **Gemini Model Configuration** 
- **API Integration Logic**

#### **🔥 What's in Firebase:**
- **System Prompts** (invoicing-specific configurations)
- **Chat History** and continuous improvement data
- **Price Lists** (`hinnasto` collection)
- **Order Data** (`tilaus_data` collection)
- **Sales Invoices** (`myyntiExcel` collection)

#### **💡 Why This Design:**
```javascript
// Example: Hardcoded function declaration
const searchHinnastoFunction = {
  name: "searchHinnasto", 
  description: "Search price list data by product code or name...",
  parameters: {
    type: "object",
    properties: {
      tuotetunnus: { type: "string", description: "Product code..." },
      tuote: { type: "string", description: "Product name..." },
      // ... other parameters
    }
  }
};
```

**Benefits:**
- ✅ **Performance**: No Firebase calls for function definitions
- ✅ **Version Control**: Function schemas tracked in Git
- ✅ **Security**: API structure not user-modifiable  
- ✅ **Reliability**: Consistent function behavior
- ✅ **Developer Experience**: Easy to modify in code

**Final AI Prompt Structure:**
```
Firebase System Prompt + Firebase Knowledge Docs + Hardcoded Function Declaration → Gemini AI
```

## Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd procurement-ai-evaluator
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment variables**

Create a `.env` file in the project root and define the following variables:

```env
VITE_GEMINI_API_KEY=your_gemini_api_key_here
VITE_GEMINI_MODEL=gemini-2.5-flash-preview-04-17

# Firebase Configuration (required for system prompt versioning)
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain
VITE_FIREBASE_PROJECT_ID=your_firebase_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_firebase_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_firebase_messaging_sender_id
VITE_FIREBASE_APP_ID=your_firebase_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_firebase_measurement_id
`


**Note**: Firebase configuration is required for the system prompt versioning feature, which is a core evaluation capability.

4. **Start the development server**
```bash
npm run dev
```

The application will start at `http://localhost:5173`

## Usage

### Login Credentials
- Username: `evaluator`
- Password: `go_nogo_decision`

### Core Functionality

1. **Document Upload**: 
   - Drag and drop or select files (PDF, Excel, CSV, Word)
   - Supported formats: `.pdf`, `.xlsx`, `.xls`, `.csv`, `.doc`, `.docx`

2. **AI Analysis Session**:
   - Start an analysis session with uploaded documents
   - AI provides initial overview and insights

3. **Structured Data Extraction**:
   - **Extract Products**: Get structured product and pricing information
   - **Extract Orders**: Analyze customer order data
   - **Extract Invoices**: Process purchase invoice details

4. **Interactive Analysis**:
   - Ask natural language questions about your documents
   - Get AI-powered insights and recommendations
   - Export extracted data as CSV files

5. **System Prompt Versioning**:
   - Create and manage different versions of AI system prompts
   - Evaluate and compare different prompt strategies
   - Browse version history and track improvements
   - Add evaluation notes for each prompt version

### Quick Actions

The application provides pre-built analysis prompts for:
- Purchase invoice analysis and verification
- Sales invoice generation from purchase data
- Price list verification and margin calculation
- Order data matching and validation

## Project Structure

```
src/
├── components/          # React components
│   ├── ui/             # Base UI components (shadcn/ui)
│   ├── DocumentAnalysis.tsx  # Document upload and management
│   ├── ProcurementChat.tsx   # AI chat interface
│   └── LoginForm.tsx
├── hooks/              # Custom React hooks
│   └── useAuth.ts
├── lib/                # Utilities and services
│   ├── firestoreService.ts
│   └── utils.ts
├── pages/              # Page components
│   ├── Index.tsx       # Landing page
│   └── Workbench.tsx   # Main application
└── types/              # TypeScript type definitions
```

## Development

### Scripts

```bash
# Development server
npm run dev

# Production build
npm run build

# Preview production build
npm run preview

# Type checking
npx tsc --noEmit

# Linting
npm run lint
```

### Getting Google Gemini API Key

1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create a new API key
3. Add it to your `.env` file as `VITE_GEMINI_API_KEY`

### Adding New Features

1. Create new components in `src/components/`
2. Add TypeScript types in `src/types/`
3. Test functionality locally
4. Ensure TypeScript checks pass

## Evaluation Scenarios

This tool is perfect for demonstrating:

1. **Invoice Processing**: Upload purchase invoices to see AI extraction and analysis
2. **Data Verification**: Automatic validation against price lists and order data
3. **Sales Invoice Generation**: Transform purchase invoices into profitable sales invoices
4. **Margin Optimization**: Apply intelligent pricing with configurable margins
5. **Process Automation**: Streamline the entire re-invoicing workflow

## System Requirements

- Node.js 18+
- npm 8+
- Modern browser (Chrome, Firefox, Safari, Edge)
- Google Gemini API key

## Security

- No hardcoded secrets or API keys in the codebase
- Environment variables used for all sensitive configuration
- Demo credentials are intentionally public for evaluation purposes
- All API keys loaded from runtime environment

## License

MIT

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Ensure tests pass and code is properly formatted
5. Submit a pull request

## Deployment

The application is configured for easy deployment to Vercel or similar platforms:

1. Connect your repository to your deployment platform
2. Set the required environment variables
3. Deploy directly from your main branch

For Vercel deployment:
```bash
vercel --prod
```

## Support

For questions about the procurement AI evaluation capabilities or technical implementation, please create an issue in the repository.