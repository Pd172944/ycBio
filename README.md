# BioOS — Agentic Operating System for Biology Researchers

BioOS is a full-stack platform that orchestrates AI bioscience models (AlphaFold 3, ESMFold, RFdiffusion, DiffDock, etc.) into autonomous multi-agent pipelines. Researchers input a target sequence and the system handles everything: protein folding → binding site prediction → ligand docking → ADMET screening → FDA-grade documentation.

## 🎯 Vision

Every step is reproducible, auditable, and compliance-ready. BioOS transforms computational biology workflows from manual, error-prone processes into automated, intelligent pipelines that maintain the rigor required for drug discovery and regulatory submission.

## 🏗️ Architecture

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS, shadcn/ui
- **Backend API**: FastAPI (Python 3.11), async, Pydantic v2
- **Agent Layer**: Claude claude-sonnet-4-20250514 via Anthropic SDK
- **Queue/Workers**: Redis + Celery for async pipeline execution
- **Database**: PostgreSQL with SQLAlchemy async + Alembic migrations
- **File Storage**: Local filesystem under `./data/artifacts/`
- **Auth**: JWT middleware with NextAuth.js integration
- **Observability**: Structured logging with OpenTelemetry traces

## 📋 Prerequisites

Before getting started, ensure you have these installed:

- **Python 3.11** or higher
- **Node.js 18+** with npm
- **PostgreSQL 15** or higher
- **Redis 7** or higher

### Install Dependencies

**macOS (using Homebrew):**
```bash
brew install python@3.11 node postgresql@15 redis
brew services start postgresql
brew services start redis
```

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install python3.11 python3.11-venv nodejs npm postgresql-15 redis-server
sudo systemctl start postgresql
sudo systemctl start redis-server
```

## 🚀 Quick Start

### 1. Clone and Setup

```bash
git clone <repository-url>
cd ycBio
cp .env.example .env
```

### 2. Configure Environment

Edit `.env` with your settings:

```bash
# Required
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/bioos
REDIS_URL=redis://localhost:6379/0
ANTHROPIC_API_KEY=sk-ant-your-key-here

# Secrets (generate secure values)
JWT_SECRET=your-jwt-secret-here
NEXTAUTH_SECRET=your-nextauth-secret-here

# Optional
ARTIFACTS_DIR=./data/artifacts
NEXTAUTH_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:8000
```

**⚠️ Important:** You need an Anthropic API key. Get one at [console.anthropic.com](https://console.anthropic.com/)

### 3. Setup Database

Create the PostgreSQL database:

```bash
# Connect to PostgreSQL
psql -h localhost -U postgres

# Create database
CREATE DATABASE bioos;
\q
```

### 4. Backend Setup

```bash
cd apps/api

# Install dependencies
pip install -r requirements.txt

# Run migrations
alembic upgrade head

# Seed demo data
python seed.py
```

### 5. Frontend Setup

```bash
cd apps/web

