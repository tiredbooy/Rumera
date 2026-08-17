package product

import (
	"errors"
	"strconv"
	"strings"
	"testing"

	"github.com/tiredbooy/pkg/apperr"
)

// CF-2. Without a by-ids lookup, a coupon scoped to a product outside the first
// page cannot be labelled — the UI shows an empty selection over a discount that
// is really applied.
func TestValidIDsParsesSelection(t *testing.T) {
	f := ProductFilter{IDs: "12, 40,7"}
	got, err := f.ValidIDs()
	if err != nil {
		t.Fatal(err)
	}
	want := []int64{12, 40, 7}
	if len(got) != len(want) {
		t.Fatalf("got %v, want %v", got, want)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("got %v, want %v", got, want)
		}
	}
}

func TestValidIDsIgnoresBlanksAndDuplicates(t *testing.T) {
	f := ProductFilter{IDs: " 5 , ,5,  9 "}
	got, err := f.ValidIDs()
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 2 || got[0] != 5 || got[1] != 9 {
		t.Fatalf("got %v, want [5 9]", got)
	}
}

// A typo must not read as "these products do not exist" — that would tell an
// operator their coupon scope is empty when it is not.
func TestValidIDsRejectsNonNumeric(t *testing.T) {
	for _, in := range []string{"12,abc", "-3", "0", "1.5"} {
		f := ProductFilter{IDs: in}
		if _, err := f.ValidIDs(); !errors.Is(err, apperr.ErrInvalidRequest) {
			t.Errorf("ValidIDs(%q) err = %v, want ErrInvalidRequest", in, err)
		}
	}
}

func TestValidIDsRejectsMoreThanAPage(t *testing.T) {
	ids := make([]string, 0, maxFilterIDs+1)
	for i := 1; i <= maxFilterIDs+1; i++ {
		ids = append(ids, strconv.Itoa(i))
	}
	f := ProductFilter{IDs: strings.Join(ids, ",")}
	if _, err := f.ValidIDs(); !errors.Is(err, apperr.ErrInvalidRequest) {
		t.Fatalf("err = %v, want ErrInvalidRequest at >%d ids", err, maxFilterIDs)
	}
}

func TestValidIDsEmptyIsNoFilter(t *testing.T) {
	for _, in := range []string{"", "  ", ","} {
		f := ProductFilter{IDs: in}
		got, err := f.ValidIDs()
		if err != nil || len(got) != 0 {
			t.Errorf("ValidIDs(%q) = %v, %v; want empty, nil", in, got, err)
		}
	}
}
