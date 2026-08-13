package category

import (
	"encoding/json"
	"testing"
)

func TestUpdateCategoryReqDistinguishesOmittedValuesFromExplicitNull(t *testing.T) {
	var omitted UpdateCategoryReq
	if err := json.Unmarshal([]byte(`{"title":"unchanged relations"}`), &omitted); err != nil {
		t.Fatalf("unmarshal omitted patch: %v", err)
	}
	if omitted.Slug.Set || omitted.ParentID.Set || omitted.Description.Set || omitted.ImageURL.Set {
		t.Fatalf("omitted nullable fields were marked set: %+v", omitted)
	}

	var cleared UpdateCategoryReq
	if err := json.Unmarshal([]byte(`{"slug":null,"parent_id":null,"description":null,"image_url":null}`), &cleared); err != nil {
		t.Fatalf("unmarshal clear patch: %v", err)
	}
	if !cleared.Slug.Set || cleared.Slug.Value != nil ||
		!cleared.ParentID.Set || cleared.ParentID.Value != nil ||
		!cleared.Description.Set || cleared.Description.Value != nil ||
		!cleared.ImageURL.Set || cleared.ImageURL.Value != nil {
		t.Fatalf("explicit null patch = %+v", cleared)
	}
}
