# Profile Picture Requirements

## Overview
Profile pictures are required for new user profiles (per ASPC request). Users with Google profile pictures can use those, while users without Google pictures must upload a custom image.

## Requirements

### File Format
- **Accepted formats**: PNG, JPG, HEIC
- **Maximum file size**: 5MB
- **Maximum dimensions**: 1024x1024 pixels (images are automatically resized)

### User Experience
1. **New users with Google photos**: Can use their Google profile picture (no upload required)
2. **New users without Google photos**: Must upload a custom profile picture
3. **Existing users**: Can upload a new photo to replace their current one
4. **Google integration**: Users can override their Google profile picture with a custom image
5. **Smart validation**: Only requires upload if no Google profile picture exists
6. **Complete profile enforcement**: Users must complete profile before using any features
7. **User-friendly guidance**: Clear messages with links to complete profile

## Technical Implementation

### Image Processing
- **Compression**: Images are automatically compressed to 80% quality JPEG format
- **Resizing**: Large images are resized to fit within 1024x1024 pixels while maintaining aspect ratio
- **Storage**: Images are stored in Supabase storage bucket `profile_picture`

### Priority System
1. Custom profile picture (from Users table)
2. Google profile picture (fallback)

### Components
- `imageUtils.ts`: Image validation and compression utilities
- `FileUploadInfo.tsx`: Reusable component for displaying upload requirements
- `profileValidation.ts`: Comprehensive profile validation utility
- Updated `useAuth.ts`: Prioritizes custom profile pictures over Google avatars
- Updated `profile/page.tsx`: Required profile picture upload with validation
- Updated `matchForm/page.tsx`: Profile validation before ride creation
- Updated `page.tsx`: Profile status check with friendly message and link
- Updated `questionnaires/page.tsx`: Profile validation before accessing forms

## Error Handling
- Invalid file format
- File size too large
- Upload failures
- Image processing errors

All errors are displayed to users with clear, actionable messages.
