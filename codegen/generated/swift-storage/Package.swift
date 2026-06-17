// swift-tools-version:6.0

import PackageDescription

let package = Package(
    name: "SupabaseStorage",
    platforms: [
        .iOS(.v13),
        .macOS(.v10_15),
        .tvOS(.v13),
        .watchOS(.v6),
    ],
    products: [
        // Products define the executables and libraries produced by a package, and make them visible to other packages.
        .library(
            name: "SupabaseStorage",
            targets: ["SupabaseStorage"]
        ),
    ],
    dependencies: [
        // Dependencies declare other packages that this package depends on.
    ],
    targets: [
        // Targets are the basic building blocks of a package. A target can define a module or a test suite.
        // Targets can depend on other targets in this package, and on products in packages which this package depends on.
        .target(
            name: "SupabaseStorage",
            dependencies: [],
            path: "Sources/SupabaseStorage"
        ),
    ],
    swiftLanguageModes: [.v6]
)
