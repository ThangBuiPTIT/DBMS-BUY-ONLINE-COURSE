package repository

import (
	"admin-login-backend/config"
	"admin-login-backend/models"
	"database/sql"
	"fmt"
	"strings"
)

type DictionaryRepository interface {
	SearchEntries(keyword string) ([]models.DictionaryEntry, error)
	GetVariationsByEntryID(entryID string) ([]models.DictionaryVariation, error)
	GetCategories() ([]models.DictionaryCategory, error)
}

type dictionaryRepository struct {
	db *sql.DB
}

func NewDictionaryRepository() DictionaryRepository {
	return &dictionaryRepository{db: config.DB}
}

func (r *dictionaryRepository) SearchEntries(keyword string) ([]models.DictionaryEntry, error) {
	query := `
		SELECT 
			e.entry_id,
			e.category_id,
			COALESCE(c.name, '') AS category_name,
			e.word,
			e.meaning,
			e.updated_at
		FROM dictionary_entries e
		LEFT JOIN dictionary_categories c ON e.category_id = c.category_id
		WHERE e.is_deleted = FALSE
		  AND ($1 = '' OR e.word ILIKE '%' || $1 || '%' OR e.meaning ILIKE '%' || $1 || '%')
		ORDER BY
			CASE WHEN LOWER(e.word) = LOWER($1) THEN 0
			     WHEN LOWER(e.word) LIKE LOWER($1) || '%' THEN 1
			     ELSE 2 END,
			e.word ASC
		LIMIT 30
	`
	rows, err := r.db.Query(query, strings.TrimSpace(keyword))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var entries []models.DictionaryEntry
	entryMap := make(map[string]int)

	for rows.Next() {
		var e models.DictionaryEntry
		err := rows.Scan(
			&e.EntryID,
			&e.CategoryID,
			&e.CategoryName,
			&e.Word,
			&e.Meaning,
			&e.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		e.Variations = []models.DictionaryVariation{}
		entryMap[e.EntryID] = len(entries)
		entries = append(entries, e)
	}

	if len(entries) == 0 {
		return []models.DictionaryEntry{}, nil
	}

	// Batch query variations to avoid N+1 query overhead
	var placeholders []string
	var args []interface{}
	for i, e := range entries {
		placeholders = append(placeholders, fmt.Sprintf("$%d", i+1))
		args = append(args, e.EntryID)
	}

	varQuery := fmt.Sprintf(`
		SELECT
			variation_id,
			entry_id,
			COALESCE(region, '') AS region,
			video_url,
			COALESCE(description, '') AS description
		FROM dictionary_variations
		WHERE entry_id IN (%s)
		ORDER BY region ASC
	`, strings.Join(placeholders, ","))

	varRows, err := r.db.Query(varQuery, args...)
	if err != nil {
		return nil, err
	}
	defer varRows.Close()

	for varRows.Next() {
		var v models.DictionaryVariation
		err := varRows.Scan(
			&v.VariationID,
			&v.EntryID,
			&v.Region,
			&v.VideoURL,
			&v.Description,
		)
		if err != nil {
			return nil, err
		}
		if idx, ok := entryMap[v.EntryID]; ok {
			entries[idx].Variations = append(entries[idx].Variations, v)
		}
	}

	return entries, nil
}

func (r *dictionaryRepository) GetVariationsByEntryID(entryID string) ([]models.DictionaryVariation, error) {
	query := `
		SELECT
			variation_id,
			entry_id,
			COALESCE(region, '') AS region,
			video_url,
			COALESCE(description, '') AS description
		FROM dictionary_variations
		WHERE entry_id = $1
		ORDER BY region ASC
	`
	rows, err := r.db.Query(query, entryID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var variations []models.DictionaryVariation
	for rows.Next() {
		var v models.DictionaryVariation
		err := rows.Scan(
			&v.VariationID,
			&v.EntryID,
			&v.Region,
			&v.VideoURL,
			&v.Description,
		)
		if err != nil {
			return nil, err
		}
		variations = append(variations, v)
	}
	if variations == nil {
		variations = []models.DictionaryVariation{}
	}
	return variations, nil
}

func (r *dictionaryRepository) GetCategories() ([]models.DictionaryCategory, error) {
	rows, err := r.db.Query(`SELECT category_id, name, COALESCE(description, '') FROM dictionary_categories ORDER BY name ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var cats []models.DictionaryCategory
	for rows.Next() {
		var c models.DictionaryCategory
		if err := rows.Scan(&c.CategoryID, &c.Name, &c.Description); err != nil {
			return nil, err
		}
		cats = append(cats, c)
	}
	if cats == nil {
		cats = []models.DictionaryCategory{}
	}
	return cats, nil
}
