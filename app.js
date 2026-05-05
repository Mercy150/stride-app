/* app.js — Updated with requested features and behavior changes */

/* ---------- State ---------- */
const state = {
  role: 'passenger',
  userEmail: null,
  user: null,
  pickupText: '',
  destText: '',
  pickupCoords: null,
  destCoords: null,
  selectedVehicle: null,
  selectedPayment: 'cash',
  booking: null,
  activities: JSON.parse(localStorage.getItem('stride_acts') || '[]'),
  previousPage: null
};

/* ---------- Elements ---------- */
const splash = document.getElementById('splash');
const btnStartPassenger = document.getElementById('btnStartPassenger');
const btnStartDriver = document.getElementById('btnStartDriver');
const btnToLogin = document.getElementById('btnToLogin');
const btnToSignup = document.getElementById('btnToSignup');

const authModal = document.getElementById('authModal');
const authTitle = document.getElementById('authTitle');
const authEmail = document.getElementById('authEmail');
const authPass = document.getElementById('authPass');
const authSubmit = document.getElementById('authSubmit');
const authCancel = document.getElementById('authCancel');

const authFormLogin = document.getElementById('authFormLogin');
const authFormSignup = document.getElementById('authFormSignup');

const signupFirst = document.getElementById('signupFirst');
const signupLast = document.getElementById('signupLast');
const signupEmail = document.getElementById('signupEmail');
const signupPass = document.getElementById('signupPass');
const signupPass2 = document.getElementById('signupPass2');
const doSignup = document.getElementById('doSignup');
const cancelSignup = document.getElementById('cancelSignup');
const openSignup = document.getElementById('openSignup');

const roleBadge = document.getElementById('roleBadge');
const logoutBtn = document.getElementById('logout');

const pickupInput = document.getElementById('pickupInput');
const destinationInput = document.getElementById('destinationInput');
const btnSearch = document.getElementById('btnSearch');
const btnMyLocation = document.getElementById('btnMyLocation');

const vehicleListEl = document.querySelector('.vehicle-list');
const btnProceedBooking = document.getElementById('btnProceedBooking');
const btnBackToHome = document.getElementById('btnBackToHome');

const summaryCard = document.getElementById('summaryCard');
const paymentOptions = document.querySelectorAll('.payment-option');

const btnConfirmBooking = document.getElementById('btnConfirmBooking');

const driverCard = document.getElementById('driverCard');
const btnCancelRide = document.getElementById('btnCancelRide');
const btnCompleteRide = document.getElementById('btnCompleteRide');

const activityList = document.getElementById('activityList');

const navHome = document.getElementById('navHome');
const navActivity = document.getElementById('navActivity');
const navProfile = document.getElementById('navProfile');

const bottomNav = document.getElementById('bottomNav');

const pages = {
  splash: splash,
  home: document.getElementById('homePage'),
  vehicle: document.getElementById('vehiclePage'),
  booking: document.getElementById('bookingPage'),
  rideActive: document.getElementById('rideActivePage'),
  activity: document.getElementById('activityPage'),
  profile: document.getElementById('profilePage'),
  driverDashboard: document.getElementById('driverDashboard')
};

const btnBackTop = document.getElementById('btnBackTop');
const homeMapWrap = document.getElementById('homeMapWrap');
const mapEl = document.getElementById('map');

