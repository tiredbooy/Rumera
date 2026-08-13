package httpx

import (
	"fmt"
	"reflect"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/tiredbooy/pkg/response"
)

// Context keys must match internal/middlewares (ctxKeyUID / ctxKeyUserID).
// httpx deliberately does not import middlewares to avoid feature→httpx→
// middleware→feature import cycles.
const (
	ctxKeyUserID = "userID" // uuid.UUID — public identifier
	ctxKeyUID    = "uid"    // int64    — internal users.id
)

// Validator is the subset of pkg/validator used by request binding.
// A nil Validator skips struct validation (used in some tests).
type Validator interface {
	Validate(s any) (map[string][]string, error)
}

// BindJSON decodes the JSON body into dst and runs struct validation.
// On failure it writes the error response and returns false.
func BindJSON(c *gin.Context, v Validator, dst any) bool {
	if err := c.ShouldBindJSON(dst); err != nil {
		response.Error(c, response.ErrInvalidJSON)
		return false
	}
	return Validate(c, v, dst)
}

// Validate runs the struct validator and writes a 422 with field errors when it fails.
func Validate(c *gin.Context, v Validator, dst any) bool {
	if v == nil {
		return true
	}
	fields, err := v.Validate(dst)
	if err != nil {
		if len(fields) > 0 {
			response.ValidationError(c, fields)
		} else {
			response.Error(c, response.ErrInvalidBody)
		}
		return false
	}
	return true
}

// ParamInt64 reads a positive int64 path parameter.
func ParamInt64(c *gin.Context, key string) (int64, bool) {
	id, err := strconv.ParseInt(c.Param(key), 10, 64)
	if err != nil || id <= 0 {
		response.Error(c, response.ErrInvalidParams)
		return 0, false
	}
	return id, true
}

// ParamUUID reads a UUID path parameter.
func ParamUUID(c *gin.Context, key string) (uuid.UUID, bool) {
	id, err := uuid.Parse(c.Param(key))
	if err != nil {
		response.Error(c, response.ErrInvalidParams)
		return uuid.UUID{}, false
	}
	return id, true
}

// UID returns the authenticated caller's internal user id.
func UID(c *gin.Context) (int64, bool) {
	v, ok := c.Get(ctxKeyUID)
	if !ok {
		response.Error(c, response.ErrUnauthorized)
		return 0, false
	}
	id, ok := v.(int64)
	if !ok || id <= 0 {
		response.Error(c, response.ErrUnauthorized)
		return 0, false
	}
	return id, true
}

// UserUUID returns the authenticated caller's public uuid.
func UserUUID(c *gin.Context) (uuid.UUID, bool) {
	v, ok := c.Get(ctxKeyUserID)
	if !ok {
		response.Error(c, response.ErrUnauthorized)
		return uuid.UUID{}, false
	}
	id, ok := v.(uuid.UUID)
	if !ok || id == uuid.Nil {
		response.Error(c, response.ErrUnauthorized)
		return uuid.UUID{}, false
	}
	return id, true
}

// BindQuery populates dst from the URL query string using `query` struct tags
// (and the lower-cased field name when no tag is present).
func BindQuery(c *gin.Context, v Validator, dst any) bool {
	rv := reflect.ValueOf(dst)
	if rv.Kind() != reflect.Ptr || rv.IsNil() {
		response.Error(c, response.ErrInvalidQuery)
		return false
	}
	if err := bindStruct(c, rv.Elem()); err != nil {
		response.Error(c, response.ErrInvalidQuery)
		return false
	}
	if !validBaseQuery(c) {
		response.Error(c, response.ErrInvalidQuery)
		return false
	}
	if v != nil {
		if _, err := v.Validate(dst); err != nil {
			response.Error(c, response.ErrInvalidQuery)
			return false
		}
	}
	return true
}

func validBaseQuery(c *gin.Context) bool {
	if raw, present := c.GetQuery("page"); present && raw != "" {
		page, err := strconv.Atoi(raw)
		if err != nil || page < 1 {
			return false
		}
	}
	if raw, present := c.GetQuery("limit"); present && raw != "" {
		limit, err := strconv.Atoi(raw)
		if err != nil || limit < 1 || limit > 100 {
			return false
		}
	}
	if order, present := c.GetQuery("orderBy"); present && order != "" && order != "asc" && order != "desc" {
		return false
	}
	return true
}

var timeType = reflect.TypeOf(time.Time{})

func bindStruct(c *gin.Context, v reflect.Value) error {
	t := v.Type()
	for i := 0; i < t.NumField(); i++ {
		field := t.Field(i)
		fv := v.Field(i)

		// Recurse into embedded (anonymous) structs — but not time.Time.
		if field.Anonymous && fv.Kind() == reflect.Struct && fv.Type() != timeType {
			if err := bindStruct(c, fv); err != nil {
				return err
			}
			continue
		}
		if !fv.CanSet() {
			continue
		}

		key := field.Tag.Get("query")
		if key == "" {
			key = strings.ToLower(field.Name)
		}
		raw := c.Query(key)
		if raw == "" {
			continue
		}
		if err := setField(fv, raw); err != nil {
			return fmt.Errorf("query %q: %w", key, err)
		}
	}
	return nil
}

func setField(fv reflect.Value, raw string) error {
	if fv.Kind() == reflect.Ptr {
		if fv.IsNil() {
			fv.Set(reflect.New(fv.Type().Elem()))
		}
		return setField(fv.Elem(), raw)
	}

	switch fv.Kind() {
	case reflect.String:
		fv.SetString(raw)
	case reflect.Bool:
		b, err := strconv.ParseBool(raw)
		if err != nil {
			return err
		}
		fv.SetBool(b)
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
		n, err := strconv.ParseInt(raw, 10, 64)
		if err != nil {
			return err
		}
		fv.SetInt(n)
	case reflect.Float32, reflect.Float64:
		f, err := strconv.ParseFloat(raw, 64)
		if err != nil {
			return err
		}
		fv.SetFloat(f)
	case reflect.Struct:
		if fv.Type() == timeType {
			ts, err := time.Parse(time.RFC3339, raw)
			if err != nil {
				return err
			}
			fv.Set(reflect.ValueOf(ts))
			return nil
		}
		return fmt.Errorf("unsupported struct type %s", fv.Type())
	default:
		return fmt.Errorf("unsupported kind %s", fv.Kind())
	}
	return nil
}
