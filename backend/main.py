import enum
import json
import os
import io
import csv
from datetime import date, datetime, timezone
from typing import List, Optional

from fastapi import FastAPI, HTTPException, Depends, status, Request, Header, Query
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, model_validator
from sqlalchemy import Column, Integer, String, Boolean, Float, ForeignKey, Enum as SQLEnum, select, Date, DateTime, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import declarative_base, relationship, sessionmaker
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession

# ==========================================
# Database Setup
# ==========================================
# In production, this would be loaded from environment variables
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://localhost/atomberg_goals")
engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = sessionmaker(
    bind=engine, 
    class_=AsyncSession, 
    expire_on_commit=False
)

Base = declarative_base()

# ==========================================
# Enums
# ==========================================
class UserRole(str, enum.Enum):
    Employee = "Employee"
    Manager = "Manager"
    Admin = "Admin"

class GoalSheetStatus(str, enum.Enum):
    Draft = "Draft"
    Pending_Approval = "Pending_Approval"
    Approved = "Approved"
    Rework = "Rework"

class UOM(str, enum.Enum):
    Numeric_Min = "Numeric_Min"
    Numeric_Max = "Numeric_Max"
    Timeline = "Timeline"
    Zero_Based = "Zero_Based"

class Quarter(str, enum.Enum):
    Q1 = "Q1"
    Q2 = "Q2"
    Q3 = "Q3"
    Q4 = "Q4"

class TrackingStatus(str, enum.Enum):
    Not_Started = "Not Started"
    On_Track = "On Track"
    Completed = "Completed"

class NotificationType(str, enum.Enum):
    GOAL_SUBMITTED = "GOAL_SUBMITTED"
    GOAL_APPROVED = "GOAL_APPROVED"
    GOAL_REWORK = "GOAL_REWORK"
    CHECKIN_REMINDER = "CHECKIN_REMINDER"

class EscalationTrigger(str, enum.Enum):
    EMPLOYEE_SUBMISSION_OVERDUE = "EMPLOYEE_SUBMISSION_OVERDUE"
    MANAGER_APPROVAL_OVERDUE = "MANAGER_APPROVAL_OVERDUE"
    QUARTERLY_CHECKIN_OVERDUE = "QUARTERLY_CHECKIN_OVERDUE"

# ==========================================
# SQLAlchemy Models
# ==========================================
class User(Base):
    """
    Represents an employee, manager, or admin in the system.
    """
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    role = Column(SQLEnum(UserRole), nullable=False)
    manager_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    department = Column(String, nullable=False)

class GoalSheet(Base):
    """
    Represents a collection of goals for a specific user and cycle year.
    """
    __tablename__ = "goal_sheets"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    cycle_year = Column(Integer, nullable=False)
    status = Column(SQLEnum(GoalSheetStatus), default=GoalSheetStatus.Draft, nullable=False)
    is_locked = Column(Boolean, default=False, nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    goals = relationship("Goal", back_populates="sheet", cascade="all, delete-orphan")

class Goal(Base):
    """
    Represents an individual goal within a GoalSheet.
    """
    __tablename__ = "goals"
    id = Column(Integer, primary_key=True, index=True)
    sheet_id = Column(Integer, ForeignKey("goal_sheets.id"), nullable=False)
    thrust_area = Column(String, nullable=False)
    title = Column(String, nullable=False)
    description = Column(String, nullable=False)
    uom = Column(SQLEnum(UOM), nullable=False)
    target_value = Column(Float, nullable=False)
    weightage = Column(Integer, nullable=False)
    is_shared = Column(Boolean, default=False, nullable=False)
    parent_goal_id = Column(Integer, ForeignKey("goals.id"), nullable=True)
    deadline = Column(Date, nullable=True)

    sheet = relationship("GoalSheet", back_populates="goals")

class QuarterlyTracking(Base):
    """
    Quarterly tracking check-in data per goal.
    """
    __tablename__ = "quarterly_tracking"
    id = Column(Integer, primary_key=True, index=True)
    goal_id = Column(Integer, ForeignKey("goals.id"), nullable=False)
    quarter = Column(SQLEnum(Quarter), nullable=False)
    actual_achievement = Column(Float, nullable=True)
    completion_date = Column(Date, nullable=True)
    status = Column(SQLEnum(TrackingStatus), default=TrackingStatus.Not_Started, nullable=False)
    manager_comment = Column(String, nullable=True)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint('goal_id', 'quarter', name='uq_goal_quarter'),
    )

    goal = relationship("Goal")

class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(Integer, primary_key=True, index=True)
    goal_id = Column(Integer, ForeignKey("goals.id"), nullable=True)
    sheet_id = Column(Integer, ForeignKey("goal_sheets.id"), nullable=True)
    modified_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    action = Column(String, nullable=False)
    old_values = Column(JSONB, nullable=True)
    new_values = Column(JSONB, nullable=True)
    timestamp = Column(DateTime(timezone=True), default=func.now())

