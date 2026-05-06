package crisis_keywords

import "testing"

func TestContainsDetectsTurkishCrisisText(t *testing.T) {
	if !Contains("tr", []string{"Bugün kendime zarar vermekten korkuyorum"}) {
		t.Fatalf("expected Turkish crisis keyword to match")
	}
}

func TestContainsFallsBackToEnglishForUnknownLanguage(t *testing.T) {
	if !Contains("xx", []string{"I might harm myself"}) {
		t.Fatalf("expected unknown language to fall back to English")
	}
}

func TestContainsIgnoresNonCrisisText(t *testing.T) {
	if Contains("en", []string{"Headache after a short night of sleep"}) {
		t.Fatalf("expected non-crisis note to be ignored")
	}
}
