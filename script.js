document.addEventListener('DOMContentLoaded', () => {
    const cartStorageKey = 'velours-cart';
    const ordersStorageKey = 'velours-delivery-orders';
    const header = document.querySelector('header');
    const mobileToggle = document.querySelector('.mobile-toggle');
    const navUl = document.querySelector('nav ul');
    const navLinks = document.querySelectorAll('nav ul a');

    window.addEventListener('scroll', () => {
        header?.classList.toggle('scrolled', window.scrollY > 50);
    });

    mobileToggle?.addEventListener('click', () => {
        const isOpen = navUl.classList.toggle('active');
        mobileToggle.setAttribute('aria-expanded', String(isOpen));
        mobileToggle.setAttribute('aria-label', isOpen ? 'Close navigation' : 'Open navigation');
        const icon = mobileToggle.querySelector('i');
        icon.classList.toggle('fa-bars', !isOpen);
        icon.classList.toggle('fa-times', isOpen);
    });

    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            navUl?.classList.remove('active');
            mobileToggle?.setAttribute('aria-expanded', 'false');
            const icon = mobileToggle?.querySelector('i');
            icon?.classList.remove('fa-times');
            icon?.classList.add('fa-bars');
        });
    });

    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', event => {
            const targetId = anchor.getAttribute('href');
            const targetElement = targetId && targetId !== '#' ? document.querySelector(targetId) : null;
            if (!targetElement) return;
            event.preventDefault();
            window.scrollTo({
                top: targetElement.getBoundingClientRect().top + window.scrollY - 80,
                behavior: 'smooth'
            });
        });
    });

    if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) return;
                entry.target.classList.add('is-visible');
                observer.unobserve(entry.target);
            });
        }, { threshold: 0.1 });

        document.querySelectorAll('.car-card, .about-content, .section-title').forEach(element => {
            element.classList.add('animate-in');
            observer.observe(element);
        });
    }

    const readList = key => JSON.parse(localStorage.getItem(key) || '[]');
    const writeList = (key, value) => localStorage.setItem(key, JSON.stringify(value));
    const formatPrice = amount => new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0
    }).format(amount);

    const updateCartCount = () => {
        const count = readList(cartStorageKey).length;
        document.querySelectorAll('.cart-count').forEach(badge => {
            badge.textContent = String(count);
            badge.setAttribute('aria-label', `${count} ${count === 1 ? 'item' : 'items'}`);
        });
    };

    const cartItems = document.getElementById('cartItems');
    const cartTotal = document.getElementById('cartTotal');
    const deliveryForm = document.getElementById('deliveryForm');
    const deliveryFeedback = document.getElementById('deliveryFeedback');
    const deliveryOrders = document.getElementById('deliveryOrders');

    const renderCart = () => {
        if (!cartItems || !cartTotal) return;
        const items = readList(cartStorageKey);
        cartItems.replaceChildren();

        if (!items.length) {
            const emptyMessage = document.createElement('p');
            emptyMessage.className = 'empty-state';
            emptyMessage.textContent = 'Your cart is waiting for its first vehicle.';
            cartItems.append(emptyMessage);
        }

        items.forEach(item => {
            const row = document.createElement('article');
            row.className = 'cart-item';
            const image = document.createElement('img');
            image.src = item.image;
            image.alt = '';
            const details = document.createElement('div');
            details.className = 'cart-item-details';
            const name = document.createElement('h3');
            name.textContent = item.name;
            const price = document.createElement('p');
            price.textContent = formatPrice(item.price);
            const remove = document.createElement('button');
            remove.className = 'text-button';
            remove.type = 'button';
            remove.textContent = 'Remove';
            remove.setAttribute('aria-label', `Remove ${item.name} from cart`);
            remove.addEventListener('click', () => {
                writeList(cartStorageKey, readList(cartStorageKey).filter(car => car.id !== item.id));
                updateCartCount();
                renderCart();
            });
            details.append(name, price, remove);
            row.append(image, details);
            cartItems.append(row);
        });

        cartTotal.textContent = formatPrice(items.reduce((total, item) => total + item.price, 0));
        const submit = document.getElementById('deliverySubmit');
        if (submit) submit.disabled = items.length === 0;
    };

    const renderOrders = () => {
        if (!deliveryOrders) return;
        const orders = readList(ordersStorageKey);
        deliveryOrders.replaceChildren();
        if (!orders.length) {
            const emptyMessage = document.createElement('p');
            emptyMessage.className = 'empty-state';
            emptyMessage.textContent = 'Your delivery requests will appear here.';
            deliveryOrders.append(emptyMessage);
            return;
        }

        orders.slice().reverse().forEach(order => {
            const card = document.createElement('article');
            card.className = 'order-card';
            const title = document.createElement('h3');
            title.textContent = `Request ${order.id}`;
            const vehicles = document.createElement('p');
            vehicles.textContent = order.cars.join(', ');
            const total = document.createElement('p');
            total.textContent = formatPrice(order.total);
            const status = document.createElement('p');
            status.className = `order-status ${order.status}`;
            status.textContent = order.status === 'cancelled' ? 'Delivery cancelled' : 'Delivery requested';
            card.append(title, vehicles, total, status);
            if (order.status === 'requested') {
                const cancel = document.createElement('button');
                cancel.className = 'text-button';
                cancel.type = 'button';
                cancel.textContent = 'Cancel delivery';
                cancel.addEventListener('click', () => {
                    const updatedOrders = readList(ordersStorageKey).map(savedOrder =>
                        savedOrder.id === order.id ? { ...savedOrder, status: 'cancelled' } : savedOrder
                    );
                    writeList(ordersStorageKey, updatedOrders);
                    renderOrders();
                });
                card.append(cancel);
            }
            deliveryOrders.append(card);
        });
    };

    document.querySelectorAll('[data-add-to-cart]').forEach(button => {
        button.addEventListener('click', () => {
            const card = button.closest('[data-car-id]');
            const car = {
                id: card.dataset.carId,
                name: card.dataset.carName,
                price: Number(card.dataset.carPrice),
                image: card.dataset.carImage
            };
            const items = readList(cartStorageKey);
            if (!items.some(item => item.id === car.id)) {
                items.push(car);
                writeList(cartStorageKey, items);
                button.textContent = 'Added to cart';
                window.setTimeout(() => { button.textContent = 'Add to cart'; }, 1400);
            } else {
                button.textContent = 'Already in cart';
                window.setTimeout(() => { button.textContent = 'Add to cart'; }, 1400);
            }
            updateCartCount();
        });
    });

    deliveryForm?.addEventListener('submit', event => {
        event.preventDefault();
        const items = readList(cartStorageKey);
        if (!items.length) return;
        const orders = readList(ordersStorageKey);
        orders.push({
            id: `V-${Date.now()}`,
            cars: items.map(item => item.name),
            total: items.reduce((total, item) => total + item.price, 0),
            status: 'requested'
        });
        writeList(ordersStorageKey, orders);
        writeList(cartStorageKey, []);
        deliveryForm.reset();
        deliveryFeedback.textContent = 'Your delivery request has been placed. Our concierge will contact you to confirm the details.';
        updateCartCount();
        renderCart();
        renderOrders();
    });

    const serviceForm = document.getElementById('serviceForm');
    serviceForm?.addEventListener('submit', event => {
        event.preventDefault();
        document.getElementById('serviceFeedback').textContent =
            'Your query has been submitted successfully. Our concierge will be in touch.';
        serviceForm.reset();
    });

    updateCartCount();
    renderCart();
    renderOrders();

    const modal = document.getElementById('authModal');
    const loginBtn = document.getElementById('loginBtn');
    const closeBtn = document.querySelector('.close-modal');
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');
    const showSignup = document.getElementById('showSignup');
    const showLogin = document.getElementById('showLogin');

    if (modal && loginBtn && closeBtn && loginForm && signupForm && showSignup && showLogin) {
        const closeModal = () => {
            modal.classList.remove('active');
            window.setTimeout(() => { modal.style.display = 'none'; }, 300);
        };

        loginBtn.addEventListener('click', event => {
            event.preventDefault();
            modal.style.display = 'flex';
            window.setTimeout(() => modal.classList.add('active'), 10);
        });
        closeBtn.addEventListener('click', closeModal);
        window.addEventListener('click', event => {
            if (event.target === modal) closeModal();
        });
        showSignup.addEventListener('click', event => {
            event.preventDefault();
            loginForm.classList.remove('active');
            window.setTimeout(() => signupForm.classList.add('active'), 200);
        });
        showLogin.addEventListener('click', event => {
            event.preventDefault();
            signupForm.classList.remove('active');
            window.setTimeout(() => loginForm.classList.add('active'), 200);
        });

        loginForm.addEventListener('submit', event => {
            event.preventDefault();
            const email = document.getElementById('loginEmail').value;
            const button = loginForm.querySelector('button');
            const originalText = button.textContent;
            button.textContent = 'Verifying...';
            button.style.opacity = '0.7';
            window.setTimeout(() => {
                button.textContent = originalText;
                button.style.opacity = '1';
                window.alert(`Welcome back! You are now logged in as ${email}`);
                closeModal();
                loginForm.reset();
                loginBtn.textContent = 'My Garage';
            }, 1500);
        });
        signupForm.addEventListener('submit', event => {
            event.preventDefault();
            const name = document.getElementById('signupName').value;
            const button = signupForm.querySelector('button');
            const originalText = button.textContent;
            button.textContent = 'Creating Account...';
            button.style.opacity = '0.7';
            window.setTimeout(() => {
                button.textContent = originalText;
                button.style.opacity = '1';
                window.alert(`Welcome to Velours, ${name}! Your account has been created successfully.`);
                closeModal();
                signupForm.reset();
                loginBtn.textContent = 'My Garage';
            }, 1500);
        });
    }
});
