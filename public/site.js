const STORAGE_KEY = "vinner-language";
const supportedLanguages = ["zh", "en"];

const getInitialLanguage = () => {
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (saved && supportedLanguages.includes(saved)) {
    return saved;
  }

  return document.documentElement.lang.startsWith("en") ? "en" : "zh";
};

const applyLanguage = (language) => {
  const lang = supportedLanguages.includes(language) ? language : "zh";
  document.documentElement.lang = lang === "en" ? "en" : "zh-CN";
  document.body.dataset.language = lang;
  window.localStorage.setItem(STORAGE_KEY, lang);

  document.querySelectorAll("[data-zh][data-en]").forEach((element) => {
    const value = element.dataset[lang];
    if (!value) {
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
      applyLanguage(button.dataset.langButton || "zh");
    });
  });
};

const setupFloatingLanguageContrast = () => {
  const switcher = document.querySelector(".lang-switch-floating");
  if (!switcher) {
    return;
  }

  const mediaSelectors = [
    ".hero",
    ".page-hero-image",
    ".gallery",
    ".product-gallery-main",
    ".resource-detail-image",
    ".about-image",
    ".line-media",
    ".download-feature"
  ].join(",");

  const darkSectionSelectors = [
    ".line-panel-dark",
    ".resource-section-dark",
    ".product-performance",
    ".related-products",
    ".quality",
    ".site-footer"
  ].join(",");

  const parseRgbColor = (color) => {
    const match = color.match(/rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\s*\)/);
    if (!match) {
      return null;
    }

    const [, red, green, blue, alpha = "1"] = match;
    return {
      red: Number(red),
      green: Number(green),
      blue: Number(blue),
      alpha: Number(alpha)
    };
  };

  const isTransparentColor = (color) => {
    const parsed = parseRgbColor(color);
    return !parsed || parsed.alpha <= 0.05;
  };

  const getEffectiveBackgroundColor = (element) => {
    let current = element;
    while (current) {
      const color = window.getComputedStyle(current).backgroundColor;
      if (!isTransparentColor(color)) {
        return color;
      }
      current = current.parentElement;
    }

    return window.getComputedStyle(document.body).backgroundColor;
  };

  const isDarkColor = (color) => {
    const parsed = parseRgbColor(color);
    if (!parsed || parsed.alpha <= 0.05) {
      return false;
    }

    const { red, green, blue } = parsed;
    return (red * 299 + green * 587 + blue * 114) / 1000 < 118;
  };

  const updateContrast = () => {
    const rect = switcher.getBoundingClientRect();
    const x = Math.min(window.innerWidth - 1, Math.max(0, rect.left + rect.width / 2));
    const y = Math.min(window.innerHeight - 1, Math.max(0, rect.top + rect.height / 2));

    const elements = document
      .elementsFromPoint(x, y)
      .filter((element) => !element.closest(".lang-switch-floating") && !element.closest(".site-header"));

    const target = elements[0];
    const onMedia = Boolean(target?.closest(mediaSelectors));
    const onDark = Boolean(
      !onMedia &&
        (target?.closest(darkSectionSelectors) ||
          (target && isDarkColor(getEffectiveBackgroundColor(target))))
    );

    switcher.classList.toggle("is-on-media", onMedia);
    switcher.classList.toggle("is-on-dark", onDark);
  };

  updateContrast();
  window.addEventListener("scroll", updateContrast, { passive: true });
  window.addEventListener("resize", updateContrast);
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
setupFloatingLanguageContrast();

document.querySelectorAll("[data-contact-form]").forEach((form) => {
  const status = form.querySelector("[data-contact-status]");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (status) {
      status.textContent = document.body.dataset.language === "en" ? "Sending..." : "正在发送...";
    }

    const payload = Object.fromEntries(new FormData(form).entries());

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error("Submission failed");
      }

      form.reset();
      if (status) {
        status.textContent = document.body.dataset.language === "en" ? "Sent. We will contact you soon." : "已发送，我们会尽快联系你。";
      }
    } catch {
      if (status) {
        status.textContent = document.body.dataset.language === "en" ? "Could not send. Please email us directly." : "发送失败，请直接通过邮箱联系我们。";
      }
    }
  });
});
