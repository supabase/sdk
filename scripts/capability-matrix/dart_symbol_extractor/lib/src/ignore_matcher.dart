import 'dart:io';

import 'package:path/path.dart' as p;

/// Minimal gitignore-style matcher for `.sdk-parse-ignore`.
///
/// Supports the common subset of gitignore syntax: blank lines and `#` comments
/// are skipped, `!` negates a previous match, a trailing `/` restricts a pattern
/// to directories, a leading `/` anchors to the ignore file's directory, and
/// `*`, `**` and `?` globs are translated to anchored regular expressions. This
/// mirrors how the TypeScript and Swift parsers consume the same file via the
/// `ignore` npm package, covering the patterns those repos use in practice.
class IgnoreMatcher {
  IgnoreMatcher._(this._rules);

  final List<_Rule> _rules;

  /// Loads `.sdk-parse-ignore` from [root]. Returns an empty matcher when the
  /// file is absent.
  factory IgnoreMatcher.load(String root) {
    final file = File(p.join(root, '.sdk-parse-ignore'));
    if (!file.existsSync()) return IgnoreMatcher._(const []);
    return IgnoreMatcher.parse(file.readAsStringSync());
  }

  factory IgnoreMatcher.parse(String content) {
    final rules = <_Rule>[];
    for (var line in content.split('\n')) {
      line = line.replaceAll('\r', '').trim();
      if (line.isEmpty || line.startsWith('#')) continue;

      var negated = false;
      if (line.startsWith('!')) {
        negated = true;
        line = line.substring(1);
      }

      var directoryOnly = false;
      if (line.endsWith('/')) {
        directoryOnly = true;
        line = line.substring(0, line.length - 1);
      }

      rules.add(_Rule(_compile(line), negated, directoryOnly));
    }
    return IgnoreMatcher._(rules);
  }

  /// Whether [relativePath] (POSIX-style, relative to root) is ignored.
  /// [isDirectory] toggles directory-only patterns.
  bool ignores(String relativePath, {bool isDirectory = false}) {
    final path = relativePath.replaceAll('\\', '/');
    var ignored = false;
    for (final rule in _rules) {
      if (rule.directoryOnly && !isDirectory) continue;
      if (rule.pattern.hasMatch(path)) {
        ignored = !rule.negated;
      }
    }
    return ignored;
  }

  static RegExp _compile(String glob) {
    final anchored = glob.startsWith('/');
    final body = anchored ? glob.substring(1) : glob;
    final buffer = StringBuffer();

    for (var i = 0; i < body.length; i++) {
      final char = body[i];
      if (char == '*') {
        if (i + 1 < body.length && body[i + 1] == '*') {
          buffer.write('.*');
          i++;
        } else {
          buffer.write('[^/]*');
        }
      } else if (char == '?') {
        buffer.write('[^/]');
      } else if (r'.+()[]{}^$|\'.contains(char)) {
        buffer.write('\\$char');
      } else {
        buffer.write(char);
      }
    }

    // Anchored patterns match from the root; unanchored patterns match against
    // any path segment boundary. Both also match anything nested beneath a
    // matched directory.
    final core = buffer.toString();
    final prefix = anchored ? '^' : r'(^|/)';
    return RegExp('$prefix$core(/.*)?\$');
  }
}

class _Rule {
  _Rule(this.pattern, this.negated, this.directoryOnly);

  final RegExp pattern;
  final bool negated;
  final bool directoryOnly;
}
