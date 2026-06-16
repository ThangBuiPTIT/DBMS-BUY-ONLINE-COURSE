from sqlalchemy.orm import declarative_base

Base = declarative_base()

# Import all models so Alembic and SQLAlchemy know about them
from app.models.user import (  # noqa: E402, F401
    Role,
    User,
    UserProfile,
    Student,
    Teacher,
    AuthenticationSession,
)
from app.models.course import (  # noqa: E402, F401
    GeneralCourseCategory,
    GeneralCourse,
    GeneralCourseModule,
    GeneralCourseLesson,
    LearningMaterial,
    CourseEnrollment,
    Comment,
)
from app.models.store import (  # noqa: E402, F401
    Wallet,
    TransactionLog,
    TransactionActionLog,
)
from app.models.dictionary import (  # noqa: E402, F401
    DictionaryCategory,
    DictionaryEntry,
    DictionaryVariation,
)
from app.models.microlearning import (  # noqa: E402, F401
    MicrolearningTopic,
    MicrolearningUnit,
    MicrolearningLesson,
    MicrolearningLessonPart,
    MicrolearningQuestion,
)
from app.models.gamification import (  # noqa: E402, F401
    StudentStreak,
    Achievement,
    UserAchievement,
    UserFeedback,
)
from app.models.notification import (  # noqa: E402, F401
    Log,
    AuditLog,
    NotificationUser,
)
