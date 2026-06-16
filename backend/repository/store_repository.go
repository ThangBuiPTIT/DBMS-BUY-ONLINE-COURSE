package repository

import (
	"admin-login-backend/config"
	"admin-login-backend/models"
	"database/sql"
)

type StoreRepository interface {
	GetPublishedCourses(studentID string) ([]models.StoreCourse, error)
	GetWalletBalance(userID string) (*models.WalletInfo, error)
	TopupWallet(userID string, amount float64, message string) error
	BuyCourseWithWallet(studentID string, courseID string) error
}

type storeRepository struct {
	db *sql.DB
}

func NewStoreRepository() StoreRepository {
	return &storeRepository{db: config.DB}
}

func (r *storeRepository) GetPublishedCourses(studentID string) ([]models.StoreCourse, error) {
	query := `
		SELECT 
			c.course_id, 
			c.title, 
			COALESCE(c.description, '') as description, 
			COALESCE(c.image_url, '') as image_url, 
			c.price, 
			c.visibility_status, 
			COALESCE(up.full_name, 'Giảng viên') as teacher_name,
			EXISTS(SELECT 1 FROM course_enrollments e WHERE e.course_id = c.course_id AND e.student_id = $1) as is_enrolled
		FROM general_courses c
		LEFT JOIN user_profiles up ON c.teacher_id = up.user_id
		WHERE c.visibility_status = 'PUBLISHED' AND c.is_deleted = FALSE
		ORDER BY c.updated_at DESC
	`
	rows, err := r.db.Query(query, studentID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var courses []models.StoreCourse
	for rows.Next() {
		var c models.StoreCourse
		err := rows.Scan(
			&c.CourseID,
			&c.Title,
			&c.Description,
			&c.ImageURL,
			&c.Price,
			&c.VisibilityStatus,
			&c.TeacherName,
			&c.IsEnrolled,
		)
		if err != nil {
			return nil, err
		}
		courses = append(courses, c)
	}
	if courses == nil {
		courses = []models.StoreCourse{}
	}
	return courses, nil
}

func (r *storeRepository) GetWalletBalance(userID string) (*models.WalletInfo, error) {
	query := `
		SELECT user_id, balance, updated_at
		FROM wallets
		WHERE user_id = $1
	`
	var w models.WalletInfo
	err := r.db.QueryRow(query, userID).Scan(&w.UserID, &w.Balance, &w.UpdatedAt)
	if err != nil {
		if err == sql.ErrNoRows {
			// If user doesn't have a wallet, auto-create one with 0 balance for graceful handling
			_, createErr := r.db.Exec("INSERT INTO wallets (user_id, balance) VALUES ($1, 0) ON CONFLICT (user_id) DO NOTHING", userID)
			if createErr == nil {
				return &models.WalletInfo{UserID: userID, Balance: 0}, nil
			}
			return nil, err
		}
		return nil, err
	}
	return &w, nil
}

func (r *storeRepository) TopupWallet(userID string, amount float64, message string) error {
	_, err := r.db.Exec("CALL sp_topup_wallet($1, $2, $3)", userID, amount, message)
	return err
}

func (r *storeRepository) BuyCourseWithWallet(studentID string, courseID string) error {
	_, err := r.db.Exec("CALL sp_buy_course_with_wallet($1, $2)", studentID, courseID)
	return err
}
