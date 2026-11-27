import Foundation
@_exported import Notes

/// Creates a client for the notes service at `url`, with the default
/// configuration.
///
/// - Parameter url: The URL of the notes service.
/// - Returns: A client that is ready to use.
public func makeClient(url: URL) -> NotesClient {
  NotesClient(url: url)
}
