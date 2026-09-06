/* Zirtan — site davranışları: gezinme, tema, filtreler, bekleme listesi, tembel Leaflet haritaları. */
(function () {
  'use strict';

  var LEAFLET_JS = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
  var LEAFLET_CSS = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';
  var TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
  var ATTRIBUTION =
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
  var TYPE_COLORS = {
    hiking: '#2F7D4F',
    climbing: '#E8722A',
    diving: '#3A8DDE',
    skiing: '#4B6C9E',
    cycling: '#7CB342',
    paragliding: '#5FA8E8',
    rafting: '#2B7FA6',
    canoe: '#2A6F7A',
  };

  /* ---------------------------------------------------------------- Gezinme */
  var toggle = document.querySelector('[data-nav-toggle]');
  var nav = document.getElementById('site-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('open')) {
        nav.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.focus();
      }
    });
  }

  /* ---------------------------------------------------------------- Tema */
  var themeBtn = document.querySelector('[data-theme-toggle]');
  if (themeBtn) {
    themeBtn.addEventListener('click', function () {
      var current = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
      var next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      try {
        localStorage.setItem('zirtan-theme', next);
      } catch (e) {
        /* yerel depolama kapalı olabilir */
      }
    });
  }

  /* ---------------------------------------------------------------- Filtreler */
  document.querySelectorAll('[data-filter-root]').forEach(function (root) {
    var section = root.parentElement;
    var list = section.querySelector('[data-filter-list]');
    if (!list) return;
    var items = Array.prototype.slice.call(list.querySelectorAll('[data-item]'));
    var search = root.querySelector('[data-filter-search]');
    var selects = Array.prototype.slice.call(root.querySelectorAll('[data-filter-attr]'));
    var count = root.querySelector('[data-filter-count]');
    var empty = root.querySelector('[data-filter-empty]');
    var template = count ? count.getAttribute('data-template') : '';

    function normalize(s) {
      return (s || '')
        .toLowerCase()
        .replace(/ı/g, 'i')
        .replace(/İ/g, 'i')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '');
    }

    function apply() {
      var q = normalize(search ? search.value.trim() : '');
      var visible = 0;
      items.forEach(function (el) {
        var ok = !q || normalize(el.getAttribute('data-name')).indexOf(q) > -1;
        selects.forEach(function (sel) {
          if (!ok || !sel.value) return;
          var attr = el.getAttribute('data-' + sel.getAttribute('data-filter-attr')) || '';
          if (sel.getAttribute('data-filter-mode') === 'includes') {
            ok = attr.split(',').indexOf(sel.value) > -1;
          } else {
            ok = attr === sel.value;
          }
        });
        el.classList.toggle('is-hidden', !ok);
        if (ok) visible += 1;
      });
      if (count) count.textContent = template.replace('{n}', String(visible));
      if (empty) empty.hidden = visible !== 0;
    }

    if (search) {
      search.addEventListener('input', apply);
      try {
        var q0 = new URLSearchParams(location.search).get('q');
        if (q0) {
          search.value = q0;
        }
      } catch (e) {
        /* eski tarayıcı */
      }
    }
    selects.forEach(function (sel) {
      sel.addEventListener('change', apply);
    });
    apply();
  });

  /* ---------------------------------------------------------------- Bekleme listesi */
  document.querySelectorAll('[data-waitlist]').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      if (!window.fetch || /REPLACE_WITH/.test(form.action)) {
        // Form hedefi ayarlanmamışsa gönderimi simüle et (demo).
        e.preventDefault();
        show(form, form.getAttribute('data-thanks'), false);
        form.reset();
        return;
      }
      e.preventDefault();
      var btn = form.querySelector('button[type=submit]');
      btn.disabled = true;
      fetch(form.action, {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: new FormData(form),
      })
        .then(function (r) {
          if (!r.ok) throw new Error('bad status');
          show(form, form.getAttribute('data-thanks'), false);
          form.reset();
        })
        .catch(function () {
          show(form, form.getAttribute('data-error'), true);
        })
        .then(function () {
          btn.disabled = false;
        });
    });
  });
  function show(form, msg, isError) {
    var el = form.querySelector('.waitlist-msg');
    if (!el) return;
    el.textContent = msg;
    el.classList.toggle('is-error', !!isError);
  }

  /* ---------------------------------------------------------------- Haritalar */
  var maps = Array.prototype.slice.call(document.querySelectorAll('[data-map]'));
  if (!maps.length) return;

  var leafletPromise = null;
  function loadLeaflet() {
    if (leafletPromise) return leafletPromise;
    leafletPromise = new Promise(function (resolve, reject) {
      var link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = LEAFLET_CSS;
      document.head.appendChild(link);
      var s = document.createElement('script');
      s.src = LEAFLET_JS;
      s.async = true;
      s.onload = function () {
        resolve(window.L);
      };
      s.onerror = reject;
      document.head.appendChild(s);
    });
    return leafletPromise;
  }

  function markerIcon(L, type) {
    var color = TYPE_COLORS[type] || '#2F7D4F';
    return L.divIcon({
      className: '',
      html:
        '<span class="zm-marker" style="background:' +
        color +
        '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m8 3 4 8 5-5 5 15H2L8 3z"/></svg></span>',
      iconSize: [30, 30],
      iconAnchor: [15, 30],
      popupAnchor: [0, -28],
    });
  }

  function popupHtml(p) {
    var name = p.href
      ? '<a href="' + p.href + '">' + escapeHtml(p.name) + '</a>'
      : '<strong>' + escapeHtml(p.name) + '</strong>';
    return (
      name +
      (p.sub
        ? '<br/><span style="color:#6d7a74;font-size:.85em">' + escapeHtml(p.sub) + '</span>'
        : '')
    );
  }
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function initMap(el) {
    var kind = el.getAttribute('data-map');
    var dataEl = el.querySelector('[data-map-data]');
    var data = dataEl ? JSON.parse(dataEl.textContent) : null;
    var c = (el.getAttribute('data-center') || '39,35').split(',').map(Number);
    var zoom = Number(el.getAttribute('data-zoom') || 7);
    loadLeaflet()
      .then(function (L) {
        var map = L.map(el, { scrollWheelZoom: false, zoomControl: true });
        L.tileLayer(TILES, { attribution: ATTRIBUTION, maxZoom: 18 }).addTo(map);
        map.setView([c[0], c[1]], zoom);
        var bounds = [];

        function addLine(r, weightBoost) {
          var color = TYPE_COLORS[r.type] || '#2F7D4F';
          var line = L.polyline(r.pts, {
            color: color,
            weight: 4 + (weightBoost || 0),
            opacity: 0.9,
          }).addTo(map);
          line.bindPopup(popupHtml(r));
          r.pts.forEach(function (p) {
            bounds.push(p);
          });
          if (r.pts.length) {
            L.circleMarker(r.pts[0], {
              radius: 5,
              color: '#fff',
              fillColor: color,
              fillOpacity: 1,
              weight: 2,
            }).addTo(map);
            L.circleMarker(r.pts[r.pts.length - 1], {
              radius: 5,
              color: '#fff',
              fillColor: '#10201B',
              fillOpacity: 1,
              weight: 2,
            }).addTo(map);
          }
        }
        function addPoint(p) {
          var m = L.marker([p.lat, p.lng], {
            icon: markerIcon(L, p.kind === 'climbing' ? 'climbing' : p.type),
          }).addTo(map);
          m.bindPopup(popupHtml(p));
          bounds.push([p.lat, p.lng]);
        }

        if (kind === 'routes' && Array.isArray(data)) {
          data.forEach(function (r) {
            addLine(r, 0);
          });
        } else if (kind === 'route' && data) {
          addLine(data, 1);
          (data.markers || []).forEach(function (p) {
            L.circleMarker([p.lat, p.lng], {
              radius: 6,
              color: '#fff',
              fillColor: '#E8722A',
              fillOpacity: 1,
              weight: 2,
            })
              .addTo(map)
              .bindPopup(popupHtml(p));
          });
        } else if (kind === 'points' && Array.isArray(data)) {
          data.forEach(addPoint);
        }
        if (bounds.length > 1) map.fitBounds(bounds, { padding: [30, 30], maxZoom: 13 });
        el.classList.add('is-ready');
        map.once('focus', function () {
          map.scrollWheelZoom.enable();
        });
      })
      .catch(function () {
        /* CDN engellenmişse statik yedek (OSM bağlantısı) görünür kalır */
      });
  }

  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) {
            io.unobserve(en.target);
            initMap(en.target);
          }
        });
      },
      { rootMargin: '200px' },
    );
    maps.forEach(function (m) {
      io.observe(m);
    });
  } else {
    maps.forEach(initMap);
  }
})();
