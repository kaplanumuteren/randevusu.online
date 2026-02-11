// Mobile table to card converter utility
export function convertTableToCards() {
  const isMobile = window.innerWidth <= 768;

  document.querySelectorAll('.table-wrapper').forEach(wrapper => {
    const table = wrapper.querySelector('table');
    if (!table) return;

    const thead = table.querySelector('thead');
    const tbody = table.querySelector('tbody');
    if (!thead || !tbody) return;

    // Remove existing mobile cards if any
    let cardsContainer = wrapper.querySelector('.mobile-cards-container');
    if (cardsContainer) {
      cardsContainer.remove();
    }

    if (!isMobile) {
      // Desktop: Show table, hide any existing cards
      table.style.display = '';
      return;
    }

    // Mobile: Create cards from table
    // Get headers
    const headers = Array.from(thead.querySelectorAll('th')).map(th => th.textContent.trim());

    // Create mobile cards container
    cardsContainer = document.createElement('div');
    cardsContainer.className = 'mobile-cards-container';

    // Convert rows to cards
    const rows = tbody.querySelectorAll('tr');
    if (rows.length === 0) {
      // Empty table - check if there's an empty message
      const emptyRow = tbody.querySelector('td[colspan]');
      if (emptyRow) {
        const emptyCard = document.createElement('div');
        emptyCard.className = 'mobile-table-card';
        emptyCard.style.textAlign = 'center';
        emptyCard.style.color = 'var(--muted)';
        emptyCard.style.padding = '20px';
        emptyCard.textContent = emptyRow.textContent.trim();
        cardsContainer.appendChild(emptyCard);
      }
    } else {
      rows.forEach(row => {
        const cells = Array.from(row.querySelectorAll('td'));
        if (cells.length === 0) return;

        // Check if it's an empty message row
        const rowText = row.textContent.trim();
        const hasColspan = cells.some(cell => cell.hasAttribute('colspan'));
        if (hasColspan || rowText.includes('randevu yok') || rowText.includes('Henüz') || rowText.includes('yok') || rowText.includes('bulunmuyor')) {
          const emptyCard = document.createElement('div');
          emptyCard.className = 'mobile-table-card';
          emptyCard.style.textAlign = 'center';
          emptyCard.style.color = 'var(--muted)';
          emptyCard.style.padding = '20px';
          emptyCard.textContent = rowText;
          cardsContainer.appendChild(emptyCard);
          return;
        }

        const card = document.createElement('div');
        card.className = 'mobile-table-card';

        // Create card content
        cells.forEach((cell, index) => {
          if (index < headers.length) {
            const header = headers[index];
            let value = cell.innerHTML;
            
            // Clean up HTML in value
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = value;
            const buttons = tempDiv.querySelectorAll('button, select');
            const hasActions = buttons.length > 0;
            
            const rowDiv = document.createElement('div');
            rowDiv.className = 'mobile-table-card-row';
            
            const labelDiv = document.createElement('div');
            labelDiv.className = 'mobile-table-card-label';
            labelDiv.textContent = header;
            
            const valueDiv = document.createElement('div');
            valueDiv.className = 'mobile-table-card-value';
            if (hasActions) {
              valueDiv.className += ' mobile-actions';
            }
            valueDiv.innerHTML = value;
            
            rowDiv.appendChild(labelDiv);
            rowDiv.appendChild(valueDiv);
            card.appendChild(rowDiv);
          }
        });

        if (card.children.length > 0) {
          cardsContainer.appendChild(card);
        }
      });
    }

    // Insert cards container before table (so it appears first)
    table.parentNode.insertBefore(cardsContainer, table);
    
    // Hide table on mobile
    table.style.display = 'none';
  });
}

// Initialize on load and resize
if (typeof window !== 'undefined') {
  // Run on load with delay to ensure DOM is ready
  function initMobileTables() {
    setTimeout(() => {
      convertTableToCards();
    }, 200);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMobileTables);
  } else {
    initMobileTables();
  }

  // Run on resize with debounce
  let resizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      convertTableToCards();
    }, 250);
  });

  // Also run when page content changes (for dynamic content)
  const observer = new MutationObserver(() => {
    setTimeout(() => {
      convertTableToCards();
    }, 100);
  });

  // Observe body for changes
  if (document.body) {
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
}
