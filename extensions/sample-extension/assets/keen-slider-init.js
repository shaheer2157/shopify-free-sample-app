/**
 * Keen Slider Initialization for Free Sample Products
 * Manages carousel functionality with keyboard navigation and touch support
 */

class FreeSampleKeenSlider {
  constructor(options = {}) {
    this.sliderElement = null;
    this.keenSlider = null;
    this.currentSlide = 0;
    
    // Get custom config from options or use defaults
    const desktopSlides = options.desktopSlides || 4.5;
    const tabletSlides = options.tabletSlides || 3.5;
    const mobileSlides = options.mobileSlides || 2.5;
    
    this.config = {
      slidesPerView: desktopSlides,  // Desktop: configurable slides
      spacing: 16,
      breakpoints: {
        // Tablet: 1024px and below
        '(max-width: 1024px)': {
          slides: {
            perView: tabletSlides,
            spacing: 14,
          },
        },
        // Mobile: 768px and below
        '(max-width: 768px)': {
          slides: {
            perView: mobileSlides,
            spacing: 12,
          },
        },
      },
    };
  }

  /**
   * Initialize the Keen Slider
   */
  async init(containerId = 'free-sample-products-container') {
    try {
      this.sliderElement = document.getElementById(containerId);
      if (!this.sliderElement) {
        console.warn(`🟡 Slider container ${containerId} not found`);
        return false;
      }

      // Check if Keen Slider library is loaded
      if (typeof window.KeenSlider === 'undefined') {
        console.error('🔴 Keen Slider library not loaded. Make sure to include the CDN script.');
        return false;
      }

      // Initialize Keen Slider
      this.keenSlider = new window.KeenSlider(this.sliderElement, {
        loop: false,
        mode: 'snap',
        slides: {
          perView: this.config.slidesPerView,
          spacing: this.config.spacing,
        },
        breakpoints: this.config.breakpoints,
        drag: true,
        keyboard: true,
        animationEnded: () => this.updateNavigationState(),
        created: () => this.setupNavigation(),
      });

      // Hook additional events if available to keep navigation state in sync
      try {
        if (this.keenSlider && typeof this.keenSlider.on === 'function') {
          // slideChanged is fired when the active slide changes
            if (typeof this.keenSlider.on === 'function') {
              this.keenSlider.on('slideChanged', () => this.updateNavigationState());
            }
          // detailsChanged is a fallback for some versions
          this.keenSlider.on('detailsChanged', () => this.updateNavigationState());
        }
      } catch (e) {
        // Non-fatal: older/newer Keen versions may not expose same events
        // rely on animationEnded and manual calls from controls
      }

      console.log('✅ Keen Slider initialized successfully');
      return true;
    } catch (error) {
      console.error('🔴 Error initializing Keen Slider:', error);
      return false;
    }
  }

  /**
   * Setup navigation arrows and dots
   */
  setupNavigation() {
    const container = this.sliderElement.parentElement;
    if (!container) return;

      // Ensure parent container can position overlay elements
      container.style.position = container.style.position || 'relative';

      // Previous button (SVG icon)
      const prevBtn = document.createElement('button');
      prevBtn.className = 'free-sample-keen-slider__arrow free-sample-keen-slider__arrow--prev';
      prevBtn.setAttribute('aria-label', 'Previous slide');
      prevBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M15 18L9 12L15 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      `;
      prevBtn.addEventListener('click', () => this.keenSlider?.prev());

      // Next button (SVG icon)
      const nextBtn = document.createElement('button');
      nextBtn.className = 'free-sample-keen-slider__arrow free-sample-keen-slider__arrow--next';
      nextBtn.setAttribute('aria-label', 'Next slide');
      nextBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M9 6L15 12L9 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      `;
      nextBtn.addEventListener('click', () => this.keenSlider?.next());

      // Dots container (kept below the slider)
      const dotsContainer = document.createElement('div');
      dotsContainer.className = 'free-sample-keen-slider__dots';

      // Append arrows as overlays to the same container that holds the slider
      container.appendChild(prevBtn);
      container.appendChild(nextBtn);

      // Append dots below the slider element
      this.sliderElement.insertAdjacentElement('afterend', dotsContainer);

    // Create dots and update state
    this.createDots(dotsContainer);
    this.updateNavigationState();

    // Save references
    this.navElements = {
      prevBtn,
      nextBtn,
      dotsContainer,
    };
  }

  /**
   * Create dot navigation
   */
  createDots(dotsContainer) {
    if (!this.keenSlider || !this.sliderElement) return;

    const slides = this.sliderElement.querySelectorAll('.keen-slider__slide');
    const slideCount = slides.length;

    for (let i = 0; i < slideCount; i++) {
      const dot = document.createElement('button');
      dot.className = 'free-sample-keen-slider__dot';
      if (i === 0) dot.classList.add('active');
      dot.setAttribute('aria-label', `Go to slide ${i + 1}`);
      dot.addEventListener('click', () => this.keenSlider?.moveToIdx(i));
      dotsContainer.appendChild(dot);
    }
  }

  /**
   * Update navigation state (arrows enabled/disabled, active dot)
   */
  updateNavigationState() {
    if (!this.keenSlider || !this.navElements) return;

    const { prevBtn, nextBtn, dotsContainer } = this.navElements;
    const currentIdx = this.keenSlider.track.details.rel;

    // Update button states
    prevBtn.disabled = currentIdx === 0;
    nextBtn.disabled = currentIdx >= this.keenSlider.track.details.slides.length - 1;

    // Accessibility: reflect disabled state in aria-disabled
    prevBtn.setAttribute('aria-disabled', String(prevBtn.disabled));
    nextBtn.setAttribute('aria-disabled', String(nextBtn.disabled));

    // Update active dot
    const dots = dotsContainer.querySelectorAll('.free-sample-keen-slider__dot');
    dots.forEach((dot, idx) => {
      dot.classList.toggle('active', idx === currentIdx);
    });
  }

  /**
   * Destroy slider instance
   */
  destroy() {
    if (this.keenSlider) {
      try { this.keenSlider.destroy(); } catch (e) {}
      this.keenSlider = null;
    }
  }

  /**
   * Get current slide index
   */
  getCurrentSlide() {
    return this.keenSlider?.track.details.rel || 0;
  }

  /**
   * Move to specific slide
   */
  moveToSlide(index) {
    this.keenSlider?.moveToIdx(index);
  }

  /**
   * Navigate to next slide
   */
  next() {
    this.keenSlider?.next();
  }

  /**
   * Navigate to previous slide
   */
  prev() {
    this.keenSlider?.prev();
  }
}

// Global export for use in other scripts
window.FreeSampleKeenSlider = FreeSampleKeenSlider;

console.log('✅ Keen Slider module loaded');