class EscalationRule(Base):
    __tablename__ = "escalation_rules"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    trigger_condition = Column(SQLEnum(EscalationTrigger), nullable=False)
    threshold_days = Column(Integer, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

class EscalationLog(Base):
    __tablename__ = "escalation_logs"
    id = Column(Integer, primary_key=True, index=True)
    rule_id = Column(Integer, ForeignKey("escalation_rules.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    manager_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    current_handler_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    action_taken = Column(String, nullable=False)
    days_overdue = Column(Integer, nullable=False)
    resolved = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), default=func.now())

# ==========================================
# Pydantic Schemas & Validation
# ==========================================
class GoalInput(BaseModel):
    id: Optional[int] = None
    thrust_area: str
    title: str
    description: str
    uom: UOM
    target_value: float
    weightage: int
    deadline: Optional[date] = None

class GoalSheetSubmitRequest(BaseModel):
    """
    Schema for submitting a goal sheet. Contains strict business rule validations.
    """
    sheet_id: int
    goals: List[GoalInput]

    @model_validator(mode='after')
    def validate_business_rules(self):
        # 1. Ensure a sheet cannot be submitted empty.
        if not self.goals:
            raise ValueError("A goal sheet cannot be submitted empty.")
        
        # 2. Maximum number of goals per employee sheet must be <= 8.
        if len(self.goals) > 8:
            raise ValueError("Maximum number of goals per employee sheet must be <= 8.")
        
        total_weightage = 0
        for goal in self.goals:
            # 3. Minimum weightage per individual goal must be >= 10%.
            if goal.weightage < 10:
                raise ValueError(f"Minimum weightage per individual goal must be >= 10%. Goal '{goal.title}' has {goal.weightage}%.")
            total_weightage += goal.weightage
            
        # 4. Total weightage across all goals in the submitted sheet must equal exactly 100%.
        if total_weightage != 100:
            raise ValueError(f"Total weightage across all goals in the submitted sheet must equal exactly 100%. Current total is {total_weightage}%.")
            
        return self

class GoalEdit(BaseModel):
    goal_id: int
    target_value: Optional[float] = None
    weightage: Optional[int] = None

class ManagerReviewRequest(BaseModel):
    status: GoalSheetStatus
    goal_edits: Optional[List[GoalEdit]] = None

class AdminSharedGoalRequest(BaseModel):
    department: str
    cycle_year: int
    thrust_area: str
    title: str
    description: str
    uom: UOM
    target_value: float
    weightage: int
    deadline: Optional[date] = None

class EmployeeTrackingUpdate(BaseModel):
    goal_id: int
    quarter: Quarter
    actual_achievement: Optional[float] = None
    status: TrackingStatus
    completion_date: Optional[date] = None

class ManagerCheckinRequest(BaseModel):
    goal_id: int
    quarter: Quarter
    manager_comment: str

class AzureADTokenPayload(BaseModel):
    iss: str
    sub: str
    email: Optional[str] = None
    preferred_username: Optional[str] = None
    name: str
    groups: List[str] = []
    manager_email: Optional[str] = None
    department: str

class RemindQuarterRequest(BaseModel):
    quarter: Quarter

# ==========================================
# Notification Dispatcher Service
# ==========================================
class NotificationDispatcher:
    @staticmethod
    def generate_teams_adaptive_card(event_type: str, employee_name: str, sheet_id: int, details: dict) -> dict:
        return {
            "type": "AdaptiveCard",
            "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
            "version": "1.4",
            "body": [
                {
                    "type": "TextBlock",
                    "text": f"Notification: {event_type}",
                    "weight": "Bolder",
                    "size": "Medium"
                },
                {
                    "type": "TextBlock",
                    "text": f"Employee: {employee_name}",
                    "isSubtle": True,
                    "wrap": True
                },
                {
                    "type": "FactSet",
                    "facts": [{"title": k, "value": str(v)} for k, v in details.items()]
                }
            ],
            "actions": [
                {
                    "type": "Action.OpenUrl",
                    "title": "Review Sheet",
                    "url": f"https://portal.atomberg.internal/review/{sheet_id}"
                }
            ]
        }

    @staticmethod
    async def send_notification(event_type: str, recipient_email: str, employee_name: str, sheet_id: int, contextual_data: dict = None):
        if not contextual_data:
            contextual_data = {}
        
        try:
            card_payload = NotificationDispatcher.generate_teams_adaptive_card(event_type, employee_name, sheet_id, contextual_data)
            
            html_body = f"<h2>Notification: {event_type}</h2><p><strong>Employee:</strong> {employee_name}</p><p><strong>Sheet ID:</strong> {sheet_id}</p><ul>"
            for k, v in contextual_data.items():
                html_body += f"<li><b>{k}:</b> {v}</li>"
            html_body += f'</ul><p><a href="https://portal.atomberg.internal/review/{sheet_id}">Click here to review</a></p>'
            
            print("\\n" + "="*50)
            print(f"MOCK DISPATCH: {event_type} -> {recipient_email}")
            print("="*50)
            print("--- HTML EMAIL BODY ---")
            print(html_body)
            print("--- TEAMS ADAPTIVE CARD (JSON) ---")
            print(json.dumps(card_payload, indent=2))
            print("="*50 + "\\n")
        except Exception as e:
            print(f"Error dispatching notification {event_type} to {recipient_email}: {str(e)}")

# ==========================================
# Escalation Chain Processing Logic
# ==========================================
class EscalationEngine:
    @staticmethod
    async def get_next_handler_id(db: AsyncSession, current_handler_id: Optional[int]) -> int:
        """Recursively fetch skip-level manager. Fallback to Admin if none exists."""
        if not current_handler_id:
            admin_res = await db.execute(select(User).where(User.role == UserRole.Admin).limit(1))
            admin = admin_res.scalar_one_or_none()
            return admin.id if admin else 1  # Fallback gracefully

        user_res = await db.execute(select(User).where(User.id == current_handler_id))
        user = user_res.scalar_one_or_none()
        if user and user.manager_id:
            return user.manager_id
        else:
            admin_res = await db.execute(select(User).where(User.role == UserRole.Admin).limit(1))
            admin = admin_res.scalar_one_or_none()
            return admin.id if admin else current_handler_id

    @staticmethod
    async def process_escalation_rules(db: AsyncSession) -> dict:
        rules_res = await db.execute(select(EscalationRule).where(EscalationRule.is_active == True))
        rules = rules_res.scalars().all()
        
        generated_logs = 0
        # Standardize timezone handling using explicit UTC datetime
        current_utc = datetime.now(timezone.utc)
        current_date_val = current_utc.date()
        
        cycle_start_date = date(current_date_val.year, 5, 1)
        if current_date_val < cycle_start_date:
            cycle_start_date = date(current_date_val.year - 1, 5, 1)

        for rule in rules:
            if rule.trigger_condition == EscalationTrigger.EMPLOYEE_SUBMISSION_OVERDUE:
                days_elapsed = (current_date_val - cycle_start_date).days
                if days_elapsed > rule.threshold_days:
                    query = select(GoalSheet, User).join(User, GoalSheet.user_id == User.id).where(GoalSheet.status == GoalSheetStatus.Draft)
                    res = await db.execute(query)
                    for sheet, emp in res.all():
                        await EscalationEngine.handle_escalation(db, rule, emp, sheet, days_elapsed, "EMPLOYEE_SUBMISSION_OVERDUE")
                        generated_logs += 1
                        
            elif rule.trigger_condition == EscalationTrigger.MANAGER_APPROVAL_OVERDUE:
                query = select(GoalSheet, User).join(User, GoalSheet.user_id == User.id).where(GoalSheet.status == GoalSheetStatus.Pending_Approval)
                res = await db.execute(query)
                for sheet, emp in res.all():
                    # Safely extract timezone-aware dates
                    if sheet.updated_at:
                        # Assuming sheet.updated_at is timezone-aware based on DateTime(timezone=True)
                        # We normalize it to UTC before extracting the date to prevent boundary bugs
                        updated_at_utc = sheet.updated_at.astimezone(timezone.utc)
                        updated_at_date = updated_at_utc.date()
                    else:
                        updated_at_date = current_date_val
                        
                    days_elapsed = (current_date_val - updated_at_date).days
                    if days_elapsed > rule.threshold_days:
                        await EscalationEngine.handle_escalation(db, rule, emp, sheet, days_elapsed, "MANAGER_APPROVAL_OVERDUE")
                        generated_logs += 1
        
        return {"new_logs_generated": generated_logs}

    @staticmethod
    async def handle_escalation(db: AsyncSession, rule: EscalationRule, emp: User, sheet: GoalSheet, days_overdue: int, event_context: str):
        log_res = await db.execute(
            select(EscalationLog).where(
                EscalationLog.rule_id == rule.id, 
                EscalationLog.user_id == emp.id, 
                EscalationLog.resolved == False
            )
        )
        existing_log = log_res.scalar_one_or_none()
        
        if existing_log:
            next_handler_id = await EscalationEngine.get_next_handler_id(db, existing_log.current_handler_id)
            if existing_log.current_handler_id != next_handler_id:
                existing_log.current_handler_id = next_handler_id
                existing_log.action_taken = f"Escalated to skip-level/Admin (ID: {next_handler_id})"
                existing_log.days_overdue = days_overdue
                
                handler_res = await db.execute(select(User).where(User.id == next_handler_id))
                handler = handler_res.scalar_one_or_none()
                if handler:
                    await NotificationDispatcher.send_notification(
                        event_type=f"ESCALATION: {event_context}",
                        recipient_email=handler.email,
                        employee_name=emp.name,
                        sheet_id=sheet.id,
                        contextual_data={"Days Overdue": days_overdue, "Action": "Immediate remediation required"}
                    )
        else:
            handler_id = emp.manager_id
            if not handler_id:
                handler_id = await EscalationEngine.get_next_handler_id(db, None)
                
            new_log = EscalationLog(
                rule_id=rule.id,
                user_id=emp.id,
                manager_id=emp.manager_id,
                current_handler_id=handler_id,
                action_taken="Initial Warning Issued",
                days_overdue=days_overdue,
                resolved=False
            )
            db.add(new_log)
            
            handler_res = await db.execute(select(User).where(User.id == handler_id))
            handler = handler_res.scalar_one_or_none()
            if handler:
                await NotificationDispatcher.send_notification(
                    event_type=f"WARNING: {event_context}",
                    recipient_email=handler.email,
                    employee_name=emp.name,
                    sheet_id=sheet.id,
                    contextual_data={"Days Overdue": days_overdue, "Action": "Review requested"}
                )

# ==========================================
# Core Mathematical Calculation Service
# ==========================================
def compute_progress_score(uom: str, target: float, actual: Optional[float], deadline: Optional[date] = None, completion_date: Optional[date] = None) -> float:
    """
    Accurately implements business formulas for performance tracking progress.
    """
    actual = actual if actual is not None else 0.0
    if uom == UOM.Numeric_Min.value:
        if target == 0:
            return 0.0
        return (actual / target) * 100.0
    elif uom == UOM.Numeric_Max.value:
        if actual == 0:
            return 0.0
        return (target / actual) * 100.0
    elif uom == UOM.Timeline.value:
        if completion_date and deadline:
            return 100.0 if completion_date <= deadline else 0.0
        return 0.0
    elif uom == UOM.Zero_Based.value:
        return 100.0 if actual == 0 else 0.0
    return 0.0

# ==========================================
# Enterprise Directory Synchronization Service
# ==========================================
async def sync_user_from_azure_ad_claims(db: AsyncSession, token_data: AzureADTokenPayload) -> User:
    """
    Synchronizes an Azure AD User into the local database, handling role mapping, 
    upserts, and reporting line hierarchy gracefully.
    """
    # 1. Role Mapping Logic
    if 'ad-group-admin-uuid' in token_data.groups:
        mapped_role = UserRole.Admin
    elif 'ad-group-manager-uuid' in token_data.groups:
        mapped_role = UserRole.Manager
    else:
        mapped_role = UserRole.Employee
        
    email_to_use = token_data.email or token_data.preferred_username
    if not email_to_use:
        raise ValueError("No email or preferred_username found in Azure AD token.")

    # 2. User Upsert Control
    result = await db.execute(select(User).where(User.email == email_to_use))
    user = result.scalar_one_or_none()
    
    if user:
        user.name = token_data.name
        user.role = mapped_role
        user.department = token_data.department
    else:
        user = User(
            email=email_to_use,
            name=token_data.name,
            role=mapped_role,
            department=token_data.department
        )
        db.add(user)
        await db.flush() # Flush to get user.id safely
        
    # 3. Hierarchy Mapping Logic
    if token_data.manager_email:
        mgr_result = await db.execute(select(User).where(User.email == token_data.manager_email))
        manager = mgr_result.scalar_one_or_none()
        if manager:
            user.manager_id = manager.id
        else:
            # Manager doesn't exist yet; handled gracefully (will be linked in future passes or next sign-in)
            pass
            
    return user

# ==========================================
# FastAPI Application & Dependencies
# ==========================================
app = FastAPI(
    title="Atomberg In-House Goal Setting & Tracking Portal",
    description="Phase 1 Implementation of the Goal Setting Portal",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/v1/ping")
async def ping():
    return {"status": "healthy", "message": "Keep-alive active"}

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """
    Custom exception handler to return explicit 400 Bad Request
    for Pydantic validation errors instead of the default 422.
    """
    errors = exc.errors()
    # Extract the error messages generated by our custom validators
    error_msgs = [e.get("msg") for e in errors]
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={"detail": "Bad Request", "errors": error_msgs}
    )

async def get_db():
    """
    Dependency injection for database session.
    """
    async with AsyncSessionLocal() as session:
        yield session

async def get_current_user(x_user_id: int = Header(...), db: AsyncSession = Depends(get_db)) -> User:
    result = await db.execute(select(User).where(User.id == x_user_id))
    user = result.scalar_one_or_none()
    await db.commit() # End implicit transaction to allow db.begin() in route handlers
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid X-User-ID. User not found.")
    return user

def verify_role(allowed_roles: List[str]):
    def role_checker(current_user: User = Depends(get_current_user)):
        if current_user.role.value not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, 
                detail=f"Operation not permitted. Required roles: {allowed_roles}"
            )
        return current_user
    return role_checker

