import { request } from '../client';

export function changePassword(currentPassword: string, newPassword: string): Promise<null> {
  return request<null>({
    method: 'POST',
    url: '/v1/auth/password',
    data: { current_password: currentPassword, new_password: newPassword },
  });
}

export function deleteAccount(confirmEmail: string): Promise<null> {
  return request<null>({
    method: 'DELETE',
    url: '/v1/me',
    data: { confirm_email: confirmEmail },
  });
}
