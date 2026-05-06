package insights

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"
	"time"
)

const anthropicMessagesURL = "https://api.anthropic.com/v1/messages"

type AnthropicGenerator struct {
	apiKey string
	model  string
	client *http.Client
}

func NewAnthropicGenerator(apiKey string) *AnthropicGenerator {
	return &AnthropicGenerator{
		apiKey: apiKey,
		model:  "claude-sonnet-4-6",
		client: &http.Client{Timeout: 30 * time.Second},
	}
}

func (g *AnthropicGenerator) Generate(ctx context.Context, payload PromptPayload) (GeneratedInsight, error) {
	if strings.TrimSpace(g.apiKey) == "" {
		return GeneratedInsight{}, ErrAIUnavailable
	}

	userPrompt, err := UserPrompt(payload)
	if err != nil {
		return GeneratedInsight{}, err
	}

	reqBody := anthropicRequest{
		Model:       g.model,
		MaxTokens:   800,
		Temperature: 0.4,
		System:      SystemPrompt(payload.Language),
		Messages: []anthropicMessage{{
			Role:    "user",
			Content: userPrompt,
		}},
	}
	b, err := json.Marshal(reqBody)
	if err != nil {
		return GeneratedInsight{}, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, anthropicMessagesURL, bytes.NewReader(b))
	if err != nil {
		return GeneratedInsight{}, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-api-key", g.apiKey)
	req.Header.Set("anthropic-version", "2023-06-01")

	res, err := g.client.Do(req)
	if err != nil {
		return GeneratedInsight{}, err
	}
	defer res.Body.Close()

	if res.StatusCode < 200 || res.StatusCode >= 300 {
		io.Copy(io.Discard, res.Body)
		return GeneratedInsight{}, ErrAIUnavailable
	}

	var decoded anthropicResponse
	if err := json.NewDecoder(res.Body).Decode(&decoded); err != nil {
		return GeneratedInsight{}, err
	}
	text := decoded.FirstText()
	if text == "" {
		return GeneratedInsight{}, errors.New("empty anthropic response")
	}

	var out GeneratedInsight
	if err := json.Unmarshal([]byte(stripJSONFence(text)), &out); err != nil {
		return GeneratedInsight{}, err
	}
	return out, nil
}

type anthropicRequest struct {
	Model       string             `json:"model"`
	MaxTokens   int                `json:"max_tokens"`
	Temperature float64            `json:"temperature"`
	System      string             `json:"system"`
	Messages    []anthropicMessage `json:"messages"`
}

type anthropicMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type anthropicResponse struct {
	Content []struct {
		Type string `json:"type"`
		Text string `json:"text"`
	} `json:"content"`
}

func (r anthropicResponse) FirstText() string {
	for _, c := range r.Content {
		if c.Type == "text" && strings.TrimSpace(c.Text) != "" {
			return c.Text
		}
	}
	return ""
}

func stripJSONFence(text string) string {
	text = strings.TrimSpace(text)
	text = strings.TrimPrefix(text, "```json")
	text = strings.TrimPrefix(text, "```")
	text = strings.TrimSuffix(text, "```")
	return strings.TrimSpace(text)
}
