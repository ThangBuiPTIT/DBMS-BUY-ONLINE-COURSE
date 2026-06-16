package repository

import (
	"admin-login-backend/config"
	"admin-login-backend/models"
	"database/sql"
)

type GamificationRepository interface {
	GetLeaderboard(limit int) ([]models.LeaderboardEntry, error)
	GetStudentStreak(studentID string) (*models.StudentStreak, error)
}

type gamificationRepository struct {
	db *sql.DB
}

func NewGamificationRepository() GamificationRepository {
	return &gamificationRepository{db: config.DB}
}

func (r *gamificationRepository) GetLeaderboard(limit int) ([]models.LeaderboardEntry, error) {
	query := `
		SELECT
			full_name,
			COALESCE(avatar_url, '') as avatar_url,
			current_streak,
			highest_streak,
			total_achievements
		FROM vw_top_learners_leaderboard
		LIMIT $1
	`
	rows, err := r.db.Query(query, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var entries []models.LeaderboardEntry
	rank := 1
	for rows.Next() {
		var e models.LeaderboardEntry
		err := rows.Scan(
			&e.FullName,
			&e.AvatarURL,
			&e.CurrentStreak,
			&e.HighestStreak,
			&e.TotalAchievements,
		)
		if err != nil {
			return nil, err
		}
		e.Rank = rank
		rank++
		entries = append(entries, e)
	}
	if entries == nil {
		entries = []models.LeaderboardEntry{}
	}
	return entries, nil
}

func (r *gamificationRepository) GetStudentStreak(studentID string) (*models.StudentStreak, error) {
	query := `
		SELECT student_id, current_streak, highest_streak, last_activity_date
		FROM student_streaks
		WHERE student_id = $1
	`
	var s models.StudentStreak
	var lastActivity sql.NullString

	err := r.db.QueryRow(query, studentID).Scan(
		&s.StudentID,
		&s.CurrentStreak,
		&s.HighestStreak,
		&lastActivity,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			// Return default empty streak if not found
			return &models.StudentStreak{
				StudentID:     studentID,
				CurrentStreak: 0,
				HighestStreak: 0,
			}, nil
		}
		return nil, err
	}

	if lastActivity.Valid {
		s.LastActivityDate = &lastActivity.String
	}
	return &s, nil
}
