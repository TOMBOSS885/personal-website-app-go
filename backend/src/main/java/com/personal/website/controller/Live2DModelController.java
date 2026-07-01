package com.personal.website.controller;

import com.personal.website.config.UploadProperties;
import com.personal.website.entity.Live2DModel;
import com.personal.website.repository.Live2DModelRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@CrossOrigin
public class Live2DModelController {
    private final Live2DModelRepository live2DModelRepository;
    private final UploadProperties uploadProperties;

    public Live2DModelController(Live2DModelRepository live2DModelRepository, UploadProperties uploadProperties) {
        this.live2DModelRepository = live2DModelRepository;
        this.uploadProperties = uploadProperties;
    }

    @GetMapping("/api/public/live2d-model")
    public ResponseEntity<?> getActiveModel() {
        return live2DModelRepository.findByActiveTrue()
            .map(model -> ResponseEntity.ok(toDto(model)))
            .orElse(ResponseEntity.ok(Map.of("enabled", false)));
    }

    @GetMapping("/api/admin/live2d-models")
    public ResponseEntity<List<Map<String, Object>>> getModels() {
        return ResponseEntity.ok(live2DModelRepository.findAllByOrderByCreatedAtDesc().stream()
            .map(this::toDto)
            .toList());
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

        Live2DModel saved = live2DModelRepository.save(model);
        return ResponseEntity.ok(toDto(saved));
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
        return Map.of(
            "id", model.getId(),
            "name", model.getName(),
            "modelPath", model.getModelPath(),
            "active", model.getActive(),
            "createdAt", model.getCreatedAt()
        );
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
