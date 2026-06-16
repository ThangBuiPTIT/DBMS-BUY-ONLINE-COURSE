package handler

import (
	"encoding/json"
	"net/http"
	"strings"

	"admin-login-backend/models"
	"admin-login-backend/repository"
)

type StoreHandler struct {
	repo repository.StoreRepository
}

func NewStoreHandler(repo repository.StoreRepository) *StoreHandler {
	return &StoreHandler{repo: repo}
}

func getUserIDFromPath(r *http.Request) string {
	id := r.PathValue("user_id")
	if id != "" {
		return id
	}

	// Fallback split logic
	parts := r.URL.Path
	splitParts := strings.Split(parts, "/")
	for i, part := range splitParts {
		if part == "wallet" && i+1 < len(splitParts) {
			return splitParts[i+1]
		}
	}
	return ""
}

// GetStoreCourses fetches published courses
func (h *StoreHandler) GetStoreCourses(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
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

	studentID := r.URL.Query().Get("student_id")
	courses, err := h.repo.GetPublishedCourses(studentID)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	json.NewEncoder(w).Encode(courses)
}

// GetWallet returns wallet balance for the student
func (h *StoreHandler) GetWallet(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
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

	userID := getUserIDFromPath(r)
	if userID == "" {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "Thiếu User ID"})
		return
	}

	wallet, err := h.repo.GetWalletBalance(userID)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	json.NewEncoder(w).Encode(wallet)
}

// TopupWallet adds money to the student's wallet
func (h *StoreHandler) TopupWallet(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
	w.Header().Set("Content-Type", "application/json")

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		json.NewEncoder(w).Encode(map[string]string{"error": "Method not allowed"})
		return
	}

	var req models.TopupRequest
	err := json.NewDecoder(r.Body).Decode(&req)
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "Dữ liệu yêu cầu không hợp lệ"})
		return
	}

	if req.UserID == "" || req.Amount <= 0 {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "Dữ liệu nạp tiền thiếu hoặc không hợp lệ"})
		return
	}

	err = h.repo.TopupWallet(req.UserID, req.Amount, req.Message)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "SUCCESS", "message": "Nạp tiền thành công"})
}

// CheckoutCourse performs wallet deduction and enrollment insertion
func (h *StoreHandler) CheckoutCourse(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
	w.Header().Set("Content-Type", "application/json")

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		json.NewEncoder(w).Encode(map[string]string{"error": "Method not allowed"})
		return
	}

	var req models.CheckoutRequest
	err := json.NewDecoder(r.Body).Decode(&req)
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "Dữ liệu yêu cầu không hợp lệ"})
		return
	}

	if req.StudentID == "" || req.CourseID == "" {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "Thiếu ID Học viên hoặc ID Khóa học"})
		return
	}

	err = h.repo.BuyCourseWithWallet(req.StudentID, req.CourseID)
	if err != nil {
		// Detect specific database exceptions and return clean error string
		errMsg := err.Error()
		if strings.Contains(errMsg, "Số dư không đủ") {
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(map[string]string{"error": "Số dư không đủ để mua khóa học này"})
			return
		}
		if strings.Contains(errMsg, "Khóa học không tồn tại") {
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(map[string]string{"error": "Khóa học không tồn tại"})
			return
		}
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": errMsg})
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "SUCCESS", "message": "Mua khóa học thành công"})
}
