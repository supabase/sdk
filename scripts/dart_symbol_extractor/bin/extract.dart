import 'dart:convert';
import 'dart:io';

import 'package:dart_symbol_extractor/dart_symbol_extractor.dart';

void main(List<String> arguments) {
  if (arguments.isEmpty) {
    stderr.writeln('Usage: extract <path-to-sdk-root>');
    exit(1);
  }

  try {
    final symbols = parseDartProject(arguments.first);
    final result = {'symbols': symbols.map((s) => s.toJson()).toList()};
    stdout.writeln(const JsonEncoder.withIndent('  ').convert(result));
  } catch (error) {
    stderr.writeln('Error: $error');
    exit(1);
  }
}
