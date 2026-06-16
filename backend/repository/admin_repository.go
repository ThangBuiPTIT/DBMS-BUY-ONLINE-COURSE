package repository

import (
	"admin-login-backend/config"
	"admin-login-backend/models"
	"database/sql"
)

type AdminRepository struct {
	db *sql.DB
}

func NewAdminRepository() *AdminRepository {
	return &AdminRepository{db: config.DB}
}

// GetTransactions retrieves paginated transactions from vw_detailed_transaction_history and joins with user_profiles
func (r *AdminRepository) GetTransactions(limit, offset int) ([]models.Transaction, int, error) {
	// First get total count
	var totalCount int
	countQuery := "SELECT COUNT(*) FROM vw_detailed_transaction_history"
	err := r.db.QueryRow(countQuery).Scan(&totalCount)
	if err != nil {
		return nil, 0, err
	}

	// Then query data
	query := `
		SELECT 
			v.transaction_id, 
			v.created_at, 
			v.amount, 
			v.status, 
			v.message, 
			v.sender_name, 
			v.receiver_name, 
			v.related_course,
			u_sender.user_id AS sender_id,
			u_receiver.user_id AS receiver_id
		FROM vw_detailed_transaction_history v
		LEFT JOIN user_profiles u_sender ON v.sender_name = u_sender.full_name
		LEFT JOIN user_profiles u_receiver ON v.receiver_name = u_receiver.full_name
		LIMIT $1 OFFSET $2
	`
	rows, err := r.db.Query(query, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var transactions []models.Transaction
	for rows.Next() {
		var t models.Transaction
		err := rows.Scan(
			&t.TransactionID,
			&t.CreatedAt,
			&t.Amount,
			&t.Status,
			&t.Message,
			&t.SenderName,
			&t.ReceiverName,
			&t.RelatedCourse,
			&t.SenderID,
			&t.ReceiverID,
		)
		if err != nil {
			return nil, 0, err
		}
		transactions = append(transactions, t)
	}

	return transactions, totalCount, nil
}

// GetRevenue retrieves revenue reports from vw_revenue_by_course
func (r *AdminRepository) GetRevenue() ([]models.CourseRevenue, error) {
	query := `
		SELECT course_id, title, price, total_sales_count, total_revenue 
		FROM vw_revenue_by_course
		ORDER BY total_revenue DESC
	`
	rows, err := r.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var revenues []models.CourseRevenue
	for rows.Next() {
		var cr models.CourseRevenue
		err := rows.Scan(
			&cr.CourseID,
			&cr.Title,
			&cr.Price,
			&cr.TotalSalesCount,
			&cr.TotalRevenue,
		)
		if err != nil {
			return nil, err
		}
		revenues = append(revenues, cr)
	}

	return revenues, nil
}

// BanUser executes the sp_ban_user procedure
func (r *AdminRepository) BanUser(userID string, reason string) error {
	_, err := r.db.Exec("CALL sp_ban_user($1, $2)", userID, reason)
	return err
}
