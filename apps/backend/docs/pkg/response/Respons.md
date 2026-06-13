# Response Package

The `response` package provides a centralized and consistent way to handle API responses across the application.

It standardizes:

* Success responses
* Error responses
* Paginated responses
* Error codes

---

# Folder Structure

```txt
/pkg/response
    response.go
    success.go
    error.go
    pagination.go
    codes.go
```

---

# Goals

The purpose of this package is to:

* Keep API responses consistent
* Reduce repeated `c.JSON(...)` calls
* Improve maintainability
* Make frontend integration easier
* Centralize response formatting

---

# Response Structure

## Success Response

```json
{
  "data": {},
  "message": "optional message"
}
```

---

## Error Response

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "validation failed",
    "fields": {
      "email": ["invalid email"]
    }
  }
}
```

---

## Paginated Response

```json
{
  "results": [],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total_items": 100,
    "total_pages": 5,
    "has_next": true,
    "has_prev": false
  }
}
```

---

# Files

## response.go

Contains shared response structures.

### Includes

* `Response[T]`
* `ErrorResponse`
* `ErrorBody`

---

## success.go

Handles successful API responses.

### Functions

## `Success`

```go
func Success[T any](
    c *gin.Context,
    status int,
    data T,
    message ...string,
)
```

### Example

```go
response.Success(
    c,
    http.StatusOK,
    user,
)
```

With message:

```go
response.Success(
    c,
    http.StatusCreated,
    user,
    "user created successfully",
)
```

---

## error.go

Handles API error responses.

### Functions

## `Error`

```go
func Error(
    c *gin.Context,
    status int,
    code string,
    message string,
    fields ...map[string][]string,
)
```

### Example

```go
response.Error(
    c,
    http.StatusNotFound,
    response.CodeUserNotFound,
    "user not found",
)
```

Validation example:

```go
response.Error(
    c,
    http.StatusBadRequest,
    response.CodeValidationError,
    "validation failed",
    map[string][]string{
        "email": {"invalid email"},
    },
)
```

---

## pagination.go

Handles paginated API responses.

### Structures

## `Pagination`

```go
type Pagination struct {
    Page       int
    Limit      int
    TotalItems int
    TotalPages int
    HasNext    bool
    HasPrev    bool
}
```

---

## `PaginatedResponse[T]`

```go
type PaginatedResponse[T any] struct {
    Results    []T
    Pagination Pagination
}
```

---

## Functions

## `Paginated`

```go
func Paginated[T any](
    c *gin.Context,
    status int,
    results []T,
    pagination Pagination,
)
```

### Example

```go
response.Paginated(
    c,
    http.StatusOK,
    users,
    pagination,
)
```

---

## codes.go

Contains centralized API error codes.

### Example Codes

```go
const (
    CodeInternalError   = "INTERNAL_ERROR"
    CodeValidationError = "VALIDATION_ERROR"
    CodeUnauthorized    = "UNAUTHORIZED"
    CodeForbidden       = "FORBIDDEN"
    CodeNotFound        = "NOT_FOUND"
)
```

---

# Best Practices

* Always use the response package instead of raw `c.JSON(...)`
* Keep error codes stable once frontend/mobile apps use them
* Do not expose raw database errors to clients
* Keep response formats consistent across all endpoints
* Use pagination for list endpoints

---

# Recommended Usage

## Success

```go
response.Success(c, http.StatusOK, data)
```

---

## Error

```go
response.Error(
    c,
    http.StatusBadRequest,
    response.CodeValidationError,
    "validation failed",
)
```

---

## Pagination

```go
response.Paginated(
    c,
    http.StatusOK,
    products,
    pagination,
)
```
