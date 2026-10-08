import os

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./signal.db")
# Comma-separated list; auth uses bearer tokens (not cookies), so "*" is safe for the demo.
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "*").split(",")
# Phone verification is mocked: every number accepts this code.
MOCK_OTP = "123456"
