package handler

import "testing"

func TestNormalizeClientDownloadURL(t *testing.T) {
	tests := []struct {
		name    string
		value   string
		want    string
		wantErr bool
	}{
		{name: "https", value: " https://downloads.example.com/client.exe ", want: "https://downloads.example.com/client.exe"},
		{name: "http", value: "http://example.com/client", want: "http://example.com/client"},
		{name: "empty", value: "  ", want: ""},
		{name: "relative", value: "/downloads/client.exe", wantErr: true},
		{name: "script", value: "javascript:alert(1)", wantErr: true},
		{name: "credentials", value: "https://user:pass@example.com/client.exe", wantErr: true},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			got, err := normalizeClientDownloadURL(test.value)
			if test.wantErr {
				if err == nil {
					t.Fatalf("expected an error, got URL %q", got)
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if got != test.want {
				t.Fatalf("got %q, want %q", got, test.want)
			}
		})
	}
}
