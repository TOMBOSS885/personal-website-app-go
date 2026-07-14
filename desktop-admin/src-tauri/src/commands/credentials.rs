const CREDENTIAL_SERVICE: &str = "com.personalwebsite.studio";
const MAX_PROFILE_ID_LENGTH: usize = 128;
const MAX_TOKEN_LENGTH: usize = 16 * 1024;

fn validate_profile_id(profile_id: &str) -> Result<(), String> {
    if profile_id.is_empty() || profile_id.len() > MAX_PROFILE_ID_LENGTH {
        return Err("profile_id must contain between 1 and 128 bytes".into());
    }

    if !profile_id.bytes().all(|byte| {
        byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b'.' | b':' | b'@')
    }) {
        return Err("profile_id contains unsupported characters".into());
    }

    Ok(())
}

fn validate_token(token: &str) -> Result<(), String> {
    if token.is_empty() || token.len() > MAX_TOKEN_LENGTH {
        return Err("credential value has an invalid length".into());
    }

    if token.chars().any(char::is_control) {
        return Err("credential value contains control characters".into());
    }

    Ok(())
}

fn entry(profile_id: &str) -> Result<keyring::Entry, String> {
    validate_profile_id(profile_id)?;
    keyring::Entry::new(CREDENTIAL_SERVICE, profile_id)
        .map_err(|_| "system credential store is unavailable".into())
}

#[tauri::command]
pub async fn credential_get(profile_id: String) -> Result<Option<String>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let entry = entry(&profile_id)?;
        match entry.get_password() {
            Ok(value) => Ok(Some(value)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(_) => Err("failed to read the system credential".into()),
        }
    })
    .await
    .map_err(|_| "credential operation was interrupted".to_string())?
}

#[tauri::command]
pub async fn credential_set(profile_id: String, token: String) -> Result<(), String> {
    validate_token(&token)?;

    tauri::async_runtime::spawn_blocking(move || {
        entry(&profile_id)?
            .set_password(&token)
            .map_err(|_| "failed to save the system credential".to_string())
    })
    .await
    .map_err(|_| "credential operation was interrupted".to_string())?
}

#[tauri::command]
pub async fn credential_delete(profile_id: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let entry = entry(&profile_id)?;
        match entry.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(_) => Err("failed to delete the system credential".into()),
        }
    })
    .await
    .map_err(|_| "credential operation was interrupted".to_string())?
}

#[cfg(test)]
mod tests {
    use super::{validate_profile_id, validate_token};

    #[test]
    fn profile_id_accepts_stable_identifiers() {
        assert!(validate_profile_id("production:admin@example.com").is_ok());
    }

    #[test]
    fn profile_id_rejects_path_and_control_characters() {
        assert!(validate_profile_id("../production").is_err());
        assert!(validate_profile_id("production\nadmin").is_err());
    }

    #[test]
    fn token_rejects_empty_and_control_characters() {
        assert!(validate_token("").is_err());
        assert!(validate_token("secret\nvalue").is_err());
        assert!(validate_token("header.payload.signature").is_ok());
    }
}
