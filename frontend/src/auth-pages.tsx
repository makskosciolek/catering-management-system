import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'
import { api, type User } from './api/client'
import { roleLabel, sessionKey, useSession } from './session'
import { ErrorBox, Icon } from './ui'
import styles from './app.module.css'

const demoPassword = 'SmakBox-demo-2026!'

export function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const session = useSession()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const register = mode === 'register'
  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const credentials = { email, password }
      if (register) {
        await api.register({
          ...credentials,
          first_name: String(data.get('first_name')),
          last_name: String(data.get('last_name')),
        })
      }
      return api.login(credentials)
    },
    onSuccess: (user) => {
      queryClient.clear()
      queryClient.setQueryData(sessionKey, user)
      void navigate('/menu', { replace: true })
    },
  })
  if (session.data) return <Navigate replace to="/menu" />
  return (
    <section className={styles.authGrid}>
      <div className={styles.authAside}>
        <span className={styles.heroLabel}>
          <span />
          KUCHNIA SMAKBOX
        </span>
        <Icon name="brand" size={54} />
        <h2>Twoje zamówienia w jednym miejscu</h2>
        <p>Przeglądaj menu, wybierz termin i sprawdzaj, co dzieje się z zamówieniem.</p>
      </div>
      <div className={styles.authPanel}>
        <p className={styles.eyebrow}>KONTO CATERINGHUB</p>
        <h1>{register ? 'Załóż konto' : 'Zaloguj się'}</h1>
        <p className={styles.muted}>
          {register
            ? 'Podaj podstawowe dane, żeby składać zamówienia.'
            : 'Podaj dane swojego konta SmakBox.'}
        </p>
        <form
          className={styles.form}
          onSubmit={(event) => {
            event.preventDefault()
            mutation.mutate(new FormData(event.currentTarget))
          }}
        >
          {register && (
            <div className={styles.fieldRow}>
              <label>
                Imię
                <input name="first_name" autoComplete="given-name" maxLength={150} required />
              </label>
              <label>
                Nazwisko
                <input name="last_name" autoComplete="family-name" maxLength={150} required />
              </label>
            </div>
          )}
          <label>
            Adres e-mail
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              autoComplete="username"
              maxLength={254}
              required
            />
          </label>
          <label>
            Hasło
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              autoComplete={register ? 'new-password' : 'current-password'}
              minLength={register ? 8 : undefined}
              maxLength={128}
              required
            />
          </label>
          {mutation.error && <ErrorBox error={mutation.error} />}
          <button className={styles.primaryButton} disabled={mutation.isPending}>
            {mutation.isPending ? 'Chwila…' : register ? 'Utwórz konto' : 'Zaloguj się'}{' '}
            <Icon name="arrow" size={17} />
          </button>
        </form>
        <p className={styles.authSwitch}>
          {register ? 'Masz już konto? ' : 'Nie masz konta? '}
          <Link to={register ? '/login' : '/register'}>
            {register ? 'Zaloguj się' : 'Zarejestruj się'}
          </Link>
        </p>
        {!register && (
          <div className={styles.demoBox}>
            <strong>Wypróbuj wersję demonstracyjną</strong>
            <div className={styles.inlineActions}>
              {(
                [
                  ['klient', 'Dane klienta'],
                  ['manager', 'Dane menedżera'],
                ] as const
              ).map(([account, label]) => (
                <button
                  type="button"
                  className={styles.smallButton}
                  key={account}
                  onClick={() => {
                    setEmail(account + '@smakbox.example')
                    setPassword(demoPassword)
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

export function ProfilePage() {
  const { data } = useSession()
  return data ? <ProfileForm key={data.id} user={data} /> : null
}

function ProfileForm({ user }: { user: User }) {
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: api.saveProfile,
    onSuccess: (updated) => queryClient.setQueryData(sessionKey, updated),
  })
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    mutation.mutate({
      first_name: String(form.get('first_name')),
      last_name: String(form.get('last_name')),
      phone: String(form.get('phone')),
    })
  }
  return (
    <section className={styles.section}>
      <p className={styles.eyebrow}>KONTO • {roleLabel[user.role]}</p>
      <h1>Mój profil</h1>
      <p className={styles.muted}>Zaktualizuj swoje dane kontaktowe.</p>
      <form className={styles.profileForm} onSubmit={save}>
        <label>
          Adres e-mail
          <input type="email" value={user.email} readOnly />
        </label>
        <div className={styles.fieldRow}>
          <label>
            Imię
            <input
              name="first_name"
              autoComplete="given-name"
              defaultValue={user.first_name}
              maxLength={150}
            />
          </label>
          <label>
            Nazwisko
            <input
              name="last_name"
              autoComplete="family-name"
              defaultValue={user.last_name}
              maxLength={150}
            />
          </label>
        </div>
        <label>
          Telefon
          <input
            name="phone"
            type="tel"
            autoComplete="tel"
            defaultValue={user.phone}
            maxLength={30}
          />
        </label>
        {mutation.error && <ErrorBox error={mutation.error} />}
        {mutation.isSuccess && (
          <p className={styles.success} role="status">
            <Icon name="check" size={18} />
            Zapisano profil.
          </p>
        )}
        <button className={styles.primaryButton} disabled={mutation.isPending}>
          {mutation.isPending ? 'Zapisywanie…' : 'Zapisz profil'}
        </button>
      </form>
    </section>
  )
}
