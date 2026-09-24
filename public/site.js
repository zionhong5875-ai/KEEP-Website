const STORAGE_KEY = "vinner-language";
const supportedLanguages = ["zh", "en"];

const getInitialLanguage = () => {
  return window.location.pathname === "/en" || window.location.pathname.startsWith("/en/") ? "en" : "zh";
};

const localizedLanguageUrl = (language) => {
  const currentPath = window.location.pathname;
  const basePath = currentPath === "/en" || currentPath === "/en/"
    ? "/"
    : currentPath.startsWith("/en/")
      ? currentPath.slice(3)
      : currentPath;
  const pathname = language === "en" ? `/en${basePath}` : basePath;
  return `${pathname}${window.location.search}${window.location.hash}`;
};

const applyLanguage = (language) => {
  const lang = supportedLanguages.includes(language) ? language : "zh";
  document.documentElement.lang = lang === "en" ? "en" : "zh-CN";
  document.body.dataset.language = lang;
  window.localStorage.setItem(STORAGE_KEY, lang);

  document.querySelectorAll("[data-zh][data-en]").forEach((element) => {
    const value = element.dataset[lang];
    if (value === undefined) {
      return;
    }

    if (element.tagName === "META") {
      element.setAttribute("content", value);
      return;
    }

    if (element.dataset.i18nHtml === "true") {
      element.innerHTML = value;
      return;
    }

    element.textContent = value;
  });

  document.querySelectorAll("[data-placeholder-zh][data-placeholder-en]").forEach((element) => {
    const placeholder = element.dataset[`placeholder${lang === "zh" ? "Zh" : "En"}`];
    if (placeholder) {
      element.setAttribute("placeholder", placeholder);
    }
  });

  document.querySelectorAll("[data-aria-label-zh][data-aria-label-en]").forEach((element) => {
    const label = element.dataset[`ariaLabel${lang === "zh" ? "Zh" : "En"}`];
    if (label) {
      element.setAttribute("aria-label", label);
    }
  });

  document.querySelectorAll("[data-alt-zh][data-alt-en]").forEach((element) => {
    const alt = element.dataset[`alt${lang === "zh" ? "Zh" : "En"}`];
    if (alt !== undefined) {
      element.setAttribute("alt", alt);
    }
  });

  document.querySelectorAll("[data-lang-button]").forEach((button) => {
    const isActive = button.dataset.langButton === lang;
    button.setAttribute("aria-pressed", String(isActive));
    button.classList.toggle("is-active", isActive);
  });

  document.querySelectorAll(".lang-switch").forEach((switcher) => {
    switcher.dataset.activeLang = lang;
  });
};

const setupLanguageSwitch = () => {
  const initialLanguage = getInitialLanguage();
  applyLanguage(initialLanguage);

  document.querySelectorAll("[data-lang-button]").forEach((button) => {
    button.addEventListener("click", () => {
      const language = button.dataset.langButton || "zh";
      if (language !== initialLanguage) {
        window.location.assign(localizedLanguageUrl(language));
      }
    });
  });
};

