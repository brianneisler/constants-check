#!/bin/bash

# TypeScript type checking script

echo "🔍 TypeScript Type Checking"
echo "==========================="

npx tsc --noEmit

EXIT_CODE=$?
if [ $EXIT_CODE -eq 0 ]; then
  echo "✅ Type check passed!"
else
  echo "❌ Type errors detected."
fi
exit $EXIT_CODE
