import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AuthScreen from '../AuthScreen'
import { confirmPasswordReset, requestPasswordReset } from '../api'

vi.mock('../api', () => ({
  loginAccount: vi.fn(),
  registerAccount: vi.fn(),
  requestPasswordReset: vi.fn(),
  confirmPasswordReset: vi.fn(),
}))

const neutralMessage =
  'Если аккаунт с таким email существует, мы отправили ссылку для восстановления пароля.'

describe('восстановление пароля', () => {
  beforeEach(() => {
    history.replaceState({}, '', '/')
  })

  it('отправляет email и показывает нейтральный ответ', async () => {
    vi.mocked(requestPasswordReset).mockResolvedValue(neutralMessage)
    const user = userEvent.setup()
    render(<AuthScreen onSuccess={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Забыли пароль?' }))
    await user.type(screen.getByLabelText('Email'), 'owner@example.com')
    await user.click(screen.getByRole('button', { name: 'Отправить ссылку' }))

    expect(requestPasswordReset).toHaveBeenCalledWith('owner@example.com')
    expect(await screen.findByRole('status')).toHaveTextContent(neutralMessage)
  })

  it('не отправляет несовпадающие пароли', async () => {
    const user = userEvent.setup()
    render(<AuthScreen onSuccess={vi.fn()} resetToken="reset-token-value-with-enough-length" />)

    await user.type(screen.getByLabelText('Пароль'), 'newpassword2')
    await user.type(screen.getByLabelText('Повторите пароль'), 'different3')
    await user.click(screen.getByRole('button', { name: 'Сохранить новый пароль' }))

    expect(screen.getByText('Пароли не совпадают')).toBeInTheDocument()
    expect(confirmPasswordReset).not.toHaveBeenCalled()
  })

  it('подтверждает новый пароль и возвращает ко входу', async () => {
    vi.mocked(confirmPasswordReset).mockResolvedValue('Пароль изменён. Войдите с новым паролем.')
    const user = userEvent.setup()
    render(<AuthScreen onSuccess={vi.fn()} resetToken="reset-token-value-with-enough-length" />)

    await user.type(screen.getByLabelText('Пароль'), 'newpassword2')
    await user.type(screen.getByLabelText('Повторите пароль'), 'newpassword2')
    await user.click(screen.getByRole('button', { name: 'Сохранить новый пароль' }))

    expect(confirmPasswordReset).toHaveBeenCalledWith(
      'reset-token-value-with-enough-length',
      'newpassword2',
    )
    expect(await screen.findByRole('heading', { name: 'Вход в кабинет' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Пароль изменён')
  })
})
