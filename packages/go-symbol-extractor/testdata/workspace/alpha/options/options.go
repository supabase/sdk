// Package options is a nested, non-module-root package: its symbols are
// qualified by the directory path alpha/options, never by the bare package
// name.
package options

// Mode is a nested package's exported type.
type Mode struct {
	// Level is an exported field.
	Level int
}

// With returns a Mode carrying level.
func With(level int) Mode { return Mode{Level: level} }
