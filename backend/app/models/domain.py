from typing import List, Optional, Any, Dict
from pydantic import BaseModel, Field
from enum import Enum
from datetime import datetime

class IntentStatus(str, Enum):
    CREATED = "CREATED"
    PARSED = "PARSED"
    APPROVED = "APPROVED"
    EXECUTING = "EXECUTING"
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"

class IntentStep(BaseModel):
    stepIndex: int
    description: str
    actionType: str
    protocol: str
    chainId: int
    contractAddress: Optional[str] = None
    calldata: Optional[str] = None
    value: Optional[str] = None
    optional: Optional[bool] = False

class IntentPlan(BaseModel):
    intentId: str
    status: IntentStatus
    summary: str
    steps: List[IntentStep]
    chainIds: List[int]
    estimatedCostUsd: Optional[str] = None
    estimatedDurationSeconds: Optional[int] = None
    parsedAt: str
    parserConfidence: float

class IntentRequest(BaseModel):
    id: str
    userAddress: str
    rawInput: str
    sourceChainId: int
    createdAt: str
    status: IntentStatus
    
# Re-exported for fast-api endpoints
class CreateIntentPayload(BaseModel):
    userAddress: str
    rawInput: str
    sourceChainId: int
