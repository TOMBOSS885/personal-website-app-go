package com.personal.website.controller;

import com.personal.website.config.UploadProperties;
import com.personal.website.entity.Live2DModel;
import com.personal.website.entity.Live2DSettings;
import com.personal.website.repository.Live2DModelRepository;
import com.personal.website.repository.Live2DSettingsRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@RestController
@CrossOrigin
public class Live2DModelController {
    private final Live2DModelRepository live2DModelRepository;
    private final Live2DSettingsRepository live2DSettingsRepository;
    private final UploadProperties uploadProperties;

    public Live2DModelController(
        Live2DModelRepository live2DModelRepository,
        Live2DSettingsRepository live2DSettingsRepository,
        UploadProperties uploadProperties
    ) {
        this.live2DModelRepository = live2DModelRepository;
        this.live2DSettingsRepository = live2DSettingsRepository;
        this.uploadProperties = uploadProperties;
    }

    @GetMapping("/api/public/live2d-model")
    public ResponseEntity<?> getActiveModel() {
        Live2DSettings settings = getOrCreateSettings();
        if (!Boolean.TRUE.equals(settings.getEnabled())) {
            return ResponseEntity.ok(Map.of("enabled", false));
        }

        List<Live2DModel> switchableModels = live2DModelRepository.findAllBySwitchableTrueOrderByDisplayOrderAscCreatedAtDesc();
        if (switchableModels.isEmpty()) {
            switchableModels = live2DModelRepository.findByActiveTrue().stream().toList();
        }
        if (switchableModels.isEmpty()) {
            return ResponseEntity.ok(Map.of("enabled", false));
        }

        return ResponseEntity.ok(Map.of(
            "enabled", true,
            "settings", settingsToDto(settings),
            "models", switchableModels.stream().map(this::toDto).toList()
        ));
    }

    @GetMapping("/api/admin/live2d-models")
    public ResponseEntity<Map<String, Object>> getModels() {
        return ResponseEntity.ok(Map.of(
            "settings", settingsToDto(getOrCreateSettings()),
            "models", live2DModelRepository.findAllByOrderByCreatedAtDesc().stream()
                .map(this::toDto)
                .toList()
        ));
    }

    @PutMapping("/api/admin/live2d-settings")
    public ResponseEntity<?> updateSettings(@RequestBody Map<String, Object> payload) {
        Live2DSettings settings = getOrCreateSettings();
        settings.setEnabled(boolValue(payload.get("enabled"), settings.getEnabled()));
        settings.setPosition(stringValue(payload.get("position"), settings.getPosition()));
        settings.setSize(intValue(payload.get("size"), settings.getSize()));
        settings.setPrimaryColor(stringValue(payload.get("primaryColor"), settings.getPrimaryColor()));
        settings.setTransitionType(stringValue(payload.get("transitionType"), settings.getTransitionType()));
        settings.setTransitionDuration(intValue(payload.get("transitionDuration"), settings.getTransitionDuration()));
        settings.setMenuAlign(stringValue(payload.get("menuAlign"), settings.getMenuAlign()));
        settings.setShowSleepButton(boolValue(payload.get("showSleepButton"), settings.getShowSleepButton()));
        settings.setShowAboutButton(boolValue(payload.get("showAboutButton"), settings.getShowAboutButton()));
        return ResponseEntity.ok(settingsToDto(live2DSettingsRepository.save(settings)));
    }

    @PostMapping("/api/admin/live2d-models")
    public ResponseEntity<?> uploadModel(
        @RequestParam("name") String name,
        @RequestParam("files") MultipartFile[] files,
        @RequestParam("paths") List<String> relativePaths,
        @RequestParam(value = "entryPath", required = false) String entryPath
    ) throws IOException {
        if (files.length == 0 || files.length != relativePaths.size()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Please upload a complete Live2D model folder."));
        }

        String directory = UUID.randomUUID().toString();
        Path root = Paths.get(uploadProperties.getDir()).toAbsolutePath().normalize();
        Path modelDir = root.resolve("live2d").resolve(directory).normalize();
        Files.createDirectories(modelDir);

        String detectedEntryPath = null;
        for (int i = 0; i < files.length; i++) {
            MultipartFile file = files[i];
            String cleanPath = normalizeRelativePath(relativePaths.get(i));
            Path target = modelDir.resolve(cleanPath).normalize();
            if (!target.startsWith(modelDir)) {
                return ResponseEntity.badRequest().body(Map.of("message", "Invalid model file path."));
            }

            Files.createDirectories(target.getParent());
            file.transferTo(target);

            if (isModelJson(cleanPath) && (detectedEntryPath == null || cleanPath.endsWith(".model3.json"))) {
                detectedEntryPath = cleanPath;
            }
        }

        String cleanEntryPath = entryPath == null || entryPath.isBlank()
            ? detectedEntryPath
            : normalizeRelativePath(entryPath);
        if (cleanEntryPath == null || !isModelJson(cleanEntryPath)) {
            return ResponseEntity.badRequest().body(Map.of("message", "No model.json or .model3.json file was found."));
        }
        if (!Files.exists(modelDir.resolve(cleanEntryPath).normalize())) {
            return ResponseEntity.badRequest().body(Map.of("message", "The selected model entry file does not exist."));
        }

        Live2DModel model = new Live2DModel();
        model.setName(name == null || name.isBlank() ? directory : name.trim());
        model.setDirectory(directory);
        model.setModelPath("/uploads/live2d/" + directory + "/" + cleanEntryPath.replace("\\", "/"));
        model.setActive(live2DModelRepository.count() == 0);
        model.setSwitchable(true);
        model.setDisplayOrder((int) live2DModelRepository.count());

        Live2DModel saved = live2DModelRepository.save(model);
        return ResponseEntity.ok(toDto(saved));
    }

