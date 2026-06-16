package handler

import (
	"admin-login-backend/repository"
	"encoding/json"
	"net/http"
	"strings"
)

type DictionaryHandler struct {
	repo repository.DictionaryRepository
}

func NewDictionaryHandler(repo repository.DictionaryRepository) *DictionaryHandler {
	return &DictionaryHandler{repo: repo}
}

func (h *DictionaryHandler) sendJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func (h *DictionaryHandler) sendError(w http.ResponseWriter, status int, message string) {
	h.sendJSON(w, status, map[string]string{"error": message})
}

// GET /api/dictionary/search?word=...&category_id=...
func (h *DictionaryHandler) SearchEntries(w http.ResponseWriter, r *http.Request) {
	keyword := strings.TrimSpace(r.URL.Query().Get("word"))

	entries, err := h.repo.SearchEntries(keyword)
	if err != nil {
		h.sendError(w, http.StatusInternalServerError, "Lỗi tìm kiếm từ vựng: "+err.Error())
		return
	}

	h.sendJSON(w, http.StatusOK, map[string]interface{}{
		"entries": entries,
		"total":   len(entries),
		"keyword": keyword,
	})
}

// GET /api/dictionary/entries/{id}/variations
func (h *DictionaryHandler) GetVariations(w http.ResponseWriter, r *http.Request) {
	// Extract entry ID from path: /api/dictionary/entries/{id}/variations
	path := r.URL.Path
	// Strip prefix and get the ID segment
	path = strings.TrimPrefix(path, "/api/dictionary/entries/")
	path = strings.TrimSuffix(path, "/variations")
	entryID := strings.Split(path, "/")[0]

	if entryID == "" {
		h.sendError(w, http.StatusBadRequest, "Thiếu entry_id")
		return
	}

	variations, err := h.repo.GetVariationsByEntryID(entryID)
	if err != nil {
		h.sendError(w, http.StatusInternalServerError, "Lỗi lấy biến thể: "+err.Error())
		return
	}

	h.sendJSON(w, http.StatusOK, map[string]interface{}{
		"entry_id":   entryID,
		"variations": variations,
		"total":      len(variations),
	})
}

// GET /api/dictionary/categories
func (h *DictionaryHandler) GetCategories(w http.ResponseWriter, r *http.Request) {
	cats, err := h.repo.GetCategories()
	if err != nil {
		h.sendError(w, http.StatusInternalServerError, "Lỗi lấy danh mục: "+err.Error())
		return
	}
	h.sendJSON(w, http.StatusOK, cats)
}
