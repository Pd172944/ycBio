#!/usr/bin/env python3
"""
Seed script for BioOS development environment.
Creates demo user and example pipeline runs.
"""

import asyncio
import os
import sys
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from core.config import settings
from core.auth import get_password_hash
from core.database import Base
from models.user import User, UserRole
from models.pipeline_run import PipelineRun, PipelineStep, PipelineStatus, StepStatus, StepName
from models.molecule import Molecule
from models.report import Report, ReportStatus
import uuid


async def create_demo_user(db: AsyncSession) -> User:
    """Create demo researcher user."""
    print("Creating demo user...")
    
    demo_user = User(
        email="researcher@bioos.dev",
        hashed_password=get_password_hash("bioos2024"),
        org_id="bioos_demo",
        role=UserRole.RESEARCHER
    )
    
    db.add(demo_user)
    await db.commit()
    await db.refresh(demo_user)
    
    print(f"✅ Demo user created: {demo_user.email}")
    return demo_user


async def create_example_pipeline_run(db: AsyncSession, user: User) -> PipelineRun:
    """Create a completed example pipeline run."""
    print("Creating example pipeline run...")
    
    # Example crambin sequence
    crambin_sequence = "TTCCPSIVARSNFNVCRLPGTPEAICATYTGCIIIPGATCPGDYAN"
    
    pipeline_config = [
        {"step_name": "ingestion", "enabled": True, "params": {}},
        {"step_name": "folding", "enabled": True, "params": {"model": "esmfold"}},
        {"step_name": "docking", "enabled": True, "params": {"method": "diffdock"}},
        {"step_name": "admet", "enabled": True, "params": {}},
        {"step_name": "literature", "enabled": True, "params": {}},
        {"step_name": "documentation", "enabled": True, "params": {}}
    ]
    
    # Create pipeline run
    run = PipelineRun(
        user_id=user.id,
        name="Crambin Structure Analysis",
        status=PipelineStatus.COMPLETED,
        target_sequence=crambin_sequence,
        pipeline_config=pipeline_config,
        created_at=datetime.utcnow() - timedelta(hours=2),
        completed_at=datetime.utcnow() - timedelta(minutes=30),
        run_key="example_crambin_run_123"
    )
    
    db.add(run)
    await db.commit()
    await db.refresh(run)
    
    # Create pipeline steps
    steps_data = [
        {"step_name": StepName.INGESTION, "reasoning": "Successfully validated protein sequence. 46 amino acids detected, all standard residues."},
        {"step_name": StepName.FOLDING, "reasoning": "Executed ESMFold prediction with high confidence (0.85). Structure shows clear alpha-helical domains."},
        {"step_name": StepName.DOCKING, "reasoning": "Molecular docking completed with 5 ligand candidates. Top binding affinity: -10.2 kcal/mol."},
        {"step_name": StepName.ADMET, "reasoning": "ADMET screening reveals 3 compounds with favorable drug-like properties and low toxicity."},
        {"step_name": StepName.LITERATURE, "reasoning": "Literature search identified 12 relevant publications supporting target validation."},
        {"step_name": StepName.DOCUMENTATION, "reasoning": "Comprehensive FDA-grade report generated with full compliance documentation."}
    ]
    
    for i, step_data in enumerate(steps_data):
        step = PipelineStep(
            run_id=run.id,
            step_name=step_data["step_name"],
            status=StepStatus.COMPLETED,
            started_at=datetime.utcnow() - timedelta(hours=2) + timedelta(minutes=i*15),
            completed_at=datetime.utcnow() - timedelta(hours=2) + timedelta(minutes=i*15+10),
            agent_reasoning=step_data["reasoning"],
            step_metadata={"example": True}
        )
        db.add(step)
    
    await db.commit()
    
    # Create example molecules
    molecules_data = [
        {"mol_type": "target_protein", "name": "Crambin", "pdb_path": "data/artifacts/structure.pdb"},
        {"mol_type": "ligand", "name": "Compound A", "smiles": "CC(C)C1=CC=C(C=C1)C(C)C(=O)NC2=CC=CC=C2"},
        {"mol_type": "ligand", "name": "Compound B", "smiles": "COC1=CC=C(C=C1)C2=CC(=O)C3=C(O2)C=CC=C3O"}
    ]
    
    for mol_data in molecules_data:
        molecule = Molecule(
            run_id=run.id,
            mol_type=mol_data["mol_type"],
            name=mol_data["name"],
            smiles=mol_data.get("smiles"),
            pdb_path=mol_data.get("pdb_path"),
            properties={"molecular_weight": 250.3, "logp": 2.1}
        )
        db.add(molecule)
    
    await db.commit()
    
    # Create example report
    report = Report(
        run_id=run.id,
        status=ReportStatus.COMPLETED,
        sections={
            "executive_summary": "Pipeline completed successfully with promising results",
            "structural_analysis": "High-quality protein structure predicted",
            "docking_results": "Multiple drug candidates identified",
            "compliance": "All FDA guidelines followed"
        },
        compliance_flags={
            "data_integrity": True,
            "documentation_complete": True,
            "quality_assured": True
        }
    )
    
    db.add(report)
    await db.commit()
    
    print(f"✅ Example pipeline run created: {run.name}")
    return run


async def main():
    """Main seed function."""
    print("🌱 Seeding BioOS database...")
    
    # Create database engine
    engine = create_async_engine(settings.database_url, echo=False)
    SessionLocal = async_sessionmaker(engine, expire_on_commit=False)
    
    async with SessionLocal() as db:
        try:
            # Create demo user
            demo_user = await create_demo_user(db)
            
            # Create example pipeline run
            example_run = await create_example_pipeline_run(db, demo_user)
            
            print("\n✅ Database seeding completed successfully!")
            print("\n📋 Demo Credentials:")
            print(f"   Email: {demo_user.email}")
            print(f"   Password: bioos2024")
            print(f"\n📊 Example Pipeline: {example_run.name}")
            print(f"   Run ID: {example_run.id}")
            print(f"   Status: {example_run.status}")
            
        except Exception as e:
            print(f"❌ Seeding failed: {str(e)}")
            sys.exit(1)
        finally:
            await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())