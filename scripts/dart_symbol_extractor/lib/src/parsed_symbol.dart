/// A single public API symbol, matching the `ParsedSymbol` shape emitted by the
/// TypeScript and Swift parsers in the capability matrix.
///
/// The wire value is the constant's `name`, except for [SymbolKind.classKind],
/// whose constant cannot be named `class` because it is a reserved word.
enum SymbolKind { classKind, method, property, function, variable }

class ParsedSymbol {
  ParsedSymbol({required this.name, required this.kind, required this.file});

  final String name;
  final SymbolKind kind;
  final String file;

  Map<String, Object?> toJson() => {
        'name': name,
        'kind': kind == SymbolKind.classKind ? 'class' : kind.name,
        'file': file,
      };
}
