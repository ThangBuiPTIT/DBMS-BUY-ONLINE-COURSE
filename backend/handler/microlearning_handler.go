package handler

import (
	"admin-login-backend/repository"
	"encoding/json"
	"net/http"
	"strings"
)

type MicrolearningHandler struct {
	repo repository.MicrolearningRepository
}

func NewMicrolearningHandler(repo repository.MicrolearningRepository) *MicrolearningHandler {
	return &MicrolearningHandler{repo: repo}
}

func (h *MicrolearningHandler) sendJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func (h *MicrolearningHandler) sendError(w http.ResponseWriter, status int, message string) {
	h.sendJSON(w, status, map[string]string{"error": message})
}

// GET /api/microlearning/roadmap
func (h *MicrolearningHandler) GetRoadmap(w http.ResponseWriter, r *http.Request) {
	roadmap, err := h.repo.GetRoadmap()
	if err != nil {
		h.sendError(w, http.StatusInternalServerError, "Lỗi lấy lộ trình học tập: "+err.Error())
		return
	}

	h.sendJSON(w, http.StatusOK, roadmap)
}

// GET /api/microlearning/lessons/{lesson_id}/parts
func (h *MicrolearningHandler) GetLessonParts(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Session-Key")

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	lessonID := r.PathValue("lesson_id")
	if lessonID == "" {
		parts := strings.Split(r.URL.Path, "/")
		for i, part := range parts {
			if part == "lessons" && i+1 < len(parts) {
				lessonID = parts[i+1]
				break
			}
		}
	}

	if lessonID == "" {
		h.sendError(w, http.StatusBadRequest, "Thiếu Lesson ID")
		return
	}

	parts, err := h.repo.GetLessonParts(lessonID)
	if err != nil {
		h.sendError(w, http.StatusInternalServerError, "Lỗi lấy các phần bài học: "+err.Error())
		return
	}

	h.sendJSON(w, http.StatusOK, parts)
}

// GET /api/microlearning/parts/{part_id}/questions
func (h *MicrolearningHandler) GetPartQuestions(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Session-Key")

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	partID := r.PathValue("part_id")
	if partID == "" {
		parts := strings.Split(r.URL.Path, "/")
		for i, part := range parts {
			if part == "parts" && i+1 < len(parts) {
				partID = parts[i+1]
				break
			}
		}
	}

	if partID == "" {
		h.sendError(w, http.StatusBadRequest, "Thiếu Part ID")
		return
	}

	questions, err := h.repo.GetPartQuestions(partID)
	if err != nil {
		h.sendError(w, http.StatusInternalServerError, "Lỗi lấy câu hỏi trắc nghiệm: "+err.Error())
		return
	}

	h.sendJSON(w, http.StatusOK, questions)
}