/* ---------- Map setup ---------- */
const mapCenter = [-1.286389, 36.817223];
const map = L.map('map', { zoomControl: false, attributionControl: false }).setView(mapCenter, 13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

/* Ride map (created later) */
let rideMap = null;
let ridePolyline = null;
let rideMarker = null;
let simInterval = null;

/* ---------- Vehicles ---------- */
const vehicles = [
  { id:'standard', title:'Standard Accessible', desc:'Fits wheelchair comfortably.', base:120 },
  { id:'van', title:'Van Accessible', desc:'Lift-enabled van for full support.', base:200 },
  { id:'premium', title:'Premium Accessible', desc:'Extra comfort with full wheelchair access.', base:300 }
];

/* ---------- Helpers ---------- */
function showPage(key){
  // keep previous for back behavior
  if(state.currentPage && state.currentPage !== key) state.previousPage = state.currentPage;
  state.currentPage = key;

  Object.values(pages).forEach(p=>p.classList.remove('active'));
  if(pages[key]) pages[key].classList.add('active');

  // control splash / auth class
  const splashActive = splash.style.display !== 'none';
  const authActive = authModal.style.display === 'flex';
  document.body.classList.toggle('splash-active', splashActive || authActive);

  // show/hide top back button
  if(key === 'home' || key === 'splash') {
    btnBackTop.style.display = 'none';
  } else {
    btnBackTop.style.display = 'inline-block';
  }

  // highlight bottom nav
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
  if(key==='home') navHome.classList.add('active');
  if(key==='activity') navActivity.classList.add('active');
  if(key==='profile') navProfile.classList.add('active');

  // Map invalidation after transition
  setTimeout(()=>{ try{ map.invalidateSize(); if(rideMap) rideMap.invalidateSize(); }catch(e){} }, 250);
}

function toast(msg){ alert(msg); }

/* Deterministic pseudo-geocode */
function pseudoGeocode(text){
  if(!text) return null;
  let h=0; for(let i=0;i<text.length;i++) h = (h<<5)-h + text.charCodeAt(i);
  const lat = mapCenter[0] + ((h % 100) / 1000);
  const lng = mapCenter[1] + (((h>>3) % 100) / 1000);
  return [lat, lng];
}

/* haversine (km) */
function distanceKm(a,b){
  const toRad = v=>v*Math.PI/180;
  const R=6371;
  const dLat = toRad(b[0]-a[0]);
  const dLon = toRad(b[1]-a[1]);
  const A = Math.sin(dLat/2)**2 + Math.cos(toRad(a[0]))*Math.cos(toRad(b[0]))*Math.sin(dLon/2)**2;
  const C = 2*Math.atan2(Math.sqrt(A), Math.sqrt(1-A));
  return R * C;
}
function calculatePrice(base, km){
  const perKm = 30;
  return Math.round(base + (km * perKm));
}

/* ---------- Auth ---------- */
function openAuth(kind='login'){
  authModal.style.display='flex';
  authModal.setAttribute('aria-hidden','false');
  if(kind==='login'){ authFormLogin.style.display='block'; authFormSignup.style.display='none'; authTitle.textContent='Sign In'; }
  else { authFormLogin.style.display='none'; authFormSignup.style.display='block'; authTitle.textContent='Sign Up'; }
}
function closeAuth(){ authModal.style.display='none'; authModal.setAttribute('aria-hidden','true'); }

/* btn text/behavior: Sign In on splash opens login; Sign Up opens signup form */
btnToLogin.addEventListener('click', ()=> openAuth('login'));
btnToSignup.addEventListener('click', ()=> openAuth('signup'));
openSignup.addEventListener('click', ()=> openAuth('signup'));
authCancel.addEventListener('click', ()=> closeAuth());
cancelSignup.addEventListener('click', ()=> closeAuth());

/* signup: create account and auto-login (populate profile) */
doSignup.addEventListener('click', ()=>{
  const f = signupFirst.value.trim(), l = signupLast.value.trim(), e = signupEmail.value.trim().toLowerCase();
  const p = signupPass.value, p2 = signupPass2.value;
  if(!f||!l||!e||!p) return toast('Fill all sign-up fields');
  if(p !== p2) return toast('Passwords do not match');
  const users = JSON.parse(localStorage.getItem('stride_users')||'{}');
  if(users[e]) return toast('Account exists, please login');
  users[e] = { first:f, last:l, email:e, pass:p, phone:'', card:'' };
  localStorage.setItem('stride_users', JSON.stringify(users));

  // auto login right after sign up
  state.userEmail = e;
  state.user = users[e];
  populateProfileFromUser();
  closeAuth();
  hideSplash(); showPage('home');
  logoutBtn.style.display = 'inline-block';
});

/* login */
authSubmit.addEventListener('click', ()=>{
  if(authFormLogin.style.display !== 'none'){
    const e = authEmail.value.trim().toLowerCase(), p = authPass.value;
    if(!e||!p) return toast('Enter email and password');
    const users = JSON.parse(localStorage.getItem('stride_users')||'{}');
    if(!users[e]) return toast('No account found');
    if(users[e].pass !== p) return toast('Incorrect password');
    state.userEmail = e; state.user = users[e];
    populateProfileFromUser();
    closeAuth();
    hideSplash(); showPage('home');
    logoutBtn.style.display = 'inline-block';
  }
});

/* logout - top nav button */
logoutBtn.addEventListener('click', ()=>{
  const confirmOut = confirm('Do you want to logout?');
  if(!confirmOut) return;
  state.user = null; state.userEmail = null;
  logoutBtn.style.display = 'none';
  // return to splash
  showSplash();
});

/* populate profile fields from state.user */
function populateProfileFromUser(){
  if(!state.user) return;
  document.getElementById('profileFirst').value = state.user.first || '';
  document.getElementById('profileLast').value = state.user.last || '';
  document.getElementById('profileEmail').value = state.user.email || '';
  document.getElementById('profilePhone').value = state.user.phone || '';
  document.getElementById('cardNumber').value = state.user.card || '';
}

/* manage splash visibility and map display */
function hideSplash(){
  splash.style.display = 'none';
  // show map area
  homeMapWrap.style.display = 'block';
  bottomNav.style.display = 'flex';
}
function showSplash(){
  splash.style.display = 'flex';
  homeMapWrap.style.display = 'none';
  bottomNav.style.display = 'none';
  // clear some temp state
  showPage('splash');
}

/* ---------- Splash role buttons - require login first ---------- */
btnStartPassenger.addEventListener('click', ()=>{
  state.role = 'passenger';
  roleBadge.textContent = 'Passenger';
  // require login
  if(!state.userEmail){ openAuth('login'); toast('Please sign in / sign up to continue as passenger'); return; }
  hideSplash(); showPage('home');
});

btnStartDriver.addEventListener('click', ()=>{
  state.role = 'driver';
  roleBadge.textContent = 'Driver';
  if(!state.userEmail){ openAuth('login'); toast('Please sign in / sign up to continue as driver'); return; }
  // for driver, hide bottom nav and go to dashboard
  bottomNav.style.display = 'none';
  showPage('driverDashboard');
});

/* ---------- Home interactions: pickup/destination ---------- */
/* Use My Location: set pickup text to "My Location (lat, lng)" and set coords */
btnMyLocation.addEventListener('click', ()=>{
  if(!navigator.geolocation) return toast('Geolocation not supported');
  navigator.geolocation.getCurrentPosition(pos=>{
    const lat = pos.coords.latitude.toFixed(4);
    const lng = pos.coords.longitude.toFixed(4);
    pickupInput.value = `My Location (${lat}, ${lng})`;
    state.pickupCoords = [parseFloat(lat), parseFloat(lng)];
  }, ()=> toast('Unable to get location'));
});

/* Search Rides: validate and go to vehicle selection */
btnSearch.addEventListener('click', ()=>{
  const pick = pickupInput.value.trim();
  const dest = destinationInput.value.trim();
  if(!pick || !dest) { alert('Please enter both pickup and destination'); return; }

  state.pickupText = pick;
  state.destText = dest;

  // if pickup is of format "My Location (lat, lng)" try to parse coords, else pseudo-geocode both
  const myLocMatch = pick.match(/My Location\s*\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)/i);
  if(myLocMatch){
    state.pickupCoords = [parseFloat(myLocMatch[1]), parseFloat(myLocMatch[2])];
  } else {
    state.pickupCoords = pseudoGeocode(pick);
  }
  state.destCoords = pseudoGeocode(dest);

  // show vehicle selection (require login to proceed to booking but selection allowed)
  renderVehicles();
  showPage('vehicle');
});

