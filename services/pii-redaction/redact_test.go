package main

import "testing"

func TestRedactDoxxingExample(t *testing.T) {
	result := Redact("The President's cell phone is 555-123-4567 and they live in Dorm Room 4B.")
	if !result.Detected {
		t.Fatal("expected PII detection")
	}
	want := "The President's cell phone is [REDACTED] and they live in [REDACTED]."
	if result.Redacted != want {
		t.Fatalf("got %q want %q", result.Redacted, want)
	}
}

func TestRedactLeavesOrdinaryChat(t *testing.T) {
	result := Redact("See you at the keynote tonight!")
	if result.Detected {
		t.Fatalf("false positive: %#v", result)
	}
}
