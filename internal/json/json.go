package json3

type (
	D = map[string]any
	A = []any
)

func Emptize[T any](xs []T) []T {
	if xs == nil {
		return []T{}
	}

	return xs
}
