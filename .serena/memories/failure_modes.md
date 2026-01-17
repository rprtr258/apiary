# Common Failure Modes

- Introducing framework dependencies in frontend (e.g., React, Vue).
- Using forbidden CSS properties (overflow:hidden, !important).
- Modifying 3rd-party library code or styles.
- Not registering new request kinds in both backend plugin map and frontend factory.
- Skipping post-task CI/build checks, leading to uncaught errors.
- Changing code style or formatting outside task scope.
- Using Array.forEach instead of functional alternatives.
- Not using context-based cancellation in Go.
- Altering DB schema without migration logic.