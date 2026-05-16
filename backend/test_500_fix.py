import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select

async def test():
    engine = create_async_engine("postgresql+asyncpg://localhost/atomberg_goals", echo=False)
    AsyncSessionLocal = sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)
    async with AsyncSessionLocal() as db:
        from main import User
        # Simulating get_current_user
        res = await db.execute(select(User).where(User.id == 14))
        user = res.scalar_one_or_none()
        await db.commit() # <--- THE FIX
        
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
            
asyncio.run(test())
