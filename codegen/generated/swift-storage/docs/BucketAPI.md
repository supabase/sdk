# BucketAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**createBucket**](BucketAPI.md#createbucket) | **POST** /bucket/ | Create a bucket
[**deleteBucket**](BucketAPI.md#deletebucket) | **DELETE** /bucket/{bucketId} | Delete a bucket
[**deleteIcebergBucketByBucketName**](BucketAPI.md#deleteicebergbucketbybucketname) | **DELETE** /iceberg/bucket/{bucketName} | Delete an analytics bucket
[**getBucket**](BucketAPI.md#getbucket) | **GET** /bucket/{bucketId} | Get details of a bucket
[**getIcebergBucket**](BucketAPI.md#geticebergbucket) | **GET** /iceberg/bucket | List analytics buckets
[**headBucket**](BucketAPI.md#headbucket) | **HEAD** /bucket/ | Gets all buckets
[**headBucket2**](BucketAPI.md#headbucket2) | **HEAD** /bucket | Gets all buckets
[**headBucketByBucketId**](BucketAPI.md#headbucketbybucketid) | **HEAD** /bucket/{bucketId} | Get details of a bucket
[**headIcebergBucket**](BucketAPI.md#headicebergbucket) | **HEAD** /iceberg/bucket | List analytics buckets
[**listBuckets**](BucketAPI.md#listbuckets) | **GET** /bucket/ | Gets all buckets
[**postBucketByBucketIdEmpty**](BucketAPI.md#postbucketbybucketidempty) | **POST** /bucket/{bucketId}/empty | Empty a bucket
[**postIcebergBucket**](BucketAPI.md#posticebergbucket) | **POST** /iceberg/bucket | Create an analytics bucket
[**putBucketByBucketId**](BucketAPI.md#putbucketbybucketid) | **PUT** /bucket/{bucketId} | Update properties of a bucket


# **createBucket**
```swift
    internal class func createBucket(createBucketRequest: CreateBucketRequest, completion: @escaping (_ data: CreateBucket200Response?, _ error: Error?) -> Void)
```

Create a bucket

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import SupabaseStorage

let createBucketRequest = createBucket_request(name: "name_example", id: "id_example", _public: false, type: "type_example", fileSizeLimit: createBucket_request_file_size_limit(), allowedMimeTypes: ["allowedMimeTypes_example"]) // CreateBucketRequest | 

// Create a bucket
BucketAPI.createBucket(createBucketRequest: createBucketRequest) { (response, error) in
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
 **createBucketRequest** | [**CreateBucketRequest**](CreateBucketRequest.md) |  | 

### Return type

[**CreateBucket200Response**](CreateBucket200Response.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **deleteBucket**
```swift
    internal class func deleteBucket(bucketId: String, completion: @escaping (_ data: PostBucketByBucketIdEmpty200Response?, _ error: Error?) -> Void)
```

Delete a bucket

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import SupabaseStorage

let bucketId = "bucketId_example" // String | 

// Delete a bucket
BucketAPI.deleteBucket(bucketId: bucketId) { (response, error) in
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
 **bucketId** | **String** |  | 

### Return type

[**PostBucketByBucketIdEmpty200Response**](PostBucketByBucketIdEmpty200Response.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **deleteIcebergBucketByBucketName**
```swift
    internal class func deleteIcebergBucketByBucketName(bucketName: String, completion: @escaping (_ data: Void?, _ error: Error?) -> Void)
```

Delete an analytics bucket

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import SupabaseStorage

let bucketName = "bucketName_example" // String | 

// Delete an analytics bucket
BucketAPI.deleteIcebergBucketByBucketName(bucketName: bucketName) { (response, error) in
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
 **bucketName** | **String** |  | 

### Return type

Void (empty response body)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getBucket**
```swift
    internal class func getBucket(bucketId: String, completion: @escaping (_ data: HeadBucket200ResponseInner?, _ error: Error?) -> Void)
```

Get details of a bucket

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import SupabaseStorage

let bucketId = "bucketId_example" // String | 

// Get details of a bucket
BucketAPI.getBucket(bucketId: bucketId) { (response, error) in
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
 **bucketId** | **String** |  | 

### Return type

[**HeadBucket200ResponseInner**](HeadBucket200ResponseInner.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getIcebergBucket**
```swift
    internal class func getIcebergBucket(limit: Int? = nil, offset: Int? = nil, sortColumn: SortColumn_getIcebergBucket? = nil, sortOrder: SortOrder_getIcebergBucket? = nil, search: String? = nil, completion: @escaping (_ data: Void?, _ error: Error?) -> Void)
```

List analytics buckets

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import SupabaseStorage

let limit = 987 // Int |  (optional)
let offset = 987 // Int |  (optional)
let sortColumn = "sortColumn_example" // String |  (optional)
let sortOrder = "sortOrder_example" // String |  (optional)
let search = "search_example" // String |  (optional)

// List analytics buckets
BucketAPI.getIcebergBucket(limit: limit, offset: offset, sortColumn: sortColumn, sortOrder: sortOrder, search: search) { (response, error) in
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
 **limit** | **Int** |  | [optional] 
 **offset** | **Int** |  | [optional] 
 **sortColumn** | **String** |  | [optional] 
 **sortOrder** | **String** |  | [optional] 
 **search** | **String** |  | [optional] 

### Return type

Void (empty response body)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **headBucket**
```swift
    internal class func headBucket(limit: Int? = nil, offset: Int? = nil, sortColumn: SortColumn_headBucket? = nil, sortOrder: SortOrder_headBucket? = nil, search: String? = nil, completion: @escaping (_ data: [HeadBucket200ResponseInner]?, _ error: Error?) -> Void)
```

Gets all buckets

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import SupabaseStorage

let limit = 987 // Int |  (optional)
let offset = 987 // Int |  (optional)
let sortColumn = "sortColumn_example" // String |  (optional)
let sortOrder = "sortOrder_example" // String |  (optional)
let search = "search_example" // String |  (optional)

// Gets all buckets
BucketAPI.headBucket(limit: limit, offset: offset, sortColumn: sortColumn, sortOrder: sortOrder, search: search) { (response, error) in
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
 **limit** | **Int** |  | [optional] 
 **offset** | **Int** |  | [optional] 
 **sortColumn** | **String** |  | [optional] 
 **sortOrder** | **String** |  | [optional] 
 **search** | **String** |  | [optional] 

### Return type

[**[HeadBucket200ResponseInner]**](HeadBucket200ResponseInner.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **headBucket2**
```swift
    internal class func headBucket2(limit: Int? = nil, offset: Int? = nil, sortColumn: SortColumn_headBucket2? = nil, sortOrder: SortOrder_headBucket2? = nil, search: String? = nil, completion: @escaping (_ data: [HeadBucket200ResponseInner]?, _ error: Error?) -> Void)
```

Gets all buckets

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import SupabaseStorage

let limit = 987 // Int |  (optional)
let offset = 987 // Int |  (optional)
let sortColumn = "sortColumn_example" // String |  (optional)
let sortOrder = "sortOrder_example" // String |  (optional)
let search = "search_example" // String |  (optional)

// Gets all buckets
BucketAPI.headBucket2(limit: limit, offset: offset, sortColumn: sortColumn, sortOrder: sortOrder, search: search) { (response, error) in
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
 **limit** | **Int** |  | [optional] 
 **offset** | **Int** |  | [optional] 
 **sortColumn** | **String** |  | [optional] 
 **sortOrder** | **String** |  | [optional] 
 **search** | **String** |  | [optional] 

### Return type

[**[HeadBucket200ResponseInner]**](HeadBucket200ResponseInner.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **headBucketByBucketId**
```swift
    internal class func headBucketByBucketId(bucketId: String, completion: @escaping (_ data: HeadBucket200ResponseInner?, _ error: Error?) -> Void)
```

Get details of a bucket

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import SupabaseStorage

let bucketId = "bucketId_example" // String | 

// Get details of a bucket
BucketAPI.headBucketByBucketId(bucketId: bucketId) { (response, error) in
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
 **bucketId** | **String** |  | 

### Return type

[**HeadBucket200ResponseInner**](HeadBucket200ResponseInner.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **headIcebergBucket**
```swift
    internal class func headIcebergBucket(limit: Int? = nil, offset: Int? = nil, sortColumn: SortColumn_headIcebergBucket? = nil, sortOrder: SortOrder_headIcebergBucket? = nil, search: String? = nil, completion: @escaping (_ data: Void?, _ error: Error?) -> Void)
```

List analytics buckets

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import SupabaseStorage

let limit = 987 // Int |  (optional)
let offset = 987 // Int |  (optional)
let sortColumn = "sortColumn_example" // String |  (optional)
let sortOrder = "sortOrder_example" // String |  (optional)
let search = "search_example" // String |  (optional)

// List analytics buckets
BucketAPI.headIcebergBucket(limit: limit, offset: offset, sortColumn: sortColumn, sortOrder: sortOrder, search: search) { (response, error) in
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
 **limit** | **Int** |  | [optional] 
 **offset** | **Int** |  | [optional] 
 **sortColumn** | **String** |  | [optional] 
 **sortOrder** | **String** |  | [optional] 
 **search** | **String** |  | [optional] 

### Return type

Void (empty response body)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **listBuckets**
```swift
    internal class func listBuckets(limit: Int? = nil, offset: Int? = nil, sortColumn: SortColumn_listBuckets? = nil, sortOrder: SortOrder_listBuckets? = nil, search: String? = nil, completion: @escaping (_ data: [BucketSchema]?, _ error: Error?) -> Void)
```

Gets all buckets

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import SupabaseStorage

let limit = 987 // Int |  (optional)
let offset = 987 // Int |  (optional)
let sortColumn = "sortColumn_example" // String |  (optional)
let sortOrder = "sortOrder_example" // String |  (optional)
let search = "search_example" // String |  (optional)

// Gets all buckets
BucketAPI.listBuckets(limit: limit, offset: offset, sortColumn: sortColumn, sortOrder: sortOrder, search: search) { (response, error) in
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
 **limit** | **Int** |  | [optional] 
 **offset** | **Int** |  | [optional] 
 **sortColumn** | **String** |  | [optional] 
 **sortOrder** | **String** |  | [optional] 
 **search** | **String** |  | [optional] 

### Return type

[**[BucketSchema]**](BucketSchema.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **postBucketByBucketIdEmpty**
```swift
    internal class func postBucketByBucketIdEmpty(bucketId: String, completion: @escaping (_ data: PostBucketByBucketIdEmpty200Response?, _ error: Error?) -> Void)
```

Empty a bucket

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import SupabaseStorage

let bucketId = "bucketId_example" // String | 

// Empty a bucket
BucketAPI.postBucketByBucketIdEmpty(bucketId: bucketId) { (response, error) in
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
 **bucketId** | **String** |  | 

### Return type

[**PostBucketByBucketIdEmpty200Response**](PostBucketByBucketIdEmpty200Response.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **postIcebergBucket**
```swift
    internal class func postIcebergBucket(createBucket200Response: CreateBucket200Response, completion: @escaping (_ data: Void?, _ error: Error?) -> Void)
```

Create an analytics bucket

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import SupabaseStorage

let createBucket200Response = createBucket_200_response(name: "name_example") // CreateBucket200Response | 

// Create an analytics bucket
BucketAPI.postIcebergBucket(createBucket200Response: createBucket200Response) { (response, error) in
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
 **createBucket200Response** | [**CreateBucket200Response**](CreateBucket200Response.md) |  | 

### Return type

Void (empty response body)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **putBucketByBucketId**
```swift
    internal class func putBucketByBucketId(bucketId: String, putBucketByBucketIdRequest: PutBucketByBucketIdRequest, completion: @escaping (_ data: PutBucketByBucketId200Response?, _ error: Error?) -> Void)
```

Update properties of a bucket

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import SupabaseStorage

let bucketId = "bucketId_example" // String | 
let putBucketByBucketIdRequest = putBucketByBucketId_request(_public: false, fileSizeLimit: createBucket_request_file_size_limit(), allowedMimeTypes: ["allowedMimeTypes_example"]) // PutBucketByBucketIdRequest | 

// Update properties of a bucket
BucketAPI.putBucketByBucketId(bucketId: bucketId, putBucketByBucketIdRequest: putBucketByBucketIdRequest) { (response, error) in
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
 **bucketId** | **String** |  | 
 **putBucketByBucketIdRequest** | [**PutBucketByBucketIdRequest**](PutBucketByBucketIdRequest.md) |  | 

### Return type

[**PutBucketByBucketId200Response**](PutBucketByBucketId200Response.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

