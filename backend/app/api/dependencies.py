from typing import Annotated, List, Optional

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.db.session import get_db
from app.models.models import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

async def get_current_user(token: Annotated[str, Depends(oauth2_scheme)], db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception
    email: str = payload.get("sub")
    if email is None:
        raise credentials_exception
    
    user = db.scalar(select(User).where(User.email == email))
    if user is None:
        raise credentials_exception
    return user

class RequireRole:
    def __init__(self, allowed_roles: List[str]):
        self.allowed_roles = [r.upper() for r in allowed_roles]

    def __call__(
        self,
        request: Request = None,  # type: ignore
        user: Annotated[User, Depends(get_current_user)] = None,  # type: ignore
        db: Session = Depends(get_db)
    ):
        # Support direct invocation e.g. RequireRole(...)(user)
        if user is None and request is not None and hasattr(request, "role"):
            user = request
            request = None

        u_role = (getattr(user, "role", "") or "").upper()
        if "ADMIN" in u_role:
            return user
        authorized = False
        for allowed in self.allowed_roles:
            if allowed in u_role or u_role in allowed:
                authorized = True
                break
        if not authorized:
            # Log security event and audit log for unauthorized access if request and db exist
            try:
                if request is not None and db is not None:
                    from app.core.audit import log_action
                    from app.core.security_monitor import record_security_event, create_security_alert
                    path = getattr(request.url, "path", "/restricted")
                    method = getattr(request, "method", "ACCESS")
                    log_action(
                        db=db,
                        user_email=getattr(user, "email", "UNKNOWN"),
                        action="UNAUTHORIZED_ACCESS_ATTEMPT",
                        entity_type="SECURITY_RBAC",
                        entity_id=path,
                        details={"role": getattr(user, "role", "UNKNOWN"), "method": method, "required_roles": self.allowed_roles}
                    )
                    record_security_event(
                        db=db,
                        event_type="UNAUTHORIZED_ACCESS",
                        component="RBAC Authorization Engine",
                        severity="HIGH",
                        status="BLOCKED",
                        reason=f"Role '{getattr(user, 'role', 'UNKNOWN')}' attempted restricted resource requiring {', '.join(self.allowed_roles)}",
                        user_email=getattr(user, "email", "UNKNOWN"),
                        user_role=getattr(user, "role", "UNKNOWN"),
                        requested_resource=path,
                        action=method,
                        details={"required_roles": self.allowed_roles}
                    )
            except Exception:
                pass
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Operation not permitted. Required role: {', '.join(self.allowed_roles)}"
            )
        return user