/* ---------- Vehicles UI ---------- */
function renderVehicles(){
  vehicleListEl.innerHTML = '';
  btnProceedBooking.disabled = true;
  state.selectedVehicle = null;
  vehicles.forEach(v=>{
    const li = document.createElement('div');
    li.className = 'vehicle-item';
    li.dataset.id = v.id;

    const km = distanceKm(state.pickupCoords || mapCenter, state.destCoords || mapCenter);
    const price = calculatePrice(v.base, km);

    li.innerHTML = `
      <div class="vehicle-thumb">${v.title.split(' ')[0].slice(0,3).toUpperCase()}</div>
      <div style="flex:1">
        <div style="font-weight:700">${v.title}</div>
        <div class="muted small">${v.desc}</div>
        <div class="small muted" style="margin-top:8px; display:none" data-detail>Extra details: Spacious, accessible ramp available.</div>
      </div>
      <div style="min-width:110px;text-align:right">
        <div style="font-weight:700">KSh ${price}</div>
        <div class="small muted">${Math.max(1,Math.round(km))} km</div>
      </div>
    `;

    // click expands / selects
    li.addEventListener('click', ()=>{
      document.querySelectorAll('.vehicle-item').forEach(x=>{
        x.classList.remove('selected');
        const det = x.querySelector('[data-detail]'); if(det) det.style.display = 'none';
      });
      li.classList.add('selected');
      const det = li.querySelector('[data-detail]'); if(det) det.style.display = 'block';
      state.selectedVehicle = { ...v, price };
      btnProceedBooking.disabled = false;
    });

    vehicleListEl.appendChild(li);
  });
}

