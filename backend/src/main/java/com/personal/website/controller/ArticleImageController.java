package com.personal.website.controller;

import com.personal.website.config.UploadProperties;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@RestController
@RequestMapping("/api/admin/article-images")
@CrossOrigin
public class ArticleImageController {
    private static final long MAX_IMAGE_SIZE = 10L * 1024L * 1024L;
    private static final Set<String> ALLOWED_EXTENSIONS = Set.of("jpg", "jpeg", "png", "gif", "webp");
    private static final Set<String> ALLOWED_CONTENT_TYPES = Set.of(
        "image/jpeg",
        "image/png",
        "image/gif",
        "image/webp"
    );

    private final UploadProperties uploadProperties;

    public ArticleImageController(UploadProperties uploadProperties) {
        this.uploadProperties = uploadProperties;
    }

    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> listImages() throws IOException {
        Path articleRoot = articleRoot();
        if (!Files.exists(articleRoot)) {
            return ResponseEntity.ok(List.of());
        }

        try (var stream = Files.walk(articleRoot)) {
            List<Map<String, Object>> images = stream
                .filter(Files::isRegularFile)
                .filter(this::isAllowedImagePath)
                .sorted(Comparator.comparingLong(this::lastModifiedSafe).reversed())
                .map(path -> toDto(articleRoot, path))
                .toList();
            return ResponseEntity.ok(images);
        }
    }

    @PostMapping
    public ResponseEntity<?> uploadImage(@RequestParam("file") MultipartFile file) throws IOException {
        if (file == null || file.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "请选择要上传的图片。"));
        }
        if (file.getSize() > MAX_IMAGE_SIZE) {
            return ResponseEntity.badRequest().body(Map.of("message", "图片不能超过 10MB。"));
        }

        String extension = getExtension(file.getOriginalFilename());
        if (!ALLOWED_EXTENSIONS.contains(extension)) {
            return ResponseEntity.badRequest().body(Map.of("message", "仅支持 jpg、png、gif、webp 图片。"));
        }
        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED_CONTENT_TYPES.contains(contentType.toLowerCase())) {
            return ResponseEntity.badRequest().body(Map.of("message", "图片类型不被支持。"));
        }

        LocalDate now = LocalDate.now();
        Path articleRoot = articleRoot();
        Path targetDir = articleRoot.resolve(String.valueOf(now.getYear()))
            .resolve(String.format("%02d", now.getMonthValue()))
            .normalize();
        Files.createDirectories(targetDir);

        String filename = UUID.randomUUID() + "." + extension;
        Path target = targetDir.resolve(filename).normalize();
        if (!target.startsWith(articleRoot)) {
            return ResponseEntity.badRequest().body(Map.of("message", "非法图片路径。"));
        }

        file.transferTo(target);
        return ResponseEntity.ok(toDto(articleRoot, target));
    }

    private Path articleRoot() throws IOException {
        Path root = Paths.get(uploadProperties.getDir()).toAbsolutePath().normalize();
        Path articleRoot = root.resolve("articles").normalize();
        Files.createDirectories(articleRoot);
        return articleRoot;
    }

    private boolean isAllowedImagePath(Path path) {
        return ALLOWED_EXTENSIONS.contains(getExtension(path.getFileName().toString()));
    }

    private String getExtension(String filename) {
        if (filename == null) return "";
        int dot = filename.lastIndexOf('.');
        if (dot < 0 || dot == filename.length() - 1) return "";
        return filename.substring(dot + 1).toLowerCase();
    }

    private long lastModifiedSafe(Path path) {
        try {
            return Files.getLastModifiedTime(path).toMillis();
        } catch (IOException ignored) {
            return 0L;
        }
    }

    private Map<String, Object> toDto(Path articleRoot, Path path) {
        Path relativePath = articleRoot.relativize(path);
        String relativeUrl = relativePath.toString().replace("\\", "/");
        long size = 0L;
        try {
            size = Files.size(path);
        } catch (IOException ignored) {
        }

        return Map.of(
            "name", path.getFileName().toString(),
            "url", "/uploads/articles/" + relativeUrl,
            "size", size
        );
    }
}
