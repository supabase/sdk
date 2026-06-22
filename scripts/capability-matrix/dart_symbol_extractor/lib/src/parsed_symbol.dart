/// A single public API symbol, matching the `ParsedSymbol` shape emitted by the
/// TypeScript and Swift parsers in the capability matrix.
enum SymbolKind { classKind, method, property, function, variable }

extension SymbolKindJson on SymbolKind {
  String get jsonValue {
    switch (this) {
      case SymbolKind.classKind:
        return 'class';
      case SymbolKind.method:
        return 'method';
      case SymbolKind.property:
        return 'property';
      case SymbolKind.function:
        return 'function';
      case SymbolKind.variable:
        return 'variable';
    }
  }
}

class ParsedSymbol {
  ParsedSymbol({required this.name, required this.kind, required this.file});

  final String name;
  final SymbolKind kind;
  final String file;

  Map<String, Object?> toJson() => {
        'name': name,
        'kind': kind.jsonValue,
        'file': file,
      };
}
