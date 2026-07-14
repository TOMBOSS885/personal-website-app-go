# Desktop user authentication API

The desktop blog uses a user bearer token. The existing web login remains cookie-based and unchanged.

## Login

`POST /api/user-auth/desktop/login`

Request:

```json
{
  "identifier": "reader@example.com",
  "password": "user-password"
}
```

Successful response (`200`, always `Cache-Control: no-store`):

```json
{
  "accessToken": "<signed-user-jwt>",
  "tokenType": "Bearer",
  "expiresAt": "2026-07-15T04:00:00Z",
  "expiresIn": 86400,
  "user": {
    "id": 42,
    "username": "reader",
    "email": "reader@example.com",
    "status": "active",
    "passwordConfigured": true,
    "createdAt": "2026-07-14T04:00:00Z",
    "lastActiveAt": "2026-07-14T04:00:00Z"
  }
}
```

The desktop endpoint does not set the user session cookie. Store `accessToken` in the operating-system credential store, never in local storage, SQLite, URLs, or logs. Send it as `Authorization: Bearer <accessToken>`.

The existing `POST /api/user-auth/login` continues to set the `pw_user_session` HttpOnly, SameSite=Strict cookie and continues to return only the public user object. Web clients do not need to change.

## Authenticated routes

The bearer token can be used with:

- `GET /api/account/me`
- `PUT /api/account/username`
- `POST /api/account/logout`
- `POST /api/user/comments`
- `PUT /api/user/comments/:id`
- `DELETE /api/user/comments/:id`
- `GET /api/public/music`

The music list returns short-lived HMAC-signed stream and lyrics URLs. Those signed URLs are media capabilities and can be used by an `<audio>` element without putting the bearer token in a query parameter. They remain replayable until their configured `MEDIA_URL_TTL_SECONDS` expiry (10 minutes by default), even if the account logs out during that interval.

## Expiration and revocation

User access tokens use the configured `JWT_EXPIRATION` lifetime (5 minutes minimum, 7 days maximum, 24 hours by default). There is no refresh token. On `401`, the desktop app removes the stored token and asks the user to sign in again.

Each token contains the user's current `token_version`. The server rejects a token when the stored version changes. These operations increment the version and therefore revoke every existing web and desktop user session:

- a successful authenticated `POST /api/account/logout`;
- a password reset;
- an administrator disabling or re-enabling the user.

Logout is intentionally all-sessions logout. A token that has already expired, is malformed, or was already revoked cannot authenticate the logout request; the client should still delete its local credential.

Native Tauri HTTP requests do not require a CORS origin entry. If the WebView itself sends requests, configure its exact origin instead of setting `CORS_ALLOWED_ORIGINS=*`.
