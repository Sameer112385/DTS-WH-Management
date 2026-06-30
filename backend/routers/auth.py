from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta
from typing import List
from backend.database import get_db
from backend.models import User, AuditTrail
from backend.schemas import UserCreate, UserResponse, Token, UserLogin, UserUpdate
from backend.auth import (
    verify_password, 
    get_password_hash, 
    create_access_token, 
    get_current_user,
    RoleChecker
)

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/register", response_model=UserResponse)
def register(
    user_in: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["Admin"]))
):
    db_user = db.query(User).filter(User.username == user_in.username).first()
    if db_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered"
        )
        
    hashed_pwd = get_password_hash(user_in.password)
    user = User(
        username=user_in.username,
        hashed_password=hashed_pwd,
        name=user_in.name,
        email=user_in.email,
        mobile=user_in.mobile,
        role=user_in.role,
        is_active=True
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Log action
    audit = AuditTrail(
        username="System",
        action="User Registered",
        remarks=f"Registered user {user.username} with role {user.role}"
    )
    db.add(audit)
    db.commit()

    return user

@router.post("/users", response_model=UserResponse)
def create_user(
    user_in: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["Admin"]))
):
    db_user = db.query(User).filter(User.username == user_in.username).first()
    if db_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered"
        )

    hashed_pwd = get_password_hash(user_in.password)
    user = User(
        username=user_in.username,
        hashed_password=hashed_pwd,
        name=user_in.name,
        email=user_in.email,
        mobile=user_in.mobile,
        role=user_in.role,
        is_active=True
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    audit = AuditTrail(
        user_id=current_user.id,
        username=current_user.username,
        action="User Created",
        remarks=f"Created user {user.username} with role {user.role}"
    )
    db.add(audit)
    db.commit()

    return user

@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )
        
    access_token = create_access_token(
        data={"sub": user.username, "role": user.role}
    )
    
    # Log action
    audit = AuditTrail(
        user_id=user.id,
        username=user.username,
        action="User Login",
        remarks=f"User {user.username} logged in successfully"
    )
    db.add(audit)
    db.commit()
    
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user

@router.get("/users", response_model=List[UserResponse])
def list_users(
    current_user: User = Depends(RoleChecker(["Admin", "Warehouse Manager"])), 
    db: Session = Depends(get_db)
):
    return db.query(User).all()

@router.post("/reset-password")
def reset_password(
    data: dict, 
    current_user: User = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    target_username = data.get("username")
    new_password = data.get("new_password")
    
    if not target_username or not new_password:
        raise HTTPException(status_code=400, detail="Username and new password required")
        
    # Check permissions: Admin can reset anyone's, users can reset their own
    if current_user.role != "Admin" and current_user.username != target_username:
        raise HTTPException(status_code=403, detail="Not authorized to reset this password")
        
    user = db.query(User).filter(User.username == target_username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    user.hashed_password = get_password_hash(new_password)
    db.commit()

    # Log action
    audit = AuditTrail(
        user_id=current_user.id,
        username=current_user.username,
        action="Reset Password",
        remarks=f"Reset password for user {target_username}"
    )
    db.add(audit)
    db.commit()

    return {"message": "Password reset successful"}

@router.put("/users/{id}", response_model=UserResponse)
def update_user(
    id: int,
    user_in: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["Admin"]))
):
    user = db.query(User).filter(User.id == id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
            
    user.name = user_in.name
    user.email = user_in.email
    user.mobile = user_in.mobile
    user.role = user_in.role
    user.is_active = user_in.is_active
    
    if user_in.password:
        user.hashed_password = get_password_hash(user_in.password)
        
    db.commit()
    db.refresh(user)
    
    audit = AuditTrail(
        user_id=current_user.id,
        username=current_user.username,
        action="User Updated",
        remarks=f"Updated user {user.username} - Role: {user.role}, Active: {user.is_active}"
    )
    db.add(audit)
    db.commit()
    
    return user

@router.delete("/users/{id}")
def delete_user(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["Admin"]))
):
    user = db.query(User).filter(User.id == id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own user account")
        
    db.delete(user)
    db.commit()
    
    audit = AuditTrail(
        user_id=current_user.id,
        username=current_user.username,
        action="User Deleted",
        remarks=f"Deleted user {user.username}"
    )
    db.add(audit)
    db.commit()
    
    return {"message": "User deleted successfully"}
