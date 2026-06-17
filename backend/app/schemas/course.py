from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from app.core.sanitizer import sanitize_plain_text


# ── Comments ──

class CommentResponse(BaseModel):
    comment_id: str
    lesson_id: str
    user_id: str
    username: str
    avatar_url: str | None
    content: str
    created_at: datetime

    model_config = {"from_attributes": True}


class CommentCreateRequest(BaseModel):
    content: str = Field(min_length=1)

    @field_validator('content')
    @classmethod
    def sanitize_content(cls, v: str) -> str:
        return sanitize_plain_text(v)


class CommentUpdateRequest(BaseModel):
    content: str = Field(min_length=1)

    @field_validator('content')
    @classmethod
    def sanitize_content(cls, v: str) -> str:
        return sanitize_plain_text(v)


class CommentListResponse(BaseModel):
    comments: list[CommentResponse]
    total: int


# ── Feedback ──

class FeedbackResponse(BaseModel):
    feedback_id: str
    user_id: str
    username: str
    rating: int | None
    feedback_text: str | None
    context: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class FeedbackCreateRequest(BaseModel):
    rating: int = Field(ge=1, le=5)
    feedback_text: str = ""

    @field_validator('feedback_text')
    @classmethod
    def sanitize_feedback(cls, v: str) -> str:
        return sanitize_plain_text(v)


class FeedbackListResponse(BaseModel):
    feedbacks: list[FeedbackResponse]
    total: int
    average_rating: float
