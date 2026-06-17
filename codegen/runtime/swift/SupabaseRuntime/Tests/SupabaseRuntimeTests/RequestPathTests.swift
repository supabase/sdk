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
