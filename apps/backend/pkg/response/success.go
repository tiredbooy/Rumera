package response

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

func Success[T any](c *gin.Context, status int, data T, message ...string) {
	res := Response[T]{Data: &data}
	if len(message) > 0 {
		res.Message = message[0]
	}
	c.JSON(status, res)
}

func OK[T any](c *gin.Context, data T, message ...string) {
	Success(c, http.StatusOK, data, message...)
}

func Created[T any](c *gin.Context, data T, message ...string) {
	Success(c, http.StatusCreated, data, message...)
}

func NoContent(c *gin.Context) {
	c.Status(http.StatusNoContent)
}
