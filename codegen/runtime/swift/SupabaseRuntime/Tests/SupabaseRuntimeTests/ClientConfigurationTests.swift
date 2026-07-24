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

  @Test func noneAuthProviderIsEmpty() async throws {
    let headers = try await AuthProvider.none.headers()
    #expect(headers.isEmpty)
  }

  @Test func configHoldsBaseURLAndDefaults() {
    let config = ClientConfiguration(baseURL: URL(string: "https://x.supabase.co/storage/v1")!)
    #expect(config.baseURL.absoluteString == "https://x.supabase.co/storage/v1")
    #expect(config.sessionKind == .foreground)
  }
}