# Install dependencies
npm install
```

### 6. Start All Services

You need **3 terminal sessions**:

**Terminal 1 - Backend API:**
```bash
cd apps/api && uvicorn main:app --reload --port 8000
```

**Terminal 2 - Celery Worker:**
```bash
cd apps/api && celery -A workers.celery_app worker --loglevel=info
```

**Terminal 3 - Frontend:**
```bash
cd apps/web && npm run dev
```

### 7. Access the Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

**Demo Credentials:**
- Email: `researcher@bioos.dev`
- Password: `bioos2024`

## 📖 Usage Guide

### Creating Your First Pipeline

1. **Login** with demo credentials at http://localhost:3000
2. **Navigate** to "New Pipeline" 
3. **Input your target sequence** (FASTA format or plain amino acids)
4. **Configure pipeline steps:**
   - **Folding**: Choose ESMFold (fast) or AlphaFold3 (accurate)
   - **Docking**: Enable for ligand binding analysis
   - **ADMET**: Enable for drug-likeness screening
   - **Literature**: Enable for target validation
   - **Documentation**: Enable for FDA-grade reports
5. **Submit** and watch the live execution

### Live Monitoring

The pipeline monitor shows:
- **Real-time progress** with step-by-step status
- **Agent reasoning** for each decision (expandable)
- **3D structure viewer** when folding completes
- **Live updates** via Server-Sent Events (SSE)

### Viewing Results

Once complete, access:
- **Structure Viewer**: Interactive 3D protein visualization
- **Docking Results**: Ranked ligands with binding scores
- **ADMET Analysis**: Drug-likeness and toxicity predictions
- **Literature Evidence**: Relevant publications and known compounds
- **Compliance Report**: Downloadable PDF with full documentation

## 🧪 Development Stubs

For local development, BioOS uses stub implementations of external APIs:

- **ESMFold/AlphaFold3**: Returns mock crambin PDB structure
- **DiffDock/Vina**: Generates realistic docking scores (-12 to -6 kcal/mol)
- **ADMET-AI**: Produces mock ADMET properties and drug-likeness scores
- **PubMed/ChEMBL**: Returns relevant mock literature and compound data

All stubs are in `apps/api/agents/tools/stubs/` and marked with `# STUB: replace with real API call`.

## 🔧 API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Current user info

### Pipelines
- `POST /api/pipelines` - Create new pipeline run
- `GET /api/pipelines` - List user's pipeline runs
- `GET /api/pipelines/{id}` - Get specific pipeline run

### Live Updates
- `GET /api/runs/{id}/stream` - SSE stream for live updates
- `GET /api/runs/{id}/status` - Current run status

### Reports & Artifacts
- `GET /api/reports/{id}` - Get pipeline report
- `GET /api/reports/{id}/download` - Download PDF report
- `GET /api/artifacts/{run_id}/{filename}` - Download artifacts

## 🛠️ Troubleshooting

### Common Issues

**Database Connection Failed:**
```bash
# Check PostgreSQL is running
brew services list | grep postgresql
# Or on Linux: sudo systemctl status postgresql
```

**Redis Connection Failed:**
```bash
# Check Redis is running
brew services list | grep redis  
# Or on Linux: sudo systemctl status redis-server
```

**Celery Worker Not Starting:**
```bash
# Check Redis connection and restart worker
cd apps/api
celery -A workers.celery_app worker --loglevel=debug
```

## 📄 What You Need to Make It Work

The BioOS platform is now fully implemented and ready to run! Here's what you need:

### Required for Full Functionality:
1. **Anthropic API Key** - Get from [console.anthropic.com](https://console.anthropic.com/)
2. **PostgreSQL 15+** - For data persistence  
3. **Redis 7+** - For Celery task queue
4. **Python 3.11+** - For FastAPI backend
5. **Node.js 18+** - For Next.js frontend

### Included and Working:
✅ Complete multi-agent architecture with Claude integration  
✅ FastAPI backend with async SQLAlchemy and Alembic migrations  
✅ Next.js frontend with Tailwind CSS and shadcn/ui components  
✅ Celery workers for async pipeline execution  
✅ Server-Sent Events (SSE) for live updates  
✅ JWT authentication system  
✅ Local file storage for artifacts  
✅ Comprehensive seed data with demo user  
✅ Mock implementations of all bioinformatics APIs  
✅ PostgreSQL database models for all entities  
✅ Complete API endpoints for all operations  

### Ready to Use:
- Demo user: `researcher@bioos.dev` / `bioos2024`
- Example completed pipeline run with crambin protein
- Live pipeline execution with agent reasoning
- 3D structure visualization capability  
- PDF report generation
- FDA-compliant documentation system

The platform will work immediately for development and demonstration purposes using the stub implementations. To connect to real bioinformatics APIs (AlphaFold, DiffDock, etc.), simply replace the stub functions in `apps/api/agents/tools/stubs/` with actual API calls.

---

**🧬 Built for the future of computational biology — where AI agents accelerate drug discovery while maintaining the rigor required for human health.**