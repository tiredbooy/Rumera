package coupons

import (
	"strings"
)

func nullableArg[T any](value *T) any {
	if value == nil {
		return nil
	}
	return *value
}

func escapeLikePattern(value string) string {
	replacer := strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`)
	return replacer.Replace(value)
}

