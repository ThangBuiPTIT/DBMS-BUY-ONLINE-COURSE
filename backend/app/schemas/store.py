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


# ── Phase 4: Refund, Transactions, Audit ──

class RefundRequest(BaseModel):
    student_id: str
    course_id: str
    reason: str = ""


class UserTransactionResponse(BaseModel):
    transaction_id: str
    created_at: datetime
    amount: float
    status: str
    message: str | None
    direction: str  # "IN" hoặc "OUT"
    related_course: str | None
    counterparty_name: str | None

    model_config = {"from_attributes": True}


class UserTransactionListResponse(BaseModel):
    transactions: list[UserTransactionResponse]
    total: int
    limit: int
    offset: int


class WalletAuditResponse(BaseModel):
    user_id: str
    wallet_balance: float
    computed_balance: float
    discrepancy: float
    is_consistent: bool
