#!/bin/bash

echo "1. Deleting local Git history (.git folder)..."
rm -rf .git

echo "2. Re-initializing Git repository..."
git init -b main

echo "3. Adding remote origin..."
git remote add origin https://github.com/TrojanBhaiya009/BreakFlow-Ai.git

echo "4. Staging files (this will respect the root .gitignore)..."
git add .

echo "5. Creating a clean initial commit..."
git commit -m "initial commit"

echo ""
echo "--------------------------------------------------------"
echo "Git history reset successfully!"
echo "You can now push to GitHub using:"
echo "  git push origin main --force"
echo "--------------------------------------------------------"
