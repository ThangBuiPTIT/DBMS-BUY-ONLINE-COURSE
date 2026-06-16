package repository

import (
	"admin-login-backend/config"
	"admin-login-backend/models"
	"database/sql"
	"encoding/json"
)

type MicrolearningRepository interface {
	GetRoadmap() ([]models.MicrolearningTopic, error)
	GetLessonParts(lessonID string) ([]models.MicrolearningLessonPart, error)
	GetPartQuestions(partID string) ([]models.MicrolearningQuestion, error)
}

type microlearningRepository struct {
	db *sql.DB
}

func NewMicrolearningRepository() MicrolearningRepository {
	return &microlearningRepository{db: config.DB}
}

func (r *microlearningRepository) GetRoadmap() ([]models.MicrolearningTopic, error) {
	query := `
		SELECT 
			t.topic_id,
			t.title,
			COALESCE(t.description, '') AS description,
			COALESCE(
				(
					SELECT json_agg(unit_data ORDER BY unit_data.order_index ASC)
					FROM (
						SELECT 
							u.unit_id,
							u.topic_id,
							u.title,
							u.order_index,
							COALESCE(
								(
									SELECT json_agg(lesson_data ORDER BY lesson_data.order_index ASC)
									FROM (
										SELECT 
											l.lesson_id,
											l.unit_id,
											l.title,
											COALESCE(l.video_url, '') AS video_url,
											l.order_index
										FROM microlearning_lessons l
										WHERE l.unit_id = u.unit_id
									) lesson_data
								), '[]'::json
							) AS lessons
						FROM microlearning_units u
						WHERE u.topic_id = t.topic_id
					) unit_data
				), '[]'::json
			) AS units
		FROM microlearning_topics t
		ORDER BY t.topic_id ASC;
	`
	rows, err := r.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var topics []models.MicrolearningTopic
	for rows.Next() {
		var t models.MicrolearningTopic
		var unitsJSON []byte

		err := rows.Scan(
			&t.TopicID,
			&t.Title,
			&t.Description,
			&unitsJSON,
		)
		if err != nil {
			return nil, err
		}

		t.Units = []models.MicrolearningUnit{}
		if err := json.Unmarshal(unitsJSON, &t.Units); err != nil {
			return nil, err
		}

		topics = append(topics, t)
	}

	if topics == nil {
		topics = []models.MicrolearningTopic{}
	}

	return topics, nil
}

func (r *microlearningRepository) GetLessonParts(lessonID string) ([]models.MicrolearningLessonPart, error) {
	query := `
		SELECT part_id, lesson_id, COALESCE(title, '') AS title, part_type, COALESCE(content, '') AS content, order_index
		FROM microlearning_lesson_parts
		WHERE lesson_id = $1
		ORDER BY order_index ASC;
	`
	rows, err := r.db.Query(query, lessonID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var parts []models.MicrolearningLessonPart
	for rows.Next() {
		var p models.MicrolearningLessonPart
		err := rows.Scan(
			&p.PartID,
			&p.LessonID,
			&p.Title,
			&p.PartType,
			&p.Content,
			&p.OrderIndex,
		)
		if err != nil {
			return nil, err
		}
		parts = append(parts, p)
	}

	if parts == nil {
		parts = []models.MicrolearningLessonPart{}
	}
	return parts, nil
}

func (r *microlearningRepository) GetPartQuestions(partID string) ([]models.MicrolearningQuestion, error) {
	query := `
		SELECT question_id, part_id, question_text, question_type, options_json, correct_answer
		FROM microlearning_questions
		WHERE part_id = $1;
	`
	rows, err := r.db.Query(query, partID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var questions []models.MicrolearningQuestion
	for rows.Next() {
		var q models.MicrolearningQuestion
		err := rows.Scan(
			&q.QuestionID,
			&q.PartID,
			&q.QuestionText,
			&q.QuestionType,
			&q.OptionsJSON,
			&q.CorrectAnswer,
		)
		if err != nil {
			return nil, err
		}
		questions = append(questions, q)
	}

	if questions == nil {
		questions = []models.MicrolearningQuestion{}
	}
	return questions, nil
}
