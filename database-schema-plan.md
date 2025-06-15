# Database Schema Migration Plan

## Current Firestore Collections
```
knowledge                 → Knowledge documents (shared)
erpDocuments             → Purchase order Excel data
systemPromptVersions     → System prompts (will need workspace separation)
continuous_improvement   → Session tracking
```

## New Schema Structure

### Shared Collections (no changes)
```
users                    → User accounts
knowledge               → Knowledge documents (shared between workspaces)
continuous_improvement  → Session tracking
```

### Workspace-Specific Collections
```
# Purchase Order Workspace
purchaser_erpDocuments          → Purchase order Excel files
purchaser_systemPromptVersions  → Purchaser-specific system prompts
purchaser_sessions              → Chat sessions

# Sales Invoice Workspace  
invoicer_erpDocuments           → Sales invoice Excel files
invoicer_systemPromptVersions   → Invoicer-specific system prompts
invoicer_sessions               → Chat sessions
```

## Migration Strategy

### Phase 1: Create New Collections
1. Create `purchaser_*` collections
2. Copy existing data: `erpDocuments` → `purchaser_erpDocuments`
3. Copy existing data: `systemPromptVersions` → `purchaser_systemPromptVersions`

### Phase 2: Create Invoicer Collections
1. Create empty `invoicer_*` collections
2. Same schema as purchaser but for sales invoices

### Phase 3: Update Service Layer
1. Add workspace parameter to storage services
2. Dynamic collection naming based on workspace
3. Update all CRUD operations

### Phase 4: Clean Up
1. Keep old collections for rollback
2. Eventually remove when stable

## Service Layer Changes

### StorageService Updates
```typescript
// Before
async getUserERPDocuments(userId: string)

// After  
async getUserERPDocuments(userId: string, workspace: 'purchaser' | 'invoicer')
```

### Dynamic Collection Names
```typescript
const getCollectionName = (workspace: string, type: string) => {
  return `${workspace}_${type}`;
}

// Usage
collection(db, getCollectionName('purchaser', 'erpDocuments'))
collection(db, getCollectionName('invoicer', 'erpDocuments'))
```

## Benefits
- Clean separation between purchaser & invoicer data
- Identical schema for both workspaces
- Easy to add more workspaces in future
- Maintains data integrity
- Simple migration path