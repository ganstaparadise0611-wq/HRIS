# BYTEA Data Type Implementation

## Overview
The `evidence_data` column uses PostgreSQL `BYTEA` data type to store binary file/photo data efficiently in the database.

## How It Works

### Database Schema
```sql
evidence_data BYTEA  -- Stores binary file/photo data
```

### Data Flow

1. **Frontend → Backend**:
   - Frontend sends base64-encoded data (with or without data URI prefix)
   - Example: `"data:image/jpeg;base64,/9j/4AAQSkZJRg..."` or just `"/9j/4AAQSkZJRg..."`

2. **Backend Processing**:
   - Removes data URI prefix if present
   - Validates base64 format
   - Sends base64 string to Supabase REST API
   - **Supabase automatically converts base64 to BYTEA** when storing

3. **Backend → Frontend**:
   - Supabase REST API returns BYTEA as base64-encoded string
   - Backend adds data URI prefix for photos (e.g., `data:image/jpeg;base64,...`)
   - Frontend receives ready-to-use base64 data URI

## Advantages of BYTEA

✅ **Efficient Storage**: Binary data stored directly (no base64 overhead in storage)  
✅ **Better Performance**: PostgreSQL handles binary data natively  
✅ **Smaller Database Size**: No 33% base64 overhead in storage  
✅ **Automatic Conversion**: Supabase REST API handles base64 ↔ BYTEA conversion  

## Important Notes

### Supabase REST API Behavior
- **When Inserting**: Send base64 string → Supabase converts to BYTEA automatically
- **When Retrieving**: Supabase returns BYTEA as base64 string automatically
- **No Manual Conversion Needed**: The REST API handles all conversions

### Base64 Format Handling
- **Data URI Prefix**: `data:image/jpeg;base64,` is automatically stripped before storage
- **Pure Base64**: Can send base64 string directly without prefix
- **Validation**: Backend validates base64 format before storing

### File Size Considerations
- **BYTEA Column**: Can store up to 1GB per value
- **Recommended**: < 10MB per file for best performance
- **Maximum**: < 50MB per file (PostgreSQL limit)

## Migration from TEXT to BYTEA

If you have an existing table with `evidence_data` as TEXT:

```sql
-- Step 1: Add new BYTEA column
ALTER TABLE user_activities 
ADD COLUMN evidence_data_new BYTEA;

-- Step 2: Migrate existing base64 data to BYTEA
-- (Supabase will handle the conversion)
UPDATE user_activities 
SET evidence_data_new = decode(evidence_data, 'base64')
WHERE evidence_data IS NOT NULL;

-- Step 3: Drop old column and rename new one
ALTER TABLE user_activities 
DROP COLUMN evidence_data;
ALTER TABLE user_activities 
RENAME COLUMN evidence_data_new TO evidence_data;
```

## Testing

After setup, test with:

1. **Create activity with photo**: Should store as BYTEA
2. **Retrieve activity**: Should return base64 string
3. **Check database**: Verify `evidence_data` column type is BYTEA
4. **Verify size**: Compare storage size (should be smaller than TEXT with base64)

## Troubleshooting

### Error: "invalid input syntax for type bytea"
- **Cause**: Invalid base64 format sent to Supabase
- **Solution**: Ensure base64 string is valid (no data URI prefix when sending)

### Error: "bytea value too large"
- **Cause**: File exceeds PostgreSQL BYTEA limit
- **Solution**: Reduce file size or use Supabase Storage for large files

### Data not displaying correctly
- **Cause**: Missing data URI prefix for images
- **Solution**: Backend automatically adds prefix for photos, check `evidence_type` is set correctly
