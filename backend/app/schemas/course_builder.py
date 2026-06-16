from datetime import datetime

from pydantic import BaseModel, Field


class LearningMaterialResponse(BaseModel):
    material_id: str
    lesson_id: str
    title: str
    content_url: str
    material_transcript: dict | None = None

    model_config = {"from_attributes": True}


class GeneralCourseLessonResponse(BaseModel):
    lesson_id: str
    module_id: str
    title: str
    video_url: str
    order_index: int
    materials: list[LearningMaterialResponse] = []

    model_config = {"from_attributes": True}


class GeneralCourseModuleResponse(BaseModel):
    module_id: str
    course_id: str
    title: str
    order_index: int
    lessons: list[GeneralCourseLessonResponse] = []

    model_config = {"from_attributes": True}


class CourseContentResponse(BaseModel):
    course_id: str
    title: str
    visibility_status: str
    modules: list[GeneralCourseModuleResponse] = []

    model_config = {"from_attributes": True}


class ModuleCreateRequest(BaseModel):
    course_id: str
    title: str


class ModuleCreateResponse(BaseModel):
    module_id: str
    course_id: str
    title: str
    order_index: int
    lessons: list = []

    model_config = {"from_attributes": True}


class LessonCreateRequest(BaseModel):
    module_id: str
    title: str
    video_url: str = ""


class LessonCreateResponse(BaseModel):
    lesson_id: str
    module_id: str
    title: str
    video_url: str
    order_index: int
    materials: list = []

    model_config = {"from_attributes": True}


class LessonReorderRequest(BaseModel):
    module_id: str
    lesson_ids: list[str] = Field(min_length=1)


class VisibilityRequest(BaseModel):
    visibility_status: str = Field(pattern="^(DRAFT|PUBLISHED|ARCHIVED)$")


# ── Phase 2: Course CRUD ──

class CourseCreateRequest(BaseModel):
    teacher_id: str
    category_id: int = Field(gt=0)
    title: str = Field(min_length=1, max_length=255)
    description: str = ""
    image_url: str = ""
    price: float = Field(default=0.00, ge=0)


class CourseUpdateRequest(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = None
    image_url: str | None = None
    price: float | None = Field(None, ge=0)
    category_id: int | None = Field(None, gt=0)


class CourseCategoryResponse(BaseModel):
    category_id: int
    name: str

    model_config = {"from_attributes": True}


class CourseDetailResponse(BaseModel):
    course_id: str
    teacher_id: str
    teacher_name: str
    category_id: int
    category_name: str
    title: str
    description: str
    image_url: str
    price: float
    visibility_status: str
    updated_at: datetime
    total_modules: int
    total_lessons: int
    total_enrollments: int

    model_config = {"from_attributes": True}


# ── Phase 2: Module / Lesson / Material CRUD ──

class ModuleUpdateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=255)


class LessonUpdateRequest(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=255)
    video_url: str | None = None


class MaterialCreateRequest(BaseModel):
    lesson_id: str
    title: str = Field(min_length=1, max_length=255)
    content_url: str
    material_transcript: dict | None = None


class MaterialUpdateRequest(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=255)
    content_url: str | None = None
    material_transcript: dict | None = None


class MaterialResponse(BaseModel):
    material_id: str
    lesson_id: str
    title: str
    content_url: str
    material_transcript: dict | None = None

    model_config = {"from_attributes": True}


# ── Phase 2: Progress ──

class ProgressUpdateRequest(BaseModel):
    student_id: str
    course_id: str
    progress: float = Field(ge=0, le=100)


class ProgressResponse(BaseModel):
    student_id: str
    course_id: str
    progress: float
    message: str
