package insights

import (
	"context"
	"encoding/json"
	"errors"
	"strings"

	"github.com/openai/openai-go"
	"github.com/openai/openai-go/option"
	"github.com/openai/openai-go/shared"
)

// OpenAIGenerator implements `Generator` against OpenAI Chat Completions
// with Structured Outputs. The model is asked to return JSON conforming to
// `insightSchema`; `strict: true` enforces it server-side, so we don't need
// the fence-stripping the Anthropic adapter used to do.
type OpenAIGenerator struct {
	client openai.Client
	model  shared.ChatModel
	apiKey string
}

const openAIModel = shared.ChatModelGPT4_1Mini

// insightSchema mirrors `GeneratedInsight`. additionalProperties=false and
// every property in `required` are mandatory for OpenAI strict mode.
var insightSchema = map[string]any{
	"type":                 "object",
	"additionalProperties": false,
	"required":             []string{"title", "content", "crisis"},
	"properties": map[string]any{
		"title":   map[string]any{"type": "string", "minLength": 1, "maxLength": 140},
		"content": map[string]any{"type": "string", "minLength": 1, "maxLength": 1600},
		"crisis":  map[string]any{"type": "boolean"},
	},
}

func NewOpenAIGenerator(apiKey string, opts ...option.RequestOption) *OpenAIGenerator {
	if strings.TrimSpace(apiKey) == "" {
		// Empty key → Generate returns ErrAIUnavailable. Mirrors the
		// Anthropic adapter so config can boot without a key in dev.
		return &OpenAIGenerator{}
	}
	allOpts := append([]option.RequestOption{option.WithAPIKey(apiKey)}, opts...)
	return &OpenAIGenerator{
		client: openai.NewClient(allOpts...),
		model:  openAIModel,
		apiKey: apiKey,
	}
}

func (g *OpenAIGenerator) Generate(ctx context.Context, payload PromptPayload) (GeneratedInsight, error) {
	if g.apiKey == "" {
		return GeneratedInsight{}, ErrAIUnavailable
	}

	userPrompt, err := UserPrompt(payload)
	if err != nil {
		return GeneratedInsight{}, err
	}

	chat, err := g.client.Chat.Completions.New(ctx, openai.ChatCompletionNewParams{
		Model: g.model,
		Messages: []openai.ChatCompletionMessageParamUnion{
			openai.SystemMessage(SystemPrompt(payload.Language)),
			openai.UserMessage(userPrompt),
		},
		Temperature: openai.Float(0.4),
		MaxTokens:   openai.Int(800),
		ResponseFormat: openai.ChatCompletionNewParamsResponseFormatUnion{
			OfJSONSchema: &shared.ResponseFormatJSONSchemaParam{
				JSONSchema: shared.ResponseFormatJSONSchemaJSONSchemaParam{
					Name:   "InsightOutput",
					Schema: insightSchema,
					Strict: openai.Bool(true),
				},
			},
		},
	})
	if err != nil {
		return GeneratedInsight{}, ErrAIUnavailable
	}

	if len(chat.Choices) == 0 {
		return GeneratedInsight{}, errors.New("empty openai response")
	}

	content := strings.TrimSpace(chat.Choices[0].Message.Content)
	if content == "" {
		return GeneratedInsight{}, errors.New("empty openai response")
	}

	var out GeneratedInsight
	if err := json.Unmarshal([]byte(content), &out); err != nil {
		return GeneratedInsight{}, err
	}
	return out, nil
}
