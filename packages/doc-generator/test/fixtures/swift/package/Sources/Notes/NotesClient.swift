import Foundation

/// A client for the notes service.
///
/// ## Topics
///
/// ### Creating notes
///
/// - ``create(title:body:options:)``
/// - ``create(contentsOf:options:)``
public final class NotesClient: Sendable {
  /// Creates a client for the notes service.
  ///
  /// - Parameters:
  ///   - url: The URL of the notes service.
  ///   - configuration: How the client behaves.
  public init(url: URL, configuration: Configuration = .init()) {}

  /// Creates a note with a title and a body.
  ///
  /// The note is stored at once. See ``Note/id`` for how a note is named, and
  /// <doc:GettingStarted> for a walk-through.
  ///
  /// - Warning: A title longer than 100 characters is cut off.
  ///
  /// ```swift
  /// let note = try await client.create(title: "Hello", body: "World")
  /// ```
  ///
  /// The service answers with the stored note:
  ///
  /// ```json
  /// { "id": "6f1c", "title": "Hello" }
  /// ```
  ///
  /// - Parameters:
  ///   - title: The title of the note.
  ///   - body: The text of the note. ``CreateOptions/channel``
  ///     does not apply to it.
  ///   - options: How the note is created.
  /// - Returns: The stored note, with the ``Note/id`` the service gave it.
  /// - Throws: ``NotesError`` when the service rejects the note.
  ///   `CancellationError` when the task is cancelled.
  public func create(
    title: String,
    body: String,
    options: CreateOptions = .init()
  ) async throws -> Note {
    Note(id: UUID(), title: title)
  }

  /// Creates a note from a file.
  ///
  /// - Parameter fileURL: The file to read the note from.
  /// - Parameter options: How the note is created.
  /// - Returns: The stored note.
  public func create(
    contentsOf fileURL: URL,
    options: CreateOptions = .init()
  ) async throws -> Note {
    Note(id: UUID(), title: fileURL.lastPathComponent)
  }

  /// Deletes a note.
  ///
  /// - Parameter id: The ``Note/id`` of the note to delete.
  public func delete(withID id: UUID) async throws {}

  /// Deletes a note.
  @available(*, deprecated, message: "Use delete(withID:) instead.")
  public func remove(id: UUID) async throws {}

  /// Deletes a note.
  @available(*, deprecated)
  public func erase(id: UUID) async throws {}

  /// Lists notes, a page at a time.
  ///
  /// - Parameter page: The page of notes to return.
  /// - Returns: The notes on the page.
  public func list(page: Page = Page()) async throws -> [Note] { [] }

  /// Moves a note out of sight without deleting it.
  ///
  /// - Parameter note: The note to archive.
  /// - Returns: The archived note.
  @_spi(Experimental)
  @discardableResult
  public func archive(_ note: Note) async throws -> Note { note }

  /// Adds tags to a note.
  ///
  /// ```swift
  /// client.tag(note, with: "work", "urgent")
  /// ```
  ///
  /// ```swift
  /// client.tag(note, with: "home", separator: " / ") { done in
  ///   print(done)
  /// }
  /// ```
  ///
  /// - Parameters:
  ///   - note: The note to tag.
  ///   - tags: The tags to add.
  ///   - separator: The text between two tags in the stored note.
  ///   - onProgress: Called with the share of tags stored so far.
  public func tag(
    _ note: Note,
    with tags: String...,
    separator: String = ", ",
    onProgress: (@Sendable (Double) -> Void)? = nil
  ) {}

  /// How a ``NotesClient`` behaves.
  public struct Configuration: Sendable {
    /// Seconds to wait for the service before a call fails.
    public var timeout: TimeInterval

    /// Headers sent with every request.
    public var headers: [String: String]

    /// Creates a configuration.
    ///
    /// - Parameters:
    ///   - timeout: Seconds to wait for the service before a call fails.
    ///   - headers: Headers sent with every request.
    public init(
      timeout: TimeInterval = NotesClient.Configuration
        .defaultTimeout,
      headers: [String: String] = [:]
    ) {
      self.timeout = timeout
      self.headers = headers
    }

    /// The timeout a configuration has unless one is given.
    public static let defaultTimeout: TimeInterval = 30
  }
}

/// A stored note.
public struct Note: Sendable {
  /// The identifier the service gave the note.
  public let id: UUID

  /// The title of the note.
  public var title: String
}

/// A page of results.
public struct Page: Sendable {
  /// Where the page starts, and how many notes it holds.
  public var offset, limit: Int

  /// Creates a page.
  ///
  /// - Parameters:
  ///   - offset: The number of notes to skip.
  ///   - limit: The number of notes on the page.
  public init(offset: Int = 0, limit: Int = 20) {
    self.offset = offset
    self.limit = limit
  }
}

/// How a note is created.
public struct CreateOptions: Sendable {
  /// Tags to attach to the note.
  public var tags: [String]

  /// Who is told about the note. When `nil`,
  /// nobody is.
  public var channel: Channel?

  /// Where the note is filed.
  public var folder: Folder

  /// Whether the note has at least one tag.
  public var isTagged: Bool { !tags.isEmpty }

  /// Creates options for a new note.
  ///
  /// - Parameters:
  ///   - tags: Tags to attach to the note.
  ///   - channel: Who is told about the note.
  ///   - folder: Where the note is filed.
  public init(
    tags: [String] = [],
    channel: Channel? = nil,
    folder: Folder = Folder(name: "Inbox")
  ) {
    self.tags = tags
    self.channel = channel
    self.folder = folder
  }
}

/// A place to file notes.
public struct Folder: Sendable {
  /// The name of the folder.
  public var name: String

  /// The folder this folder is in, if any.
  public var parent: Folder? {
    get { nil }
    set {}
  }

  /// Creates a folder.
  ///
  /// - Parameter name: The name of the folder.
  public init(name: String) {
    self.name = name
  }
}

/// A way to tell someone about a note. The service may add channels, so any
/// name is accepted.
public struct Channel: RawRepresentable, Sendable {
  /// The channel name as the service reads it.
  public var rawValue: String

  /// Creates a channel from its name.
  public init(rawValue: String) {
    self.rawValue = rawValue
  }

  /// Tells people by email.
  public static let email = Channel(rawValue: "email")
}

/// Why the notes service rejected a call.
public struct NotesError: Error, Sendable {
  /// What went wrong.
  public let message: String
}
