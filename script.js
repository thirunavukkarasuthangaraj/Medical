// ===== CONFIGURATION =====
// IMPORTANT: Replace this URL with your deployed Google Apps Script Web App URL
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxy6IIuGxZ7TXsYbBGoOngia4kzjVdI_Vu7rZj8D8ERvof8ITeK3HlGvzEqzacupGD7qw/exec';

// ===== Preloader =====
window.addEventListener('load', () => {
    const preloader = document.getElementById('preloader');
    setTimeout(() => {
        preloader.classList.add('hidden');
    }, 1500);
});

// ===== DOM Elements =====
const navbar = document.getElementById('navbar');
const hamburger = document.getElementById('hamburger');
const navMenu = document.getElementById('nav-menu');
const navLinks = document.querySelectorAll('.nav-link');
const appointmentForm = document.getElementById('appointmentForm');
const backToTop = document.getElementById('backToTop');

// ===== Initialize AOS Animation Library =====
AOS.init({
    duration: 800,
    easing: 'ease-out',
    once: true,
    offset: 100
});

// ===== Navbar Scroll Effect =====
window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
        navbar.classList.add('scrolled');
    } else {
        navbar.classList.remove('scrolled');
    }

    // Back to top button visibility
    if (window.scrollY > 500) {
        backToTop.classList.add('visible');
    } else {
        backToTop.classList.remove('visible');
    }
});

// ===== Back to Top Button =====
backToTop.addEventListener('click', () => {
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
});

// ===== Mobile Menu Toggle =====
hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('active');
    navMenu.classList.toggle('active');
    document.body.style.overflow = navMenu.classList.contains('active') ? 'hidden' : '';
});

// Close mobile menu when a link is clicked
navLinks.forEach(link => {
    link.addEventListener('click', () => {
        hamburger.classList.remove('active');
        navMenu.classList.remove('active');
        document.body.style.overflow = '';
    });
});

// Close mobile menu when clicking outside
document.addEventListener('click', (e) => {
    if (!hamburger.contains(e.target) && !navMenu.contains(e.target)) {
        hamburger.classList.remove('active');
        navMenu.classList.remove('active');
        document.body.style.overflow = '';
    }
});

// ===== Smooth Scroll for Navigation Links =====
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const targetId = this.getAttribute('href');
        const targetElement = document.querySelector(targetId);

        if (targetElement) {
            const navHeight = navbar.offsetHeight;
            const targetPosition = targetElement.offsetTop - navHeight;

            window.scrollTo({
                top: targetPosition,
                behavior: 'smooth'
            });
        }
    });
});

// ===== Active Navigation Link on Scroll =====
const sections = document.querySelectorAll('section[id]');

window.addEventListener('scroll', () => {
    let current = '';
    const navHeight = navbar.offsetHeight;

    sections.forEach(section => {
        const sectionTop = section.offsetTop - navHeight - 100;
        const sectionHeight = section.offsetHeight;

        if (window.scrollY >= sectionTop && window.scrollY < sectionTop + sectionHeight) {
            current = section.getAttribute('id');
        }
    });

    navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === `#${current}`) {
            link.classList.add('active');
        }
    });
});

// ===== Counter Animation =====
const animateCounters = () => {
    const counters = document.querySelectorAll('.stat-number[data-count]');

    counters.forEach(counter => {
        const target = parseInt(counter.getAttribute('data-count'));
        const duration = 2000;
        const increment = target / (duration / 16);
        let current = 0;

        const updateCounter = () => {
            current += increment;
            if (current < target) {
                counter.textContent = Math.floor(current) + '+';
                requestAnimationFrame(updateCounter);
            } else {
                counter.textContent = target + '+';
            }
        };

        updateCounter();
    });
};

// Trigger counter animation when hero section is visible
const heroObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            animateCounters();
            heroObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.5 });

const heroSection = document.querySelector('.hero');
if (heroSection) {
    heroObserver.observe(heroSection);
}

// ===== FAQ Accordion =====
const faqItems = document.querySelectorAll('.faq-item');

faqItems.forEach(item => {
    const question = item.querySelector('.faq-question');

    question.addEventListener('click', () => {
        const isActive = item.classList.contains('active');

        // Close all FAQ items
        faqItems.forEach(faq => {
            faq.classList.remove('active');
        });

        // Open clicked item if it wasn't active
        if (!isActive) {
            item.classList.add('active');
        }
    });
});

