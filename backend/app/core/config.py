import os
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "Nexora Web3 Intent Platform"
    VERSION: str = "0.1.0"
    API_V1_STR: str = "/v1"
    
    # Security
    API_KEY: str = "dev_api_key_123"
    
    # Blockchain RPCs
    RPC_MAINNET: str = ""
    RPC_SEPOLIA: str = ""
    
    # LLM Settings (for parsing intents)
    OPENAI_API_KEY: str = ""
    
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

settings = Settings()
