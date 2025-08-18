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

## Excel Data Flow Architecture

### 📊 ERP Data Processing Pipeline

Propertius processes Excel files through a sophisticated data conversion and storage system:

#### **1. Excel File Upload**
```
User uploads .xlsx/.xls file → storageService.uploadERPDocument()
```
- **File Types**: Excel (.xlsx, .xls) purchase orders and invoices
- **Size Limit**: 1MB per file (Firestore document limit)
- **Validation**: File type and structure checking

#### **2. Excel → Firestore Conversion**
```
Excel File → XLSX.js Processing → Firebase Firestore Document
```

**Data Transformation:**
- **Raw Excel**: Binary .xlsx file data
- **Sheet Parsing**: `XLSX.utils.sheet_to_json()` converts to array of arrays
- **CSV Conversion**: `XLSX.utils.sheet_to_csv()` for search-friendly format
- **JSON Storage**: Arrays converted to JSON strings for Firestore compatibility

**Firestore Document Structure:**
```json
{
  "name": "Purchase_Orders_2024.xlsx",
  "originalFormat": "xlsx", 
  "content": "Order Number,Supplier Name,Description,Qty...", // CSV format
  "rawDataJson": "[[\"PO-001\",\"Supplier A\",\"Product X\",5]]", // JSON array string
  "headersJson": "[\"Order Number\",\"Supplier Name\",\"Description\"]", // Headers as JSON
  "sheetsJson": "[\"Sheet1\"]", // Sheet names
  "rowCount": 25,
  "columnCount": 8,
  "uploadedAt": "2024-06-18T10:30:00Z",
  "userId": "user123",
  "type": "erp-integration"
}
```

#### **3. AI Function Call Data Access**
```
Chatbot Request → searchRecords() → Firestore Query → Combined Data Processing
```

**Function Call Pipeline:**
1. **AI Triggers**: `search_purchase_orders` or `create_purchase_order`
2. **Data Retrieval**: `getUserERPDocuments()` fetches all user's documents
3. **Data Combination**: All documents merged into single dataset
4. **CSV Processing**: Search and filter operations on combined CSV data
5. **Results**: Structured JSON response to AI

#### **4. Multi-Document Search**
```
Document 1 + Document 2 + Document 3 → Combined Dataset → Search Results
```

**How Multiple Documents Work:**
- **Header Unification**: First document's headers used for consistency
- **Data Merging**: All rows from all documents combined
- **Search Scope**: AI can find data across all uploaded Excel files
- **Real-time**: No pre-processing required, combined on-demand

#### **5. AI-Generated Purchase Orders**
```
AI creates new Purchase Order → Excel generation → Firestore storage → Download link
```

**Creation Flow:**
1. **AI Function**: `create_purchase_order` with order details
2. **Excel Generation**: XLSX.js creates new .xlsx file in memory
3. **Dual Output**:
   - **Download Link**: `URL.createObjectURL()` for immediate download
   - **Firestore Storage**: Same conversion process as uploaded files
4. **Search Integration**: New orders immediately searchable via API

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
- **Purchase Orders**: `search_purchase_orders` function for ERP data access (available in both workspaces)
- **Sales Invoices**: `search_invoices` function for billing data access (invoicing workspace only)
- **Dual API Access**: Invoicing workspace gets both purchase order and invoice APIs for comprehensive analysis
- **Real-time Data**: Direct access to Excel-based purchase order and sales invoice information
- **Structured Results**: Supplier details, pricing, contact information, delivery dates, payment status

## Architecture: Function Declarations

### **🔧 Hardcoded Function Declarations (By Design)**

Propertius uses a **hybrid architecture** for AI function calling:

#### **📝 What's Hardcoded:**
- **Function Declarations** (`searchERPFunction` in `PropertyManagerChat.tsx`)
- **Parameter Definitions** and validation schemas
- **Gemini Model Configuration** 
- **API Integration Logic**

#### **🔥 What's in Firebase:**
- **System Prompts** (workspace-specific: `invoicer_systemPromptVersions`)
- **Chat History** and continuous improvement data

#### **💡 Why This Design:**
```javascript
// Example: Hardcoded function declaration in PropertyManagerChat.tsx
const searchERPFunction = {
  name: "search_purchase_orders", 
  description: "Search and DISPLAY purchase order data for property management...",
  parameters: {
    type: "object",
    properties: {
      supplierName: { type: "string", description: "Supplier/contractor name..." },
      productDescription: { type: "string", description: "Service description..." },
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
   - **Extract Suppliers**: Get structured supplier information
   - **Extract Pricing**: Analyze pricing data and trends
   - **Extract Contracts**: Identify contract terms and conditions

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
- Supplier capability assessment
- Pricing optimization opportunities
- Contract risk analysis
- Process improvement recommendations

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

1. **Document Processing**: Upload real procurement documents to see AI extraction capabilities
2. **Data Structuring**: Transform unorganized data into structured formats
3. **Natural Language Querying**: Ask complex questions about procurement data
4. **Export Integration**: Show how AI-extracted data can integrate with existing systems
5. **Process Automation**: Demonstrate potential for procurement workflow automation

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