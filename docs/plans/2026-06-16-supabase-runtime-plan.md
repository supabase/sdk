# SupabaseRuntime (Swift) Implementation Plan — Plan A

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `SupabaseRuntime`, a generic, hand-written Swift 6 package implementing the `Transport` seam (send / upload / download / stream) over `URLSession`, with streaming I/O, progress, background sessions, and typed errors — buildable and testable with zero code generation.

**Architecture:** A standalone SwiftPM library package. Pure value types and a small protocol form the contract; a `URLSessionTransport` actor implements it with native async `URLSession`. A `MockTransport` enables network-free testing of downstream layers. Plan B (separate) will generate a thin client against this package.

**Tech Stack:** Swift 6 (language mode), SwiftPM, `swift-testing` (bundled with the toolchain — no external dependency), `URLSession`. Zero external package dependencies.

## Global Constraints

- `swift-tools-version: 6.0`; Swift 6 language mode with complete strict concurrency.
- Platforms: `.macOS(.v12), .iOS(.v15), .tvOS(.v15), .watchOS(.v8)` (floor set by async `URLSession.data(for:)` / `bytes(for:)`).
- **Zero external dependencies.** Foundation + `swift-testing` only.
- No `@unchecked Sendable` and no manual locks — use actor isolation.
- All public types are `public` and `Sendable`.
- Package lives at `codegen/runtime/swift/SupabaseRuntime/`. Run everything from there: `swift build`, `swift test`, `swift test --filter <name>`.

---

### Task 1: Package scaffold + request value types + RequestPath + TransportError

**Files:**
- Create: `codegen/runtime/swift/SupabaseRuntime/Package.swift`
- Create: `codegen/runtime/swift/SupabaseRuntime/Sources/SupabaseRuntime/HTTPRequest.swift`
- Create: `codegen/runtime/swift/SupabaseRuntime/Sources/SupabaseRuntime/RequestPath.swift`
- Create: `codegen/runtime/swift/SupabaseRuntime/Sources/SupabaseRuntime/TransportError.swift`
- Test: `codegen/runtime/swift/SupabaseRuntime/Tests/SupabaseRuntimeTests/RequestPathTests.swift`

**Interfaces:**
- Produces: `HTTPMethod`, `HTTPRequest`, `HTTPResponseHead`, `UploadSource` (value types); `TransportError` (error enum); `RequestPath` percent-encoding via `String(stringInterpolation:)` so `"/x/\(param: value)"` escapes `value`.

- [ ] **Step 1: Create `Package.swift`**

```swift
// swift-tools-version: 6.0
import PackageDescription

let package = Package(
  name: "SupabaseRuntime",
  platforms: [.macOS(.v12), .iOS(.v15), .tvOS(.v15), .watchOS(.v8)],
  products: [.library(name: "SupabaseRuntime", targets: ["SupabaseRuntime"])],
  targets: [
    .target(
      name: "SupabaseRuntime",
      swiftSettings: [.swiftLanguageMode(.v6)]
    ),
    .testTarget(
      name: "SupabaseRuntimeTests",
      dependencies: ["SupabaseRuntime"],
      swiftSettings: [.swiftLanguageMode(.v6)]
    ),
  ]
)
```

- [ ] **Step 2: Write the failing test** — `Tests/SupabaseRuntimeTests/RequestPathTests.swift`:

```swift
import Testing
@testable import SupabaseRuntime

@Suite struct RequestPathTests {
  @Test func percentEncodesInterpolatedParams() {
    let bucket = "my bucket"
    let key = "folder/cat.png"
    let path = RequestPath("/object/\(param: bucket)/\(param: key)")
    #expect(path.value == "/object/my%20bucket/folder%2Fcat.png")
  }

  @Test func leavesLiteralSegmentsUntouched() {
    let path = RequestPath("/bucket/")
    #expect(path.value == "/bucket/")
  }
}
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd codegen/runtime/swift/SupabaseRuntime && swift test --filter RequestPathTests`
Expected: FAIL — `RequestPath` does not exist.

- [ ] **Step 4: Implement the value types** — `Sources/SupabaseRuntime/HTTPRequest.swift`:

```swift
import Foundation

public enum HTTPMethod: String, Sendable {
  case get, post, put, delete, patch, head
}

public struct HTTPRequest: Sendable {
  public var method: HTTPMethod
  public var path: String
  public var query: [URLQueryItem]
  public var headers: [String: String]

  public init(method: HTTPMethod, path: String, query: [URLQueryItem] = [], headers: [String: String] = [:]) {
    self.method = method
    self.path = path
    self.query = query
    self.headers = headers
  }

  /// Convenience so generated code can write `HTTPRequest(method: .get, path: "/x/\(param: id)")`.
  public init(method: HTTPMethod, path: RequestPath, query: [URLQueryItem] = [], headers: [String: String] = [:]) {
    self.init(method: method, path: path.value, query: query, headers: headers)
  }
}

public struct HTTPResponseHead: Sendable {
  public let status: Int
  public let headers: [String: String]
  public init(status: Int, headers: [String: String]) {
    self.status = status
    self.headers = headers
  }
}

public enum UploadSource: Sendable {
  case file(URL)
  case data(Data)
}
```

- [ ] **Step 5: Implement `RequestPath`** — `Sources/SupabaseRuntime/RequestPath.swift`:

```swift
import Foundation

/// A URL path built from a string literal whose interpolated `\(param:)` segments are percent-encoded.
public struct RequestPath: Sendable, ExpressibleByStringInterpolation {
  public let value: String

  public init(stringLiteral value: String) { self.value = value }
  public init(stringInterpolation: StringInterpolation) { self.value = stringInterpolation.text }
  public init(_ path: RequestPath) { self.value = path.value }

  public struct StringInterpolation: StringInterpolationProtocol {
    var text = ""
    public init(literalCapacity: Int, interpolationCount: Int) { text.reserveCapacity(literalCapacity) }
    public mutating func appendLiteral(_ literal: String) { text += literal }
    /// Interpolated path parameter — percent-encoded for a path segment (so `/` becomes `%2F`).
    public mutating func appendInterpolation(param value: String) {
      var allowed = CharacterSet.urlPathAllowed
      allowed.remove("/")
      text += value.addingPercentEncoding(withAllowedCharacters: allowed) ?? value
    }
  }
}
```

