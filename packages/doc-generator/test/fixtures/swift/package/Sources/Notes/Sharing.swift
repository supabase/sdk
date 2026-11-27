import Foundation

// The example of the README: one doc comment that uses everything the Swift adapter reads.
// A test compares the README with this file and with the definition generated from it.

extension NotesClient {
  /// Shares a note with other people.
  ///
  /// Each person gets a link to the note. The link stops working when the note is deleted
  /// with ``NotesClient/delete(withID:)``. See <doc:Sharing> for who may share a note.
  ///
  /// - Warning: Anyone who has the link can read the note.
  ///
  /// ```swift
  /// let link = try await client.share(noteWithID: note.id, with: "ada@example.com")
  /// ```
  ///
  /// The service answers with the link:
  ///
  /// ```json
  /// { "url": "https://notes.example.com/s/6f1c" }
  /// ```
  ///
  /// - Parameters:
  ///   - id: The ``Note/id`` of the note to share.
  ///   - people: The email addresses of the people to share the note with.
  ///   - options: What the people may do, and what they are told. A message
  ///     longer than 500 characters is cut off.
  /// - Returns: The link that opens the note.
  /// - Throws: ``NotesError`` when the service rejects the request.
  ///   `CancellationError` when the task is cancelled.
  public func share(
    noteWithID id: UUID,
    with people: String...,
    options: ShareOptions = .init()
  ) async throws -> URL {
    URL(fileURLWithPath: "/")
  }
}

/// How a note is shared.
public struct ShareOptions: Sendable {
  /// Whether the people may change the note.
  public var canEdit: Bool

  /// A message to send along with the link. When `nil`, no message is sent.
  public var message: String?

  /// Creates share options.
  ///
  /// - Parameters:
  ///   - canEdit: Whether the people may change the note.
  ///   - message: A message to send along with the link.
  public init(canEdit: Bool = false, message: String? = nil) {
    self.canEdit = canEdit
    self.message = message
  }
}
