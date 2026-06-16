package main

import (
	"log"
	"net/http"
	"os"

	"admin-login-backend/config"
	"admin-login-backend/handler"
	"admin-login-backend/repository"
)

// corsMiddleware adds CORS headers to allow frontend interaction
func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Set headers
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS, PUT, DELETE")
		w.Header().Set("Access-Control-Allow-Headers", "Accept, Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, Session-Key")

		// Handle preflight OPTIONS request
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func main() {
	// 1. Khởi tạo DB connection
	config.InitDB()
	defer config.DB.Close()

	// 2. Khởi tạo Repository và Handler
	authRepo := repository.NewAuthRepository()
	authHandler := handler.NewAuthHandler(authRepo)

	adminRepo := repository.NewAdminRepository()
	adminHandler := handler.NewAdminHandler(adminRepo)

	teacherRepo := repository.NewTeacherRepository()
	teacherHandler := handler.NewTeacherHandler(teacherRepo)

	studentRepo := repository.NewStudentRepository()
	studentHandler := handler.NewStudentHandler(studentRepo)

	storeRepo := repository.NewStoreRepository()
	storeHandler := handler.NewStoreHandler(storeRepo)

	gamificationRepo := repository.NewGamificationRepository()
	gamificationHandler := handler.NewGamificationHandler(gamificationRepo)

	dictRepo := repository.NewDictionaryRepository()
	dictHandler := handler.NewDictionaryHandler(dictRepo)

	microlearningRepo := repository.NewMicrolearningRepository()
	microlearningHandler := handler.NewMicrolearningHandler(microlearningRepo)

	courseBuilderRepo := repository.NewCourseBuilderRepository()
	courseBuilderHandler := handler.NewCourseBuilderHandler(courseBuilderRepo)

	logNotificationRepo := repository.NewLogNotificationRepository()
	logNotificationHandler := handler.NewLogNotificationHandler(logNotificationRepo)

	// 3. Khởi tạo Router
	mux := http.NewServeMux()
	mux.HandleFunc("/api/auth/admin-login", authHandler.AdminLogin)
	mux.HandleFunc("/api/admin/transactions", adminHandler.GetTransactions)
	mux.HandleFunc("/api/admin/revenue", adminHandler.GetRevenue)
	mux.HandleFunc("/api/admin/users/ban", adminHandler.BanUser)
	mux.HandleFunc("/api/teacher/{id}/dashboard", teacherHandler.GetTeacherDashboard)
	mux.HandleFunc("/api/teacher/{id}/courses", teacherHandler.GetTeacherCourses)
	mux.HandleFunc("/api/teacher/{id}/feedback", teacherHandler.GetTeacherFeedback)
	mux.HandleFunc("/api/teacher/{id}/feedbacks", teacherHandler.GetTeacherFeedback)
	mux.HandleFunc("/api/students/search", studentHandler.SearchStudents)
	mux.HandleFunc("/api/students/progress", studentHandler.GetProgressReport)
	mux.HandleFunc("/api/students/inactive", studentHandler.GetInactiveStudents)
	mux.HandleFunc("/api/store/courses", storeHandler.GetStoreCourses)
	mux.HandleFunc("/api/wallet/{user_id}", storeHandler.GetWallet)
	mux.HandleFunc("/api/wallet/topup", storeHandler.TopupWallet)
	mux.HandleFunc("/api/store/checkout", storeHandler.CheckoutCourse)
	mux.HandleFunc("/api/gamification/leaderboard", gamificationHandler.GetLeaderboard)
	mux.HandleFunc("/api/gamification/streak/", gamificationHandler.GetStudentStreak)
	mux.HandleFunc("/api/dictionary/search", dictHandler.SearchEntries)
	mux.HandleFunc("/api/dictionary/categories", dictHandler.GetCategories)
	mux.HandleFunc("/api/dictionary/entries/", dictHandler.GetVariations)
	mux.HandleFunc("/api/microlearning/roadmap", microlearningHandler.GetRoadmap)
	mux.HandleFunc("/api/microlearning/lessons/{lesson_id}/parts", microlearningHandler.GetLessonParts)
	mux.HandleFunc("/api/microlearning/parts/{part_id}/questions", microlearningHandler.GetPartQuestions)
	mux.HandleFunc("/api/teacher/courses/{course_id}/content", courseBuilderHandler.GetCourseContent)
	mux.HandleFunc("/api/teacher/modules", courseBuilderHandler.CreateModule)
	mux.HandleFunc("/api/teacher/lessons", courseBuilderHandler.CreateLesson)
	mux.HandleFunc("/api/teacher/lessons/reorder", courseBuilderHandler.UpdateLessonOrder)
	mux.HandleFunc("/api/teacher/courses/{course_id}/visibility", courseBuilderHandler.ToggleCourseVisibility)
	mux.HandleFunc("/api/notifications/{user_id}", logNotificationHandler.GetNotifications)
	mux.HandleFunc("/api/notifications/{notification_id}/read", logNotificationHandler.MarkNotificationAsRead)
	mux.HandleFunc("/api/admin/audit-logs", logNotificationHandler.GetAuditLogs)


	// 4. Wrap với CORS Middleware
	handlerWithCORS := corsMiddleware(mux)

	// 5. Xác định port và chạy server
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Server is running on port %s...", port)
	err := http.ListenAndServe(":"+port, handlerWithCORS)
	if err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
