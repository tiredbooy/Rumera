package middleware

import (
	"github.com/gin-gonic/gin"
	"github.com/tiredbooy/pkg/response"
	"go.uber.org/zap"
)

func Recovery(log *zap.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		defer func() {
			if err := recover(); err != nil {
				log.Error("panic recovered",
					zap.String("request_id", c.GetString(RequestIDKey)),
					zap.String("method", c.Request.Method),
					zap.String("path", c.Request.URL.Path),
					zap.Any("error", err),
					zap.Stack("stack"),
				)

				c.Abort()
				response.InternalError(c)
			}
		}()

		c.Next()
	}
}
