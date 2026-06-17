import Foundation

/// Bridges URLSession task callbacks into progress streams + completion continuations. Keyed by task id.
final class SessionDelegate: NSObject, URLSessionDataDelegate, URLSessionDownloadDelegate, @unchecked Sendable {
  private let lock = NSLock()
  private var progress: [Int: AsyncStream<TransferProgress>.Continuation] = [:]
  private var dataCompletions: [Int: (Result<Data, any Error>) -> Void] = [:]
  private var fileCompletions: [Int: (Result<URL, any Error>) -> Void] = [:]
  private var buffers: [Int: Data] = [:]

  func registerProgress(_ id: Int, _ cont: AsyncStream<TransferProgress>.Continuation) {
    lock.withLock { progress[id] = cont }
  }
  func onData(_ id: Int, _ completion: @escaping (Result<Data, any Error>) -> Void) {
    lock.withLock { dataCompletions[id] = completion }
  }
  func onFile(_ id: Int, _ completion: @escaping (Result<URL, any Error>) -> Void) {
    lock.withLock { fileCompletions[id] = completion }
  }

  // MARK: - Upload progress

  func urlSession(
    _ session: URLSession,
    task: URLSessionTask,
    didSendBodyData bytesSent: Int64,
    totalBytesSent: Int64,
    totalBytesExpectedToSend: Int64
  ) {
    let total = totalBytesExpectedToSend > 0 ? totalBytesExpectedToSend : nil
    lock.withLock { progress[task.taskIdentifier] }?
      .yield(TransferProgress(completed: totalBytesSent, total: total))
  }

  // MARK: - Data task (used for upload response body)

  func urlSession(
    _ session: URLSession,
    dataTask: URLSessionDataTask,
    didReceive response: URLResponse,
    completionHandler: @escaping (URLSession.ResponseDisposition) -> Void
  ) {
    completionHandler(.allow)
  }

  func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive data: Data) {
    lock.withLock { buffers[dataTask.taskIdentifier, default: Data()].append(data) }
  }

  // MARK: - Download progress

  func urlSession(
    _ session: URLSession,
    downloadTask: URLSessionDownloadTask,
    didWriteData bytesWritten: Int64,
    totalBytesWritten: Int64,
    totalBytesExpectedToWrite: Int64
  ) {
    let total = totalBytesExpectedToWrite > 0 ? totalBytesExpectedToWrite : nil
    lock.withLock { progress[downloadTask.taskIdentifier] }?
      .yield(TransferProgress(completed: totalBytesWritten, total: total))
  }

  func urlSession(
    _ session: URLSession,
    downloadTask: URLSessionDownloadTask,
    didFinishDownloadingTo location: URL
  ) {
    // Move synchronously here — the temp file is removed when this method returns.
    let id = downloadTask.taskIdentifier
    let stable = FileManager.default.temporaryDirectory
      .appendingPathComponent("sr-dl-\(UUID().uuidString)")
    let result: Result<URL, any Error> = Result {
      try FileManager.default.moveItem(at: location, to: stable)
      return stable
    }
    lock.withLock { fileCompletions[id] }?(result)
  }

  // MARK: - Task completion

  func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: (any Error)?) {
    let id = task.taskIdentifier
    let (cont, dataDone, buffer) = lock.withLock {
      (progress[id], dataCompletions[id], buffers[id] ?? Data())
    }
    cont?.finish()
    if let error {
      dataDone?(.failure(error))
    } else {
      dataDone?(.success(buffer))
    }
    lock.withLock {
      progress[id] = nil
      dataCompletions[id] = nil
      fileCompletions[id] = nil
      buffers[id] = nil
    }
  }
}
