# Font Loading Debugging Guide

## Problem
Fonts from `@fontsource` packages don't appear to load `.woff2` files in network requests.

## Current Setup
- **Fonts used**: Cinzel, IM Fell English (via @fontsource packages)
- **Import location**: `src/styles/playground-fonts.css` (imported in `QuestCardPlayground.tsx`)
- **Tailwind classes**: `.font-cinzel`, `.font-fell`, `.font-serif`

---

## Debugging Steps

### **Step 1: Verify CSS File is Loaded**

**In Browser DevTools (F12):**

1. Go to **Network** tab
2. Filter by "CSS" or just search for "playground"
3. Reload the playground page: `http://localhost:3000/quest-card-playground`
4. Look for: `playground-fonts.css`

**Expected**: You should see a request for `playground-fonts.css` with status 200

**If missing**: The CSS import isn't working - check the TypeScript import statement

---

### **Step 2: Check @font-face Rules Exist**

**In Browser DevTools:**

1. Go to **Elements** tab (or **Inspector** in Firefox)
2. Click on `<head>` element
3. Look for `<style>` tags or linked CSS
4. Search (Ctrl+F) for: `@font-face`

**Expected**: You should see multiple `@font-face` rules like:
```css
@font-face {
  font-family: 'Cinzel';
  font-style: normal;
  font-weight: 400;
  src: url(/node_modules/@fontsource/cinzel/files/cinzel-latin-400-normal.woff2) format('woff2');
}
```

**If missing**: The `@import '@fontsource/cinzel/400.css'` didn't work - CSS resolution issue

---

### **Step 3: Check Font File Requests**

**In Browser DevTools:**

1. Go to **Network** tab
2. **Important**: Check "Disable cache" checkbox
3. Filter by "Font" or search for "woff"
4. Reload the page
5. Look for requests like: `cinzel-latin-400-normal.woff2`

**What you should see**:

Development (Vite):
```
/@fs/home/user/majordomo/frontend/node_modules/@fontsource/cinzel/files/cinzel-latin-400-normal.woff2
```

Or possibly:
```
/node_modules/@fontsource/cinzel/files/cinzel-latin-400-normal.woff2
```

**Common Issues**:

| What you see | What it means | Solution |
|-------------|---------------|----------|
| No .woff2 requests at all | Fonts not being used OR already cached | Clear cache, hard reload (Ctrl+Shift+R) |
| 404 errors for .woff2 | Path is wrong in @font-face | Check Vite config or fontsource package |
| No @font-face rules | CSS not imported | Check import statement |
| Requests only when text visible | **This is NORMAL!** | Browser lazy-loads fonts |

---

### **Step 4: Inspect Computed Font**

**In Browser DevTools:**

1. Go to **Elements** tab
2. Inspect the "The Quick Brown Fox" text in the Font Loading Test section
3. Look at **Computed** tab (or **Layout** in some browsers)
4. Find the `font-family` property

**Expected for Cinzel**:
```
font-family: Cinzel, "Comic Sans MS", cursive
```

**Check rendered font**:
- Look at **Computed** > **Rendered Fonts** (Chrome/Edge)
- Or check Font panel in Firefox DevTools

**What you should see**:
- ✅ `Cinzel — Local file` (or `Cinzel — Network resource`)
- ❌ `Comic Sans MS` = Font failed to load!
- ❌ `Georgia` = Wrong class applied

---

### **Step 5: Font Loading Timeline**

**In Browser DevTools:**

1. Go to **Network** tab
2. Filter by "All"
3. Reload page
4. Look at the **Timeline** or **Waterfall** view

**Font loading order**:
```
1. HTML (index.html)
2. JS bundle (main.tsx compiled)
3. CSS files (including playground-fonts.css)
4. Font files (.woff2) ← These load AFTER CSS is parsed
```

**Important**: Fonts are often loaded **after** the page renders because:
- Browser waits until it knows the font is needed
- Uses `font-display: swap` (renders fallback first, swaps when loaded)

---

### **Step 6: Check Browser Font Cache**

Fonts are aggressively cached. To test fresh:

**Chrome/Edge**:
1. DevTools > Network tab
2. Check "Disable cache"
3. Right-click Reload button > "Empty Cache and Hard Reload"

**Firefox**:
1. DevTools > Network tab
2. Check "Disable cache"
3. Ctrl + Shift + R

**Or check cache directly**:
- Chrome: `chrome://cache/` (look for .woff2)
- Firefox: `about:cache`

