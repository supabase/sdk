// Command go_symbol_extractor prints the public API surface of a Go SDK
// repository as JSON, in the ParsedSymbol shape the capability-matrix
// scripts consume:
//
//	go run . [-module <directory>]... <path-to-sdk-root>
//
// The dump lists every exported package-level identifier of the repository's
// published modules, each name qualified by its package (for example
// postgrest.FilterBuilder.Eq), sorted by name. Published modules are the use
// directives of the go.work file at the root, or the -module directories
// when given. Output goes to stdout; files that fail to parse are skipped
// with a warning on stderr.
package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"strings"
)

// moduleFlags collects repeated -module values.
type moduleFlags []string

func (m *moduleFlags) String() string { return strings.Join(*m, ", ") }

func (m *moduleFlags) Set(value string) error {
	*m = append(*m, value)
	return nil
}

func main() {
	var modules moduleFlags
	flag.Var(&modules, "module", "module directory relative to the SDK root, repeatable; overrides go.work discovery")
	flag.Parse()

	if flag.NArg() != 1 {
		fmt.Fprintln(os.Stderr, "Usage: go_symbol_extractor [-module <directory>]... <path-to-sdk-root>")
		os.Exit(1)
	}

	symbols, err := extractProject(flag.Arg(0), modules)
	if err != nil {
		fmt.Fprintln(os.Stderr, "Error:", err)
		os.Exit(1)
	}

	output, err := json.MarshalIndent(parseResult{Symbols: symbols}, "", "  ")
	if err != nil {
		fmt.Fprintln(os.Stderr, "Error:", err)
		os.Exit(1)
	}
	fmt.Println(string(output))
}