const setupSectionIndicator = () => {
  const indicator = document.querySelector("[data-section-indicator]");
  const list = indicator?.querySelector("[data-section-indicator-list]");
  const main = document.querySelector("#main-content");

  if (!indicator || !list || !main) {
    return;
  }

  const nestedArticleSections = (element) => {
    if (!element.matches("article.resource-detail")) {
      return [element];
    }

    return Array.from(element.children).filter((child) =>
      child.matches("header, section, aside")
    );
  };

  const candidates = Array.from(main.children).flatMap((element) =>
    element.matches("[data-section-indicator-container]")
      ? Array.from(element.children)
      : [element]
  );

  const targets = candidates
    .filter((element) =>
      element.matches("section, article, [data-section-indicator-section]") &&
      element.dataset.sectionIndicator !== "false"
    )
    .flatMap(nestedArticleSections)
    .filter((element) => element.dataset.sectionIndicator !== "false");

  if (targets.length < 2) {
    return;
  }

  const labelOverrides = [
    [".resource-detail-hero", { zh: "文章概览", en: "Article overview" }],
    [".resource-article-body", { zh: "文章正文", en: "Article" }],
    [".resource-article-quote", { zh: "文章引言", en: "Feature quote" }],
    [".resource-article-gallery", { zh: "图片资料", en: "Gallery" }],
    [".resource-related-section", { zh: "继续阅读", en: "Keep reading" }],
    [".home-insights", { zh: "博客与资源", en: "Insights" }],
    [".series-products", { zh: "产品系列", en: "Products" }],
    [".product-line-showcase", { zh: "产品线", en: "Product lines" }]
  ];

  const normalizedText = (value) =>
    (value || "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const getSectionLabel = (section, index) => {
    if (section.dataset.sectionLabelZh || section.dataset.sectionLabelEn) {
      return {
        zh: section.dataset.sectionLabelZh || section.dataset.sectionLabelEn,
        en: section.dataset.sectionLabelEn || section.dataset.sectionLabelZh
      };
    }

    const override = labelOverrides.find(([selector]) => section.matches(selector));
    if (override) {
      return override[1];
    }

    const labelledBy = section.getAttribute("aria-labelledby");
    const labelledElement = labelledBy ? document.getElementById(labelledBy.split(" ")[0]) : null;
    const labelElement =
      section.querySelector(":scope > .section-kicker[data-zh][data-en]") ||
      section.querySelector(":scope > * > .section-kicker[data-zh][data-en]") ||
      section.querySelector(":scope > .eyebrow[data-zh][data-en]") ||
      labelledElement ||
      section.querySelector("h1, h2, h3");
    const fallback = `Section ${index + 1}`;

    return {
      zh: normalizedText(labelElement?.dataset.zh || labelElement?.textContent) || `板块 ${index + 1}`,
      en: normalizedText(labelElement?.dataset.en || labelElement?.textContent) || fallback
    };
  };

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const items = targets.map((target, index) => {
    const id = target.id || `page-section-${index + 1}`;
    const label = getSectionLabel(target, index);
    target.id = id;
    target.classList.add("section-indicator-target");

    const item = document.createElement("li");
    const button = document.createElement("button");
    const labelElement = document.createElement("span");
    const mark = document.createElement("span");

    button.type = "button";
    button.className = "section-indicator-button";
    button.dataset.ariaLabelZh = `前往${label.zh}`;
    button.dataset.ariaLabelEn = `Go to ${label.en}`;
    button.setAttribute("aria-label", document.body.dataset.language === "en" ? `Go to ${label.en}` : `前往${label.zh}`);
    button.setAttribute("aria-controls", id);
    labelElement.className = "section-indicator-label";
    labelElement.dataset.zh = label.zh;
    labelElement.dataset.en = label.en;
    labelElement.textContent = document.body.dataset.language === "en" ? label.en : label.zh;
    mark.className = "section-indicator-mark";
    mark.setAttribute("aria-hidden", "true");

    button.append(labelElement, mark);
    item.append(button);
    list.append(item);

    button.addEventListener("click", () => {
      target.scrollIntoView({
        behavior: reduceMotion.matches ? "auto" : "smooth",
        block: "start"
      });
    });

    return { target, button };
  });

  let activeIndex = -1;
  let animationFrame = 0;

  const parseColor = (color) => {
    const match = color.match(/rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\s*\)/);
    if (!match) return null;
    return {
      red: Number(match[1]),
      green: Number(match[2]),
      blue: Number(match[3]),
      alpha: Number(match[4] || 1)
    };
  };

  const isDarkColor = (color) => {
    const parsed = parseColor(color);
    if (!parsed || parsed.alpha < 0.08) return false;
    return (parsed.red * 299 + parsed.green * 587 + parsed.blue * 114) / 1000 < 128;
  };

  const effectiveBackground = (element) => {
    let current = element;
    while (current && current !== document.documentElement) {
      const style = window.getComputedStyle(current);
      const color = parseColor(style.backgroundColor);
      if (color && color.alpha >= 0.08) return style.backgroundColor;
      current = current.parentElement;
    }
    return window.getComputedStyle(document.body).backgroundColor;
  };

  const updateContrast = () => {
    const rect = indicator.getBoundingClientRect();
    const x = Math.max(0, Math.min(window.innerWidth - 1, rect.left + rect.width / 2));
    const y = Math.max(0, Math.min(window.innerHeight - 1, rect.top + rect.height / 2));
    const underlay = document
      .elementsFromPoint(x, y)
      .find((element) => !element.closest("[data-section-indicator]") && !element.closest(".site-header"));
    const section = items[activeIndex]?.target;
    const onMedia = Boolean(
      underlay?.matches("img, video") ||
      underlay?.closest(".hero, .page-hero-image, .resource-detail-image, .gallery")
    );
    const onDark = Boolean(
      !onMedia &&
      (underlay?.closest(".resource-section-dark, .related-products, .site-footer, .line-panel-dark") ||
        isDarkColor(effectiveBackground(underlay || section || document.body)))
    );

    indicator.classList.toggle("is-on-media", onMedia);
    indicator.classList.toggle("is-on-dark", onDark);
  };

  const updateActive = () => {
    animationFrame = 0;
    const marker = window.innerHeight * 0.42;
    let nextIndex = 0;

    items.forEach(({ target }, index) => {
      if (target.getBoundingClientRect().top <= marker) {
        nextIndex = index;
      }
    });

    if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 4) {
      nextIndex = items.length - 1;
    }

    if (nextIndex !== activeIndex) {
      activeIndex = nextIndex;
      items.forEach(({ button }, index) => {
        const isActive = index === activeIndex;
        button.classList.toggle("is-active", isActive);
        if (isActive) {
          button.setAttribute("aria-current", "location");
        } else {
          button.removeAttribute("aria-current");
        }
      });
    }

    updateContrast();
  };

  const requestUpdate = () => {
    if (!animationFrame) {
      animationFrame = window.requestAnimationFrame(updateActive);
    }
  };

  indicator.hidden = false;
  updateActive();
  window.addEventListener("scroll", requestUpdate, { passive: true });
  window.addEventListener("resize", requestUpdate);
};

