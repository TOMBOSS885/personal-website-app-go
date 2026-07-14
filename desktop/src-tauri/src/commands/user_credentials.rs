use url::{Host, Url};

const CREDENTIAL_SERVICE: &str = "com.personalwebsite.blog.user-session";
const MAX_SERVER_URL_LENGTH: usize = 2 * 1024;
const MAX_PROFILE_KEY_LENGTH: usize = 384;
const MAX_TOKEN_LENGTH: usize = 16 * 1024;

fn is_loopback_host(url: &Url) -> bool {
    match url.host() {
        Some(Host::Domain(host)) => host.eq_ignore_ascii_case("localhost"),
        Some(Host::Ipv4(address)) => address.is_loopback(),
        Some(Host::Ipv6(address)) => address.is_loopback(),
        None => false,
    }
}

fn server_profile_key(server_url: &str) -> Result<String, String> {
    let server_url = server_url.trim();
    if server_url.is_empty() || server_url.len() > MAX_SERVER_URL_LENGTH {
        return Err("server_url has an invalid length".into());
    }
    if server_url.chars().any(char::is_control) {
        return Err("server_url contains control characters".into());
    }

    let mut url = Url::parse(server_url).map_err(|_| "server_url is not a valid URL")?;
    if !url.username().is_empty() || url.password().is_some() {
        return Err("server_url must not contain credentials".into());
    }
    if url.query().is_some() || url.fragment().is_some() {
        return Err("server_url must not contain a query or fragment".into());
    }
    if url.host().is_none() {
        return Err("server_url must contain a host".into());
    }

    match url.scheme() {
        "https" => {}
        "http" if is_loopback_host(&url) => {}
        "http" => return Err("remote server_url must use HTTPS".into()),
        _ => return Err("server_url must use HTTP or HTTPS".into()),
    }

    let uses_default_port = matches!(
        (url.scheme(), url.port()),
        ("http", Some(80)) | ("https", Some(443))
    );
    if uses_default_port {
        url.set_port(None)
            .map_err(|_| "server_url contains an invalid port")?;
    }

    let normalized_path = url.path().trim_end_matches('/').to_owned();
    url.set_path(&normalized_path);
    let profile_key = url.as_str().trim_end_matches('/').to_owned();
    if profile_key.is_empty() || profile_key.len() > MAX_PROFILE_KEY_LENGTH {
        return Err("server_url produces an invalid credential profile key".into());
    }

    Ok(profile_key)
}

fn validate_token(token: &str) -> Result<(), String> {
    if token.is_empty() || token.len() > MAX_TOKEN_LENGTH {
        return Err("token has an invalid length".into());
    }
    if token.chars().any(char::is_whitespace) {
        return Err("token contains whitespace".into());
    }

    Ok(())
}

fn entry(server_url: &str) -> Result<keyring::Entry, String> {
    let profile_key = server_profile_key(server_url)?;
    keyring::Entry::new(CREDENTIAL_SERVICE, &profile_key)
        .map_err(|_| "Windows credential storage is unavailable".into())
}

#[tauri::command]
pub async fn save_user_token(server_url: String, token: String) -> Result<(), String> {
    validate_token(&token)?;
    let profile_key = server_profile_key(&server_url)?;

    tauri::async_runtime::spawn_blocking(move || {
        keyring::Entry::new(CREDENTIAL_SERVICE, &profile_key)
            .map_err(|_| "Windows credential storage is unavailable".to_string())?
            .set_password(&token)
            .map_err(|_| "failed to save the user token".to_string())
    })
    .await
    .map_err(|_| "credential operation was interrupted".to_string())?
}

#[tauri::command]
pub async fn load_user_token(server_url: String) -> Result<Option<String>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let entry = entry(&server_url)?;
        match entry.get_password() {
            Ok(token) => Ok(Some(token)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(_) => Err("failed to load the user token".into()),
        }
    })
    .await
    .map_err(|_| "credential operation was interrupted".to_string())?
}

#[tauri::command]
pub async fn delete_user_token(server_url: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let entry = entry(&server_url)?;
        match entry.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(_) => Err("failed to delete the user token".into()),
        }
    })
    .await
    .map_err(|_| "credential operation was interrupted".to_string())?
}

#[cfg(test)]
mod tests {
    use super::{server_profile_key, validate_token};

    #[test]
    fn profile_key_normalizes_equivalent_server_urls() {
        assert_eq!(
            server_profile_key(" HTTPS://Example.COM:443/api/ ").unwrap(),
            "https://example.com/api"
        );
        assert_eq!(
            server_profile_key("http://127.0.0.1:80/").unwrap(),
            "http://127.0.0.1"
        );
    }

    #[test]
    fn profile_key_supports_loopback_development_servers() {
        assert_eq!(
            server_profile_key("http://localhost:8080").unwrap(),
            "http://localhost:8080"
        );
        assert_eq!(
            server_profile_key("http://[::1]:3718/").unwrap(),
            "http://[::1]:3718"
        );
    }

    #[test]
    fn profile_key_rejects_insecure_or_ambiguous_server_urls() {
        assert!(server_profile_key("http://blog.example.com").is_err());
        assert!(server_profile_key("https://user:secret@example.com").is_err());
        assert!(server_profile_key("https://example.com?tenant=one").is_err());
        assert!(server_profile_key("file:///tmp/blog").is_err());
        assert!(server_profile_key("not a URL").is_err());
    }

    #[test]
    fn profile_key_rejects_oversized_values() {
        let long_path = "a".repeat(400);
        assert!(server_profile_key(&format!("https://example.com/{long_path}")).is_err());
    }

    #[test]
    fn token_rejects_empty_oversized_and_whitespace_values() {
        assert!(validate_token("").is_err());
        assert!(validate_token("header.payload.signature").is_ok());
        assert!(validate_token("token with spaces").is_err());
        assert!(validate_token(&"x".repeat(16 * 1024 + 1)).is_err());
    }
}
