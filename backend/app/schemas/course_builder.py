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
