# SOMO - Setup Guide

## 🚀 Quick Start

### 1. Environment Configuration

Your Firebase configuration has been added to `.env`. Here's what's configured:

#### ✅ Firebase (Already Configured)
- API Key: `AIzaSyDhTTMjiKZ5RsLVY20tlcbPpy_Sb9kxK5E`
- Project: `respos-4f3f4`
- Auth Domain: `respos-4f3f4.firebaseapp.com`

#### ⚠️ ImgBB API Key (Required)
You need to get an ImgBB API key for image uploads:

1. Go to [https://api.imgbb.com/](https://api.imgbb.com/)
2. Sign up for a free account
3. Get your API key
4. Update `.env` file:
   ```
   IMGBB_API_KEY=your_actual_imgbb_key_here
   ```

### 2. Firebase Setup

#### Deploy Firestore Rules
```bash
firebase deploy --only firestore:rules
```

Or manually copy the contents of `firestore.rules` to your Firebase Console:
- Go to [Firebase Console](https://console.firebase.google.com/)
- Select project: `respos-4f3f4`
- Navigate to Firestore Database → Rules
- Paste the rules from `firestore.rules`
- Publish

#### Deploy Firestore Indexes
```bash
firebase deploy --only firestore:indexes
```

Or manually copy from `firestore.indexes.json` to Firebase Console → Firestore Database → Indexes

### 3. Create Super Admin

You need to create your first admin user manually in Firebase:

#### Step 1: Create Authentication User
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select project: `respos-4f3f4`
3. Navigate to **Authentication** → Users → Add user
4. Enter your email and password
5. Copy the **User UID** (you'll need it)

#### Step 2: Create Firestore Profile
1. Navigate to **Firestore Database**
2. Create a new document in the `users` collection:
   - Document ID: Use the **User UID** from Step 1
   - Fields:
     ```
     uid: "your-user-uid-from-step-1"
     email: "your-email@example.com"
     displayName: "Your Name"
     role: "super_admin"
     isActive: true
     createdAt: (use Firebase timestamp)
     phoneNumber: "+92 XXX XXXXXXX" (optional)
     ```

#### Step 3: Login
1. Go to `http://localhost:3000/login`
2. Use the email and password from Step 1
3. You should now have full admin access!

### 4. Install Dependencies

```bash
npm install
```

### 5. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 6. Build for Production

```bash
npm run build
npm start
```

---

## 📁 Project Structure

```
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (auth)/            # Login & Register
│   │   ├── (customer)/        # Customer-facing pages
│   │   ├── admin/             # Admin dashboard
│   │   └── api/               # API routes
│   ├── components/            # React components
│   ├── lib/                   # Utilities & Firebase
│   ├── services/              # Business logic
│   ├── stores/                # Zustand state management
│   └── types/                 # TypeScript types
├── public/                    # Static assets
├── docs/                      # Documentation
├── .env                       # Environment variables (DO NOT COMMIT)
├── .env.example              # Template for .env
└── firestore.rules           # Firestore security rules
```

---

## 🔐 Security Checklist

- [x] `.env` is in `.gitignore`
- [ ] ImgBB API key configured
- [ ] Firebase rules deployed
- [ ] Firebase indexes deployed
- [ ] Super admin user created
- [ ] Changed default QR secret in `.env`

---

## 🎯 Key Features Setup

### 1. Menu Management
- Admin → Menu → Add categories and items
- Upload images (requires ImgBB key)
- Set prices and variants

### 2. Deals & Promotions
- Admin → Deals → Create special offers
- Select menu items for combos
- Set discount percentages

### 3. Inventory Management
- Admin → Inventory → Add inventory items
- Link recipes to menu items
- Auto-deduction on orders

### 4. Employee Management
- Admin → Employees → Add staff
- Assign roles and permissions
- Set up attendance tracking

### 5. POS System
- Access at `/pos` route
- Requires cashier role or higher
- Keyboard shortcuts: F2 (pay), F3 (hold), Esc (clear)

### 6. Kitchen Display
- Access at `/kitchen` route
- Real-time order updates
- Status management

### 7. Attendance System

#### GPS Check-in
- Configure location in `.env`:
  ```
  NEXT_PUBLIC_RESTAURANT_LAT=31.7131
  NEXT_PUBLIC_RESTAURANT_LNG=73.9724
  NEXT_PUBLIC_ATTENDANCE_RADIUS_METERS=100
  ```

#### QR Code Check-in
- Change the default secret in `.env`:
  ```
  ATTENDANCE_QR_SECRET=your-unique-secret-here
  ```

---

## 🌐 Deployment

### Vercel (Recommended)

1. Push your code to GitHub (excluding .env)
2. Import project to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy!

### Environment Variables for Production

Add these in your hosting platform:
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID`
- `IMGBB_API_KEY`
- `NEXT_PUBLIC_RESTAURANT_LAT`
- `NEXT_PUBLIC_RESTAURANT_LNG`
- `NEXT_PUBLIC_ATTENDANCE_RADIUS_METERS`
- `ATTENDANCE_QR_SECRET`

---

## 🆘 Troubleshooting

### "Firebase not configured" error
- Check that all `NEXT_PUBLIC_FIREBASE_*` variables are set in `.env`
- Restart the development server after changing `.env`

### Image upload failing
- Verify `IMGBB_API_KEY` is correct in `.env`
- Check ImgBB API quota/limits

### Login not working
- Verify user exists in Firebase Authentication
- Check Firestore `users/{uid}` document exists
- Verify `role` field is set correctly

### Attendance GPS not working
- Check browser location permissions
- Verify `NEXT_PUBLIC_RESTAURANT_LAT/LNG` are correct
- Adjust `NEXT_PUBLIC_ATTENDANCE_RADIUS_METERS` if needed

### Build errors
```bash
# Clear Next.js cache
rm -rf .next
npm run build
```

---

## 📞 Support

For detailed documentation, see:
- `README.md` - Overview
- `UI_IMPROVEMENTS.md` - UI changes
- `DESIGN_SYSTEM.md` - Design guidelines
- `CHANGELOG.md` - Version history
- `docs/` - Additional documentation

---

## ✅ Setup Checklist

- [ ] Cloned repository
- [ ] Created `.env` file from `.env.example`
- [ ] Added ImgBB API key to `.env`
- [ ] Ran `npm install`
- [ ] Deployed Firestore rules
- [ ] Deployed Firestore indexes
- [ ] Created super admin user in Firebase
- [ ] Started development server (`npm run dev`)
- [ ] Logged in successfully at `/login`
- [ ] Verified admin dashboard access
- [ ] Tested image upload
- [ ] Created test menu items
- [ ] Created test deal

---

**Your Firebase project is ready!** 🎉

Project ID: `respos-4f3f4`  
Console: [https://console.firebase.google.com/project/respos-4f3f4](https://console.firebase.google.com/project/respos-4f3f4)

Just get your ImgBB key and create your admin user to get started!
