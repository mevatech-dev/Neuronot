// api/internal/account/types.go
package account

import "errors"

var (
	ErrPasswordIncorrect = errors.New("current password incorrect")
	ErrPasswordWeak      = errors.New("new password too short")
	ErrEmailMismatch     = errors.New("delete confirmation email does not match")
	ErrUserNotFound      = errors.New("user not found")
)
