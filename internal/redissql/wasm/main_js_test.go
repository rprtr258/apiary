//go:build js && wasm

package main

import (
	"math"
	"syscall/js"
	"testing"
)

func TestJsErrorMessage(t *testing.T) {
	t.Run("error object", func(t *testing.T) {
		err := js.Global().Get("Error").New("connect ECONNREFUSED 127.0.0.1:6379")
		if got, want := jsErrorMessage(err), "Error: connect ECONNREFUSED 127.0.0.1:6379"; got != want {
			t.Errorf("jsErrorMessage = %q, want %q", got, want)
		}
	})

	t.Run("named error object", func(t *testing.T) {
		err := js.Global().Get("TypeError").New("boom")
		if got, want := jsErrorMessage(err), "TypeError: boom"; got != want {
			t.Errorf("jsErrorMessage = %q, want %q", got, want)
		}
	})

	t.Run("string reason passes through", func(t *testing.T) {
		if got, want := jsErrorMessage(js.ValueOf("plain failure")), "plain failure"; got != want {
			t.Errorf("jsErrorMessage = %q, want %q", got, want)
		}
	})

	t.Run("object without message falls back", func(t *testing.T) {
		obj := js.Global().Get("Object").New()
		if got, want := jsErrorMessage(obj), "<object>"; got != want {
			t.Errorf("jsErrorMessage = %q, want %q", got, want)
		}
	})
}

func TestParseScore(t *testing.T) {
	t.Run("json number", func(t *testing.T) {
		if got, err := parseScore("m", float64(1.5)); err != nil || got != 1.5 {
			t.Errorf("parseScore(1.5) = %v, %v, want 1.5, nil", got, err)
		}
	})

	t.Run("+inf string", func(t *testing.T) {
		got, err := parseScore("m", "+inf")
		if err != nil || !math.IsInf(got, 1) {
			t.Errorf("parseScore(+inf) = %v, %v, want +Inf, nil", got, err)
		}
	})

	t.Run("-inf string", func(t *testing.T) {
		got, err := parseScore("m", "-inf")
		if err != nil || !math.IsInf(got, -1) {
			t.Errorf("parseScore(-inf) = %v, %v, want -Inf, nil", got, err)
		}
	})

	t.Run("invalid string errors", func(t *testing.T) {
		if _, err := parseScore("m", "not a number"); err == nil {
			t.Error("parseScore(not a number) = nil error, want error")
		}
	})

	t.Run("unexpected type errors", func(t *testing.T) {
		if _, err := parseScore("m", true); err == nil {
			t.Error("parseScore(true) = nil error, want error")
		}
	})
}

func TestMarshalCell(t *testing.T) {
	t.Run("finite float stays a number", func(t *testing.T) {
		b, err := marshalCell(1.5)
		if err != nil || string(b) != "1.5" {
			t.Errorf("marshalCell(1.5) = %q, %v, want \"1.5\", nil", b, err)
		}
	})

	t.Run("+inf becomes the redis score string", func(t *testing.T) {
		b, err := marshalCell(math.Inf(1))
		if err != nil || string(b) != `"+inf"` {
			t.Errorf("marshalCell(+Inf) = %q, %v, want %q, nil", b, err, `"+inf"`)
		}
	})

	t.Run("-inf becomes the redis score string", func(t *testing.T) {
		b, err := marshalCell(math.Inf(-1))
		if err != nil || string(b) != `"-inf"` {
			t.Errorf("marshalCell(-Inf) = %q, %v, want %q, nil", b, err, `"-inf"`)
		}
	})

	t.Run("nan becomes a string", func(t *testing.T) {
		b, err := marshalCell(math.NaN())
		if err != nil || string(b) != `"nan"` {
			t.Errorf("marshalCell(NaN) = %q, %v, want %q, nil", b, err, `"nan"`)
		}
	})

	t.Run("other cells pass through json.Marshal", func(t *testing.T) {
		b, err := marshalCell("plain")
		if err != nil || string(b) != `"plain"` {
			t.Errorf("marshalCell(plain) = %q, %v, want %q, nil", b, err, `"plain"`)
		}
	})
}
