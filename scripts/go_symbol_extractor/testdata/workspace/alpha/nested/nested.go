// Package nested must not be emitted: its directory carries its own go.mod,
// so it is a different module from the one being walked.
package nested

// Escape must not be emitted.
func Escape() {}
