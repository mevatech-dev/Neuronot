package crisis_keywords

import "strings"

var byLanguage = map[string][]string{
	"en": enKeywords,
	"tr": trKeywords,
	"es": esKeywords,
	"de": deKeywords,
	"fr": frKeywords,
	"pt": ptKeywords,
	"it": itKeywords,
	"ar": arKeywords,
	"ru": ruKeywords,
	"ja": jaKeywords,
	"zh": zhKeywords,
}

func Contains(language string, texts []string) bool {
	keywords := byLanguage[language]
	if len(keywords) == 0 {
		keywords = byLanguage["en"]
	}
	for _, text := range texts {
		lower := strings.ToLower(text)
		for _, keyword := range keywords {
			if strings.Contains(lower, strings.ToLower(keyword)) {
				return true
			}
		}
	}
	return false
}
