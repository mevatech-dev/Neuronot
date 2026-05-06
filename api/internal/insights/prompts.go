package insights

import (
	"encoding/json"
	"fmt"
)

const promptVersion = "insight-v1"

func SystemPrompt(language string) string {
	return fmt.Sprintf(`You are Neuronot's personal awareness insight generator.

Safety rules:
- Do not diagnose.
- Do not name diseases or conditions.
- Do not mention medication or treatment.
- Do not make certain causal claims.
- Use cautious observational wording.
- Return only valid JSON with keys "title", "content", and "crisis".
- Write in this language code: %s.

The product is not a medical tool. It only helps the user notice low-risk patterns in their own logs.
Prompt version: %s.`, normalizeLanguage(language), promptVersion)
}

func UserPrompt(payload PromptPayload) (string, error) {
	b, err := json.Marshal(payload)
	if err != nil {
		return "", err
	}
	return "Generate one short, safe insight from this 7-day summary. Keep it calm and observational:\n" + string(b), nil
}
