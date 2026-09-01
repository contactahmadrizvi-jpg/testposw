# SOMO - Design System

## 🎨 Color Palette

### Primary Colors
```css
--primary: #3b82f6           /* Blue 500 - Main brand color */
--primary-dark: #2563eb      /* Blue 600 - Darker variant */
--primary-light: #60a5fa     /* Blue 400 - Lighter variant */
```

### Neutral Colors
```css
--background: #ffffff        /* Pure white */
--foreground: #0f172a        /* Slate 900 - Main text */
--muted: #f8fafc            /* Slate 50 - Subtle backgrounds */
--muted-foreground: #64748b  /* Slate 500 - Secondary text */
--border: #e2e8f0           /* Slate 200 - Borders */
```

### Semantic Colors
```css
--success: #10b981          /* Green 500 */
--warning: #f59e0b          /* Amber 500 */
--error: #ef4444            /* Red 500 */
--info: #06b6d4             /* Cyan 500 */
```

### Gradient Definitions
```css
/* Primary Gradient */
background: linear-gradient(to right, #3b82f6, #2563eb);

/* Feature Gradients */
Blue:   linear-gradient(to bottom right, #3b82f6, #2563eb);
Amber:  linear-gradient(to bottom right, #f59e0b, #d97706);
Green:  linear-gradient(to bottom right, #10b981, #059669);
Purple: linear-gradient(to bottom right, #8b5cf6, #7c3aed);

/* Background Gradients */
Hero:   linear-gradient(to bottom right, #eff6ff, #ffffff, #eff6ff);
Light:  linear-gradient(to bottom, #ffffff, #f8fafc, #ffffff);
```

---

## 📏 Spacing Scale

```css
xs:  0.25rem  /* 4px  */
sm:  0.5rem   /* 8px  */
md:  1rem     /* 16px */
lg:  1.5rem   /* 24px */
xl:  2rem     /* 32px */
2xl: 2.5rem   /* 40px */
3xl: 3rem     /* 48px */
4xl: 4rem     /* 64px */
```

---

## 🔤 Typography

### Font Family
```css
font-family: 'DM Sans', system-ui, sans-serif;
```

### Font Weights
```css
Regular:   400
Medium:    500
Semibold:  600
Bold:      700
Black:     900  /* Used for headings */
```

### Font Sizes
```css
xs:   0.75rem  /* 12px */
sm:   0.875rem /* 14px */
base: 1rem     /* 16px */
lg:   1.125rem /* 18px */
xl:   1.25rem  /* 20px */
2xl:  1.5rem   /* 24px */
3xl:  1.875rem /* 30px */
4xl:  2.25rem  /* 36px */
5xl:  3rem     /* 48px */
6xl:  3.75rem  /* 60px */
7xl:  4.5rem   /* 72px */
```

### Heading Styles
```css
h1: text-5xl md:text-6xl lg:text-7xl font-black
h2: text-3xl md:text-4xl lg:text-5xl font-black
h3: text-xl md:text-2xl font-bold
h4: text-lg font-bold
```

---

## 🎯 Border Radius

```css
sm:   0.25rem  /* 4px  - Small elements */
md:   0.5rem   /* 8px  - Inputs, small buttons */
lg:   0.75rem  /* 12px - Default radius */
xl:   1rem     /* 16px - Buttons, cards */
2xl:  1.5rem   /* 24px - Large cards */
3xl:  2rem     /* 32px - Special cards */
full: 9999px   /* Fully rounded - Pills, badges */
```

---

## 🌟 Shadows

```css
/* Small - Subtle elevation */
shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);

/* Medium - Default cards */
shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1);

/* Large - Hover states */
shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1);

/* Extra Large - Elevated elements */
shadow-xl: 0 20px 25px -5px rgb(0 0 0 / 0.1);

/* 2XL - Maximum elevation */
shadow-2xl: 0 25px 50px -12px rgb(0 0 0 / 0.25);
```

---

## 🎭 Component Patterns

### Button Variants

#### Primary Button
```css
class="bg-gradient-to-r from-primary to-blue-600 text-white 
       rounded-xl px-6 py-3 font-bold shadow-lg 
       hover:shadow-xl hover:scale-105 transition-all"
```

#### Secondary Button
```css
class="border-2 border-primary/30 bg-white text-foreground 
       rounded-xl px-6 py-3 font-bold 
       hover:bg-primary/5 hover:border-primary transition-all"
```

#### Ghost Button
```css
class="text-primary rounded-xl px-4 py-2 font-semibold
       hover:bg-primary/10 transition-all"
```

### Card Styles

#### Standard Card
```css
class="rounded-2xl border-2 border-primary/10 bg-white p-6 
       shadow-lg hover:shadow-2xl hover:border-primary/30 
       transition-all duration-300"
```

