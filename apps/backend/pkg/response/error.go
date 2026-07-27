package response

import (
	"github.com/gin-gonic/gin"
	"github.com/tiredbooy/pkg/apperr"
)

// base — still useful internally and for one-off cases
func Error(c *gin.Context, appErr AppCode, fields ...map[string][]string) {
	res := ErrorResponse{
		Error: ErrorBody{
			Code:    appErr.Code,
			Message: appErr.Message,
		},
	}
	if len(fields) > 0 {
		res.Error.Fields = fields[0]
	}
	c.JSON(appErr.StatusCode, res)
}

// ── Shortcuts ────────────────────────────────────────────────

func BadRequest(c *gin.Context, appErr AppCode, fields ...map[string][]string) {
	Error(c, appErr, fields...)
}

func ValidationError(c *gin.Context, fields map[string][]string) {
	Error(c, ErrValidationError, fields)
}

func Unauthorized(c *gin.Context, appErr AppCode) {
	Error(c, appErr)
}

func Forbidden(c *gin.Context, appErr AppCode) {
	Error(c, appErr)
}

func NotFound(c *gin.Context, appErr AppCode) {
	Error(c, appErr)
}

func Conflict(c *gin.Context, appErr AppCode) {
	Error(c, appErr)
}

func TooManyRequests(c *gin.Context) {
	Error(c, ErrTooManyRequests)
}

func InternalError(c *gin.Context) {
	Error(c, ErrInternalError)
}

func HandleError(c *gin.Context, err error, fields ...map[string][]string) {
	if e, ok := apperr.As(err); ok {
		if len(fields) == 0 {
			if structured, hasFields := apperr.Fields(err); hasFields {
				fields = append(fields, structured)
			}
		}
		Error(c, FromAppError(e), fields...)
		return
	}
	// Unknown / unwrapped error — log it, return 500.
	// slog.Error("unhandled error", "err", err)
	Error(c, ErrInternalError)
}
