#!/bin/bash
# ارسال سورس برنامه به گیت‌هاب — https://github.com/kyanoosh27993/hotel-webapp
# استفاده:  bash push-to-github.sh  <TOKEN>
# TOKEN = یک Personal Access Token از GitHub (Settings → Developer settings → Tokens)
# با دسترسی repo (Contents: Read and write)
set -e
TOKEN="${1:?Usage: bash push-to-github.sh <GITHUB_TOKEN>}"
REPO="https://kyanoosh27993:${TOKEN}@github.com/kyanoosh27993/hotel-webapp.git"
git init -q 2>/dev/null || true
git add -A
git -c user.name="Arian Kavir Rafsanjan" -c user.email="kyanoosh27993@users.noreply.github.com" \
  commit -m "v0.7.0 — سامانه حقوق و دستمزد (سورس کامل)" || true
git branch -M main
git remote remove hotel 2>/dev/null || true
git remote add hotel "$REPO"
git push -u hotel main --force
echo "✓ سورس به github.com/kyanoosh27993/hotel-webapp ارسال شد"
