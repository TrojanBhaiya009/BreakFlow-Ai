#!/bin/bash

# 1. Stop tracking the backend/.env file (keeps it safe on your local disk)
echo "1. Removing backend/.env from Git tracking..."
git rm --cached backend/.env 2>/dev/null || echo "backend/.env already untracked or not found in git index."

# 2. Handle the nested frontend repository to merge it into the main repo
if [ -d "frontend/.git" ]; then
    echo "2. Found nested Git repository inside 'frontend/'. Removing it to merge frontend into the main repository..."
    # Remove the cached submodule/nested repo reference from Git index
    git rm --cached frontend -f 2>/dev/null
    # Delete the nested .git folder
    rm -rf frontend/.git
    # Stage the frontend folder in the main repository
    git add frontend
else
    echo "2. No nested frontend/.git found."
fi

# 3. Add root .gitignore and stage other files
echo "3. Staging .gitignore and updating index..."
git add .gitignore
git add -A

# 4. Create a clean commit
echo "4. Committing changes..."
git commit -m "chore: untrack .env, add root .gitignore, and merge frontend"

echo ""
echo "--------------------------------------------------------"
echo "Success! The sensitive .env file is no longer tracked."
echo "You can now push to GitHub using:"
echo "  git push origin main"
echo "--------------------------------------------------------"
