# SOMO — Modern Restaurant Management System

Enterprise-grade restaurant platform for **SOMO**, a modern dining experience with comprehensive management tools.

## Stack

- **Next.js 15** App Router + TypeScript
- **Firebase** Auth + Firestore
- **ImgBB** image uploads
- **Zustand**, Tailwind CSS, shadcn-style UI, Recharts, Framer Motion, PWA

## Modules

| Module | Route |
|--------|-------|
| Customer website | `/home`, `/menu`, `/cart`, `/checkout` |
| Admin dashboard | `/admin` |
| POS | `/pos` |
| Kitchen (KOT) | `/kitchen` |
| Attendance (GPS/QR) | `/admin/attendance` |

## Features

✨ **Modern UI** - Clean white theme with blue gradient accents  
🍕 **Online Ordering** - Full-featured customer ordering system  
💳 **POS System** - Complete point-of-sale with receipt printing  
📊 **Admin Dashboard** - Comprehensive restaurant management  
👨‍🍳 **Kitchen Display** - Real-time order management for kitchen staff  
📦 **Inventory Management** - Auto stock tracking with recipes  
👥 **Employee Management** - Attendance, roles, and permissions  
📈 **Reports & Analytics** - Sales, revenue, and performance tracking

## Setup

1. Copy `.env.example` → `.env.local` and fill Firebase + ImgBB keys.
2. Deploy `firestore.rules` and `firestore.indexes.json` to Firebase.
3. `npm install` && `npm run dev`
4. **Create Super Admin** (no built-in email/password — you choose in Firebase):

   See **[docs/SETUP_SUPER_ADMIN.md](docs/SETUP_SUPER_ADMIN.md)** for step-by-step.

   Quick version:
   - Firebase **Authentication** → Add user (your email + password)
   - Firestore **`users/{that-user-uid}`** → `role: "super_admin"`, `isActive: true`, etc.
   - Login at `/login` with that email and password

## POS

- Requires **customer name & phone** before payment
- Prints receipt with name, phone, order #, and timestamp
- Shortcuts: **F2** pay cash, **F3** hold, **Esc** clear

## Inventory

Link recipes to menu items in `recipes` collection. Stock auto-deducts on every order.

## Attendance

- GPS check-in within `NEXT_PUBLIC_ATTENDANCE_RADIUS_METERS` of restaurant
- QR token: `NEXT_PUBLIC_ATTENDANCE_QR_TOKEN`

## Production

```bash
npm run build
npm start
```

## Design System

**Color Palette:**
- Primary: Blue (#3b82f6)
- Accents: Gradient blue tones
- Background: Clean white with subtle dot pattern
- Text: Slate gray scale

**Typography:**
- Font: DM Sans
- Headings: Black weight with gradients
- Body: Regular to semibold
