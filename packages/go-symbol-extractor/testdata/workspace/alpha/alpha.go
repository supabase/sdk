// Package alpha is an extractor fixture covering package-level declarations,
// generics, methods and struct members.
package alpha

// ExportedConstant and its unexported sibling cover grouped constants.
const (
	ExportedConstant   = "exported"
	unexportedConstant = "unexported"
)

// ExportedVariable covers package-level variables.
var ExportedVariable = "value"

// Alias covers type aliases.
type Alias = Builder[string]

// Builder covers generic types, embedded fields and field visibility.
type Builder[T any] struct {
	Widget
	helper

	// Count covers exported fields.
	Count int

	hidden bool
}

// Build covers value receivers on generic types.
func (b Builder[T]) Build() T {
	var value T
	return value
}

// reset is unexported and must not be emitted.
func (b Builder[T]) reset() { _ = b }

// Widget covers embedded exported types and pointer receivers.
type Widget struct{}

// Apply covers pointer receivers.
func (w *Widget) Apply() { _ = w }

// helper is unexported, so its exported method must not be emitted.
type helper struct{}

// Touch is exported but its receiver type is not.
func (h helper) Touch() { _ = h }

// New covers package-level generic functions.
func New[T any](count int) Builder[T] {
	return Builder[T]{Count: count}
}

func unexportedFunction() {}