    @PutMapping("/api/admin/live2d-models/{id}")
    public ResponseEntity<?> updateModel(@PathVariable Long id, @RequestBody Map<String, Object> payload) {
        return live2DModelRepository.findById(id)
            .map(model -> {
                model.setName(stringValue(payload.get("name"), model.getName()));
                model.setSwitchable(boolValue(payload.get("switchable"), model.getSwitchable()));
                model.setDisplayOrder(intValue(payload.get("displayOrder"), model.getDisplayOrder()));
                model.setScale(doubleValue(payload.get("scale"), model.getScale()));
                model.setOffsetX(doubleValue(payload.get("offsetX"), model.getOffsetX()));
                model.setOffsetY(doubleValue(payload.get("offsetY"), model.getOffsetY()));
                model.setVolume(doubleValue(payload.get("volume"), model.getVolume()));
                model.setTipsEnabled(boolValue(payload.get("tipsEnabled"), model.getTipsEnabled()));
                model.setWelcomeMessages(stringValue(payload.get("welcomeMessages"), model.getWelcomeMessages()));
                model.setTipMessages(stringValue(payload.get("tipMessages"), model.getTipMessages()));
                model.setTipDuration(intValue(payload.get("tipDuration"), model.getTipDuration()));
                model.setTipInterval(intValue(payload.get("tipInterval"), model.getTipInterval()));
                model.setTipOffsetX(intValue(payload.get("tipOffsetX"), model.getTipOffsetX()));
                model.setTipOffsetY(intValue(payload.get("tipOffsetY"), model.getTipOffsetY()));
                model.setTypingEnabled(boolValue(payload.get("typingEnabled"), model.getTypingEnabled()));
                model.setTypingParam(stringValue(payload.get("typingParam"), model.getTypingParam()));
                model.setTypingSpeed(intValue(payload.get("typingSpeed"), model.getTypingSpeed()));
                model.setTypingMinValue(doubleValue(payload.get("typingMinValue"), model.getTypingMinValue()));
                model.setTypingMaxValue(doubleValue(payload.get("typingMaxValue"), model.getTypingMaxValue()));
                return ResponseEntity.ok(toDto(live2DModelRepository.save(model)));
            })
            .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/api/admin/live2d-models/{id}/activate")
    public ResponseEntity<?> activateModel(@PathVariable Long id) {
        return live2DModelRepository.findById(id)
            .map(model -> {
                live2DModelRepository.findAll().forEach(existing -> {
                    existing.setActive(existing.getId().equals(id));
                    live2DModelRepository.save(existing);
                });
                return ResponseEntity.ok(toDto(model));
            })
            .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/api/admin/live2d-models/{id}")
    public ResponseEntity<Void> deleteModel(@PathVariable Long id) {
        live2DModelRepository.findById(id).ifPresent(model -> {
            live2DModelRepository.delete(model);
            try {
                Path modelDir = Paths.get(uploadProperties.getDir()).toAbsolutePath().normalize()
                    .resolve("live2d")
                    .resolve(model.getDirectory())
                    .normalize();
                deleteDirectory(modelDir);
            } catch (IOException ignored) {
            }
        });
        return ResponseEntity.ok().build();
    }

    private Map<String, Object> toDto(Live2DModel model) {
        Optional<String> thumbnailPath = findThumbnailPath(model);
        Map<String, Object> dto = new java.util.LinkedHashMap<>();
        dto.put("id", model.getId());
        dto.put("name", model.getName());
        dto.put("modelPath", model.getModelPath());
        dto.put("thumbnailPath", thumbnailPath.orElse(""));
        dto.put("active", model.getActive());
        dto.put("switchable", model.getSwitchable());
        dto.put("displayOrder", model.getDisplayOrder());
        dto.put("scale", model.getScale());
        dto.put("offsetX", model.getOffsetX());
        dto.put("offsetY", model.getOffsetY());
        dto.put("volume", model.getVolume());
        dto.put("tipsEnabled", model.getTipsEnabled());
        dto.put("welcomeMessages", model.getWelcomeMessages());
        dto.put("tipMessages", model.getTipMessages());
        dto.put("tipDuration", model.getTipDuration());
        dto.put("tipInterval", model.getTipInterval());
        dto.put("tipOffsetX", model.getTipOffsetX());
        dto.put("tipOffsetY", model.getTipOffsetY());
        dto.put("typingEnabled", model.getTypingEnabled());
        dto.put("typingParam", model.getTypingParam());
        dto.put("typingSpeed", model.getTypingSpeed());
        dto.put("typingMinValue", model.getTypingMinValue());
        dto.put("typingMaxValue", model.getTypingMaxValue());
        dto.put("createdAt", model.getCreatedAt());
        return dto;
    }

    private Map<String, Object> settingsToDto(Live2DSettings settings) {
        Map<String, Object> dto = new java.util.LinkedHashMap<>();
        dto.put("enabled", settings.getEnabled());
        dto.put("position", settings.getPosition());
        dto.put("size", settings.getSize());
        dto.put("primaryColor", settings.getPrimaryColor());
        dto.put("transitionType", settings.getTransitionType());
        dto.put("transitionDuration", settings.getTransitionDuration());
        dto.put("menuAlign", settings.getMenuAlign());
        dto.put("showSleepButton", settings.getShowSleepButton());
        dto.put("showAboutButton", settings.getShowAboutButton());
        return dto;
    }

    private Live2DSettings getOrCreateSettings() {
        return live2DSettingsRepository.findAll().stream()
            .findFirst()
            .orElseGet(() -> live2DSettingsRepository.save(new Live2DSettings()));
    }

    private String stringValue(Object value, String fallback) {
        return value == null ? fallback : value.toString();
    }

    private Boolean boolValue(Object value, Boolean fallback) {
        return value instanceof Boolean bool ? bool : fallback;
    }

    private Integer intValue(Object value, Integer fallback) {
        if (value instanceof Number number) {
            return number.intValue();
        }
        try {
            return value == null ? fallback : Integer.parseInt(value.toString());
        } catch (NumberFormatException ignored) {
            return fallback;
        }
    }

    private Double doubleValue(Object value, Double fallback) {
        if (value instanceof Number number) {
            return number.doubleValue();
        }
        try {
            return value == null ? fallback : Double.parseDouble(value.toString());
        } catch (NumberFormatException ignored) {
            return fallback;
        }
    }

    private String normalizeRelativePath(String path) {
        return path.replace("\\", "/")
            .replaceAll("^/+", "")
            .replaceAll("^[A-Za-z]:", "");
    }

    private boolean isModelJson(String path) {
        String lower = path.toLowerCase();
        return lower.endsWith("model.json") || lower.endsWith(".model3.json");
    }

    private Optional<String> findThumbnailPath(Live2DModel model) {
        Path modelDir = Paths.get(uploadProperties.getDir()).toAbsolutePath().normalize()
            .resolve("live2d")
            .resolve(model.getDirectory())
            .normalize();
        if (!Files.exists(modelDir)) {
            return Optional.empty();
        }

        try (var stream = Files.walk(modelDir)) {
            return stream
                .filter(Files::isRegularFile)
                .filter(this::isImageFile)
                .sorted(Comparator
                    .comparingInt((Path path) -> imagePriority(modelDir.relativize(path).toString()))
                    .thenComparing(path -> modelDir.relativize(path).toString()))
                .findFirst()
                .map(path -> "/uploads/live2d/" + model.getDirectory() + "/"
                    + modelDir.relativize(path).toString().replace("\\", "/"));
        } catch (IOException ignored) {
            return Optional.empty();
        }
    }

    private boolean isImageFile(Path path) {
        String lower = path.getFileName().toString().toLowerCase();
        return lower.endsWith(".png")
            || lower.endsWith(".jpg")
            || lower.endsWith(".jpeg")
            || lower.endsWith(".webp")
            || lower.endsWith(".gif");
    }

    private int imagePriority(String relativePath) {
        String lower = relativePath.replace("\\", "/").toLowerCase();
        if (lower.contains("preview") || lower.contains("thumb") || lower.contains("cover") || lower.contains("icon")) {
            return 0;
        }
        if (!lower.contains("texture")) {
            return 1;
        }
        return 2;
    }

    private void deleteDirectory(Path directory) throws IOException {
        if (!Files.exists(directory)) {
            return;
        }
        try (var stream = Files.walk(directory)) {
            stream.sorted((a, b) -> b.compareTo(a))
                .forEach(path -> {
                    try {
                        Files.deleteIfExists(path);
                    } catch (IOException ignored) {
                    }
                });
        }
    }
}
