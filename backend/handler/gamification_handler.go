package handler

import (
	"admin-login-backend/models"
	"admin-login-backend/repository"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
)

type GamificationHandler struct {
	repo repository.GamificationRepository
}

func NewGamificationHandler(repo repository.GamificationRepository) *GamificationHandler {
	return &GamificationHandler{repo: repo}
}

func (h *GamificationHandler) sendJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func (h *GamificationHandler) sendError(w http.ResponseWriter, status int, message string) {
	h.sendJSON(w, status, map[string]string{"error": message})
}

// GET /api/gamification/leaderboard?limit=20
func (h *GamificationHandler) GetLeaderboard(w http.ResponseWriter, r *http.Request) {
	limitStr := r.URL.Query().Get("limit")
	limit := 20
	if limitStr != "" {
		if parsed, err := strconv.Atoi(limitStr); err == nil && parsed > 0 {
			limit = parsed
		}
	}

	entries, err := h.repo.GetLeaderboard(limit)
	if err != nil {
		h.sendError(w, http.StatusInternalServerError, "Không thể lấy bảng xếp hạng: "+err.Error())
		return
	}

	h.sendJSON(w, http.StatusOK, map[string]interface{}{
		"leaderboard": entries,
		"total":       len(entries),
	})
}

// GET /api/gamification/streak/{student_id}
func (h *GamificationHandler) GetStudentStreak(w http.ResponseWriter, r *http.Request) {
	// Extract student_id from path: /api/gamification/streak/{student_id}
	path := r.URL.Path
	parts := strings.Split(strings.TrimPrefix(path, "/api/gamification/streak/"), "/")
	studentID := parts[0]

	if studentID == "" {
		h.sendError(w, http.StatusBadRequest, "Thiếu student_id")
		return
	}

	streak, err := h.repo.GetStudentStreak(studentID)
	if err != nil {
		h.sendError(w, http.StatusInternalServerError, "Không thể lấy streak: "+err.Error())
		return
	}

	h.sendJSON(w, http.StatusOK, streak)
}

// Ensure models import is used
var _ = models.LeaderboardEntry{}
