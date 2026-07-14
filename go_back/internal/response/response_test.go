package response

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestErrorIncludesRequestIDWhenAvailable(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	context.Set("requestId", "desktop-request-123")

	Error(context, http.StatusBadRequest, "invalid request")

	want := `{"message":"invalid request","requestId":"desktop-request-123"}`
	if recorder.Code != http.StatusBadRequest || recorder.Body.String() != want {
		t.Fatalf("unexpected error response: status=%d body=%s", recorder.Code, recorder.Body.String())
	}
}
