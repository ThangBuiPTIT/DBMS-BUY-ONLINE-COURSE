package handler

import (
	"encoding/json"
	"net/http"
	"strings"
	"admin-login-backend/repository"
)

type CourseBuilderHandler struct {
	repo repository.CourseBuilderRepository
}

func NewCourseBuilderHandler(repo repository.CourseBuilderRepository) *CourseBuilderHandler {
	return &CourseBuilderHandler{repo: repo}
}

func (h *CourseBuilderHandler) sendJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS, PUT, DELETE")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Session-Key")
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func (h *CourseBuilderHandler) sendError(w http.ResponseWriter, status int, message string) {
	h.sendJSON(w, status, map[string]string{"error": message})
}

// GET /api/teacher/courses/{course_id}/content
func (h *CourseBuilderHandler) GetCourseContent(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodOptions {
		h.sendJSON(w, http.StatusOK, nil)
		return
	}

	courseID := r.PathValue("course_id")
	if courseID == "" {
		parts := strings.Split(r.URL.Path, "/")
		for i, part := range parts {
			if part == "courses" && i+1 < len(parts) {
				courseID = parts[i+1]
				if strings.Contains(courseID, "?") {
					courseID = strings.Split(courseID, "?")[0]
				}
				break
			}
		}
	}

	if courseID == "" {
		h.sendError(w, http.StatusBadRequest, "Thiếu Course ID")
		return
	}

	content, err := h.repo.GetCourseContent(courseID)
	if err != nil {
		h.sendError(w, http.StatusNotFound, "Lỗi lấy nội dung khóa học: "+err.Error())
		return
	}

	h.sendJSON(w, http.StatusOK, content)
}

// POST /api/teacher/modules
func (h *CourseBuilderHandler) CreateModule(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodOptions {
		h.sendJSON(w, http.StatusOK, nil)
		return
	}

	var req struct {
		CourseID string `json:"course_id"`
		Title    string `json:"title"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.sendError(w, http.StatusBadRequest, "Dữ liệu yêu cầu không hợp lệ")
		return
	}

	if req.CourseID == "" || req.Title == "" {
		h.sendError(w, http.StatusBadRequest, "Thiếu Course ID hoặc Title")
		return
	}

	m, err := h.repo.CreateModule(req.CourseID, req.Title)
	if err != nil {
		h.sendError(w, http.StatusInternalServerError, "Lỗi tạo chương mới: "+err.Error())
		return
	}

	h.sendJSON(w, http.StatusCreated, m)
}

// POST /api/teacher/lessons
func (h *CourseBuilderHandler) CreateLesson(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodOptions {
		h.sendJSON(w, http.StatusOK, nil)
		return
	}

	var req struct {
		ModuleID string `json:"module_id"`
		Title    string `json:"title"`
		VideoURL string `json:"video_url"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.sendError(w, http.StatusBadRequest, "Dữ liệu yêu cầu không hợp lệ")
		return
	}

	if req.ModuleID == "" || req.Title == "" {
		h.sendError(w, http.StatusBadRequest, "Thiếu Module ID hoặc Title")
		return
	}

	l, err := h.repo.CreateLesson(req.ModuleID, req.Title, req.VideoURL)
	if err != nil {
		h.sendError(w, http.StatusInternalServerError, "Lỗi tạo bài học mới: "+err.Error())
		return
	}

	h.sendJSON(w, http.StatusCreated, l)
}

// PUT /api/teacher/lessons/reorder
func (h *CourseBuilderHandler) UpdateLessonOrder(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodOptions {
		h.sendJSON(w, http.StatusOK, nil)
		return
	}

	var req struct {
		ModuleID  string   `json:"module_id"`
		LessonIDs []string `json:"lesson_ids"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.sendError(w, http.StatusBadRequest, "Dữ liệu yêu cầu không hợp lệ")
		return
	}

	if req.ModuleID == "" || len(req.LessonIDs) == 0 {
		h.sendError(w, http.StatusBadRequest, "Thiếu Module ID hoặc Danh sách Lesson ID")
		return
	}

	err := h.repo.UpdateLessonOrder(req.ModuleID, req.LessonIDs)
	if err != nil {
		h.sendError(w, http.StatusInternalServerError, "Lỗi sắp xếp lại bài học: "+err.Error())
		return
	}

	h.sendJSON(w, http.StatusOK, map[string]string{"message": "Sắp xếp bài học thành công"})
}

// PUT /api/teacher/courses/{course_id}/visibility
func (h *CourseBuilderHandler) ToggleCourseVisibility(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodOptions {
		h.sendJSON(w, http.StatusOK, nil)
		return
	}

	courseID := r.PathValue("course_id")
	if courseID == "" {
		parts := strings.Split(r.URL.Path, "/")
		for i, part := range parts {
			if part == "courses" && i+1 < len(parts) {
				courseID = parts[i+1]
				if strings.Contains(courseID, "?") {
					courseID = strings.Split(courseID, "?")[0]
				}
				break
			}
		}
	}

	if courseID == "" {
		h.sendError(w, http.StatusBadRequest, "Thiếu Course ID")
		return
	}

	var req struct {
		VisibilityStatus string `json:"visibility_status"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.sendError(w, http.StatusBadRequest, "Dữ liệu yêu cầu không hợp lệ")
		return
	}

	if req.VisibilityStatus != "DRAFT" && req.VisibilityStatus != "PUBLISHED" && req.VisibilityStatus != "ARCHIVED" {
		h.sendError(w, http.StatusBadRequest, "Trạng thái hiển thị không hợp lệ")
		return
	}

	err := h.repo.ToggleCourseVisibility(courseID, req.VisibilityStatus)
	if err != nil {
		h.sendError(w, http.StatusInternalServerError, "Lỗi cập nhật trạng thái hiển thị: "+err.Error())
		return
	}

	h.sendJSON(w, http.StatusOK, map[string]string{"message": "Cập nhật trạng thái thành công"})
}
