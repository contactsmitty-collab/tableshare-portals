// TableShare Portal - API Client
// Automatically detects API URL based on current hostname
function getApiBaseUrl() {
    // Check for manual override in localStorage (for testing)
    const override = localStorage.getItem('tableshare_api_url');
    if (override) {
        console.log('🔗 Using override API URL:', override);
        return override;
    }
    
    // Detect from current location
    const hostname = window.location.hostname;
    const protocol = window.location.protocol;
    const port = window.location.port || (protocol === 'https:' ? '443' : '80');
    
    // Build API URL based on current host
    let apiUrl;
    
    if (hostname === 'localhost' || hostname === '127.0.0.1' || protocol === 'file:') {
        // Local development
        apiUrl = 'http://localhost:3000/api/v1';
    } else if (hostname === 'admin.tableshare.ai' || hostname === 'partners.tableshare.ai' || hostname === 'partner.tableshare.ai') {
        // Production: portals hosted on Vercel, API at backend
        apiUrl = 'https://tableshare.pixelcheese.com/api/v1';
    } else {
        // Fallback: same origin (e.g. when served from backend)
        const base = `${protocol}//${hostname}${port && port !== '80' && port !== '443' ? ':' + port : ''}`;
        apiUrl = base + '/api/v1';
    }
    
    console.log('🔗 API URL:', apiUrl);
    return apiUrl;
}

const API_BASE_URL = getApiBaseUrl();

