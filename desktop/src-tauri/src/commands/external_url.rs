use tauri::AppHandle;
use tauri_plugin_opener::OpenerExt;
use url::Url;

fn validate_external_url(value: &str) -> Result<Url, String> {
    let url = Url::parse(value).map_err(|_| "external URL is invalid".to_string())?;

    if url.host_str().is_none() {
        return Err("external URL must include a host".into());
    }

    if !url.username().is_empty() || url.password().is_some() {
        return Err("external URL must not contain credentials".into());
    }

    match url.scheme() {
        "https" => Ok(url),
        "http" if cfg!(debug_assertions) && is_local_development_host(&url) => Ok(url),
        _ => Err("external URL must use HTTPS".into()),
    }
}

fn is_local_development_host(url: &Url) -> bool {
    matches!(url.host_str(), Some("localhost" | "127.0.0.1"))
}

#[tauri::command]
pub fn open_external_url(app: AppHandle, validated_url: String) -> Result<(), String> {
    let url = validate_external_url(&validated_url)?;
    app.opener()
        .open_url(url.as_str(), None::<&str>)
        .map_err(|_| "failed to open the external URL".to_string())
}

#[cfg(test)]
mod tests {
    use super::validate_external_url;

    #[test]
    fn allows_https_urls_without_embedded_credentials() {
        assert!(validate_external_url("https://example.com/articles/1").is_ok());
        assert!(validate_external_url("https://user:password@example.com").is_err());
    }

    #[test]
    fn rejects_dangerous_schemes() {
        assert!(validate_external_url("javascript:alert(1)").is_err());
        assert!(validate_external_url("file:///etc/passwd").is_err());
        assert!(validate_external_url("mailto:admin@example.com").is_err());
    }

    #[test]
    fn plain_http_is_limited_to_debug_localhost() {
        let local = validate_external_url("http://127.0.0.1:8080/api/health");
        let remote = validate_external_url("http://example.com");

        assert_eq!(local.is_ok(), cfg!(debug_assertions));
        assert!(remote.is_err());
    }
}
