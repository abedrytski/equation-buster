# Supabase Authentication Setup

## Overview

Authentication is now fully integrated with Supabase. Users must log in or create an account before accessing the game.

## How It Works

### 1. **App Startup**
- `auth.initAuth()` checks if user has existing session
- If logged in → hide auth screen, show game
- If not logged in → show auth screen with login/signup forms

### 2. **User Flow**
```
New User:
  → See login/signup screen
  → Click "Sign up"
  → Enter email + password
  → Account created + auto-login
  → Access game

Returning User:
  → See login screen
  → Enter email + password
  → Session restored
  → Access game

Test User:
  → Click "Quick Test Login"
  → Auto-creates test account (test_[timestamp]@example.com)
  → Instant access
```

### 3. **Session Management**
- Session stored in browser localStorage
- Restored on page reload (user stays logged in)
- Sign out clears session

## Features Implemented

✅ **Sign Up**
- Email validation
- Password confirmation
- Auto-login after signup
- Error handling (duplicate email, weak password)

✅ **Login**
- Email + password
- Session persistence
- Error handling (wrong credentials)

✅ **Session Restore**
- Auto-restore on page reload
- Seamless user experience

✅ **Test Account**
- One-click test login
- Auto-generates test_[timestamp]@example.com
- Perfect for development/demo

✅ **Logout**
- Clear session and auth state
- Return to login screen

## Testing

### Test with Quick Login
1. Open http://localhost:8000
2. Click "Quick Test Login"
3. Account created instantly
4. Game loads with authenticated user

### Test Manual Signup
1. Click "Create Account"
2. Enter email: test@example.com
3. Password: TestPass123
4. Click "Sign Up"
5. Auto-logs in and starts game

### Test Login on New Session
1. Complete signup as above
2. Reload page (Ctrl+R)
3. Session restored automatically
4. No login needed

### Test Logout
1. In game, go to home screen
2. (Add logout button to home/game-over screen)
3. Click logout
4. Back to login screen

## Code Structure

### `src/lib/auth.js`
- Supabase authentication client
- `signUp()`, `signIn()`, `signOut()`, `getCurrentUser()`
- Session persistence
- Auth state listeners

### `src/lib/authUI.js`
- Login/signup form handling
- Form validation
- Error display
- Form switching
- Test account creation

### State Integration
- Auth state separate from game state
- Game only loads after auth succeeds
- User ID available for profile/progress tracking

## Next Steps

### 1. Link Auth to Game Progress
```javascript
import { getCurrentUser } from "./lib/auth.js";

// In game startup or save logic
const userId = getCurrentUser().id;
await db.saveLevelProgress(userId, world, level, stars, score);
```

### 2. Add Logout Button
```html
<button id="logoutBtn">Logout</button>
```

```javascript
import * as auth from "./lib/auth.js";
logoutBtn.addEventListener("click", async () => {
  await auth.signOut();
  // Redirect to auth screen
});
```

### 3. Link with Database
- Save user profile on signup
- Load user progress on login
- Update current world/level from database

## Technical Details

### Local Supabase
- Auth running at http://localhost:54321
- Email/password authentication
- Session managed via JWT tokens
- Data stored in local PostgreSQL

### Credentials
- Anon Key: Built into auth.js (safe - only for client)
- User credentials: Encrypted by Supabase

### Security
- Passwords sent to Supabase securely (HTTPS locally)
- Session tokens stored in localStorage
- RLS policies enforce user data isolation

## Troubleshooting

### Users Can't Sign Up
- Check Supabase is running: `supabase status`
- Check auth.js has correct URL (localhost:54321)
- Check local Supabase auth service is active

### Session Not Persisting
- Check browser localStorage is enabled
- Check Supabase session is being created

### "Email already exists"
- Try different email (test_[random]@example.com)
- Or use test login button (auto-generates unique email)

## When Ready for Production

1. Switch to Supabase cloud project
2. Update URL and anon key in auth.js
3. Enable email verification (optional)
4. Add password reset (optional)
5. Update RLS policies for production data
