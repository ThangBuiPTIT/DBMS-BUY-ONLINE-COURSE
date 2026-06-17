from datetime import datetime

from pydantic import BaseModel


class StudentSearchResult(BaseModel):
    student_id: str
    username: str
    full_name: str
    grade_level: str
    school_name: str
    created_at: datetime

    model_config = {"from_attributes": True}


class StudentProgressReport(BaseModel):
    student_name: str
    email: str
    school_name: str
    course_title: str
    progress: float
    enrolled_at: datetime
    learning_status: str

    model_config = {"from_attributes": True}


class InactiveStudentResponse(BaseModel):
    enrollment_id: str
    student_id: str
    full_name: str
    phone_number: str
    course_title: str
    last_activity_date: datetime | None = None

    model_config = {"from_attributes": True}


class StudentDashboardResponse(BaseModel):
    student_id: str
    full_name: str
    current_streak: int = 0
    highest_streak: int = 0
    enrolled_courses: int = 0
    achievements: int = 0
    avg_progress: float = 0.0

    model_config = {"from_attributes": True}
