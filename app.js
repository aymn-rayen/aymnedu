/* AymnEDU Interactivity and Core Logic Script */

document.addEventListener('DOMContentLoaded', () => {
  initNavbarScroll();
  initMobileMenu();
  initFeatureTabs();
  initPricingCalculator();
  initFaqAccordion();
  initDemoForm();
});

/**
 * 1. Navbar Glassmorphic background trigger on Scroll
 */
function initNavbarScroll() {
  const header = document.getElementById('main-header');
  if (!header) return;

  const handleScroll = () => {
    if (window.scrollY > 50) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  };

  window.addEventListener('scroll', handleScroll);
  handleScroll(); // Run once at load
}

/**
 * 2. Mobile Nav Toggle Drawer
 */
function initMobileMenu() {
  const toggle = document.getElementById('menu-toggle');
  const nav = document.getElementById('main-nav');
  
  if (!toggle || !nav) return;

  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    nav.classList.toggle('open');
    toggle.classList.toggle('active');
  });

  // Close when clicking navigate links
  const links = nav.querySelectorAll('a');
  links.forEach(link => {
    link.addEventListener('click', () => {
      nav.classList.remove('open');
      toggle.classList.remove('active');
    });
  });

  // Close when clicking outside navbar drawer
  document.addEventListener('click', (e) => {
    if (!nav.contains(e.target) && e.target !== toggle) {
      nav.classList.remove('open');
      toggle.classList.remove('active');
    }
  });
}

/**
 * 3. Reorganized Functional Feature tabs switcher
 */
function initFeatureTabs() {
  const tabButtons = document.querySelectorAll('.tab-btn');
  const panes = document.querySelectorAll('.feature-pane');

  if (tabButtons.length === 0) return;

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-tab');

      // Update active state in buttons
      tabButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Switch active feature pane
      panes.forEach(pane => {
        if (pane.id === `tab-${targetTab}`) {
          pane.classList.add('active');
        } else {
          pane.classList.remove('active');
        }
      });
    });
  });
}

/**
 * 4. Dynamic DZD (DA) Pricing & Saving Calculator
 */
function initPricingCalculator() {
  const slider = document.getElementById('student-slider');
  const countDisplay = document.getElementById('student-count-display');
  const hoursSavedDisplay = document.getElementById('calc-hours-saved');
  
  const planTierName = document.getElementById('plan-tier-name');
  const planPrice = document.getElementById('plan-price-starting');
  const planDesc = document.getElementById('plan-price-description');
  const planFeature1 = document.getElementById('plan-feature-1');

  if (!slider) return;

  const updateCalculator = () => {
    const val = parseInt(slider.value);
    countDisplay.textContent = val;

    // Time saved approximation: 5 hrs base + 0.05 hrs per student
    const hoursSaved = Math.round(5 + val * 0.05);
    hoursSavedDisplay.textContent = `~${hoursSaved}h`;

    // Dynamic Plan info updating based on centers scale (ICP definitions)
    if (val <= 250) {
      // Small tutoring centers (50 - 250)
      planTierName.textContent = 'Forfait Petit Centre';
      planPrice.innerHTML = '4 900 DA <span style="font-size: 1rem; font-weight: normal; color: var(--text-secondary);">/ mois (devis personnalisé)</span>';
      planDesc.textContent = 'Idéal pour les structures locales en développement (de 50 à 250 élèves).';
      planFeature1.textContent = 'Inscriptions jusqu\'à 250 élèves max';
    } else if (val <= 600) {
      // Medium tutoring centers (250 - 600)
      planTierName.textContent = 'Forfait Moyen Centre';
      planPrice.innerHTML = '9 900 DA <span style="font-size: 1rem; font-weight: normal; color: var(--text-secondary);">/ mois (devis personnalisé)</span>';
      planDesc.textContent = 'Parfait pour les centres structurés préparant activement au BEM, BAC et Langues (250 à 600 élèves).';
      planFeature1.textContent = 'Inscriptions de 250 à 600 élèves';
    } else {
      // Large centers / Custom requirements (600+)
      planTierName.textContent = 'Forfait Grand Centre';
      planPrice.innerHTML = 'Sur Devis <span style="font-size: 1rem; font-weight: normal; color: var(--text-secondary);">(Tarif adapté)</span>';
      planDesc.textContent = 'Destiné aux grands établissements multi-filières gérant plus de 600 étudiants et de nombreux enseignants.';
      planFeature1.textContent = 'Élèves inscrits illimités';
    }
  };

  slider.addEventListener('input', updateCalculator);
  updateCalculator(); // Initialize on page load
}

/**
 * 5. Interactive Accordion Questions
 */
function initFaqAccordion() {
  const faqItems = document.querySelectorAll('.faq-item');

  faqItems.forEach(item => {
    const btn = item.querySelector('.faq-question-btn');
    if (!btn) return;

    btn.addEventListener('click', () => {
      const isActive = item.classList.contains('active');
      
      // Close all other items
      faqItems.forEach(i => {
        i.classList.remove('active');
        const icon = i.querySelector('.faq-icon-toggle');
        if (icon) icon.textContent = '+';
      });

      // Toggle current item
      if (!isActive) {
        item.classList.add('active');
        const icon = item.querySelector('.faq-icon-toggle');
        if (icon) icon.textContent = '×';
      }
    });
  });
}

/**
 * 6. Trial Signup Booking Form Simulation
 */
function initDemoForm() {
  const form = document.getElementById('demo-form');
  const toast = document.getElementById('toast');
  const toastTitle = document.getElementById('toast-title');
  const toastDesc = document.getElementById('toast-desc');

  if (!form || !toast) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const submitBtn = form.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn.textContent;
    
    // Simulate API loading
    submitBtn.disabled = true;
    submitBtn.textContent = 'Génération de votre espace...';

    setTimeout(() => {
      // Get field values
      const managerName = document.getElementById('manager-name').value;
      const centerName = document.getElementById('center-name').value;
      
      // Setup Success notification toast details
      toastTitle.textContent = `Félicitations, M. ${managerName}!`;
      toastDesc.textContent = `Votre essai de 14 jours pour "${centerName}" est en cours de création. Notre service client d'Alger vous contactera par téléphone sous peu.`;
      
      // Show notice toast
      toast.classList.add('show');
      
      // Restore button status
      submitBtn.disabled = false;
      submitBtn.textContent = originalBtnText;

      // Reset form fields
      form.reset();

      // Dismiss dynamic notification toast after 6 seconds
      setTimeout(() => {
        toast.classList.remove('show');
      }, 6000);

    }, 1500);
  });
}
