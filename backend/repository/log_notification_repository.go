package repository

import (
	"database/sql"
	"errors"
	"time"
	"admin-login-backend/config"
	"admin-login-backend/models"
)

type LogNotificationRepository interface {
	GetNotifications(userID string) ([]models.NotificationUser, error)
	MarkNotificationAsRead(notificationID string) error
	GetAuditLogs() ([]models.AuditLog, error)
}

type logNotificationRepository struct {
	db *sql.DB
}

func NewLogNotificationRepository() LogNotificationRepository {
	return &logNotificationRepository{db: config.DB}
}

// GetNotifications retrieves notifications for a user, prioritizing unread ones and filtering to recent 30 days to prune partitions.
func (r *logNotificationRepository) GetNotifications(userID string) ([]models.NotificationUser, error) {
	query := `
		SELECT notification_id, user_id, title, message, is_read, created_at
		FROM notification_users
		WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '30 days'
		ORDER BY is_read ASC, created_at DESC
	`
	rows, err := r.db.Query(query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []models.NotificationUser
	for rows.Next() {
		var n models.NotificationUser
		var createdAt time.Time
		if err := rows.Scan(&n.NotificationID, &n.UserID, &n.Title, &n.Message, &n.IsRead, &createdAt); err != nil {
			return nil, err
		}
		n.CreatedAt = createdAt
		list = append(list, n)
	}
	return list, nil
}

// MarkNotificationAsRead performs a two-step query to locate the partition key (created_at) first, ensuring optimal partition targeting.
func (r *logNotificationRepository) MarkNotificationAsRead(notificationID string) error {
	// 1. Fetch created_at to identify which partition the row belongs to
	findQuery := `
		SELECT created_at 
		FROM notification_users 
		WHERE notification_id = $1 AND created_at >= NOW() - INTERVAL '30 days' 
		LIMIT 1
	`
	var createdAt time.Time
	err := r.db.QueryRow(findQuery, notificationID).Scan(&createdAt)
	if err != nil {
		if err == sql.ErrNoRows {
			return errors.New("thông báo không tồn tại hoặc đã quá hạn")
		}
		return err
	}

	// 2. Perform the update targeting the exact partition key
	updateQuery := `
		UPDATE notification_users 
		SET is_read = TRUE 
		WHERE notification_id = $1 AND created_at = $2
	`
	_, err = r.db.Exec(updateQuery, notificationID, createdAt)
	return err
}

// GetAuditLogs fetches the 50 most recent audit logs. By ordering DESC and applying limit, Postgres scans partition bounds efficiently.
func (r *logNotificationRepository) GetAuditLogs() ([]models.AuditLog, error) {
	query := `
		SELECT audit_id, run_id, action, status, COALESCE(error_message, '') as error_message, created_at
		FROM audit_logs
		WHERE created_at >= NOW() - INTERVAL '30 days'
		ORDER BY created_at DESC
		LIMIT 50
	`
	rows, err := r.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var logs []models.AuditLog
	for rows.Next() {
		var l models.AuditLog
		var createdAt time.Time
		if err := rows.Scan(&l.AuditID, &l.RunID, &l.Action, &l.Status, &l.ErrorMessage, &createdAt); err != nil {
			return nil, err
		}
		l.CreatedAt = createdAt
		logs = append(logs, l)
	}
	return logs, nil
}
