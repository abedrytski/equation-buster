# Supabase Setup Guide

## Local Development Setup

### 1. Start Local Supabase
```bash
supabase start
```

This runs a full local Supabase stack:
- **API**: http://localhost:54321
- **Studio**: http://localhost:54323
- **Database**: PostgreSQL on localhost:5432

### 2. Create Database Schema

Option A: Via Studio (easiest)
1. Open http://localhost:54323
2. Go to SQL Editor
3. Copy-paste contents of `src/lib/schema.sql`
4. Execute

Option B: Via CLI
```bash
supabase db push
```

### 3. Get Local Anon Key
In Studio → Settings → API → `anon` public key. Copy it.

### 4. Set Up Environment

Create `.env.local`:
```
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=<paste the anon key here>
VITE_USE_LOCAL_DB=true
```

### 5. Install Supabase Client (when ready)
```bash
npm install @supabase/supabase-js
```

## Current Status

**Local Mock Mode** (`src/lib/db.js`):
- ✅ Works completely offline with localStorage-like behavior
- ✅ No Supabase connection needed
- ✅ Perfect for feature development

**Migration to Real Supabase**:
When you're ready, update `src/lib/db.js` to:
1. Initialize real Supabase client with env vars
2. Replace mock implementations with `.from()` queries
3. Keep the same public API (getOrCreateUser, saveLevelProgress, etc.)

## Testing Mode

### Enable Local Mock (default)
```javascript
import { setLocalMode } from "./src/lib/db.js";
setLocalMode(true);
```

### Debug State
```javascript
import { logDbState } from "./src/lib/db.js";
logDbState(); // logs profiles and level progress
```

## Next Steps

1. Integrate `db.js` into game state management
2. Call `saveLevelProgress()` when level is completed
3. Load user progress on game start
4. Test with local mock first
5. Switch to real Supabase when backend is ready

## Useful Commands

```bash
# Check local database
supabase db list

# View logs
supabase logs

# Reset database
supabase db reset

# Stop local Supabase
supabase stop
```
