from datetime import datetime

from pydantic import BaseModel


class TransactionResponse(BaseModel):
    transaction_id: str
    created_at: datetime
    amount: float
    status: str
    message: str
    sender_name: str
    receiver_name: str
    related_course: str
    sender_id: str | None = None
    receiver_id: str | None = None

    model_config = {"from_attributes": True}


class TransactionListResponse(BaseModel):
    transactions: list[TransactionResponse]
    total_count: int
    limit: int
    offset: int


class CourseRevenueResponse(BaseModel):
    course_id: str
    title: str
    price: float
    total_sales_count: int
    total_revenue: float

    model_config = {"from_attributes": True}


class BanRequest(BaseModel):
    user_id: str
    reason: str


class MessageResponse(BaseModel):
    message: str
