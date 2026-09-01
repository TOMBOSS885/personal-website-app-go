package handler

import (
	"archive/zip"
	"bytes"
	"os"
	"path/filepath"
	"personal-website-go/internal/model"
	"strings"
	"testing"
	"time"
)

func TestArticleSiteRootPrefix(t *testing.T) {
	tests := []struct {
		name    string
		files   map[string]string
		want    string
		wantErr bool
	}{
		{name: "root", files: map[string]string{"index.html": "ok"}, want: ""},
		{name: "single dist", files: map[string]string{"dist/index.html": "ok", "dist/assets/app.js": "ok"}, want: "dist/"},
		{name: "ambiguous", files: map[string]string{"a/index.html": "a", "b/index.html": "b"}, wantErr: true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			reader := testZipReader(t, tt.files)
			got, err := articleSiteRootPrefix(reader.File)
			if tt.wantErr && err == nil {
				t.Fatal("expected error")
			}
			if !tt.wantErr && (err != nil || got != tt.want) {
				t.Fatalf("got prefix %q error %v, want %q", got, err, tt.want)
			}
		})
	}
}

func TestExtractArticleSite(t *testing.T) {
	reader := testZipReader(t, map[string]string{
		"dist/index.html":     "<html></html>",
		"dist/assets/app.js":  "console.log('ok')",
		"dist/assets/app.css": "body{}",
	})
	target := t.TempDir()
	settings := &model.UploadSettings{ArticleSiteTotalMB: 1, ArticleSiteFileCount: 10}
	count, total, err := extractArticleSite(reader.File, "dist/", target, settings)
	if err != nil {
		t.Fatalf("extract failed: %v", err)
	}
	if count != 3 || total <= 0 {
		t.Fatalf("unexpected extraction result count=%d total=%d", count, total)
	}
	if _, err := os.Stat(filepath.Join(target, "index.html")); err != nil {
		t.Fatalf("index.html missing: %v", err)
	}
}

func TestArticleSiteRejectsUnsafePaths(t *testing.T) {
	unsafe := []string{"../secret.js", "/absolute/index.html", ".git/config", "assets/../../secret.js"}
	for _, value := range unsafe {
		if _, err := cleanArticleSitePath(value); err == nil {
			t.Fatalf("expected %q to be rejected", value)
		}
	}
}

func TestArticleSiteExtractionLimits(t *testing.T) {
	reader := testZipReader(t, map[string]string{"index.html": "ok", "app.js": "js"})
	settings := &model.UploadSettings{ArticleSiteTotalMB: 1, ArticleSiteFileCount: 1}
	if _, _, err := extractArticleSite(reader.File, "", t.TempDir(), settings); err == nil {
		t.Fatal("expected file count limit error")
	}
}

func TestArticleSiteAllowsLargeHTMLWithinTotalLimit(t *testing.T) {
	large := string(bytes.Repeat([]byte("x"), 11<<20))
	reader := testZipReader(t, map[string]string{"index.html": large})
	settings := &model.UploadSettings{ArticleSiteTotalMB: 20, ArticleSiteFileCount: 10}
	if _, _, err := extractArticleSite(reader.File, "", t.TempDir(), settings); err != nil {
		t.Fatalf("expected large HTML to be accepted: %v", err)
	}
}

func TestCompatArticleSiteHTMLRewritesInlineModuleScripts(t *testing.T) {
	html := `<!doctype html><html><head>
<link rel="stylesheet" crossorigin href="./style.css">
<script type="module">document.getElementById('app').textContent='ok'</script>
</head><body><div id="app"></div></body></html>`
	got := compatArticleSiteHTML(html)
	if strings.Contains(got, `type="module"`) {
		t.Fatalf("module type should be stripped: %s", got)
	}
	if strings.Contains(got, "crossorigin") {
		t.Fatalf("crossorigin should be stripped: %s", got)
	}
	appIndex := strings.Index(got, `<div id="app"></div>`)
	scriptIndex := strings.Index(got, `<script>document.getElementById('app').textContent='ok'</script>`)
	if appIndex < 0 || scriptIndex < 0 || scriptIndex < appIndex {
		t.Fatalf("inline module script should move after #app: %s", got)
	}
}

func TestCompatArticleSiteHTMLRewritesExternalModuleScripts(t *testing.T) {
	html := `<script type="module" crossorigin src="./assets/js/app.js"></script>`
	got := compatArticleSiteHTML(html)
	if got != `<script src="./assets/js/app.js" defer></script>` {
		t.Fatalf("unexpected rewrite: %s", got)
	}
}

func TestCompatArticleSiteHTMLKeepsRealModules(t *testing.T) {
	html := `<script type="module">import.meta.url; export const x = 1;</script><body></body>`
	got := compatArticleSiteHTML(html)
	if !strings.Contains(got, `type="module"`) {
		t.Fatalf("true ESM should stay a module: %s", got)
	}
}

func TestCompatArticleSiteHTMLRewritesCompilerVizSingleFile(t *testing.T) {
	src := "/home/q/文档/self_learning_3-1/index.html"
	data, err := os.ReadFile(src)
	if err != nil {
		t.Skip(err.Error())
	}
	got := compatArticleSiteHTML(string(data))
	if strings.Contains(strings.ToLower(got), `type="module"`) {
		t.Fatal("compiler viz HTML still contains type=module")
	}
	appIndex := strings.Index(got, `<div id="app"></div>`)
	scriptIndex := strings.LastIndex(strings.ToLower(got), "<script")
	if appIndex < 0 || scriptIndex < appIndex {
		t.Fatal("compiler viz module script was not moved after #app")
	}
	out := filepath.Join(t.TempDir(), "compiler-viz-compat.html")
	if os.Getenv("COMPAT_HTML_OUT") != "" {
		out = os.Getenv("COMPAT_HTML_OUT")
	}
	if err := os.WriteFile(out, []byte(got), 0644); err != nil {
		t.Fatal(err)
	}
}

func TestCompatArticleSiteHTMLLeavesClassicScripts(t *testing.T) {
	html := `<head><script>var a=1</script></head><body></body>`
	got := compatArticleSiteHTML(html)
	if got != html {
		t.Fatalf("classic script changed: %s", got)
	}
}

func TestArticleSiteExpiryIsStableWithinBucket(t *testing.T) {
	base := time.Date(2026, 7, 12, 12, 1, 10, 0, time.UTC)
	first := articleSiteExpiry(base, time.Hour)
	second := articleSiteExpiry(base.Add(2*time.Minute), time.Hour)
	if !first.Equal(second) {
		t.Fatalf("expected stable expiry within bucket, got %v and %v", first, second)
	}
	if first.Before(base.Add(55 * time.Minute)) {
		t.Fatalf("expiry is unexpectedly short: %v", first)
	}
	if first.Before(base.Add(time.Hour)) {
		t.Fatalf("expiry is shorter than the configured TTL: %v", first)
	}
}

func testZipReader(t *testing.T, files map[string]string) *zip.Reader {
	t.Helper()
	var buffer bytes.Buffer
	writer := zip.NewWriter(&buffer)
	for name, content := range files {
		entry, err := writer.Create(name)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := entry.Write([]byte(content)); err != nil {
			t.Fatal(err)
		}
	}
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}
	reader, err := zip.NewReader(bytes.NewReader(buffer.Bytes()), int64(buffer.Len()))
	if err != nil {
		t.Fatal(err)
	}
	return reader
}
