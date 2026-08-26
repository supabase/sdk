package main

import "testing"

func TestIgnoreMatcher(t *testing.T) {
	tests := []struct {
		name        string
		rules       string
		path        string
		isDirectory bool
		want        bool
	}{
		{"basename matches at any depth", "skipped.go", "alpha/skipped.go", false, true},
		{"basename matches at the root", "skipped.go", "skipped.go", false, true},
		{"different basename passes", "skipped.go", "alpha/kept.go", false, false},
		{"suffix alone does not match", "skipped.go", "alpha/unskipped.go", false, false},
		{"anchored pattern matches at the root only", "/top.go", "top.go", false, true},
		{"anchored pattern rejects nested paths", "/top.go", "nested/top.go", false, false},
		{"directory pattern matches the directory", "docs/", "alpha/docs", true, true},
		{"directory pattern matches files beneath it", "docs/", "alpha/docs/readme.go", false, true},
		{"directory pattern rejects a file of the same name", "docs/", "alpha/docs", false, false},
		{"negation re-includes a match", "*.go\n!keep.go", "keep.go", false, false},
		{"negation leaves other matches excluded", "*.go\n!keep.go", "drop.go", false, true},
		{"star does not cross segments", "alpha/*.go", "alpha/nested/deep.go", false, false},
		{"double star crosses segments", "alpha/**", "alpha/nested/deep.go", false, true},
		{"question mark matches one character", "a?c.go", "abc.go", false, true},
		{"question mark rejects two characters", "a?c.go", "abbc.go", false, false},
		{"comments and blanks are skipped", "# comment\n\nskipped.go", "skipped.go", false, true},
		{"backslashes normalize to slashes", "docs/", `alpha\docs\readme.go`, false, true},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			matcher := parseIgnoreMatcher(test.rules)
			if got := matcher.ignores(test.path, test.isDirectory); got != test.want {
				t.Errorf("ignores(%q, isDirectory=%t) with rules %q = %t, want %t",
					test.path, test.isDirectory, test.rules, got, test.want)
			}
		})
	}
}

func TestLoadIgnoreMatcherAbsentFile(t *testing.T) {
	matcher, err := loadIgnoreMatcher(t.TempDir())
	if err != nil {
		t.Fatalf("loadIgnoreMatcher: %v", err)
	}
	if matcher.ignores("anything.go", false) {
		t.Error("an absent ignore file must exclude nothing")
	}
}
