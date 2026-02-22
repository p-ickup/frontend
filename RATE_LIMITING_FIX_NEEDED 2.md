# Rate Limiting Note for send-all-match-emails-batch

## ⚠️ ACTION REQUIRED: Add Rate Limiting

The existing `send-all-match-emails-batch` edge function **needs rate limiting** to comply with Resend's API limits.

## Current Issue

If you're sending emails in batches of 100, you likely have code like:

```typescript
for (let i = 0; i < emails.length; i += BATCH_SIZE) {
  const batch = emails.slice(i, i + BATCH_SIZE)
  
  // Send batch
  await fetch('https://api.resend.com/emails/batch', {
    method: 'POST',
    headers: { ... },
    body: JSON.stringify(batch)
  })
  
  // ❌ MISSING: No delay between batches!
}
```

**Problem**: This sends batches as fast as possible, potentially exceeding Resend's rate limit of **2 requests per second**.

## Solution: Add Rate Limiting

Add a 500ms delay between batches:

```typescript
// Helper function at the top of the file
async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// In your batch sending loop
const BATCH_SIZE = 100
const DELAY_BETWEEN_BATCHES = 500 // 500ms = 2 req/sec

for (let i = 0; i < emails.length; i += BATCH_SIZE) {
  const batch = emails.slice(i, i + BATCH_SIZE)
  
  try {
    const response = await fetch('https://api.resend.com/emails/batch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify(batch),
    })

    if (!response.ok) {
      const errorData = await response.text()
      console.error(`Batch ${Math.floor(i / BATCH_SIZE) + 1} failed:`, errorData)
      totalFailed += batch.length
    } else {
      const result = await response.json()
      console.log(`Batch ${Math.floor(i / BATCH_SIZE) + 1} sent:`, result)
      totalSent += batch.length
    }
  } catch (error) {
    console.error(`Error sending batch ${Math.floor(i / BATCH_SIZE) + 1}:`, error)
    totalFailed += batch.length
  }

  // ✅ Rate limiting: Wait 500ms between batches (2 req/sec)
  if (i + BATCH_SIZE < emails.length) {
    await delay(DELAY_BETWEEN_BATCHES)
  }
}
```

## Where to Add This

The `send-all-match-emails-batch` edge function is likely deployed at:
```
supabase/functions/send-all-match-emails-batch/index.ts
```

## Testing

### Before Deploying
Test with a dry run to ensure it doesn't break anything:

```bash
# Dry run first
curl -X POST 'https://YOUR_PROJECT.supabase.co/functions/v1/send-all-match-emails-batch' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"dry_run": true}'
```

### After Deploying
Monitor the first real send:
1. Send a small batch (10-20 emails)
2. Check Supabase logs for timing
3. Verify no rate limit errors
4. Check Resend dashboard for deliveries

## Performance Impact

**Before** (no rate limiting):
- 300 emails = 3 batches sent instantly (~1-2 seconds)
- Risk of rate limit errors

**After** (with rate limiting):
- 300 emails = 3 batches with delays (~1.5 seconds total)
- Batch 1: Send immediately (0ms)
- Wait 500ms
- Batch 2: Send (500ms)
- Wait 500ms
- Batch 3: Send (1000ms)
- **Total: ~1.5 seconds** (still very fast!)

The delay is minimal and ensures compliance with API limits.

## Why This Matters

1. **Prevents API errors**: Rate limit errors cause failed email sends
2. **Complies with Resend terms**: Staying within limits prevents account issues
3. **Ensures reliability**: Emails get delivered successfully
4. **Future-proof**: Works even with large batches (1000+ emails)

## Reference Implementation

See the new `send-unmatched-emails-batch` function for a complete reference implementation with rate limiting:
- File: `supabase_functions_send-unmatched-emails-batch.ts`
- Lines: Search for "DELAY_BETWEEN_BATCHES"

## Resend Rate Limits (2026)

- **Batch API**: 100 emails per request
- **Rate limit**: 2 requests per second
- **Monthly limit**: Depends on your plan (check Resend dashboard)

## Additional Improvements

While adding rate limiting, consider also adding:

1. **Better error handling**:
   ```typescript
   try {
     // Send batch
   } catch (error) {
     console.error(`Batch failed:`, error)
     // Continue with next batch instead of failing completely
   }
   ```

2. **Progress logging**:
   ```typescript
   console.log(`Sending batch ${batchNum}/${totalBatches}...`)
   ```

3. **Retry logic** (optional):
   ```typescript
   let retries = 0
   while (retries < 3) {
     try {
       // Send batch
       break // Success
     } catch (error) {
       retries++
       if (retries === 3) throw error
       await delay(1000) // Wait 1s before retry
     }
   }
   ```

## Deployment Command

```bash
cd /path/to/your/supabase/project
supabase functions deploy send-all-match-emails-batch
```

## Summary

**Action Items**:
1. ✅ Add `delay()` helper function
2. ✅ Add `DELAY_BETWEEN_BATCHES = 500` constant
3. ✅ Add `await delay(500)` after each batch (except last)
4. ✅ Test with dry run
5. ✅ Deploy
6. ✅ Monitor first real send

This is a **high priority** fix to ensure reliable email delivery.

