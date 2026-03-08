#!/bin/bash

# BioOS Startup Script
echo "🧬 Starting BioOS Platform..."

# Check if we're in the right directory
if [ ! -f ".env.example" ]; then
    echo "❌ Please run this script from the ycBio directory"
    exit 1
fi

# Start background services (PostgreSQL and Redis)
echo "🗄️  Starting PostgreSQL and Redis..."
if command -v brew &> /dev/null; then
    # macOS with Homebrew - try different PostgreSQL versions
    brew services start postgresql@15 2>/dev/null || brew services start postgresql@16 2>/dev/null || brew services start postgresql 2>/dev/null
    brew services start redis
elif command -v systemctl &> /dev/null; then
    # Linux with systemd
    sudo systemctl start postgresql redis-server
else
    echo "⚠️  Please start PostgreSQL and Redis manually"
fi

# Wait a moment for services to start
sleep 3

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "⚠️  No .env file found. Copying from .env.example..."
    cp .env.example .env
    echo "📝 Please edit .env file with your ANTHROPIC_API_KEY before continuing"
    echo "   Then run this script again"
    exit 1
fi

# Check if ANTHROPIC_API_KEY is set properly (skip check if actual key is present)
API_KEY=$(grep "ANTHROPIC_API_KEY=" .env | cut -d'=' -f2)
if [[ "$API_KEY" == "sk-ant-..." ]] || [[ -z "$API_KEY" ]]; then
    echo "❌ Please set your ANTHROPIC_API_KEY in .env file"
    echo "   Edit .env and replace 'sk-ant-...' with your actual API key"
    exit 1
fi

# Create log directory early
mkdir -p logs apps/logs

# Function to cleanup background processes on exit
cleanup() {
    echo ""
    echo "🛑 Stopping BioOS services..."
    
    # Kill background processes
    if [ ! -z "$API_PID" ] && kill -0 $API_PID 2>/dev/null; then
        kill $API_PID
    fi
    if [ ! -z "$WORKER_PID" ] && kill -0 $WORKER_PID 2>/dev/null; then
        kill $WORKER_PID
    fi
    if [ ! -z "$FRONTEND_PID" ] && kill -0 $FRONTEND_PID 2>/dev/null; then
        kill $FRONTEND_PID
    fi
    
    # Stop background services
    echo "🗄️  Stopping PostgreSQL and Redis..."
    if command -v brew &> /dev/null; then
        brew services stop postgresql redis
    elif command -v systemctl &> /dev/null; then
        sudo systemctl stop postgresql redis-server
    fi
    
    echo "✅ All services stopped"
    exit 0
}

# Set trap to cleanup on script exit
trap cleanup INT TERM EXIT

# Start FastAPI backend
echo "🖥️  Starting FastAPI backend..."
cd apps/api

# Use system Python if in virtual environment already, otherwise create one
if [[ "$VIRTUAL_ENV" != "" ]]; then
    echo "📦 Using existing virtual environment: $VIRTUAL_ENV"
    pip install -r requirements.txt
else
    if [ ! -d "venv" ]; then
        echo "📦 Creating virtual environment..."
        python3 -m venv venv
    fi
    # Activate virtual environment and install dependencies
    source venv/bin/activate
    pip install -r requirements.txt
fi

# Run migrations and seed data
echo "🗃️  Setting up database..."
alembic upgrade head
python seed.py

# Start API server in background
uvicorn main:app --reload --port 8000 > ../../logs/api.log 2>&1 &
API_PID=$!

# Start Celery worker in background
echo "👷 Starting Celery worker..."
celery -A workers.celery_app worker --loglevel=info > ../../logs/worker.log 2>&1 &
WORKER_PID=$!

cd ../..

# Start Next.js frontend
echo "🎨 Starting Next.js frontend..."
cd apps/web

# Install npm dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing npm dependencies..."
    npm install
fi

# Start frontend in background
npm run dev > ../../logs/frontend.log 2>&1 &
FRONTEND_PID=$!

cd ../..

# Wait for services to start
echo "⏳ Waiting for services to start..."
sleep 5

# Check if services are running
echo "🔍 Checking service status..."

# Check API
if curl -s http://localhost:8000/health > /dev/null; then
    echo "✅ API running at http://localhost:8000"
else
    echo "❌ API failed to start - check logs/api.log"
fi

# Check frontend
if curl -s http://localhost:3000 > /dev/null; then
    echo "✅ Frontend running at http://localhost:3000"
else
    echo "❌ Frontend failed to start - check logs/frontend.log"
fi

echo ""
echo "🎉 BioOS Platform is running!"
echo ""
echo "📱 Frontend: http://localhost:3000"
echo "🔧 API: http://localhost:8000"
echo "📚 API Docs: http://localhost:8000/docs"
echo ""
echo "👤 Demo Login:"
echo "   Email: researcher@bioos.dev"
echo "   Password: bioos2024"
echo ""
echo "📋 Logs available in:"
echo "   API: logs/api.log"
echo "   Worker: logs/worker.log" 
echo "   Frontend: logs/frontend.log"
echo ""
echo "Press Ctrl+C to stop all services"

# Keep script running and show live logs
tail -f logs/api.log logs/worker.log logs/frontend.log