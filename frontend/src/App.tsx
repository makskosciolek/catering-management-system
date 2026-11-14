import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import {
  Link,
  Navigate,
  NavLink,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router'
import { api } from './api/client'
import { isManagement, sessionKey, useSession } from './session'
import { AuthPage, ProfilePage } from './auth-pages'
import { MenuPage, type Basket } from './menu-page'
import { OrderDetailPage } from './orders-pages'
import { ErrorBox, Icon, Loading } from './ui'
import styles from './app.module.css'

function Layout({ quantity, clearBasket }: { quantity: number; clearBasket: () => void }) {
  const session = useSession()
  const user = session.data
  const staff = isManagement(user)
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const logout = useMutation({
    mutationFn: api.logout,
    onSuccess: () => {
      queryClient.clear()
      queryClient.setQueryData(sessionKey, null)
      clearBasket()
      void navigate('/login')
    },
  })
  const currentPage = location.pathname.startsWith('/orders')
    ? 'Zamówienia'
    : location.pathname === '/profile'
      ? 'Mój profil'
      : ['/login', '/register'].includes(location.pathname)
        ? 'Konto'
        : 'Menu'
  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <Link to="/menu" className={styles.brand} aria-label="CateringHub">
          <span className={styles.brandMark}>
            <Icon name="brand" size={23} />
          </span>
          <span>
            <strong>CateringHub</strong>
            <small>SmakBox</small>
          </span>
        </Link>
        <div className={styles.navGroup}>
          <span className={styles.navLabel}>{staff ? 'STREFA ZESPOŁU' : 'STREFA KLIENTA'}</span>
          <nav aria-label="Nawigacja główna">
            <NavLink to="/menu">
              <Icon name="menu" />
              Menu
            </NavLink>
            {user && (
              <NavLink to="/profile">
                <Icon name="user" />
                Mój profil
              </NavLink>
            )}
          </nav>
        </div>
        <div className={styles.sidebarFooter}>
          <span className={styles.pilotDot} />
          Wersja demonstracyjna
        </div>
      </aside>
      <div className={styles.workspace}>
        <header className={styles.topbar}>
          <div className={styles.topbarInner}>
            <div className={styles.breadcrumb}>
              <span>SmakBox</span>
              <span aria-hidden="true">/</span>
              <strong>{currentPage}</strong>
            </div>
            <div className={styles.topActions}>
              {!staff && (
                <Link
                  className={styles.basketLink}
                  to="/menu#basket"
                  aria-label={'Koszyk, porcji: ' + quantity}
                >
                  <Icon name="bag" size={18} />
                  <span>Koszyk</span>
                  <b>{quantity}</b>
                </Link>
              )}
              {user ? (
                <div className={styles.accountActions}>
                  <span className={styles.avatar} aria-hidden="true">
                    {(user.first_name || user.email).slice(0, 1).toUpperCase()}
                  </span>
                  <Link className={styles.userName} to="/profile">
                    {user.first_name || user.email}
                  </Link>
                  <button
                    type="button"
                    title="Wyloguj się"
                    aria-label="Wyloguj się"
                    className={styles.iconButton}
                    onClick={() => logout.mutate()}
                    disabled={logout.isPending}
                  >
                    <Icon name="logout" size={19} />
                  </button>
                </div>
              ) : (
                <Link className={styles.secondaryButton} to="/login">
                  Zaloguj się
                </Link>
              )}
            </div>
          </div>
        </header>
        <main className={styles.main}>
          {logout.error && <ErrorBox error={logout.error} onRetry={() => logout.mutate()} />}
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function Protected({ children }: { children: ReactNode }) {
  const session = useSession()
  if (session.isPending) return <Loading />
  if (session.isError)
    return <ErrorBox error={session.error} onRetry={() => void session.refetch()} />
  return session.data ? children : <Navigate to="/login" replace />
}

export function App() {
  const [basket, setBasket] = useState<Basket>({})
  function changeQuantity(id: string, delta: number) {
    setBasket((previous) => {
      const next = { ...previous }
      const quantity = Math.min(1000, (previous[id] ?? 0) + delta)
      if (quantity > 0) next[id] = quantity
      else delete next[id]
      return next
    })
  }
  const clearBasket = () => setBasket({})
  return (
    <Routes>
      <Route
        element={
          <Layout
            quantity={Object.values(basket).reduce((a, b) => a + b, 0)}
            clearBasket={clearBasket}
          />
        }
      >
        <Route index element={<Navigate to="/menu" replace />} />
        <Route
          path="/menu"
          element={
            <MenuPage basket={basket} changeQuantity={changeQuantity} clearBasket={clearBasket} />
          }
        />
        <Route path="/login" element={<AuthPage key="login" mode="login" />} />
        <Route path="/register" element={<AuthPage key="register" mode="register" />} />
        <Route
          path="/orders/:id"
          element={
            <Protected>
              <OrderDetailPage />
            </Protected>
          }
        />
        <Route
          path="/profile"
          element={
            <Protected>
              <ProfilePage />
            </Protected>
          }
        />
        <Route
          path="*"
          element={
            <div className={styles.empty}>
              <h1>Nie znaleziono strony</h1>
              <Link to="/menu">Wróć do menu</Link>
            </div>
          }
        />
      </Route>
    </Routes>
  )
}
