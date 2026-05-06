const STORAGE_KEY = "keep-language";
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
    }
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeMenu();
    }
  });
}

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