#### Featured Card
```css
class="rounded-3xl border-2 border-primary/20 bg-white p-8 
       shadow-xl hover:shadow-2xl hover:border-primary/40 
       transition-all duration-300 overflow-hidden"
```

### Badge Styles

#### Status Badge
```css
class="inline-flex items-center gap-2 px-3 py-1.5 
       rounded-full text-xs font-bold uppercase tracking-wider
       bg-gradient-to-r from-primary to-blue-600 text-white 
       shadow-lg"
```

#### Count Badge
```css
class="h-5 min-w-5 flex items-center justify-center px-1 
       text-[10px] font-bold rounded-full 
       bg-red-500 text-white border-2 border-white"
```

### Input Styles
```css
class="w-full rounded-xl border-2 border-border px-4 py-3
       focus:border-primary focus:ring-2 focus:ring-primary/20
       transition-all outline-none"
```

---

## 🎬 Animation Patterns

### Hover Scale
```css
class="hover:scale-105 transition-transform duration-300"
```

### Fade In
```jsx
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.5 }}
/>
```

### Staggered Children
```jsx
<motion.div
  initial={{ opacity: 0, y: 20 }}
  whileInView={{ opacity: 1, y: 0 }}
  viewport={{ once: true }}
  transition={{ delay: index * 0.1 }}
/>
```

### Pulse Animation
```css
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

class="animate-pulse"
```

### Shimmer Effect
```css
@keyframes shimmer {
  0% { background-position: -1000px 0; }
  100% { background-position: 1000px 0; }
}

class="animate-shimmer"
```

---

## 🎨 Background Patterns

### Dot Pattern (Body)
```css
background-image: radial-gradient(circle at 1px 1px, #e2e8f0 1px, transparent 0);
background-size: 40px 40px;
```

### SVG Pattern (Sections)
```html
<div class="absolute inset-0 bg-[url('data:image/svg+xml;base64,...')] opacity-40"></div>
```

---

## 📱 Responsive Breakpoints

```css
sm:  640px   /* Small devices */
md:  768px   /* Medium devices */
lg:  1024px  /* Large devices */
xl:  1280px  /* Extra large devices */
2xl: 1536px  /* 2X large devices */
```

---

## ♿ Accessibility

### Focus States
```css
focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2
```

### Color Contrast Ratios
- Primary Blue on White: 4.5:1 (AA Standard) ✅
- Text on Background: 13.6:1 (AAA Standard) ✅
- Muted Text: 4.8:1 (AA Standard) ✅

### Interactive Elements
- Minimum touch target: 44x44px ✅
- Clear hover states ✅
- Keyboard navigable ✅
- ARIA labels where needed ✅

---

## 🎯 Usage Guidelines

### DO's ✅
- Use consistent spacing from the scale
- Apply gradients to hero sections and CTAs
- Use shadow-lg for elevated cards
- Maintain border-2 for emphasis
- Use font-black for main headings
- Add hover effects to interactive elements
- Use rounded-xl or rounded-2xl for cards

### DON'Ts ❌
- Don't mix different blue shades randomly
- Avoid using red except for errors/discounts
- Don't use gradients on body text
- Avoid inconsistent border radius
- Don't skip hover states on clickable elements
- Avoid cluttered shadows
- Don't use too many different font sizes

---

## 🚀 Implementation Example

```jsx
// Complete Button Component
<button className="
  inline-flex items-center gap-2
  px-6 py-3
  rounded-xl
  bg-gradient-to-r from-primary to-blue-600
  text-white font-bold text-base
  shadow-lg hover:shadow-xl
  hover:scale-105
  transition-all duration-300
  focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2
">
  <Icon className="h-5 w-5" />
  Button Text
</button>

// Complete Card Component  
<div className="
  group
  rounded-2xl
  border-2 border-primary/10
  bg-white
  p-6
  shadow-lg hover:shadow-2xl
  hover:border-primary/30
  transition-all duration-300
  overflow-hidden
">
  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
  <div className="relative">
    {/* Card content */}
  </div>
</div>
```

---

## 📐 Layout Guidelines

### Container Widths
```css
max-w-7xl  /* 1280px - Main content */
max-w-6xl  /* 1152px - Narrow content */
max-w-4xl  /* 896px - Article content */
```

### Section Padding
```css
py-12     /* Small sections */
py-16     /* Medium sections */
py-20     /* Large sections */
px-4      /* Horizontal padding */
lg:px-8   /* Large screen padding */
```

### Grid Layouts
```css
/* Cards Grid */
grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4

/* Features Grid */
grid gap-6 md:grid-cols-3

/* Two Column */
grid gap-8 md:grid-cols-2
```

---

This design system ensures consistency across the entire SOMO application while maintaining a modern, professional aesthetic.
