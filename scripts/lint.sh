#!/bin/bash

# Linting script

echo "🔍 Linting"
echo "=========="

CHECK_ONLY=false

for arg in "$@"; do
  case $arg in
    --check)
      CHECK_ONLY=true
      shift
      ;;
  esac
done

if [ "$CHECK_ONLY" = true ]; then
  echo "Checking lint (no fixes)..."
  npx eslint "src/**/*.ts" "__tests__/**/*.ts" --max-warnings 0
else
  echo "Linting with auto-fix..."
  npx eslint "src/**/*.ts" "__tests__/**/*.ts" --fix
fi

EXIT_CODE=$?
if [ $EXIT_CODE -eq 0 ]; then
  echo "✅ Lint passed!"
else
  echo "❌ Lint failures detected."
fi
exit $EXIT_CODE
