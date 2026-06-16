package repository

import (
	"admin-login-backend/config"
	"admin-login-backend/models"
)

type StudentRepository interface {
	SearchStudents(keyword string) ([]models.StudentSearchResult, error)
	GetProgressReport() ([]models.StudentProgressReport, error)
	GetInactiveStudents() ([]models.InactiveStudent, error)
}

type studentRepository struct{}

func NewStudentRepository() StudentRepository {
	return &studentRepository{}
}

func (r *studentRepository) SearchStudents(keyword string) ([]models.StudentSearchResult, error) {
	query := `SELECT student_id, username, full_name, grade_level, school_name, created_at FROM fn_search_students($1)`
	rows, err := config.DB.Query(query, keyword)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []models.StudentSearchResult
	for rows.Next() {
		var s models.StudentSearchResult
		err := rows.Scan(&s.StudentID, &s.Username, &s.FullName, &s.GradeLevel, &s.SchoolName, &s.CreatedAt)
		if err != nil {
			return nil, err
		}
		results = append(results, s)
	}
	if results == nil {
		results = []models.StudentSearchResult{}
	}
	return results, nil
}

func (r *studentRepository) GetProgressReport() ([]models.StudentProgressReport, error) {
	query := `SELECT student_name, email, school_name, course_title, progress, enrolled_at, learning_status FROM vw_student_progress_report`
	rows, err := config.DB.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []models.StudentProgressReport
	for rows.Next() {
		var s models.StudentProgressReport
		err := rows.Scan(&s.StudentName, &s.Email, &s.SchoolName, &s.CourseTitle, &s.Progress, &s.EnrolledAt, &s.LearningStatus)
		if err != nil {
			return nil, err
		}
		results = append(results, s)
	}
	if results == nil {
		results = []models.StudentProgressReport{}
	}
	return results, nil
}

func (r *studentRepository) GetInactiveStudents() ([]models.InactiveStudent, error) {
	query := `SELECT enrollment_id, student_id, full_name, phone_number, course_title, last_activity_date FROM vw_inactive_students`
	rows, err := config.DB.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []models.InactiveStudent
	for rows.Next() {
		var s models.InactiveStudent
		err := rows.Scan(&s.EnrollmentID, &s.StudentID, &s.FullName, &s.PhoneNumber, &s.CourseTitle, &s.LastActivityDate)
		if err != nil {
			return nil, err
		}
		results = append(results, s)
	}
	if results == nil {
		results = []models.InactiveStudent{}
	}
	return results, nil
}
