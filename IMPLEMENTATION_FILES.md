# Emergency Contact Alert System - Implementation Checklist

## 📋 Files Created/Modified

### Backend Files

#### New Files Created:
- ✅ `backend/migrations/001_create_emergency_contacts.sql` - Database migration
- ✅ `backend/src/utils/emailAlert.js` - Email alert utility
- ✅ `backend/src/routes/emergencyContactRoutes.js` - API routes

#### Modified Files:
- ✅ `backend/package.json` - Added @emailjs/browser, nodemailer dependencies
- ✅ `backend/src/server.js` - Added emergency contact routes

### Frontend Files

#### New Files Created:
- ✅ `frontend/types/emergency.ts` - TypeScript interfaces
- ✅ `frontend/hooks/useEmergencyContact.ts` - React hook for API calls
- ✅ `frontend/components/EmergencyContactForm.tsx` - Form component
- ✅ `frontend/components/EmergencyContactModal.tsx` - Modal dialog
- ✅ `frontend/components/EmergencyContactSection.tsx` - Profile section
- ✅ `frontend/components/ui/dialog.tsx` - Dialog UI component

#### Modified Files:
- ✅ `frontend/app/auth/signup/page.tsx` - Updated signup flow with emergency contact step

### Documentation Files

#### Created:
- ✅ `EMERGENCY_CONTACT_SETUP.md` - Comprehensive setup guide
- ✅ `IMPLEMENTATION_FILES.md` - This file

---

## 🚀 Quick Start Checklist

### Phase 1: Database Setup
- [ ] Copy `backend/migrations/001_create_emergency_contacts.sql`
- [ ] Run migration in Supabase SQL Editor
- [ ] Verify table and RLS policies created
- [ ] Test database access with SELECT query

### Phase 2: Backend Setup
- [ ] Run `npm install` in backend directory
- [ ] Configure `.env` with Supabase credentials
- [ ] Configure `.env` with email provider credentials
- [ ] Test email service: `npm run dev`
- [ ] Verify `/api/emergency-contact` endpoints exist

### Phase 3: Frontend Setup
- [ ] Run `npm install` in frontend directory
- [ ] Configure `frontend/.env.local` with API URL and Supabase keys
- [ ] Verify all new components exist
- [ ] Start frontend: `npm run dev`

### Phase 4: Integration Testing
- [ ] Test signup flow with emergency contact
- [ ] Test profile page emergency contact section
- [ ] Test manual alert trigger
- [ ] Verify emails are sent
- [ ] Test edit and delete functionality

### Phase 5: Emotion Detection Integration
- [ ] Add emergency alert logic to emotion detection routes
- [ ] Set risk emotion thresholds
- [ ] Test with manual emotion submissions

### Phase 6: Deployment
- [ ] Configure environment variables on hosting
- [ ] Test in staging environment
- [ ] Verify email service in production
- [ ] Deploy to production

---

## 📝 Environment Variables Template

### Backend (.env)
```
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Email Provider (Gmail)
EMAIL_PROVIDER=gmail
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx

# Alternative: SendGrid
# EMAIL_PROVIDER=sendgrid
# SENDGRID_API_KEY=SG.xxxxxxx...

# API
PORT=3000
CORS_ORIGIN=http://localhost:3001
NODE_ENV=development
```

### Frontend (.env.local)
```
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## 🧪 Testing Endpoints

### Create Emergency Contact
```bash
curl -X POST http://localhost:3000/api/emergency-contact \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "contact_name": "John Doe",
    "contact_email": "john@example.com",
    "contact_phone": "+1 (555) 123-4567",
    "preferred_method": "email",
    "notify_enabled": true
  }'
```

### Fetch Emergency Contact
```bash
curl http://localhost:3000/api/emergency-contact/YOUR_USER_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Update Emergency Contact
```bash
curl -X PUT http://localhost:3000/api/emergency-contact/YOUR_USER_ID \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "contact_name": "Jane Doe",
    "notify_enabled": false
  }'
```

### Delete Emergency Contact
```bash
curl -X DELETE http://localhost:3000/api/emergency-contact/YOUR_USER_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Trigger Alert
```bash
curl -X POST http://localhost:3000/api/emergency-contact/trigger-alert/YOUR_USER_ID \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "emotion": "sad",
    "timestamp": "2024-01-15T10:30:00Z"
  }'