async def log_governance_action(db: AsyncSession, goal_id: Optional[int], sheet_id: Optional[int], modified_by: int, action: str, old_values: dict, new_values: dict):
    audit_log = AuditLog(
        goal_id=goal_id,
        sheet_id=sheet_id,
        modified_by=modified_by,
        action=action,
        old_values=old_values,
        new_values=new_values
    )
    db.add(audit_log)

# ==========================================
# ==========================================
# API Routes
# ==========================================
from sqlalchemy.orm import selectinload

def get_cycle_status():
    month = datetime.now(timezone.utc).month
    if month == 5:
        return {"phase": "GOAL_SETTING", "can_edit_goals": True, "can_update_tracking": False}
    elif month in [7, 10, 1, 3]:
        return {"phase": "TRACKING", "can_edit_goals": False, "can_update_tracking": True}
    return {"phase": "CLOSED", "can_edit_goals": False, "can_update_tracking": False}

@app.get("/api/v1/goals/sheet/active")
async def get_active_goal_sheet(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Fetches the user's active goal sheet dynamically for cycle year 2026.
    Uses eager load to pull the associated list of Goal rows.
    Automatically provisions an empty Draft sheet if none exists.
    """
    async with db.begin():
        query = (
            select(GoalSheet)
            .options(selectinload(GoalSheet.goals))
            .where(GoalSheet.user_id == current_user.id, GoalSheet.cycle_year == 2026)
        )
        res = await db.execute(query)
        sheet = res.scalar_one_or_none()
        
        if not sheet:
            sheet = GoalSheet(
                user_id=current_user.id,
                cycle_year=2026,
                status=GoalSheetStatus.Draft,
                is_locked=False
            )
            db.add(sheet)
            await db.flush()
            
            return {
                "sheet": {
                    "id": sheet.id,
                    "cycle_year": sheet.cycle_year,
                    "status": sheet.status,
                    "is_locked": sheet.is_locked
                },
                "cycle_status": get_cycle_status(),
                "goals": []
            }
            
        # We also want tracking data for Phase 2 UI compatibility if needed
        tracking_query = select(QuarterlyTracking).join(Goal).where(Goal.sheet_id == sheet.id)
        tracking_res = await db.execute(tracking_query)
        tracking_records = tracking_res.scalars().all()
        
        return {
            "sheet": {
                "id": sheet.id,
                "cycle_year": sheet.cycle_year,
                "status": sheet.status,
                "is_locked": sheet.is_locked
            },
            "cycle_status": get_cycle_status(),
            "goals": [
                {
                    "id": g.id,
                    "thrust_area": g.thrust_area,
                    "title": g.title,
                    "description": g.description,
                    "uom": g.uom,
                    "target_value": g.target_value,
                    "weightage": g.weightage,
                    "deadline": g.deadline,
                    "is_shared": g.is_shared
                } for g in sheet.goals
            ],
            "tracking": [
                {
                    "id": t.id,
                    "goal_id": t.goal_id,
                    "quarter": t.quarter,
                    "actual_achievement": t.actual_achievement,
                    "status": t.status,
                    "completion_date": t.completion_date,
                    "manager_comment": t.manager_comment
                } for t in tracking_records
            ]
        }

@app.post("/api/v1/goals/submit", status_code=status.HTTP_200_OK)
async def submit_goal_sheet(
    payload: GoalSheetSubmitRequest, 
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(verify_role(["Employee", "Manager", "Admin"]))
):
    """
    Accepts a goal sheet payload. Checks if the sheet is already locked. 
    If valid, saves goals to the DB, updates GoalSheet status to 'Pending_Approval'.
    """
    async with db.begin():
        # Fetch the goal sheet
        result = await db.execute(select(GoalSheet).where(GoalSheet.id == payload.sheet_id))
        sheet = result.scalar_one_or_none()
        
        if not sheet:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goal sheet not found.")
            
        if sheet.is_locked:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot submit. This goal sheet is already locked.")
            
        # Fetch existing goals to handle shared goal logic and cleanup old non-shared goals
        existing_goals_result = await db.execute(select(Goal).where(Goal.sheet_id == sheet.id))
        existing_goals = {g.id: g for g in existing_goals_result.scalars().all()}
        
        # Clear out existing non-shared goals to replace them with the new payload submission
        for g_id, g in existing_goals.items():
            if not g.is_shared:
                await db.delete(g)
                
        # Process the submitted goals
        for goal_data in payload.goals:
            if goal_data.id and goal_data.id in existing_goals and existing_goals[goal_data.id].is_shared:
                # For shared goals (read-only stubs), ONLY update the weightage
                existing_goals[goal_data.id].weightage = goal_data.weightage
            else:
                # Ignore stale IDs from non-shared goals and cleanly route to create a brand-new Goal instance record
                new_goal = Goal(
                    sheet_id=sheet.id,
                    thrust_area=goal_data.thrust_area,
                    title=goal_data.title,
                    description=goal_data.description,
                    uom=goal_data.uom,
                    target_value=goal_data.target_value,
                    weightage=goal_data.weightage,
                    deadline=goal_data.deadline,
                    is_shared=False
                )
                db.add(new_goal)
                
        # Log employee resubmission if coming from Rework
        if sheet.status == GoalSheetStatus.Rework:
            await log_governance_action(
                db=db,
                goal_id=None,
                sheet_id=sheet.id,
                modified_by=current_user.id,
                action="EMPLOYEE_RESUBMISSION",
                old_values={"status": sheet.status.value},
                new_values={"status": GoalSheetStatus.Pending_Approval.value}
            )
            
        # Update sheet status to pending approval
        sheet.status = GoalSheetStatus.Pending_Approval
        # Calculate total weightage for notification
        total_weight = sum(g.weightage for g in payload.goals)
        
        # Get manager email
        manager_email = "Unknown Manager"
        if current_user.manager_id:
            mgr_res = await db.execute(select(User).where(User.id == current_user.manager_id))
            mgr = mgr_res.scalar_one_or_none()
            if mgr:
                manager_email = mgr.email

    await NotificationDispatcher.send_notification(
        event_type=NotificationType.GOAL_SUBMITTED.value,
        recipient_email=manager_email,
        employee_name=current_user.name,
        sheet_id=payload.sheet_id,
        contextual_data={"Total Weightage": f"{total_weight}%", "Department": current_user.department}
    )

    return {"message": "Goal sheet submitted successfully and is pending approval."}


@app.get("/api/v1/manager/team")
async def get_manager_team(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(verify_role(["Manager", "Admin"]))
):
    """
    Fetches a summary list of all employees reporting to the logged-in manager.
    Queries the User table and left joins the GoalSheet table for 2026.
    """
    async with db.begin():
        query = (
            select(User, GoalSheet)
            .outerjoin(GoalSheet, (User.id == GoalSheet.user_id) & (GoalSheet.cycle_year == 2026))
            .where(User.manager_id == current_user.id)
        )
        res = await db.execute(query)
        
        team = []
        for emp, sheet in res.all():
            team.append({
                "id": emp.id,
                "name": emp.name,
                "email": emp.email,
                "department": emp.department,
                "status": sheet.status if sheet else "No_Sheet",
                "sheet_id": sheet.id if sheet else None,
            })
        return team


@app.get("/api/v1/manager/employee/{employee_id}/tracking")
async def get_employee_tracking(
    employee_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(verify_role(["Manager", "Admin"]))
):
    """
    Fetches the 2026 GoalSheet, associated Goals, and QuarterlyTracking logs
    for a specific employee reporting to the manager.
    """
    async with db.begin():
        # Verify employee belongs to manager or user is admin
        emp_query = select(User).where(User.id == employee_id)
        res = await db.execute(emp_query)
        emp = res.scalar_one_or_none()
        
        if not emp:
            raise HTTPException(status_code=404, detail="Employee not found.")
            
        if current_user.role != UserRole.Admin and emp.manager_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized to view this employee.")
            
        sheet_query = (
            select(GoalSheet)
            .options(selectinload(GoalSheet.goals))
            .where(GoalSheet.user_id == employee_id, GoalSheet.cycle_year == 2026)
        )
        res = await db.execute(sheet_query)
        sheet = res.scalar_one_or_none()
        
        if not sheet:
            raise HTTPException(status_code=404, detail="No active goal sheet found for employee.")
            
        tracking_query = select(QuarterlyTracking).join(Goal).where(Goal.sheet_id == sheet.id)
        tracking_res = await db.execute(tracking_query)
        tracking_records = tracking_res.scalars().all()
        
        return {
            "sheet": {
                "id": sheet.id,
                "cycle_year": sheet.cycle_year,
                "status": sheet.status,
                "is_locked": sheet.is_locked
            },
            "cycle_status": get_cycle_status(),
            "goals": [
                {
                    "id": g.id,
                    "thrust_area": g.thrust_area,
                    "title": g.title,
                    "description": g.description,
                    "uom": g.uom,
                    "target_value": g.target_value,
                    "weightage": g.weightage,
                    "deadline": g.deadline,
                    "is_shared": g.is_shared
                } for g in sheet.goals
            ],
            "tracking": [
                {
                    "id": t.id,
                    "goal_id": t.goal_id,
                    "quarter": t.quarter,
                    "actual_achievement": t.actual_achievement,
                    "status": t.status,
                    "completion_date": t.completion_date,
                    "manager_comment": t.manager_comment
                } for t in tracking_records
            ]
        }
@app.post("/api/v1/manager/review/{sheet_id}")
async def manager_review(
    sheet_id: int, 
    payload: ManagerReviewRequest, 
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(verify_role(["Manager", "Admin"]))
):
    """
    Allows an L1 manager to approve, inline-edit target_values/weightages, 
    or return the sheet for rework. On 'Approved', set is_locked = True.
    """
    if payload.status not in [GoalSheetStatus.Approved, GoalSheetStatus.Rework]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Status must be 'Approved' or 'Rework'."
        )

    async with db.begin():
        result = await db.execute(select(GoalSheet).where(GoalSheet.id == sheet_id))
        sheet = result.scalar_one_or_none()
        
        if not sheet:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goal sheet not found.")
            
        # Enforce that locked sheets cannot be edited without admin privileges
        if sheet.is_locked:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, 
                detail="Goal sheet is already locked. Admin privileges are required to modify it."
            )
            
        # Apply inline edits if provided by the manager
        if payload.goal_edits:
            for edit in payload.goal_edits:
                goal_result = await db.execute(
                    select(Goal).where(Goal.id == edit.goal_id, Goal.sheet_id == sheet_id)
                )
                goal = goal_result.scalar_one_or_none()
                if not goal:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND, 
                        detail=f"Goal ID {edit.goal_id} not found in this sheet."
                    )
                
                old_values = {}
                new_values = {}
                if edit.target_value is not None and goal.target_value != edit.target_value:
                    old_values["target_value"] = goal.target_value
                    new_values["target_value"] = edit.target_value
                    goal.target_value = edit.target_value
                if edit.weightage is not None and goal.weightage != edit.weightage:
                    old_values["weightage"] = goal.weightage
                    new_values["weightage"] = edit.weightage
                    goal.weightage = edit.weightage
                    
                if old_values:
                    await log_governance_action(
                        db=db,
                        goal_id=goal.id,
                        sheet_id=sheet.id,
                        modified_by=current_user.id,
                        action="MANAGER_INLINE_EDIT",
                        old_values=old_values,
                        new_values=new_values
                    )
                    
        # Update the overall sheet status
        if sheet.status != payload.status:
            await log_governance_action(
                db=db,
                goal_id=None,
                sheet_id=sheet.id,
                modified_by=current_user.id,
                action="MANAGER_STATUS_UPDATE",
                old_values={"status": sheet.status.value},
                new_values={"status": payload.status.value}
            )
            sheet.status = payload.status
        
        # Lock the sheet upon approval
        if payload.status == GoalSheetStatus.Approved:
            sheet.is_locked = True
            
        emp_res = await db.execute(select(User).where(User.id == sheet.user_id))
        employee = emp_res.scalar_one_or_none()

    if employee:
        event_type = NotificationType.GOAL_APPROVED.value if payload.status == GoalSheetStatus.Approved else NotificationType.GOAL_REWORK.value
        await NotificationDispatcher.send_notification(
            event_type=event_type,
            recipient_email=employee.email,
            employee_name=employee.name,
            sheet_id=sheet_id,
            contextual_data={"Manager": current_user.name, "Status": payload.status.value}
        )

    return {"message": f"Goal sheet review completed. Status set to {payload.status.value}."}


@app.post("/api/v1/admin/goals/shared")
async def broadcast_shared_goal(
    payload: AdminSharedGoalRequest, 
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(verify_role(["Admin"]))
):
    """
    Allows admins to broadcast a departmental KPI goal to all employees in a specific department. 
    Ensures is_shared is True, and creates corresponding read-only goal stubs for those employees 
    where they can only modify the weightage during submission.
    """
    async with db.begin():
        # Find all employees in the targeted department
        users_result = await db.execute(
            select(User).where(User.department == payload.department, User.role == UserRole.Employee)
        )
        employees = users_result.scalars().all()
        
        if not employees:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, 
                detail=f"No employees found in the '{payload.department}' department."
            )
            
        # Create a shared goal stub for each employee's goal sheet
        for emp in employees:
            # Check if a goal sheet exists for the given cycle year
            sheet_result = await db.execute(
                select(GoalSheet).where(
                    GoalSheet.user_id == emp.id, 
                    GoalSheet.cycle_year == payload.cycle_year
                )
            )
            sheet = sheet_result.scalar_one_or_none()
            
            if not sheet:
                # Create a fresh draft sheet if one does not exist for the employee yet
                sheet = GoalSheet(
                    user_id=emp.id,
                    cycle_year=payload.cycle_year,
                    status=GoalSheetStatus.Draft,
                    is_locked=False
                )
                db.add(sheet)
                await db.flush() # Flush to get the new sheet ID immediately
                
            # Prevent duplicate shared goal pushes
            existing_shared_goal_res = await db.execute(
                select(Goal).where(
                    Goal.sheet_id == sheet.id, 
                    Goal.title == payload.title, 
                    Goal.is_shared == True
                )
            )
            if existing_shared_goal_res.scalar_one_or_none():
                continue

            # Create the read-only shared goal stub (is_shared=True)
            shared_goal = Goal(
                sheet_id=sheet.id,
                thrust_area=payload.thrust_area,
                title=payload.title,
                description=payload.description,
                uom=payload.uom,
                target_value=payload.target_value,
                weightage=payload.weightage,
                deadline=payload.deadline,
                is_shared=True
            )
            db.add(shared_goal)

    return {
        "message": f"Shared departmental goal successfully broadcasted to {len(employees)} employees."
    }

@app.put("/api/v1/tracking/employee/update")
async def employee_update_tracking(
    payload: EmployeeTrackingUpdate, 
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(verify_role(["Employee", "Manager", "Admin"]))
):
    """
    Allows employees to log their actual_achievement, select a status, and record completion_date.
    Only allowed if the parent GoalSheet is locked (is_locked=True).
    """
    async with db.begin():
        # Verify Goal and GoalSheet
        result = await db.execute(
            select(Goal, GoalSheet).join(GoalSheet, Goal.sheet_id == GoalSheet.id).where(Goal.id == payload.goal_id)
        )
        row = result.first()
        if not row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goal not found.")
        
        goal, sheet = row
        if not sheet.is_locked:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Tracking updates are only allowed for locked goal sheets.")
            
        # Update or Create Tracking Record
        tracking_result = await db.execute(
            select(QuarterlyTracking).where(
                QuarterlyTracking.goal_id == payload.goal_id, 
                QuarterlyTracking.quarter == payload.quarter
            )
        )
        tracking = tracking_result.scalar_one_or_none()
        
        if not tracking:
            tracking = QuarterlyTracking(
                goal_id=payload.goal_id,
                quarter=payload.quarter,
                actual_achievement=payload.actual_achievement,
                status=payload.status,
                completion_date=payload.completion_date
            )
            db.add(tracking)
        else:
            tracking.actual_achievement = payload.actual_achievement
            tracking.status = payload.status
            tracking.completion_date = payload.completion_date
            tracking.updated_at = func.now()
            
    return {"message": "Quarterly tracking updated successfully."}


@app.post("/api/v1/tracking/manager/checkin")
async def manager_checkin(
    payload: ManagerCheckinRequest, 
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(verify_role(["Manager", "Admin"]))
):
    """
    Allows the manager to view targets vs actuals, compute progress score, and save a mandatory manager_comment.
    """
    async with db.begin():
        # Fetch tracking and goal
        result = await db.execute(
            select(QuarterlyTracking, Goal).join(Goal, QuarterlyTracking.goal_id == Goal.id).where(
                QuarterlyTracking.goal_id == payload.goal_id,
                QuarterlyTracking.quarter == payload.quarter
            )
        )
        row = result.first()
        if not row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tracking record not found for the specified quarter.")
            
        tracking, goal = row
        
        # Save manager comment
        tracking.manager_comment = payload.manager_comment
        tracking.updated_at = func.now()
        
        # Compute progress score dynamically
        score = compute_progress_score(
            uom=goal.uom.value,
            target=goal.target_value,
            actual=tracking.actual_achievement,
            deadline=goal.deadline,
            completion_date=tracking.completion_date
        )
        
    return {
        "message": "Manager check-in completed.",
        "progress_score": score,
        "target_value": goal.target_value,
        "actual_achievement": tracking.actual_achievement,
        "manager_comment": tracking.manager_comment
    }


@app.get("/api/v1/reports/achievement/export")
async def export_achievements(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(verify_role(["Admin"]))
):
    """
    Generates a flat JSON dataset compiled for clean Excel/CSV parsing.
    """
    query = (
        select(User, Goal, GoalSheet, QuarterlyTracking)
        .join(GoalSheet, User.id == GoalSheet.user_id)
        .join(Goal, GoalSheet.id == Goal.sheet_id)
        .join(QuarterlyTracking, Goal.id == QuarterlyTracking.goal_id)
    )
    
    result = await db.execute(query)
    rows = result.all()
    
    # Pre-fetch users for manager name mapping
    users_result = await db.execute(select(User))
    user_map = {u.id: u for u in users_result.scalars().all()}
    
    export_data = []
    for employee, goal, sheet, tracking in rows:
        manager = user_map.get(employee.manager_id) if employee.manager_id else None
        manager_name = manager.name if manager else "N/A"
        
        score = compute_progress_score(
            uom=goal.uom.value,
            target=goal.target_value,
            actual=tracking.actual_achievement,
            deadline=goal.deadline,
            completion_date=tracking.completion_date
        )
        
        export_data.append({
            "Employee Name": employee.name,
            "Department": employee.department,
            "Manager Name": manager_name,
            "Goal Title": goal.title,
            "Thrust Area": goal.thrust_area,
            "UoM": goal.uom.value,
            "Target": goal.target_value,
            "Quarter": tracking.quarter.value,
            "Actual Achievement": tracking.actual_achievement,
            "Computed Progress Score": score,
            "Manager Comments": tracking.manager_comment
        })
        
    return export_data


@app.get("/api/v1/admin/dashboard/completion")
async def get_dashboard_completion(
    current_quarter: Quarter,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(verify_role(["Admin"]))
):
    """
    Returns organization state for the active quarter including completion stats and missing check-ins.
    """
    # 1. Total employees
    emp_result = await db.execute(select(func.count(User.id)).where(User.role == UserRole.Employee))
    total_employees = emp_result.scalar() or 0

    # 2. Total submitted sheets vs pending drafts
    sheets_result = await db.execute(select(GoalSheet.status, func.count(GoalSheet.id)).group_by(GoalSheet.status))
    sheet_counts = dict(sheets_result.all())
    
    sheets_pending_draft = sheet_counts.get(GoalSheetStatus.Draft, 0)
    sheets_submitted = sum(count for status, count in sheet_counts.items() if status != GoalSheetStatus.Draft)

    # 3. Missing employee updates
    # Find employees whose goals don't have tracking in current quarter OR status is 'Not Started'
    missing_emps_query = (
        select(User.id, User.name, User.department)
        .join(GoalSheet, User.id == GoalSheet.user_id)
        .join(Goal, GoalSheet.id == Goal.sheet_id)
        .outerjoin(
            QuarterlyTracking, 
            (Goal.id == QuarterlyTracking.goal_id) & (QuarterlyTracking.quarter == current_quarter)
        )
        .where(
            (QuarterlyTracking.id == None) | (QuarterlyTracking.status == TrackingStatus.Not_Started)
        )
        .distinct()
    )
    missing_emps_result = await db.execute(missing_emps_query)
    missing_employee_updates = [
        {"id": r.id, "name": r.name, "department": r.department}
        for r in missing_emps_result.all()
    ]

    # 4. Missing manager check-ins
    # Find tracking entries for current_quarter where manager_comment is null/empty
    missing_mgr_query = (
        select(User.id.label("employee_id"), User.name.label("employee_name"), User.manager_id, Goal.id.label("goal_id"), Goal.title)
        .join(GoalSheet, User.id == GoalSheet.user_id)
        .join(Goal, GoalSheet.id == Goal.sheet_id)
        .join(QuarterlyTracking, Goal.id == QuarterlyTracking.goal_id)
        .where(QuarterlyTracking.quarter == current_quarter)
        .where((QuarterlyTracking.manager_comment == None) | (QuarterlyTracking.manager_comment == ""))
    )
    missing_mgr_result = await db.execute(missing_mgr_query)
    missing_manager_checkins = [
        {
            "employee_id": r.employee_id, 
            "employee_name": r.employee_name, 
            "manager_id": r.manager_id, 
            "goal_id": r.goal_id, 
            "goal_title": r.title
        }
        for r in missing_mgr_result.all()
    ]

    return {
        "total_employees": total_employees,
        "sheets_submitted": sheets_submitted,
        "sheets_pending_draft": sheets_pending_draft,
        "missing_employee_updates": missing_employee_updates,
        "missing_manager_checkins": missing_manager_checkins
    }

@app.post("/api/v1/admin/sheets/{sheet_id}/unlock")
async def unlock_goal_sheet(
    sheet_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(verify_role(["Admin"]))
):
    """
    Allows an administrator to flip is_locked = False on an approved goal sheet for emergency modifications.
    """
    async with db.begin():
        result = await db.execute(select(GoalSheet).where(GoalSheet.id == sheet_id))
        sheet = result.scalar_one_or_none()
        
        if not sheet:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goal sheet not found.")
            
        if not sheet.is_locked:
            return {"message": "Goal sheet is already unlocked."}
            
        # Flip is_locked to False and change status to Rework
        sheet.is_locked = False
        old_status = sheet.status.value
        sheet.status = GoalSheetStatus.Rework
        
        # Log governance action
        await log_governance_action(
            db=db,
            goal_id=None,
            sheet_id=sheet.id,
            modified_by=current_user.id,
            action="UNLOCK_SHEET",
            old_values={"is_locked": True, "status": old_status},
            new_values={"is_locked": False, "status": GoalSheetStatus.Rework.value}
        )
        
    return {"message": f"Goal sheet {sheet_id} successfully unlocked and set to Rework."}

@app.get("/api/v1/admin/audit-logs")
async def get_audit_logs(
    limit: int = Query(50, ge=1, le=100),
    skip: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(verify_role(["Admin"]))
):
    """
    Returns a paginated list of all post-lock governance adjustments ordered chronologically by timestamp.
    """
    query = select(AuditLog).order_by(AuditLog.timestamp.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    logs = result.scalars().all()
    
    return [
        {
            "id": log.id,
            "goal_id": log.goal_id,
            "sheet_id": log.sheet_id,
            "modified_by": log.modified_by,
            "action": log.action,
            "old_values": log.old_values,
            "new_values": log.new_values,
            "timestamp": log.timestamp
        }
        for log in logs
    ]

@app.post("/api/v1/auth/azure-sso-callback")
async def azure_sso_callback(payload: AzureADTokenPayload, db: AsyncSession = Depends(get_db)):
    """
    Simulates the final sign-in step. Accepts a mock JSON payload representing the decoded Azure AD token data, 
    passes it directly to sync_user_from_azure_ad_claims, executes the internal state updates cleanly 
    inside a transaction block, and returns an updated user initialization package.
    """
    try:
        async with db.begin():
            user = await sync_user_from_azure_ad_claims(db, payload)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
        
    return {
        "message": "User authenticated and synchronized successfully.",
        "user": {
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "role": user.role.value,
            "department": user.department,
            "manager_id": user.manager_id
        }
    }

@app.post("/api/v1/admin/directory/sync-all")
async def sync_all_directory(
    payload_list: List[AzureADTokenPayload], 
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(verify_role(["Admin"]))
):
    """
    Accessible only by Admin. Simulates a batch synchronization cron job by accepting a list 
    of AzureADTokenPayload data components to rebuild the organizational hierarchy from scratch safely in bulk.
    """
    async with db.begin():
        # Pass 1: Upsert all users (ensures accounts exist for hierarchy mapping)
        for token_data in payload_list:
            try:
                await sync_user_from_azure_ad_claims(db, token_data)
            except ValueError:
                # Skip invalid payloads missing critical info like emails
                continue
                
        await db.flush()
        
        # Pass 2: Re-run hierarchy mapping to resolve any missing manager links that were created in pass 1
        for token_data in payload_list:
            if token_data.manager_email:
                try:
                    await sync_user_from_azure_ad_claims(db, token_data)
                except ValueError:
                    continue
        
    return {
        "message": f"Successfully synchronized {len(payload_list)} users from Enterprise Directory."
    }

@app.post("/api/v1/admin/notifications/remind-quarter")
async def remind_quarter_updates(
    payload: RemindQuarterRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(verify_role(["Admin"]))
):
    """
    Scans the database for employees who have not completed their updates for the target quarter
    and fires a batch of CHECKIN_REMINDER notifications.
    """
    missing_emps_query = (
        select(User.id, User.email, User.name, User.department, GoalSheet.id.label("sheet_id"))
        .join(GoalSheet, User.id == GoalSheet.user_id)
        .join(Goal, GoalSheet.id == Goal.sheet_id)
        .outerjoin(
            QuarterlyTracking, 
            (Goal.id == QuarterlyTracking.goal_id) & (QuarterlyTracking.quarter == payload.quarter)
        )
        .where(
            (QuarterlyTracking.id == None) | (QuarterlyTracking.status == TrackingStatus.Not_Started)
        )
        .distinct()
    )
    
    result = await db.execute(missing_emps_query)
    employees_to_remind = result.all()
    
    dispatched_count = 0
    for r in employees_to_remind:
        await NotificationDispatcher.send_notification(
            event_type=NotificationType.CHECKIN_REMINDER.value,
            recipient_email=r.email,
            employee_name=r.name,
            sheet_id=r.sheet_id,
            contextual_data={"Quarter": payload.quarter.value, "Department": r.department}
        )
        dispatched_count += 1
        
    return {"message": f"Successfully dispatched {dispatched_count} CHECKIN_REMINDER notifications."}

@app.post("/api/v1/admin/escalations/trigger-check")
async def trigger_escalation_check(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(verify_role(["Admin"]))
):
    """
    Administrative trigger to run the process_escalation_rules service evaluation loop.
    """
    async with db.begin():
        report = await EscalationEngine.process_escalation_rules(db)
    return {"message": "Escalation check completed", "report": report}

@app.get("/api/v1/admin/escalations/logs")
async def get_escalation_logs(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(verify_role(["Admin"]))
):
    """
    Returns a list of all active, unresolved escalation instances.
    """
    query = select(EscalationLog).where(EscalationLog.resolved == False)
    res = await db.execute(query)
    logs = res.scalars().all()
    
    return [
        {
            "id": l.id,
            "rule_id": l.rule_id,
            "user_id": l.user_id,
            "current_handler_id": l.current_handler_id,
            "action_taken": l.action_taken,
            "days_overdue": l.days_overdue,
            "created_at": l.created_at
        }
        for l in logs
    ]

@app.post("/api/v1/admin/escalations/resolve/{log_id}")
async def resolve_escalation(
    log_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(verify_role(["Admin"]))
):
    """
    Allows admins to manually mark an escalation record as resolved or dismissed.
    """
    async with db.begin():
        res = await db.execute(select(EscalationLog).where(EscalationLog.id == log_id))
        log_entry = res.scalar_one_or_none()
        
        if not log_entry:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Escalation log not found.")
            
        log_entry.resolved = True
        log_entry.action_taken = f"Resolved manually by Admin {current_user.id}"
        
    return {"message": f"Escalation log {log_id} resolved."}

# ==========================================
# Advanced Analytics & Aggregation Engine
# ==========================================
from sqlalchemy.orm import aliased
from sqlalchemy import case

@app.get("/api/v1/analytics/performance-trends")
async def get_performance_trends(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(verify_role(["Admin"]))
):
    """
    Computes the average dynamic progress score across the organization.
    Returns a structured timeline array grouped by Quarter.
    """
    actual_val = func.coalesce(QuarterlyTracking.actual_achievement, 0.0)
    
    score_expr = case(
        (Goal.uom == UOM.Numeric_Min, func.coalesce((actual_val / func.nullif(Goal.target_value, 0)) * 100.0, 0.0)),
        (Goal.uom == UOM.Numeric_Max, func.coalesce((Goal.target_value / func.nullif(actual_val, 0)) * 100.0, 0.0)),
        (Goal.uom == UOM.Timeline, case((QuarterlyTracking.completion_date <= Goal.deadline, 100.0), else_=0.0)),
        (Goal.uom == UOM.Zero_Based, case((actual_val == 0, 100.0), else_=0.0)),
        else_=0.0
    )
    
    query = (
        select(
            QuarterlyTracking.quarter,
            func.avg(score_expr).label("average_progress_score"),
            func.count(QuarterlyTracking.id).label("total_active_goals_tracked")
        )
        .join(Goal, QuarterlyTracking.goal_id == Goal.id)
        .group_by(QuarterlyTracking.quarter)
    )
    
    res = await db.execute(query)
    results = res.all()
    
    return [
        {
            "quarter": row.quarter.value if row.quarter else "Unknown",
            "average_progress_score": round(float(row.average_progress_score), 2) if row.average_progress_score is not None else 0.0,
            "total_active_goals_tracked": row.total_active_goals_tracked
        }
        for row in results
    ]

@app.get("/api/v1/analytics/goal-distribution")
async def get_goal_distribution(
    current_quarter: Optional[Quarter] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(verify_role(["Admin"]))
):
    """
    Generates data matrices to feed distribution charts and heatmaps.
    """
    # by_thrust_area
    thrust_query = select(Goal.thrust_area, func.count(Goal.id)).group_by(Goal.thrust_area)
    thrust_res = await db.execute(thrust_query)
    by_thrust_area = [{"thrust_area": row[0], "count": row[1]} for row in thrust_res.all()]
    
    # by_uom_and_status
    uom_status_query = (
        select(Goal.uom, QuarterlyTracking.status, func.count(Goal.id))
        .join(QuarterlyTracking, Goal.id == QuarterlyTracking.goal_id)
    )
    if current_quarter:
        uom_status_query = uom_status_query.where(QuarterlyTracking.quarter == current_quarter)
        
    uom_status_query = uom_status_query.group_by(Goal.uom, QuarterlyTracking.status)
    uom_status_res = await db.execute(uom_status_query)
    
    by_uom_and_status = []
    for row in uom_status_res.all():
        by_uom_and_status.append({
            "uom": row[0].value if row[0] else "Unknown",
            "status": row[1].value if row[1] else "Unknown",
            "count": row[2]
        })
        
    return {
        "by_thrust_area": by_thrust_area,
        "by_uom_and_status": by_uom_and_status
    }

@app.get("/api/v1/admin/export")
async def export_employee_progress(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(verify_role(["Admin"]))
):
    query = (
        select(
            User.name.label("employee_name"),
            User.department.label("department"),
            User.email.label("email"),
            GoalSheet.cycle_year,
            Goal.thrust_area,
            Goal.title,
            Goal.target_value,
            Goal.uom,
            Goal.weightage,
            QuarterlyTracking.quarter,
            QuarterlyTracking.actual_achievement,
            QuarterlyTracking.status,
            QuarterlyTracking.completion_date,
            QuarterlyTracking.manager_comment
        )
        .select_from(User)
        .join(GoalSheet, GoalSheet.user_id == User.id)
        .join(Goal, Goal.sheet_id == GoalSheet.id)
        .outerjoin(QuarterlyTracking, QuarterlyTracking.goal_id == Goal.id)
        .order_by(User.name, Goal.title, QuarterlyTracking.quarter)
    )
    
    res = await db.execute(query)
    rows = res.all()
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Employee Name", "Department", "Email", "Cycle Year",
        "Thrust Area", "Goal Title", "Target Value", "UOM", "Weightage",
        "Quarter", "Actual Achievement", "Status", "Completion Date", "Manager Comment"
    ])
    
    for row in rows:
        writer.writerow([
            row.employee_name,
            row.department,
            row.email,
            row.cycle_year,
            row.thrust_area,
            row.title,
            row.target_value,
            row.uom.value if row.uom else "",
            row.weightage,
            row.quarter.value if row.quarter else "",
            row.actual_achievement,
            row.status.value if row.status else "",
            row.completion_date,
            row.manager_comment
        ])
    
    output.seek(0)
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=atomberg_progress_export.csv"}
    )


@app.get("/api/v1/analytics/manager-effectiveness")
async def get_manager_effectiveness(
    current_quarter: Quarter,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(verify_role(["Admin"]))
):
    """
    Evaluates management compliance performance and generates a leaderboard.
    """
    Employee = aliased(User)
    Manager = aliased(User)
    
    query = (
        select(
            Manager.id.label("manager_id"),
            Manager.name.label("manager_name"),
            Manager.department.label("department"),
            func.count(func.distinct(Employee.id)).label("total_direct_reports"),
            func.count(Goal.id).label("total_possible_logs"),
            func.sum(
                case(
                    (QuarterlyTracking.manager_comment.is_not(None) & (QuarterlyTracking.manager_comment != ""), 1),
                    else_=0
                )
            ).label("completed_checkins_count")
        )
        .select_from(Manager)
        .join(Employee, Employee.manager_id == Manager.id)
        .outerjoin(GoalSheet, GoalSheet.user_id == Employee.id)
        .outerjoin(Goal, Goal.sheet_id == GoalSheet.id)
        .outerjoin(QuarterlyTracking, (QuarterlyTracking.goal_id == Goal.id) & (QuarterlyTracking.quarter == current_quarter))
        .group_by(Manager.id, Manager.name, Manager.department)
    )
    
    res = await db.execute(query)
    results = res.all()
    
    leaderboard = []
    for row in results:
        possible_logs = row.total_possible_logs or 0
        completed = row.completed_checkins_count or 0
        rate = round((completed / possible_logs * 100.0), 2) if possible_logs > 0 else 0.0
        
        leaderboard.append({
            "manager_id": row.manager_id,
            "manager_name": row.manager_name,
            "department": row.department,
            "total_direct_reports": row.total_direct_reports,
            "completed_checkins_count": completed,
            "compliance_rate": rate
        })
        
    # Sort leaderboard by compliance_rate descending
    leaderboard.sort(key=lambda x: x["compliance_rate"], reverse=True)
        
    return leaderboard
