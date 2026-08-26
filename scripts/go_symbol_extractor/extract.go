package main

import (
	"fmt"
	"go/ast"
	"go/parser"
	"go/token"
	"io/fs"
	"os"
	"path/filepath"
	"slices"
	"strings"
)

// parsedSymbol matches the ParsedSymbol shape emitted by the sibling
// extractors and consumed by the capability-matrix scripts. Name carries the
// package-qualified spelling used in Go sdk-compliance.yaml files:
// <package>.<Identifier> for package-level declarations and
// <package>.<Type>.<Member> for methods and fields.
type parsedSymbol struct {
	Name string `json:"name"`
	Kind string `json:"kind"`
	File string `json:"file"`
	Line int    `json:"line"`
}

// parseResult is the top-level dump shape: {"symbols": [...]}.
type parseResult struct {
	Symbols []parsedSymbol `json:"symbols"`
}

// extractProject returns the exported symbols of the Go SDK repository at
// root, sorted by name and deduplicated. moduleDirectories names the module
// directories to walk, relative to root; when empty they are discovered from
// the root's go.work file. Two walked packages sharing a name is an error,
// since their qualified symbol names would collide.
func extractProject(root string, moduleDirectories []string) ([]parsedSymbol, error) {
	absoluteRoot, err := filepath.Abs(root)
	if err != nil {
		return nil, err
	}

	matcher, err := loadIgnoreMatcher(absoluteRoot)
	if err != nil {
		return nil, err
	}

	if len(moduleDirectories) == 0 {
		moduleDirectories, err = workspaceModules(absoluteRoot)
		if err != nil {
			return nil, err
		}
	}

	fileSet := token.NewFileSet()
	symbols := []parsedSymbol{}
	packageDirectories := map[string]string{}

	for _, moduleDirectory := range moduleDirectories {
		moduleRoot := filepath.Join(absoluteRoot, moduleDirectory)
		err := filepath.WalkDir(moduleRoot, func(path string, entry fs.DirEntry, err error) error {
			if err != nil {
				return err
			}

			relativePath, err := filepath.Rel(absoluteRoot, path)
			if err != nil {
				return err
			}
			relativePath = filepath.ToSlash(relativePath)

			if entry.IsDir() {
				if path == moduleRoot {
					return nil
				}
				name := entry.Name()
				// internal packages are unimportable, testdata and vendor are
				// toolchain conventions, dot-directories are never source, and
				// a directory with its own go.mod is a different module.
				if name == "internal" || name == "testdata" || name == "vendor" || strings.HasPrefix(name, ".") {
					return filepath.SkipDir
				}
				if _, statError := os.Stat(filepath.Join(path, "go.mod")); statError == nil {
					return filepath.SkipDir
				}
				if matcher.ignores(relativePath, true) {
					return filepath.SkipDir
				}
				return nil
			}

			if !strings.HasSuffix(entry.Name(), ".go") || strings.HasSuffix(entry.Name(), "_test.go") {
				return nil
			}
			if matcher.ignores(relativePath, false) {
				return nil
			}

			fileSymbols, packageName, err := extractFile(fileSet, path, relativePath)
			if err != nil {
				// One unreadable or unparseable file must not fail the whole
				// dump; skip it and surface a warning.
				fmt.Fprintf(os.Stderr, "warning: skipped %s: %v\n", relativePath, err)
				return nil
			}
			// package main is not importable API.
			if packageName == "main" {
				return nil
			}

			packageDirectory := filepath.ToSlash(filepath.Dir(relativePath))
			if existing, seen := packageDirectories[packageName]; seen && existing != packageDirectory {
				return fmt.Errorf("package name %q appears in both %s and %s: qualified symbol names would collide", packageName, existing, packageDirectory)
			}
			packageDirectories[packageName] = packageDirectory

			symbols = append(symbols, fileSymbols...)
			return nil
		})
		if err != nil {
			return nil, fmt.Errorf("walking module %s: %w", moduleDirectory, err)
		}
	}

	slices.SortFunc(symbols, func(a, b parsedSymbol) int {
		if comparison := strings.Compare(a.Name, b.Name); comparison != 0 {
			return comparison
		}
		if comparison := strings.Compare(a.File, b.File); comparison != 0 {
			return comparison
		}
		return a.Line - b.Line
	})

	// Build-tag variants of one file pair can declare the same name twice;
	// the checks match on names, so keep the first occurrence only.
	deduplicated := []parsedSymbol{}
	for _, symbol := range symbols {
		if length := len(deduplicated); length > 0 && deduplicated[length-1].Name == symbol.Name {
			continue
		}
		deduplicated = append(deduplicated, symbol)
	}
	return deduplicated, nil
}