// ===== Testimonials Slider =====
const testimonialTrack = document.getElementById('testimonialTrack');
const testimonialDots = document.getElementById('testimonialDots');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
let currentSlide = 0;
let testimonialCards;
let totalSlides;
let slidesPerView = 3;

const initTestimonialSlider = () => {
    testimonialCards = document.querySelectorAll('.testimonial-card');

    // Determine slides per view based on screen width
    if (window.innerWidth <= 768) {
        slidesPerView = 1;
    } else if (window.innerWidth <= 1024) {
        slidesPerView = 2;
    } else {
        slidesPerView = 3;
    }

    totalSlides = Math.ceil(testimonialCards.length / slidesPerView);

    // Create dots
    testimonialDots.innerHTML = '';
    for (let i = 0; i < totalSlides; i++) {
        const dot = document.createElement('span');
        dot.classList.add('dot');
        if (i === 0) dot.classList.add('active');
        dot.addEventListener('click', () => goToSlide(i));
        testimonialDots.appendChild(dot);
    }

    updateSlider();
};

const updateSlider = () => {
    const cardWidth = testimonialCards[0].offsetWidth + 30; // Including gap
    const offset = currentSlide * cardWidth * slidesPerView;
    testimonialTrack.style.transform = `translateX(-${offset}px)`;

    // Update dots
    const dots = testimonialDots.querySelectorAll('.dot');
    dots.forEach((dot, index) => {
        dot.classList.toggle('active', index === currentSlide);
    });
};

const goToSlide = (index) => {
    currentSlide = index;
    updateSlider();
};

const nextSlide = () => {
    currentSlide = (currentSlide + 1) % totalSlides;
    updateSlider();
};

const prevSlide = () => {
    currentSlide = (currentSlide - 1 + totalSlides) % totalSlides;
    updateSlider();
};

if (prevBtn && nextBtn) {
    prevBtn.addEventListener('click', prevSlide);
    nextBtn.addEventListener('click', nextSlide);
}

// Initialize slider
initTestimonialSlider();

// Reinitialize on window resize
window.addEventListener('resize', () => {
    currentSlide = 0;
    initTestimonialSlider();
});

// Auto-slide testimonials
setInterval(nextSlide, 5000);

// ===== BMI Calculator =====
const bmiForm = document.getElementById('bmiForm');
const bmiResult = document.getElementById('bmiResult');

if (bmiForm) {
    bmiForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const height = parseFloat(document.getElementById('height').value) / 100; // Convert cm to m
        const weight = parseFloat(document.getElementById('weight').value);

        if (height > 0 && weight > 0) {
            const bmi = weight / (height * height);
            const bmiValue = bmi.toFixed(1);

            let status, advice, statusColor;

            if (bmi < 18.5) {
                status = 'Underweight';
                advice = 'Consider consulting Dr. Devini for a personalized diet and health plan.';
                statusColor = '#1976D2';
            } else if (bmi < 25) {
                status = 'Normal Weight';
                advice = 'Great! Maintain your healthy lifestyle with balanced diet and exercise.';
                statusColor = '#388E3C';
            } else if (bmi < 30) {
                status = 'Overweight';
                advice = 'Consider homeopathic treatment for healthy weight management.';
                statusColor = '#F57C00';
            } else {
                status = 'Obese';
                advice = 'Consult Dr. Devini for a holistic approach to weight management.';
                statusColor = '#D32F2F';
            }

            bmiResult.querySelector('.bmi-number').textContent = bmiValue;
            bmiResult.querySelector('.bmi-number').style.color = statusColor;
            bmiResult.querySelector('.bmi-status').textContent = status;
            bmiResult.querySelector('.bmi-status').style.color = statusColor;
            bmiResult.querySelector('.bmi-advice').textContent = advice;
        }
    });
}

// ===== Language Toggle =====
const langBtns = document.querySelectorAll('.lang-btn');
let currentLang = 'en';

langBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const lang = btn.getAttribute('data-lang');

        if (lang !== currentLang) {
            currentLang = lang;

            // Update active button
            langBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Update all translatable elements
            document.querySelectorAll('[data-en]').forEach(el => {
                el.textContent = el.getAttribute(`data-${lang}`) || el.getAttribute('data-en');
            });
        }
    });
});

