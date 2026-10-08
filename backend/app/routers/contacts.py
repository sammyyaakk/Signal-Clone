from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import Contact, User
from ..schemas import ContactIn, UserOut

router = APIRouter(prefix="/contacts", tags=["contacts"])


@router.get("", response_model=list[UserOut])
def list_contacts(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    contacts = db.scalars(select(Contact).where(Contact.owner_id == user.id))
    return sorted((c.contact for c in contacts), key=lambda u: u.display_name.lower())


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def add_contact(body: ContactIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    other = db.scalar(select(User).where(User.phone == body.phone))
    if not other:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "This number is not registered on Signal")
    if other.id == user.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "You can't add yourself as a contact")
    db.merge(Contact(owner_id=user.id, contact_id=other.id))
    db.commit()
    return other
