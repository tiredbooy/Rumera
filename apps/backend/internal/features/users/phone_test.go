package users

import "testing"

func TestNormalizeIranPhone(t *testing.T) {
	t.Parallel()
	cases := []struct {
		in   string
		want string
		ok   bool
	}{
		{"09121234567", "09121234567", true},
		{"+989121234567", "09121234567", true},
		{"00989121234567", "09121234567", true},
		{"989121234567", "09121234567", true},
		{"9121234567", "09121234567", true},
		{"۰۹۱۲۱۲۳۴۵۶۷", "09121234567", true},
		{"", "", false},
		{"02122334455", "", false},
		{"0912", "", false},
	}
	for _, tc := range cases {
		got, ok := NormalizeIranPhone(tc.in)
		if ok != tc.ok || got != tc.want {
			t.Fatalf("NormalizeIranPhone(%q) = %q, %v; want %q, %v", tc.in, got, ok, tc.want, tc.ok)
		}
	}
}
