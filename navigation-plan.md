# Navigation Architecture Plan

## Current State
- Single workbench at `/workbench`
- Single admin at `/admin`
- Simple navigation

## Target State
- Dual workbenches: Purchaser & Invoicer
- Separate admin panels for each
- Easy switching between modes

## Recommended Approach: **Workspace Switcher**

### URL Structure
```
/                           → Landing page
/login                     → Login
/workspace/purchaser       → Purchaser workspace (chat + admin tabs)
/workspace/invoicer        → Invoicer workspace (chat + admin tabs)
/issues                    → Issue reporting (shared)
```

### Navigation Component
```
┌─────────────────────────────────────────────────────────┐
│ [Retta] [Purchaser ▼] [Chat][Admin] [Profile][Logout]   │
│          ├─ Purchaser                                   │
│          └─ Invoicer                                    │
└─────────────────────────────────────────────────────────┘
```

### Benefits
1. **Clean URLs**: `/workspace/purchaser` vs `/workspace/invoicer`
2. **Consistent Layout**: Same navigation pattern for both
3. **Easy Switching**: Dropdown in nav bar
4. **Tab Navigation**: Chat/Admin tabs within each workspace
5. **Shared Components**: Login, Issues, Profile remain shared

### Implementation Steps
1. Create workspace layout component
2. Add workspace switcher dropdown
3. Create separate chat/admin for each workspace
4. Update routing structure
5. Migrate existing components to purchaser workspace
6. Create new invoicer workspace components

### Database Separation
- Purchase orders: `purchaser_*` tables/collections
- Sales invoices: `invoicer_*` tables/collections
- Shared: `users`, `sessions`, `issues`

This approach provides:
- Clear separation of concerns
- Intuitive user experience
- Easy maintenance and scaling
- Consistent design patterns