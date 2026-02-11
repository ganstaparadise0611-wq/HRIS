# Supabase Storage Setup for Profile Pictures

## What Changed

Your HRIS app now stores profile pictures in **Supabase Storage** instead of the database. This provides:
- ✅ Better performance (smaller database)
- ✅ Faster image loading
- ✅ CDN delivery for profile pictures
- ✅ Easier image management
- ✅ Public URLs for images

## Setup Instructions

### 1. Create Storage Bucket in Supabase

1. Go to your Supabase Dashboard: https://app.supabase.com
2. Select your project: `cgyqweheceduyrpxqvwd`
3. Click **Storage** in the left sidebar
4. Click **New Bucket**
5. Bucket name: `profile-pictures`
6. Check **Public bucket** ✓
7. Click **Create bucket**

### 2. Set Storage Policies (Alternative Method)

If you prefer SQL:

1. Go to **SQL Editor** in Supabase Dashboard
2. Open the file `setup-storage-bucket.sql` from your project
3. Copy and paste the SQL code
4. Click **Run** to execute

### 3. Update Database Column (Optional)

The `accounts.face` column will now store:
- **Old data**: Base64 image strings (still supported for backward compatibility)
- **New data**: Storage paths like `profile-pictures/username_1234567890.jpg`

No migration needed - the app handles both formats automatically!

##Profile Picture Flow

### Signup
1. User captures face photo during signup
2. Photo is uploaded to `storage/profile-pictures/` bucket
3. Storage path (e.g., `profile-pictures/marc_1709251234.jpg`) is saved in `accounts.face` column

### Profile View
1. App fetches storage path from `accounts.face`
2. Generates public URL: `https://cgyqweheceduyrpxqvwd.supabase.co/storage/v1/object/public/profile-pictures/marc_1709251234.jpg`
3. Displays image from URL

### Profile Update
1. User selects new photo from gallery
2. Photo is uploaded to storage bucket with new timestamp
3. Database is updated with new storage path
4. Old image remains in storage (can be cleaned up later)

## File Structure

```
Supabase Storage
└── profile-pictures/          (public bucket)
    ├── marc_1709251234.jpg    (username_timestamp.jpg)
    ├── admin_1709251567.jpg
    └── dane_1709252890.jpg
```

## Testing

1. **Test Signup**: Create a new account and capture face
   - Check Supabase Storage → profile-pictures bucket for uploaded image
   - Check `accounts` table → `face` column should have path like `profile-pictures/username_timestamp.jpg`

2. **Test Profile View**: Open profile screen
   - Should display the captured face photo
   - Check console logs for storage path and public URL

3. **Test Profile Update**: Edit profile and change picture
   - Select new image from gallery
   - Should upload successfully and display new image

## Troubleshooting

### Images not uploading
- Check Supabase Storage bucket exists and is public
- Verify storage policies are set correctly
- Check console logs for upload errors

### Images not displaying
- Verify the storage path in database is correct
- Check public URL is accessible in browser
- Ensure bucket is set to public

### Old users (with base64 data)
- No action needed - app handles both formats
- Consider migrating old data to storage for consistency

## Benefits

Before (Database Storage):
- ❌ Large base64 strings in database
- ❌ Slower queries
- ❌ No CDN caching
- ❌ Database bloat

After (Supabase Storage):
- ✅ Small path strings in database
- ✅ Fast queries
- ✅ CDN-delivered images
- ✅ Cleaner database
- ✅ Easy file management