```

---

## 🔍 File Structure

```
Code Minor/
├── backend/
│   ├── migrations/
│   │   └── 001_create_emergency_contacts.sql (NEW)
│   ├── src/
│   │   ├── routes/
│   │   │   ├── emergencyContactRoutes.js (NEW)
│   │   │   ├── textRoutes.js
│   │   │   └── ... other routes
│   │   ├── utils/
│   │   │   ├── emailAlert.js (NEW)
│   │   │   └── ... other utils
│   │   ├── server.js (MODIFIED)
│   │   └── ... other files
│   ├── package.json (MODIFIED)
│   └── .env (needs configuration)
│
├── frontend/
│   ├── app/
│   │   ├── auth/
│   │   │   └── signup/
│   │   │       └── page.tsx (MODIFIED)
│   │   ├── profile/
│   │   │   └── page.tsx (add EmergencyContactSection)
│   │   └── ... other pages
│   ├── components/
│   │   ├── EmergencyContactForm.tsx (NEW)
│   │   ├── EmergencyContactModal.tsx (NEW)
│   │   ├── EmergencyContactSection.tsx (NEW)
│   │   ├── ui/
│   │   │   └── dialog.tsx (NEW)
│   │   └── ... other components
│   ├── hooks/
│   │   └── useEmergencyContact.ts (NEW)
│   ├── types/
│   │   └── emergency.ts (NEW)
│   ├── .env.local (needs configuration)
│   └── package.json
│
├── EMERGENCY_CONTACT_SETUP.md (NEW)
└── IMPLEMENTATION_FILES.md (NEW - this file)
```

---

## 🔗 Integration Points

### In Profile Page (frontend/app/profile/page.tsx)
Add this import near the top:
```typescript
import { EmergencyContactSection } from '@/components/EmergencyContactSection';
```

Add this component in the profile page JSX (after user stats section):
```tsx
<EmergencyContactSection />
```

### In Emotion Detection Routes
Add this to your emotion detection logic where you detect high-risk emotions:
```javascript
import { sendEmergencyAlert } from '../utils/emailAlert.js';
import { createClient } from '@supabase/supabase-js';

// When high-risk emotion detected:
if (riskEmotions.includes(emotion.label) && confidence > threshold) {
  const contact = await supabase
    .from('emergency_contacts')
    .select('*')
    .eq('user_id', userId)
    .single();
  
  if (contact?.notify_enabled) {
    await sendEmergencyAlert(user, contact, emotion.label, new Date());
  }
}
```

---

## ✅ Verification Steps

After implementation, verify:

1. **Database**
   - [ ] Table `emergency_contacts` exists in Supabase
   - [ ] RLS policy is enabled
   - [ ] Trigger for `updated_at` works

2. **Backend**
   - [ ] Dependencies installed
   - [ ] Routes registered in server.js
   - [ ] Email service verified
   - [ ] All 5 endpoints working

3. **Frontend**
   - [ ] All components exist and import correctly
   - [ ] TypeScript types are correct
   - [ ] Hook can fetch/create/update/delete contacts
   - [ ] Signup flow shows emergency contact step
   - [ ] Profile page shows emergency contact section

4. **Integration**
   - [ ] Users can sign up with emergency contact
   - [ ] Users can add contact on profile page
   - [ ] Users can edit and delete contacts
   - [ ] Alerts trigger when emotions detected
   - [ ] Emails arrive in inbox

---

## 🐛 Common Issues & Solutions

### Issue: "Module not found: @emailjs/browser"
**Solution:** Run `npm install @emailjs/browser nodemailer` in backend

### Issue: "CORS error when calling API"
**Solution:** Set `CORS_ORIGIN=http://localhost:3001` in backend/.env

### Issue: "Email not sending"
**Solution:** Verify email credentials and run test: `npm run test:email`

### Issue: "RLS policy error on insert"
**Solution:** Run SQL migration again to ensure policy is created correctly

### Issue: "Authorization: Bearer token fails"
**Solution:** Ensure token is from `session.access_token`, not `user` object

---

## 📚 Component API Reference

### useEmergencyContact Hook
```typescript
const {
  contact,           // Current contact object or null
  loading,          // Boolean indicating request in progress
  error,            // Error message if any
  success,          // Success message if any
  fetchContact,     // Async function to fetch contact
  createContact,    // Async function to create contact
  updateContact,    // Async function to update contact
  deleteContact,    // Async function to delete contact
  triggerAlert,     // Async function to trigger alert
  clearMessages,    // Function to clear error/success messages
} = useEmergencyContact();
```

### EmergencyContactForm Props
```typescript
interface Props {
  onSuccess?: () => void;      // Called after successful create/update
  isModal?: boolean;           // If true, shows in modal layout
  onCancel?: () => void;       // Called when user clicks cancel
  existingContact?: FormData;  // Pre-fill form with existing data
  mode?: 'create' | 'edit';    // Form mode
}
```

### EmergencyContactModal Props
```typescript
interface Props {
  isOpen: boolean;             // Control modal visibility
  onClose: () => void;         // Called when modal should close
  onSuccess?: () => void;      // Called after successful submit
  existingContact?: any;       // Contact data to edit
  mode?: 'create' | 'edit';    // Modal mode
}
```

---

## 📞 Support

For issues or questions:
1. Check `EMERGENCY_CONTACT_SETUP.md` for detailed instructions
2. Review component TypeScript files for usage examples
3. Check backend logs: `npm run dev`
4. Verify Supabase dashboard for database issues
5. Test email service directly with `sendTestEmail()`

---

**Version:** 1.0.0
**Last Updated:** January 2024
**Status:** Ready for Implementation