import "@typespec/http";
import "@typespec/openapi";

using TypeSpec.Http;
using TypeSpec.OpenAPI;

@service
@info({
  title: "Supabase Storage API",
  version: "1.0",
})
@server("{baseUrl}", "Supabase Storage endpoint", {
  baseUrl: string,
})
namespace Supabase.Storage;

// ─── Common ────────────────────────────────────────────────────────────────

alias StringList = string[];

// ─── Shared Shapes ─────────────────────────────────────────────────────────

model Bucket {
  id: string;
  name: string;
  @encodedName("application/json", "public") isPublic: boolean;
  file_size_limit?: int64;
  allowed_mime_types?: StringList;
  created_at?: string;
  updated_at?: string;
}

model FileObject {
  name: string;
  id?: string;
  updated_at?: string;
  created_at?: string;
  last_accessed_at?: string;
  metadata?: FileMetadata;
}

model FileMetadata {
  eTag?: string;
  size?: int64;
  mimetype?: string;
  cacheControl?: string;
  lastModified?: string;
  contentLength?: int64;
  httpStatusCode?: int32;
}

model FileInfo {
  eTag?: string;
  size?: int64;
  mimetype?: string;
  cacheControl?: string;
  lastModified?: string;
  contentLength?: int64;
  httpStatusCode?: int32;
}

model SortBy {
  column?: string;
  order?: string;
}

@error
model StorageError {
  message?: string;
  error?: string;
  statusCode?: string;
}

// ─── Bucket Operations ─────────────────────────────────────────────────────

model CreateBucketInput {
  id: string;
  name: string;
  @encodedName("application/json", "public") isPublic: boolean;
  file_size_limit?: int64;
  allowed_mime_types?: StringList;
}

model UpdateBucketInput {
  @encodedName("application/json", "public") isPublic: boolean;
  file_size_limit?: int64;
  allowed_mime_types?: StringList;
}

@route("/bucket")
interface Buckets {
  @get
  list(): Bucket[] | StorageError;

  @get
  @route("/{id}")
  get(@path id: string): Bucket | StorageError;

  @post
  create(@body body: CreateBucketInput): void | StorageError;

  @put
  @route("/{id}")
  update(@path id: string, @body body: UpdateBucketInput): void | StorageError;

  @post
  @route("/{id}/empty")
  empty(@path id: string): void | StorageError;

  @delete
  @route("/{id}")
  deleteBucket(@path id: string): void | StorageError;
}

// ─── Object Operations ─────────────────────────────────────────────────────

model MoveObjectInput {
  bucketId: string;
  sourceKey: string;
  destinationKey: string;
  destinationBucket?: string;
}

model CopyObjectInput {
  bucketId: string;
  sourceKey: string;
  destinationKey: string;
  destinationBucket?: string;
}

model CopyObjectOutput {
  Key: string;
}

model ListObjectsInput {
  prefix: string;
  limit?: int32;
  offset?: int32;
  sortBy?: SortBy;
}

model CreateSignedUrlInput {
  expiresIn: int32;
}

model CreateSignedUrlOutput {
  signedURL: string;
}

model CreateSignedUrlsInput {
  expiresIn: int32;
  paths: StringList;
}

model SignedUrlResult {
  signedURL?: string;
  path: string;
  error?: string;
}

model CreateSignedUploadUrlOutput {
  url: string;
}

@route("/object")
interface Objects {
  @post
  @route("/move")
  move(@body body: MoveObjectInput): void | StorageError;

  @post
  @route("/copy")
  copy(@body body: CopyObjectInput): CopyObjectOutput | StorageError;

  // DELETE with a body — TypeSpec doesn't flag this but it's unconventional.
  // Matches Smithy's @suppress(["HttpMethodSemantics.UnexpectedPayload"]).
  @delete
  @route("/{bucketId}")
  deleteObjects(
    @path bucketId: string,
    @body body: {prefixes: StringList},
  ): FileObject[] | StorageError;

  @post
  @route("/list/{bucketId}")
  list(
    @path bucketId: string,
    @body body: ListObjectsInput,
  ): FileObject[] | StorageError;

  @get
  @route("/info/{bucketId}/{+wildcardPath}")
  info(
    @path bucketId: string,
    @path wildcardPath: string,
  ): FileInfo | StorageError;

  @head
  @route("/{bucketId}/{+wildcardPath}")
  head(
    @path bucketId: string,
    @path wildcardPath: string,
  ): void | StorageError;

  @post
  @route("/sign/{bucketId}/{+wildcardPath}")
  createSignedUrl(
    @path bucketId: string,
    @path wildcardPath: string,
    @body body: CreateSignedUrlInput,
  ): CreateSignedUrlOutput | StorageError;

  @post
  @route("/sign/{bucketId}")
  createSignedUrls(
    @path bucketId: string,
    @body body: CreateSignedUrlsInput,
  ): SignedUrlResult[] | StorageError;

  @post
  @route("/upload/sign/{bucketId}/{+wildcardPath}")
  createSignedUploadUrl(
    @path bucketId: string,
    @path wildcardPath: string,
    @header("x-upsert") upsert?: string,
  ): CreateSignedUploadUrlOutput | StorageError;
}

// ─── TUS Resumable Upload Operations ───────────────────────────────────────
//
// Models the three HTTP operations of the TUS 1.0.0 protocol.  The
// application-level state machine (chunk sequencing, 409 retry, pause/resume)
// is NOT generated — it lives in TUSUploadEngine, which calls these operations.

model TusCreatedResponse {
  @statusCode statusCode: 201;
  @header location: string;
}

model UploadChunkOutput {
  @statusCode statusCode: 204;
  @header("Upload-Offset") uploadOffset: int64;
}

model GetUploadOffsetOutput {
  @header("Upload-Offset") uploadOffset: int64;
}

@route("/upload/resumable")
interface TusUploads {
  // Step 1: Create a new TUS upload session.
  @post
  create(
    @header("Upload-Length") uploadLength: int64,
    @header("Upload-Metadata") uploadMetadata: string,
    @header("Tus-Resumable") tusResumable: string,
    @header("x-upsert") upsert?: string,
  ): TusCreatedResponse | StorageError;

  // Step 2: Upload a chunk of data to an existing TUS session.
  // Explicit content-type forces application/octet-stream + format: binary in OpenAPI
  // (TypeSpec defaults bytes to application/json + format: byte without it).
  @patch
  @route("/{uploadId}")
  uploadChunk(
    @path uploadId: string,
    @header("Upload-Offset") uploadOffset: int64,
    @header("Tus-Resumable") tusResumable: string,
    @header contentType: "application/octet-stream",
    @body body: bytes,
  ): UploadChunkOutput | StorageError;

  // Step 3: Query the server-side offset of a TUS session (used when resuming).
  @head
  @route("/{uploadId}")
  getOffset(
    @path uploadId: string,
    @header("Tus-Resumable") tusResumable: string,
  ): GetUploadOffsetOutput | StorageError;
}
