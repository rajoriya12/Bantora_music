#!/bin/bash
# Bantora iOS App — Quick Update Script
# Run: ./update.sh

echo ""
echo "🎵 Bantora Update"
echo "──────────────────"

echo "⟳  Syncing to iOS..."
npx cap sync ios

echo ""
echo "✅  Sync complete!"
echo ""
echo "👉  Ab Xcode mein Cmd + R dabao — app update ho jaayegi"
echo ""
