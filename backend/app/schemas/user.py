from datetime import datetime

from pydantic import BaseModel, Field


class UserResponse(BaseModel):
    user_id: str
    username: str
    email: str | None
    role_name: str
    status: str
    full_name: str
    avatar_url: str | None
    phone_number: str | None
    date_of_birth: str | None
    grade_level: str | None     # Null nếu không phải student
    school_name: str | None     # Null nếu không phải student
    bio: str | None             # Null nếu không phải teacher
    department: str | None      # Null nếu không phải teacher
    created_at: datetime

    model_config = {"from_attributes": True}


class UserProfileUpdateRequest(BaseModel):
    full_name: str | None = Field(None, min_length=1, max_length=100)
    avatar_url: str | None = None
    phone_number: str | None = Field(None, max_length=20)
    date_of_birth: str | None = None  # "YYYY-MM-DD"


class StudentUpdateRequest(BaseModel):
    grade_level: str | None = Field(None, max_length=50)
    school_name: str | None = Field(None, max_length=150)


class TeacherUpdateRequest(BaseModel):
    bio: str | None = None
    department: str | None = Field(None, max_length=100)


class RoleResponse(BaseModel):
    role_id: int
    role_name: str

    model_config = {"from_attributes": True}


class UserListResponse(BaseModel):
    users: list[UserResponse]
    total: int
    limit: int
    offset: int


class MessageResponse(BaseModel):
    message: str
