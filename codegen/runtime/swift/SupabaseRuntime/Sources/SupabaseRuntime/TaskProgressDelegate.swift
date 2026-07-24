import Foundation

/// Per-call URLSession task delegate that forwards byte-progress into an AsyncStream.
/// `@unchecked Sendable`: it holds only a `Sendable` continuation; URLSession invokes
/// these callbacks serially per task. (NSObject delegates can't be cleanly Sendable.)
final class TaskProgressDelegate: NSObject, URLSessionTaskDelegate, URLSessionDownloadDelegate, @unchecked Sendable {
  let continuation: AsyncStream<TransferProgress>.Continuation
  init(continuation: AsyncStream<TransferProgress>.Continuation) { self.continuation = continuation }

  func urlSession(_ session: URLSession, task: URLSessionTask, didSendBodyData bytesSent: Int64,
                  totalBytesSent: Int64, totalBytesExpectedToSend: Int64) {
    let total = totalBytesExpectedToSend > 0 ? totalBytesExpectedToSend : nil
    continuation.yield(TransferProgress(completed: totalBytesSent, total: total))
  }

  func urlSession(_ session: URLSession, downloadTask: URLSessionDownloadTask, didWriteData bytesWritten: Int64,
                  totalBytesWritten: Int64, totalBytesExpectedToWrite: Int64) {
    let total = totalBytesExpectedToWrite > 0 ? totalBytesExpectedToWrite : nil
    continuation.yield(TransferProgress(completed: totalBytesWritten, total: total))
  }

  // Required by URLSessionDownloadDelegate; the per-call async API handles the temp-file
  // lifetime internally so we have no action to take here.
  func urlSession(_ session: URLSession, downloadTask: URLSessionDownloadTask, didFinishDownloadingTo location: URL) {}
}
