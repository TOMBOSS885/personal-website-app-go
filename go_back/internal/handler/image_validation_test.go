package handler

import "testing"

func TestImageTypeMatchesExtension(t *testing.T) {
	tests := []struct {
		ext, contentType string
		want             bool
	}{
		{ext: ".jpg", contentType: "image/jpeg", want: true},
		{ext: ".jpeg", contentType: "image/jpeg", want: true},
		{ext: ".png", contentType: "image/png", want: true},
		{ext: ".webp", contentType: "image/webp", want: true},
		{ext: ".jpg", contentType: "image/png", want: false},
		{ext: ".svg", contentType: "image/svg+xml", want: false},
	}
	for _, test := range tests {
		if got := imageTypeMatchesExtension(test.ext, test.contentType); got != test.want {
			t.Fatalf("imageTypeMatchesExtension(%q, %q) = %v", test.ext, test.contentType, got)
		}
	}
}
