# Batch Email Logic Explanation

## Email Variants

Your batch email function sends **3 different email variants** based on these factors:

### Decision Logic

```typescript
if (is_subsidized && to_airport) {
  // Variant 1: Subsidized TO Airport
} else if (is_subsidized && !to_airport) {
  // Variant 2: Subsidized FROM Airport (return trip)
} else {
  // Variant 3: Unsubsidized
}
```

### Factors:
1. **`is_subsidized`** (boolean) - Is the ride covered by ASPC?
2. **`to_airport`** (boolean from Flights table) - Direction of travel
   - `true` = School → Airport (departure)
   - `false` = Airport → School (return)

### Variants:

#### Variant 1: Subsidized TO Airport
- **When**: `is_subsidized = true` AND `to_airport = true`
- **Subject**: "PICKUP — Your ASPC-subsidized ride group!"
- **Content**: 
  - Welcome message about upcoming trip
  - Meeting point: 647 N College Way (outside Lincoln Hall)
  - Voucher section
  - Contingency voucher (if exists and `to_airport = false` - wait, this seems wrong...)

#### Variant 2: Subsidized FROM Airport
- **When**: `is_subsidized = true` AND `to_airport = false`
- **Subject**: "PICKUP — Your ASPC-subsidized ride group!"
- **Content**:
  - Welcome back message
  - Different meeting point instructions (LAX-it for LAX, curbside for ONT)
  - Voucher section
  - Contingency voucher (only for return trips)

#### Variant 3: Unsubsidized
- **When**: `is_subsidized = false`
- **Subject**: "PICKUP — Your ride group!"
- **Content**:
  - Message about not being subsidized
  - Links to unmatched page
  - Encouragement to carpool or use alternatives

### Additional Logic:

**Contingency Voucher**:
- Only shown for **FROM airport trips** (`to_airport = false`)
- Displayed when `contingency_voucher` exists
- Includes delay/cancellation instructions

**Group Members List**:
- Generated dynamically for each user
- Excludes the current user
- Shows name, email, and phone number

## Should You Use Resend Templates?

### ❌ **Don't Use Templates (For Now)**

**Reasons:**
1. **Complex conditional logic** - You have nested conditions (subsidized + direction + contingency voucher)
2. **Dynamic group members** - Each email has different group members rendered as HTML
3. **Already working** - Your current HTML generation works fine
4. **Maintenance overhead** - Templates would require managing 3+ templates and complex variables

### ✅ **Use Inline HTML (Current Approach)**

**Benefits:**
1. **All logic in one place** - Easy to see and modify
2. **Dynamic content** - Group members, vouchers, etc. generated per email
3. **No template setup** - Works immediately
4. **Easy debugging** - All HTML generation in TypeScript

### 🔄 **Consider Templates Later If:**

- You want non-developers to edit email content
- Email content becomes very stable
- You have many more variants
- You want A/B testing different email designs

**For now, stick with inline HTML** - it's simpler and perfectly fine for your use case.

## Code Structure

The batch function:

1. **Fetches** all `is_verified = true` and `email_sent = false` matches
2. **Groups** by `ride_id` (for group member lists)
3. **Generates** HTML for each match based on logic
4. **Batches** into groups of 100
5. **Sends** via Resend Batch API
6. **Marks** `email_sent = true` for successful sends

All email variants are handled in the `generateEmailHtml()` function with clear conditional logic.

