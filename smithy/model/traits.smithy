$version: "2"

namespace io.supabase.traits

/// Marks an operation input structure as using multipart/form-data encoding.
///
/// The Smithy OpenAPI converter has no native multipart/form-data support;
/// this trait signals the MultipartFormOpenApiMapper plugin (smithy/extensions/)
/// to emit the correct "multipart/form-data" requestBody schema for the operation.
/// Without the plugin the operation is generated with no request body — the plugin
/// is a required build-time dependency for correct OpenAPI output.
///
/// Usage:
///   @httpMultipartForm(fields: [
///     {name: "file",         fieldType: "binary", required: true},
///     {name: "cacheControl", fieldType: "string", required: false},
///     {name: "metadata",     fieldType: "object", required: false}
///   ])
///   structure MyOperationInput { ... }
@trait(selector: "structure")
structure httpMultipartForm {
  fields: MultipartFieldList
}

list MultipartFieldList {
  member: MultipartField
}

structure MultipartField {
  /// Name of the form field as it appears on the wire.
  @required
  name: String

  /// JSON Schema type for this field. One of: "string", "binary", "object".
  /// "binary" emits format: binary (file upload). "object" emits type: object.
  @required
  fieldType: MultipartFieldType

  /// Whether this field is required in the multipart body.
  required: Boolean
}

enum MultipartFieldType {
  STRING = "string"
  BINARY = "binary"
  OBJECT = "object"
}
