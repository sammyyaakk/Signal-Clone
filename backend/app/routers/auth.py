import secrets

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from ..config import MOCK_OTP
from ..database import get_db
from ..deps import bearer
from ..models import AuthSession, User
from ..schemas import AuthOut, UserOut, VerifyIn

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/verify", response_model=AuthOut)
def verify(body: VerifyIn, db: Session = Depends(get_db)):
    """Mocked phone verification: registers the number on first use, then issues a session token."""
    if body.otp != MOCK_OTP:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect verification code")
    user = db.scalar(select(User).where(User.phone == body.phone))
    if not user:
        user = User(phone=body.phone)
        db.add(user)
        db.flush()
    token = secrets.token_hex(32)
    db.add(AuthSession(token=token, user_id=user.id))
    db.commit()
    return AuthOut(token=token, user=UserOut.model_validate(user), needs_profile=not user.display_name)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(creds: HTTPAuthorizationCredentials = Depends(bearer), db: Session = Depends(get_db)):
    db.execute(delete(AuthSession).where(AuthSession.token == creds.credentials))
    db.commit()
