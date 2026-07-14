import Testing
@testable import SupabaseRuntime

@Suite struct HTTPMethodTests {
  @Test func rawValuesAreUppercase() {
    #expect(HTTPMethod.get.rawValue == "GET")
    #expect(HTTPMethod.delete.rawValue == "DELETE")
  }
}
