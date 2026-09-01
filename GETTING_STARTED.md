# 🚀 Getting Started with SOMO

## What You Need to Do Next

### ⚡ Quick Start (5 minutes)

#### 1. Get ImgBB API Key
Your Firebase is already configured! You just need an image upload API:

1. Visit: [https://api.imgbb.com/](https://api.imgbb.com/)
2. Click **"Get API Key"** (free)
3. Sign up with email
4. Copy your API key
5. Open `.env` file and replace:
   ```
   IMGBB_API_KEY=your_imgbb_api_key_here
   ```
   with your actual key

#### 2. Install & Run
```bash
npm install
npm run dev
```

#### 3. Create Your Admin Account

##### Option A: Quick (Using Firebase Console)
1. Go to: https://console.firebase.google.com/project/respos-4f3f4
2. **Authentication** → **Users** → **Add user**
   - Email: your-email@example.com
   - Password: Choose a strong password
   - Click **Add user**
   - **Copy the User UID** (long string like `abc123xyz...`)

3. **Firestore Database** → **users** collection
   - Click **Add document**
   - Document ID: Paste the **User UID** from step 2
   - Add these fields:
     ```
     uid: "paste-your-uid-here"
     email: "your-email@example.com"
     displayName: "Your Name"
     role: "super_admin"
     isActive: true
     createdAt: [Click "use timestamp"]
     ```
   - Click **Save**

##### Option B: Detailed Guide
See `docs/SETUP_SUPER_ADMIN.md` for step-by-step instructions with screenshots.

#### 4. Login & Start Using
1. Open: http://localhost:3000/login
2. Login with your email and password
3. You're in! 🎉

---

## 🎯 What's Already Done

✅ **Complete UI Redesign** - Modern white theme with blue accents  
✅ **Rebranded to "SOMO"** - Professional restaurant system  
✅ **Firebase Connected** - Your project `respos-4f3f4` is configured  
✅ **Environment Setup** - `.env` file created with your Firebase config  
✅ **All Dependencies** - Ready to `npm install`  

---

## 📋 Current Status

| Item | Status | Action Needed |
|------|--------|---------------|
| Firebase Config | ✅ Done | None |
| UI Redesign | ✅ Done | None |
| Rebranding | ✅ Done | None |
| .env File | ✅ Created | Add ImgBB key |
| ImgBB Setup | ⏳ Pending | Get free API key |
| Super Admin | ⏳ Pending | Create in Firebase |
| Firestore Rules | ⏳ Optional | Deploy if needed |

---

## 🎨 What Changed

### Visual Transformation
- **Old**: Red/orange theme with "Rush Pizza and Burger"
- **New**: Blue gradient theme with "SOMO"
- Modern white background with subtle patterns
- Enhanced animations and interactions
- Professional typography with gradients

### Files Updated
✅ 14 files modified with new theme and branding  
✅ 5 documentation files created  
✅ Complete design system implemented  

---

## 🏃 Next Steps

### Immediate (Required)
1. ⚡ Get ImgBB API key (5 minutes)
2. 📝 Create super admin user (5 minutes)
3. 🚀 Run `npm install && npm run dev`

### After First Login
4. 🍕 Add menu categories (Admin → Menu)
5. 📸 Upload menu items with images
6. 💰 Create deals and promotions
7. 👥 Add employees and assign roles
8. 📦 Set up inventory items (optional)
9. ✅ Test POS system at `/pos`
10. 👨‍🍳 Test kitchen display at `/kitchen`

---

## 📚 Documentation

- **SETUP_GUIDE.md** - Complete setup instructions
- **README.md** - Project overview
- **UI_IMPROVEMENTS.md** - What changed in UI
- **DESIGN_SYSTEM.md** - Design guidelines
- **CHANGELOG.md** - Version history
- **docs/SETUP_SUPER_ADMIN.md** - Admin creation guide

---

## 🔑 Your Firebase Project

**Project ID**: `respos-4f3f4`  
**Console**: https://console.firebase.google.com/project/respos-4f3f4  
**Auth Domain**: respos-4f3f4.firebaseapp.com  

All credentials are in your `.env` file (already configured).

---

## ⚠️ Important Notes

### Security
- ✅ `.env` is in `.gitignore` - Safe from version control
- ⚠️ Never share your `.env` file
- ⚠️ Never commit Firebase keys to GitHub
- ✅ Use environment variables in production

### ImgBB API
- Free tier: 100 uploads per hour
- Upgrade if you need more
- Images are hosted on ImgBB servers

### Firebase Free Tier
- Generous limits for small-medium restaurants
- Monitor usage in Firebase Console
- Upgrade to Blaze plan if needed

---

## 🆘 Need Help?

### Common Issues

**"Firebase not configured"**
- Solution: Make sure all `NEXT_PUBLIC_FIREBASE_*` variables are in `.env`
- Restart dev server after changing `.env`

**Image upload failing**
- Solution: Check `IMGBB_API_KEY` in `.env`
- Verify API key is active on ImgBB

**Can't login**
- Solution: Check user exists in Firebase Authentication
- Verify `users/{uid}` document in Firestore has correct `role`

**Permission denied**
- Solution: Deploy `firestore.rules` to Firebase
- Check user `role` field in Firestore

---

## 🎉 You're Almost Ready!

Just 2 quick tasks:
1. Get ImgBB key (free, 5 minutes)
2. Create admin user (5 minutes)

Then you're ready to manage your restaurant! 🍔

---

**Questions?** Check the documentation files or Firebase Console for more details.

**Ready to start?** Run:
```bash
npm install
npm run dev
```