---

## Advanced Debugging: Add Console Logging

### **Option A: Add Font Loading API**

Create `src/utils/fontDebug.ts`:

```typescript
// Add this to detect when fonts load
export function debugFontLoading() {
  if ('fonts' in document) {
    document.fonts.ready.then(() => {
      console.log('✅ All fonts loaded');
      document.fonts.forEach(font => {
        console.log(`Font: ${font.family} ${font.weight} ${font.style} - ${font.status}`);
      });
    });

    // Listen for individual font loads
    document.fonts.addEventListener('loadingdone', (event) => {
      console.log('Font loading done:', event);
    });

    document.fonts.addEventListener('loadingerror', (event) => {
      console.error('❌ Font loading error:', event);
    });
  }
}
```

Then in `QuestCardPlayground.tsx`, add:
```typescript
import { debugFontLoading } from '../utils/fontDebug';

useEffect(() => {
  debugFontLoading();
}, []);
```

### **Option B: Check Computed Styles**

Add this to playground component:

```typescript
useEffect(() => {
  const testEl = document.querySelector('.font-cinzel');
  if (testEl) {
    const computed = window.getComputedStyle(testEl);
    console.log('Computed font-family:', computed.fontFamily);
    console.log('Computed font-weight:', computed.fontWeight);
  }
}, []);
```

---

## Common Scenarios & Solutions

### **Scenario 1: No .woff2 requests, fonts look normal**

**Diagnosis**: Fonts are cached
**Solution**: Hard reload with cache disabled

### **Scenario 2: No .woff2 requests, Comic Sans shows**

**Diagnosis**: @font-face rules missing
**Solution**:
- Check `playground-fonts.css` is imported
- Verify fontsource packages are installed: `bun install`
- Check browser console for CSS errors

### **Scenario 3: .woff2 requests with 404 errors**

**Diagnosis**: Vite can't resolve font file paths
**Solution**:
- Check node_modules/@fontsource exists
- Try: `rm -rf node_modules && bun install`
- Check Vite config for asset handling

### **Scenario 4: Fonts load but look wrong**

**Diagnosis**: Wrong font-family or weight
**Solution**:
- Inspect element > Computed tab > Check actual font used
- Verify Tailwind config matches @fontsource import

### **Scenario 5: Fonts work locally but not in production**

**Diagnosis**: Build process issue
**Solution**:
- Check `dist/assets/` has .woff2 files after build
- Verify base path in Vite config
- Check server MIME types for .woff2

---

## Production Build Check

Run build and inspect output:

```bash
cd frontend
bun run build
ls -la dist/assets/*.woff2
```

You should see:
```
cinzel-latin-400-normal-[hash].woff2
im-fell-english-latin-400-normal-[hash].woff2
```

Check the built CSS:
```bash
grep -A 5 "@font-face" dist/assets/*.css
```

Should show `src: url(./cinzel-latin-400-normal-[hash].woff2)`

---

## Quick Test Checklist

- [ ] `bun install` completed successfully
- [ ] Dev server running on port 3000
- [ ] Navigate to `/quest-card-playground`
- [ ] DevTools Network tab open
- [ ] Cache disabled in Network tab
- [ ] Hard reload (Ctrl+Shift+R)
- [ ] Filter by "Font" or "woff"
- [ ] Check if .woff2 files appear
- [ ] Inspect "Quick Brown Fox" text
- [ ] Check Computed > Rendered Fonts
- [ ] Text should NOT be in Comic Sans

---

## Expected Results (Success)

✅ Network tab shows:
```
playground-fonts.css             200  OK
cinzel-latin-400-normal.woff2    200  OK  (14KB)
cinzel-latin-500-normal.woff2    200  OK  (14KB)
im-fell-english-latin-400...     200  OK  (22KB)
```

✅ Elements tab shows `@font-face` rules in CSS

✅ Computed fonts panel shows:
```
Cinzel — Local file (or Network resource)
```

✅ Visual result: Text looks decorative/medieval, NOT Comic Sans

---

## Next Steps Based on Findings

1. **If fonts load correctly**: You were just looking at the wrong time or cached version
2. **If @font-face is missing**: CSS import chain is broken
3. **If 404 on .woff2**: Vite can't resolve fontsource paths
4. **If Comic Sans shows**: Font files aren't loading or @font-face isn't working

Report back what you see in each step and I can help diagnose further!
