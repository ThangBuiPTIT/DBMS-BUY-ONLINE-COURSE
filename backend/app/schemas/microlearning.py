from pydantic import BaseModel


class MicrolearningQuestionResponse(BaseModel):
    question_id: str
    part_id: str
    question_text: str
    question_type: str
    options_json: list
    correct_answer: str

    model_config = {"from_attributes": True}


class MicrolearningLessonPartResponse(BaseModel):
    part_id: str
    lesson_id: str
    title: str
    part_type: str
    content: str
    order_index: int

    model_config = {"from_attributes": True}


class MicrolearningLessonResponse(BaseModel):
    lesson_id: str
    unit_id: str
    title: str
    video_url: str
    order_index: int

    model_config = {"from_attributes": True}


class MicrolearningUnitResponse(BaseModel):
    unit_id: str
    topic_id: int
    title: str
    order_index: int
    lessons: list[MicrolearningLessonResponse] = []

    model_config = {"from_attributes": True}


class MicrolearningTopicResponse(BaseModel):
    topic_id: int
    title: str
    description: str
    units: list[MicrolearningUnitResponse] = []

    model_config = {"from_attributes": True}