document.addEventListener("keydown", (event) => {
  if (event.key === "Tab") {
    document.body.classList.add("using-keyboard");
  }
});

document.addEventListener("pointerdown", () => {
  document.body.classList.remove("using-keyboard");
});

const toggle = document.querySelector("[data-menu-toggle]");
const nav = document.querySelector("[data-nav]");

if (toggle && nav) {
  const closeMenu = () => {
    nav.classList.remove("is-open");
    document.body.classList.remove("menu-open");
    toggle.setAttribute("aria-expanded", "false");
  };

  toggle.addEventListener("click", () => {
    const isOpen = nav.classList.toggle("is-open");
    document.body.classList.toggle("menu-open", isOpen);
    toggle.setAttribute("aria-expanded", String(isOpen));
  });

  nav.addEventListener("click", (event) => {
    if (event.target instanceof HTMLAnchorElement) {
      closeMenu();
      return;
    }

    if (event.target === nav) {
      closeMenu();
    }
  });

  document.addEventListener("click", (event) => {
    if (!document.body.classList.contains("menu-open")) {
      return;
    }

    const target = event.target;
    if (!(target instanceof Node)) {
      return;
    }

    if (nav.contains(target) || toggle.contains(target) || target.closest?.(".lang-switch-floating")) {
      return;
    }

    closeMenu();
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeMenu();
    }
  });
}

document.querySelectorAll("[data-home-carousel]").forEach((homeCarousel) => {
  const slides = Array.from(homeCarousel.querySelectorAll("[data-home-slide]"));
  const dots = Array.from(homeCarousel.querySelectorAll("[data-home-dot]"));
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let activeIndex = 0;
  let timer = null;
  let pointerStartX = 0;
  let pointerStartY = 0;
  let isDragging = false;

  if (slides.length <= 1) {
    return;
  }

  const showSlide = (index) => {
    activeIndex = (index + slides.length) % slides.length;

    slides.forEach((slide, slideIndex) => {
      const isActive = slideIndex === activeIndex;
      slide.classList.toggle("is-active", isActive);
      slide.setAttribute("aria-hidden", String(!isActive));
    });

    dots.forEach((dot, dotIndex) => {
      const isActive = dotIndex === activeIndex;
      dot.classList.toggle("is-active", isActive);
      dot.setAttribute("aria-selected", String(isActive));
    });
  };

  const stopAutoplay = () => {
    if (timer) {
      window.clearInterval(timer);
      timer = null;
    }
  };

  const startAutoplay = () => {
    if (reduceMotion || timer) {
      return;
    }

    timer = window.setInterval(() => {
      showSlide(activeIndex + 1);
    }, 5600);
  };

  dots.forEach((dot) => {
    dot.addEventListener("click", () => {
      stopAutoplay();
      showSlide(Number(dot.dataset.homeDot || 0));
      startAutoplay();
    });
  });

  homeCarousel.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }

    isDragging = true;
    pointerStartX = event.clientX;
    pointerStartY = event.clientY;
  });

  homeCarousel.addEventListener("pointerup", (event) => {
    if (!isDragging) {
      return;
    }

    isDragging = false;
    const deltaX = event.clientX - pointerStartX;
    const deltaY = event.clientY - pointerStartY;

    if (Math.abs(deltaX) > 46 && Math.abs(deltaX) > Math.abs(deltaY)) {
      stopAutoplay();
      showSlide(deltaX < 0 ? activeIndex + 1 : activeIndex - 1);
      startAutoplay();
    }
  });

  homeCarousel.addEventListener("pointercancel", () => {
    isDragging = false;
  });

  homeCarousel.addEventListener("mouseenter", stopAutoplay);
  homeCarousel.addEventListener("mouseleave", startAutoplay);

  showSlide(0);
  startAutoplay();
});

