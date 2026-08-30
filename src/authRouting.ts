export function readPasswordResetToken() {
  if (window.location.pathname !== '/reset-password') return null
  return new URLSearchParams(window.location.search).get('token')
}
