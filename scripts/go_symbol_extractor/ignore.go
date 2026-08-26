package main

import (
	"errors"
	"io/fs"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

// ignoreMatcher applies `.sdk-parse-ignore` rules to paths relative to the
// SDK root. It supports the common subset of gitignore syntax the sibling
// extractors support: blank lines and # comments are skipped, ! negates a
// previous match, a trailing / restricts a pattern to directories, a leading
// / anchors to the ignore file's directory, and *, ** and ? globs are
// translated to anchored regular expressions.
type ignoreMatcher struct {
	rules []ignoreRule
}

type ignoreRule struct {
	// selfOrBelow matches the pattern itself and anything nested beneath it.
	selfOrBelow *regexp.Regexp
	// below matches only paths nested beneath the pattern, used to exclude
	// files inside a directory-only pattern.
	below         *regexp.Regexp
	negated       bool
	directoryOnly bool
}

// loadIgnoreMatcher reads `.sdk-parse-ignore` from root, returning an empty
// matcher when the file is absent.
func loadIgnoreMatcher(root string) (*ignoreMatcher, error) {
	content, err := os.ReadFile(filepath.Join(root, ".sdk-parse-ignore"))
	if errors.Is(err, fs.ErrNotExist) {
		return &ignoreMatcher{}, nil
	}
	if err != nil {
		return nil, err
	}
	return parseIgnoreMatcher(string(content)), nil
}

func parseIgnoreMatcher(content string) *ignoreMatcher {
	matcher := &ignoreMatcher{}
	for _, line := range strings.Split(content, "\n") {
		line = strings.TrimSpace(strings.ReplaceAll(line, "\r", ""))
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}

		negated := false
		if strings.HasPrefix(line, "!") {
			negated = true
			line = line[1:]
		}

		directoryOnly := false
		if strings.HasSuffix(line, "/") {
			directoryOnly = true
			line = line[:len(line)-1]
		}

		body := compileIgnoreGlob(line)
		matcher.rules = append(matcher.rules, ignoreRule{
			selfOrBelow:   regexp.MustCompile(body + `(/.*)?$`),
			below:         regexp.MustCompile(body + `/`),
			negated:       negated,
			directoryOnly: directoryOnly,
		})
	}
	return matcher
}

// ignores reports whether relativePath (relative to the root the matcher was
// loaded from) is excluded. isDirectory toggles directory-only patterns; a
// matched directory also excludes everything nested beneath it. The last
// matching rule wins, so a later ! rule re-includes an earlier match.
func (m *ignoreMatcher) ignores(relativePath string, isDirectory bool) bool {
	path := strings.ReplaceAll(relativePath, `\`, "/")
	ignored := false
	for _, rule := range m.rules {
		var matched bool
		if rule.directoryOnly && !isDirectory {
			matched = rule.below.MatchString(path)
		} else {
			matched = rule.selfOrBelow.MatchString(path)
		}
		if matched {
			ignored = !rule.negated
		}
	}
	return ignored
}

// compileIgnoreGlob translates a gitignore glob into an anchored regular
// expression body. Anchored patterns (leading /) match from the root;
// unanchored ones match at any path segment boundary.
func compileIgnoreGlob(glob string) string {
	anchored := strings.HasPrefix(glob, "/")
	body := glob
	if anchored {
		body = body[1:]
	}

	var pattern strings.Builder
	if anchored {
		pattern.WriteString("^")
	} else {
		pattern.WriteString(`(^|/)`)
	}

	for index := 0; index < len(body); index++ {
		character := body[index]
		switch {
		case character == '*':
			if index+1 < len(body) && body[index+1] == '*' {
				pattern.WriteString(".*")
				index++
			} else {
				pattern.WriteString(`[^/]*`)
			}
		case character == '?':
			pattern.WriteString(`[^/]`)
		case strings.ContainsRune(`.+()[]{}^$|\`, rune(character)):
			pattern.WriteString(`\`)
			pattern.WriteByte(character)
		default:
			pattern.WriteByte(character)
		}
	}
	return pattern.String()
}
