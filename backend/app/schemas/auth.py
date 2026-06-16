from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    username: str = Field(..., min_length=1)
    password: str = Field(..., min_length=1)


class UserInfo(BaseModel):
    user_id: str
    username: str
    email: str
    role_name: str

    model_config = {"from_attributes": True}


class LoginResponse(BaseModel):
    message: str
    session_key: str
    user: UserInfo


class RegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    password: str = Field(min_length=6, max_length=100)
    email: str | None = None
    full_name: str = Field(min_length=1, max_length=100)
    role_id: int = Field(ge=1, le=4)  # 1=Admin, 2=Teacher, 3=Student
    grade_level: str | None = None    # Chỉ cho STUDENT
    school_name: str | None = None    # Chỉ cho STUDENT
    bio: str | None = None            # Chỉ cho TEACHER
    department: str | None = None     # Chỉ cho TEACHER


class RegisterResponse(BaseModel):
    message: str
    user_id: str
    username: str
    role_name: str


class LogoutRequest(BaseModel):
    session_key: str
