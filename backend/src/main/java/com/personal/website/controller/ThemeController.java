package com.personal.website.controller;

import com.personal.website.config.UploadProperties;
import com.personal.website.entity.Theme;
import com.personal.website.repository.ThemeRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Map;
import java.util.HashMap;
import java.util.Set;
import java.util.UUID;

@RestController
@RequestMapping("/api")
@CrossOrigin
public class ThemeController {
    
    private final ThemeRepository themeRepository;
    private final UploadProperties uploadProperties;
    
    public ThemeController(ThemeRepository themeRepository, UploadProperties uploadProperties) {
        this.themeRepository = themeRepository;
        this.uploadProperties = uploadProperties;
    }
    
    // Public endpoint to get active theme
    @GetMapping("/public/theme")
    public ResponseEntity<?> getActiveTheme() {
        return themeRepository.findByIsActiveTrue()
            .map(this::themeToMap)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.ok(Map.of("preset", "purple-pink")));
    }
    
    // Admin endpoint to save theme
    @PostMapping("/admin/theme")
    public ResponseEntity<?> saveTheme(@RequestBody Map<String, Object> themeData) {
        // Deactivate all existing themes
        themeRepository.findAll().forEach(t -> {
            t.setIsActive(false);
            themeRepository.save(t);
        });
        
        Theme theme = new Theme();
        theme.setIsActive(true);
        
        if (themeData.containsKey("preset") && themeData.get("preset") != null) {
            theme.setPresetKey((String) themeData.get("preset"));
            theme.setName("Preset: " + themeData.get("preset"));
        }
        
        if (themeData.containsKey("custom") && themeData.get("custom") != null) {
            @SuppressWarnings("unchecked")
            Map<String, Object> custom = (Map<String, Object>) themeData.get("custom");
            theme.setName("Custom Theme");
            theme.setPrimary((String) custom.getOrDefault("primary", "#8B5CF6"));
            theme.setSecondary((String) custom.getOrDefault("secondary", "#EC4899"));
            theme.setAccent((String) custom.getOrDefault("accent", "#F59E0B"));
            theme.setBackground((String) custom.getOrDefault("background", ""));
            theme.setBackgroundStyle((String) custom.getOrDefault("backgroundStyle", "gradient"));
            theme.setBackgroundImage((String) custom.getOrDefault("backgroundImage", ""));
            theme.setCardBg((String) custom.getOrDefault("cardBg", "rgba(255, 255, 255, 0.1)"));
            theme.setTextPrimary((String) custom.getOrDefault("textPrimary", "#1F2937"));
            theme.setTextSecondary((String) custom.getOrDefault("textSecondary", "#6B7280"));
        }
        
        Theme saved = themeRepository.save(theme);
        return ResponseEntity.ok(themeToMap(saved));
    }

    @PostMapping("/admin/theme/background-image")
    public ResponseEntity<?> uploadBackgroundImage(@RequestParam("file") MultipartFile file) throws IOException {
        if (file == null || file.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Please upload an image file."));
        }

        String contentType = file.getContentType();
        if (contentType == null || !contentType.startsWith("image/")) {
            return ResponseEntity.badRequest().body(Map.of("message", "Only image files are supported."));
        }

        String extension = extensionFromName(file.getOriginalFilename());
        if (!Set.of(".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif", ".svg").contains(extension)) {
            return ResponseEntity.badRequest().body(Map.of("message", "Unsupported image type."));
        }

        Path root = Paths.get(uploadProperties.getDir()).toAbsolutePath().normalize();
        Path targetDir = root.resolve("theme-backgrounds").normalize();
        Files.createDirectories(targetDir);

        String fileName = UUID.randomUUID() + extension;
        Path target = targetDir.resolve(fileName).normalize();
        if (!target.startsWith(targetDir)) {
            return ResponseEntity.badRequest().body(Map.of("message", "Invalid upload path."));
        }

        file.transferTo(target);
        return ResponseEntity.ok(Map.of("url", "/uploads/theme-backgrounds/" + fileName));
    }
    
    // Admin endpoint to get all themes
    @GetMapping("/admin/themes")
    public ResponseEntity<?> getAllThemes() {
        return ResponseEntity.ok(themeRepository.findAll());
    }
    
    private Map<String, Object> themeToMap(Theme theme) {
        Map<String, Object> map = new HashMap<>();
        map.put("id", theme.getId());
        map.put("name", theme.getName());
        
        if (theme.getPresetKey() != null) {
            map.put("preset", theme.getPresetKey());
        }
        
        if (theme.getPrimary() != null) {
            Map<String, Object> custom = new HashMap<>();
            custom.put("primary", theme.getPrimary());
            custom.put("secondary", theme.getSecondary());
            custom.put("accent", theme.getAccent());
            custom.put("background", theme.getBackground());
            custom.put("backgroundStyle", theme.getBackgroundStyle());
            custom.put("backgroundImage", theme.getBackgroundImage());
            custom.put("cardBg", theme.getCardBg());
            custom.put("textPrimary", theme.getTextPrimary());
            custom.put("textSecondary", theme.getTextSecondary());
         map.put("custom", custom);
        }
        
        return map;
    }

    private String extensionFromName(String originalFilename) {
        if (originalFilename == null) {
            return "";
        }
        int dotIndex = originalFilename.lastIndexOf('.');
        return dotIndex >= 0 ? originalFilename.substring(dotIndex).toLowerCase() : "";
    }
}
