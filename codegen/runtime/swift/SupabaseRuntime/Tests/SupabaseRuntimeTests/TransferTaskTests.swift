import Foundation
import Testing
@testable import SupabaseRuntime

@Suite struct TransferTaskTests {
  @Test func deliversProgressThenValue() async throws {
    let (stream, cont) = AsyncStream<TransferProgress>.makeStream()
    let task = TransferTask<Int>(
      progress: stream,
      value: { 42 },
      cancel: {}
    )
    cont.yield(TransferProgress(completed: 5, total: 10))
    cont.finish()

    var seen: [Int64] = []
    for await p in task.progress { seen.append(p.completed) }
    let value = try await task.value()

    #expect(seen == [5])
    #expect(value == 42)
  }

  @Test func fractionComputesWhenTotalKnown() {
    #expect(TransferProgress(completed: 5, total: 10).fraction == 0.5)
    #expect(TransferProgress(completed: 5, total: nil).fraction == nil)
    #expect(TransferProgress(completed: 1, total: 0).fraction == nil)
  }

  @Test func cancelInvokesClosure() async {
    let flag = Flag()
    let task = TransferTask<Int>(progress: AsyncStream { $0.finish() }, value: { 0 }, cancel: { flag.set() })
    task.cancel()
    #expect(flag.get() == true)
  }
}

// Minimal lock-backed helper for the cancel test (test-only).
private final class Flag: @unchecked Sendable {
  private let lock = NSLock(); private var value = false
  func set() { lock.lock(); value = true; lock.unlock() }
  func get() -> Bool { lock.lock(); defer { lock.unlock() }; return value }
}
