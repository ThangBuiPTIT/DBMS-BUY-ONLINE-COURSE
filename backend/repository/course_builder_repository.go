package repository

import (
	"database/sql"
	"fmt"
	"admin-login-backend/config"
	"admin-login-backend/models"
)

type CourseBuilderRepository interface {
	GetCourseContent(courseID string) (*models.CourseContentResponse, error)
	CreateModule(courseID string, title string) (*models.GeneralCourseModule, error)
	CreateLesson(moduleID string, title string, videoURL string) (*models.GeneralCourseLesson, error)
	UpdateLessonOrder(moduleID string, lessonIDs []string) error
	ToggleCourseVisibility(courseID string, status string) error
}

type courseBuilderRepository struct {
	db *sql.DB
}

func NewCourseBuilderRepository() CourseBuilderRepository {
	return &courseBuilderRepository{db: config.DB}
}

func (r *courseBuilderRepository) GetCourseContent(courseID string) (*models.CourseContentResponse, error) {
	// 1. Get Course Info
	var res models.CourseContentResponse
	err := r.db.QueryRow(`
		SELECT course_id, title, visibility_status 
		FROM general_courses 
		WHERE course_id = $1 AND is_deleted = FALSE
	`, courseID).Scan(&res.CourseID, &res.Title, &res.VisibilityStatus)
	if err != nil {
		return nil, fmt.Errorf("course not found: %v", err)
	}

	// 2. Get Modules
	rows, err := r.db.Query(`
		SELECT module_id, course_id, title, order_index 
		FROM general_course_modules 
		WHERE course_id = $1 
		ORDER BY order_index ASC
	`, courseID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	modulesMap := make(map[string]*models.GeneralCourseModule)
	var modulesList []models.GeneralCourseModule

	for rows.Next() {
		var m models.GeneralCourseModule
		m.Lessons = []models.GeneralCourseLesson{}
		if err := rows.Scan(&m.ModuleID, &m.CourseID, &m.Title, &m.OrderIndex); err != nil {
			return nil, err
		}
		modulesList = append(modulesList, m)
	}

	// 3. Get Lessons
	lessonRows, err := r.db.Query(`
		SELECT lesson_id, module_id, title, COALESCE(video_url, ''), order_index 
		FROM general_course_lessons 
		WHERE module_id IN (
			SELECT module_id FROM general_course_modules WHERE course_id = $1
		)
		ORDER BY order_index ASC
	`, courseID)
	if err != nil {
		return nil, err
	}
	defer lessonRows.Close()

	lessonsMap := make(map[string]*models.GeneralCourseLesson)
	var lessonsList []models.GeneralCourseLesson

	for lessonRows.Next() {
		var l models.GeneralCourseLesson
		l.Materials = []models.LearningMaterial{}
		if err := lessonRows.Scan(&l.LessonID, &l.ModuleID, &l.Title, &l.VideoURL, &l.OrderIndex); err != nil {
			return nil, err
		}
		lessonsList = append(lessonsList, l)
	}

	// 4. Get Materials
	materialRows, err := r.db.Query(`
		SELECT material_id, lesson_id, title, content_url 
		FROM learning_materials 
		WHERE lesson_id IN (
			SELECT lesson_id FROM general_course_lessons WHERE module_id IN (
				SELECT module_id FROM general_course_modules WHERE course_id = $1
			)
		)
	`, courseID)
	if err != nil {
		return nil, err
	}
	defer materialRows.Close()

	var materialsList []models.LearningMaterial
	for materialRows.Next() {
		var mat models.LearningMaterial
		if err := materialRows.Scan(&mat.MaterialID, &mat.LessonID, &mat.Title, &mat.ContentURL); err != nil {
			return nil, err
		}
		materialsList = append(materialsList, mat)
	}

	// Nest materials inside lessons
	for i := range lessonsList {
		lessonsMap[lessonsList[i].LessonID] = &lessonsList[i]
	}
	for _, mat := range materialsList {
		if l, ok := lessonsMap[mat.LessonID]; ok {
			l.Materials = append(l.Materials, mat)
		}
	}

	// Nest lessons inside modules
	for i := range modulesList {
		modulesMap[modulesList[i].ModuleID] = &modulesList[i]
	}
	for _, l := range lessonsList {
		if m, ok := modulesMap[l.ModuleID]; ok {
			m.Lessons = append(m.Lessons, l)
		}
	}

	// Build final response slice
	res.Modules = make([]models.GeneralCourseModule, len(modulesList))
	for i, m := range modulesList {
		res.Modules[i] = *modulesMap[m.ModuleID]
	}

	return &res, nil
}

func (r *courseBuilderRepository) CreateModule(courseID string, title string) (*models.GeneralCourseModule, error) {
	var maxOrder int
	err := r.db.QueryRow(`
		SELECT COALESCE(MAX(order_index), 0) 
		FROM general_course_modules 
		WHERE course_id = $1
	`, courseID).Scan(&maxOrder)
	if err != nil {
		return nil, err
	}

	nextOrder := maxOrder + 1

	var m models.GeneralCourseModule
	m.CourseID = courseID
	m.Title = title
	m.OrderIndex = nextOrder
	m.Lessons = []models.GeneralCourseLesson{}

	err = r.db.QueryRow(`
		INSERT INTO general_course_modules (course_id, title, order_index) 
		VALUES ($1, $2, $3) 
		RETURNING module_id
	`, courseID, title, nextOrder).Scan(&m.ModuleID)
	if err != nil {
		return nil, err
	}

	return &m, nil
}

func (r *courseBuilderRepository) CreateLesson(moduleID string, title string, videoURL string) (*models.GeneralCourseLesson, error) {
	var maxOrder int
	err := r.db.QueryRow(`
		SELECT COALESCE(MAX(order_index), 0) 
		FROM general_course_lessons 
		WHERE module_id = $1
	`, moduleID).Scan(&maxOrder)
	if err != nil {
		return nil, err
	}

	nextOrder := maxOrder + 1

	var l models.GeneralCourseLesson
	l.ModuleID = moduleID
	l.Title = title
	l.VideoURL = videoURL
	l.OrderIndex = nextOrder
	l.Materials = []models.LearningMaterial{}

	err = r.db.QueryRow(`
		INSERT INTO general_course_lessons (module_id, title, video_url, order_index) 
		VALUES ($1, $2, $3, $4) 
		RETURNING lesson_id
	`, moduleID, title, videoURL, nextOrder).Scan(&l.LessonID)
	if err != nil {
		return nil, err
	}

	return &l, nil
}

func (r *courseBuilderRepository) UpdateLessonOrder(moduleID string, lessonIDs []string) error {
	tx, err := r.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// 1. Shift all lessons to safe out-of-range offsets to prevent UNIQUE constraint violations
	_, err = tx.Exec(`
		UPDATE general_course_lessons 
		SET order_index = order_index + 10000 
		WHERE module_id = $1
	`, moduleID)
	if err != nil {
		return err
	}

	// 2. Assign target sequential indices
	for idx, lessonID := range lessonIDs {
		targetOrder := idx + 1
		_, err = tx.Exec(`
			UPDATE general_course_lessons 
			SET order_index = $1 
			WHERE lesson_id = $2 AND module_id = $3
		`, targetOrder, lessonID, moduleID)
		if err != nil {
			return err
		}
	}

	return tx.Commit()
}

func (r *courseBuilderRepository) ToggleCourseVisibility(courseID string, status string) error {
	_, err := r.db.Exec(`
		UPDATE general_courses 
		SET visibility_status = $1 
		WHERE course_id = $2 AND is_deleted = FALSE
	`, status, courseID)
	return err
}
