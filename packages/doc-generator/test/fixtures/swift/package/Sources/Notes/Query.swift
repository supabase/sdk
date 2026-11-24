import Foundation

/// A phase of a query in which filters can be added.
public protocol Filterable {}

/// The phase of a query that reads notes.
public enum Reading: Filterable {}

/// A query for notes, built step by step.
public struct Query<Phase>: Sendable {
  /// Starts a query.
  public init() {}
}

extension Query where Phase: Filterable {
  /// Matches only notes where `column` equals `value`.
  ///
  /// - Parameters:
  ///   - column: The column to filter on.
  ///   - value: The value to compare against.
  /// - Returns: The same query, so calls can be chained.
  public func eq(_ column: String, value: String) -> Query<Phase> { self }
}

extension Array where Element == Note {
  /// Decodes every note into another type.
  ///
  /// - Parameters:
  ///   - type: The type to decode each note into.
  ///   - decoder: The decoder to use. When `nil`, ``Foundation/JSONDecoder/notes()``.
  /// - Returns: One value for each note.
  /// - Throws: The decoding error of the first note that does not fit `type`.
  public func decode<T>(
    as type: T.Type = T.self,
    decoder: JSONDecoder? = nil
  ) throws -> [T] where T: Decodable {
    []
  }
}

extension JSONDecoder {
  /// A decoder that reads the dates of the notes service.
  public static func notes() -> JSONDecoder { JSONDecoder() }
}
