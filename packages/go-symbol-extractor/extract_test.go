package main

import (
	"strings"
	"testing"
)

// strippedSymbol is parsedSymbol without the line number, letting the golden
// expectations survive fixture edits that only move declarations.
type strippedSymbol struct {
	Name string
	Kind string
	File string
}

func TestExtractProjectWorkspace(t *testing.T) {
	symbols, err := extractProject("testdata/workspace", nil)
	if err != nil {
		t.Fatalf("extractProject: %v", err)
	}

	expected := []strippedSymbol{
		{"alpha.Alias", "class", "alpha/alpha.go"},
		{"alpha.Builder", "class", "alpha/alpha.go"},
		{"alpha.Builder.Build", "method", "alpha/alpha.go"},
		{"alpha.Builder.Count", "property", "alpha/alpha.go"},
		{"alpha.Builder.Widget", "property", "alpha/alpha.go"},
		{"alpha.ExportedConstant", "variable", "alpha/alpha.go"},
		{"alpha.ExportedVariable", "variable", "alpha/alpha.go"},
		{"alpha.New", "function", "alpha/alpha.go"},
		{"alpha.Widget", "class", "alpha/alpha.go"},
		{"alpha.Widget.Apply", "method", "alpha/alpha.go"},
		{"beta.DefaultLimit", "variable", "beta/beta.go"},
		{"beta.Options", "class", "beta/beta.go"},
		{"beta.Reader", "class", "beta/beta.go"},
		{"beta.Reader.Read", "method", "beta/beta.go"},
		{"beta.Store", "class", "beta/beta.go"},
		{"beta.Store.Get", "method", "beta/beta.go"},
		{"beta.Store.Put", "method", "beta/beta.go"},
	}

	if len(symbols) != len(expected) {
		t.Fatalf("symbol count = %d, want %d\ngot: %v", len(symbols), len(expected), symbolNames(symbols))
	}
	for index, symbol := range symbols {
		got := strippedSymbol{Name: symbol.Name, Kind: symbol.Kind, File: symbol.File}
		if got != expected[index] {
			t.Errorf("symbol[%d] = %+v, want %+v", index, got, expected[index])
		}
		if symbol.Line <= 0 {
			t.Errorf("symbol[%d] %s: line = %d, want > 0", index, symbol.Name, symbol.Line)
		}
	}
}

func TestExtractProjectModuleFlagOverridesDiscovery(t *testing.T) {
	symbols, err := extractProject("testdata/flat", []string{"."})
	if err != nil {
		t.Fatalf("extractProject: %v", err)
	}
	if len(symbols) != 1 || symbols[0].Name != "flat.Standalone" || symbols[0].Kind != "function" {
		t.Fatalf("symbols = %v, want exactly flat.Standalone (function)", symbolNames(symbols))
	}
}

func TestExtractProjectWithoutWorkspaceFileFails(t *testing.T) {
	_, err := extractProject("testdata/flat", nil)
	if err == nil {
		t.Fatal("extractProject: expected an error for a root with no go.work and no -module flags")
	}
	if !strings.Contains(err.Error(), "go.work") || !strings.Contains(err.Error(), "-module") {
		t.Fatalf("error %q should name go.work and the -module escape hatch", err)
	}
}

func TestExtractProjectPackageNameCollisionFails(t *testing.T) {
	_, err := extractProject("testdata/collision", nil)
	if err == nil {
		t.Fatal("extractProject: expected an error for two walked packages sharing a name")
	}
	for _, fragment := range []string{`"shared"`, "one", "two"} {
		if !strings.Contains(err.Error(), fragment) {
			t.Errorf("error %q should mention %s", err, fragment)
		}
	}
}

func symbolNames(symbols []parsedSymbol) []string {
	names := make([]string, len(symbols))
	for index, symbol := range symbols {
		names[index] = symbol.Name
	}
	return names
}
