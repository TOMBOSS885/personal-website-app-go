package handler

import "testing"

func TestNormalizeRelativePathRejectsTraversal(t *testing.T) {
	if got := normalizeRelativePath("../model.model3.json"); got != "" {
		t.Fatalf("expected traversal path to be rejected, got %q", got)
	}
	if got := normalizeRelativePath("safe\\model.model3.json"); got != "safe/model.model3.json" {
		t.Fatalf("expected normalized safe path, got %q", got)
	}
}

func TestDisallowedLive2DFileExtensions(t *testing.T) {
	blocked := []string{"index.html", "script.js", "run.sh", "image.svg"}
	for _, path := range blocked {
		if !isDisallowedLive2DFile(path) {
			t.Fatalf("expected %q to be blocked", path)
		}
	}

	allowed := []string{"model.model3.json", "model.moc3", "textures/texture_00.png"}
	for _, path := range allowed {
		if isDisallowedLive2DFile(path) {
			t.Fatalf("expected %q to be allowed", path)
		}
	}
}