// ===== Appointment Form Handling =====
if (appointmentForm) {
    appointmentForm.addEventListener('submit', async function(e) {
        e.preventDefault();

        // Get form data
        const formData = new FormData(this);
        const data = {};
        formData.forEach((value, key) => {
            data[key] = value;
        });

        // Basic validation
        if (!data.name || !data.phone || !data.date || !data.service || !data.time) {
            showNotification('Please fill in all required fields.', 'error');
            return;
        }

        // Check if selected time slot is marked as full (disabled option selected)
        const timeSelectEl = this.querySelector('select[name="time"]');
        const selectedOption = timeSelectEl.options[timeSelectEl.selectedIndex];
        if (selectedOption && selectedOption.disabled) {
            showNotification('This time slot is full. Please select another time.', 'error');
            return;
        }

        // Phone number validation (Indian format)
        const phoneRegex = /^[6-9]\d{9}$/;
        const cleanPhone = data.phone.replace(/\s|-/g, '');
        if (!phoneRegex.test(cleanPhone)) {
            showNotification('Please enter a valid 10-digit phone number.', 'error');
            return;
        }

        // Email validation (if provided)
        if (data.email) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(data.email)) {
                showNotification('Please enter a valid email address.', 'error');
                return;
            }
        }

        // Date validation (should be future date)
        const selectedDate = new Date(data.date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (selectedDate < today) {
            showNotification('Please select a future date for your appointment.', 'error');
            return;
        }

        // Show loading state
        const submitBtn = this.querySelector('button[type="submit"]');
        const btnSpan = submitBtn.querySelector('span');
        const originalText = btnSpan.textContent;
        btnSpan.textContent = 'Booking...';
        submitBtn.disabled = true;

        try {
            // Check if Google Script URL is configured
            if (!GOOGLE_SCRIPT_URL || GOOGLE_SCRIPT_URL === 'YOUR_GOOGLE_APPS_SCRIPT_URL_HERE') {
                // Demo mode - simulate successful booking
                console.log('Demo Mode: Google Apps Script URL not configured');
                console.log('Form Data:', data);

                await new Promise(resolve => setTimeout(resolve, 1500));

                showNotification('Demo: Appointment request received! Configure Google Apps Script for real submissions.', 'success');
                this.reset();

            } else {
                // Production mode - send to Google Apps Script
                const response = await fetch(GOOGLE_SCRIPT_URL, {
                    method: 'POST',
                    mode: 'no-cors', // Required for Google Apps Script
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(data)
                });

                // With no-cors mode, we can't read the response
                // So we assume success if no error is thrown
                showNotification('Appointment booked successfully! We will contact you shortly to confirm.', 'success');
                this.reset();

                // Show WhatsApp follow-up option
                setTimeout(() => {
                    if (confirm('Would you like to send appointment details via WhatsApp?')) {
                        const serviceName = document.querySelector(`#service option[value="${data.service}"]`)?.textContent || data.service;
                        const timeName = document.querySelector(`#time option[value="${data.time}"]`)?.textContent || data.time;
                        const message = encodeURIComponent(`Hello Dr. Devini,

I have booked an appointment through your website.

*Appointment Details:*
Name: ${data.name}
Phone: ${data.phone}
Date: ${formatDateForDisplay(data.date)}
Time: ${timeName}
Service: ${serviceName}
${data.message ? `Health Concern: ${data.message}` : ''}

Please confirm my appointment.

Thank you.`);
                        window.open(`https://wa.me/918144002155?text=${message}`, '_blank');
                    }
                }, 1000);
            }

        } catch (error) {
            console.error('Error submitting form:', error);
            showNotification('Something went wrong. Please try again or call us directly.', 'error');
        } finally {
            btnSpan.textContent = originalText;
            submitBtn.disabled = false;
        }
    });
}

// Helper function to format date for display
function formatDateForDisplay(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

// ===== Notification System =====
function showNotification(message, type = 'success') {
    // Remove existing notifications
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }

    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i>
            <span>${message}</span>
        </div>
        <button class="notification-close" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;

    // Add styles
    notification.style.cssText = `
        position: fixed;
        top: 100px;
        right: 20px;
        max-width: 400px;
        padding: 20px 25px;
        background: ${type === 'success' ? 'linear-gradient(135deg, #2E7D32, #4CAF50)' : 'linear-gradient(135deg, #c62828, #e53935)'};
        color: white;
        border-radius: 12px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.2);
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 15px;
        z-index: 10000;
        animation: slideInRight 0.5s ease;
    `;

    // Add animation keyframes if not exists
    if (!document.querySelector('#notification-styles')) {
        const style = document.createElement('style');
        style.id = 'notification-styles';
        style.textContent = `
            @keyframes slideInRight {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
            .notification-content {
                display: flex;
                align-items: center;
                gap: 12px;
            }
            .notification-content i {
                font-size: 24px;
            }
            .notification-content span {
                font-size: 14px;
                line-height: 1.5;
            }
            .notification-close {
                background: rgba(255,255,255,0.2);
                border: none;
                color: white;
                cursor: pointer;
                padding: 8px;
                border-radius: 50%;
                width: 32px;
                height: 32px;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: background 0.3s;
            }
            .notification-close:hover {
                background: rgba(255,255,255,0.3);
            }
        `;
        document.head.appendChild(style);
    }

    document.body.appendChild(notification);

    // Auto remove after 6 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.style.animation = 'slideInRight 0.5s ease reverse';
            setTimeout(() => notification.remove(), 500);
        }
    }, 6000);
}

