// swift-tools-version:6.0
import PackageDescription

// A small package with one of everything the Swift adapter has to handle.
// Its symbol graphs are checked in under ../symbol-graphs, so the tests need
// no Swift toolchain. Run `bun run refresh-fixtures` after changing it.
let package = Package(
  name: "Notes",
  platforms: [.macOS(.v14)],
  products: [
    .library(name: "NotesKit", targets: ["NotesKit"])
  ],
  targets: [
    .target(name: "Notes"),
    .target(name: "NotesKit", dependencies: ["Notes"]),
  ]
)
