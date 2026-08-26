// Package beta is an extractor fixture covering interfaces and unexported
// struct members.
package beta

// DefaultLimit covers ungrouped constants.
const DefaultLimit = 10

// Store covers interfaces: its exported methods are surface, while the
// embedded interface and the unexported method are not emitted for it.
type Store interface {
	Reader

	// Get covers interface methods.
	Get(key string) (string, bool)

	// Put covers interface methods.
	Put(key, value string)

	purge()
}

// Reader covers embedded interfaces: Read stays attributed here.
type Reader interface {
	// Read covers interface methods.
	Read(key string) string
}

// Options covers struct types whose fields are all unexported.
type Options struct {
	timeout int
}