// ===== Set minimum date for appointment =====
document.addEventListener('DOMContentLoaded', () => {
    const dateInput = document.querySelector('input[type="date"]');
    if (dateInput) {
        const today = new Date().toISOString().split('T')[0];
        dateInput.setAttribute('min', today);
    }

    // ===== Show/Hide Payment Info for Online Consultation =====
    // COMMENTED OUT - Payment feature disabled for now
    // const consultationType = document.getElementById('consultationType');
    // const paymentInfo = document.getElementById('paymentInfo');
    // const submitBtn = document.querySelector('.btn-submit');
    // const originalBtnText = submitBtn ? submitBtn.innerHTML : '';

    // if (consultationType && paymentInfo && submitBtn) {
    //     consultationType.addEventListener('change', function() {
    //         if (this.value === 'online') {
    //             paymentInfo.style.display = 'block';
    //             submitBtn.innerHTML = '<span>Book & Pay Rs 250</span><i class="fas fa-credit-card"></i>';
    //             submitBtn.style.background = 'linear-gradient(135deg, #4CAF50, #2E7D32)';
    //         } else {
    //             paymentInfo.style.display = 'none';
    //             submitBtn.innerHTML = originalBtnText;
    //             submitBtn.style.background = '';
    //         }
    //     });
    // }
});

// ===== Slot Availability Checking =====
const timeSelect = document.querySelector('select[name="time"]');
const dateInput = document.querySelector('input[name="date"]');

// Store original time options
const originalTimeOptions = timeSelect ? timeSelect.innerHTML : '';

// Check slot availability when date is selected
if (dateInput && timeSelect) {
    dateInput.addEventListener('change', async function() {
        const selectedDate = this.value;

        if (!selectedDate) {
            // Reset to original options if no date selected
            timeSelect.innerHTML = originalTimeOptions;
            return;
        }

        // Show loading state
        timeSelect.innerHTML = '<option value="">Checking availability...</option>';
        timeSelect.disabled = true;

        try {
            // Check if Google Script URL is configured
            if (!GOOGLE_SCRIPT_URL || GOOGLE_SCRIPT_URL === 'YOUR_GOOGLE_APPS_SCRIPT_URL_HERE') {
                // Demo mode - show all slots available
                timeSelect.innerHTML = originalTimeOptions;
                timeSelect.disabled = false;
                return;
            }

            // Fetch slot availability from API
            const response = await fetch(`${GOOGLE_SCRIPT_URL}?action=checkSlots&date=${selectedDate}`);
            const data = await response.json();

            if (data.success) {
                // Build new options with availability info
                let optionsHtml = '<option value="">Select time slot</option>';
                const slots = data.slots;
                const maxPerSlot = data.maxPerSlot || 3;

                // Time slot labels mapping
                const timeLabels = {
                    '09:00': '09:00 AM', '09:30': '09:30 AM',
                    '10:00': '10:00 AM', '10:30': '10:30 AM',
                    '11:00': '11:00 AM', '11:30': '11:30 AM',
                    '12:00': '12:00 PM', '12:30': '12:30 PM',
                    '13:00': '01:00 PM', '13:30': '01:30 PM',
                    '14:00': '02:00 PM', '14:30': '02:30 PM',
                    '15:00': '03:00 PM', '15:30': '03:30 PM',
                    '16:00': '04:00 PM', '16:30': '04:30 PM',
                    '17:00': '05:00 PM', '17:30': '05:30 PM',
                    '18:00': '06:00 PM', '18:30': '06:30 PM',
                    '19:00': '07:00 PM'
                };

                for (const [time, info] of Object.entries(slots)) {
                    const label = timeLabels[time] || time;

                    if (info.full) {
                        // Slot is full - disabled
                        optionsHtml += `<option value="${time}" disabled>${label} - FULL</option>`;
                    } else {
                        // Show available spots
                        const spotsText = info.available === maxPerSlot ? '' : ` (${info.available} spot${info.available > 1 ? 's' : ''} left)`;
                        optionsHtml += `<option value="${time}">${label}${spotsText}</option>`;
                    }
                }

                timeSelect.innerHTML = optionsHtml;
            } else {
                // Error from API - show all slots
                console.error('Slot check error:', data.message);
                timeSelect.innerHTML = originalTimeOptions;
            }
        } catch (error) {
            console.error('Error checking slots:', error);
            // On error, show all slots available
            timeSelect.innerHTML = originalTimeOptions;
        } finally {
            timeSelect.disabled = false;
        }
    });
}

