package validator

import (
	"errors"
	"reflect"
	"strings"

	"github.com/go-playground/validator/v10"
)

type Validator struct {
	v *validator.Validate
}

func New() *Validator {
	v := validator.New()

	v.RegisterTagNameFunc(func(field reflect.StructField) string {
		tag := field.Tag.Get("json")
		name := strings.SplitN(tag, ",", 2)[0]
		if name == "-" || name == "" {
			return ""
		}
		return name
	})

	return &Validator{v: v}
}

func (v *Validator) Validate(s interface{}) (map[string][]string, error) {
	err := v.v.Struct(s)
	if err == nil {
		return nil, nil
	}

	var ve validator.ValidationErrors
	if !errors.As(err, &ve) {
		return nil, err
	}

	fields := make(map[string][]string, len(ve))
	for _, fe := range ve {
		field := fe.Field()
		fields[field] = append(fields[field], message(fe))
	}

	return fields, err
}

func message(fe validator.FieldError) string {
	switch fe.Tag() {
	case "required":
		return fe.Field() + " is required"
	case "email":
		return "must be a valid email address"
	case "min":
		return fe.Field() + " must be at least " + fe.Param() + " characters"
	case "max":
		return fe.Field() + " must be at most " + fe.Param() + " characters"
	case "gte":
		return fe.Field() + " must be greater than or equal to " + fe.Param()
	case "lte":
		return fe.Field() + " must be less than or equal to " + fe.Param()
	case "oneof":
		return fe.Field() + " must be one of: " + fe.Param()
	case "url":
		return "must be a valid URL"
	case "uuid4":
		return "must be a valid UUID"
	case "len":
		return fe.Field() + " must be exactly " + fe.Param() + " characters"
	case "numeric":
		return fe.Field() + " must be a number"
	case "alphanum":
		return fe.Field() + " must contain only letters and numbers"
	case "eqfield":
		return fe.Field() + " must match " + fe.Param()
	default:
		return fe.Field() + " is invalid"
	}
}
