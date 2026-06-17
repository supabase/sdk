# ObjectAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**deleteObjectByBucketName**](ObjectAPI.md#deleteobjectbybucketname) | **DELETE** /object/{bucketName} | Delete multiple objects
[**deleteObjectByBucketNameByObjectPath**](ObjectAPI.md#deleteobjectbybucketnamebyobjectpath) | **DELETE** /object/{bucketName}/{objectPath} | Delete an object
[**getObjectAuthenticatedByBucketNameByObjectPath**](ObjectAPI.md#getobjectauthenticatedbybucketnamebyobjectpath) | **GET** /object/authenticated/{bucketName}/{objectPath} | Retrieve an object
[**getObjectByBucketNameByObjectPath**](ObjectAPI.md#getobjectbybucketnamebyobjectpath) | **GET** /object/{bucketName}/{objectPath} | Get object
[**getObjectInfoAuthenticatedByBucketNameByObjectPath**](ObjectAPI.md#getobjectinfoauthenticatedbybucketnamebyobjectpath) | **GET** /object/info/authenticated/{bucketName}/{objectPath} | Retrieve object info
[**getObjectInfoByBucketNameByObjectPath**](ObjectAPI.md#getobjectinfobybucketnamebyobjectpath) | **GET** /object/info/{bucketName}/{objectPath} | Retrieve object info
[**getObjectInfoPublicByBucketNameByObjectPath**](ObjectAPI.md#getobjectinfopublicbybucketnamebyobjectpath) | **GET** /object/info/public/{bucketName}/{objectPath} | Get object info
[**getObjectPublicByBucketNameByObjectPath**](ObjectAPI.md#getobjectpublicbybucketnamebyobjectpath) | **GET** /object/public/{bucketName}/{objectPath} | Retrieve an object from a public bucket
[**getObjectSignByBucketNameByObjectPath**](ObjectAPI.md#getobjectsignbybucketnamebyobjectpath) | **GET** /object/sign/{bucketName}/{objectPath} | Retrieve an object via a presigned URL
[**headObjectAuthenticatedByBucketNameByObjectPath**](ObjectAPI.md#headobjectauthenticatedbybucketnamebyobjectpath) | **HEAD** /object/authenticated/{bucketName}/{objectPath} | Retrieve object info
[**headObjectByBucketNameByObjectPath**](ObjectAPI.md#headobjectbybucketnamebyobjectpath) | **HEAD** /object/{bucketName}/{objectPath} | Retrieve object info
[**headObjectInfoAuthenticatedByBucketNameByObjectPath**](ObjectAPI.md#headobjectinfoauthenticatedbybucketnamebyobjectpath) | **HEAD** /object/info/authenticated/{bucketName}/{objectPath} | Retrieve object info
[**headObjectInfoByBucketNameByObjectPath**](ObjectAPI.md#headobjectinfobybucketnamebyobjectpath) | **HEAD** /object/info/{bucketName}/{objectPath} | Retrieve object info
[**headObjectPublicByBucketNameByObjectPath**](ObjectAPI.md#headobjectpublicbybucketnamebyobjectpath) | **HEAD** /object/public/{bucketName}/{objectPath} | Get object info
[**headObjectSignByBucketNameByObjectPath**](ObjectAPI.md#headobjectsignbybucketnamebyobjectpath) | **HEAD** /object/sign/{bucketName}/{objectPath} | Retrieve an object via a presigned URL
[**postObjectCopy**](ObjectAPI.md#postobjectcopy) | **POST** /object/copy | Copies an object
[**postObjectListByBucketName**](ObjectAPI.md#postobjectlistbybucketname) | **POST** /object/list/{bucketName} | Search for objects under a prefix
[**postObjectListV2ByBucketName**](ObjectAPI.md#postobjectlistv2bybucketname) | **POST** /object/list-v2/{bucketName} | Search for objects under a prefix
[**postObjectMove**](ObjectAPI.md#postobjectmove) | **POST** /object/move | Moves an object
[**postObjectSignByBucketName**](ObjectAPI.md#postobjectsignbybucketname) | **POST** /object/sign/{bucketName} | Generate presigned urls to retrieve objects
[**postObjectSignByBucketNameByObjectPath**](ObjectAPI.md#postobjectsignbybucketnamebyobjectpath) | **POST** /object/sign/{bucketName}/{objectPath} | Generate a presigned url to retrieve an object
[**postObjectUploadSignByBucketNameByObjectPath**](ObjectAPI.md#postobjectuploadsignbybucketnamebyobjectpath) | **POST** /object/upload/sign/{bucketName}/{objectPath} | Generate a presigned url to upload an object
[**putObjectByBucketNameByObjectPath**](ObjectAPI.md#putobjectbybucketnamebyobjectpath) | **PUT** /object/{bucketName}/{objectPath} | Update the object at an existing key
[**putObjectUploadSignByBucketNameByObjectPath**](ObjectAPI.md#putobjectuploadsignbybucketnamebyobjectpath) | **PUT** /object/upload/sign/{bucketName}/{objectPath} | Uploads an object via a presigned URL
[**uploadObject**](ObjectAPI.md#uploadobject) | **POST** /object/{bucketName}/{objectPath} | Upload a new object


# **deleteObjectByBucketName**
```swift
    internal class func deleteObjectByBucketName(bucketName: String, deleteObjectByBucketNameRequest: DeleteObjectByBucketNameRequest, completion: @escaping (_ data: [ObjectSchema]?, _ error: Error?) -> Void)
```

Delete multiple objects

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import SupabaseStorage

let bucketName = "bucketName_example" // String | 
let deleteObjectByBucketNameRequest = deleteObjectByBucketName_request(prefixes: ["prefixes_example"]) // DeleteObjectByBucketNameRequest | 

// Delete multiple objects
ObjectAPI.deleteObjectByBucketName(bucketName: bucketName, deleteObjectByBucketNameRequest: deleteObjectByBucketNameRequest) { (response, error) in
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
 **deleteObjectByBucketNameRequest** | [**DeleteObjectByBucketNameRequest**](DeleteObjectByBucketNameRequest.md) |  | 

### Return type

[**[ObjectSchema]**](ObjectSchema.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **deleteObjectByBucketNameByObjectPath**
```swift
    internal class func deleteObjectByBucketNameByObjectPath(bucketName: String, objectPath: String, completion: @escaping (_ data: PostBucketByBucketIdEmpty200Response?, _ error: Error?) -> Void)
```

Delete an object

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import SupabaseStorage

let bucketName = "bucketName_example" // String | 
let objectPath = "objectPath_example" // String | 

// Delete an object
ObjectAPI.deleteObjectByBucketNameByObjectPath(bucketName: bucketName, objectPath: objectPath) { (response, error) in
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
 **objectPath** | **String** |  | 

### Return type

[**PostBucketByBucketIdEmpty200Response**](PostBucketByBucketIdEmpty200Response.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getObjectAuthenticatedByBucketNameByObjectPath**
```swift
    internal class func getObjectAuthenticatedByBucketNameByObjectPath(bucketName: String, objectPath: String, download: String? = nil, completion: @escaping (_ data: Void?, _ error: Error?) -> Void)
```

Retrieve an object

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import SupabaseStorage

let bucketName = "bucketName_example" // String | 
let objectPath = "objectPath_example" // String | 
let download = "download_example" // String |  (optional)

// Retrieve an object
ObjectAPI.getObjectAuthenticatedByBucketNameByObjectPath(bucketName: bucketName, objectPath: objectPath, download: download) { (response, error) in
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
 **objectPath** | **String** |  | 
 **download** | **String** |  | [optional] 

### Return type

Void (empty response body)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getObjectByBucketNameByObjectPath**
```swift
    internal class func getObjectByBucketNameByObjectPath(bucketName: String, objectPath: String, completion: @escaping (_ data: Void?, _ error: Error?) -> Void)
```

Get object

Serve objects

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import SupabaseStorage

let bucketName = "bucketName_example" // String | 
let objectPath = "objectPath_example" // String | 

// Get object
ObjectAPI.getObjectByBucketNameByObjectPath(bucketName: bucketName, objectPath: objectPath) { (response, error) in
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
 **objectPath** | **String** |  | 

### Return type

Void (empty response body)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getObjectInfoAuthenticatedByBucketNameByObjectPath**
```swift
    internal class func getObjectInfoAuthenticatedByBucketNameByObjectPath(bucketName: String, objectPath: String, height: Int? = nil, width: Int? = nil, resize: Resize_getObjectInfoAuthenticatedByBucketNameByObjectPath? = nil, format: Format_getObjectInfoAuthenticatedByBucketNameByObjectPath? = nil, quality: Int? = nil, completion: @escaping (_ data: Void?, _ error: Error?) -> Void)
```

Retrieve object info

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import SupabaseStorage

let bucketName = "bucketName_example" // String | 
let objectPath = "objectPath_example" // String | 
let height = 987 // Int |  (optional)
let width = 987 // Int |  (optional)
let resize = "resize_example" // String |  (optional)
let format = "format_example" // String |  (optional)
let quality = 987 // Int |  (optional)

// Retrieve object info
ObjectAPI.getObjectInfoAuthenticatedByBucketNameByObjectPath(bucketName: bucketName, objectPath: objectPath, height: height, width: width, resize: resize, format: format, quality: quality) { (response, error) in
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
 **objectPath** | **String** |  | 
 **height** | **Int** |  | [optional] 
 **width** | **Int** |  | [optional] 
 **resize** | **String** |  | [optional] 
 **format** | **String** |  | [optional] 
 **quality** | **Int** |  | [optional] 

### Return type

Void (empty response body)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getObjectInfoByBucketNameByObjectPath**
```swift
    internal class func getObjectInfoByBucketNameByObjectPath(bucketName: String, objectPath: String, height: Int? = nil, width: Int? = nil, resize: Resize_getObjectInfoByBucketNameByObjectPath? = nil, format: Format_getObjectInfoByBucketNameByObjectPath? = nil, quality: Int? = nil, completion: @escaping (_ data: Void?, _ error: Error?) -> Void)
```

Retrieve object info

Object Info

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import SupabaseStorage

let bucketName = "bucketName_example" // String | 
let objectPath = "objectPath_example" // String | 
let height = 987 // Int |  (optional)
let width = 987 // Int |  (optional)
let resize = "resize_example" // String |  (optional)
let format = "format_example" // String |  (optional)
let quality = 987 // Int |  (optional)

// Retrieve object info
ObjectAPI.getObjectInfoByBucketNameByObjectPath(bucketName: bucketName, objectPath: objectPath, height: height, width: width, resize: resize, format: format, quality: quality) { (response, error) in
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
 **objectPath** | **String** |  | 
 **height** | **Int** |  | [optional] 
 **width** | **Int** |  | [optional] 
 **resize** | **String** |  | [optional] 
 **format** | **String** |  | [optional] 
 **quality** | **Int** |  | [optional] 

### Return type

Void (empty response body)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getObjectInfoPublicByBucketNameByObjectPath**
```swift
    internal class func getObjectInfoPublicByBucketNameByObjectPath(bucketName: String, objectPath: String, height: Int? = nil, width: Int? = nil, resize: Resize_getObjectInfoPublicByBucketNameByObjectPath? = nil, format: Format_getObjectInfoPublicByBucketNameByObjectPath? = nil, quality: Int? = nil, completion: @escaping (_ data: Void?, _ error: Error?) -> Void)
```

Get object info

returns object info

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import SupabaseStorage

let bucketName = "bucketName_example" // String | 
let objectPath = "objectPath_example" // String | 
let height = 987 // Int |  (optional)
let width = 987 // Int |  (optional)
let resize = "resize_example" // String |  (optional)
let format = "format_example" // String |  (optional)
let quality = 987 // Int |  (optional)

// Get object info
ObjectAPI.getObjectInfoPublicByBucketNameByObjectPath(bucketName: bucketName, objectPath: objectPath, height: height, width: width, resize: resize, format: format, quality: quality) { (response, error) in
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
 **objectPath** | **String** |  | 
 **height** | **Int** |  | [optional] 
 **width** | **Int** |  | [optional] 
 **resize** | **String** |  | [optional] 
 **format** | **String** |  | [optional] 
 **quality** | **Int** |  | [optional] 

### Return type

Void (empty response body)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getObjectPublicByBucketNameByObjectPath**
```swift
    internal class func getObjectPublicByBucketNameByObjectPath(bucketName: String, objectPath: String, download: String? = nil, completion: @escaping (_ data: Void?, _ error: Error?) -> Void)
```

Retrieve an object from a public bucket

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import SupabaseStorage

let bucketName = "bucketName_example" // String | 
let objectPath = "objectPath_example" // String | 
let download = "download_example" // String |  (optional)

// Retrieve an object from a public bucket
ObjectAPI.getObjectPublicByBucketNameByObjectPath(bucketName: bucketName, objectPath: objectPath, download: download) { (response, error) in
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
 **objectPath** | **String** |  | 
 **download** | **String** |  | [optional] 

### Return type

Void (empty response body)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getObjectSignByBucketNameByObjectPath**
```swift
    internal class func getObjectSignByBucketNameByObjectPath(token: String, bucketName: String, objectPath: String, download: String? = nil, completion: @escaping (_ data: Void?, _ error: Error?) -> Void)
```

Retrieve an object via a presigned URL

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import SupabaseStorage

let token = "token_example" // String | 
let bucketName = "bucketName_example" // String | 
let objectPath = "objectPath_example" // String | 
let download = "download_example" // String |  (optional)

// Retrieve an object via a presigned URL
ObjectAPI.getObjectSignByBucketNameByObjectPath(token: token, bucketName: bucketName, objectPath: objectPath, download: download) { (response, error) in
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
 **token** | **String** |  | 
 **bucketName** | **String** |  | 
 **objectPath** | **String** |  | 
 **download** | **String** |  | [optional] 

### Return type

Void (empty response body)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **headObjectAuthenticatedByBucketNameByObjectPath**
```swift
    internal class func headObjectAuthenticatedByBucketNameByObjectPath(bucketName: String, objectPath: String, height: Int? = nil, width: Int? = nil, resize: Resize_headObjectAuthenticatedByBucketNameByObjectPath? = nil, format: Format_headObjectAuthenticatedByBucketNameByObjectPath? = nil, quality: Int? = nil, completion: @escaping (_ data: Void?, _ error: Error?) -> Void)
```

Retrieve object info

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import SupabaseStorage

let bucketName = "bucketName_example" // String | 
let objectPath = "objectPath_example" // String | 
let height = 987 // Int |  (optional)
let width = 987 // Int |  (optional)
let resize = "resize_example" // String |  (optional)
let format = "format_example" // String |  (optional)
let quality = 987 // Int |  (optional)

// Retrieve object info
ObjectAPI.headObjectAuthenticatedByBucketNameByObjectPath(bucketName: bucketName, objectPath: objectPath, height: height, width: width, resize: resize, format: format, quality: quality) { (response, error) in
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
 **objectPath** | **String** |  | 
 **height** | **Int** |  | [optional] 
 **width** | **Int** |  | [optional] 
 **resize** | **String** |  | [optional] 
 **format** | **String** |  | [optional] 
 **quality** | **Int** |  | [optional] 

### Return type

Void (empty response body)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **headObjectByBucketNameByObjectPath**
```swift
    internal class func headObjectByBucketNameByObjectPath(bucketName: String, objectPath: String, height: Int? = nil, width: Int? = nil, resize: Resize_headObjectByBucketNameByObjectPath? = nil, format: Format_headObjectByBucketNameByObjectPath? = nil, quality: Int? = nil, completion: @escaping (_ data: Void?, _ error: Error?) -> Void)
```

Retrieve object info

Head object info

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import SupabaseStorage

let bucketName = "bucketName_example" // String | 
let objectPath = "objectPath_example" // String | 
let height = 987 // Int |  (optional)
let width = 987 // Int |  (optional)
let resize = "resize_example" // String |  (optional)
let format = "format_example" // String |  (optional)
let quality = 987 // Int |  (optional)

// Retrieve object info
ObjectAPI.headObjectByBucketNameByObjectPath(bucketName: bucketName, objectPath: objectPath, height: height, width: width, resize: resize, format: format, quality: quality) { (response, error) in
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
 **objectPath** | **String** |  | 
 **height** | **Int** |  | [optional] 
 **width** | **Int** |  | [optional] 
 **resize** | **String** |  | [optional] 
 **format** | **String** |  | [optional] 
 **quality** | **Int** |  | [optional] 

### Return type

Void (empty response body)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **headObjectInfoAuthenticatedByBucketNameByObjectPath**
```swift
    internal class func headObjectInfoAuthenticatedByBucketNameByObjectPath(bucketName: String, objectPath: String, height: Int? = nil, width: Int? = nil, resize: Resize_headObjectInfoAuthenticatedByBucketNameByObjectPath? = nil, format: Format_headObjectInfoAuthenticatedByBucketNameByObjectPath? = nil, quality: Int? = nil, completion: @escaping (_ data: Void?, _ error: Error?) -> Void)
```

Retrieve object info

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import SupabaseStorage

let bucketName = "bucketName_example" // String | 
let objectPath = "objectPath_example" // String | 
let height = 987 // Int |  (optional)
let width = 987 // Int |  (optional)
let resize = "resize_example" // String |  (optional)
let format = "format_example" // String |  (optional)
let quality = 987 // Int |  (optional)

// Retrieve object info
ObjectAPI.headObjectInfoAuthenticatedByBucketNameByObjectPath(bucketName: bucketName, objectPath: objectPath, height: height, width: width, resize: resize, format: format, quality: quality) { (response, error) in
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
 **objectPath** | **String** |  | 
 **height** | **Int** |  | [optional] 
 **width** | **Int** |  | [optional] 
 **resize** | **String** |  | [optional] 
 **format** | **String** |  | [optional] 
 **quality** | **Int** |  | [optional] 

### Return type

Void (empty response body)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **headObjectInfoByBucketNameByObjectPath**
```swift
    internal class func headObjectInfoByBucketNameByObjectPath(bucketName: String, objectPath: String, height: Int? = nil, width: Int? = nil, resize: Resize_headObjectInfoByBucketNameByObjectPath? = nil, format: Format_headObjectInfoByBucketNameByObjectPath? = nil, quality: Int? = nil, completion: @escaping (_ data: Void?, _ error: Error?) -> Void)
```

Retrieve object info

Object Info

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import SupabaseStorage

let bucketName = "bucketName_example" // String | 
let objectPath = "objectPath_example" // String | 
let height = 987 // Int |  (optional)
let width = 987 // Int |  (optional)
let resize = "resize_example" // String |  (optional)
let format = "format_example" // String |  (optional)
let quality = 987 // Int |  (optional)

// Retrieve object info
ObjectAPI.headObjectInfoByBucketNameByObjectPath(bucketName: bucketName, objectPath: objectPath, height: height, width: width, resize: resize, format: format, quality: quality) { (response, error) in
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
 **objectPath** | **String** |  | 
 **height** | **Int** |  | [optional] 
 **width** | **Int** |  | [optional] 
 **resize** | **String** |  | [optional] 
 **format** | **String** |  | [optional] 
 **quality** | **Int** |  | [optional] 

### Return type

Void (empty response body)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **headObjectPublicByBucketNameByObjectPath**
```swift
    internal class func headObjectPublicByBucketNameByObjectPath(bucketName: String, objectPath: String, height: Int? = nil, width: Int? = nil, resize: Resize_headObjectPublicByBucketNameByObjectPath? = nil, format: Format_headObjectPublicByBucketNameByObjectPath? = nil, quality: Int? = nil, completion: @escaping (_ data: Void?, _ error: Error?) -> Void)
```

Get object info

returns object info

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import SupabaseStorage

let bucketName = "bucketName_example" // String | 
let objectPath = "objectPath_example" // String | 
let height = 987 // Int |  (optional)
let width = 987 // Int |  (optional)
let resize = "resize_example" // String |  (optional)
let format = "format_example" // String |  (optional)
let quality = 987 // Int |  (optional)

// Get object info
ObjectAPI.headObjectPublicByBucketNameByObjectPath(bucketName: bucketName, objectPath: objectPath, height: height, width: width, resize: resize, format: format, quality: quality) { (response, error) in
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
 **objectPath** | **String** |  | 
 **height** | **Int** |  | [optional] 
 **width** | **Int** |  | [optional] 
 **resize** | **String** |  | [optional] 
 **format** | **String** |  | [optional] 
 **quality** | **Int** |  | [optional] 

### Return type

Void (empty response body)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **headObjectSignByBucketNameByObjectPath**
```swift
    internal class func headObjectSignByBucketNameByObjectPath(token: String, bucketName: String, objectPath: String, download: String? = nil, completion: @escaping (_ data: Void?, _ error: Error?) -> Void)
```

Retrieve an object via a presigned URL

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import SupabaseStorage

let token = "token_example" // String | 
let bucketName = "bucketName_example" // String | 
let objectPath = "objectPath_example" // String | 
let download = "download_example" // String |  (optional)

// Retrieve an object via a presigned URL
ObjectAPI.headObjectSignByBucketNameByObjectPath(token: token, bucketName: bucketName, objectPath: objectPath, download: download) { (response, error) in
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
 **token** | **String** |  | 
 **bucketName** | **String** |  | 
 **objectPath** | **String** |  | 
 **download** | **String** |  | [optional] 

### Return type

Void (empty response body)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **postObjectCopy**
```swift
    internal class func postObjectCopy(postObjectCopyRequest: PostObjectCopyRequest, completion: @escaping (_ data: PostObjectCopy200Response?, _ error: Error?) -> Void)
```

Copies an object

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import SupabaseStorage

let postObjectCopyRequest = postObjectCopy_request(bucketId: "bucketId_example", sourceKey: "sourceKey_example", destinationBucket: "destinationBucket_example", destinationKey: "destinationKey_example", metadata: postObjectCopy_request_metadata(cacheControl: "cacheControl_example", mimetype: "mimetype_example"), copyMetadata: true) // PostObjectCopyRequest | 

// Copies an object
ObjectAPI.postObjectCopy(postObjectCopyRequest: postObjectCopyRequest) { (response, error) in
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
 **postObjectCopyRequest** | [**PostObjectCopyRequest**](PostObjectCopyRequest.md) |  | 

### Return type

[**PostObjectCopy200Response**](PostObjectCopy200Response.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **postObjectListByBucketName**
```swift
    internal class func postObjectListByBucketName(bucketName: String, postObjectListByBucketNameRequest: PostObjectListByBucketNameRequest, completion: @escaping (_ data: [PostObjectListByBucketName200ResponseInner]?, _ error: Error?) -> Void)
```

Search for objects under a prefix

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import SupabaseStorage

let bucketName = "bucketName_example" // String | 
let postObjectListByBucketNameRequest = postObjectListByBucketName_request(_prefix: "_prefix_example", limit: 123, offset: 123, sortBy: postObjectListByBucketName_request_sortBy(column: "column_example", order: "order_example"), search: "search_example") // PostObjectListByBucketNameRequest | 

// Search for objects under a prefix
ObjectAPI.postObjectListByBucketName(bucketName: bucketName, postObjectListByBucketNameRequest: postObjectListByBucketNameRequest) { (response, error) in
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
 **postObjectListByBucketNameRequest** | [**PostObjectListByBucketNameRequest**](PostObjectListByBucketNameRequest.md) |  | 

### Return type

[**[PostObjectListByBucketName200ResponseInner]**](PostObjectListByBucketName200ResponseInner.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **postObjectListV2ByBucketName**
```swift
    internal class func postObjectListV2ByBucketName(bucketName: String, postObjectListV2ByBucketNameRequest: PostObjectListV2ByBucketNameRequest, completion: @escaping (_ data: Void?, _ error: Error?) -> Void)
```

Search for objects under a prefix

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import SupabaseStorage

let bucketName = "bucketName_example" // String | 
let postObjectListV2ByBucketNameRequest = postObjectList_v2ByBucketName_request(_prefix: "_prefix_example", limit: 123, cursor: "cursor_example", withDelimiter: false, sortBy: postObjectList_v2ByBucketName_request_sortBy(column: "column_example", order: "order_example")) // PostObjectListV2ByBucketNameRequest | 

// Search for objects under a prefix
ObjectAPI.postObjectListV2ByBucketName(bucketName: bucketName, postObjectListV2ByBucketNameRequest: postObjectListV2ByBucketNameRequest) { (response, error) in
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
 **postObjectListV2ByBucketNameRequest** | [**PostObjectListV2ByBucketNameRequest**](PostObjectListV2ByBucketNameRequest.md) |  | 

### Return type

Void (empty response body)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **postObjectMove**
```swift
    internal class func postObjectMove(postObjectMoveRequest: PostObjectMoveRequest, completion: @escaping (_ data: PutBucketByBucketId200Response?, _ error: Error?) -> Void)
```

Moves an object

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import SupabaseStorage

let postObjectMoveRequest = postObjectMove_request(bucketId: "bucketId_example", sourceKey: "sourceKey_example", destinationBucket: "destinationBucket_example", destinationKey: "destinationKey_example") // PostObjectMoveRequest | 

// Moves an object
ObjectAPI.postObjectMove(postObjectMoveRequest: postObjectMoveRequest) { (response, error) in
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
 **postObjectMoveRequest** | [**PostObjectMoveRequest**](PostObjectMoveRequest.md) |  | 

### Return type

[**PutBucketByBucketId200Response**](PutBucketByBucketId200Response.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **postObjectSignByBucketName**
```swift
    internal class func postObjectSignByBucketName(bucketName: String, postObjectSignByBucketNameRequest: PostObjectSignByBucketNameRequest, completion: @escaping (_ data: [PostObjectSignByBucketName200ResponseInner]?, _ error: Error?) -> Void)
```

Generate presigned urls to retrieve objects

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import SupabaseStorage

let bucketName = "bucketName_example" // String | 
let postObjectSignByBucketNameRequest = postObjectSignByBucketName_request(expiresIn: 123, paths: ["paths_example"]) // PostObjectSignByBucketNameRequest | 

// Generate presigned urls to retrieve objects
ObjectAPI.postObjectSignByBucketName(bucketName: bucketName, postObjectSignByBucketNameRequest: postObjectSignByBucketNameRequest) { (response, error) in
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
 **postObjectSignByBucketNameRequest** | [**PostObjectSignByBucketNameRequest**](PostObjectSignByBucketNameRequest.md) |  | 

### Return type

[**[PostObjectSignByBucketName200ResponseInner]**](PostObjectSignByBucketName200ResponseInner.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **postObjectSignByBucketNameByObjectPath**
```swift
    internal class func postObjectSignByBucketNameByObjectPath(bucketName: String, objectPath: String, postObjectSignByBucketNameByObjectPathRequest: PostObjectSignByBucketNameByObjectPathRequest, completion: @escaping (_ data: PostObjectSignByBucketNameByObjectPath200Response?, _ error: Error?) -> Void)
```

Generate a presigned url to retrieve an object

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import SupabaseStorage

let bucketName = "bucketName_example" // String | 
let objectPath = "objectPath_example" // String | 
let postObjectSignByBucketNameByObjectPathRequest = postObjectSignByBucketNameByObjectPath_request(expiresIn: 123, transform: postObjectSignByBucketNameByObjectPath_request_transform(height: 123, width: 123, resize: "resize_example", format: "format_example", quality: 123)) // PostObjectSignByBucketNameByObjectPathRequest | 

// Generate a presigned url to retrieve an object
ObjectAPI.postObjectSignByBucketNameByObjectPath(bucketName: bucketName, objectPath: objectPath, postObjectSignByBucketNameByObjectPathRequest: postObjectSignByBucketNameByObjectPathRequest) { (response, error) in
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
 **objectPath** | **String** |  | 
 **postObjectSignByBucketNameByObjectPathRequest** | [**PostObjectSignByBucketNameByObjectPathRequest**](PostObjectSignByBucketNameByObjectPathRequest.md) |  | 

### Return type

[**PostObjectSignByBucketNameByObjectPath200Response**](PostObjectSignByBucketNameByObjectPath200Response.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **postObjectUploadSignByBucketNameByObjectPath**
```swift
    internal class func postObjectUploadSignByBucketNameByObjectPath(bucketName: String, objectPath: String, completion: @escaping (_ data: PostObjectUploadSignByBucketNameByObjectPath200Response?, _ error: Error?) -> Void)
```

Generate a presigned url to upload an object

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import SupabaseStorage

let bucketName = "bucketName_example" // String | 
let objectPath = "objectPath_example" // String | 

// Generate a presigned url to upload an object
ObjectAPI.postObjectUploadSignByBucketNameByObjectPath(bucketName: bucketName, objectPath: objectPath) { (response, error) in
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
 **objectPath** | **String** |  | 

### Return type

[**PostObjectUploadSignByBucketNameByObjectPath200Response**](PostObjectUploadSignByBucketNameByObjectPath200Response.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **putObjectByBucketNameByObjectPath**
```swift
    internal class func putObjectByBucketNameByObjectPath(bucketName: String, objectPath: String, completion: @escaping (_ data: PutObjectByBucketNameByObjectPath200Response?, _ error: Error?) -> Void)
```

Update the object at an existing key

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import SupabaseStorage

let bucketName = "bucketName_example" // String | 
let objectPath = "objectPath_example" // String | 

// Update the object at an existing key
ObjectAPI.putObjectByBucketNameByObjectPath(bucketName: bucketName, objectPath: objectPath) { (response, error) in
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
 **objectPath** | **String** |  | 

### Return type

[**PutObjectByBucketNameByObjectPath200Response**](PutObjectByBucketNameByObjectPath200Response.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **putObjectUploadSignByBucketNameByObjectPath**
```swift
    internal class func putObjectUploadSignByBucketNameByObjectPath(token: String, bucketName: String, objectPath: String, completion: @escaping (_ data: PutObjectUploadSignByBucketNameByObjectPath200Response?, _ error: Error?) -> Void)
```

Uploads an object via a presigned URL

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import SupabaseStorage

let token = "token_example" // String | 
let bucketName = "bucketName_example" // String | 
let objectPath = "objectPath_example" // String | 

// Uploads an object via a presigned URL
ObjectAPI.putObjectUploadSignByBucketNameByObjectPath(token: token, bucketName: bucketName, objectPath: objectPath) { (response, error) in
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
 **token** | **String** |  | 
 **bucketName** | **String** |  | 
 **objectPath** | **String** |  | 

### Return type

[**PutObjectUploadSignByBucketNameByObjectPath200Response**](PutObjectUploadSignByBucketNameByObjectPath200Response.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **uploadObject**
```swift
    internal class func uploadObject(bucketName: String, objectPath: String, completion: @escaping (_ data: PutObjectByBucketNameByObjectPath200Response?, _ error: Error?) -> Void)
```

Upload a new object

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import SupabaseStorage

let bucketName = "bucketName_example" // String | 
let objectPath = "objectPath_example" // String | 

// Upload a new object
ObjectAPI.uploadObject(bucketName: bucketName, objectPath: objectPath) { (response, error) in
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
 **objectPath** | **String** |  | 

### Return type

[**PutObjectByBucketNameByObjectPath200Response**](PutObjectByBucketNameByObjectPath200Response.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

