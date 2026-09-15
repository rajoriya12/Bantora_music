# Player Controls Enhancement — Design

## Overview
Add shuffle, repeat, and mix-all-playlists controls to the Bantora music player, plus fix admin panel Vercel error.

## Architecture

### Component Structure
```
MusicPlayer (page.tsx)
├── State
│   ├── Existing: folders, songs, currentSongIndex, isPlaying
│   ├── NEW: shuffleMode (boolean)
│   ├── NEW: repeatMode ("off" | "all" | "one")
│   ├── NEW: mixAllMode (boolean)
│   └── NEW: shuffledIndices (number[]) — mapping for shuffle playback
│
├── Functions
│   ├── Existing: togglePlay, handleNext, handlePrev
│   ├── NEW: toggleShuffle() — enable/disable shuffle, regenerate shuffledIndices
│   ├── NEW: cycleRepeat() — OFF → ALL → ONE → OFF
│   ├── NEW: toggleMixAll() — combine all playlists or revert to single
│   ├── MODIFIED: handleNext() — respect shuffle + repeat modes
│   └── MODIFIED: audio.onEnded — check repeatOne first, then call handleNext
│
└── UI
    ├── Top bar: show "Mix Mode" when mixAllMode=true
    ├── Control pill: add 3 buttons (shuffle, repeat, mix) near play/pause
    └── Active state styling: purple fill/glow for active buttons
```

### Admin API Structure
```typescript
// /api/admin/songs/route.ts
POST handler
├── Check process.env.VERCEL
│   ├── IF true → return 403 + friendly message
│   └── ELSE → proceed with file write logic
```

## Data Flow

### Shuffle Mode
```
User clicks shuffle button
↓
toggleShuffle()
├── shuffleMode = !shuffleMode
├── IF shuffleMode ON
│   ├── Generate shuffledIndices = [0..songs.length-1] randomly sorted
│   └── currentSongIndex stays same (current song continues)
└── ELSE
    └── Clear shuffledIndices, reset to sequential playback
↓
handleNext() uses shuffledIndices[currentSongIndex] to pick next song
```

### Repeat Mode
```
User clicks repeat button
↓
cycleRepeat()
├── IF repeatMode === "off" → set to "all"
├── IF repeatMode === "all" → set to "one"
└── IF repeatMode === "one" → set to "off"
↓
audio.onEnded event
├── IF repeatMode === "one" → audio.currentTime = 0; audio.play()
├── ELSE → handleNext()
    ├── IF at last song AND repeatMode === "all" → loop to index 0
    └── IF at last song AND repeatMode === "off" → stop playing
```

### Mix All Mode
```
User clicks "Mix All" button
↓
toggleMixAll()
├── mixAllMode = !mixAllMode
├── IF mixAllMode ON
│   ├── Combine songs from all folders into megaPlaylist[]
│   ├── setSongs(megaPlaylist)
│   ├── setCurrentSongIndex(0)
│   └── setCurrentFolder("__MIX_ALL__") — special marker
├── ELSE
│   ├── Revert to first folder in folders[]
│   └── Load its playlist.json normally
└── IF shuffleMode also ON → shuffle the megaPlaylist
```

## UI Design

### Control Pill Layout (Bottom)
```
[Before]
[ < ]  [ ▶️ ]  [ > ]

[After]
[ 🔀 ]  [ < ]  [ ▶️ ]  [ > ]  [ 🔁 ]

Where:
🔀 = Shuffle button (left of Prev)
🔁 = Repeat button (right of Next)
```

### Mix All Button Placement
**Option A:** Top bar (next to Library button)
```
[Now Playing]              [Mix] [Library]
```

**Option B:** Inside Library panel (at top, before Playlists section)
```
Library
[x]

[ Mix All Playlists ] ← Toggle button

Playlists
[cover] [cover] [cover]
```

**Decision:** Use Option A — top bar placement for quick access

### Button States

#### Shuffle Button
- **Inactive:** `<Shuffle className="w-5 h-5 text-white/40" />`
- **Active:** `<Shuffle className="w-5 h-5 text-purple-400" />` + subtle glow

#### Repeat Button
- **Off:** `<Repeat className="w-5 h-5 text-white/40" />`
- **All:** `<Repeat className="w-5 h-5 text-purple-400" />` + glow
- **One:** `<Repeat className="w-5 h-5 text-purple-400" />` + small "1" badge overlay

