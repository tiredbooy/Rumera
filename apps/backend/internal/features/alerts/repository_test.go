package alerts

import (
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
)

func TestListByUserSQLHasLimit100(t *testing.T) {
	fn := repoMethodSource(t, "func (r *alertRepository) ListByUser")
	if !strings.Contains(fn, "LIMIT 100") {
		t.Fatal("ListByUser missing LIMIT 100")
	}
}

func repoMethodSource(t *testing.T, signature string) string {
	t.Helper()
	_, thisFile, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("runtime.Caller failed")
	}
	src, err := os.ReadFile(filepath.Join(filepath.Dir(thisFile), "repository.go"))
	if err != nil {
		t.Fatalf("read repository.go: %v", err)
	}
	body := string(src)
	idx := strings.Index(body, signature)
	if idx < 0 {
		t.Fatalf("%s not found", signature)
	}
	next := strings.Index(body[idx+1:], "\nfunc ")
	if next < 0 {
		return body[idx:]
	}
	return body[idx : idx+1+next]
}
