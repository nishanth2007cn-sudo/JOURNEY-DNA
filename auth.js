/* =========================================
   JOURNEY DNA AUTH & SESSION HELPERS
   ========================================= */

const API_BASE_URL = (() => {
    const configured = window.API_BASE_URL || window.__API_BASE_URL__ || "";
    if (configured) return configured.replace(/\/$/, "");
    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
        return "http://127.0.0.1:5000";
    }
    return window.location.origin;
})();

let currentUser = null;

// Format relative media URLs to full API URLs when needed
function formatMediaUrl(url) {
    if (!url || typeof url !== "string") return "";
    url = url.trim();
    if (!url) return "";
    if (/^(https?:|\/\/|data:|blob:)/i.test(url)) {
        return url;
    }
    const cleanPath = url.startsWith("/") ? url : `/${url}`;
    return `${API_BASE_URL}${cleanPath}`;
}


// Generic fetch wrapper with credentials enabled
async function apiFetch(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;

    options.credentials = "include";
    options.headers = options.headers || {};

    if (options.body && typeof options.body === "object" && !(options.body instanceof FormData)) {
        options.headers["Content-Type"] = "application/json";
        options.body = JSON.stringify(options.body);
    }

    try {
        const response = await fetch(url, options);
        let data = {};
        try {
            data = await response.json();
        } catch (e) {
            data = { message: "Unexpected server response" };
        }
        return { ok: response.ok, status: response.status, data };
    } catch (error) {
        console.error("Backend Connection Error:", error);
        return {
            ok: false,
            status: 0,
            networkError: true,
            data: {
                message: "Unable to connect to the backend server. Please make sure the server is running."
            }
        };
    }
}

// Show Next Phase Modal or Toast
function showNextPhaseNotice(featureName = "This feature") {
    let modal = document.getElementById("nextPhaseModal");
    if (!modal) {
        modal = document.createElement("div");
        modal.id = "nextPhaseModal";
        modal.className = "phase-modal-overlay";
        modal.innerHTML = `
            <div class="phase-modal-card">
                <div class="phase-modal-icon">🚀</div>
                <h3>Coming in Next Phase</h3>
                <p id="phaseModalMessage">This feature will be available in the next phase.</p>
                <button class="btn-primary" onclick="closeNextPhaseNotice()">Got it</button>
            </div>
        `;
        document.body.appendChild(modal);
    }
    const msg = document.getElementById("phaseModalMessage");
    if (msg) {
        msg.textContent = "This feature will be available in the next phase.";
    }
    modal.classList.add("show");
}

function closeNextPhaseNotice() {
    const modal = document.getElementById("nextPhaseModal");
    if (modal) {
        modal.classList.remove("show");
    }
}

// Check session status and update UI elements
async function checkAuthStatus() {
    const res = await apiFetch("/api/status");
    const currentPage = window.location.pathname.split("/").pop() || "index.html";

    if (res.ok && res.data && res.data.user) {
        currentUser = res.data.user;
        window.isOwner = Boolean(currentUser && (currentUser.role === "owner" || currentUser.role === "admin" || currentUser.is_owner));
        if (window.isOwner) {
            document.body.classList.add("is-owner-authenticated");
        } else {
            document.body.classList.remove("is-owner-authenticated");
        }

        updateNavUI(true, currentUser);
        updateWelcomeMessage(currentUser);

        window.dispatchEvent(new CustomEvent("authReady", { detail: { user: currentUser, isOwner: window.isOwner } }));

        // If logged in and sitting on login or register, redirect to existing dashboard
        if (currentPage === "login.html" || currentPage === "register.html" || currentPage === "owner_login.html") {
            window.location.replace("dashboard.html");
        }

        return currentUser;
    } else {
        currentUser = null;
        window.isOwner = false;
        document.body.classList.remove("is-owner-authenticated");
        updateNavUI(false);
        updateWelcomeMessage(null);
        window.dispatchEvent(new CustomEvent("authReady", { detail: { user: null, isOwner: false } }));

        // Protected pages that require login
        const protectedPages = [
            "dashboard.html", "places.html", "maps.html", "profile.html",
            "plan_trip.html", "my_trips.html"
        ];
        
        if (protectedPages.includes(currentPage)) {
            window.location.replace("login.html");
        }

        return null;
    }
}

