(function () {
  'use strict';

  var root = document.documentElement;
  var body = document.body;

  /* ---------- 明暗模式 ---------- */
  var themeToggle = document.getElementById('theme-toggle');
  function syncThemeMeta() {
    var color = root.getAttribute('data-theme') === 'light' ? '#f4efe6' : '#0a0d12';
    var metas = document.querySelectorAll('meta[name="theme-color"]');
    metas.forEach(function (m) { m.setAttribute('content', color); });
  }
  function setTheme(theme, persist) {
    root.setAttribute('data-theme', theme);
    if (persist) {
      try { localStorage.setItem('theme', theme); } catch (e) {}
    }
    syncThemeMeta();
    var iframe = document.querySelector('iframe.giscus-frame');
    if (iframe) {
      iframe.contentWindow.postMessage(
        { giscus: { setConfig: { theme: theme === 'light' ? 'light' : 'dark_dimmed' } } },
        'https://giscus.app'
      );
    }
  }
  if (themeToggle) {
    themeToggle.addEventListener('click', function () {
      setTheme(root.getAttribute('data-theme') === 'light' ? 'dark' : 'light', true);
    });
  }
  syncThemeMeta();

  /* ---------- 头部滚动状态 ---------- */
  var header = document.getElementById('site-header');
  var toTop = document.getElementById('to-top');
  var progressBar = document.getElementById('read-progress-bar');

  function onScroll() {
    var y = window.scrollY || window.pageYOffset;
    if (header) header.classList.toggle('is-scrolled', y > 12);
    if (toTop) toTop.classList.toggle('is-visible', y > 760);
    if (progressBar) {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      progressBar.style.width = (max > 0 ? Math.min(100, (y / max) * 100) : 0) + '%';
    }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  if (toTop) {
    toTop.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  /* ---------- 手机菜单 ---------- */
  var menuToggle = document.getElementById('menu-toggle');
  var mobileNav = document.getElementById('mobile-nav');
  var backdrop = document.getElementById('nav-backdrop');

  function closeNav() {
    body.classList.remove('nav-open');
    if (menuToggle) menuToggle.setAttribute('aria-expanded', 'false');
    if (mobileNav) mobileNav.setAttribute('aria-hidden', 'true');
    if (backdrop) backdrop.hidden = true;
  }
  function openNav() {
    body.classList.add('nav-open');
    if (menuToggle) menuToggle.setAttribute('aria-expanded', 'true');
    if (mobileNav) mobileNav.setAttribute('aria-hidden', 'false');
    if (backdrop) backdrop.hidden = false;
  }
  if (menuToggle) {
    menuToggle.addEventListener('click', function () {
      body.classList.contains('nav-open') ? closeNav() : openNav();
    });
  }
  if (mobileNav) {
    mobileNav.addEventListener('click', function (e) {
      if (e.target.closest('a')) closeNav();
    });
  }
  if (backdrop) backdrop.addEventListener('click', closeNav);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeNav();
  });
  window.addEventListener('resize', function () {
    if (window.innerWidth > 900) closeNav();
  });

  /* ---------- 首屏加载动画：每个会话只出现一次 ---------- */
  var intro = document.getElementById('intro');
  if (intro) {
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var seen = false;
    try { seen = sessionStorage.getItem('intro-seen') === '1'; } catch (e) {}
    if (reduce || seen) {
      intro.remove();
    } else {
      try { sessionStorage.setItem('intro-seen', '1'); } catch (e) {}
      var hideIntro = function () {
        setTimeout(function () {
          intro.classList.add('is-done');
          setTimeout(function () { intro.remove(); }, 650);
        }, 420);
      };
      if (document.readyState === 'complete') hideIntro();
      else window.addEventListener('load', hideIntro);
      setTimeout(hideIntro, 2600);
    }
  }

  /* ---------- 文章图片与外链 ---------- */
  var prose = document.querySelector('.prose');
  if (prose) {
    prose.querySelectorAll('img').forEach(function (img, i) {
      img.loading = 'lazy';
      img.decoding = 'async';
      if (i === 0) img.loading = 'eager';
    });
    prose.querySelectorAll('a[href^="http"]').forEach(function (a) {
      if (a.hostname !== window.location.hostname) {
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
      }
    });
  }

  /* ---------- 代码复制 ---------- */
  document.querySelectorAll('.prose pre').forEach(function (pre) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'code-copy';
    btn.textContent = '复制';
    btn.addEventListener('click', function () {
      var code = pre.querySelector('code');
      var text = code ? code.innerText : pre.innerText;
      var done = function () {
        btn.textContent = '已复制';
        setTimeout(function () { btn.textContent = '复制'; }, 1600);
      };
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(done).catch(function () {});
      } else {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); done(); } catch (e) {}
        document.body.removeChild(ta);
      }
    });
    pre.appendChild(btn);
  });

  /* ---------- 目录 ---------- */
  var content = document.getElementById('post-content');
  var tocNav = document.getElementById('toc-nav');
  var toc = document.getElementById('toc');
  if (content && tocNav) {
    var headings = Array.prototype.slice.call(content.querySelectorAll('h2, h3'));
    if (headings.length < 2) {
      if (toc) toc.style.display = 'none';
    } else {
      headings.forEach(function (h, i) {
        if (!h.id) h.id = 'sec-' + (i + 1);
        var a = document.createElement('a');
        a.href = '#' + h.id;
        a.textContent = h.textContent;
        if (h.tagName === 'H3') a.className = 'toc-h3';
        tocNav.appendChild(a);
      });

      var links = tocNav.querySelectorAll('a');
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          links.forEach(function (l) {
            l.classList.toggle('is-active', l.getAttribute('href') === '#' + entry.target.id);
          });
        });
      }, { rootMargin: '-100px 0px -68% 0px', threshold: 0 });
      headings.forEach(function (h) { observer.observe(h); });
    }
  }

  /* ---------- Giscus ---------- */
  var giscusConfig = window.GISCUS_CONFIG;
  var giscusContainer = document.getElementById('giscus-container');
  if (giscusConfig && giscusContainer) {
    var s = document.createElement('script');
    s.src = 'https://giscus.app/client.js';
    s.async = true;
    s.crossOrigin = 'anonymous';
    s.setAttribute('data-repo', giscusConfig.repo);
    s.setAttribute('data-repo-id', giscusConfig.repoId);
    s.setAttribute('data-category', giscusConfig.category);
    s.setAttribute('data-category-id', giscusConfig.categoryId);
    s.setAttribute('data-mapping', giscusConfig.mapping);
    s.setAttribute('data-strict', '0');
    s.setAttribute('data-reactions-enabled', giscusConfig.reactionsEnabled);
    s.setAttribute('data-emit-metadata', '0');
    s.setAttribute('data-input-position', giscusConfig.inputPosition);
    s.setAttribute('data-theme', root.getAttribute('data-theme') === 'light' ? 'light' : 'dark_dimmed');
    s.setAttribute('data-lang', giscusConfig.lang);
    s.setAttribute('data-loading', 'lazy');
    giscusContainer.appendChild(s);
  }

  /* ---------- 作品筛选 ---------- */
  var filterBar = document.getElementById('works-filters');
  if (filterBar) {
    var cards = Array.prototype.slice.call(document.querySelectorAll('#work-grid .work-card'));
    var countEl = document.getElementById('works-count');
    var filterEmpty = document.getElementById('works-filter-empty');
    var filterState = { medium: 'all', origin: 'all' };

    var applyFilters = function () {
      var shown = 0;
      cards.forEach(function (card) {
        var ok = (filterState.medium === 'all' || card.getAttribute('data-medium') === filterState.medium)
          && (filterState.origin === 'all' || card.getAttribute('data-origin') === filterState.origin);
        card.hidden = !ok;
        if (ok) shown += 1;
      });
      if (countEl) countEl.textContent = '共 ' + shown + ' 件';
      if (filterEmpty) filterEmpty.classList.toggle('is-visible', cards.length > 0 && shown === 0);
    };

    filterBar.querySelectorAll('.filter-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var group = btn.getAttribute('data-group');
        var value = btn.getAttribute('data-value');
        filterState[group] = value;
        filterBar.querySelectorAll('.filter-btn[data-group="' + group + '"]').forEach(function (b) {
          var active = b === btn;
          b.classList.toggle('is-active', active);
          b.setAttribute('aria-pressed', active ? 'true' : 'false');
        });
        applyFilters();
      });
    });

    applyFilters();
  }

  /* ---------- 文集筛选：标题 / 分类 / 多选标签 ---------- */
  var archiveFilter = document.getElementById('archive-filter');
  if (archiveFilter) {
    var archiveItems = Array.prototype.slice.call(document.querySelectorAll('.archive-item'));
    var archiveYears = Array.prototype.slice.call(document.querySelectorAll('.archive-year'));
    var archiveCount = document.getElementById('archive-filter-count');
    var archiveEmpty = document.getElementById('archive-filter-empty');
    var archiveSearch = document.getElementById('archive-search-input');
    var categoryToggle = archiveFilter.querySelector('[data-archive-category-toggle]');
    var categoryLabel = archiveFilter.querySelector('[data-archive-category-label]');
    var categoryPanel = archiveFilter.querySelector('[data-archive-select="category"] .archive-select__panel');
    var tagToggle = archiveFilter.querySelector('[data-archive-tag-toggle]');
    var tagLabel = archiveFilter.querySelector('[data-archive-tag-label]');
    var tagPanel = archiveFilter.querySelector('[data-archive-select="tag"] .archive-select__panel');
    var tagChecks = Array.prototype.slice.call(archiveFilter.querySelectorAll('.archive-check input'));
    var clearTags = archiveFilter.querySelector('.archive-clear-tags');
    var clearAll = document.getElementById('archive-clear-all');
    var archiveState = { category: 'all', tags: new Set(), q: '' };

    var closeArchivePanels = function () {
      if (categoryPanel) categoryPanel.hidden = true;
      if (tagPanel) tagPanel.hidden = true;
      if (categoryToggle) categoryToggle.setAttribute('aria-expanded', 'false');
      if (tagToggle) tagToggle.setAttribute('aria-expanded', 'false');
    };

    var updateTagLabel = function () {
      var n = archiveState.tags.size;
      if (!tagLabel) return;
      if (!n) tagLabel.textContent = '全部标签';
      else if (n === 1) tagLabel.textContent = Array.from(archiveState.tags)[0];
      else tagLabel.textContent = '已选 ' + n + ' 个标签';
    };

    var applyArchiveFilters = function () {
      var q = archiveState.q.trim().toLowerCase();
      var visible = 0;

      archiveItems.forEach(function (item) {
        var tags = (item.getAttribute('data-tags') || '').split('|').filter(Boolean);
        var okCategory = archiveState.category === 'all' || item.getAttribute('data-category') === archiveState.category;
        var okTags = true;
        archiveState.tags.forEach(function (tag) {
          if (tags.indexOf(tag) === -1) okTags = false;
        });
        var okSearch = !q || (item.getAttribute('data-title') || '').toLowerCase().indexOf(q) !== -1;
        var ok = okCategory && okTags && okSearch;
        item.hidden = !ok;
        if (ok) visible += 1;
      });

      archiveYears.forEach(function (year) {
        var items = Array.prototype.slice.call(year.querySelectorAll('.archive-item'));
        var count = items.filter(function (item) { return !item.hidden; }).length;
        year.hidden = count === 0;
        var countEl = year.querySelector('.archive-year__title em');
        if (countEl) countEl.textContent = count + ' 篇';
      });

      if (archiveCount) archiveCount.textContent = '共 ' + visible + ' 篇';
      if (archiveEmpty) archiveEmpty.hidden = visible !== 0;
    };

    var resetArchiveFilters = function () {
      archiveState.category = 'all';
      archiveState.tags.clear();
      archiveState.q = '';
      if (archiveSearch) archiveSearch.value = '';
      tagChecks.forEach(function (cb) { cb.checked = false; });
      if (categoryLabel) categoryLabel.textContent = '全部分类';
      if (categoryPanel) {
        categoryPanel.querySelectorAll('[data-category]').forEach(function (btn) {
          btn.classList.toggle('is-active', btn.getAttribute('data-category') === 'all');
        });
      }
      updateTagLabel();
      closeArchivePanels();
      applyArchiveFilters();
    };

    if (archiveSearch) {
      archiveSearch.addEventListener('input', function () {
        archiveState.q = archiveSearch.value;
        applyArchiveFilters();
      });
    }

    if (categoryToggle && categoryPanel) {
      categoryToggle.addEventListener('click', function (e) {
        e.stopPropagation();
        var willOpen = categoryPanel.hidden;
        closeArchivePanels();
        categoryPanel.hidden = !willOpen;
        categoryToggle.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
      });
      categoryPanel.querySelectorAll('[data-category]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          archiveState.category = btn.getAttribute('data-category');
          if (categoryLabel) categoryLabel.textContent = archiveState.category === 'all' ? '全部分类' : archiveState.category;
          categoryPanel.querySelectorAll('[data-category]').forEach(function (b) {
            b.classList.toggle('is-active', b === btn);
          });
          closeArchivePanels();
          applyArchiveFilters();
        });
      });
    }

    if (tagToggle && tagPanel) {
      tagToggle.addEventListener('click', function (e) {
        e.stopPropagation();
        var willOpen = tagPanel.hidden;
        closeArchivePanels();
        tagPanel.hidden = !willOpen;
        tagToggle.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
      });
      tagChecks.forEach(function (cb) {
        cb.addEventListener('change', function () {
          if (cb.checked) archiveState.tags.add(cb.value);
          else archiveState.tags.delete(cb.value);
          updateTagLabel();
          applyArchiveFilters();
        });
      });
      if (clearTags) {
        clearTags.addEventListener('click', function () {
          archiveState.tags.clear();
          tagChecks.forEach(function (cb) { cb.checked = false; });
          updateTagLabel();
          applyArchiveFilters();
        });
      }
    }

    if (clearAll) clearAll.addEventListener('click', resetArchiveFilters);

    document.addEventListener('click', function (e) {
      if (!archiveFilter.contains(e.target)) closeArchivePanels();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeArchivePanels();
    });

    applyArchiveFilters();
  }

  /* ---------- 作品大图灯箱 ---------- */
  var workLightbox = document.getElementById('work-lightbox');
  if (workLightbox) {
    var lightboxImage = document.getElementById('work-lightbox-image');
    var lightboxTitle = document.getElementById('work-lightbox-title');
    var lightboxKicker = document.getElementById('work-lightbox-kicker');
    var lightboxDesc = document.getElementById('work-lightbox-desc');
    var lightboxClose = document.getElementById('work-lightbox-close');

    var closeLightbox = function () {
      if (typeof workLightbox.close === 'function') workLightbox.close();
      else workLightbox.removeAttribute('open');
    };

    document.querySelectorAll('.work-card__media[data-work-image]').forEach(function (trigger) {
      trigger.addEventListener('click', function () {
        if (lightboxImage) {
          lightboxImage.src = trigger.getAttribute('data-work-image') || '';
          lightboxImage.alt = trigger.getAttribute('data-work-title') || '';
        }
        if (lightboxTitle) lightboxTitle.textContent = trigger.getAttribute('data-work-title') || '';
        if (lightboxKicker) {
          lightboxKicker.textContent = [trigger.getAttribute('data-work-medium'), trigger.getAttribute('data-work-origin')]
            .filter(Boolean).join(' · ');
        }
        if (lightboxDesc) lightboxDesc.textContent = trigger.getAttribute('data-work-desc') || '';
        document.body.classList.add('has-lightbox');
        if (typeof workLightbox.showModal === 'function') workLightbox.showModal();
        else workLightbox.setAttribute('open', '');
      });
    });

    if (lightboxClose) lightboxClose.addEventListener('click', closeLightbox);
    var lightboxInner = workLightbox.querySelector('.work-lightbox__inner');
    if (lightboxInner) {
      lightboxInner.addEventListener('click', function (e) {
        if (e.target === lightboxInner) closeLightbox();
      });
    }
    workLightbox.addEventListener('click', function (e) {
      if (e.target === workLightbox) closeLightbox();
    });
    workLightbox.addEventListener('close', function () {
      document.body.classList.remove('has-lightbox');
    });
  }

  /* ---------- 角色面板 ---------- */
  var characterDialog = document.getElementById('character-dialog');
  if (characterDialog) {
    var characterCards = document.querySelectorAll('.character-card');
    var charName = document.getElementById('character-dialog-name');
    var charEn = document.getElementById('character-dialog-en');
    var charRole = document.getElementById('character-dialog-role');
    var charQuote = document.getElementById('character-dialog-quote');
    var charDesc = document.getElementById('character-dialog-desc');
    var charTags = document.getElementById('character-dialog-tags');
    var charAvatar = document.getElementById('character-dialog-avatar');
    var charInitial = document.getElementById('character-dialog-initial');
    var charClose = document.getElementById('character-dialog-close');

    var openCharacter = function (card) {
      var name = card.getAttribute('data-name') || '';
      var en = card.getAttribute('data-en') || '';
      var role = card.getAttribute('data-role') || '';
      var quote = card.getAttribute('data-quote') || '';
      var desc = card.getAttribute('data-desc') || '';
      var avatar = card.getAttribute('data-avatar') || '';
      var tags = (card.getAttribute('data-tags') || '').split('|').filter(Boolean);

      charName.textContent = name;
      charEn.textContent = en;
      charEn.hidden = !en;
      charRole.textContent = role;
      charRole.hidden = !role;
      charQuote.textContent = quote ? '「' + quote + '」' : '';
      charQuote.hidden = !quote;
      charDesc.textContent = desc;
      charDesc.hidden = !desc;

      charTags.innerHTML = '';
      tags.forEach(function (tag) {
        var span = document.createElement('span');
        span.className = 'chip chip--small';
        span.textContent = tag.trim();
        charTags.appendChild(span);
      });

      if (avatar) {
        charAvatar.src = avatar;
        charAvatar.alt = name;
        charAvatar.hidden = false;
        charInitial.hidden = true;
      } else {
        charAvatar.removeAttribute('src');
        charAvatar.hidden = true;
        charInitial.textContent = name.slice(0, 1) || '?';
        charInitial.hidden = false;
      }

      if (typeof characterDialog.showModal === 'function') {
        characterDialog.showModal();
      } else {
        characterDialog.setAttribute('open', '');
      }
    };

    characterCards.forEach(function (card) {
      if (card.classList.contains('character-card--empty')) return;
      card.addEventListener('click', function () { openCharacter(card); });
    });

    if (charClose) {
      charClose.addEventListener('click', function () { characterDialog.close(); });
    }
    characterDialog.addEventListener('click', function (e) {
      if (e.target === characterDialog) characterDialog.close();
    });
  }

  /* ---------- 横向滑动卡（系列 / 角色） ---------- */
  document.querySelectorAll('[data-carousel]').forEach(function (wrap) {
    var track = wrap.querySelector('.carousel');
    var prev = wrap.querySelector('[data-carousel-prev]');
    var next = wrap.querySelector('[data-carousel-next]');
    if (!track) return;

    var step = function () {
      var card = track.querySelector('.carousel__track > *');
      if (!card) return 320;
      var styles = window.getComputedStyle(track.querySelector('.carousel__track'));
      var gap = parseInt(styles.columnGap || styles.gap || '26', 10) || 26;
      return card.getBoundingClientRect().width + gap;
    };

    var sync = function () {
      var max = track.scrollWidth - track.clientWidth;
      if (prev) prev.disabled = track.scrollLeft <= 2;
      if (next) next.disabled = track.scrollLeft >= max - 2;
    };

    if (prev) {
      prev.addEventListener('click', function () {
        track.scrollBy({ left: -step(), behavior: 'smooth' });
      });
    }
    if (next) {
      next.addEventListener('click', function () {
        track.scrollBy({ left: step(), behavior: 'smooth' });
      });
    }

    track.addEventListener('scroll', sync, { passive: true });
    window.addEventListener('resize', sync);
    sync();
  });
})();
