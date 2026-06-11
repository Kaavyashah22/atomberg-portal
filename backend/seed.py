import os
import asyncio
import random
from datetime import date
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select

# Import application components from main.py
from main import (
    Base, User, GoalSheet, Goal, QuarterlyTracking, 
    UserRole, GoalSheetStatus, UOM, Quarter, TrackingStatus,
    PeerFeedback, DevelopmentPlan
)

# Pull the URL from the terminal
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://localhost/atomberg_goals")

# DIAGNOSTIC: This will tell us if it's hitting the Cloud or Local
if "neon.tech" in DATABASE_URL:
    print("🚀 TARGET: Neon Cloud Database")
else:
    print("💻 TARGET: Local MacBook Database")

engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)
# -------------------------
def partition_weightage(num_goals: int) -> list[int]:
    """
    Dynamically partitions an integer exactly to 100 
    across the required length, ensuring each value is >= 10.
    """
    base = [10] * num_goals
    remaining = 100 - sum(base)
    for _ in range(remaining):
        idx = random.randint(0, num_goals - 1)
        base[idx] += 1
    return base

async def reset_db():
    """Drops and recreates all table structures safely."""
    async with engine.begin() as conn:
        print("-> Dropping existing tables...")
        await conn.run_sync(Base.metadata.drop_all)
        print("-> Recreating all tables...")
        await conn.run_sync(Base.metadata.create_all)

async def seed_data():
    """Executes the high-volume matrix generation and batch insertion."""
    async with AsyncSessionLocal() as db:
        print("-> Seeding Global Admin Accounts...")
        admins = [
            User(email=f"admin{i}@atomberg.com", name=f"Global Admin {i}", role=UserRole.Admin, department="Executive")
            for i in range(1, 4)
        ]
        db.add_all(admins)
        await db.flush()

        print("-> Seeding L1 Managers...")
        departments = ['Engineering', 'Sales', 'Operations', 'Finance', 'HR']
        managers = []
        for i in range(1, 11):
            dept = departments[i % 5]
            managers.append(
                User(email=f"manager{i}@atomberg.com", name=f"Manager {i}", role=UserRole.Manager, department=dept)
            )
        db.add_all(managers)
        await db.flush()
        
        # Select 7 managers to be highly compliant, 3 to be non-compliant
        compliant_manager_ids = set([m.id for m in managers[:7]])

        print("-> Seeding Active Employees...")
        employees = []
        for i in range(1, 121):
            mgr = managers[i % 10]
            employees.append(
                User(email=f"employee{i}@atomberg.com", name=f"Employee {i}", role=UserRole.Employee, department=mgr.department, manager_id=mgr.id)
            )
        db.add_all(employees)
        await db.flush()

        print("-> Seeding Algorithmic Goal Sheets...")
        goal_sheets = []
        for emp in employees:
            rand_val = random.random()
            if rand_val < 0.15:
                status = GoalSheetStatus.Draft
                is_locked = False
            elif rand_val < 0.30:
                status = GoalSheetStatus.Pending_Approval
                is_locked = False
            else:
                status = GoalSheetStatus.Approved
                is_locked = True
                
            sheet = GoalSheet(
                user_id=emp.id,
                cycle_year=2026,
                status=status,
                is_locked=is_locked
            )
            goal_sheets.append(sheet)
        db.add_all(goal_sheets)
        await db.flush()

        print("-> Seeding Unique Goals & Weightage Contraints...")
        goals = []
        uom_choices = [UOM.Numeric_Min, UOM.Numeric_Max, UOM.Timeline, UOM.Zero_Based]
        for sheet in goal_sheets:
            num_goals = random.randint(4, 6)
            weights = partition_weightage(num_goals)
            for j in range(num_goals):
                uom = random.choice(uom_choices)
                
                # Assign logical target ranges based on UOM
                if uom in [UOM.Numeric_Min, UOM.Numeric_Max]:
                    target = float(random.choice([10, 50, 100, 500, 1000]))
                else:
                    target = 0.0
                    
                goals.append(Goal(
                    sheet_id=sheet.id,
                    thrust_area=f"Strategic Initiative {j+1}",
                    title=f"Key Result Area {j+1} - Phase {sheet.id}",
                    description=f"Detailed execution description for priority {j+1}",
                    uom=uom,
                    target_value=target,
                    weightage=weights[j],
                    deadline=date(2026, 12, 31) if uom == UOM.Timeline else None,
                    is_shared=False
                ))
        db.add_all(goals)
        await db.flush()

        print("-> Seeding High-Volume Performance Tracking Matrices...")
        tracking_records = []
        quarters = [Quarter.Q1, Quarter.Q2, Quarter.Q3]
        
        # Query database to map generated Goals back to the Manager mapping tree via GoalSheet & User tables
        goal_manager_map_query = (
            select(Goal.id, Goal.target_value, User.manager_id)
            .join(GoalSheet, Goal.sheet_id == GoalSheet.id)
            .join(User, GoalSheet.user_id == User.id)
            .where(GoalSheet.status == GoalSheetStatus.Approved)
        )
        res = await db.execute(goal_manager_map_query)
        approved_goals_map = [(row.id, row.target_value, row.manager_id) for row in res.all()]
        
        for goal_id, target, manager_id in approved_goals_map:
            for q in quarters:
                status = random.choice([TrackingStatus.Completed, TrackingStatus.On_Track, TrackingStatus.Not_Started])
                
                # Generate a realistic actual achievement oscillating around the target
                if target > 0:
                    variance = target * 0.3
                    actual = random.uniform(target - variance, target + variance)
                else:
                    actual = random.choice([0.0, 1.0])
                
                # Manager compliance simulation injection
                if manager_id in compliant_manager_ids:
                    comment = f"Routine performance check-in completed for {q.value}. Metrics are within expected tolerances."
                else:
                    # Non-compliant managers have an 80% chance of leaving the comment completely unsubmitted
                    comment = None if random.random() < 0.8 else "Needs immediate improvement."
                
                tracking_records.append(QuarterlyTracking(
                    goal_id=goal_id,
                    quarter=q,
                    actual_achievement=actual,
                    status=status,
                    completion_date=date(2026, 3, 31) if status == TrackingStatus.Completed else None,
                    manager_comment=comment
                ))
        
        # Chunk flush all records
        db.add_all(tracking_records)
        await db.commit()
        
        print(f"\\n✅ Data Seeding Complete!")
        print(f"Generated: 3 Admins, 10 Managers, 120 Employees.")
        print(f"Generated: {len(goal_sheets)} Sheets, {len(goals)} Goals, {len(tracking_records)} Tracking Matrices.")

async def main():
    await reset_db()
    await seed_data()

if __name__ == "__main__":
    asyncio.run(main())
