package handler

import (
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"admin-login-backend/models"
	"admin-login-backend/repository"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

type AuthHandler struct {
	repo repository.AuthRepository
}

func NewAuthHandler(repo repository.AuthRepository) *AuthHandler {
	return &AuthHandler{repo: repo}
}

func (h *AuthHandler) AdminLogin(w http.ResponseWriter, r *http.Request) {
	// Only allow POST requests
	if r.Method != http.MethodPost {
		h.sendError(w, http.StatusMethodNotAllowed, "Phương thức HTTP không được hỗ trợ")
		return
	}

	var req models.LoginRequest
	err := json.NewDecoder(r.Body).Decode(&req)
	if err != nil {
		h.sendError(w, http.StatusBadRequest, "Dữ liệu yêu cầu không hợp lệ")
		return
	}

	req.Username = strings.TrimSpace(req.Username)
	if req.Username == "" || req.Password == "" {
		h.sendError(w, http.StatusBadRequest, "Username và password không được để trống")
		return
	}

	// 1. Tìm user theo username
	user, err := h.repo.GetUserByUsername(req.Username)
	if err != nil {
		h.sendError(w, http.StatusInternalServerError, "Lỗi truy vấn cơ sở dữ liệu")
		return
	}

	if user == nil {
		h.sendError(w, http.StatusUnauthorized, "Username hoặc mật khẩu không chính xác")
		return
	}

	// 2. Kiểm tra status: Nếu là 'frozen' -> 403
	if user.Status == "frozen" {
		h.sendError(w, http.StatusForbidden, "Tài khoản này đã bị khóa (frozen)")
		return
	}

	// 3. Kiểm tra vai trò: Phải là 'ADMIN'
	if user.RoleName != "ADMIN" {
		h.sendError(w, http.StatusForbidden, "Truy cập bị từ chối: Chỉ dành cho Admin")
		return
	}

	// 4. Kiểm tra mật khẩu (bcrypt)
	err = bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password))
	if err != nil {
		h.sendError(w, http.StatusUnauthorized, "Username hoặc mật khẩu không chính xác")
		return
	}

	// 5. Tạo UUID session key và lưu vào DB với hạn dùng 24h sau
	sessionKey := uuid.New().String()
	expiresAt := time.Now().Add(24 * time.Hour)

	err = h.repo.CreateSession(user.UserID, sessionKey, expiresAt)
	if err != nil {
		h.sendError(w, http.StatusInternalServerError, "Lỗi tạo session đăng nhập")
		return
	}

	// 6. Trả về phản hồi JSON thành công
	resp := models.LoginResponse{
		Message:    "Đăng nhập thành công",
		SessionKey: sessionKey,
		User: models.UserInfo{
			UserID:   user.UserID,
			Username: user.Username,
			Email:    user.Email,
			RoleName: user.RoleName,
		},
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(resp)
}

func (h *AuthHandler) sendError(w http.ResponseWriter, statusCode int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	json.NewEncoder(w).Encode(map[string]string{
		"error": message,
	})
}