// Enforce auth requirement on protected pages
async function requireAuth() {
    const user = await checkAuthStatus();
    if (!user) {
        window.location.href = "login.html";
    }
    return user;
}

// Redirect authenticated user away from login/register
async function redirectIfAuth() {
    const user = await checkAuthStatus();
    if (user) {
        window.location.replace("dashboard.html");
    }
}

// Update Header Navigation Links
function updateNavUI(isLoggedIn, user = null) {
    const header = document.querySelector("header");
    if (!header) return;

    const currentPage = window.location.pathname.split("/").pop() || "dashboard.html";
    const isAuthPage = currentPage === "login.html" || currentPage === "register.html";

    let navContainer = header.querySelector("nav.desktop-nav");
    if (!navContainer) {
        const oldNav = header.querySelector("nav");
        if (oldNav) oldNav.remove();
        
        navContainer = document.createElement("nav");
        navContainer.className = "desktop-nav";
        
        const logo = header.querySelector(".logo");
        if (logo && logo.nextSibling) {
            header.insertBefore(navContainer, logo.nextSibling);
        } else {
            header.appendChild(navContainer);
        }
    }

    const logo = header.querySelector(".logo");
    if (logo) {
        logo.style.display = "inline-flex";
    }

    navContainer.style.display = "flex";

    const isAdmin = Boolean(isLoggedIn && user && (user.role === "admin" || user.role === "owner"));

    // Build the nav links - Clean unified navigation for all authenticated users
    let navHTML = `
        <a href="dashboard.html" class="nav-link ${currentPage === 'dashboard.html' || currentPage === 'index.html' ? 'active' : ''}">Dashboard</a>
        <a href="bus_directory.html" class="nav-link ${currentPage === 'bus_directory.html' ? 'active' : ''}">Bus Directory</a>
        <a href="places.html" class="nav-link ${currentPage === 'places.html' ? 'active' : ''}">Tourist Places</a>
        <a href="maps.html" class="nav-link ${currentPage === 'maps.html' ? 'active' : ''}">Maps</a>
        <a href="plan_trip.html" class="nav-link ${currentPage === 'plan_trip.html' ? 'active' : ''}">Plan Trip</a>
        <a href="my_trips.html" class="nav-link ${currentPage === 'my_trips.html' ? 'active' : ''}">My Trips</a>
    `;
    
    navContainer.innerHTML = navHTML;

    // Manage Auth buttons
    let authContainer = header.querySelector(".auth-container");
    if (!authContainer) {
        authContainer = document.createElement("div");
        authContainer.className = "auth-container user-profile-menu";
        
        const hamburger = header.querySelector(".mobile-menu-btn");
        if (hamburger) {
            header.insertBefore(authContainer, hamburger);
        } else {
            header.appendChild(authContainer);
            
            const menuBtn = document.createElement("button");
            menuBtn.className = "mobile-menu-btn";
            menuBtn.innerHTML = "☰";
            header.appendChild(menuBtn);
        }
    }

    let authHTML = '';
    if (isLoggedIn && user) {
        const initial = user.name ? user.name.charAt(0).toUpperCase() : 'N';
        const isOwnerAccount = Boolean(user && (user.role === "owner" || user.role === "admin" || user.is_owner || window.isOwner));
        authHTML = `
            <div class="profile-user-group">
                <button id="profileMenuButton" type="button" class="profile-pill-btn" aria-label="Profile menu" aria-expanded="false" aria-controls="profileDropdownPanel">
                    <span class="profile-icon">${initial}</span>
                    <span class="profile-name">${user.name}</span>
                    ${isOwnerAccount ? `<span class="owner-crown-pill" style="margin-left:6px; background:linear-gradient(135deg, #d5b779 0%, #b89347 100%); color:#031d16; font-size:0.68rem; font-weight:800; padding:2px 7px; border-radius:10px; letter-spacing:0.3px; display:inline-flex; align-items:center; gap:3px;">👑 Owner</span>` : ''}
                </button>
                <button id="logoutNavBtn" class="nav-btn-logout" type="button">Logout</button>
            </div>
        `;
    } else {
        authHTML = `
            <a href="login.html" class="nav-link ${currentPage === 'login.html' ? 'active' : ''}">Login</a>
            <a href="register.html" class="nav-link ${currentPage === 'register.html' ? 'active' : ''}">Register</a>
        `;
    }
    
    authContainer.innerHTML = authHTML;

    const profileButton = document.getElementById("profileMenuButton");
    if (profileButton) {
        profileButton.addEventListener("click", async (event) => {
            event.stopPropagation();
            const dropdown = document.getElementById("profileDropdownPanel");
            if (dropdown && dropdown.classList.contains("show")) {
                closeProfileDropdown();
                return;
            }
            await openProfileDropdown();
        });
    }

    const logoutBtn = document.getElementById("logoutNavBtn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", handleLogout);
    }
    
    // Attach hamburger logic
    const menuBtn = header.querySelector(".mobile-menu-btn");
    if (menuBtn) {
        menuBtn.onclick = () => {
            navContainer.classList.toggle("mobile-active");
            authContainer.classList.toggle("mobile-active");
        };
    }
}

