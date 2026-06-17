# TransformationAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**getRenderImageAuthenticatedByBucketNameByObjectPath**](TransformationAPI.md#getrenderimageauthenticatedbybucketnamebyobjectpath) | **GET** /render/image/authenticated/{bucketName}/{objectPath} | Render an authenticated image with the given transformations
[**getRenderImagePublicByBucketNameByObjectPath**](TransformationAPI.md#getrenderimagepublicbybucketnamebyobjectpath) | **GET** /render/image/public/{bucketName}/{objectPath} | Render a public image with the given transformations
[**getRenderImageSignByBucketNameByObjectPath**](TransformationAPI.md#getrenderimagesignbybucketnamebyobjectpath) | **GET** /render/image/sign/{bucketName}/{objectPath} | Render an authenticated image with the given transformations
[**headRenderImageAuthenticatedByBucketNameByObjectPath**](TransformationAPI.md#headrenderimageauthenticatedbybucketnamebyobjectpath) | **HEAD** /render/image/authenticated/{bucketName}/{objectPath} | Render an authenticated image with the given transformations
[**headRenderImagePublicByBucketNameByObjectPath**](TransformationAPI.md#headrenderimagepublicbybucketnamebyobjectpath) | **HEAD** /render/image/public/{bucketName}/{objectPath} | Render a public image with the given transformations
[**headRenderImageSignByBucketNameByObjectPath**](TransformationAPI.md#headrenderimagesignbybucketnamebyobjectpath) | **HEAD** /render/image/sign/{bucketName}/{objectPath} | Render an authenticated image with the given transformations


# **getRenderImageAuthenticatedByBucketNameByObjectPath**
```swift
    internal class func getRenderImageAuthenticatedByBucketNameByObjectPath(bucketName: String, objectPath: String, height: Int? = nil, width: Int? = nil, resize: Resize_getRenderImageAuthenticatedByBucketNameByObjectPath? = nil, format: Format_getRenderImageAuthenticatedByBucketNameByObjectPath? = nil, quality: Int? = nil, download: String? = nil, completion: @escaping (_ data: Void?, _ error: Error?) -> Void)
```

Render an authenticated image with the given transformations

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
let download = "download_example" // String |  (optional)

// Render an authenticated image with the given transformations
TransformationAPI.getRenderImageAuthenticatedByBucketNameByObjectPath(bucketName: bucketName, objectPath: objectPath, height: height, width: width, resize: resize, format: format, quality: quality, download: download) { (response, error) in
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
 **download** | **String** |  | [optional] 

### Return type

Void (empty response body)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getRenderImagePublicByBucketNameByObjectPath**
```swift
    internal class func getRenderImagePublicByBucketNameByObjectPath(bucketName: String, objectPath: String, height: Int? = nil, width: Int? = nil, resize: Resize_getRenderImagePublicByBucketNameByObjectPath? = nil, format: Format_getRenderImagePublicByBucketNameByObjectPath? = nil, quality: Int? = nil, download: String? = nil, completion: @escaping (_ data: Void?, _ error: Error?) -> Void)
```

Render a public image with the given transformations

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
let download = "download_example" // String |  (optional)

// Render a public image with the given transformations
TransformationAPI.getRenderImagePublicByBucketNameByObjectPath(bucketName: bucketName, objectPath: objectPath, height: height, width: width, resize: resize, format: format, quality: quality, download: download) { (response, error) in
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
 **download** | **String** |  | [optional] 

### Return type

Void (empty response body)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getRenderImageSignByBucketNameByObjectPath**
```swift
    internal class func getRenderImageSignByBucketNameByObjectPath(token: String, bucketName: String, objectPath: String, download: String? = nil, completion: @escaping (_ data: Void?, _ error: Error?) -> Void)
```

Render an authenticated image with the given transformations

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import SupabaseStorage

let token = "token_example" // String | 
let bucketName = "bucketName_example" // String | 
let objectPath = "objectPath_example" // String | 
let download = "download_example" // String |  (optional)

// Render an authenticated image with the given transformations
TransformationAPI.getRenderImageSignByBucketNameByObjectPath(token: token, bucketName: bucketName, objectPath: objectPath, download: download) { (response, error) in
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

# **headRenderImageAuthenticatedByBucketNameByObjectPath**
```swift
    internal class func headRenderImageAuthenticatedByBucketNameByObjectPath(bucketName: String, objectPath: String, height: Int? = nil, width: Int? = nil, resize: Resize_headRenderImageAuthenticatedByBucketNameByObjectPath? = nil, format: Format_headRenderImageAuthenticatedByBucketNameByObjectPath? = nil, quality: Int? = nil, download: String? = nil, completion: @escaping (_ data: Void?, _ error: Error?) -> Void)
```

Render an authenticated image with the given transformations

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
let download = "download_example" // String |  (optional)

// Render an authenticated image with the given transformations
TransformationAPI.headRenderImageAuthenticatedByBucketNameByObjectPath(bucketName: bucketName, objectPath: objectPath, height: height, width: width, resize: resize, format: format, quality: quality, download: download) { (response, error) in
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
 **download** | **String** |  | [optional] 

### Return type

Void (empty response body)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **headRenderImagePublicByBucketNameByObjectPath**
```swift
    internal class func headRenderImagePublicByBucketNameByObjectPath(bucketName: String, objectPath: String, height: Int? = nil, width: Int? = nil, resize: Resize_headRenderImagePublicByBucketNameByObjectPath? = nil, format: Format_headRenderImagePublicByBucketNameByObjectPath? = nil, quality: Int? = nil, download: String? = nil, completion: @escaping (_ data: Void?, _ error: Error?) -> Void)
```

Render a public image with the given transformations

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
let download = "download_example" // String |  (optional)

// Render a public image with the given transformations
TransformationAPI.headRenderImagePublicByBucketNameByObjectPath(bucketName: bucketName, objectPath: objectPath, height: height, width: width, resize: resize, format: format, quality: quality, download: download) { (response, error) in
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
 **download** | **String** |  | [optional] 

### Return type

Void (empty response body)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **headRenderImageSignByBucketNameByObjectPath**
```swift
    internal class func headRenderImageSignByBucketNameByObjectPath(token: String, bucketName: String, objectPath: String, download: String? = nil, completion: @escaping (_ data: Void?, _ error: Error?) -> Void)
```

Render an authenticated image with the given transformations

### Example
```swift
// The following code samples are still beta. For any issue, please report via http://github.com/OpenAPITools/openapi-generator/issues/new
import SupabaseStorage

let token = "token_example" // String | 
let bucketName = "bucketName_example" // String | 
let objectPath = "objectPath_example" // String | 
let download = "download_example" // String |  (optional)

// Render an authenticated image with the given transformations
TransformationAPI.headRenderImageSignByBucketNameByObjectPath(token: token, bucketName: bucketName, objectPath: objectPath, download: download) { (response, error) in
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

