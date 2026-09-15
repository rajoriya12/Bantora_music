# Player Controls Enhancement — Requirements

## Feature Name
Advanced Playback Controls + Admin Panel Fix

## Problem Statement
1. **Admin panel crashes on Vercel** — trying to write files to read-only filesystem (EROFS error)
2. **Missing player controls** — no shuffle, repeat, or mix-all-playlists modes
3. **Users want flexibility** — play single playlist OR mix all playlists randomly

## User Stories

### As a site visitor (Vercel deployment)
- I want to see a helpful message when admin panel doesn't work on Vercel
- So I understand it's a platform limitation, not a bug

### As a music listener
- I want to shuffle songs within a playlist
- So I get variety and don't hear the same order every time

### As a music listener
- I want to repeat the current song or entire playlist
- So I can keep listening to my favorites

### As a music listener
- I want to mix songs from ALL playlists together
- So I get a diverse listening experience without manually switching playlists

## Functional Requirements

### FR1: Admin Panel Vercel Detection
- **MUST** detect if running on Vercel (`process.env.VERCEL === "1"`)
- **MUST** return 403 status with friendly error message
- **MUST** show this message in admin UI: "Admin panel only works locally. Run 'npm run dev' on your Mac to upload songs."
- **SHOULD NOT** crash with EROFS error

### FR2: Shuffle Mode
- **MUST** have toggle button near play controls
- **MUST** shuffle songs in current playlist when enabled
- **MUST** not repeat a song until all songs in playlist have played once
- **MUST** show visual indicator when active (purple highlight/fill)
- **MUST** persist across song changes until toggled off
- **SHOULD** use Shuffle icon from lucide-react

### FR3: Repeat Mode
- **MUST** have button that cycles through 3 states: OFF → REPEAT ALL → REPEAT ONE
- **MUST** show different visual state for each mode:
  - OFF: icon outline only
  - REPEAT ALL: icon filled/highlighted
  - REPEAT ONE: icon filled with "1" badge
- **MUST** implement behaviors:
  - OFF: stop playing at playlist end
  - REPEAT ALL: loop back to first song after last song
  - REPEAT ONE: replay current song indefinitely
- **SHOULD** use Repeat icon from lucide-react

### FR4: Mix All Playlists Mode
- **MUST** have toggle button in top bar or controls
- **MUST** combine all bundled playlists into one mega-playlist
- **MUST** shuffle the mega-playlist
- **MUST** update "Now Playing" text to show "Mix Mode" when active
- **MUST** revert to single playlist when toggled off
- **SHOULD** use Layers or Grid icon from lucide-react
- **SHOULD** work with both bundled (server) and "My Library" (user) playlists

### FR5: Autoplay
- **MUST** automatically play next song when current song ends
- (Already implemented — just verify it works correctly)

## Non-Functional Requirements

### NFR1: Performance
- Shuffle algorithm **MUST** complete in < 100ms for playlists up to 1000 songs
- Mix All mode **MUST** combine playlists in < 200ms

### NFR2: UX
- All control buttons **MUST** provide visual feedback on click/hover
- Active state **MUST** be clearly distinguishable (color, fill, or glow)
- Mode changes **MUST** feel instant (no visible lag)

### NFR3: State Management
- Shuffle/Repeat/Mix modes **SHOULD** persist in component state (no localStorage needed)
- Current song index **MUST** update correctly across all modes

## Out of Scope
- Saving shuffle/repeat preferences to localStorage
- Cross-fade between songs
- Equalizer or audio effects
- Spotify API integration (future feature)
- Keyboard shortcuts

## Acceptance Criteria

### AC1: Admin Panel (Vercel)
```
GIVEN I visit bantoramusic.vercel.app/admin
WHEN I try to upload a song
THEN I see error message "Admin panel only works locally..."
AND the page does not crash
```

### AC2: Shuffle Mode
```
GIVEN I have a playlist with 10 songs
WHEN I enable shuffle and play through all songs
THEN all 10 songs play exactly once in random order
AND the shuffle button shows active state
```

### AC3: Repeat Modes
```
GIVEN I am playing a playlist
WHEN I click repeat button 1x → Repeat All active
WHEN I click repeat button 2x → Repeat One active
WHEN I click repeat button 3x → Repeat Off
THEN behavior matches the selected mode
```

### AC4: Mix All Mode
```
GIVEN I have 3 playlists with 5, 10, 15 songs each
WHEN I enable Mix All mode
THEN I see "Mix Mode" in the Now Playing section
AND songs from all 3 playlists play in shuffled order
```

## Technical Constraints
- Must work in Next.js 14 client component
- Must use existing audio engine (`audioRef`)
- Must not require new dependencies
- Must be TypeScript strict-mode compliant

## Files to Modify
1. `/src/app/api/admin/songs/route.ts` — add Vercel detection
2. `/src/app/page.tsx` — add shuffle/repeat/mix controls and logic

