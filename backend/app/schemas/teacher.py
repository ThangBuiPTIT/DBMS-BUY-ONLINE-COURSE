from pydantic import BaseModel


class TeacherDashboardResponse(BaseModel):
    teacher_id: str
    teacher_name: str
    total_courses: int
    total_students: int
    total_generated_revenue: float

    model_config = {"from_attributes": True}


class CourseAnalyticResponse(BaseModel):
    course_id: str
    course_title: str
    teacher_name: str
    total_students: int
    avg_progress: float
    avg_rating: float | None = None

    model_config = {"from_attributes": True}


class CourseFeedbackSummaryResponse(BaseModel):
    course_or_context: str
    total_feedbacks: int
    average_rating: float
    five_stars: int
    one_star: int

    model_config = {"from_attributes": True}
