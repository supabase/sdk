# Changelog

## [1.1.1](https://github.com/supabase/sdk/compare/v1.1.0...v1.1.1) (2026-08-18)


### Bug Fixes

* **ci:** read the capability spec at the caller's pinned workflow ref ([#87](https://github.com/supabase/sdk/issues/87)) ([f51a1ec](https://github.com/supabase/sdk/commit/f51a1ec2dbfdd3e91a6cb86ba749bbb2ff61b8cf))

## [1.1.0](https://github.com/supabase/sdk/compare/v1.0.0...v1.1.0) (2026-08-14)


### Features

* add six capabilities the registry was missing ([#78](https://github.com/supabase/sdk/issues/78)) ([81bb9c7](https://github.com/supabase/sdk/commit/81bb9c7744b743c7559815034ac0bb59b7d76488))

## [1.0.0](https://github.com/supabase/sdk/compare/v1.0.0...v1.0.0) (2026-08-12)


### ⚠ BREAKING CHANGES

* reconcile capability matrix inconsistencies from skill audit ([#74](https://github.com/supabase/sdk/issues/74))

### Features

* add capabilities based on supabase-js public methods ([#19](https://github.com/supabase/sdk/issues/19)) ([8b07e38](https://github.com/supabase/sdk/commit/8b07e3892d9cfe519b3f59bfaa556d5168cb5f46))
* add capability-matrix maintenance skill ([#73](https://github.com/supabase/sdk/issues/73)) ([070e2c9](https://github.com/supabase/sdk/commit/070e2c9dc6bce0627ec36c27906d6494fb10d5b0))
* add review-spec and review-spec-compliance skills ([#6](https://github.com/supabase/sdk/issues/6)) ([b2646c1](https://github.com/supabase/sdk/commit/b2646c11aec03a47d47e7aa2d4127e3d18bc3c20))
* add SDK implementation status matrix to README and skill ([#4](https://github.com/supabase/sdk/issues/4)) ([753f06c](https://github.com/supabase/sdk/commit/753f06c32e40007adf279bafa3f0f5eb8aaac269))
* **api-check:** include file path and line number in compliance failure messages ([#45](https://github.com/supabase/sdk/issues/45)) ([2f4be47](https://github.com/supabase/sdk/commit/2f4be474a338848d2c3776b3129e090279c9993e))
* **auth:** add sign-out reason capability ([#47](https://github.com/supabase/sdk/issues/47)) ([51a3abd](https://github.com/supabase/sdk/commit/51a3abde3e3b87354e4d62150c40d2c9fe92bed5))
* canonical SDK capability matrix ([#8](https://github.com/supabase/sdk/issues/8)) ([215bc3e](https://github.com/supabase/sdk/commit/215bc3e900a05c15a478c2163f401ad07d267feb))
* **capability-matrix:** strict cross-SDK parity score + coverage scope ([#63](https://github.com/supabase/sdk/issues/63)) ([de1abe1](https://github.com/supabase/sdk/commit/de1abe1eac670ac9d7f20be2834fdb2fd6e489b5))
* CI check 1 — block PRs adding public API not in capability matrix ([#31](https://github.com/supabase/sdk/issues/31)) ([293440c](https://github.com/supabase/sdk/commit/293440c6a0cf61b3ab6401c0e5ad1b3502e47018))
* **compliance:** list undeclared features after validation ([#48](https://github.com/supabase/sdk/issues/48)) ([29f396a](https://github.com/supabase/sdk/commit/29f396aed78243df83f1e5ff1ff0cbe105edbd6a))
* **compliance:** list undeclared features as notes after validation ([29f396a](https://github.com/supabase/sdk/commit/29f396aed78243df83f1e5ff1ff0cbe105edbd6a))
* **compliance:** split symbol evidence from symbol coverage ([#75](https://github.com/supabase/sdk/issues/75)) ([abc8e71](https://github.com/supabase/sdk/commit/abc8e71e0e3a18f6f91e8e5b2909a0a053cf6137))
* initial SDK specs, skills, and install script ([e662b17](https://github.com/supabase/sdk/commit/e662b1740b72eba1441701762bfdc7f49732d4e6))
* move SDK compliance to per-repo files ([#15](https://github.com/supabase/sdk/issues/15)) ([4d32675](https://github.com/supabase/sdk/commit/4d32675b2a229cc8f656c9a30a82e1e15773b7d3))
* **parsers:** add Dart public API parser via package:analyzer (alternative to [#35](https://github.com/supabase/sdk/issues/35)) ([#41](https://github.com/supabase/sdk/issues/41)) ([e3ba07a](https://github.com/supabase/sdk/commit/e3ba07a5cee9e7298315c9e1e8e486f3a3067a10))
* **parsers:** add griffe-based Python public API surface parser ([#36](https://github.com/supabase/sdk/issues/36)) ([c44f836](https://github.com/supabase/sdk/commit/c44f83634dd5f162eb82f5851d5fd4a1aaf9977c))
* **parsers:** replace Swift regex parser with swift-symbolgraph-extract ([#38](https://github.com/supabase/sdk/issues/38)) ([80529a7](https://github.com/supabase/sdk/commit/80529a78c8318405412b651409d7e4bc4483b523))
* **realtime:** add multiple postgres_changes filters capability ([#70](https://github.com/supabase/sdk/issues/70)) ([825ab0c](https://github.com/supabase/sdk/commit/825ab0c54f7ae06b8288f58e54d9323514d7a283))
* reconcile capability matrix inconsistencies from skill audit ([#74](https://github.com/supabase/sdk/issues/74)) ([9c53a70](https://github.com/supabase/sdk/commit/9c53a702fe296a6c8fcf8af87f92cc042ebce5c5))
* rename sdk-parse-ignore to .sdk-parse-ignore ([#37](https://github.com/supabase/sdk/issues/37)) ([4f4ab61](https://github.com/supabase/sdk/commit/4f4ab6144479ef76d8ca68613e5d5bef2adeaf46))
* render symbol names as clickable links in capability matrix ([#14](https://github.com/supabase/sdk/issues/14)) ([dcaf122](https://github.com/supabase/sdk/commit/dcaf122cf037665486ac2e4b948ab25b594f1a7a))
* show feature description as visible sub-text in capability matrix ([#13](https://github.com/supabase/sdk/issues/13)) ([3a750ab](https://github.com/supabase/sdk/commit/3a750ab8c897b7f6508bed4634e5e106f6ec13b3))
* **site:** serve compliance.json with precomputed parity from GitHub Pages ([#46](https://github.com/supabase/sdk/issues/46)) ([0d9106c](https://github.com/supabase/sdk/commit/0d9106c05138ffb8144c474c212c33edfa7269cc))
* **storage:** add purge_cache and purge_bucket_cache canonical capabilities ([#44](https://github.com/supabase/sdk/issues/44)) ([9a6f864](https://github.com/supabase/sdk/commit/9a6f864e56035ebadb633bc475841e4c2c8757cb))
* **storage:** add storage.errors.error_codes capability ([#71](https://github.com/supabase/sdk/issues/71)) ([fabb9a7](https://github.com/supabase/sdk/commit/fabb9a775719ca7043350d70a556cc7858733e0b))
* **storage:** add the five missing Iceberg catalog capabilities ([#76](https://github.com/supabase/sdk/issues/76)) ([c3c8f9e](https://github.com/supabase/sdk/commit/c3c8f9ec6c11a91d7cee2aafb3173eba0c5e52c4))


### Bug Fixes

* **aggregate:** point csharp and go SDKs at correct repo slugs ([#62](https://github.com/supabase/sdk/issues/62)) ([8b7320f](https://github.com/supabase/sdk/commit/8b7320fa167cb8a0d497b56282590861bae50b12))
* **aggregate:** point kotlin SDK at supabase-community/supabase-kt ([#61](https://github.com/supabase/sdk/issues/61)) ([b1a99e9](https://github.com/supabase/sdk/commit/b1a99e9a2459e46c8cbbb6b2c86ba975cd32336c))
* **capability-matrix:** correct coverage scope metric description ([#64](https://github.com/supabase/sdk/issues/64)) ([5daeaf5](https://github.com/supabase/sdk/commit/5daeaf56032fe5dc9c11f7084bfbb24912be12df))
* **ci:** repair python pipeline and simplify sdk-compliance workflow ([#42](https://github.com/supabase/sdk/issues/42)) ([2140f44](https://github.com/supabase/sdk/commit/2140f44a6fb52c9afbb78af953750fec512e7e60))
* **ci:** use nx to run docs:json so workspace deps are built first ([#56](https://github.com/supabase/sdk/issues/56)) ([9b449bb](https://github.com/supabase/sdk/commit/9b449bb928759084e4027cb03ba5345bb8a4f192))
* **dart-extractor:** exclude [@internal-annotated](https://github.com/internal-annotated) symbols from the public API surface ([9bd358e](https://github.com/supabase/sdk/commit/9bd358ec7f49ff5fc1365ac4eda28d6bc8daa49f))
* **dart-extractor:** exclude [@internal](https://github.com/internal) symbols from the public API surface ([#54](https://github.com/supabase/sdk/issues/54)) ([9bd358e](https://github.com/supabase/sdk/commit/9bd358ec7f49ff5fc1365ac4eda28d6bc8daa49f))
* remove broken sticky thead, add scroll-margin-top and group-row borders ([#10](https://github.com/supabase/sdk/issues/10)) ([68761cd](https://github.com/supabase/sdk/commit/68761cd20b38e36083b9ac56daca9a38fe4e7756))