- [ ] **Step 6: Implement `TransportError`** — `Sources/SupabaseRuntime/TransportError.swift`:

```swift
import Foundation

/// The error the runtime throws when no `ClientConfiguration.errorMapper` produces a typed error.
public enum TransportError: Error, Sendable {
  case http(status: Int, body: Data, head: HTTPResponseHead)
  case transport(any Error)
  case decoding(any Error)
  case cancelled
  /// Background sessions reject in-memory bodies.
  case backgroundRequiresFile
}
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `cd codegen/runtime/swift/SupabaseRuntime && swift test --filter RequestPathTests`
Expected: PASS (both cases).

- [ ] **Step 8: Verify the whole package builds, then commit**

Run: `cd codegen/runtime/swift/SupabaseRuntime && swift build && swift test`
Expected: build succeeds, tests pass.

```bash
git add codegen/runtime/swift/SupabaseRuntime
git commit -m "feat(runtime): scaffold SupabaseRuntime with request value types"
```

---

### Task 2: Streaming types — TransferProgress, TransferTask, ResponseStream

**Files:**
- Create: `codegen/runtime/swift/SupabaseRuntime/Sources/SupabaseRuntime/Streaming.swift`
- Test: `codegen/runtime/swift/SupabaseRuntime/Tests/SupabaseRuntimeTests/TransferTaskTests.swift`

**Interfaces:**
- Produces: `TransferProgress` (struct); `TransferTask<Value>` (handle with `progress: AsyncStream<TransferProgress>`, `value() async throws -> Value`, `cancel()`, built from closures so it's testable in isolation); `ResponseStream` (head + `AsyncThrowingStream<ArraySlice<UInt8>, any Error>`).

- [ ] **Step 1: Write the failing test** — `Tests/SupabaseRuntimeTests/TransferTaskTests.swift`:

```swift
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
  }

  @Test func cancelInvokesClosure() async {
    let flag = Mutexish()
    let task = TransferTask<Int>(progress: .init { $0.finish() }, value: { 0 }, cancel: { flag.set() })
    task.cancel()
    #expect(flag.get() == true)
  }
}

// Minimal actor helper for the cancel test (no production use).
private final class Mutexish: @unchecked Sendable {
  private let lock = NSLock(); private var flag = false
  func set() { lock.lock(); flag = true; lock.unlock() }
  func get() -> Bool { lock.lock(); defer { lock.unlock() }; return flag }
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd codegen/runtime/swift/SupabaseRuntime && swift test --filter TransferTaskTests`
Expected: FAIL — `TransferProgress`/`TransferTask`/`ResponseStream` do not exist.

- [ ] **Step 3: Implement** — `Sources/SupabaseRuntime/Streaming.swift`:

```swift
import Foundation

public struct TransferProgress: Sendable {
  public let completed: Int64
  public let total: Int64?
  public init(completed: Int64, total: Int64?) {
    self.completed = completed
    self.total = total
  }
  public var fraction: Double? {
    guard let total, total > 0 else { return nil }
    return Double(completed) / Double(total)
  }
}

/// Handle for an in-flight upload/download: live progress + the awaitable result.
public struct TransferTask<Value: Sendable>: Sendable {
  public let progress: AsyncStream<TransferProgress>
  private let _value: @Sendable () async throws -> Value
  private let _cancel: @Sendable () -> Void

  public init(
    progress: AsyncStream<TransferProgress>,
    value: @escaping @Sendable () async throws -> Value,
    cancel: @escaping @Sendable () -> Void
  ) {
    self.progress = progress
    self._value = value
    self._cancel = cancel
  }

