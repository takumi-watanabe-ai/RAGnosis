# Database Schema Functions

## Structure
- `public/` - API layer (query functions for UI and edge functions)
- `private/` - Business logic (internal helpers)
- `shared/` - Common utilities (JSON builders, formatters)

## Pattern
**Public functions**: Validate inputs, call private functions, return standardized JSON
**Private functions**: Execute queries, process data
**Shared functions**: Reusable utilities

## Usage
Both UI and edge functions can call public schema functions:
```typescript
// From edge function or UI
const { data } = await supabase.rpc('get_popular_models', { limit: 10 })
```

## Adding Functions
1. Group related queries in same file
2. Public validates → Private executes
3. Return consistent JSON format
4. Keep functions focused and reusable