/* Back buttons from vehicle -> home (previous) */
document.getElementById('btnBackFromVehicle').addEventListener('click', ()=> {
  showPage('home');
});

/* Back button on vehicle page bottom */
btnBackToHome.addEventListener('click', ()=> showPage('home'));

/* Proceed to booking summary */
btnProceedBooking.addEventListener('click', ()=>{
  if(!state.selectedVehicle) return toast('Please select a ride');
  // require login to confirm booking (redirect to login if not logged in)
  if(!state.userEmail){ openAuth('login'); toast('Please sign in to confirm booking'); return; }

  const km = Math.max(1, Math.round(distanceKm(state.pickupCoords, state.destCoords)));
  summaryCard.innerHTML = `
    <div><strong>${state.selectedVehicle.title}</strong></div>
    <div class="muted">${state.selectedVehicle.desc}</div>
    <div style="margin-top:8px"><strong>Pickup:</strong> ${state.pickupText}</div>
    <div><strong>Destination:</strong> ${state.destText}</div>
    <div style="margin-top:8px"><strong>Distance:</strong> ${km} km</div>
    <div style="margin-top:8px"><strong>Price:</strong> KSh ${state.selectedVehicle.price}</div>
  `;

  // payment UI reset, set default
  paymentOptions.forEach(p=>p.classList.remove('active'));
  const cashBtn = document.querySelector('.payment-option[data-method="cash"]');
  if(cashBtn) cashBtn.classList.add('active');
  state.selectedPayment = 'cash';

  showPage('booking');
});

/* Back from booking to vehicle */
document.getElementById('btnBackFromBooking').addEventListener('click', ()=> showPage('vehicle'));
document.getElementById('btnBackToVehicle').addEventListener('click', ()=> showPage('vehicle'));

