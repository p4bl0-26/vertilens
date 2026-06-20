import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends, Header, BackgroundTasks
from app.models.domain import CreateIntentPayload, IntentRequest, IntentStatus, IntentPlan
from app.services.intent import IntentParserService
from app.workers.agent import MockAgentWorker

router = APIRouter()

# In-memory storage for hackathon demo
intent_db = {}
plan_db = {}

def get_api_key(x_api_key: str = Header(...)):
    from app.core.config import settings
    if x_api_key != settings.API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API Key")
    return x_api_key

@router.post("/intent")
async def create_intent(payload: CreateIntentPayload):
    intent_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    request = IntentRequest(
        id=intent_id,
        userAddress=payload.userAddress,
        rawInput=payload.rawInput,
        sourceChainId=payload.sourceChainId,
        createdAt=now,
        status=IntentStatus.CREATED
    )
    
    intent_db[intent_id] = request
    
    # Trigger parser synchronously for MVP
    plan = await IntentParserService.parse_intent(request)
    request.status = IntentStatus.PARSED
    plan_db[intent_id] = plan
    
    return {
        "success": True,
        "data": {
            "request": request.model_dump(),
            "plan": plan.model_dump()
        }
    }

@router.get("/intent/{intent_id}")
async def get_intent(intent_id: str):
    if intent_id not in intent_db:
        raise HTTPException(status_code=404, detail="Intent not found")
        
    return {
        "success": True,
        "data": {
            "request": intent_db[intent_id].model_dump(),
            "plan": plan_db.get(intent_id, {}).model_dump() if intent_id in plan_db else None
        }
    }

@router.post("/intent/{intent_id}/approve")
async def approve_intent(intent_id: str, background_tasks: BackgroundTasks):
    if intent_id not in plan_db:
        raise HTTPException(status_code=404, detail="Plan not found")
        
    plan = plan_db[intent_id]
    plan.status = IntentStatus.EXECUTING
    plan.approvedAt = datetime.now(timezone.utc).isoformat()
    
    # Update the parent request status as well
    if intent_id in intent_db:
        intent_db[intent_id].status = IntentStatus.EXECUTING
    
    # Enqueue the AgentJob in the background
    job_id = f"job_{uuid.uuid4().hex[:8]}"
    background_tasks.add_task(MockAgentWorker.process_job, job_id, intent_id, plan)
    
    return {
        "success": True,
        "data": {
            "plan": plan.model_dump(),
            "jobId": job_id
        }
    }
