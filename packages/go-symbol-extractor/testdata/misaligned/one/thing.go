// Package shared sits in a directory named one, so a path-derived qualifier
// would misname it and the extraction must fail.
package shared

// FromOne is surface the dump never reaches: the lineup check fails first.
func FromOne() {}