/* payment options pick */
paymentOptions.forEach(btn=>{
  btn.addEventListener('click', ()=>{
    paymentOptions.forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    state.selectedPayment = btn.dataset.method;
  });
});

/* confirm booking -> save activity & show live ride */
btnConfirmBooking.addEventListener('click', ()=>{
  if(!state.userEmail){ openAuth('login'); toast('Please sign in to confirm booking'); return; }

  const driver = { name:'John Mwangi', vehicle: state.selectedVehicle.title, plate:'KDJ 563M', rating:4.9 };
  const booking = {
    id: 'B' + Date.now(),
    driver,
    vehicle: state.selectedVehicle,
    from: state.pickupText,
    to: state.destText,
    price: state.selectedVehicle.price,
    payment: state.selectedPayment,
    time: new Date().toLocaleString()
  };
  state.booking = booking;

  state.activities.unshift({ id: booking.id, title: `${booking.vehicle.title || booking.vehicle} — KSh ${booking.price}`, when: booking.time, to: booking.to });
  if(state.activities.length>50) state.activities.pop();
  localStorage.setItem('stride_acts', JSON.stringify(state.activities));
  renderActivity();

  populateDriverCard(driver, booking);
  showPage('rideActive');
  initRideMapSimulation();
});

/* ---------- Ride active: driver card & map simulation ---------- */
function populateDriverCard(driver, booking){
  driverCard.innerHTML = `
    <div class="avatar">${driver.name.split(' ').map(n=>n[0]).slice(0,2).join('')}</div>
    <div class="driver-info">
      <div style="font-weight:700">${driver.name} — ${driver.vehicle}</div>
      <div class="small muted">${driver.plate} · Rating ${driver.rating}</div>
      <div style="margin-top:8px"><strong>ETA:</strong> <span id="etaText">6 min</span></div>
    </div>
  `;
}

