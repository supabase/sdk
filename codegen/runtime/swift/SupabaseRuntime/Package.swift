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
