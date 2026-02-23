#!/bin/bash

# Development Workflow Script
# Runs quality checks with auto-fixing

echo "🤖 AI Development Workflow"
echo "=========================="
echo ""

AUTO_FIX=false
SKIP_TESTS=false
VERBOSE=false
FAIL_FAST=true

for arg in "$@"; do
  case $arg in
    --auto-fix)
      AUTO_FIX=true
      shift
      ;;
    --skip-tests)
      SKIP_TESTS=true
      shift
      ;;
    --verbose)
      VERBOSE=true
      shift
      ;;
    --fail-fast)
      FAIL_FAST=true
      shift
      ;;
    --no-fail-fast)
      FAIL_FAST=false
      shift
      ;;
    --help)
      echo "Usage: ./scripts/dev-workflow.sh [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --auto-fix     Automatically fix lint and format issues"
      echo "  --skip-tests   Skip running tests"
      echo "  --verbose      Show detailed output"
      echo "  --fail-fast    Exit on first failure (default)"
      echo "  --no-fail-fast Continue through all steps"
      exit 0
      ;;
  esac
done

WORKFLOW_FAILED=false

log_step() {
  echo ""
  echo "📋 Step: $1"
  echo "----------------------------------------"
}

log_result() {
  if [ $2 -eq 0 ]; then
    echo "✅ $1 - SUCCESS"
  else
    echo "❌ $1 - FAILED"
    WORKFLOW_FAILED=true
  fi
}

handle_failure() {
  local step_name="$1"
  local exit_code="$2"

  if [ $exit_code -ne 0 ] && [ "$FAIL_FAST" = true ]; then
    echo ""
    echo "🛑 FAIL-FAST: Stopping at failure in: $step_name"
    echo ""
    exit $exit_code
  fi
}

run_step() {
  local step_name="$1"
  local command="$2"

  log_step "$step_name"
  if [ "$VERBOSE" = true ]; then
    eval "$command"
  else
    eval "$command" 2>&1
  fi
  local exit_code=$?
  log_result "$step_name" $exit_code
  handle_failure "$step_name" $exit_code
  return $exit_code
}

echo "🚀 Starting development workflow..."
START_TIME=$(date +%s)

if [ "$AUTO_FIX" = true ]; then
  run_step "Code Formatting (Auto-fix)" "./scripts/format.sh --fix"
else
  run_step "Code Formatting (Check)" "./scripts/format.sh --check"
fi

if [ "$AUTO_FIX" = true ]; then
  run_step "Linting (Auto-fix)" "./scripts/lint.sh"
else
  run_step "Linting (Check)" "./scripts/lint.sh --check"
fi

run_step "Build" "npm run build"
run_step "TypeScript Type Checking" "./scripts/typecheck.sh"

if [ "$SKIP_TESTS" != true ]; then
  run_step "Tests" "./scripts/test.sh"
else
  echo ""
  echo "⏭️  Skipping tests (--skip-tests)"
fi

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo ""
echo "🏁 Development Workflow Complete"
echo "================================="
echo "Duration: ${DURATION}s"

if [ "$WORKFLOW_FAILED" = true ]; then
  echo ""
  echo "❌ WORKFLOW FAILED"
  exit 1
else
  echo ""
  echo "✅ WORKFLOW SUCCESSFUL - All checks passed!"
  echo ""
  exit 0
fi
