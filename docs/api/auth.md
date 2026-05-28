# Authentication API

## Overview

The Authentication API provides endpoints for user registration, login, and session management using JWT tokens.

## Base URL

```
https://api.aether.app/api/v1/auth
```

## Endpoints

### Register User

Create a new user account.

```
POST /register
```

#### Request Body

```json
{
  "email": "user@example.com",
  "username": "johndoe",
  "password": "securepassword123"
}
```

#### Response (201 Created)

```json
{
  "id": 1,
  "email": "user@example.com",
  "username": "johndoe",
  "created_at": "2024-01-15T10:30:00Z"
}
```

#### Errors

| Code | Description |
|------|-------------|
| 400 | Invalid email format |
| 409 | Email already exists |
| 422 | Password too weak |

---

### Login

Authenticate a user and obtain access tokens.

```
POST /login
```

#### Request Body

```json
{
  "email": "user@example.com",
  "password": "securepassword123"
}
```

#### Response (200 OK)

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer",
  "expires_in": 3600
}
```

#### Errors

| Code | Description |
|------|-------------|
| 401 | Invalid credentials |
| 423 | Account locked |

---

### Refresh Token

Obtain a new access token using a refresh token.

```
POST /refresh
```

#### Request Body

```json
{
  "refresh_token": "eyJhbGciOiJIUzI1NiIs..."
}
```

#### Response (200 OK)

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer",
  "expires_in": 3600
}
```

---

### Get Current User

Retrieve the authenticated user's profile.

```
GET /me
```

#### Headers

```
Authorization: Bearer <access_token>
```

#### Response (200 OK)

```json
{
  "id": 1,
  "email": "user@example.com",
  "username": "johndoe",
  "role": "user",
  "created_at": "2024-01-15T10:30:00Z"
}
```

---

### Update Profile

Update user profile information.

```
PUT /me
```

#### Headers

```
Authorization: Bearer <access_token>
```

#### Request Body

```json
{
  "username": "johndoe_updated",
  "bio": "AI enthusiast"
}
```

#### Response (200 OK)

```json
{
  "id": 1,
  "email": "user@example.com",
  "username": "johndoe_updated",
  "bio": "AI enthusiast",
  "updated_at": "2024-01-16T12:00:00Z"
}
```

---

### Change Password

Change user's password.

```
POST /password
```

#### Headers

```
Authorization: Bearer <access_token>
```

#### Request Body

```json
{
  "current_password": "oldpassword",
  "new_password": "newsecurepassword"
}
```

#### Response (200 OK)

```json
{
  "message": "Password updated successfully"
}
```

---

### Logout

Invalidate the current session.

```
POST /logout
```

#### Headers

```
Authorization: Bearer <access_token>
```

#### Response (200 OK)

```json
{
  "message": "Logged out successfully"
}
```

---

## Error Responses

All endpoints may return the following error responses:

```json
{
  "error": "error_code",
  "message": "Human readable message",
  "details": {}
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| invalid_token | 401 | Token is invalid or expired |
| insufficient_permissions | 403 | User lacks required permissions |
| rate_limited | 429 | Too many requests |
| server_error | 500 | Internal server error |