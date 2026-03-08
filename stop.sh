#!/bin/bash

# BioOS Stop Script
echo "🛑 Stopping BioOS Platform..."

# Find and kill running processes
echo "🔍 Finding running BioOS processes..."

# Kill uvicorn (FastAPI)
UVICORN_PIDS=$(pgrep -f "uvicorn main:app")
if [ ! -z "$UVICORN_PIDS" ]; then
    echo "🖥️  Stopping FastAPI backend..."
    kill $UVICORN_PIDS 2>/dev/null
    sleep 2
    # Force kill if still running
    kill -9 $UVICORN_PIDS 2>/dev/null
fi

# Kill celery worker
CELERY_PIDS=$(pgrep -f "celery.*worker")
if [ ! -z "$CELERY_PIDS" ]; then
    echo "👷 Stopping Celery worker..."
    kill $CELERY_PIDS 2>/dev/null
    sleep 2
    # Force kill if still running
    kill -9 $CELERY_PIDS 2>/dev/null
fi

# Kill Next.js dev server
NEXTJS_PIDS=$(pgrep -f "next-router-worker\|npm run dev\|node.*next")
if [ ! -z "$NEXTJS_PIDS" ]; then
    echo "🎨 Stopping Next.js frontend..."
    kill $NEXTJS_PIDS 2>/dev/null
    sleep 2
    # Force kill if still running
    kill -9 $NEXTJS_PIDS 2>/dev/null
fi

# Kill any remaining Node processes related to our project
NODE_PIDS=$(pgrep -f "node.*3000")
if [ ! -z "$NODE_PIDS" ]; then
    echo "🔧 Stopping remaining Node processes..."
    kill $NODE_PIDS 2>/dev/null
    sleep 1
    kill -9 $NODE_PIDS 2>/dev/null
fi

# Stop background services
echo "🗄️  Stopping PostgreSQL and Redis..."
if command -v brew &> /dev/null; then
    # macOS with Homebrew - try different PostgreSQL versions
    brew services stop postgresql@15 2>/dev/null || brew services stop postgresql@16 2>/dev/null || brew services stop postgresql 2>/dev/null
    brew services stop redis 2>/dev/null
    echo "   PostgreSQL and Redis stopped via Homebrew"
elif command -v systemctl &> /dev/null; then
    # Linux with systemd
    sudo systemctl stop postgresql redis-server
    echo "   PostgreSQL and Redis stopped via systemctl"
else
    echo "   ⚠️  Please stop PostgreSQL and Redis manually"
fi

# Clean up any leftover files
if [ -f "apps/api/celerybeat-schedule" ]; then
    rm apps/api/celerybeat-schedule
fi

if [ -d "apps/api/__pycache__" ]; then
    rm -rf apps/api/__pycache__
fi

# Check if ports are free
echo "🔍 Checking if ports are freed..."
sleep 2

PORT_8000=$(lsof -ti:8000)
PORT_3000=$(lsof -ti:3000)

if [ ! -z "$PORT_8000" ]; then
    echo "⚠️  Port 8000 still in use, force killing..."
    kill -9 $PORT_8000 2>/dev/null
fi

if [ ! -z "$PORT_3000" ]; then
    echo "⚠️  Port 3000 still in use, force killing..."
    kill -9 $PORT_3000 2>/dev/null
fi

echo ""
echo "✅ All BioOS services stopped successfully!"
echo ""
echo "📋 To start again, run: ./start.sh"