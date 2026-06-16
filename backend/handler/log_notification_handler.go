package handler

import (
	"encoding/json"
	"net/http"
	"strings"
	"admin-login-backend/models"
	"admin-login-backend/repository"
)

type LogNotificationHandler struct {
	repo repository.LogNotificationRepository
}

func NewLogNotificationHandler(repo repository.LogNotificationRepository) *LogNotificationHandler {
	return &LogNotificationHandler{repo: repo}
}

func (h *LogNotificationHandler) sendJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS, PUT, DELETE")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Session-Key")
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func (h *LogNotificationHandler) sendError(w http.ResponseWriter, status int, message string) {
	h.sendJSON(w, status, map[string]string{"error": message})
}

// GET /api/notifications/{user_id}
func (h *LogNotificationHandler) GetNotifications(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodOptions {
		h.sendJSON(w, http.StatusOK, nil)
		return
	}

	userID := r.PathValue("user_id")
	if userID == "" {
		parts := strings.Split(r.URL.Path, "/")
		for i, part := range parts {
			if part == "notifications" && i+1 < len(parts) {
				userID = parts[i+1]
				if strings.Contains(userID, "?") {
					userID = strings.Split(userID, "?")[0]
				}
				break
			}
		}
	}

	if userID == "" {
		h.sendError(w, http.StatusBadRequest, "Thiếu user_id")
		return
	}

	list, err := h.repo.GetNotifications(userID)
	if err != nil {
		h.sendError(w, http.StatusInternalServerError, "Lỗi lấy thông báo: "+err.Error())
		return
	}

	if list == nil {
		list = []models.NotificationUser{}
	}

	h.sendJSON(w, http.StatusOK, list)
}

// PUT /api/notifications/{notification_id}/read
func (h *LogNotificationHandler) MarkNotificationAsRead(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodOptions {
		h.sendJSON(w, http.StatusOK, nil)
		return
	}

	notificationID := r.PathValue("notification_id")
	if notificationID == "" {
		parts := strings.Split(r.URL.Path, "/")
		for i, part := range parts {
			if part == "notifications" && i+1 < len(parts) {
				notificationID = parts[i+1]
				if strings.Contains(notificationID, "?") {
					notificationID = strings.Split(notificationID, "?")[0]
				}
				break
			}
		}
	}

	if notificationID == "" {
		h.sendError(w, http.StatusBadRequest, "Thiếu notification_id")
		return
	}

	err := h.repo.MarkNotificationAsRead(notificationID)
	if err != nil {
		h.sendError(w, http.StatusInternalServerError, "Lỗi đánh dấu đã đọc: "+err.Error())
		return
	}

	h.sendJSON(w, http.StatusOK, map[string]string{"message": "Đã đánh dấu đã đọc"})
}

// GET /api/admin/audit-logs
func (h *LogNotificationHandler) GetAuditLogs(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodOptions {
		h.sendJSON(w, http.StatusOK, nil)
		return
	}

	logs, err := h.repo.GetAuditLogs()
	if err != nil {
		h.sendError(w, http.StatusInternalServerError, "Lỗi lấy audit logs: "+err.Error())
		return
	}

	if logs == nil {
		logs = []models.AuditLog{}
	}

	h.sendJSON(w, http.StatusOK, logs)
}
