package insights

import "testing"

func TestSafetyFilterRejectsDiagnosisAndDrugLanguage(t *testing.T) {
	filter := NewSafetyFilter()

	cases := []string{
		"You have migraine and should take ibuprofen.",
		"Bu belirtiler depresyon olabilir.",
		"ADHD pattern detected.",
	}

	for _, content := range cases {
		if filter.Allows(content) {
			t.Fatalf("expected content to be rejected: %q", content)
		}
	}
}

func TestSafetyFilterAllowsObservationalInsight(t *testing.T) {
	filter := NewSafetyFilter()

	content := "Son günlerde düşük uyku kalitesi ile odak düşüşü aynı günlerde artmış görünüyor."

	if !filter.Allows(content) {
		t.Fatalf("expected observational content to be allowed")
	}
}
