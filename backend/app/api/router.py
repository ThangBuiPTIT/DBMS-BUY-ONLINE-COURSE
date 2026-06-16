from fastapi import APIRouter

from app.api import (
    admin,
    auth,
    comment,
    course_builder,
    dictionary,
    feedback,
    gamification,
    microlearning,
    notification,
    store,
    student,
    teacher,
    user,
)

api_router = APIRouter()

api_router.include_router(auth.router)
api_router.include_router(admin.router)
api_router.include_router(teacher.router)
api_router.include_router(student.router)
api_router.include_router(store.router)
api_router.include_router(gamification.router)
api_router.include_router(dictionary.router)
api_router.include_router(microlearning.router)
api_router.include_router(course_builder.router)
api_router.include_router(notification.router)
api_router.include_router(user.router)
api_router.include_router(comment.router)
api_router.include_router(feedback.router)
