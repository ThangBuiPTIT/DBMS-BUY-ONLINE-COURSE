package models

import (
	"encoding/json"
	"time"
)

type User struct {
	UserID       string    `json:"user_id"`
	Username     string    `json:"username"`
	PasswordHash string    `json:"-"`
	Email        string    `json:"email"`
	RoleID       int       `json:"role_id"`
	RoleName     string    `json:"role_name"`
	Status       string    `json:"status"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
	IsDeleted    bool      `json:"is_deleted"`
}

type AuthenticationSession struct {
	SessionID  string    `json:"session_id"`
	UserID     string    `json:"user_id"`
	SessionKey string    `json:"session_key"`
	OTPCode    *string   `json:"otp_code,omitempty"`
	ExpiresAt  time.Time `json:"expires_at"`
	CreatedAt  time.Time `json:"created_at"`
}

type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type UserInfo struct {
	UserID   string `json:"user_id"`
	Username string `json:"username"`
	Email    string `json:"email"`
	RoleName string `json:"role_name"`
}

type LoginResponse struct {
	Message    string   `json:"message"`
	SessionKey string   `json:"session_key"`
	User       UserInfo `json:"user"`
}

type Transaction struct {
	TransactionID string    `json:"transaction_id"`
	CreatedAt     time.Time `json:"created_at"`
	Amount        float64   `json:"amount"`
	Status        string    `json:"status"`
	Message       string    `json:"message"`
	SenderName    string    `json:"sender_name"`
	ReceiverName  string    `json:"receiver_name"`
	RelatedCourse string    `json:"related_course"`
	SenderID      *string   `json:"sender_id,omitempty"`
	ReceiverID    *string   `json:"receiver_id,omitempty"`
}

type CourseRevenue struct {
	CourseID        string  `json:"course_id"`
	Title           string  `json:"title"`
	Price           float64 `json:"price"`
	TotalSalesCount int     `json:"total_sales_count"`
	TotalRevenue    float64 `json:"total_revenue"`
}

type BanRequest struct {
	UserID string `json:"user_id"`
	Reason string `json:"reason"`
}

type TeacherDashboard struct {
	TeacherID             string  `json:"teacher_id"`
	TeacherName           string  `json:"teacher_name"`
	TotalCourses          int     `json:"total_courses"`
	TotalStudents         int     `json:"total_students"`
	TotalGeneratedRevenue float64 `json:"total_generated_revenue"`
}

type CourseAnalytic struct {
	CourseID      string   `json:"course_id"`
	CourseTitle   string   `json:"course_title"`
	TeacherName   string   `json:"teacher_name"`
	TotalStudents int      `json:"total_students"`
	AvgProgress   float64  `json:"avg_progress"`
	AvgRating     *float64 `json:"avg_rating"`
}

type CourseFeedbackSummary struct {
	CourseOrContext string  `json:"course_or_context"`
	TotalFeedbacks  int     `json:"total_feedbacks"`
	AverageRating   float64 `json:"average_rating"`
	FiveStars       int     `json:"five_stars"`
	OneStar         int     `json:"one_star"`
}

type StudentSearchResult struct {
	StudentID  string    `json:"student_id"`
	Username   string    `json:"username"`
	FullName   string    `json:"full_name"`
	GradeLevel string    `json:"grade_level"`
	SchoolName string    `json:"school_name"`
	CreatedAt  time.Time `json:"created_at"`
}

type StudentProgressReport struct {
	StudentName    string    `json:"student_name"`
	Email          string    `json:"email"`
	SchoolName     string    `json:"school_name"`
	CourseTitle    string    `json:"course_title"`
	Progress       float64   `json:"progress"`
	EnrolledAt     time.Time `json:"enrolled_at"`
	LearningStatus string    `json:"learning_status"`
}

type InactiveStudent struct {
	EnrollmentID     string     `json:"enrollment_id"`
	StudentID        string     `json:"student_id"`
	FullName         string     `json:"full_name"`
	PhoneNumber      string     `json:"phone_number"`
	CourseTitle      string     `json:"course_title"`
	LastActivityDate *time.Time `json:"last_activity_date"`
}

type WalletInfo struct {
	UserID    string    `json:"user_id"`
	Balance   float64   `json:"balance"`
	UpdatedAt time.Time `json:"updated_at"`
}

type TopupRequest struct {
	UserID  string  `json:"user_id"`
	Amount  float64 `json:"amount"`
	Message string  `json:"message"`
}

type CheckoutRequest struct {
	StudentID string `json:"student_id"`
	CourseID  string `json:"course_id"`
}

type StoreCourse struct {
	CourseID         string  `json:"course_id"`
	Title            string  `json:"title"`
	Description      string  `json:"description"`
	ImageURL         string  `json:"image_url"`
	Price            float64 `json:"price"`
	VisibilityStatus string  `json:"visibility_status"`
	TeacherName      string  `json:"teacher_name"`
	IsEnrolled       bool    `json:"is_enrolled"`
}

// ---- Gamification Models ----

type LeaderboardEntry struct {
	Rank              int    `json:"rank"`
	FullName          string `json:"full_name"`
	AvatarURL         string `json:"avatar_url"`
	CurrentStreak     int    `json:"current_streak"`
	HighestStreak     int    `json:"highest_streak"`
	TotalAchievements int    `json:"total_achievements"`
}

type StudentStreak struct {
	StudentID        string  `json:"student_id"`
	CurrentStreak    int     `json:"current_streak"`
	HighestStreak    int     `json:"highest_streak"`
	LastActivityDate *string `json:"last_activity_date"`
}

// ---- Dictionary Models ----

type DictionaryCategory struct {
	CategoryID  int    `json:"category_id"`
	Name        string `json:"name"`
	Description string `json:"description"`
}

type DictionaryVariation struct {
	VariationID string `json:"variation_id"`
	EntryID     string `json:"entry_id"`
	Region      string `json:"region"`
	VideoURL    string `json:"video_url"`
	Description string `json:"description"`
}

type DictionaryEntry struct {
	EntryID      string                `json:"entry_id"`
	CategoryID   int                   `json:"category_id"`
	CategoryName string                `json:"category_name"`
	Word         string                `json:"word"`
	Meaning      string                `json:"meaning"`
	UpdatedAt    time.Time             `json:"updated_at"`
	Variations   []DictionaryVariation `json:"variations"`
}

// ---- Microlearning Models ----

type MicrolearningLesson struct {
	LessonID   string `json:"lesson_id"`
	UnitID     string `json:"unit_id"`
	Title      string `json:"title"`
	VideoURL   string `json:"video_url"`
	OrderIndex int    `json:"order_index"`
}

type MicrolearningUnit struct {
	UnitID     string                `json:"unit_id"`
	TopicID    int                   `json:"topic_id"`
	Title      string                `json:"title"`
	OrderIndex int                   `json:"order_index"`
	Lessons    []MicrolearningLesson `json:"lessons"`
}

type MicrolearningTopic struct {
	TopicID     int                 `json:"topic_id"`
	Title       string              `json:"title"`
	Description string              `json:"description"`
	Units       []MicrolearningUnit `json:"units"`
}

type MicrolearningLessonPart struct {
	PartID     string `json:"part_id"`
	LessonID   string `json:"lesson_id"`
	Title      string `json:"title"`
	PartType   string `json:"part_type"`
	Content    string `json:"content"`
	OrderIndex int    `json:"order_index"`
}

type MicrolearningQuestion struct {
	QuestionID    string          `json:"question_id"`
	PartID        string          `json:"part_id"`
	QuestionText  string          `json:"question_text"`
	QuestionType  string          `json:"question_type"`
	OptionsJSON   json.RawMessage `json:"options_json"`
	CorrectAnswer string          `json:"correct_answer"`
}

type LearningMaterial struct {
	MaterialID         string          `json:"material_id"`
	LessonID           string          `json:"lesson_id"`
	Title              string          `json:"title"`
	ContentURL         string          `json:"content_url"`
	MaterialTranscript json.RawMessage `json:"material_transcript,omitempty"`
}

type GeneralCourseLesson struct {
	LessonID   string             `json:"lesson_id"`
	ModuleID   string             `json:"module_id"`
	Title      string             `json:"title"`
	VideoURL   string             `json:"video_url"`
	OrderIndex int                `json:"order_index"`
	Materials  []LearningMaterial `json:"materials"`
}

type GeneralCourseModule struct {
	ModuleID   string                `json:"module_id"`
	CourseID   string                `json:"course_id"`
	Title      string                `json:"title"`
	OrderIndex int                   `json:"order_index"`
	Lessons    []GeneralCourseLesson `json:"lessons"`
}

type CourseContentResponse struct {
	CourseID         string                `json:"course_id"`
	Title            string                `json:"title"`
	VisibilityStatus string                `json:"visibility_status"`
	Modules          []GeneralCourseModule `json:"modules"`
}

type NotificationUser struct {
	NotificationID string    `json:"notification_id"`
	UserID         string    `json:"user_id"`
	Title          string    `json:"title"`
	Message        string    `json:"message"`
	IsRead         bool      `json:"is_read"`
	CreatedAt      time.Time `json:"created_at"`
}

type AuditLog struct {
	AuditID      string    `json:"audit_id"`
	RunID        string    `json:"run_id"`
	Action       string    `json:"action"`
	Status       string    `json:"status"`
	ErrorMessage string    `json:"error_message"`
	CreatedAt    time.Time `json:"created_at"`
}

