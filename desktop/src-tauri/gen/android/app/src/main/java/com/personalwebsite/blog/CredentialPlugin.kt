package com.personalwebsite.blog

import android.app.Activity
import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import java.nio.charset.StandardCharsets
import java.security.KeyStore
import java.security.MessageDigest
import javax.crypto.AEADBadTagException
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

@InvokeArg
class CredentialArgs {
    lateinit var profileKey: String
    var token: String? = null
}

@TauriPlugin
class CredentialPlugin(private val activity: Activity) : Plugin(activity) {
    private val preferences by lazy {
        activity.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)
    }

    @Command
    fun save(invoke: Invoke) {
        try {
            val args = invoke.parseArgs(CredentialArgs::class.java)
            val token = args.token ?: throw IllegalArgumentException("token is required")
            require(token.isNotEmpty() && token.length <= MAX_TOKEN_LENGTH && token.none { it.isWhitespace() })
            val cipher = Cipher.getInstance(CIPHER_TRANSFORMATION)
            cipher.init(Cipher.ENCRYPT_MODE, getOrCreateKey())
            val ciphertext = cipher.doFinal(token.toByteArray(StandardCharsets.UTF_8))
            val payload = ByteArray(1 + cipher.iv.size + ciphertext.size)
            payload[0] = cipher.iv.size.toByte()
            cipher.iv.copyInto(payload, 1)
            ciphertext.copyInto(payload, 1 + cipher.iv.size)
            preferences.edit()
                .putString(storageKey(args.profileKey), Base64.encodeToString(payload, Base64.NO_WRAP))
                .apply()
            invoke.resolve()
        } catch (error: Exception) {
            invoke.reject("secure credential storage is unavailable", error)
        }
    }

    @Command
    fun load(invoke: Invoke) {
        val result = JSObject()
        try {
            val args = invoke.parseArgs(CredentialArgs::class.java)
            val key = storageKey(args.profileKey)
            val encoded = preferences.getString(key, null)
            if (encoded == null) {
                result.put("token", null)
                invoke.resolve(result)
                return
            }
            val payload = Base64.decode(encoded, Base64.NO_WRAP)
            require(payload.isNotEmpty())
            val ivLength = payload[0].toInt() and 0xff
            require(ivLength in 12..16 && payload.size > 1 + ivLength)
            val cipher = Cipher.getInstance(CIPHER_TRANSFORMATION)
            cipher.init(
                Cipher.DECRYPT_MODE,
                getOrCreateKey(),
                GCMParameterSpec(GCM_TAG_LENGTH_BITS, payload.copyOfRange(1, 1 + ivLength)),
            )
            val plaintext = cipher.doFinal(payload.copyOfRange(1 + ivLength, payload.size))
            result.put("token", String(plaintext, StandardCharsets.UTF_8))
            invoke.resolve(result)
        } catch (error: AEADBadTagException) {
            removeCorruptedEntry(invoke, result)
        } catch (error: IllegalArgumentException) {
            removeCorruptedEntry(invoke, result)
        } catch (error: Exception) {
            invoke.reject("secure credential storage is unavailable", error)
        }
    }

    @Command
    fun delete(invoke: Invoke) {
        try {
            val args = invoke.parseArgs(CredentialArgs::class.java)
            preferences.edit().remove(storageKey(args.profileKey)).apply()
            invoke.resolve()
        } catch (error: Exception) {
            invoke.reject("secure credential storage is unavailable", error)
        }
    }

    private fun removeCorruptedEntry(invoke: Invoke, result: JSObject) {
        val args = invoke.parseArgs(CredentialArgs::class.java)
        preferences.edit().remove(storageKey(args.profileKey)).apply()
        result.put("token", null)
        invoke.resolve(result)
    }

    private fun getOrCreateKey(): SecretKey {
        val keyStore = KeyStore.getInstance(ANDROID_KEYSTORE).apply { load(null) }
        (keyStore.getKey(KEY_ALIAS, null) as? SecretKey)?.let { return it }
        val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, ANDROID_KEYSTORE)
        generator.init(
            KeyGenParameterSpec.Builder(
                KEY_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT,
            )
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .setRandomizedEncryptionRequired(true)
                .build(),
        )
        return generator.generateKey()
    }

    private fun storageKey(profileKey: String): String {
        require(profileKey.isNotBlank() && profileKey.length <= MAX_PROFILE_KEY_LENGTH)
        val digest = MessageDigest.getInstance("SHA-256")
            .digest(profileKey.toByteArray(StandardCharsets.UTF_8))
        return Base64.encodeToString(digest, Base64.NO_WRAP or Base64.URL_SAFE)
    }

    companion object {
        private const val ANDROID_KEYSTORE = "AndroidKeyStore"
        private const val KEY_ALIAS = "personal_blog_user_session_v1"
        private const val PREFERENCES_NAME = "encrypted_user_tokens_v1"
        private const val CIPHER_TRANSFORMATION = "AES/GCM/NoPadding"
        private const val GCM_TAG_LENGTH_BITS = 128
        private const val MAX_PROFILE_KEY_LENGTH = 384
        private const val MAX_TOKEN_LENGTH = 16 * 1024
    }
}
