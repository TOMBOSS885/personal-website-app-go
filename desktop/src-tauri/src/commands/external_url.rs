use tauri::AppHandle;
use tauri_plugin_opener::OpenerExt;
use url::Url;

fn validate_external_url(value: &str) -> Result<Url, String> {
    if value
        .chars()
        .any(|character| matches!(character, '\r' | '\n'))
    {
        return Err("external URL must not contain CR or LF characters".into());
    }

    let url = Url::parse(value).map_err(|_| "external URL is invalid".to_string())?;

    if !url.username().is_empty() || url.password().is_some() {
        return Err("external URL must not contain credentials".into());
    }

    match url.scheme() {
        "https" if url.host_str().is_some() => Ok(url),
        "http"
            if url.host_str().is_some()
                && cfg!(debug_assertions)
                && is_local_development_host(&url) =>
        {
            Ok(url)
        }
        "mailto" => validate_mailto_url(value, url),
        _ => Err("external URL must use HTTPS".into()),
    }
}

fn validate_mailto_url(value: &str, url: Url) -> Result<Url, String> {
    if url.host_str().is_some() || !url.cannot_be_a_base() || url.fragment().is_some() {
        return Err("mailto URL has an invalid structure".into());
    }
    if contains_percent_decoded_crlf(value.as_bytes()) {
        return Err("mailto URL must not contain CR or LF characters".into());
    }

    let recipients = url.path();
    if recipients.is_empty() || recipients.split(',').any(invalid_mail_recipient) {
        return Err("mailto URL must contain a valid recipient address".into());
    }

    Ok(url)
}

fn invalid_mail_recipient(recipient: &str) -> bool {
    let decoded = fully_percent_decode(recipient.as_bytes());
    let Ok(recipient) = std::str::from_utf8(&decoded) else {
        return true;
    };

    if recipient.is_empty()
        || recipient.trim() != recipient
        || recipient.chars().any(|character| {
            matches!(character, ':' | '/' | '\\')
                || character.is_control()
                || character.is_whitespace()
        })
    {
        return true;
    }

    let mut parts = recipient.split('@');
    matches!(
        (parts.next(), parts.next(), parts.next()),
        (Some(local), Some(domain), None) if local.is_empty() || domain.is_empty()
    ) || recipient.matches('@').count() != 1
}

fn contains_percent_decoded_crlf(value: &[u8]) -> bool {
    fully_percent_decode(value)
        .iter()
        .any(|byte| matches!(byte, b'\r' | b'\n'))
}

fn fully_percent_decode(value: &[u8]) -> Vec<u8> {
    let mut current = value.to_vec();

    loop {
        let (decoded, changed) = percent_decode_once(&current);
        if !changed {
            return current;
        }
        current = decoded;
    }
}

fn percent_decode_once(value: &[u8]) -> (Vec<u8>, bool) {
    let mut decoded = Vec::with_capacity(value.len());
    let mut index = 0;
    let mut changed = false;

    while index < value.len() {
        if value[index] == b'%' && index + 2 < value.len() {
            if let (Some(high), Some(low)) =
                (hex_value(value[index + 1]), hex_value(value[index + 2]))
            {
                decoded.push((high << 4) | low);
                index += 3;
                changed = true;
                continue;
            }
        }

        decoded.push(value[index]);
        index += 1;
    }

    (decoded, changed)
}

fn hex_value(value: u8) -> Option<u8> {
    match value {
        b'0'..=b'9' => Some(value - b'0'),
        b'a'..=b'f' => Some(value - b'a' + 10),
        b'A'..=b'F' => Some(value - b'A' + 10),
        _ => None,
    }
}

fn is_local_development_host(url: &Url) -> bool {
    matches!(url.host_str(), Some("localhost" | "127.0.0.1"))
}

#[tauri::command]
pub fn open_external_url(app: AppHandle, url: String) -> Result<(), String> {
    let url = validate_external_url(&url)?;
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
    }

    #[test]
    fn allows_mailto_with_recipients_and_safe_headers() {
        assert!(validate_external_url("mailto:hello@example.com").is_ok());
        assert!(validate_external_url(
            "mailto:hello@example.com,team@example.com?subject=Hello&body=Thanks%20again"
        )
        .is_ok());
    }

    #[test]
    fn rejects_mailto_without_a_valid_recipient() {
        assert!(validate_external_url("mailto:").is_err());
        assert!(validate_external_url("mailto:?subject=Hello").is_err());
        assert!(validate_external_url("mailto:hello@").is_err());
        assert!(validate_external_url("mailto:user:secret@example.com").is_err());
        assert!(validate_external_url("mailto:user%3Asecret@example.com").is_err());
        assert!(validate_external_url("mailto:hello%20world@example.com").is_err());
        assert!(validate_external_url("mailto://user:secret@example.com").is_err());
    }

    #[test]
    fn rejects_mailto_header_injection() {
        assert!(validate_external_url(
            "mailto:hello@example.com?subject=Hello\r\nBcc:evil@example.com"
        )
        .is_err());
        assert!(validate_external_url(
            "mailto:hello@example.com?subject=Hello%0d%0aBcc:evil@example.com"
        )
        .is_err());
        assert!(validate_external_url(
            "mailto:hello@example.com?subject=Hello%250D%250ABcc:evil@example.com"
        )
        .is_err());
    }

    #[test]
    fn plain_http_is_limited_to_debug_localhost() {
        let local = validate_external_url("http://127.0.0.1:8080/api/health");
        let remote = validate_external_url("http://example.com");

        assert_eq!(local.is_ok(), cfg!(debug_assertions));
        assert!(remote.is_err());
    }
}
