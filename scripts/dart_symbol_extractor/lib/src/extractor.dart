import 'dart:io';

import 'package:analyzer/dart/analysis/utilities.dart';
import 'package:analyzer/dart/ast/ast.dart';
import 'package:path/path.dart' as p;

import 'ignore_matcher.dart';
import 'parsed_symbol.dart';

/// Source file suffixes for generated Dart that is never authored public API.
const _generatedSuffixes = ['.g.dart', '.freezed.dart', '.gr.dart'];

/// Extracts public API symbols from a single Dart source string.
///
/// Parsing is purely syntactic (no element resolution), so it needs neither
/// `pub get` nor a resolvable package graph. Dart privacy is name-based, so a
/// declaration is public when its name does not start with `_`. This matches
/// the altitude of the TypeScript and Swift parsers, which collect declarations
/// per file without following exports.
List<ParsedSymbol> extractFromSource(String source, String relPath) {
  final symbols = <ParsedSymbol>[];
  final unit = parseString(
    content: source,
    path: relPath,
    throwIfDiagnostics: false,
  ).unit;

  for (final declaration in unit.declarations) {
    _visitTopLevel(declaration, relPath, symbols);
  }
  return symbols;
}

void _visitTopLevel(
  CompilationUnitMember declaration,
  String relPath,
  List<ParsedSymbol> out,
) {
  switch (declaration) {
    // Class-like containers expose their name and members identically. Unnamed
    // extensions (name == null) fall through, as they have no qualifiable
    // surface.
    case ClassDeclaration(:final name, :final members):
    case MixinDeclaration(:final name, :final members):
    case EnumDeclaration(:final name, :final members):
    case ExtensionTypeDeclaration(:final name, :final members):
    case ExtensionDeclaration(name: final name?, :final members):
      _emitContainer(name.lexeme, members, relPath, out);

    case FunctionDeclaration(:final name, :final isGetter, :final isSetter)
        when !isGetter && !isSetter:
      _emit(name.lexeme, SymbolKind.function, relPath, out);

    // `class C = A with M;` is a class, not a typedef, so it precedes TypeAlias.
    case ClassTypeAlias(:final name):
      _emit(name.lexeme, SymbolKind.classKind, relPath, out);

    case TypeAlias(:final name):
      _emit(name.lexeme, SymbolKind.variable, relPath, out);

    case TopLevelVariableDeclaration(:final variables):
      for (final variable in variables.variables) {
        _emit(variable.name.lexeme, SymbolKind.variable, relPath, out);
      }
  }
}

void _emit(
    String name, SymbolKind kind, String relPath, List<ParsedSymbol> out) {
  if (_isPrivate(name)) return;
  out.add(ParsedSymbol(name: name, kind: kind, file: relPath));
}

void _emitContainer(
  String containerName,
  List<ClassMember> members,
  String relPath,
  List<ParsedSymbol> out,
) {
  if (_isPrivate(containerName)) return;
  out.add(
    ParsedSymbol(
      name: containerName,
      kind: SymbolKind.classKind,
      file: relPath,
    ),
  );

  for (final member in members) {
    if (member is MethodDeclaration) {
      final name = member.name.lexeme;
      if (_isPrivate(name)) continue;
      final kind = (member.isGetter || member.isSetter)
          ? SymbolKind.property
          : SymbolKind.method;
      out.add(
        ParsedSymbol(name: '$containerName.$name', kind: kind, file: relPath),
      );
    } else if (member is FieldDeclaration) {
      for (final field in member.fields.variables) {
        final name = field.name.lexeme;
        if (_isPrivate(name)) continue;
        out.add(
          ParsedSymbol(
            name: '$containerName.$name',
            kind: SymbolKind.property,
            file: relPath,
          ),
        );
      }
    } else if (member is ConstructorDeclaration) {
      // The unnamed constructor reuses the class name, matching the
      // `ClassName.ClassName` form the other parsers emit.
      final ctorName = member.name?.lexeme ?? containerName;
      if (_isPrivate(ctorName)) continue;
      out.add(
        ParsedSymbol(
          name: '$containerName.$ctorName',
          kind: SymbolKind.method,
          file: relPath,
        ),
      );
    }
  }
}

bool _isPrivate(String name) => name.startsWith('_');

/// Discovers every package under [projectRoot] (a directory containing a
/// `pubspec.yaml` with a `lib/` directory) and extracts the public API surface
/// of its `lib/**.dart` files. Paths are reported relative to [projectRoot].
List<ParsedSymbol> parseDartProject(String projectRoot) {
  final root = p.normalize(p.absolute(projectRoot));
  final ignore = IgnoreMatcher.load(root);
  final symbols = <ParsedSymbol>[];

  for (final packageDir in _findPackageDirs(root, ignore)) {
    final libDir = Directory(p.join(packageDir, 'lib'));
    if (!libDir.existsSync()) continue;

    for (final entity in libDir.listSync(recursive: true, followLinks: false)) {
      if (entity is! File || !entity.path.endsWith('.dart')) continue;
      if (_generatedSuffixes.any(entity.path.endsWith)) continue;

      final relPath = p.relative(entity.path, from: root);
      if (ignore.ignores(p.split(relPath).join('/'))) continue;

      try {
        symbols.addAll(extractFromSource(entity.readAsStringSync(), relPath));
      } catch (error) {
        // A single unreadable or unparseable file must not fail the whole
        // check; skip it and surface a warning on stderr.
        stderr.writeln('warning: skipped $relPath: $error');
      }
    }
  }

  symbols.sort((a, b) => a.name.compareTo(b.name));
  return symbols;
}

Iterable<String> _findPackageDirs(String root, IgnoreMatcher ignore) sync* {
  final rootDir = Directory(root);
  if (!rootDir.existsSync()) return;

  for (final entity in rootDir.listSync(recursive: true, followLinks: false)) {
    if (entity is! File || p.basename(entity.path) != 'pubspec.yaml') continue;

    final dir = p.dirname(entity.path);
    final relDir = p.relative(dir, from: root);
    if (relDir != '.') {
      final segments = p.split(relDir);
      if (segments.any((s) => s.startsWith('.') || s == 'build')) continue;
      if (ignore.ignores(segments.join('/'), isDirectory: true)) continue;
    }
    yield dir;
  }
}