const carousel = document.querySelector("[data-carousel]");

if (carousel) {
  const slides = Array.from(carousel.querySelectorAll(".gallery-slide"));
  const prev = carousel.querySelector("[data-carousel-prev]");
  const next = carousel.querySelector("[data-carousel-next]");
  const current = carousel.querySelector("[data-carousel-current]");
  let activeIndex = 0;

  const showSlide = (index) => {
    activeIndex = (index + slides.length) % slides.length;
    slides.forEach((slide, slideIndex) => {
      slide.classList.toggle("is-active", slideIndex === activeIndex);
    });

    if (current) {
      current.textContent = String(activeIndex + 1);
    }
  };

  prev?.addEventListener("click", () => showSlide(activeIndex - 1));
  next?.addEventListener("click", () => showSlide(activeIndex + 1));

  carousel.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      showSlide(activeIndex - 1);
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      showSlide(activeIndex + 1);
    }
  });
}

document.querySelectorAll("[data-product-carousel]").forEach((carousel) => {
  const slides = Array.from(carousel.querySelectorAll(".product-gallery-slide"));
  const thumbnails = Array.from(carousel.querySelectorAll("[data-product-thumb]"));
  const prev = carousel.querySelector("[data-product-prev]");
  const next = carousel.querySelector("[data-product-next]");
  const current = carousel.querySelector("[data-product-current]");
  const main = carousel.querySelector(".product-gallery-main");
  let activeIndex = 0;

  const showSlide = (index) => {
    if (!slides.length) {
      return;
    }

    activeIndex = (index + slides.length) % slides.length;
    slides.forEach((slide, slideIndex) => {
      slide.classList.toggle("is-active", slideIndex === activeIndex);
    });

    thumbnails.forEach((thumbnail, thumbnailIndex) => {
      const isActive = thumbnailIndex === activeIndex;
      thumbnail.classList.toggle("is-active", isActive);
      thumbnail.setAttribute("aria-pressed", String(isActive));
    });

    if (current) {
      current.textContent = String(activeIndex + 1);
    }
  };

  thumbnails.forEach((thumbnail) => {
    thumbnail.addEventListener("click", () => {
      showSlide(Number(thumbnail.dataset.productThumb || 0));
    });
  });

  prev?.addEventListener("click", () => showSlide(activeIndex - 1));
  next?.addEventListener("click", () => showSlide(activeIndex + 1));

  main?.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      showSlide(activeIndex - 1);
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      showSlide(activeIndex + 1);
    }
  });

  showSlide(0);
});

document.querySelectorAll("[data-scroll-region]").forEach((region) => {
  const axis = region.getAttribute("data-scroll-region");
  if (!region.hasAttribute("role")) {
    region.setAttribute("role", "region");
  }

  region.addEventListener("keydown", (event) => {
    const horizontalStep = Math.max(260, region.clientWidth * 0.82);
    const verticalStep = Math.max(180, region.clientHeight * 0.82);

    if (axis === "x") {
      if (event.key === "ArrowRight") {
        event.preventDefault();
        region.scrollBy({ left: horizontalStep, behavior: "smooth" });
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        region.scrollBy({ left: -horizontalStep, behavior: "smooth" });
      }

      if (event.key === "Home") {
        event.preventDefault();
        region.scrollTo({ left: 0, behavior: "smooth" });
      }

      if (event.key === "End") {
        event.preventDefault();
        region.scrollTo({ left: region.scrollWidth, behavior: "smooth" });
      }
    }

    if (axis === "y") {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        region.scrollBy({ top: verticalStep, behavior: "smooth" });
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        region.scrollBy({ top: -verticalStep, behavior: "smooth" });
      }

      if (event.key === "Home") {
        event.preventDefault();
        region.scrollTo({ top: 0, behavior: "smooth" });
      }

      if (event.key === "End") {
        event.preventDefault();
        region.scrollTo({ top: region.scrollHeight, behavior: "smooth" });
      }
    }
  });
});

setupLanguageSwitch();
setupSectionIndicator();
