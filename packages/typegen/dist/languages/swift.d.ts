import type { TypegenLanguage } from "../contract.ts";
export interface SwiftDependencies {
    readonly platform: string;
    readonly arch: string;
    readonly fetch: (url: string, init?: RequestInit) => Promise<Response>;
}
/**
 * Swift runs `supabase-typegen` from supabase-swift, which reads the document
 * on stdin and writes one file of `@Table` structs to stdout.
 *
 * The generated code targets the `@Table` macro of one supabase-swift
 * version, so the binary must come from the same release as the project's
 * dependency. The entry reads that version from the nearest
 * `Package.resolved` (SwiftPM, or Xcode's copy inside the `.xcodeproj` or
 * `.xcworkspace`), downloads the release's binary once into the user's cache
 * and runs it. Without a version pin, or on a platform with no release asset,
 * it runs `supabase-typegen` from PATH. `SUPABASE_TYPEGEN` overrides both.
 *
 * It is a binary, not a package dependency, because its swift-format
 * dependency would pin every app's swift-syntax, and because an Xcode project
 * without a `Package.swift` has nothing to `swift run` from. No `--schema` is
 * passed: the document already holds exactly the schemas the consumer
 * introspected, and the tool generates all of them.
 */
export declare function createSwift(dependencies?: SwiftDependencies): TypegenLanguage;
export declare const swift: TypegenLanguage;
