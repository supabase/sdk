# IcebergAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**deleteIcebergV1ByPrefixNamespacesByNamespace**](IcebergAPI.md#deleteicebergv1byprefixnamespacesbynamespace) | **DELETE** /iceberg/v1/{prefix}/namespaces/{namespace} | Drop a namespace
[**deleteIcebergV1ByPrefixNamespacesByNamespaceTablesByTable**](IcebergAPI.md#deleteicebergv1byprefixnamespacesbynamespacetablesbytable) | **DELETE** /iceberg/v1/{prefix}/namespaces/{namespace}/tables/{table} | Drop a Table
[**getIcebergV1ByPrefixNamespaces**](IcebergAPI.md#geticebergv1byprefixnamespaces) | **GET** /iceberg/v1/{prefix}/namespaces | List namespaces
[**getIcebergV1ByPrefixNamespacesByNamespace**](IcebergAPI.md#geticebergv1byprefixnamespacesbynamespace) | **GET** /iceberg/v1/{prefix}/namespaces/{namespace} | Load a namespace
[**getIcebergV1ByPrefixNamespacesByNamespaceTables**](IcebergAPI.md#geticebergv1byprefixnamespacesbynamespacetables) | **GET** /iceberg/v1/{prefix}/namespaces/{namespace}/tables | Create a table
[**getIcebergV1ByPrefixNamespacesByNamespaceTablesByTable**](IcebergAPI.md#geticebergv1byprefixnamespacesbynamespacetablesbytable) | **GET** /iceberg/v1/{prefix}/namespaces/{namespace}/tables/{table} | Load an Iceberg Table
[**getIcebergV1Config**](IcebergAPI.md#geticebergv1config) | **GET** /iceberg/v1/config | Get Iceberg catalog configuration
[**headIcebergV1ByPrefixNamespaces**](IcebergAPI.md#headicebergv1byprefixnamespaces) | **HEAD** /iceberg/v1/{prefix}/namespaces | List namespaces
[**headIcebergV1ByPrefixNamespacesByNamespace**](IcebergAPI.md#headicebergv1byprefixnamespacesbynamespace) | **HEAD** /iceberg/v1/{prefix}/namespaces/{namespace} | Load a namespace
[**headIcebergV1ByPrefixNamespacesByNamespaceTables**](IcebergAPI.md#headicebergv1byprefixnamespacesbynamespacetables) | **HEAD** /iceberg/v1/{prefix}/namespaces/{namespace}/tables | Create a table
[**headIcebergV1ByPrefixNamespacesByNamespaceTablesByTable**](IcebergAPI.md#headicebergv1byprefixnamespacesbynamespacetablesbytable) | **HEAD** /iceberg/v1/{prefix}/namespaces/{namespace}/tables/{table} | Load an Iceberg Table
[**headIcebergV1Config**](IcebergAPI.md#headicebergv1config) | **HEAD** /iceberg/v1/config | Get Iceberg catalog configuration
[**postIcebergV1ByPrefixNamespaces**](IcebergAPI.md#posticebergv1byprefixnamespaces) | **POST** /iceberg/v1/{prefix}/namespaces | Create a namespace
[**postIcebergV1ByPrefixNamespacesByNamespaceTables**](IcebergAPI.md#posticebergv1byprefixnamespacesbynamespacetables) | **POST** /iceberg/v1/{prefix}/namespaces/{namespace}/tables | Create a table in the given namespace
[**postIcebergV1ByPrefixNamespacesByNamespaceTablesByTable**](IcebergAPI.md#posticebergv1byprefixnamespacesbynamespacetablesbytable) | **POST** /iceberg/v1/{prefix}/namespaces/{namespace}/tables/{table} | Commit updates to multiple tables in an atomic operation


# **deleteIcebergV1ByPrefixNamespacesByNamespace**
```swift
    internal class func deleteIcebergV1ByPrefixNamespacesByNamespace(_prefix: String, namespace: String, completion: @escaping (_ data: Void?, _ error: Error?) -> Void)
```

Drop a namespace

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import SupabaseStorage

let _prefix = "_prefix_example" // String | 
let namespace = "namespace_example" // String | 

// Drop a namespace
IcebergAPI.deleteIcebergV1ByPrefixNamespacesByNamespace(_prefix: _prefix, namespace: namespace) { (response, error) in
    guard error == nil else {
        print(error)
        return
    }

    if (response) {
        dump(response)
    }
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **_prefix** | **String** |  | 
 **namespace** | **String** |  | 

### Return type

Void (empty response body)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **deleteIcebergV1ByPrefixNamespacesByNamespaceTablesByTable**
```swift
    internal class func deleteIcebergV1ByPrefixNamespacesByNamespaceTablesByTable(_prefix: String, namespace: String, table: String, purgeRequested: PurgeRequested_deleteIcebergV1ByPrefixNamespacesByNamespaceTablesByTable? = nil, completion: @escaping (_ data: Void?, _ error: Error?) -> Void)
```

Drop a Table

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import SupabaseStorage

let _prefix = "_prefix_example" // String | 
let namespace = "namespace_example" // String | 
let table = "table_example" // String | 
let purgeRequested = "purgeRequested_example" // String | If true, the table will be permanently deleted (optional) (default to ._false)

// Drop a Table
IcebergAPI.deleteIcebergV1ByPrefixNamespacesByNamespaceTablesByTable(_prefix: _prefix, namespace: namespace, table: table, purgeRequested: purgeRequested) { (response, error) in
    guard error == nil else {
        print(error)
        return
    }

    if (response) {
        dump(response)
    }
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **_prefix** | **String** |  | 
 **namespace** | **String** |  | 
 **table** | **String** |  | 
 **purgeRequested** | **String** | If true, the table will be permanently deleted | [optional] [default to ._false]

### Return type

Void (empty response body)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getIcebergV1ByPrefixNamespaces**
```swift
    internal class func getIcebergV1ByPrefixNamespaces(_prefix: String, pageToken: String? = nil, pageSize: Double? = nil, parent: String? = nil, completion: @escaping (_ data: Void?, _ error: Error?) -> Void)
```

List namespaces

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import SupabaseStorage

let _prefix = "_prefix_example" // String | 
let pageToken = "pageToken_example" // String |  (optional)
let pageSize = 987 // Double |  (optional)
let parent = "parent_example" // String |  (optional)

// List namespaces
IcebergAPI.getIcebergV1ByPrefixNamespaces(_prefix: _prefix, pageToken: pageToken, pageSize: pageSize, parent: parent) { (response, error) in
    guard error == nil else {
        print(error)
        return
    }

    if (response) {
        dump(response)
    }
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **_prefix** | **String** |  | 
 **pageToken** | **String** |  | [optional] 
 **pageSize** | **Double** |  | [optional] 
 **parent** | **String** |  | [optional] 

### Return type

Void (empty response body)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getIcebergV1ByPrefixNamespacesByNamespace**
```swift
    internal class func getIcebergV1ByPrefixNamespacesByNamespace(_prefix: String, namespace: String, completion: @escaping (_ data: Void?, _ error: Error?) -> Void)
```

Load a namespace

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import SupabaseStorage

let _prefix = "_prefix_example" // String | 
let namespace = "namespace_example" // String | 

// Load a namespace
IcebergAPI.getIcebergV1ByPrefixNamespacesByNamespace(_prefix: _prefix, namespace: namespace) { (response, error) in
    guard error == nil else {
        print(error)
        return
    }

    if (response) {
        dump(response)
    }
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **_prefix** | **String** |  | 
 **namespace** | **String** |  | 

### Return type

Void (empty response body)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getIcebergV1ByPrefixNamespacesByNamespaceTables**
```swift
    internal class func getIcebergV1ByPrefixNamespacesByNamespaceTables(_prefix: String, namespace: String, pageToken: String? = nil, pageSize: Double? = nil, parent: String? = nil, completion: @escaping (_ data: [String: JSONValue]?, _ error: Error?) -> Void)
```

Create a table

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import SupabaseStorage

let _prefix = "_prefix_example" // String | 
let namespace = "namespace_example" // String | 
let pageToken = "pageToken_example" // String |  (optional)
let pageSize = 987 // Double |  (optional)
let parent = "parent_example" // String |  (optional)

// Create a table
IcebergAPI.getIcebergV1ByPrefixNamespacesByNamespaceTables(_prefix: _prefix, namespace: namespace, pageToken: pageToken, pageSize: pageSize, parent: parent) { (response, error) in
    guard error == nil else {
        print(error)
        return
    }

    if (response) {
        dump(response)
    }
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **_prefix** | **String** |  | 
 **namespace** | **String** |  | 
 **pageToken** | **String** |  | [optional] 
 **pageSize** | **Double** |  | [optional] 
 **parent** | **String** |  | [optional] 

### Return type

**[String: JSONValue]**

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getIcebergV1ByPrefixNamespacesByNamespaceTablesByTable**
```swift
    internal class func getIcebergV1ByPrefixNamespacesByNamespaceTablesByTable(_prefix: String, namespace: String, table: String, completion: @escaping (_ data: [String: JSONValue]?, _ error: Error?) -> Void)
```

Load an Iceberg Table

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import SupabaseStorage

let _prefix = "_prefix_example" // String | 
let namespace = "namespace_example" // String | 
let table = "table_example" // String | 

// Load an Iceberg Table
IcebergAPI.getIcebergV1ByPrefixNamespacesByNamespaceTablesByTable(_prefix: _prefix, namespace: namespace, table: table) { (response, error) in
    guard error == nil else {
        print(error)
        return
    }

    if (response) {
        dump(response)
    }
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **_prefix** | **String** |  | 
 **namespace** | **String** |  | 
 **table** | **String** |  | 

### Return type

**[String: JSONValue]**

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getIcebergV1Config**
```swift
    internal class func getIcebergV1Config(warehouse: String, completion: @escaping (_ data: Void?, _ error: Error?) -> Void)
```

Get Iceberg catalog configuration

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import SupabaseStorage

let warehouse = "warehouse_example" // String | 

// Get Iceberg catalog configuration
IcebergAPI.getIcebergV1Config(warehouse: warehouse) { (response, error) in
    guard error == nil else {
        print(error)
        return
    }

    if (response) {
        dump(response)
    }
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **warehouse** | **String** |  | 

### Return type

Void (empty response body)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **headIcebergV1ByPrefixNamespaces**
```swift
    internal class func headIcebergV1ByPrefixNamespaces(_prefix: String, pageToken: String? = nil, pageSize: Double? = nil, parent: String? = nil, completion: @escaping (_ data: Void?, _ error: Error?) -> Void)
```

List namespaces

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import SupabaseStorage

let _prefix = "_prefix_example" // String | 
let pageToken = "pageToken_example" // String |  (optional)
let pageSize = 987 // Double |  (optional)
let parent = "parent_example" // String |  (optional)

// List namespaces
IcebergAPI.headIcebergV1ByPrefixNamespaces(_prefix: _prefix, pageToken: pageToken, pageSize: pageSize, parent: parent) { (response, error) in
    guard error == nil else {
        print(error)
        return
    }

    if (response) {
        dump(response)
    }
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **_prefix** | **String** |  | 
 **pageToken** | **String** |  | [optional] 
 **pageSize** | **Double** |  | [optional] 
 **parent** | **String** |  | [optional] 

### Return type

Void (empty response body)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **headIcebergV1ByPrefixNamespacesByNamespace**
```swift
    internal class func headIcebergV1ByPrefixNamespacesByNamespace(_prefix: String, namespace: String, completion: @escaping (_ data: Void?, _ error: Error?) -> Void)
```

Load a namespace

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import SupabaseStorage

let _prefix = "_prefix_example" // String | 
let namespace = "namespace_example" // String | 

// Load a namespace
IcebergAPI.headIcebergV1ByPrefixNamespacesByNamespace(_prefix: _prefix, namespace: namespace) { (response, error) in
    guard error == nil else {
        print(error)
        return
    }

    if (response) {
        dump(response)
    }
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **_prefix** | **String** |  | 
 **namespace** | **String** |  | 

### Return type

Void (empty response body)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **headIcebergV1ByPrefixNamespacesByNamespaceTables**
```swift
    internal class func headIcebergV1ByPrefixNamespacesByNamespaceTables(_prefix: String, namespace: String, pageToken: String? = nil, pageSize: Double? = nil, parent: String? = nil, completion: @escaping (_ data: [String: JSONValue]?, _ error: Error?) -> Void)
```

Create a table

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import SupabaseStorage

let _prefix = "_prefix_example" // String | 
let namespace = "namespace_example" // String | 
let pageToken = "pageToken_example" // String |  (optional)
let pageSize = 987 // Double |  (optional)
let parent = "parent_example" // String |  (optional)

// Create a table
IcebergAPI.headIcebergV1ByPrefixNamespacesByNamespaceTables(_prefix: _prefix, namespace: namespace, pageToken: pageToken, pageSize: pageSize, parent: parent) { (response, error) in
    guard error == nil else {
        print(error)
        return
    }

    if (response) {
        dump(response)
    }
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **_prefix** | **String** |  | 
 **namespace** | **String** |  | 
 **pageToken** | **String** |  | [optional] 
 **pageSize** | **Double** |  | [optional] 
 **parent** | **String** |  | [optional] 

### Return type

**[String: JSONValue]**

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **headIcebergV1ByPrefixNamespacesByNamespaceTablesByTable**
```swift
    internal class func headIcebergV1ByPrefixNamespacesByNamespaceTablesByTable(_prefix: String, namespace: String, table: String, completion: @escaping (_ data: [String: JSONValue]?, _ error: Error?) -> Void)
```

Load an Iceberg Table

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import SupabaseStorage

let _prefix = "_prefix_example" // String | 
let namespace = "namespace_example" // String | 
let table = "table_example" // String | 

// Load an Iceberg Table
IcebergAPI.headIcebergV1ByPrefixNamespacesByNamespaceTablesByTable(_prefix: _prefix, namespace: namespace, table: table) { (response, error) in
    guard error == nil else {
        print(error)
        return
    }

    if (response) {
        dump(response)
    }
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **_prefix** | **String** |  | 
 **namespace** | **String** |  | 
 **table** | **String** |  | 

### Return type

**[String: JSONValue]**

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **headIcebergV1Config**
```swift
    internal class func headIcebergV1Config(warehouse: String, completion: @escaping (_ data: Void?, _ error: Error?) -> Void)
```

Get Iceberg catalog configuration

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import SupabaseStorage

let warehouse = "warehouse_example" // String | 

// Get Iceberg catalog configuration
IcebergAPI.headIcebergV1Config(warehouse: warehouse) { (response, error) in
    guard error == nil else {
        print(error)
        return
    }

    if (response) {
        dump(response)
    }
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **warehouse** | **String** |  | 

### Return type

Void (empty response body)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **postIcebergV1ByPrefixNamespaces**
```swift
    internal class func postIcebergV1ByPrefixNamespaces(_prefix: String, postIcebergV1ByPrefixNamespacesRequest: PostIcebergV1ByPrefixNamespacesRequest, completion: @escaping (_ data: Void?, _ error: Error?) -> Void)
```

Create a namespace

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import SupabaseStorage

let _prefix = "_prefix_example" // String | 
let postIcebergV1ByPrefixNamespacesRequest = postIcebergV1ByPrefixNamespaces_request(namespace: "namespace_example", properties: "TODO") // PostIcebergV1ByPrefixNamespacesRequest | 

// Create a namespace
IcebergAPI.postIcebergV1ByPrefixNamespaces(_prefix: _prefix, postIcebergV1ByPrefixNamespacesRequest: postIcebergV1ByPrefixNamespacesRequest) { (response, error) in
    guard error == nil else {
        print(error)
        return
    }

    if (response) {
        dump(response)
    }
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **_prefix** | **String** |  | 
 **postIcebergV1ByPrefixNamespacesRequest** | [**PostIcebergV1ByPrefixNamespacesRequest**](PostIcebergV1ByPrefixNamespacesRequest.md) |  | 

### Return type

Void (empty response body)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **postIcebergV1ByPrefixNamespacesByNamespaceTables**
```swift
    internal class func postIcebergV1ByPrefixNamespacesByNamespaceTables(_prefix: String, namespace: String, postIcebergV1ByPrefixNamespacesByNamespaceTablesRequest: PostIcebergV1ByPrefixNamespacesByNamespaceTablesRequest, completion: @escaping (_ data: [String: JSONValue]?, _ error: Error?) -> Void)
```

Create a table in the given namespace

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import SupabaseStorage

let _prefix = "_prefix_example" // String | 
let namespace = "namespace_example" // String | 
let postIcebergV1ByPrefixNamespacesByNamespaceTablesRequest = postIcebergV1ByPrefixNamespacesByNamespaceTables_request(name: "name_example", location: "location_example", schema: postIcebergV1ByPrefixNamespacesByNamespaceTables_request_schema(type: "type_example", fields: [postIcebergV1ByPrefixNamespacesByNamespaceTables_request_schema_allOf_fields_inner(id: 123, name: "name_example", type: postIcebergV1ByPrefixNamespacesByNamespaceTables_request_schema_allOf_fields_inner_type(type: "type_example", fields: [123], elementId: 123, element: 123, elementRequired: false, keyId: 123, key: 123, valueId: 123, value: 123, valueRequired: false), _required: false, doc: "doc_example")], schemaId: 123, identifierFieldIds: [123]), spec: postIcebergV1ByPrefixNamespacesByNamespaceTables_request_spec(specId: 123, fields: [postIcebergV1ByPrefixNamespacesByNamespaceTables_request_spec_fields_inner(fieldId: 123, sourceId: 123, name: "name_example", transform: "transform_example")]), properties: "TODO", stageCreate: false, writeOrder: postIcebergV1ByPrefixNamespacesByNamespaceTables_request_write_order(orderId: 123, fields: [postIcebergV1ByPrefixNamespacesByNamespaceTables_request_write_order_fields_inner(sourceId: 123, transform: "transform_example", direction: "direction_example", nullOrder: "nullOrder_example")])) // PostIcebergV1ByPrefixNamespacesByNamespaceTablesRequest | 

// Create a table in the given namespace
IcebergAPI.postIcebergV1ByPrefixNamespacesByNamespaceTables(_prefix: _prefix, namespace: namespace, postIcebergV1ByPrefixNamespacesByNamespaceTablesRequest: postIcebergV1ByPrefixNamespacesByNamespaceTablesRequest) { (response, error) in
    guard error == nil else {
        print(error)
        return
    }

    if (response) {
        dump(response)
    }
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **_prefix** | **String** |  | 
 **namespace** | **String** |  | 
 **postIcebergV1ByPrefixNamespacesByNamespaceTablesRequest** | [**PostIcebergV1ByPrefixNamespacesByNamespaceTablesRequest**](PostIcebergV1ByPrefixNamespacesByNamespaceTablesRequest.md) |  | 

### Return type

**[String: JSONValue]**

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **postIcebergV1ByPrefixNamespacesByNamespaceTablesByTable**
```swift
    internal class func postIcebergV1ByPrefixNamespacesByNamespaceTablesByTable(_prefix: String, namespace: String, table: String, postIcebergV1ByPrefixNamespacesByNamespaceTablesByTableRequest: PostIcebergV1ByPrefixNamespacesByNamespaceTablesByTableRequest, completion: @escaping (_ data: [String: JSONValue]?, _ error: Error?) -> Void)
```

Commit updates to multiple tables in an atomic operation

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import SupabaseStorage

let _prefix = "_prefix_example" // String | 
let namespace = "namespace_example" // String | 
let table = "table_example" // String | 
let postIcebergV1ByPrefixNamespacesByNamespaceTablesByTableRequest = postIcebergV1ByPrefixNamespacesByNamespaceTablesByTable_request(requirements: [postIcebergV1ByPrefixNamespacesByNamespaceTablesByTable_request_requirements_inner(type: "type_example", ref: "ref_example", uuid: "uuid_example", args: "TODO")], updates: [postIcebergV1ByPrefixNamespacesByNamespaceTablesByTable_request_updates_inner(action: "action_example", snapshot: postIcebergV1ByPrefixNamespacesByNamespaceTablesByTable_request_updates_inner_snapshot(sequenceNumber: 123, timestampMs: 123, manifestList: "manifestList_example", summary: postIcebergV1ByPrefixNamespacesByNamespaceTablesByTable_request_updates_inner_snapshot_summary(operation: "operation_example", addedFilesSize: "addedFilesSize_example", addedDataFiles: "addedDataFiles_example", addedRecords: "addedRecords_example", totalDeleteFiles: "totalDeleteFiles_example", totalRecords: "totalRecords_example", totalPositionDeletes: "totalPositionDeletes_example", totalEqualityDeletes: "totalEqualityDeletes_example"), schemaId: 123), refName: "refName_example", type: "type_example", args: "TODO")]) // PostIcebergV1ByPrefixNamespacesByNamespaceTablesByTableRequest | Commit updates to multiple tables in an atomic operation

// Commit updates to multiple tables in an atomic operation
IcebergAPI.postIcebergV1ByPrefixNamespacesByNamespaceTablesByTable(_prefix: _prefix, namespace: namespace, table: table, postIcebergV1ByPrefixNamespacesByNamespaceTablesByTableRequest: postIcebergV1ByPrefixNamespacesByNamespaceTablesByTableRequest) { (response, error) in
    guard error == nil else {
        print(error)
        return
    }

    if (response) {
        dump(response)
    }
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **_prefix** | **String** |  | 
 **namespace** | **String** |  | 
 **table** | **String** |  | 
 **postIcebergV1ByPrefixNamespacesByNamespaceTablesByTableRequest** | [**PostIcebergV1ByPrefixNamespacesByNamespaceTablesByTableRequest**](PostIcebergV1ByPrefixNamespacesByNamespaceTablesByTableRequest.md) | Commit updates to multiple tables in an atomic operation | 

### Return type

**[String: JSONValue]**

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

