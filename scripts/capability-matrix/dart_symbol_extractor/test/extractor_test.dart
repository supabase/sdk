import 'package:dart_symbol_extractor/dart_symbol_extractor.dart';
import 'package:test/test.dart';

Set<String> _names(List<ParsedSymbol> symbols) =>
    symbols.map((s) => s.name).toSet();

ParsedSymbol _byName(List<ParsedSymbol> symbols, String name) =>
    symbols.firstWhere((s) => s.name == name);

void main() {
  group('extractFromSource', () {
    test('emits class with members, constructors, getters and fields', () {
      const source = '''
class SupabaseClient {
  SupabaseClient(this.url);
  SupabaseClient.withConfig(this.url);
  final String url;
  String get key => 'k';
  set key(String value) {}
  Future<void> signIn() async {}
  static SupabaseClient create() => SupabaseClient('');
}
''';
      final symbols = extractFromSource(source, 'lib/client.dart');

      expect(
        _names(symbols),
        containsAll([
          'SupabaseClient',
          'SupabaseClient.SupabaseClient',
          'SupabaseClient.withConfig',
          'SupabaseClient.url',
          'SupabaseClient.key',
          'SupabaseClient.signIn',
          'SupabaseClient.create',
        ]),
      );
      expect(_byName(symbols, 'SupabaseClient').kind, SymbolKind.classKind);
      expect(_byName(symbols, 'SupabaseClient.url').kind, SymbolKind.property);
      expect(_byName(symbols, 'SupabaseClient.key').kind, SymbolKind.property);
      expect(_byName(symbols, 'SupabaseClient.signIn').kind, SymbolKind.method);
      expect(
        _byName(symbols, 'SupabaseClient.SupabaseClient').kind,
        SymbolKind.method,
      );
    });

    test('skips private declarations and private members', () {
      const source = '''
class _Internal {
  void hidden() {}
}
class Visible {
  void _privateMethod() {}
  int _privateField = 0;
  void publicMethod() {}
}
void _privateTopLevel() {}
''';
      final names = _names(extractFromSource(source, 'lib/a.dart'));

      expect(names, isNot(contains('_Internal')));
      expect(names, isNot(contains('Visible._privateMethod')));
      expect(names, isNot(contains('Visible._privateField')));
      expect(names, isNot(contains('_privateTopLevel')));
      expect(names, containsAll(['Visible', 'Visible.publicMethod']));
    });

    test('captures enhanced enum members but not constants', () {
      const source = '''
enum Provider {
  google,
  github;
  String get label => name;
  void connect() {}
}
''';
      final names = _names(extractFromSource(source, 'lib/provider.dart'));

      expect(names,
          containsAll(['Provider', 'Provider.label', 'Provider.connect']));
      expect(names, isNot(contains('Provider.google')));
    });

    test('captures mixins and named extensions', () {
      const source = '''
mixin Logging {
  void log(String message) {}
}
extension StringX on String {
  bool get isBlank => trim().isEmpty;
}
extension on int {
  bool get isPositive => this > 0;
}
''';
      final names = _names(extractFromSource(source, 'lib/ext.dart'));

      expect(
          names,
          containsAll(
              ['Logging', 'Logging.log', 'StringX', 'StringX.isBlank']));
      expect(names, isNot(contains('isPositive')));
    });

    test('captures extension types (unsupported by dartdoc_json)', () {
      const source = '''
extension type UserId(String value) {
  bool get isValid => value.isNotEmpty;
}
''';
      final names = _names(extractFromSource(source, 'lib/id.dart'));

      expect(names, containsAll(['UserId', 'UserId.isValid']));
    });

    test('captures top-level functions, variables and typedefs', () {
      const source = '''
String greet(String name) => 'hi';
const apiVersion = 'v1';
typedef Handler = void Function();
String get topLevelGetter => '';
''';
      final symbols = extractFromSource(source, 'lib/top.dart');
      final names = _names(symbols);

      expect(names, containsAll(['greet', 'apiVersion', 'Handler']));
      expect(_byName(symbols, 'greet').kind, SymbolKind.function);
      expect(_byName(symbols, 'apiVersion').kind, SymbolKind.variable);
      expect(_byName(symbols, 'Handler').kind, SymbolKind.variable);
      expect(names, isNot(contains('topLevelGetter')));
    });
  });

  group('parseDartProject', () {
    test('discovers packages, skips generated, examples and private', () {
      final symbols = parseDartProject('test/fixtures/sample_project');
      final names = _names(symbols);

      expect(
        names,
        containsAll([
          'AuthClient',
          'AuthClient.AuthClient',
          'AuthClient.url',
          'AuthClient.signOut',
          'configureAuth',
        ]),
      );
      expect(names, isNot(contains('GeneratedModel')));
      expect(names, isNot(contains('ExampleWidget')));
      expect(names, isNot(contains('main')));
      expect(names, isNot(contains('_PrivateHelper')));
    });

    test('reports file paths relative to the project root', () {
      final symbols = parseDartProject('test/fixtures/sample_project');
      expect(
        _byName(symbols, 'AuthClient').file,
        'packages/auth/lib/auth.dart',
      );
    });
  });

  group('IgnoreMatcher', () {
    test('matches directory and glob patterns, honouring negation', () {
      final matcher = IgnoreMatcher.parse('''
# comment
**/example/**
*.g.dart
build/
!keep/build/
''');

      expect(matcher.ignores('packages/auth/example/lib/main.dart'), isTrue);
      expect(matcher.ignores('packages/auth/lib/models.g.dart'), isTrue);
      expect(matcher.ignores('build', isDirectory: true), isTrue);
      expect(matcher.ignores('packages/auth/lib/client.dart'), isFalse);
    });
  });
}
