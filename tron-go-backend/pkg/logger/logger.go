package logger

import "go.uber.org/zap"

var Log *zap.SugaredLogger

func InitLogger() {
	// Automatically uses JSON in production, and colorful console output in dev
	logger, _ := zap.NewProduction()

	// Use Sugar() for easier syntax (similar to Printf)
	Log = logger.Sugar()
}

func Sync() {
	Log.Sync()
}