#### Mix All Button
- **Inactive:** `<Layers className="w-4 h-4 text-white/50" />`
- **Active:** `<Layers className="w-4 h-4 text-purple-400" />` + purple ring around button

## Edge Cases

### EC1: Shuffle + Repeat One
- **Behavior:** Song replays infinitely, shuffle has no effect until user skips manually

### EC2: Mix All + Empty "My Library"
- **Behavior:** Only include bundled playlists in mix (skip empty user playlists)

### EC3: Shuffle with 1 song
- **Behavior:** Shuffle button disabled or no effect (can't shuffle 1 item)

### EC4: Last song + Repeat Off
- **Behavior:** Stop playing, show paused state

### EC5: Admin panel on localhost
- **Behavior:** Works normally, no Vercel error

## Algorithm: Fisher-Yates Shuffle
```typescript
function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
```

## State Transitions

### Normal Playback (no modes active)
```
Song 1 → Song 2 → Song 3 → END (stop)
```

### Shuffle ON
```
Song 1 → Song 5 → Song 2 → Song 4 → Song 3 → END
```

### Repeat All ON
```
Song 1 → Song 2 → Song 3 → Song 1 → Song 2 → ... (infinite)
```

### Repeat One ON
```
Song 1 → Song 1 → Song 1 → ... (infinite, until user skips)
```

### Shuffle + Repeat All
```
Song 3 → Song 1 → Song 5 → Song 2 → Song 4 → [back to shuffled order] → ...
```

### Mix All + Shuffle
```
Playlist A songs + Playlist B songs + Playlist C songs
→ Shuffled together
→ Play all once
→ END (or loop if Repeat All)
```

## Testing Strategy

### Unit Tests (manual verification)
1. Shuffle: play 5+ songs, verify no immediate repeats
2. Repeat Off: reaches end and stops
3. Repeat All: loops back to start
4. Repeat One: replays same song
5. Mix All: songs from multiple playlists appear
6. Admin panel on Vercel: returns 403

### Integration Tests
1. Shuffle + Repeat All: all songs play, then loop in new shuffle order
2. Mix All + Shuffle: mega-playlist is properly shuffled
3. Mode changes mid-song: current song continues playing

## Performance Considerations

### Shuffle Generation
- **Worst case:** 1000 songs × O(n) = ~1000 operations (~1ms)
- **Acceptable** ✅

### Mix All Combination
- **Worst case:** 10 playlists × 100 songs each = 1000 songs
- **Array concatenation:** O(n) = ~1ms
- **Acceptable** ✅

### Memory
- shuffledIndices array: 1000 integers × 8 bytes = 8KB
- **Negligible** ✅

## Accessibility

- All buttons have `title` attribute for tooltips
- Active state uses color + opacity change (not color alone)
- Keyboard navigation: not required for v1 (mouse/touch only)

## Browser Compatibility

- Fisher-Yates shuffle: ES5+ (all modern browsers)
- Array spread syntax: ES2015+ (all modern browsers)
- No special APIs needed

## Rollout Plan

### Phase 1: Admin Panel Fix (low risk)
- Add Vercel detection to `/api/admin/songs/route.ts`
- Deploy to Vercel
- Verify 403 error appears correctly

### Phase 2: Shuffle + Repeat (medium risk)
- Add shuffle/repeat state + buttons
- Implement shuffle logic
- Implement repeat logic
- Test locally

### Phase 3: Mix All (high risk)
- Add Mix All button
- Implement playlist combination
- Test with multiple playlists
- Deploy to Vercel

## Success Metrics

- **Admin panel:** 0 EROFS errors in Vercel logs after deploy
- **Shuffle:** User can play through playlist without hearing same song twice
- **Repeat:** All 3 modes work as expected (manual QA)
- **Mix All:** Songs from ≥2 playlists appear in playback

## Open Questions

1. **Should shuffle re-shuffle after reaching end in Repeat All mode?**
   - **Decision:** YES — generate new shuffle order each loop

2. **Should Mix All include "My Library" playlists?**
   - **Decision:** YES — include both bundled and user playlists

3. **Should modes persist across page refresh?**
   - **Decision:** NO — reset to defaults on refresh (simpler for v1)

