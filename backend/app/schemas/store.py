from datetime import datetime

from pydantic import BaseModel, Field


class StoreCourseResponse(BaseModel):
    course_id: str
    title: str
    description: str
    image_url: str
    price: float
    visibility_status: str
    teacher_name: str
    is_enrolled: bool

    model_config = {"from_attributes": True}


class WalletInfoResponse(BaseModel):
    user_id: str
    balance: float
    updated_at: datetime

    model_config = {"from_attributes": True}


class TopupRequest(BaseModel):
    user_id: str
    amount: float = Field(gt=0)
    message: str


class CheckoutRequest(BaseModel):
    student_id: str
    course_id: str


class StoreSuccessResponse(BaseModel):
    status: str
    message: str
