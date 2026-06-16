from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    username: str
    password: str


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
