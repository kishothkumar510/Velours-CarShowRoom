import { useEffect, useState } from 'react';
import cars from '../data/cars.json';
import astonMartinImage from '../aston_martin.png';
import bentleyImage from '../bentley_gt.png';
import ferrariImage from '../ferrari_roma.png';
import heroImage from '../hero_car.png';
import logoMark from '../velours-mark.svg';
import '../style.css';

const carImages = {
  'aston-dbs': astonMartinImage,
  'ferrari-roma': ferrariImage,
  'bentley-continental': bentleyImage
};

const vehicles = cars.map(car => ({ ...car, image: carImages[car.id] }));
const cartStorageKey = 'velours-cart';

function readStorage(key, fallback) {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch (error) {
    console.error(`Could not read saved ${key} data.`, error);
    return fallback;
  }
}

function readCart() {
  const saved = readStorage(cartStorageKey, []);
  if (!Array.isArray(saved)) return [];
  return saved
    .map(item => (typeof item === 'string' ? item : item?.id))
    .filter(id => vehicles.some(car => car.id === id));
}

function formatPrice(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(amount);
}

function Header({ page, cartCount, user, onAuthOpen, onLogout }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(window.scrollY > 50);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const homePage = page === 'home';
  const navClass = menuOpen ? 'active' : '';
  const closeMenu = () => setMenuOpen(false);

  return (
    <header className={`${!homePage || scrolled ? 'page-header' : ''}${scrolled ? ' scrolled' : ''}`}>
      <a href="/" className="logo" onClick={closeMenu}>
        <img src={logoMark} alt="" className="logo-mark" />
        VELOURS<span>.</span>
      </a>
      <nav aria-label="Main navigation">
        <ul className={navClass}>
          <li><a href="/" className={homePage ? 'active' : ''} onClick={closeMenu}>Home</a></li>
          <li><a href="/inventory" className={page === 'inventory' ? 'active' : ''} onClick={closeMenu}>Inventory</a></li>
          <li><a href="/#services" onClick={closeMenu}>Services</a></li>
          <li><a href="/#contact" onClick={closeMenu}>Contact</a></li>
          <li>
            <a href="/cart" className={`cart-link${page === 'cart' ? ' active' : ''}`} onClick={closeMenu}>
              Cart <span className="cart-count" aria-label={`${cartCount} ${cartCount === 1 ? 'item' : 'items'}`}>{cartCount}</span>
            </a>
          </li>
          {user ? (
            <>
              <li><span className="nav-account">Hi, {user.name}</span></li>
              <li><button className="nav-btn auth-nav-button" type="button" onClick={onLogout}>Log out</button></li>
            </>
          ) : (
            <li>
              <a
                href="#login"
                className="nav-btn"
                onClick={event => {
                  event.preventDefault();
                  closeMenu();
                  onAuthOpen('login');
                }}
              >
                Login / Sign up
              </a>
            </li>
          )}
        </ul>
      </nav>
      <button
        className="mobile-toggle"
        type="button"
        aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen(open => !open)}
      >
        <i className={`fas ${menuOpen ? 'fa-times' : 'fa-bars'}`} aria-hidden="true" />
      </button>
    </header>
  );
}

