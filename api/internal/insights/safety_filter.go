package insights

import "strings"

type SafetyFilter struct {
	blocked []string
}

func NewSafetyFilter() SafetyFilter {
	return SafetyFilter{blocked: []string{
		"adhd", "alzheimer", "anxiety disorder", "bipolar", "depression",
		"depresyon", "epilepsy", "migraine", "migren", "multiple sclerosis",
		"parkinson", "stroke",
		"ibuprofen", "antidepressant", "antidepresan", "prozac", "ritalin",
		"you have ", "you are ", "sen şu ", "hastalığa sahip", "tedavi",
		"should take", "şunu kullan", "ilaç kullan",
	}}
}

func (f SafetyFilter) Allows(content string) bool {
	lower := strings.ToLower(content)
	for _, blocked := range f.blocked {
		if strings.Contains(lower, blocked) {
			return false
		}
	}
	return true
}
