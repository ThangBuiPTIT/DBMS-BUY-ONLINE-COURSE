from datetime import datetime

from pydantic import BaseModel


class NotificationResponse(BaseModel):
    notification_id: str
    user_id: str
    title: str
    message: str
    is_read: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class AuditLogResponse(BaseModel):
    audit_id: str
    run_id: str
    action: str
    status: str
    error_message: str
    created_at: datetime

    model_config = {"from_attributes": True}