function AuthModal({ open, mode, initialError, onClose, onSuccess, onModeChange }) {
  const [feedback, setFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setFeedback(initialError || '');
  }, [initialError, mode]);

  useEffect(() => {
    if (!open) return undefined;
    const closeOnEscape = event => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [open, onClose]);

  if (!open) return null;

  async function submitAuth(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = Object.fromEntries(new FormData(form));
    setSubmitting(true);
    setFeedback('');

    try {
      const response = await fetch(`/api/${mode === 'signup' ? 'signup' : 'login'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields)
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to authenticate.');
      onSuccess(result.user);
      form.reset();
    } catch (error) {
      setFeedback(error.message || 'Unable to connect to the server.');
    } finally {
      setSubmitting(false);
    }
  }

  const signingUp = mode === 'signup';

  return (
    <div
      className="modal active"
      style={{ display: 'flex' }}
      role="presentation"
      onMouseDown={event => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="modal-content" role="dialog" aria-modal="true" aria-labelledby="authTitle">
        <button className="close-modal" type="button" aria-label="Close dialog" onClick={onClose}>
          &times;
        </button>
        <div className="auth-container">
          <div className="auth-form active">
            <h2 id="authTitle">{signingUp ? 'Join Velours' : 'Welcome Back'}</h2>
            <p className="auth-subtitle">
              {signingUp ? 'Create an account to manage your orders' : 'Log in to manage your orders'}
            </p>
            <form onSubmit={submitAuth}>
              {signingUp && (
                <div className="form-group">
                  <label htmlFor="signupName">Full Name</label>
                  <input id="signupName" name="name" type="text" autoComplete="name" maxLength="100" required />
                </div>
              )}
              <div className="form-group">
                <label htmlFor="authEmail">Email</label>
                <input id="authEmail" name="email" type="email" autoComplete="email" maxLength="254" required />
              </div>
              <div className="form-group">
                <label htmlFor="authPassword">Password</label>
                <input
                  id="authPassword"
                  name="password"
                  type="password"
                  autoComplete={signingUp ? 'new-password' : 'current-password'}
                  minLength={signingUp ? 8 : undefined}
                  maxLength="128"
                  required
                />
              </div>
              <button className="btn btn-full" type="submit" disabled={submitting}>
                {submitting ? 'Please wait...' : signingUp ? 'Create Account' : 'Login'}
              </button>
            </form>
            <p className="form-feedback form-feedback-error" role="status" aria-live="polite">{feedback}</p>
            <div className="auth-footer">
              <p>
                {signingUp ? 'Already have an account?' : "Don't have an account?"}{' '}
                <button className="auth-mode-button" type="button" onClick={() => onModeChange(signingUp ? 'login' : 'signup')}>
                  {signingUp ? 'Login' : 'Sign up'}
                </button>
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function VehicleCard({ car, onAdd, added }) {
  return (
    <article className="car-card">
      <div className="car-image">
        <img src={car.image} alt={car.imageAlt} />
      </div>
      <div className="car-info">
        <h2 className="car-name">{car.name}</h2>
        <span className="car-price">{formatPrice(car.price)}</span>
        <div className="car-specs">
          {car.specs.map(spec => <span key={spec}>{spec}</span>)}
        </div>
        <button className="btn add-to-cart" type="button" onClick={() => onAdd(car.id)}>
          {added ? 'Added to cart' : 'Add to cart'}
        </button>
      </div>
    </article>
  );
}

function VehicleGrid({ onAdd, cartIds }) {
  return (
    <div className="car-grid">
      {vehicles.map(car => (
        <VehicleCard key={car.id} car={car} onAdd={onAdd} added={cartIds.includes(car.id)} />
      ))}
    </div>
  );
}

function ContactSection() {
  const [feedback, setFeedback] = useState({ message: '', error: false });
  const [submitting, setSubmitting] = useState(false);

  async function submitQuery(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = Object.fromEntries(new FormData(form));
    setSubmitting(true);
    setFeedback({ message: '', error: false });

    try {
      const response = await fetch('/api/service-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields)
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to send your query.');
      setFeedback({ message: result.message, error: false });
      form.reset();
    } catch (error) {
      setFeedback({ message: error.message || 'Unable to connect to the server.', error: true });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section id="contact" className="contact-section">
      <div className="contact-intro">
        <span className="hero-subtitle">Here for every detail</span>
        <h2>How can we help?</h2>
        <p>Tell our concierge about a vehicle issue or service request. Our team will be in touch.</p>
      </div>
      <form className="service-form" onSubmit={submitQuery}>
        <div className="form-group">
          <label htmlFor="serviceName">Name</label>
          <input id="serviceName" name="name" type="text" autoComplete="name" maxLength="100" required />
        </div>
        <div className="form-group">
          <label htmlFor="serviceEmail">Email</label>
          <input id="serviceEmail" name="email" type="email" autoComplete="email" maxLength="254" required />
        </div>
        <div className="form-group">
          <label htmlFor="serviceMessage">Message</label>
          <textarea id="serviceMessage" name="message" rows="5" maxLength="2000" required placeholder="Describe the car issue or service you need" />
        </div>
        <button className="btn" type="submit" disabled={submitting}>
          {submitting ? 'Sending...' : 'Send query'}
        </button>
        <p className={`form-feedback${feedback.error ? ' form-feedback-error' : ''}`} role="status" aria-live="polite">
          {feedback.message}
        </p>
      </form>
    </section>
  );
}

function Footer() {
  return (
    <footer>
      <div className="footer-content">
        <div className="footer-col">
          <h3>VELOURS.</h3>
          <p>123 Luxury Lane</p>
          <p>Beverly Hills, CA 90210</p>
        </div>
        <div className="footer-col">
          <h3>Contact</h3>
          <p>+1 (555) 123-4567</p>
          <p>concierge@velours.com</p>
        </div>
        <div className="footer-col">
          <h3>Hours</h3>
          <p>Mon-Fri: 10am - 8pm</p>
          <p>Sat-Sun: By Appointment</p>
        </div>
        <div className="footer-col">
          <h3>Follow Us</h3>
          <div className="socials">
            <a href="https://instagram.com" aria-label="Instagram"><i className="fab fa-instagram" /></a>
            <a href="https://twitter.com" aria-label="Twitter"><i className="fab fa-twitter" /></a>
            <a href="https://linkedin.com" aria-label="LinkedIn"><i className="fab fa-linkedin" /></a>
          </div>
        </div>
      </div>
      <div className="copyright">&copy; 2026 Velours Automotive. All rights reserved.</div>
    </footer>
  );
}

function HomePage({ onAdd, cartIds }) {
  return (
    <>
      <section id="home" className="hero">
        <div className="hero-bg"><img src={heroImage} alt="Luxury car in the Velours showroom" /></div>
        <div className="hero-content">
          <span className="hero-subtitle">Automotive Excellence</span>
          <h1 className="hero-title">Experience the Art of Performance</h1>
          <a href="#inventory" className="btn">Explore Inventory</a>
        </div>
      </section>
      <section id="inventory" className="featured">
        <div className="section-header">
          <h2 className="section-title"><span>Curated Collection</span>Featured Vehicles</h2>
          <a href="/inventory" className="view-all">View All Inventory <i className="fas fa-arrow-right" /></a>
        </div>
        <VehicleGrid onAdd={onAdd} cartIds={cartIds} />
      </section>
      <section id="services" className="about">
        <div className="about-image"><img src={heroImage} alt="A grand touring car in the Velours showroom" /></div>
        <div className="about-content">
          <h2>Unparalleled Service for the Discerning Driver</h2>
          <p>At Velours, we don't just sell cars; we curate experiences. Our showroom features a hand-picked selection of the world's most prestigious automotive marques. From financing to after-care, our concierge service ensures your journey is as exceptional as your destination.</p>
          <a href="#contact" className="btn">Contact Concierge</a>
        </div>
      </section>
      <ContactSection />
    </>
  );
}

function InventoryPage({ onAdd, cartIds }) {
  return (
    <main className="page-main">
      <section className="page-intro">
        <span className="hero-subtitle">The Velours collection</span>
        <h1>Our Inventory</h1>
        <p>Discover the exceptional. Every vehicle is selected for its character, craftsmanship, and performance.</p>
      </section>
      <section className="featured inventory-section" aria-label="Available vehicles">
        <VehicleGrid onAdd={onAdd} cartIds={cartIds} />
      </section>
    </main>
  );
}

function CartPage({ cartIds, setCartIds, user, authLoading, onAuthOpen }) {
  const [orders, setOrders] = useState([]);
  const [ordersError, setOrdersError] = useState('');
  const [feedback, setFeedback] = useState({ message: '', error: false });
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cancellingId, setCancellingId] = useState('');
  const selectedCars = vehicles.filter(car => cartIds.includes(car.id));
  const total = selectedCars.reduce((sum, car) => sum + car.price, 0);

  useEffect(() => {
    if (!user) {
      setOrders([]);
      setOrdersLoading(false);
      return undefined;
    }

    let ignoreResult = false;
    setOrdersLoading(true);
    setOrdersError('');
    setFeedback({ message: '', error: false });
    fetch('/api/delivery-requests')
      .then(async response => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Unable to load your orders.');
        return result.orders;
      })
      .then(savedOrders => {
        if (!ignoreResult) setOrders(savedOrders);
      })
      .catch(error => {
        if (!ignoreResult) setOrdersError(error.message || 'Unable to load your orders.');
      })
      .finally(() => {
        if (!ignoreResult) setOrdersLoading(false);
      });

    return () => {
      ignoreResult = true;
    };
  }, [user?.email]);

  async function requestDelivery(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = Object.fromEntries(new FormData(form));
    setSubmitting(true);
    setFeedback({ message: '', error: false });

    try {
      const response = await fetch('/api/delivery-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: fields.address, carIds: selectedCars.map(car => car.id) })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to place your order.');
      setOrders(current => [result, ...current]);
      setCartIds([]);
      setFeedback({ message: 'Your order has been placed. Our concierge will contact you to confirm the details.', error: false });
      form.reset();
    } catch (error) {
      setFeedback({ message: error.message || 'Unable to connect to the server.', error: true });
    } finally {
      setSubmitting(false);
    }
  }

  async function cancelOrder(orderId) {
    setCancellingId(orderId);
    setFeedback({ message: '', error: false });

    try {
      const response = await fetch(`/api/delivery-requests/${encodeURIComponent(orderId)}/cancel`, {
        method: 'PATCH'
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to cancel this order.');
      setOrders(current => current.map(order => order.id === result.id ? result : order));
    } catch (error) {
      setFeedback({ message: error.message || 'Unable to connect to the server.', error: true });
    } finally {
      setCancellingId('');
    }
  }

  return (
    <main className="page-main">
      <section className="page-intro">
        <span className="hero-subtitle">Your next drive begins here</span>
        <h1>Your Cart</h1>
        <p>Review your selection and place an order with our concierge team.</p>
      </section>
      <section className="cart-layout">
        <div className="cart-panel">
          <h2>Selected vehicles</h2>
          <div className="cart-items" aria-live="polite">
            {selectedCars.length ? selectedCars.map(car => (
              <article className="cart-item" key={car.id}>
                <img src={car.image} alt="" />
                <div className="cart-item-details">
                  <h3>{car.name}</h3>
                  <p>{formatPrice(car.price)}</p>
                  <button
                    className="text-button"
                    type="button"
                    aria-label={`Remove ${car.name} from cart`}
                    onClick={() => setCartIds(ids => ids.filter(id => id !== car.id))}
                  >
                    Remove
                  </button>
                </div>
              </article>
            )) : <p className="empty-state">Your cart is waiting for its first vehicle.</p>}
          </div>
          <div className="cart-total"><span>Selection total</span><strong>{formatPrice(total)}</strong></div>
          {authLoading ? (
            <p className="empty-state">Checking your account...</p>
          ) : user ? (
            <form className="delivery-form" onSubmit={requestDelivery}>
              <h2>Delivery details</h2>
              <p className="account-summary">Order as {user.name} ({user.email})</p>
              <div className="form-group">
                <label htmlFor="deliveryAddress">Delivery address</label>
                <textarea id="deliveryAddress" name="address" rows="3" maxLength="500" autoComplete="street-address" required />
              </div>
              <button className="btn" type="submit" disabled={!selectedCars.length || submitting}>
                {submitting ? 'Placing order...' : 'Place order'}
              </button>
              <p className={`form-feedback${feedback.error ? ' form-feedback-error' : ''}`} role="status" aria-live="polite">
                {feedback.message}
              </p>
            </form>
          ) : (
            <div className="auth-required">
              <h2>Sign in to place your order</h2>
              <p>Create an account or log in to place orders and manage cancellations.</p>
              <button className="btn" type="button" onClick={() => onAuthOpen('login')}>Login / Sign up</button>
            </div>
          )}
        </div>
        <aside className="orders-panel">
          <h2>Your orders</h2>
          {authLoading || ordersLoading ? (
            <p className="empty-state">Loading your orders...</p>
          ) : !user ? (
            <p className="empty-state">Log in to view and manage your orders.</p>
          ) : orders.length ? (
            <div aria-live="polite">
              {orders.map(order => (
                <article className="order-card" key={order.id}>
                  <h3>Order {order.id}</h3>
                  <p>{order.cars.join(', ')}</p>
                  <p>{formatPrice(order.total)}</p>
                  <p className={`order-status ${order.status}`}>
                    {order.status === 'cancelled' ? 'Order cancelled' : 'Order placed'}
                  </p>
                  {order.status === 'requested' && (
                    <button
                      className="text-button"
                      type="button"
                      disabled={cancellingId === order.id}
                      onClick={() => cancelOrder(order.id)}
                    >
                      {cancellingId === order.id ? 'Cancelling...' : 'Cancel order'}
                    </button>
                  )}
                </article>
              ))}
            </div>
          ) : <p className="empty-state">Your orders will appear here.</p>}
          {ordersError && (
            <p className="form-feedback form-feedback-error" role="status">{ordersError}</p>
          )}
        </aside>
      </section>
    </main>
  );
}

export default function App() {
  const pathname = window.location.pathname.replace(/\/+$/, '') || '/';
  const page = pathname === '/inventory' || pathname === '/inventory.html'
    ? 'inventory'
    : pathname === '/cart' || pathname === '/cart.html'
      ? 'cart'
      : 'home';
  const [cartIds, setCartIds] = useState(readCart);
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authModal, setAuthModal] = useState({ open: false, mode: 'login', error: '' });

  useEffect(() => {
    let ignoreResult = false;
    fetch('/api/session')
      .then(async response => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Unable to check your account.');
        return result.user;
      })
      .then(savedUser => {
        if (!ignoreResult) setUser(savedUser);
      })
      .catch(error => {
        if (!ignoreResult) console.error('Unable to restore the current account session.', error);
      })
      .finally(() => {
        if (!ignoreResult) setAuthLoading(false);
      });

    return () => {
      ignoreResult = true;
    };
  }, []);

  function addToCart(id) {
    setCartIds(current => current.includes(id) ? current : [...current, id]);
  }

  function openAuth(mode) {
    setAuthModal({ open: true, mode, error: '' });
  }

  async function logout() {
    try {
      const response = await fetch('/api/logout', { method: 'POST' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to log out.');
      setUser(null);
    } catch (error) {
      setAuthModal({ open: true, mode: 'login', error: error.message || 'Unable to connect to the server.' });
    }
  }

  useEffect(() => {
    const savedCars = vehicles.filter(car => cartIds.includes(car.id)).map(car => ({
      id: car.id,
      name: car.name,
      price: car.price,
      image: car.image
    }));
    localStorage.setItem(cartStorageKey, JSON.stringify(savedCars));
  }, [cartIds]);

  return (
    <>
      <Header page={page} cartCount={cartIds.length} user={user} onAuthOpen={openAuth} onLogout={logout} />
      {page === 'inventory' && <InventoryPage onAdd={addToCart} cartIds={cartIds} />}
      {page === 'cart' && (
        <CartPage
          cartIds={cartIds}
          setCartIds={setCartIds}
          user={user}
          authLoading={authLoading}
          onAuthOpen={openAuth}
        />
      )}
      {page === 'home' && <HomePage onAdd={addToCart} cartIds={cartIds} />}
      <Footer />
      <AuthModal
        open={authModal.open}
        mode={authModal.mode}
        initialError={authModal.error}
        onClose={() => setAuthModal(current => ({ ...current, open: false, error: '' }))}
        onSuccess={savedUser => {
          setUser(savedUser);
          setAuthModal(current => ({ ...current, open: false, error: '' }));
        }}
        onModeChange={mode => setAuthModal({ open: true, mode, error: '' })}
      />
    </>
  );
}