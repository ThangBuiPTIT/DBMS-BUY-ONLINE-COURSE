package handler

import (
	"admin-login-backend/repository"
	"encoding/json"
	"net/http"
)

type TeacherHandler struct {
	repo *repository.TeacherRepository
}

func NewTeacherHandler(repo *repository.TeacherRepository) *TeacherHandler {
	return &TeacherHandler{repo: repo}
}

func getTeacherID(r *http.Request) string {
	// Support Go 1.22 PathValue
	id := r.PathValue("id")
	if id != "" {
		return id
	}
	
	// Fallback split logic
	parts := r.URL.Path
	splitParts := []string{}
	var current string
	for _, char := range parts {
		if char == '/' {
			if current != "" {
				splitParts = append(splitParts, current)
				current = ""
			}
		} else {
			current += string(char)
		}
	}
	if current != "" {
		splitParts = append(splitParts, current)
	}

	for i, part := range splitParts {
		if part == "teacher" && i+1 < len(splitParts) {
			return splitParts[i+1]
		}
	}
	return ""
}

// GetTeacherDashboard retrieves teacher stats
func (h *TeacherHandler) GetTeacherDashboard(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Session-Key")
	w.Header().Set("Content-Type", "application/json")

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method != http.MethodGet {
		w.WriteHeader(http.StatusMethodNotAllowed)
		json.NewEncoder(w).Encode(map[string]string{"error": "Method not allowed"})
		return
	}

	teacherID := getTeacherID(r)
	if teacherID == "" {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "Thiếu Teacher ID"})
		return
	}

	dashboard, err := h.repo.GetTeacherDashboard(teacherID)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	json.NewEncoder(w).Encode(dashboard)
}

// GetTeacherCourses retrieves course analytics for the teacher
func (h *TeacherHandler) GetTeacherCourses(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Session-Key")
	w.Header().Set("Content-Type", "application/json")

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method != http.MethodGet {
		w.WriteHeader(http.StatusMethodNotAllowed)
		json.NewEncoder(w).Encode(map[string]string{"error": "Method not allowed"})
		return
	}

	teacherID := getTeacherID(r)
	if teacherID == "" {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "Thiếu Teacher ID"})
		return
	}

	courses, err := h.repo.GetTeacherCourses(teacherID)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	json.NewEncoder(w).Encode(courses)
}

// GetTeacherFeedback retrieves course feedback summary for the teacher
func (h *TeacherHandler) GetTeacherFeedback(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Session-Key")
	w.Header().Set("Content-Type", "application/json")

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method != http.MethodGet {
		w.WriteHeader(http.StatusMethodNotAllowed)
		json.NewEncoder(w).Encode(map[string]string{"error": "Method not allowed"})
		return
	}

	teacherID := getTeacherID(r)
	if teacherID == "" {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "Thiếu Teacher ID"})
		return
	}

	feedback, err := h.repo.GetTeacherFeedback(teacherID)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	json.NewEncoder(w).Encode(feedback)
}
