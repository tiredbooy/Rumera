package models

import (
	"bytes"
	"encoding/json"
)

// NullablePatch distinguishes an omitted PATCH field from an explicit JSON null.
// Value is nil only when the client intentionally clears a nullable column.
type NullablePatch[T any] struct {
	Set   bool
	Value *T
}

func (p *NullablePatch[T]) UnmarshalJSON(data []byte) error {
	p.Set = true
	if bytes.Equal(bytes.TrimSpace(data), []byte("null")) {
		p.Value = nil
		return nil
	}

	var value T
	if err := json.Unmarshal(data, &value); err != nil {
		return err
	}
	p.Value = &value
	return nil
}
