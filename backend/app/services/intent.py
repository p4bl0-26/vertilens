import uuid
from datetime import datetime, timezone
from app.models.domain import IntentRequest, IntentPlan, IntentStatus, IntentStep

class IntentParserService:
    """
    Mock LLM intent parser service.
    In a real app, this would construct a prompt from the raw string, 
    call OpenAI/Anthropic, and validate the output against a schema.
    """
    
    @staticmethod
    async def parse_intent(request: IntentRequest) -> IntentPlan:
        # Dummy parsing logic
        
        step1 = IntentStep(
            stepIndex=0,
            description="Bridge ETH from source chain to target chain via Across",
            actionType="BRIDGE",
            protocol="Across",
            chainId=request.sourceChainId,
            value="10000000000000000" # 0.01 ETH
        )
        
        step2 = IntentStep(
            stepIndex=1,
            description="Swap ETH for USDC on target chain",
            actionType="SWAP",
            protocol="Uniswap V3",
            chainId=8453, # Base
        )
        
        return IntentPlan(
            intentId=request.id,
            status=IntentStatus.PARSED,
            summary=f"Parsed intent: {request.rawInput}",
            steps=[step1, step2],
            chainIds=[request.sourceChainId, 8453],
            parsedAt=datetime.now(timezone.utc).isoformat(),
            parserConfidence=0.92
        )