// extractFile parses one Go source file syntactically and returns its
// exported symbols and its package name. Exportedness in Go is lexical, so
// no type resolution or build is needed.
func extractFile(fileSet *token.FileSet, path, relativePath string) ([]parsedSymbol, string, error) {
	file, err := parser.ParseFile(fileSet, path, nil, parser.SkipObjectResolution)
	if err != nil {
		return nil, "", err
	}
	packageName := file.Name.Name

	var symbols []parsedSymbol
	emit := func(name, kind string, position token.Pos) {
		symbols = append(symbols, parsedSymbol{
			Name: name,
			Kind: kind,
			File: relativePath,
			Line: fileSet.Position(position).Line,
		})
	}

	for _, declaration := range file.Decls {
		switch declaration := declaration.(type) {
		case *ast.FuncDecl:
			functionName := declaration.Name.Name
			if !ast.IsExported(functionName) {
				continue
			}
			if declaration.Recv == nil {
				emit(packageName+"."+functionName, "function", declaration.Pos())
				continue
			}
			// Methods on unexported types are unreachable by consumers, so
			// they are not part of the surface.
			receiverName, ok := receiverBaseName(declaration.Recv)
			if !ok || !ast.IsExported(receiverName) {
				continue
			}
			emit(packageName+"."+receiverName+"."+functionName, "method", declaration.Pos())

		case *ast.GenDecl:
			for _, specification := range declaration.Specs {
				switch specification := specification.(type) {
				case *ast.TypeSpec:
					typeName := specification.Name.Name
					if !ast.IsExported(typeName) {
						continue
					}
					qualifiedType := packageName + "." + typeName
					emit(qualifiedType, "class", specification.Pos())
					emitTypeMembers(emit, qualifiedType, specification.Type)
				case *ast.ValueSpec:
					for _, name := range specification.Names {
						if !ast.IsExported(name.Name) {
							continue
						}
						emit(packageName+"."+name.Name, "variable", name.Pos())
					}
				}
			}
		}
	}
	return symbols, packageName, nil
}

// emitTypeMembers emits the exported fields of a struct type and the
// exported methods of an interface type, qualified by their owning type.
func emitTypeMembers(emit func(name, kind string, position token.Pos), qualifiedType string, typeExpression ast.Expr) {
	switch typeExpression := typeExpression.(type) {
	case *ast.StructType:
		if typeExpression.Fields == nil {
			return
		}
		for _, field := range typeExpression.Fields.List {
			if len(field.Names) == 0 {
				// An embedded field is selectable by the base name of its
				// type, so it is surface of the embedding struct.
				name, ok := baseTypeName(field.Type)
				if ok && ast.IsExported(name) {
					emit(qualifiedType+"."+name, "property", field.Pos())
				}
				continue
			}
			for _, name := range field.Names {
				if !ast.IsExported(name.Name) {
					continue
				}
				emit(qualifiedType+"."+name.Name, "property", name.Pos())
			}
		}
	case *ast.InterfaceType:
		if typeExpression.Methods == nil {
			return
		}
		for _, method := range typeExpression.Methods.List {
			// An embedded interface carries no names of its own here; its
			// methods stay attributed to the type that declares them.
			for _, name := range method.Names {
				if !ast.IsExported(name.Name) {
					continue
				}
				emit(qualifiedType+"."+name.Name, "method", name.Pos())
			}
		}
	}
}

// receiverBaseName returns the identifier of a method receiver's base type.
func receiverBaseName(receiver *ast.FieldList) (string, bool) {
	if receiver == nil || len(receiver.List) == 0 {
		return "", false
	}
	return baseTypeName(receiver.List[0].Type)
}

// baseTypeName unwraps pointer, type-parameter and package-qualifier
// wrappers - *T, T[P], T[P1, P2] and package.T - to the base type name.
func baseTypeName(expression ast.Expr) (string, bool) {
	for {
		switch typed := expression.(type) {
		case *ast.Ident:
			return typed.Name, true
		case *ast.StarExpr:
			expression = typed.X
		case *ast.IndexExpr:
			expression = typed.X
		case *ast.IndexListExpr:
			expression = typed.X
		case *ast.SelectorExpr:
			return typed.Sel.Name, true
		default:
			return "", false
		}
	}
}