function initRideMapSimulation(){
  if(!rideMap){
    rideMap = L.map('rideMap', { zoomControl:false, attributionControl:false }).setView(mapCenter, 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(rideMap);
  }
  const start = state.pickupCoords || mapCenter;
  const end = state.destCoords || mapCenter;
  const route = [start, [(start[0]+end[0])/2 + 0.0005, (start[1]+end[1])/2 + 0.0008], end];

  if(ridePolyline) rideMap.removeLayer(ridePolyline);
  ridePolyline = L.polyline(route, { color:'#14b9a0', weight:5 }).addTo(rideMap);
  rideMap.fitBounds(ridePolyline.getBounds().pad(0.5));

  if(rideMarker) rideMap.removeLayer(rideMarker);
  let idx=0;
  rideMarker = L.marker(route[0]).addTo(rideMap);

  let etaSeconds = 60;
  const etaText = document.getElementById('etaText');
  if(simInterval) clearInterval(simInterval);
  simInterval = setInterval(()=>{
    if(idx < route.length-1){
      idx++;
      rideMarker.setLatLng(route[idx]);
      rideMap.panTo(route[idx], { animate:true, duration:0.7 });
    }
    etaSeconds -= 20;
    if(etaSeconds <= 0){
      etaText.textContent = 'Arriving';
      clearInterval(simInterval);
    } else {
      etaText.textContent = Math.ceil(etaSeconds/20) + ' min';
    }
  }, 1800);
}

/* Cancel/complete */
btnCancelRide.addEventListener('click', ()=>{
  if(confirm('Cancel this ride?')){
    if(simInterval) clearInterval(simInterval);
    state.booking = null;
    showPage('home');
  }
});
btnCompleteRide.addEventListener('click', ()=>{
  if(confirm('Mark ride complete?')){
    if(simInterval) clearInterval(simInterval);
    state.booking = null;
    toast('Ride complete — thank you for using Stride');
    showPage('home');
  }
});

/* ---------- Activity & Profile ---------- */
function renderActivity(){
  activityList.innerHTML = '';
  const acts = JSON.parse(localStorage.getItem('stride_acts')||'[]');
  if(!acts || acts.length===0){ activityList.innerHTML = '<li class="muted">No rides yet.</li>'; return; }
  acts.forEach(a=>{
    const li = document.createElement('li');
    li.innerHTML = `<div style="font-weight:700">${a.title}</div><div class="small muted">${a.when} · To: ${a.to}</div>`;
    activityList.appendChild(li);
  });
}
renderActivity();

navHome.addEventListener('click', ()=> showPage('home'));
navActivity.addEventListener('click', ()=> showPage('activity'));
navProfile.addEventListener('click', ()=> showPage('profile'));

/* Save profile */
document.getElementById('btnSaveProfile').addEventListener('click', ()=>{
  if(!state.userEmail) return toast('Login first');
  const users = JSON.parse(localStorage.getItem('stride_users')||'{}');
  users[state.userEmail].first = document.getElementById('profileFirst').value;
  users[state.userEmail].last = document.getElementById('profileLast').value;
  users[state.userEmail].phone = document.getElementById('profilePhone').value;
  users[state.userEmail].email = document.getElementById('profileEmail').value || users[state.userEmail].email;
  localStorage.setItem('stride_users', JSON.stringify(users));
  state.user = users[state.userEmail];
  toast('Profile saved');
});

/* Save card */
document.getElementById('btnSaveCard').addEventListener('click', ()=>{
  if(!state.userEmail) return toast('Login first');
  const users = JSON.parse(localStorage.getItem('stride_users')||'{}');
  users[state.userEmail].card = document.getElementById('cardNumber').value;
  localStorage.setItem('stride_users', JSON.stringify(users));
  toast('Card saved (simulated)');
});

/* Profile page logout button */
document.getElementById('btnLogoutProfile').addEventListener('click', ()=>{
  if(confirm('Do you want to logout?')){
    state.user = null; state.userEmail = null; logoutBtn.style.display = 'none'; showSplash();
  }
});

/* ---------- Driver dashboard interactions ---------- */
document.getElementById('btnAccept').addEventListener('click', ()=>{
  toast('You accepted the request. Start navigation to pickup.');
  showPage('rideActive');
  populateDriverCard({ name:'You', vehicle:'Your Vehicle', plate:'--', rating:5 }, {});
  initRideMapSimulation();
});
document.getElementById('btnDecline').addEventListener('click', ()=>{ toast('Request declined.'); });

/* ---------- Back buttons & top-back action ---------- */
btnBackTop.addEventListener('click', ()=>{
  // if previousPage exists go there, else splash
  if(state.previousPage && state.previousPage !== 'splash') showPage(state.previousPage);
  else showSplash();
});
document.getElementById('btnBackFromVehicle').addEventListener('click', ()=> showPage('home'));
document.getElementById('btnBackToHome').addEventListener('click', ()=> showPage('home'));
document.getElementById('btnBackFromBooking').addEventListener('click', ()=> showPage('vehicle'));
document.getElementById('btnBackToVehicle').addEventListener('click', ()=> showPage('vehicle'));
document.getElementById('btnBackFromDriver').addEventListener('click', ()=> showPage('splash'));
document.getElementById('btnBackFromActivity')?.addEventListener('click', ()=> showPage('home'));
document.getElementById('btnBackFromProfile').addEventListener('click', ()=> showPage('home'));

/* ---------- Init ---------- */
(function init(){
  // Initially show splash and hide map
  showSplash();
  bottomNav.style.display = 'none';
  roleBadge.textContent = 'Passenger';
  authModal.style.display = 'none';
  pages.driverDashboard.classList.remove('active');

  // If user already logged in from previous session, restore
  const remembered = JSON.parse(localStorage.getItem('stride_users') || '{}');
  // We don't auto-authenticate silently; user must sign in. But if you want auto-login, implement here.
})();
