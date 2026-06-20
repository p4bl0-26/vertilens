import asyncio

class MockAgentWorker:
    """
    Mock agent worker loop.
    In production, this would pop jobs from a queue (e.g. Redis/RabbitMQ) 
    and dispatch them to ONCHAIN, API, or PLAYWRIGHT executors.
    """
    
    @staticmethod
    async def process_job(job_id: str, intent_id: str, plan):
        from app.models.domain import IntentStatus
        from app.api.endpoints import intent_db
        
        print(f"[{job_id}] Agent worker picked up job for intent {intent_id}.")
        await asyncio.sleep(2)
        
        print(f"[{job_id}] Executing Task 1 (BRIDGE)...")
        await asyncio.sleep(4)
        print(f"[{job_id}] Task 1 Complete.")
        
        print(f"[{job_id}] Executing Task 2 (SWAP)...")
        await asyncio.sleep(4)
        print(f"[{job_id}] Task 2 Complete.")
        
        print(f"[{job_id}] Job fully completed.")
        
        # Mark as success
        plan.status = IntentStatus.SUCCESS
        if intent_id in intent_db:
            intent_db[intent_id].status = IntentStatus.SUCCESS
        
# Entrypoint for standalone worker process
if __name__ == "__main__":
    print("Starting Nexora Agent Worker Loop...")
    loop = asyncio.get_event_loop()
    loop.run_forever()
