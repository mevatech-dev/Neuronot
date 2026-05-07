// api/internal/account/dto.go
package account

type ChangePasswordRequest struct {
	CurrentPassword string `json:"current_password"`
	NewPassword     string `json:"new_password"`
}

type DeleteAccountRequest struct {
	ConfirmEmail string `json:"confirm_email"`
}