// Update Welcome Badge on Dashboard
function updateWelcomeMessage(user) {
    const welcomeEl = document.getElementById("userWelcomeBanner");
    if (!welcomeEl) return;

    if (user && user.name) {
        welcomeEl.innerHTML = `<div class="welcome-badge">Welcome, ${user.name} 👋</div>`;
        welcomeEl.style.display = "block";
    } else {
        welcomeEl.innerHTML = "";
        welcomeEl.style.display = "none";
    }
}

function closeProfileDropdown() {
    const dropdown = document.getElementById("profileDropdownPanel");
    const profileButton = document.getElementById("profileMenuButton");
    if (dropdown) {
        dropdown.classList.remove("show");
        dropdown.remove();
    }
    if (profileButton) {
        profileButton.setAttribute("aria-expanded", "false");
    }
}

async function openProfileDropdown() {
    const profileButton = document.getElementById("profileMenuButton");
    if (!profileButton) return;

    const existing = document.getElementById("profileDropdownPanel");
    if (existing) existing.remove();

    let user = currentUser;
    if (!user || !user.age && !user.gender && !user.phone && !user.travel_preference && !user.preferred_places) {
        const profile = await apiFetch("/api/profile");
        user = profile.ok && profile.data && profile.data.user ? profile.data.user : user;
    }
    if (user) {
        currentUser = user;
    }

    const profileData = user || currentUser || { name: "User", email: "", age: "", gender: "", phone: "", travel_preference: "Not selected", preferred_places: [] };
    const selectedPlaces = Array.isArray(profileData.preferred_places) ? profileData.preferred_places : [];
    const allPlacesRes = await apiFetch("/api/places");
    const allPlaces = Array.isArray(allPlacesRes.data) ? allPlacesRes.data : [];

    const isOwnerUser = Boolean(window.isOwner || (profileData && (profileData.role === "owner" || profileData.role === "admin" || profileData.is_owner)));
    const displayEmail = isOwnerUser ? "Master Owner Account (Secured)" : (profileData.email || "").replace(/"/g, '&quot;');

    const dropdown = document.createElement("div");
    dropdown.id = "profileDropdownPanel";
    dropdown.className = "profile-dropdown-panel";
    dropdown.innerHTML = `
        <div class="profile-dropdown-header">
            <div class="profile-header-avatar">${(profileData.name || "U").charAt(0).toUpperCase()}</div>
            <div>
                <p class="profile-card-label" style="display:flex; align-items:center; gap:6px;">
                    Profile ${isOwnerUser ? '<span style="background:linear-gradient(135deg, #d5b779 0%, #b89347 100%); color:#031d16; font-size:0.65rem; font-weight:800; padding:1px 6px; border-radius:8px;">👑 Master Owner</span>' : ''}
                </p>
                <h3>${profileData.name || "Traveler"}</h3>
            </div>
        </div>

        <form id="profileDropdownForm" class="profile-dropdown-form">
            <div class="profile-form-row">
                <label>
                    <span>Name</span>
                    <input id="profileEditName" type="text" value="${(profileData.name || "").replace(/"/g, '&quot;')}" required>
                </label>
            </div>

            <div class="profile-form-row">
                <label>
                    <span>Email</span>
                    <input id="profileEditEmail" type="text" value="${displayEmail}" readonly style="${isOwnerUser ? 'color:var(--muted-turquoise, #54d1c6); font-weight:600;' : ''}">
                </label>
            </div>

            <div class="profile-form-grid">
                <label>
                    <span>Age</span>
                    <input id="profileEditAge" type="number" min="1" max="120" value="${profileData.age || ""}">
                </label>
                <label>
                    <span>Gender</span>
                    <select id="profileEditGender">
                        <option value="Male" ${profileData.gender === "Male" ? "selected" : ""}>Male</option>
                        <option value="Female" ${profileData.gender === "Female" ? "selected" : ""}>Female</option>
                        <option value="Other" ${profileData.gender === "Other" ? "selected" : ""}>Other</option>
                        <option value="Prefer not to say" ${profileData.gender === "Prefer not to say" ? "selected" : ""}>Prefer not to say</option>
                    </select>
                </label>
            </div>

            <div class="profile-form-row">
                <label>
                    <span>Phone</span>
                    <input id="profileEditPhone" type="tel" value="${(profileData.phone || "").replace(/"/g, '&quot;')}" placeholder="+91 98765 43210">
                </label>
            </div>

            <div class="profile-place-picker">
                <div class="profile-place-header">
                    <span>Preferred places</span>
                    <strong id="profilePlaceCount">${selectedPlaces.length}/4</strong>
                </div>
                <div class="profile-place-options">
                    ${allPlaces.map((place) => {
                        const isSelected = selectedPlaces.includes(String(place.id)) || selectedPlaces.includes(place.id);
                        return `
                            <label class="profile-place-option ${isSelected ? "selected" : ""}">
                                <input type="checkbox" value="${place.id}" ${isSelected ? "checked" : ""}>
                                <span>${place.name}</span>
                            </label>
                        `;
                    }).join("")}
                </div>
            </div>

            <div id="profileDropdownMessage" class="profile-dropdown-message" aria-live="polite"></div>

            <div class="profile-popup-actions">
                <a href="profile.html" class="profile-popup-link">View full profile</a>
                <button type="submit" class="nav-btn-logout profile-dropdown-save">Save</button>
            </div>
        </form>

        <div class="profile-popup-footer">
            <button type="button" id="logoutDropdownBtn" class="nav-btn-logout profile-dropdown-logout">Logout</button>
        </div>
    `;

    profileButton.parentElement.appendChild(dropdown);
    dropdown.classList.add("show");
    profileButton.setAttribute("aria-expanded", "true");

    const placeCheckboxes = dropdown.querySelectorAll(".profile-place-option input[type='checkbox']");
    const placeCount = dropdown.querySelector("#profilePlaceCount");

    function refreshPlaceCount() {
        const checked = Array.from(placeCheckboxes).filter((input) => input.checked).length;
        if (placeCount) placeCount.textContent = `${checked}/4`;
    }

    placeCheckboxes.forEach((checkbox) => {
        checkbox.addEventListener("change", () => {
            const total = Array.from(placeCheckboxes).filter((input) => input.checked).length;
            if (total > 4) {
                checkbox.checked = false;
                const message = dropdown.querySelector("#profileDropdownMessage");
                if (message) {
                    message.textContent = "You can select up to 4 places only.";
                    message.classList.add("error");
                }
                return;
            }

            const message = dropdown.querySelector("#profileDropdownMessage");
            if (message) {
                message.textContent = "";
                message.classList.remove("error");
            }
            refreshPlaceCount();
        });
    });

    refreshPlaceCount();

    const form = dropdown.querySelector("#profileDropdownForm");
    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const message = dropdown.querySelector("#profileDropdownMessage");
        const selected = Array.from(placeCheckboxes).filter((input) => input.checked).map((input) => input.value);

        if (selected.length !== 4) {
            if (message) {
                message.textContent = `Please select exactly 4 places. You selected ${selected.length}.`;
                message.classList.add("error");
            }
            return;
        }

        const payload = {
            name: dropdown.querySelector("#profileEditName").value.trim(),
            age: Number(dropdown.querySelector("#profileEditAge").value),
            gender: dropdown.querySelector("#profileEditGender").value,
            phone: dropdown.querySelector("#profileEditPhone").value.trim(),
            preferred_places: selected
        };

        if (!payload.name || !payload.age || !payload.gender || !payload.phone) {
            if (message) {
                message.textContent = "Please complete all fields before saving.";
                message.classList.add("error");
            }
            return;
        }

        const saveBtn = form.querySelector("button[type='submit']");
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.textContent = "Saving...";
        }

        const res = await apiFetch("/api/profile", { method: "PUT", body: payload });

        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.textContent = "Save";
        }

        if (res.ok && res.data && res.data.success) {
            currentUser = res.data.user;
            updateNavUI(true, currentUser);
            closeProfileDropdown();
            return;
        }

        if (message) {
            message.textContent = (res && res.data && res.data.error) || "Profile update failed.";
            message.classList.add("error");
        }
    });

    const logoutDropdownBtn = document.getElementById("logoutDropdownBtn");
    if (logoutDropdownBtn) {
        logoutDropdownBtn.addEventListener("click", async () => {
            await handleLogout();
        });
    }

    document.addEventListener("click", function closeDropdownOnOutside(event) {
        const target = event.target;
        const withinButton = target && target.closest("#profileMenuButton");
        const withinPanel = target && target.closest("#profileDropdownPanel");
        if (!withinButton && !withinPanel) {
            closeProfileDropdown();
            document.removeEventListener("click", closeDropdownOnOutside);
        }
    }, { once: false });
}

// Logout Handler
async function handleLogout() {
    await apiFetch("/api/logout", { method: "POST" });
    currentUser = null;
    closeProfileDropdown();
    window.location.href = "login.html";
}

// Helper: Show alert message
function showAlert(containerId, message, type = "error") {
    const container = document.getElementById(containerId);
    if (!container) return;

    const alertClass = type === "success" ? "alert-success" : "alert-error";
    container.innerHTML = `<div class="alert ${alertClass}">${message}</div>`;
    container.style.display = "block";
}

function clearAlert(containerId) {
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = "";
        container.style.display = "none";
    }
}

// Toggle password visibility
function togglePasswordVisibility(inputId, toggleBtnId) {
    const input = document.getElementById(inputId);
    const btn = document.getElementById(toggleBtnId);

    if (input && btn) {
        btn.addEventListener("click", () => {
            if (input.type === "password") {
                input.type = "text";
                btn.textContent = "Hide";
                btn.setAttribute("aria-label", "Hide password");
            } else {
                input.type = "password";
                btn.textContent = "Show";
                btn.setAttribute("aria-label", "Show password");
            }
        });
    }
}

// Global initialization
document.addEventListener("DOMContentLoaded", () => {
    checkAuthStatus();
});
