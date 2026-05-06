package insights

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestStripJSONFence(t *testing.T) {
	got := stripJSONFence("```json\n{\"title\":\"A\",\"content\":\"B\",\"crisis\":false}\n```")
	want := "{\"title\":\"A\",\"content\":\"B\",\"crisis\":false}"
	if got != want {
		t.Fatalf("got %q want %q", got, want)
	}
}

func TestAnthropicGeneratorParsesSuccessfulJSON(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("x-api-key") != "test-key" {
			t.Fatalf("missing api key header")
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"content":[{"type":"text","text":"{\"title\":\"Pattern\",\"content\":\"Focus and sleep moved together.\",\"crisis\":false}"}]}`))
	}))
	defer server.Close()

	gen := NewAnthropicGenerator("test-key")
	gen.endpoint = server.URL

	out, err := gen.Generate(context.Background(), PromptPayload{Language: "en", WindowDays: 7, Summary: Summary{DailyLogCount: 3}})
	if err != nil {
		t.Fatalf("Generate returned error: %v", err)
	}
	if out.Title != "Pattern" || out.Content == "" || out.Crisis {
		t.Fatalf("unexpected output: %+v", out)
	}
}

func TestAnthropicGeneratorReturnsUnavailableOnHTTPFailure(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "nope", http.StatusInternalServerError)
	}))
	defer server.Close()

	gen := NewAnthropicGenerator("test-key")
	gen.endpoint = server.URL

	_, err := gen.Generate(context.Background(), PromptPayload{Language: "en"})
	if err != ErrAIUnavailable {
		t.Fatalf("got %v want ErrAIUnavailable", err)
	}
}

func TestAnthropicGeneratorRejectsEmptyText(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"content":[{"type":"text","text":""}]}`))
	}))
	defer server.Close()

	gen := NewAnthropicGenerator("test-key")
	gen.endpoint = server.URL

	_, err := gen.Generate(context.Background(), PromptPayload{Language: "en"})
	if err == nil {
		t.Fatalf("expected error for empty response")
	}
}