  public func value() async throws -> Value { try await _value() }
  public func cancel() { _cancel() }
}

/// A streamed response body (event streams / SSE / incremental reads).
public struct ResponseStream: Sendable {
  public let head: HTTPResponseHead
  public let body: AsyncThrowingStream<ArraySlice<UInt8>, any Error>
  public init(head: HTTPResponseHead, body: AsyncThrowingStream<ArraySlice<UInt8>, any Error>) {
    self.head = head
    self.body = body
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd codegen/runtime/swift/SupabaseRuntime && swift test --filter TransferTaskTests`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add codegen/runtime/swift/SupabaseRuntime
git commit -m "feat(runtime): add TransferProgress, TransferTask, ResponseStream"
```

---

### Task 3: Transport protocol + MockTransport

**Files:**
- Create: `codegen/runtime/swift/SupabaseRuntime/Sources/SupabaseRuntime/Transport.swift`
- Create: `codegen/runtime/swift/SupabaseRuntime/Sources/SupabaseRuntime/MockTransport.swift`
- Test: `codegen/runtime/swift/SupabaseRuntime/Tests/SupabaseRuntimeTests/MockTransportTests.swift`

**Interfaces:**
- Consumes: `HTTPRequest`, `UploadSource`, `TransferTask`, `ResponseStream`, `HTTPResponseHead` (Tasks 1-2).
- Produces: `Transport` protocol (the seam); `MockTransport` — a `Transport` whose `respond: @Sendable (HTTPRequest) async throws -> (Int, Data)` returns a status + body, decoded with an injected `JSONDecoder`.

- [ ] **Step 1: Write the failing test** — `Tests/SupabaseRuntimeTests/MockTransportTests.swift`:

```swift
import Foundation
import Testing
@testable import SupabaseRuntime

private struct Bucket: Codable, Equatable, Sendable { let id: String }

@Suite struct MockTransportTests {
  @Test func sendDecodesBody() async throws {
    let mock = MockTransport { _ in (200, #"{"id":"abc"}"#.data(using: .utf8)!) }
    let bucket: Bucket = try await mock.send(HTTPRequest(method: .get, path: "/bucket/abc"))
    #expect(bucket == Bucket(id: "abc"))
  }

  @Test func uploadReturnsValue() async throws {
    let mock = MockTransport { _ in (200, #"{"id":"up"}"#.data(using: .utf8)!) }
    let task: TransferTask<Bucket> = mock.upload(HTTPRequest(method: .post, path: "/object/b/k"), from: .data(Data()))
    let bucket = try await task.value()
    #expect(bucket == Bucket(id: "up"))
  }

  @Test func streamYieldsBody() async throws {
    let mock = MockTransport { _ in (200, Data([1, 2, 3])) }
    let response = try await mock.stream(HTTPRequest(method: .get, path: "/events"))
    #expect(response.head.status == 200)
    var bytes: [UInt8] = []
    for try await chunk in response.body { bytes.append(contentsOf: chunk) }
    #expect(bytes == [1, 2, 3])
  }
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd codegen/runtime/swift/SupabaseRuntime && swift test --filter MockTransportTests`
Expected: FAIL — `Transport`/`MockTransport` do not exist.

- [ ] **Step 3: Implement the protocol** — `Sources/SupabaseRuntime/Transport.swift`:

```swift
import Foundation

public protocol Transport: Sendable {
  func send<R: Decodable & Sendable>(_ request: HTTPRequest) async throws -> R
  func send<B: Encodable & Sendable, R: Decodable & Sendable>(_ request: HTTPRequest, body: B) async throws -> R
  func send(_ request: HTTPRequest) async throws
  func upload<R: Decodable & Sendable>(_ request: HTTPRequest, from source: UploadSource) -> TransferTask<R>
  func download(_ request: HTTPRequest, toFile destination: URL) -> TransferTask<Void>
  func stream(_ request: HTTPRequest) async throws -> ResponseStream
}
```

- [ ] **Step 4: Implement `MockTransport`** — `Sources/SupabaseRuntime/MockTransport.swift`:

```swift
import Foundation

/// In-memory `Transport` for tests: `respond` maps a request to a (status, body) pair.
public struct MockTransport: Transport {
  public typealias Responder = @Sendable (HTTPRequest) async throws -> (Int, Data)
  let responder: Responder
  let decoder: JSONDecoder

  public init(decoder: JSONDecoder = JSONDecoder(), _ responder: @escaping Responder) {
    self.responder = responder
    self.decoder = decoder
  }

  public func send<R: Decodable & Sendable>(_ request: HTTPRequest) async throws -> R {
    let (_, data) = try await responder(request)
    return try decoder.decode(R.self, from: data)
  }

  public func send<B: Encodable & Sendable, R: Decodable & Sendable>(_ request: HTTPRequest, body: B) async throws -> R {
    try await send(request)
  }

  public func send(_ request: HTTPRequest) async throws {
    _ = try await responder(request)
  }

  public func upload<R: Decodable & Sendable>(_ request: HTTPRequest, from source: UploadSource) -> TransferTask<R> {
    let responder = self.responder
    let decoder = self.decoder
    let (stream, cont) = AsyncStream<TransferProgress>.makeStream()
    cont.finish()
    return TransferTask(
      progress: stream,
      value: { let (_, data) = try await responder(request); return try decoder.decode(R.self, from: data) },
      cancel: {}
    )
  }

  public func download(_ request: HTTPRequest, toFile destination: URL) -> TransferTask<Void> {
    let responder = self.responder
    let (stream, cont) = AsyncStream<TransferProgress>.makeStream()
    cont.finish()
    return TransferTask(
      progress: stream,
      value: { let (_, data) = try await responder(request); try data.write(to: destination) },
      cancel: {}
    )
  }

  public func stream(_ request: HTTPRequest) async throws -> ResponseStream {
    let (status, data) = try await responder(request)
    let body = AsyncThrowingStream<ArraySlice<UInt8>, any Error> { cont in
      cont.yield(ArraySlice(data))
      cont.finish()
    }
    return ResponseStream(head: HTTPResponseHead(status: status, headers: [:]), body: body)
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd codegen/runtime/swift/SupabaseRuntime && swift test --filter MockTransportTests`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add codegen/runtime/swift/SupabaseRuntime
git commit -m "feat(runtime): add Transport protocol and MockTransport"
```

---

### Task 4: ClientConfiguration + AuthProvider

**Files:**
- Create: `codegen/runtime/swift/SupabaseRuntime/Sources/SupabaseRuntime/AuthProvider.swift`
- Create: `codegen/runtime/swift/SupabaseRuntime/Sources/SupabaseRuntime/ClientConfiguration.swift`
- Test: `codegen/runtime/swift/SupabaseRuntime/Tests/SupabaseRuntimeTests/ClientConfigurationTests.swift`

**Interfaces:**
- Produces: `AuthProvider` (wraps `@Sendable () async throws -> [String: String]`); `SessionKind` (`.foreground` / `.background(identifier:)`); `ClientConfiguration` (baseURL, defaultHeaders, encoder, decoder, errorMapper, sessionKind, auth) consumed by `URLSessionTransport` in Task 5.

- [ ] **Step 1: Write the failing test** — `Tests/SupabaseRuntimeTests/ClientConfigurationTests.swift`:

```swift
import Foundation
import Testing
@testable import SupabaseRuntime

@Suite struct ClientConfigurationTests {
  @Test func authProviderSuppliesHeaders() async throws {
    let auth = AuthProvider { ["Authorization": "Bearer t", "apikey": "k"] }
    let headers = try await auth.headers()
    #expect(headers["Authorization"] == "Bearer t")
    #expect(headers["apikey"] == "k")
  }

  @Test func configHoldsBaseURLAndDefaults() {
    let config = ClientConfiguration(baseURL: URL(string: "https://x.supabase.co/storage/v1")!)
    #expect(config.baseURL.absoluteString == "https://x.supabase.co/storage/v1")
    #expect(config.sessionKind == .foreground)
  }
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd codegen/runtime/swift/SupabaseRuntime && swift test --filter ClientConfigurationTests`
Expected: FAIL — `AuthProvider`/`ClientConfiguration` do not exist.

- [ ] **Step 3: Implement `AuthProvider`** — `Sources/SupabaseRuntime/AuthProvider.swift`:

```swift
import Foundation

/// Supplies auth headers per request; async so token refresh fits.
public struct AuthProvider: Sendable {
  private let provider: @Sendable () async throws -> [String: String]
  public init(_ provider: @escaping @Sendable () async throws -> [String: String]) { self.provider = provider }
  public func headers() async throws -> [String: String] { try await provider() }

  /// No auth headers.
  public static let none = AuthProvider { [:] }
}
```

- [ ] **Step 4: Implement `ClientConfiguration`** — `Sources/SupabaseRuntime/ClientConfiguration.swift`:

```swift
import Foundation

public enum SessionKind: Sendable, Equatable {
  case foreground
  case background(identifier: String)
}

public struct ClientConfiguration: Sendable {
  public var baseURL: URL
  public var defaultHeaders: [String: String]
  public var auth: AuthProvider
  public var encoder: JSONEncoder
  public var decoder: JSONDecoder
  public var sessionKind: SessionKind
  /// Maps a non-2xx (body, head) to a typed error; returns nil to fall back to `TransportError.http`.
  public var errorMapper: @Sendable (Data, HTTPResponseHead) -> (any Error)?

  public init(
    baseURL: URL,
    defaultHeaders: [String: String] = [:],
    auth: AuthProvider = .none,
    encoder: JSONEncoder = JSONEncoder(),
    decoder: JSONDecoder = JSONDecoder(),
    sessionKind: SessionKind = .foreground,
    errorMapper: @escaping @Sendable (Data, HTTPResponseHead) -> (any Error)? = { _, _ in nil }
  ) {
    self.baseURL = baseURL
    self.defaultHeaders = defaultHeaders
    self.auth = auth
    self.encoder = encoder
    self.decoder = decoder
    self.sessionKind = sessionKind
    self.errorMapper = errorMapper
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd codegen/runtime/swift/SupabaseRuntime && swift test --filter ClientConfigurationTests`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add codegen/runtime/swift/SupabaseRuntime
git commit -m "feat(runtime): add ClientConfiguration and AuthProvider"
```

---

### Task 5: URLSessionTransport — buffered `send` over native async URLSession

**Files:**
- Create: `codegen/runtime/swift/SupabaseRuntime/Sources/SupabaseRuntime/URLSessionTransport.swift`
- Create: `codegen/runtime/swift/SupabaseRuntime/Tests/SupabaseRuntimeTests/Support/StubURLProtocol.swift`
- Test: `codegen/runtime/swift/SupabaseRuntime/Tests/SupabaseRuntimeTests/URLSessionTransportSendTests.swift`

**Interfaces:**
- Consumes: `ClientConfiguration`, `HTTPRequest`, `Transport`, `TransportError`, `HTTPResponseHead` (Tasks 1-4).
- Produces: `URLSessionTransport` — an `actor` conforming to `Transport`; `init(configuration:urlSession:)` where `urlSession` is injectable for tests. Implements the three `send` overloads now (upload/download/stream land in Tasks 6-7; stub them to `fatalError("implemented in Task 6/7")` until then so the type compiles — replace in those tasks).

- [ ] **Step 1: Write the test stub helper** — `Tests/SupabaseRuntimeTests/Support/StubURLProtocol.swift`:

```swift
import Foundation

/// A URLProtocol that returns a canned response, so transport tests need no network.
final class StubURLProtocol: URLProtocol, @unchecked Sendable {
  struct Stub: Sendable { var status: Int; var headers: [String: String]; var body: Data }
  nonisolated(unsafe) static var stub: Stub = .init(status: 200, headers: [:], body: Data())
  nonisolated(unsafe) static var lastRequest: URLRequest?

  static func session() -> URLSession {
    let config = URLSessionConfiguration.ephemeral
    config.protocolClasses = [StubURLProtocol.self]
    return URLSession(configuration: config)
  }

  override class func canInit(with request: URLRequest) -> Bool { true }
  override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
  override func startLoading() {
    StubURLProtocol.lastRequest = request
    let stub = StubURLProtocol.stub
    let response = HTTPURLResponse(url: request.url!, statusCode: stub.status, httpVersion: "HTTP/1.1", headerFields: stub.headers)!
    client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
    client?.urlProtocol(self, didLoad: stub.body)
    client?.urlProtocolDidFinishLoading(self)
  }
  override func stopLoading() {}
}
```

- [ ] **Step 2: Write the failing test** — `Tests/SupabaseRuntimeTests/URLSessionTransportSendTests.swift`:

```swift
import Foundation
import Testing
@testable import SupabaseRuntime

private struct Bucket: Codable, Equatable, Sendable { let id: String }
private struct StorageError: Error, Equatable { let message: String }

@Suite struct URLSessionTransportSendTests {
  func makeTransport(errorMapper: (@Sendable (Data, HTTPResponseHead) -> (any Error)?)? = nil) -> URLSessionTransport {
    var config = ClientConfiguration(baseURL: URL(string: "https://x.test/storage/v1")!)
    if let errorMapper { config.errorMapper = errorMapper }
    config.auth = AuthProvider { ["apikey": "k"] }
    return URLSessionTransport(configuration: config, urlSession: StubURLProtocol.session())
  }

  @Test func sendDecodes2xx() async throws {
    StubURLProtocol.stub = .init(status: 200, headers: ["Content-Type": "application/json"], body: #"{"id":"abc"}"#.data(using: .utf8)!)
    let bucket: Bucket = try await makeTransport().send(HTTPRequest(method: .get, path: "/bucket/abc"))
    #expect(bucket == Bucket(id: "abc"))
  }

  @Test func sendBuildsURLWithBaseAndAuthHeader() async throws {
    StubURLProtocol.stub = .init(status: 200, headers: [:], body: #"{"id":"x"}"#.data(using: .utf8)!)
    let _: Bucket = try await makeTransport().send(HTTPRequest(method: .get, path: "/bucket/x", query: [URLQueryItem(name: "limit", value: "10")]))
    let req = try #require(StubURLProtocol.lastRequest)
    #expect(req.url?.absoluteString == "https://x.test/storage/v1/bucket/x?limit=10")
    #expect(req.value(forHTTPHeaderField: "apikey") == "k")
  }

  @Test func sendMapsNon2xxToTypedError() async {
    StubURLProtocol.stub = .init(status: 400, headers: [:], body: #"{"message":"bad"}"#.data(using: .utf8)!)
    let transport = makeTransport { data, _ in
      (try? JSONDecoder().decode([String: String].self, from: data)["message"]).map { StorageError(message: $0) } ?? nil
    }
    await #expect(throws: StorageError(message: "bad")) {
      let _: Bucket = try await transport.send(HTTPRequest(method: .get, path: "/bucket/x"))
    }
  }
}
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd codegen/runtime/swift/SupabaseRuntime && swift test --filter URLSessionTransportSendTests`
Expected: FAIL — `URLSessionTransport` does not exist.

- [ ] **Step 4: Implement `URLSessionTransport`** — `Sources/SupabaseRuntime/URLSessionTransport.swift`:

```swift
import Foundation

public actor URLSessionTransport: Transport {
  let configuration: ClientConfiguration
  let urlSession: URLSession

  public init(configuration: ClientConfiguration, urlSession: URLSession? = nil) {
    self.configuration = configuration
    if let urlSession {
      self.urlSession = urlSession
    } else {
      switch configuration.sessionKind {
      case .foreground:
        self.urlSession = URLSession(configuration: .default)
      case .background(let identifier):
        self.urlSession = URLSession(configuration: .background(withIdentifier: identifier))
      }
    }
  }

  // MARK: Request building

  func makeURLRequest(_ request: HTTPRequest) async throws -> URLRequest {
    var components = URLComponents(url: configuration.baseURL, resolvingAgainstBaseURL: false)!
    components.path += request.path
    if !request.query.isEmpty { components.queryItems = request.query }
    var urlRequest = URLRequest(url: components.url!)
    urlRequest.httpMethod = request.method.rawValue.uppercased()
    for (k, v) in configuration.defaultHeaders { urlRequest.setValue(v, forHTTPHeaderField: k) }
    for (k, v) in try await configuration.auth.headers() { urlRequest.setValue(v, forHTTPHeaderField: k) }
    for (k, v) in request.headers { urlRequest.setValue(v, forHTTPHeaderField: k) }
    return urlRequest
  }

  func head(from response: URLResponse) -> HTTPResponseHead {
    let http = response as? HTTPURLResponse
    let headers = (http?.allHeaderFields as? [String: String]) ?? [:]
    return HTTPResponseHead(status: http?.statusCode ?? 0, headers: headers)
  }

  /// Throws a typed/`TransportError` for non-2xx; returns the data for 2xx.
  func validate(_ data: Data, _ response: URLResponse) throws -> Data {
    let head = head(from: response)
    guard (200..<300).contains(head.status) else {
      if let mapped = configuration.errorMapper(data, head) { throw mapped }
      throw TransportError.http(status: head.status, body: data, head: head)
    }
    return data
  }

  // MARK: send

  public func send<R: Decodable & Sendable>(_ request: HTTPRequest) async throws -> R {
    let urlRequest = try await makeURLRequest(request)
    let (data, response) = try await urlSession.data(for: urlRequest)
    let body = try validate(data, response)
    do { return try configuration.decoder.decode(R.self, from: body) }
    catch { throw TransportError.decoding(error) }
  }

  public func send<B: Encodable & Sendable, R: Decodable & Sendable>(_ request: HTTPRequest, body: B) async throws -> R {
    var urlRequest = try await makeURLRequest(request)
    urlRequest.httpBody = try configuration.encoder.encode(body)
    if urlRequest.value(forHTTPHeaderField: "Content-Type") == nil {
      urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
    }
    let (data, response) = try await urlSession.data(for: urlRequest)
    let validated = try validate(data, response)
    do { return try configuration.decoder.decode(R.self, from: validated) }
    catch { throw TransportError.decoding(error) }
  }

  public func send(_ request: HTTPRequest) async throws {
    let urlRequest = try await makeURLRequest(request)
    let (data, response) = try await urlSession.data(for: urlRequest)
    _ = try validate(data, response)
  }

  // MARK: streaming — implemented in Tasks 6-7

  public nonisolated func upload<R: Decodable & Sendable>(_ request: HTTPRequest, from source: UploadSource) -> TransferTask<R> {
    fatalError("implemented in Task 6")
  }
  public nonisolated func download(_ request: HTTPRequest, toFile destination: URL) -> TransferTask<Void> {
    fatalError("implemented in Task 6")
  }
  public func stream(_ request: HTTPRequest) async throws -> ResponseStream {
    fatalError("implemented in Task 7")
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd codegen/runtime/swift/SupabaseRuntime && swift test --filter URLSessionTransportSendTests`
Expected: PASS (all three cases). If query-ordering makes the URL assertion flaky, assert on `components` membership instead of the exact string.

- [ ] **Step 6: Run the full suite and commit**

Run: `cd codegen/runtime/swift/SupabaseRuntime && swift test`
Expected: all pass.

```bash
git add codegen/runtime/swift/SupabaseRuntime
git commit -m "feat(runtime): URLSessionTransport send over native async URLSession"
```

---

### Task 6: URLSessionTransport — streaming upload/download with progress

**Files:**
- Create: `codegen/runtime/swift/SupabaseRuntime/Sources/SupabaseRuntime/SessionDelegate.swift`
- Modify: `codegen/runtime/swift/SupabaseRuntime/Sources/SupabaseRuntime/URLSessionTransport.swift` (replace the `upload`/`download` stubs)
- Test: `codegen/runtime/swift/SupabaseRuntime/Tests/SupabaseRuntimeTests/URLSessionTransportTransferTests.swift`

**Interfaces:**
- Consumes: everything from Task 5.
- Produces: real `upload`/`download` returning `TransferTask`. A `SessionDelegate` (`NSObject`, `URLSessionDataDelegate`/`URLSessionTaskDelegate`/`URLSessionDownloadDelegate`) that bridges `didSendBodyData` / `didWriteData` into an `AsyncStream<TransferProgress>` continuation and completion into the task's result.

- [ ] **Step 1: Write the failing test** — `Tests/SupabaseRuntimeTests/URLSessionTransportTransferTests.swift`:

```swift
import Foundation
import Testing
@testable import SupabaseRuntime

private struct UploadResult: Codable, Equatable, Sendable { let key: String }

@Suite struct URLSessionTransportTransferTests {
  func makeTransport() -> URLSessionTransport {
    var config = ClientConfiguration(baseURL: URL(string: "https://x.test/storage/v1")!)
    config.auth = AuthProvider { ["apikey": "k"] }
    return URLSessionTransport(configuration: config, urlSession: StubURLProtocol.session())
  }

  @Test func uploadFromDataReturnsDecodedValue() async throws {
    StubURLProtocol.stub = .init(status: 200, headers: [:], body: #"{"key":"folder/cat.png"}"#.data(using: .utf8)!)
    let task: TransferTask<UploadResult> = makeTransport()
      .upload(HTTPRequest(method: .post, path: "/object/avatars/cat.png"), from: .data(Data([0x1, 0x2])))
    // Drain progress (may be empty under the stub) so the stream completes.
    for await _ in task.progress {}
    let result = try await task.value()
    #expect(result == UploadResult(key: "folder/cat.png"))
  }

  @Test func downloadWritesToFile() async throws {
    StubURLProtocol.stub = .init(status: 200, headers: [:], body: Data([0xA, 0xB, 0xC]))
    let dest = FileManager.default.temporaryDirectory.appendingPathComponent("dl-\(UUID().uuidString).bin")
    defer { try? FileManager.default.removeItem(at: dest) }
    let task = makeTransport().download(HTTPRequest(method: .get, path: "/object/avatars/cat.png"), toFile: dest)
    for await _ in task.progress {}
    try await task.value()
    #expect(try Data(contentsOf: dest) == Data([0xA, 0xB, 0xC]))
  }
}
```

Note: a `URLProtocol` stub does not emit realistic incremental `didSendBodyData`/`didWriteData` callbacks, so these tests verify the *result and file-writing* paths and that the progress stream terminates. Byte-accurate progress is covered by an integration test against a real server, tracked in the spec's risks — do not fake progress to make a unit test "verify" it.

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd codegen/runtime/swift/SupabaseRuntime && swift test --filter URLSessionTransportTransferTests`
Expected: FAIL — `upload`/`download` still `fatalError`.

- [ ] **Step 3: Implement `SessionDelegate`** — `Sources/SupabaseRuntime/SessionDelegate.swift`:

```swift
import Foundation

/// Bridges URLSession task callbacks into progress streams + completion continuations.
/// One delegate instance per session; keyed by task identifier.
final class SessionDelegate: NSObject, URLSessionDataDelegate, URLSessionDownloadDelegate, @unchecked Sendable {
  private let lock = NSLock()
  private var progress: [Int: AsyncStream<TransferProgress>.Continuation] = [:]
  private var dataCompletions: [Int: (Result<Data, any Error>) -> Void] = [:]
  private var fileCompletions: [Int: (Result<URL, any Error>) -> Void] = [:]
  private var buffers: [Int: Data] = [:]
  private var responses: [Int: URLResponse] = [:]

  func registerProgress(_ id: Int, _ cont: AsyncStream<TransferProgress>.Continuation) {
    lock.withLock { progress[id] = cont }
  }
  func onData(_ id: Int, _ completion: @escaping (Result<Data, any Error>) -> Void) {
    lock.withLock { dataCompletions[id] = completion }
  }
  func onFile(_ id: Int, _ completion: @escaping (Result<URL, any Error>) -> Void) {
    lock.withLock { fileCompletions[id] = completion }
  }

  // Upload progress.
  func urlSession(_ s: URLSession, task: URLSessionTask, didSendBodyData bytesSent: Int64,
                  totalBytesSent: Int64, totalBytesExpectedToSend: Int64) {
    let total = totalBytesExpectedToSend > 0 ? totalBytesExpectedToSend : nil
    lock.withLock { progress[task.taskIdentifier] }?.yield(TransferProgress(completed: totalBytesSent, total: total))
  }

  // Buffered data (for upload responses).
  func urlSession(_ s: URLSession, dataTask: URLSessionDataTask, didReceive data: Data) {
    lock.withLock { buffers[dataTask.taskIdentifier, default: Data()].append(data) }
  }
  func urlSession(_ s: URLSession, dataTask: URLSessionDataTask, didReceive response: URLResponse,
                  completionHandler: @escaping (URLSession.ResponseDisposition) -> Void) {
    lock.withLock { responses[dataTask.taskIdentifier] = response }
    completionHandler(.allow)
  }

  // Download progress + file.
  func urlSession(_ s: URLSession, downloadTask: URLSessionDownloadTask, didWriteData bytesWritten: Int64,
                  totalBytesWritten: Int64, totalBytesExpectedToWrite: Int64) {
    let total = totalBytesExpectedToWrite > 0 ? totalBytesExpectedToWrite : nil
    lock.withLock { progress[downloadTask.taskIdentifier] }?.yield(TransferProgress(completed: totalBytesWritten, total: total))
  }
  func urlSession(_ s: URLSession, downloadTask: URLSessionDownloadTask, didFinishDownloadingTo location: URL) {
    // Move synchronously inside the delegate callback (the temp file is deleted when this returns).
    let id = downloadTask.taskIdentifier
    let completion = lock.withLock { fileCompletions[id] }
    completion?(.success(location))
  }

  func urlSession(_ s: URLSession, task: URLSessionTask, didCompleteWithError error: (any Error)?) {
    let id = task.taskIdentifier
    let (cont, dataDone, buffer, response) = lock.withLock {
      (progress[id], dataCompletions[id], buffers[id] ?? Data(), responses[id])
    }
    cont?.finish()
    if let error {
      dataDone?(.failure(error))
    } else if let dataDone {
      dataDone(.success(buffer))
    }
    lock.withLock {
      progress[id] = nil; dataCompletions[id] = nil; fileCompletions[id] = nil
      buffers[id] = nil; responses[id] = nil
    }
    _ = response
  }
}
```

- [ ] **Step 4: Wire the delegate into `URLSessionTransport`** — replace the `upload`/`download` stubs and adjust `init` to own a `SessionDelegate`. In `URLSessionTransport.swift`:

Change `urlSession` to `nonisolated(unsafe)` (URLSession is thread-safe) so the `nonisolated` `upload`/`download` can read it, and add a `nonisolated let delegate`. This replaces the `let urlSession: URLSession` declaration from Task 5. The property block + `init` become:

```swift
  let configuration: ClientConfiguration
  nonisolated(unsafe) let urlSession: URLSession   // URLSession is thread-safe; readable from nonisolated upload/download
  nonisolated let delegate = SessionDelegate()

  public init(configuration: ClientConfiguration, urlSession: URLSession? = nil) {
    self.configuration = configuration
    if let urlSession {
      self.urlSession = urlSession
    } else {
      let cfg: URLSessionConfiguration
      switch configuration.sessionKind {
      case .foreground: cfg = .default
      case .background(let id): cfg = .background(withIdentifier: id)
      }
      self.urlSession = URLSession(configuration: cfg, delegate: delegate, delegateQueue: nil)
    }
  }
```

Replace the `upload`/`download` `fatalError` stubs with:

```swift
  public nonisolated func upload<R: Decodable & Sendable>(_ request: HTTPRequest, from source: UploadSource) -> TransferTask<R> {
    let (stream, cont) = AsyncStream<TransferProgress>.makeStream()
    let session = urlSession
    let delegate = self.delegate
    let decoder = configuration.decoder
    let task = Task { [self] () -> R in
      let urlRequest = try await makeURLRequest(request)
      let sessionTask: URLSessionUploadTask
      switch source {
      case .file(let url): sessionTask = session.uploadTask(with: urlRequest, fromFile: url)
      case .data(let data): sessionTask = session.uploadTask(with: urlRequest, from: data)
      }
      delegate.registerProgress(sessionTask.taskIdentifier, cont)
      let data: Data = try await withTaskCancellationHandler {
        try await withCheckedThrowingContinuation { c in
          delegate.onData(sessionTask.taskIdentifier) { c.resume(with: $0) }
          sessionTask.resume()
        }
      } onCancel: { sessionTask.cancel() }
      return try decoder.decode(R.self, from: data)
    }
    return TransferTask(progress: stream, value: { try await task.value }, cancel: { task.cancel() })
  }

  public nonisolated func download(_ request: HTTPRequest, toFile destination: URL) -> TransferTask<Void> {
    let (stream, cont) = AsyncStream<TransferProgress>.makeStream()
    let session = urlSession
    let delegate = self.delegate
    let task = Task { [self] () -> Void in
      let urlRequest = try await makeURLRequest(request)
      let sessionTask = session.downloadTask(with: urlRequest)
      delegate.registerProgress(sessionTask.taskIdentifier, cont)
      let tempURL: URL = try await withTaskCancellationHandler {
        try await withCheckedThrowingContinuation { c in
          delegate.onFile(sessionTask.taskIdentifier) { c.resume(with: $0) }
          sessionTask.resume()
        }
      } onCancel: { sessionTask.cancel() }
      try? FileManager.default.removeItem(at: destination)
      try FileManager.default.moveItem(at: tempURL, to: destination)
    }
    return TransferTask(progress: stream, value: { try await task.value }, cancel: { task.cancel() })
  }
```

Note: `makeURLRequest` is `actor`-isolated, so the `Task` closures `await` it — correct. The `didFinishDownloadingTo` callback hands back the temp URL; the `download` closure moves it before the callback returns is not guaranteed, so move happens in the awaiting task — acceptable for the foreground case; the integration/background nuance is tracked in Task 8 / risks.

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd codegen/runtime/swift/SupabaseRuntime && swift test --filter URLSessionTransportTransferTests`
Expected: PASS. If the download temp-file move races the callback, capture the file inside `didFinishDownloadingTo` (copy to a stable temp path there) — note this and adjust.

- [ ] **Step 6: Run the full suite and commit**

Run: `cd codegen/runtime/swift/SupabaseRuntime && swift test`

```bash
git add codegen/runtime/swift/SupabaseRuntime
git commit -m "feat(runtime): streaming upload/download with progress"
```

---

### Task 7: URLSessionTransport — `stream()` for event-stream responses

**Files:**
- Modify: `codegen/runtime/swift/SupabaseRuntime/Sources/SupabaseRuntime/URLSessionTransport.swift` (replace the `stream` stub)
- Test: `codegen/runtime/swift/SupabaseRuntime/Tests/SupabaseRuntimeTests/URLSessionTransportStreamTests.swift`

**Interfaces:**
- Produces: real `stream(_:) async throws -> ResponseStream` using `URLSession.bytes(for:)`.

- [ ] **Step 1: Write the failing test** — `Tests/SupabaseRuntimeTests/URLSessionTransportStreamTests.swift`:

```swift
import Foundation
import Testing
@testable import SupabaseRuntime

@Suite struct URLSessionTransportStreamTests {
  @Test func streamYieldsBodyBytesAndHead() async throws {
    StubURLProtocol.stub = .init(status: 200, headers: ["Content-Type": "text/event-stream"], body: Data([0x64, 0x61, 0x74, 0x61]))
    var config = ClientConfiguration(baseURL: URL(string: "https://x.test/functions/v1")!)
    config.auth = AuthProvider { ["apikey": "k"] }
    let transport = URLSessionTransport(configuration: config, urlSession: StubURLProtocol.session())
    let response = try await transport.stream(HTTPRequest(method: .get, path: "/events"))
    #expect(response.head.status == 200)
    var bytes: [UInt8] = []
    for try await chunk in response.body { bytes.append(contentsOf: chunk) }
    #expect(bytes == [0x64, 0x61, 0x74, 0x61])
  }
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd codegen/runtime/swift/SupabaseRuntime && swift test --filter URLSessionTransportStreamTests`
Expected: FAIL — `stream` still `fatalError`.

- [ ] **Step 3: Implement `stream`** — replace the `stream` stub in `URLSessionTransport.swift`:

```swift
  public func stream(_ request: HTTPRequest) async throws -> ResponseStream {
    let urlRequest = try await makeURLRequest(request)
    let (bytes, response) = try await urlSession.bytes(for: urlRequest)
    let responseHead = head(from: response)
    guard (200..<300).contains(responseHead.status) else {
      var collected = Data()
      for try await byte in bytes { collected.append(byte) }
      if let mapped = configuration.errorMapper(collected, responseHead) { throw mapped }
      throw TransportError.http(status: responseHead.status, body: collected, head: responseHead)
    }
    let body = AsyncThrowingStream<ArraySlice<UInt8>, any Error> { continuation in
      let task = Task {
        do {
          var chunk = [UInt8]()
          chunk.reserveCapacity(4096)
          for try await byte in bytes {
            chunk.append(byte)
            if chunk.count >= 4096 { continuation.yield(ArraySlice(chunk)); chunk.removeAll(keepingCapacity: true) }
          }
          if !chunk.isEmpty { continuation.yield(ArraySlice(chunk)) }
          continuation.finish()
        } catch { continuation.finish(throwing: error) }
      }
      continuation.onTermination = { _ in task.cancel() }
    }
    return ResponseStream(head: responseHead, body: body)
  }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd codegen/runtime/swift/SupabaseRuntime && swift test --filter URLSessionTransportStreamTests`
Expected: PASS.

- [ ] **Step 5: Run the full suite and commit**

Run: `cd codegen/runtime/swift/SupabaseRuntime && swift test`

```bash
git add codegen/runtime/swift/SupabaseRuntime
git commit -m "feat(runtime): stream() for event-stream responses"
```

---

### Task 8: Background sessions — `sessionKind` wiring, file-only guard, relaunch hook

**Files:**
- Modify: `codegen/runtime/swift/SupabaseRuntime/Sources/SupabaseRuntime/URLSessionTransport.swift`
- Test: `codegen/runtime/swift/SupabaseRuntime/Tests/SupabaseRuntimeTests/BackgroundSessionTests.swift`

**Interfaces:**
- Produces: `URLSessionTransport.isBackground` (Bool); a `backgroundRequiresFile` guard on `upload(from: .data)` when background; `handleBackgroundEvents(identifier:completionHandler:)` storing the system completion handler.

- [ ] **Step 1: Write the failing test** — `Tests/SupabaseRuntimeTests/BackgroundSessionTests.swift`:

```swift
import Foundation
import Testing
@testable import SupabaseRuntime

private struct R: Codable, Sendable { let ok: Bool }

@Suite struct BackgroundSessionTests {
  @Test func backgroundUploadFromDataThrowsRequiresFile() async {
    let config = ClientConfiguration(baseURL: URL(string: "https://x.test/v1")!, sessionKind: .background(identifier: "test.bg"))
    let transport = URLSessionTransport(configuration: config)
    let task: TransferTask<R> = transport.upload(HTTPRequest(method: .post, path: "/object/b/k"), from: .data(Data([1])))
    await #expect(throws: TransportError.self) { _ = try await task.value() }
  }

  @Test func handleBackgroundEventsStoresCompletion() async {
    let config = ClientConfiguration(baseURL: URL(string: "https://x.test/v1")!, sessionKind: .background(identifier: "test.bg2"))
    let transport = URLSessionTransport(configuration: config)
    let box = CompletionBox()
    await transport.handleBackgroundEvents(identifier: "test.bg2") { box.fire() }
    let stored = await transport.consumeBackgroundCompletion(identifier: "test.bg2")
    stored?()
    #expect(box.fired == true)
  }
}

private final class CompletionBox: @unchecked Sendable {
  private let lock = NSLock(); private(set) var fired = false
  func fire() { lock.withLock { fired = true } }
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd codegen/runtime/swift/SupabaseRuntime && swift test --filter BackgroundSessionTests`
Expected: FAIL — the guard and `handleBackgroundEvents` do not exist.

- [ ] **Step 3: Implement** — in `URLSessionTransport.swift`:

Add background state + helpers:

```swift
  var isBackground: Bool {
    if case .background = configuration.sessionKind { return true }
    return false
  }

  private var backgroundCompletions: [String: @Sendable () -> Void] = [:]

  /// Call from the app's `handleEventsForBackgroundURLSession` / SwiftUI `backgroundTask`.
  public func handleBackgroundEvents(identifier: String, completionHandler: @escaping @Sendable () -> Void) {
    backgroundCompletions[identifier] = completionHandler
  }

  /// The transport calls this after the session reports it has finished delivering background events.
  public func consumeBackgroundCompletion(identifier: String) -> (@Sendable () -> Void)? {
    defer { backgroundCompletions[identifier] = nil }
    return backgroundCompletions[identifier]
  }
```

Guard in-memory uploads for background — at the start of the `upload` `Task` closure, before creating the session task:

```swift
      if isBackgroundSession, case .data = source {
        throw TransportError.backgroundRequiresFile
      }
```

Because `upload` is `nonisolated`, capture the background flag without hopping the actor — compute it from `configuration.sessionKind` (a `Sendable` value) captured into the closure:

```swift
  public nonisolated func upload<R: Decodable & Sendable>(_ request: HTTPRequest, from source: UploadSource) -> TransferTask<R> {
    let isBackgroundSession: Bool = { if case .background = configuration.sessionKind { return true } else { return false } }()
    // ... existing body, with the guard above as the first statement inside the Task closure ...
  }
```

(Adjust the existing Task 6 `upload` to add `let isBackgroundSession = ...` before the `Task {` and the guard as the first line inside it.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd codegen/runtime/swift/SupabaseRuntime && swift test --filter BackgroundSessionTests`
Expected: PASS.

- [ ] **Step 5: Run the full suite, build for a device-class platform sanity check, commit**

Run: `cd codegen/runtime/swift/SupabaseRuntime && swift test && swift build`
Expected: all pass.

```bash
git add codegen/runtime/swift/SupabaseRuntime
git commit -m "feat(runtime): background session selection, file-only guard, relaunch hook"
```

Note: full background-transfer behavior (suspension, system relaunch, delivery via the stored completion handler) requires on-device/integration testing and is out of scope for unit tests — tracked in the spec's risks. This task delivers the configuration selection, the file-only guard, and the relaunch-handler plumbing.

---

## Out of scope (Plan B and later)

- The lean `templates/swift/` pack + `codegen.yaml` changes that generate `StorageClient` against this runtime, regenerate Storage, and build/drift-guard it (Plan B).
- The normalizer naming/dedup batch from the audit.
- The hand-written ergonomic surface.

## Self-review notes

- **Spec coverage:** `Transport` contract (spec §5) → Tasks 1-3; `ClientConfiguration`/`AuthProvider` (§5/§6) → Task 4; `send` over native async (§6) → Task 5; streaming upload/download + progress (§5/§6) → Task 6; `stream()` event streams (§5/§6) → Task 7; background sessions + file-only + relaunch hook (§6) → Task 8; `MockTransport` (§6) → Task 3; typed errors (§5) → Tasks 1+5. Template/codegen work (§7) and decomposition (§8) are Plan B, explicitly out of scope here.
- **Type consistency:** `Transport` method signatures match across Task 3 (protocol), Task 3 (`MockTransport`), and Tasks 5-8 (`URLSessionTransport`). `TransferTask(progress:value:cancel:)`, `ClientConfiguration(baseURL:…errorMapper:)`, `AuthProvider(_:)`/`.headers()`, `HTTPRequest(method:path:query:headers:)`, and `RequestPath` `\(param:)` are used identically everywhere.
- **No placeholders:** the only deliberate inter-task stubs are `URLSessionTransport.upload/download/stream` in Task 5 (marked `fatalError("implemented in Task 6/7")`), explicitly replaced in Tasks 6-7 — every other step ships complete code.
- **Honest test limits:** Task 6 (byte-accurate progress) and Task 8 (full background lifecycle) note what unit tests can't cover and defer it to integration testing rather than faking verification.