// ===== Parallax Effect for Hero Background =====
window.addEventListener('scroll', () => {
    const scrolled = window.scrollY;
    const hero = document.querySelector('.hero');
    if (hero && scrolled < window.innerHeight) {
        hero.style.backgroundPositionY = `${scrolled * 0.5}px`;
    }
});

// ===== Gallery Lightbox (placeholder for when images are added) =====
const galleryItems = document.querySelectorAll('.gallery-placeholder');
galleryItems.forEach(item => {
    item.addEventListener('click', () => {
        const label = item.querySelector('span').textContent;
        showNotification(`${label} - Add clinic photos here to enable gallery view`, 'success');
    });
});

// ===== Typing Effect for Hero Title (optional enhancement) =====
const heroTitle = document.querySelector('.hero-title');
if (heroTitle) {
    const text = heroTitle.textContent;
    heroTitle.textContent = '';
    let charIndex = 0;

    const typeWriter = () => {
        if (charIndex < text.length) {
            heroTitle.textContent += text.charAt(charIndex);
            charIndex++;
            setTimeout(typeWriter, 50);
        }
    };

    // Start typing after preloader
    setTimeout(typeWriter, 1800);
}

// ===== Form Input Animation =====
const formInputs = document.querySelectorAll('.appointment-form input, .appointment-form select, .appointment-form textarea');
formInputs.forEach(input => {
    input.addEventListener('focus', function() {
        this.parentElement.classList.add('focused');
    });

    input.addEventListener('blur', function() {
        if (!this.value) {
            this.parentElement.classList.remove('focused');
        }
    });
});

// ===== Scroll Progress Indicator =====
const createScrollProgress = () => {
    const progress = document.createElement('div');
    progress.id = 'scroll-progress';
    progress.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        height: 4px;
        background: linear-gradient(90deg, #2E7D32, #4CAF50);
        width: 0%;
        z-index: 10001;
        transition: width 0.1s ease;
    `;
    document.body.appendChild(progress);

    window.addEventListener('scroll', () => {
        const scrollTop = window.scrollY;
        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        const scrollPercent = (scrollTop / docHeight) * 100;
        progress.style.width = `${scrollPercent}%`;
    });
};

createScrollProgress();

// ===== Lazy Loading for Images =====
const lazyLoadImages = () => {
    const images = document.querySelectorAll('img[data-src]');
    const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.dataset.src;
                img.removeAttribute('data-src');
                observer.unobserve(img);
            }
        });
    });

    images.forEach(img => imageObserver.observe(img));
};

lazyLoadImages();

// ===== Easter Egg - Konami Code =====
let konamiCode = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
let konamiIndex = 0;

document.addEventListener('keydown', (e) => {
    if (e.key === konamiCode[konamiIndex]) {
        konamiIndex++;
        if (konamiIndex === konamiCode.length) {
            showNotification('You found the secret! Dr. Devini wishes you good health! 🌿', 'success');
            konamiIndex = 0;
        }
    } else {
        konamiIndex = 0;
    }
});

// ===== Console Welcome Message =====
console.log('%c🌿 Dr. Devini\'s Homeopathy Clinic', 'font-size: 24px; font-weight: bold; color: #2E7D32;');
console.log('%cHealing Naturally, Living Fully', 'font-size: 14px; color: #4CAF50;');
console.log('%cVelachery, Chennai | +91 8144002155', 'font-size: 12px; color: #666;');
console.log('%c---', 'color: #ccc;');
console.log('%cWebsite loaded successfully! ✓', 'color: #2E7D32;');
