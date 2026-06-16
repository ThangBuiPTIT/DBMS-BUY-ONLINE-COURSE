package repository

import (
	"admin-login-backend/config"
	"admin-login-backend/models"
	"database/sql"
)

type TeacherRepository struct {
	db *sql.DB
}

func NewTeacherRepository() *TeacherRepository {
	return &TeacherRepository{db: config.DB}
}

// GetTeacherDashboard retrieves overview metrics from vw_teacher_dashboard
func (r *TeacherRepository) GetTeacherDashboard(teacherID string) (*models.TeacherDashboard, error) {
	query := `
		SELECT teacher_id, teacher_name, total_courses, total_students, total_generated_revenue
		FROM vw_teacher_dashboard
		WHERE teacher_id = $1
	`
	var td models.TeacherDashboard
	err := r.db.QueryRow(query, teacherID).Scan(
		&td.TeacherID,
		&td.TeacherName,
		&td.TotalCourses,
		&td.TotalStudents,
		&td.TotalGeneratedRevenue,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			// If not found, return empty dashboard structure
			return &models.TeacherDashboard{
				TeacherID: teacherID,
			}, nil
		}
		return nil, err
	}
	return &td, nil
}

// GetTeacherCourses retrieves course analytics from vw_course_analytics joined with general_courses to filter by teacher
func (r *TeacherRepository) GetTeacherCourses(teacherID string) ([]models.CourseAnalytic, error) {
	query := `
		SELECT 
			va.course_id, 
			va.course_title, 
			va.teacher_name, 
			va.total_students, 
			va.avg_progress, 
			va.avg_rating
		FROM vw_course_analytics va
		JOIN general_courses c ON va.course_id = c.course_id
		WHERE c.teacher_id = $1
		ORDER BY va.total_students DESC
	`
	rows, err := r.db.Query(query, teacherID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var analytics []models.CourseAnalytic
	for rows.Next() {
		var ca models.CourseAnalytic
		err := rows.Scan(
			&ca.CourseID,
			&ca.CourseTitle,
			&ca.TeacherName,
			&ca.TotalStudents,
			&ca.AvgProgress,
			&ca.AvgRating,
		)
		if err != nil {
			return nil, err
		}
		analytics = append(analytics, ca)
	}
	return analytics, nil
}

// GetTeacherFeedback retrieves course feedback summary from vw_course_feedback_summary joined with general_courses to filter by teacher
func (r *TeacherRepository) GetTeacherFeedback(teacherID string) ([]models.CourseFeedbackSummary, error) {
	query := `
		SELECT 
			f.course_or_context, 
			f.total_feedbacks, 
			f.average_rating, 
			f.five_stars, 
			f.one_star
		FROM vw_course_feedback_summary f
		JOIN general_courses c ON f.course_or_context LIKE '%' || c.title || '%'
		WHERE c.teacher_id = $1
		ORDER BY f.average_rating DESC
	`
	rows, err := r.db.Query(query, teacherID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var feedbacks []models.CourseFeedbackSummary
	for rows.Next() {
		var fs models.CourseFeedbackSummary
		err := rows.Scan(
			&fs.CourseOrContext,
			&fs.TotalFeedbacks,
			&fs.AverageRating,
			&fs.FiveStars,
			&fs.OneStar,
		)
		if err != nil {
			return nil, err
		}
		feedbacks = append(feedbacks, fs)
	}
	return feedbacks, nil
}
