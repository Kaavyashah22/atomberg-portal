import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select
from main import User, GoalSheet, get_current_user, get_db

async def test():
    engine = create_async_engine("postgresql+asyncpg://localhost/atomberg_goals", echo=True)
    AsyncSessionLocal = sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)
    async with AsyncSessionLocal() as db:
        # get user
        res = await db.execute(select(User).where(User.id == 14))
        user = res.scalar_one_or_none()
        print(f"User: {user.name}")
        
        # Test endpoint logic
        from main import GoalSheet, Goal, QuarterlyTracking
        from sqlalchemy.orm import selectinload
        async with db.begin():
            query = (
                select(GoalSheet)
                .options(selectinload(GoalSheet.goals))
                .where(GoalSheet.user_id == user.id, GoalSheet.cycle_year == 2026)
            )
            res = await db.execute(query)
            sheet = res.scalar_one_or_none()
            print(f"Sheet: {sheet}")
            
            if sheet:
                tracking_query = select(QuarterlyTracking).join(Goal).where(Goal.sheet_id == sheet.id)
                tracking_res = await db.execute(tracking_query)
                tracking_records = tracking_res.scalars().all()
                print(f"Tracking: {len(tracking_records)}")
                
asyncio.run(test())
