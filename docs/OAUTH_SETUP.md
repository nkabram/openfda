# OAuth Setup Guide for Local Development

## Issue
When running the application locally, after logging in with Google OAuth, the application redirects to the production website instead of staying on localhost.

## Root Cause
The Supabase project's OAuth configuration likely only includes the production URL as an allowed redirect URL, but not the localhost development URL.

## Solution

### 1. Configure Supabase OAuth Settings

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project: `blftrjkwaxjggsmjyxeq`
3. Navigate to **Authentication** → **URL Configuration**
4. In the **Redirect URLs** section, add the following URLs:

**For Development:**
```
http://localhost:3000/auth/callback
http://127.0.0.1:3000/auth/callback
```

**For Production (if not already added):**
```
https://your-production-domain.com/auth/callback
```

### 2. Configure Site URL

In the same **URL Configuration** section:

**Site URL** should be set to:
- For development: `http://localhost:3000`
- For production: `https://your-production-domain.com`

### 3. Google OAuth Configuration

Make sure your Google OAuth application (Google Cloud Console) also includes the localhost URLs:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **APIs & Services** → **Credentials**
3. Find your OAuth 2.0 Client ID
4. Add to **Authorized redirect URIs**:
   ```
   http://localhost:3000/auth/callback
   https://blftrjkwaxjggsmjyxeq.supabase.co/auth/v1/callback
   ```

### 4. Environment Variables

Ensure your `.env.local` file has the correct Supabase configuration:

```env
NEXT_PUBLIC_SUPABASE_URL=https://blftrjkwaxjggsmjyxeq.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
```

### 5. Testing

1. Clear your browser cache and cookies
2. Restart your development server
3. Try logging in with Google OAuth
4. Check the browser console for detailed logging

## Debugging

The application now includes comprehensive logging. Check the browser console for:

- 🔑 OAuth initiation logs
- 🌐 Current origin and redirect URL information
- 🔄 Auth callback processing logs
- 🚨 Specific error messages with solutions

## Common Issues

### Issue: "Invalid redirect URL"
**Solution:** Add the exact URL shown in the error to your Supabase redirect URLs.

### Issue: Still redirecting to production
**Solution:** 
1. Clear browser cache completely
2. Check that localhost URLs are added to both Supabase and Google OAuth settings
3. Restart the development server

### Issue: "URL not allowed"
**Solution:** Make sure the redirect URL in Supabase exactly matches what's being sent (including http vs https, port numbers, etc.)

## Files Modified

The following files have been updated with better OAuth handling:

- `/lib/auth-utils.ts` - New utility for environment-aware OAuth configuration
- `/contexts/AuthContext.tsx` - Enhanced Google OAuth with better error handling
- `/app/auth/callback/page.tsx` - Added comprehensive debugging logs

## Support

If you continue to have issues:

1. Check the browser console for detailed error messages
2. Verify all URLs in Supabase dashboard match exactly
3. Ensure Google OAuth settings include localhost URLs
4. Try using `127.0.0.1:3000` instead of `localhost:3000` if issues persist
