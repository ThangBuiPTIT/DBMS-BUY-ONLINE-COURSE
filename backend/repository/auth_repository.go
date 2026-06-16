package repository

import (
	"database/sql"
	"errors"
	"time"

	"admin-login-backend/config"
	"admin-login-backend/models"
)

type AuthRepository interface {
	GetUserByUsername(username string) (*models.User, error)
	CreateSession(userID string, sessionKey string, expiresAt time.Time) error
}

type authRepository struct {
	db *sql.DB
}

func NewAuthRepository() AuthRepository {
	return &authRepository{db: config.DB}
}

func (r *authRepository) GetUserByUsername(username string) (*models.User, error) {
	query := `
		SELECT u.user_id, u.username, u.password_hash, COALESCE(u.email, ''), u.role_id, r.role_name, u.status, u.is_deleted
		FROM users u
		JOIN roles r ON u.role_id = r.role_id
		WHERE u.username = $1 AND u.is_deleted = FALSE
	`

	var user models.User
	err := r.db.QueryRow(query, username).Scan(
		&user.UserID,
		&user.Username,
		&user.PasswordHash,
		&user.Email,
		&user.RoleID,
		&user.RoleName,
		&user.Status,
		&user.IsDeleted,
	)

	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}

	return &user, nil
}

func (r *authRepository) CreateSession(userID string, sessionKey string, expiresAt time.Time) error {
	query := `
		INSERT INTO authentication_sessions (user_id, session_key, expires_at)
		VALUES ($1, $2, $3)
	`
	_, err := r.db.Exec(query, userID, sessionKey, expiresAt)
	return err
}
