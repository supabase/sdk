package main

import (
	"slices"
	"testing"
)

func TestParseWorkspaceUses(t *testing.T) {
	tests := []struct {
		name string
		text string
		want []string
	}{
		{
			"single-line form",
			"go 1.24\n\nuse ./core\n",
			[]string{"./core"},
		},
		{
			"block form with comments and blanks",
			"go 1.24\n\n// The published modules.\nuse (\n\t./core // canonical\n\n\t./postgrest\n)\n",
			[]string{"./core", "./postgrest"},
		},
		{
			"mixed forms accumulate",
			"use ./one\nuse (\n\t./two\n)\n",
			[]string{"./one", "./two"},
		},
		{
			"quoted paths are unquoted",
			"use \"./with space\"\n",
			[]string{"./with space"},
		},
		{
			"other directives are ignored",
			"go 1.24\n\ntoolchain go1.24.0\n\nreplace example.com/a => ./a\n",
			nil,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if got := parseWorkspaceUses(test.text); !slices.Equal(got, test.want) {
				t.Errorf("parseWorkspaceUses(%q) = %v, want %v", test.text, got, test.want)
			}
		})
	}
}

func TestWorkspaceModulesMissingFile(t *testing.T) {
	_, err := workspaceModules(t.TempDir())
	if err == nil {
		t.Fatal("workspaceModules: expected an error when go.work is absent")
	}
}
