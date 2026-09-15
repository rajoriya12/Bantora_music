# Player Controls Enhancement — Tasks

## Task 1: Fix Admin Panel Vercel Error
**File:** `/src/app/api/admin/songs/route.ts`

### Subtasks:
1.1. Add Vercel environment check at start of POST handler
1.2. Return 403 response with friendly message if on Vercel
1.3. Test locally (should still work)
1.4. Deploy and test on Vercel (should show error)

### Acceptance:
- ✅ No EROFS crash on Vercel
- ✅ Error message displays: "Admin panel only works locally. Run 'npm run dev' on your Mac to upload songs."
- ✅ Admin panel still works on localhost

---

## Task 2: Add Shuffle State and Logic
**File:** `/src/app/page.tsx`

### Subtasks:
2.1. Add state: `const [shuffleMode, setShuffleMode] = useState(false)`
2.2. Add state: `const [shuffledIndices, setShuffledIndices] = useState<number[]>([])`
2.3. Create `shuffleArray()` helper function (Fisher-Yates)
2.4. Create `toggleShuffle()` function:
     - Toggle shuffleMode
     - If ON: generate shuffledIndices
     - If OFF: clear shuffledIndices
2.5. Modify `handleNext()` to use shuffledIndices when shuffleMode is ON
2.6. Import `Shuffle` icon from lucide-react

### Acceptance:
- ✅ Shuffle mode state toggles correctly
- ✅ Shuffled playback uses random order
- ✅ No duplicate songs until all played once

---

## Task 3: Add Shuffle Button UI
**File:** `/src/app/page.tsx`

### Subtasks:
3.1. Add shuffle button in control pill (left of Prev button)
3.2. Wire onClick to `toggleShuffle()`
3.3. Add conditional styling:
     - Inactive: `text-white/40`
     - Active: `text-purple-400` + glow effect
3.4. Add hover effect and scale transition
3.5. Add `title` attribute: "Shuffle"

### Acceptance:
- ✅ Button appears in correct position
- ✅ Active state is visually distinct (purple glow)
- ✅ Hover feedback works

---

## Task 4: Add Repeat State and Logic
**File:** `/src/app/page.tsx`

### Subtasks:
4.1. Add state: `const [repeatMode, setRepeatMode] = useState<"off" | "all" | "one">("off")`
4.2. Create `cycleRepeat()` function:
     - Cycles: off → all → one → off
4.3. Modify audio `onEnded` event listener:
     - IF repeatMode === "one": replay current song
     - ELSE: call handleNext()
4.4. Modify `handleNext()`:
     - IF at last song AND repeatMode === "all": loop to index 0
     - IF at last song AND repeatMode === "off": stop playing
4.5. Import `Repeat` icon from lucide-react

### Acceptance:
- ✅ Repeat OFF: stops at playlist end
- ✅ Repeat ALL: loops playlist
- ✅ Repeat ONE: replays current song

---

## Task 5: Add Repeat Button UI
**File:** `/src/app/page.tsx`

### Subtasks:
5.1. Add repeat button in control pill (right of Next button)
5.2. Wire onClick to `cycleRepeat()`
5.3. Add conditional styling for 3 states:
     - OFF: `text-white/40`
     - ALL: `text-purple-400` + glow
     - ONE: `text-purple-400` + glow + "1" badge overlay
5.4. Implement badge overlay (small circle with "1" text)
5.5. Add `title` attribute based on mode: "Repeat: Off/All/One"

### Acceptance:
- ✅ Button cycles through 3 visual states
- ✅ "1" badge appears only in Repeat ONE mode
- ✅ Tooltip shows current mode

---

## Task 6: Add Mix All State and Logic
**File:** `/src/app/page.tsx`

### Subtasks:
6.1. Add state: `const [mixAllMode, setMixAllMode] = useState(false)`
6.2. Create `toggleMixAll()` function:
     - Toggle mixAllMode
     - IF ON: combine all folder playlists into megaPlaylist
     - Load megaPlaylist into songs[]
     - Set currentFolder to "__MIX_ALL__"
     - Reset currentSongIndex to 0
     - IF shuffleMode ON: shuffle megaPlaylist
     - IF OFF: revert to first folder's playlist
6.3. Modify top bar "Now Playing" text:
     - IF mixAllMode: show "Mix Mode"
     - ELSE: show folderInfo[currentFolder]
6.4. Import `Layers` icon from lucide-react

### Acceptance:
- ✅ Mix All combines songs from all playlists
- ✅ "Mix Mode" displays in Now Playing section
- ✅ Toggling off reverts to single playlist

---

## Task 7: Add Mix All Button UI
**File:** `/src/app/page.tsx`

### Subtasks:
7.1. Add Mix All button in top bar (left of Library button)
7.2. Wire onClick to `toggleMixAll()`
7.3. Add conditional styling:
     - Inactive: `text-white/50`
     - Active: `text-purple-400` + purple ring
7.4. Add hover effect
7.5. Add `title` attribute: "Mix All Playlists"

### Acceptance:
- ✅ Button appears in top bar
- ✅ Active state shows purple ring
- ✅ Clicking toggles mode correctly

---

## Task 8: Integration Testing

### Subtasks:
8.1. Test Shuffle + Repeat All: verify songs loop in new shuffle order
8.2. Test Mix All + Shuffle: verify mega-playlist is shuffled
8.3. Test Repeat ONE + Next button: verify it skips to next song
8.4. Test all mode combinations with ≥3 songs
8.5. Test on mobile (touch targets, responsive layout)

### Acceptance:
- ✅ All mode combinations work correctly
- ✅ No visual glitches or layout breaks
- ✅ Buttons are tap-able on mobile

---

## Task 9: Build and Deploy

### Subtasks:
9.1. Run `npm run build` locally
9.2. Fix any TypeScript errors
9.3. Test in production build mode (`npm start`)
9.4. Commit changes: "feat: add shuffle, repeat, mix-all modes + fix admin panel Vercel error"
9.5. Push to GitHub (triggers Vercel deploy)
9.6. Verify deployment on bantoramusic.vercel.app

### Acceptance:
- ✅ Build passes with 0 errors
- ✅ Features work on Vercel production
- ✅ Admin panel shows 403 error on Vercel

---

## Dependencies Between Tasks

```
Task 1 (Admin fix) — independent, can do first
↓
Task 2 (Shuffle logic) → Task 3 (Shuffle UI)
↓
Task 4 (Repeat logic) → Task 5 (Repeat UI)
↓
Task 6 (Mix All logic) → Task 7 (Mix All UI)
↓
Task 8 (Integration testing)
↓
Task 9 (Deploy)
```

## Estimated Time
- Task 1: 15 min
- Task 2-3: 30 min
- Task 4-5: 45 min
- Task 6-7: 45 min
- Task 8: 30 min
- Task 9: 15 min

**Total:** ~3 hours

