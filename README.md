# Propertius - Professional Property Management AI

Meet the Propertius – your AI assistant for high standard professional property management. Advanced procurement optimization, intelligent invoicing automation, and comprehensive property operations management in one unified platform.

## Features

### 🏢 **Dual Workspace Architecture**
- **Propertius Procurement**: Advanced purchasing optimization and supplier intelligence
- **Propertius Invoicing**: Intelligent billing automation and financial operations
- **Seamless Workspace Switching**: Context-aware navigation between procurement and invoicing

### 🤖 **AI-Powered Operations**
- **Document Intelligence**: Upload and analyze PDF, Excel, CSV, and Word documents  
- **Real-time ERP Integration**: Direct access to purchase order and invoice data via function calling
- **Interactive Chat Interface**: Natural language conversation with workspace-specific AI assistants
- **Knowledge Base Integration**: Workspace-specific internal policies and procedures

### 📊 **Data Management**
- **Workspace-Isolated Storage**: Separate data collections for procurement and invoicing
- **System Prompt Versioning**: Track and evaluate different AI configurations per workspace
- **Continuous Improvement Tracking**: Monitor AI performance and user feedback
- **Structured Data Export**: Download extracted data as CSV files

## Use Cases

### **Procurement Workspace**
- **Supplier Intelligence**: Analyze supplier performance and pricing trends
- **Purchase Order Management**: Search and analyze procurement history
- **Cost Optimization**: Identify savings opportunities through AI insights
- **Procurement Policy Compliance**: Ensure adherence to internal guidelines

### **Invoicing Workspace**  
- **Invoice Processing**: Automated analysis and categorization
- **Payment Tracking**: Monitor payment status and overdue invoices
- **Financial Analytics**: Generate insights from billing data
- **Billing Process Optimization**: Streamline invoicing workflows

## Technologies

- **Frontend**: React 18, TypeScript, Vite
- **UI**: Tailwind CSS, shadcn/ui components
- **AI Integration**: Google Gemini API with function calling
- **File Processing**: Support for PDF, Excel, CSV, Word documents
- **Database**: Firebase Firestore for prompt versioning and session management
- **State Management**: React Hooks
- **Authentication**: Firebase Auth with custom user management

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
- **Purchase Orders**: `search_purchase_orders` function for ERP data access
- **Real-time Data**: Direct access to Excel-based purchase order information
- **Structured Results**: Supplier details, pricing, contact information, delivery dates

## Architecture: Function Declarations

### **🔧 Hardcoded Function Declarations (By Design)**

Propertius uses a **hybrid architecture** for AI function calling:

#### **📝 What's Hardcoded:**
- **Function Declarations** (`searchERPFunction` in `PropertyManagerChat.tsx`)
- **Parameter Definitions** and validation schemas
- **Gemini Model Configuration** 
- **API Integration Logic**

#### **🔥 What's in Firebase:**
- **System Prompts** (workspace-specific: `purchaser_systemPromptVersions`, `invoicer_systemPromptVersions`)
- **Knowledge Documents** (workspace-specific: `purchaser_knowledge`, `invoicer_knowledge`)
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