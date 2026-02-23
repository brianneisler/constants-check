#!/bin/bash

# Test script

echo "🧪 Running Tests"
echo "================"

COVERAGE=false

for arg in "$@"; do
  case $arg in
    --coverage)
      COVERAGE=true
      shift
      ;;
  esac
done

if [ "$COVERAGE" = true ]; then
  npx vitest run --coverage
else
  npx vitest run
fi

EXIT_CODE=$?
if [ $EXIT_CODE -eq 0 ]; then
  echo "✅ Tests passed!"
else
  echo "❌ Test failures detected."
fi
exit $EXIT_CODE