const api = {
    token: null,
    user: null,

    setToken(token) {
        this.token = token;
        localStorage.setItem('tableshare_token', token);
    },

    getToken() {
        if (!this.token) {
            this.token = localStorage.getItem('tableshare_token');
        }
        return this.token;
    },

    clearToken() {
        this.token = null;
        this.user = null;
        localStorage.removeItem('tableshare_token');
        localStorage.removeItem('tableshare_user');
        localStorage.removeItem('ts_availability');
        localStorage.removeItem('ts_promotions');
        localStorage.removeItem('ts_subscription_tier');
    },

    async request(endpoint, options = {}) {
        const token = this.getToken();
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };

        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        try {
            const response = await fetch(`${API_BASE_URL}${endpoint}`, {
                ...options,
                headers,
                credentials: 'include'
            });

            if (response.status === 401) {
                this.clearToken();
                window.location.href = '/';
                throw new Error('Session expired');
            }

            const text = await response.text();
            let data = {};
            if (text && text.trim()) {
                try {
                    data = JSON.parse(text);
                } catch (e) {
                    const isHtml = text.trimStart().startsWith('<');
                    const msg = isHtml
                        ? 'The API returned an HTML page instead of JSON. Check that https://tableshare.pixelcheese.com is reachable and CORS allows ' + window.location.origin + '.'
                        : 'Invalid response from server. Please try again.';
                    console.error('API parse error:', endpoint, 'status:', response.status, 'preview:', text.slice(0, 80));
                    throw new Error(msg);
                }
            }
            if (!response.ok) {
                throw new Error(data.error || data.message || 'Request failed');
            }
            return data;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    },

    async login(email, password) {
        // Login without sending any existing auth header
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ email, password })
        });
            const text = await response.text();
            let data = {};
            if (text && text.trim()) {
                try {
                    data = JSON.parse(text);
                } catch (e) {
                    if (text.trimStart().startsWith('<')) {
                        console.error('API returned HTML instead of JSON:', text.slice(0, 200));
                        throw new Error('API returned an error page. Check that tableshare.pixelcheese.com is reachable and CORS allows partner.tableshare.ai.');
                    }
                    throw new Error('Invalid response from server. Please try again.');
                }
            }
        if (!response.ok) {
            const msg = data.error || data.message || (response.status >= 500 ? `Server error (${response.status}). Please try again.` : 'Login failed');
            throw new Error(msg);
        }
        if (data.token) {
            this.setToken(data.token);
            this.user = data.user;
            localStorage.setItem('tableshare_user', JSON.stringify(data.user));
        }
        return data;
    },

    async logout() {
        this.clearToken();
        window.location.href = '/';
    },

    async forgotPassword(email) {
        const response = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ email: email.trim() })
        });
        const text = await response.text();
        let data = {};
        if (text && text.trim()) {
            try { data = JSON.parse(text); } catch (e) {
                throw new Error('Invalid response from server. Please try again.');
            }
        }
        if (!response.ok) {
            throw new Error(data.error || data.message || 'Request failed');
        }
        return data;
    },

    async resetPassword(token, newPassword) {
        const response = await fetch(`${API_BASE_URL}/auth/reset-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ token: token.trim(), newPassword })
        });
        const text = await response.text();
        let data = {};
        if (text && text.trim()) {
            try { data = JSON.parse(text); } catch (e) {
                throw new Error('Invalid response from server. Please try again.');
            }
        }
        if (!response.ok) {
            throw new Error(data.error || data.message || 'Request failed');
        }
        return data;
    },

    async getCurrentUser() {
        if (this.user) return this.user;
        const stored = localStorage.getItem('tableshare_user');
        if (stored) {
            try {
                this.user = JSON.parse(stored);
                return this.user;
            } catch (e) {
                localStorage.removeItem('tableshare_user');
            }
        }
        const data = await this.request('/users/me');
        this.user = data.user;
        localStorage.setItem('tableshare_user', JSON.stringify(data.user));
        return this.user;
    },

    async getUsers(search = '') {
        const endpoint = search ? `/admin/users?search=${encodeURIComponent(search)}` : '/admin/users';
        const data = await this.request(endpoint);
        return Array.isArray(data) ? data : data.users || [];
    },

    async createUser(userData) {
        return await this.request('/admin/users', {
            method: 'POST',
            body: JSON.stringify(userData)
        });
    },

    async updateUser(id, updates) {
        return await this.request(`/admin/users/${id}`, {
            method: 'PUT',
            body: JSON.stringify(updates)
        });
    },

    async deleteUser(id) {
        return await this.request(`/admin/users/${id}`, {
            method: 'DELETE'
        });
    },

    async getRestaurants(search = '') {
        const endpoint = search ? `/admin/restaurants?search=${encodeURIComponent(search)}` : '/admin/restaurants';
        const data = await this.request(endpoint);
        return Array.isArray(data) ? data : data.restaurants || [];
    },

    async getRestaurant(id) {
        const data = await this.request(`/restaurants/${id}`);
        return data.restaurant || data;
    },

    async createRestaurant(data) {
        return await this.request('/admin/restaurants', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },

    async updateRestaurant(id, updates) {
        return await this.request(`/admin/restaurants/${id}`, {
            method: 'PUT',
            body: JSON.stringify(updates)
        });
    },

    async deleteRestaurant(id) {
        return await this.request(`/admin/restaurants/${id}`, {
            method: 'DELETE'
        });
    },

    async getStats() {
        const data = await this.request('/admin/stats');
        return data.stats || data;
    },

    async getStatsTrends(metric = 'checkins', days = 30) {
        const q = new URLSearchParams({ metric, days });
        return await this.request('/admin/stats/trends?' + q.toString());
    },

    async getCheckins(restaurantId = null) {
        const endpoint = restaurantId ? `/admin/checkins?restaurant_id=${restaurantId}` : '/admin/checkins';
        const data = await this.request(endpoint);
        return Array.isArray(data) ? data : data.checkins || [];
    },

    async getRatings(restaurantId = null) {
        const endpoint = restaurantId ? `/admin/ratings?restaurant_id=${restaurantId}` : '/admin/ratings';
        const data = await this.request(endpoint);
        return Array.isArray(data) ? data : data.ratings || [];
    },

    async getReports(params = {}) {
        const q = new URLSearchParams();
        if (params.status) q.set('status', params.status);
        if (params.target_type) q.set('target_type', params.target_type);
        if (params.limit) q.set('limit', params.limit);
        if (params.offset) q.set('offset', params.offset);
        const suffix = q.toString() ? '?' + q.toString() : '';
        const data = await this.request('/admin/reports' + suffix);
        return data.reports || [];
    },

    async updateReport(id, updates) {
        return await this.request(`/admin/reports/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(updates)
        });
    },

    async getPromotions(restaurantId) {
        const data = await this.request(`/admin/restaurants/${restaurantId}/promotions`);
        return data.promotions || [];
    },

    async createPromotion(restaurantId, promo) {
        return await this.request(`/admin/restaurants/${restaurantId}/promotions`, {
            method: 'POST',
            body: JSON.stringify(promo)
        });
    },

    async updatePromotion(restaurantId, promoId, updates) {
        return await this.request(`/admin/restaurants/${restaurantId}/promotions/${promoId}`, {
            method: 'PATCH',
            body: JSON.stringify(updates)
        });
    },

    async deletePromotion(restaurantId, promoId) {
        return await this.request(`/admin/restaurants/${restaurantId}/promotions/${promoId}`, {
            method: 'DELETE'
        });
    },

    async getBlocks() {
        const data = await this.request('/admin/blocks');
        return data;
    },

    async getWaitlist(restaurantId) {
        const data = await this.request(`/admin/restaurants/${restaurantId}/waitlist`);
        return data.waitlist || [];
    }
};
