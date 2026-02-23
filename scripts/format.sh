#!/bin/bash

# Code formatting script

echo "🎨 Code Formatting"
echo "=================="

CHECK_ONLY=false
FIX_FORMATTING=false

for arg in "$@"; do
  case $arg in
    --check)
      CHECK_ONLY=true
      shift
      ;;
    --fix)
      FIX_FORMATTING=true
      shift
      ;;
  esac
done

if [ "$CHECK_ONLY" = true ]; then
  echo "Checking code formatting..."
  npx prettier --check "src/**/*.ts" "__tests__/**/*.ts" "*.ts" "*.json" "*.md"
  EXIT_CODE=$?
  if [ $EXIT_CODE -eq 0 ]; then
    echo "✅ All files are properly formatted!"
  else
    echo "❌ Some files need formatting. Run 'npm run format' to fix them."
  fi
  exit $EXIT_CODE
elif [ "$FIX_FORMATTING" = true ]; then
  echo "Fixing code formatting..."
  npx prettier --write "src/**/*.ts" "__tests__/**/*.ts" "*.ts" "*.json" "*.md"
  echo "✅ Code formatting applied!"
else
  npx prettier --check "src/**/*.ts" "__tests__/**/*.ts" "*.ts" "*.json" "*.md" && echo "✅ All files formatted" || echo "Run 'npm run format' to fix"
  exit $?
fi
