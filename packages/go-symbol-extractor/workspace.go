package main

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// workspaceModules returns the module directories named by the use
// directives of the go.work file at root. The workspace file is the
// canonical list of a Go SDK repository's published modules; repositories
// without one must name their modules with -module flags instead.
func workspaceModules(root string) ([]string, error) {
	content, err := os.ReadFile(filepath.Join(root, "go.work"))
	if err != nil {
		return nil, fmt.Errorf("reading go.work (pass -module to name module directories explicitly): %w", err)
	}
	directories := parseWorkspaceUses(string(content))
	if len(directories) == 0 {
		return nil, fmt.Errorf("go.work at %s carries no use directives", root)
	}
	return directories, nil
}

// parseWorkspaceUses reads the use directives from go.work text, in both the
// single-line form (use ./core) and the block form (use ( ... )). Comments
// are stripped, quoted paths are unquoted and all other directives are
// ignored.
func parseWorkspaceUses(text string) []string {
	var directories []string
	inBlock := false
	for _, line := range strings.Split(text, "\n") {
		if comment := strings.Index(line, "//"); comment >= 0 {
			line = line[:comment]
		}
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}

		if inBlock {
			if line == ")" {
				inBlock = false
				continue
			}
			directories = append(directories, unquoteWorkspacePath(line))
			continue
		}

		if line == "use (" {
			inBlock = true
			continue
		}
		if path, found := strings.CutPrefix(line, "use "); found {
			directories = append(directories, unquoteWorkspacePath(strings.TrimSpace(path)))
		}
	}
	return directories
}

// unquoteWorkspacePath strips the optional double quotes around a go.work
// path entry.
func unquoteWorkspacePath(path string) string {
	if len(path) >= 2 && strings.HasPrefix(path, `"`) && strings.HasSuffix(path, `"`) {
		return path[1 : len(path)-1]
	}
	return path
}
