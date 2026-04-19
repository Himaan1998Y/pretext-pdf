#!/usr/bin/env bash
# Fetch latest master from origin and rebase current branch on top of it.
# Run this before starting work each day, or before pushing a branch.
set -e

CURRENT=$(git branch --show-current)

echo "Fetching origin..."
git fetch origin

echo "Rebasing $CURRENT onto origin/master..."
git rebase origin/master

echo "Done. $CURRENT is now up to date with master."
