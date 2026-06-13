package middleware

import (
	"context"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/tiredbooy/pkg/response"
)

func Timeout(duration time.Duration) gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(c.Request.Context(), duration)
		defer cancel()

		c.Request = c.Request.WithContext(ctx)

		done := make(chan struct{}, 1)
		go func() {
			c.Next()
			done <- struct{}{}
		}()

		select {
		case <-done:
		case <-ctx.Done():
			c.Abort()
			response.Error(c, response.ErrRequestTimeout)
		}

	}
}
