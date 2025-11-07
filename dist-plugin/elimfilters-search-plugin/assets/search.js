jQuery(document).ready(function($) {
    
    const searchForm = $('#elimfilters-search-form');
    const searchInput = $('#elimfilters-search-input');
    const searchButton = $('.elimfilters-search-button');
    const loadingSpinner = $('.loading-spinner');
    const errorContainer = $('#elimfilters-search-error');
    const suggestionsContainer = $('#elimfilters-search-suggestions');
    
    let searchTimeout;
    let lastSearchQuery = '';
    
    /**
     * Manejar envío del formulario
     */
    searchForm.on('submit', function(e) {
        e.preventDefault();
        
        const query = searchInput.val().trim();
        
        if (!query) {
            showError('Por favor ingrese un código OEM o Cross Reference');
            return;
        }
        
        // Si hay página de resultados configurada, redirigir usando su permalink real
        if (elimfilters_ajax.results_page) {
            const base = elimfilters_ajax.results_page;
            const sep = base.includes('?') ? '&' : '?';
            const resultsUrl = base + sep + 'part=' + encodeURIComponent(query);
            window.location.href = resultsUrl;
        } else {
            // Realizar búsqueda AJAX directamente
            performSearch(query);
        }
    });
    
    /**
     * Búsqueda en tiempo real (opcional)
     */
    searchInput.on('input', function() {
        const query = $(this).val().trim();
        
        // Limpiar timeout anterior
        clearTimeout(searchTimeout);
        
        // Ocultar error
        hideError();
        
        if (query.length < 2) {
            hideSuggestions();
            return;
        }
        
        // Esperar 300ms después de dejar de escribir
        searchTimeout = setTimeout(function() {
            if (query !== lastSearchQuery) {
                lastSearchQuery = query;
                // Puedes descomentar esto si quieres sugerencias en tiempo real
                // getSuggestions(query);
            }
        }, 300);
    });
    
    /**
     * Realizar búsqueda AJAX
     */
    function performSearch(query) {
        showLoading(true);
        hideError();
        // Mostrar loader inline si existe el contenedor en la página del formulario
        showInlineLoading(true);
        
        $.ajax({
            url: elimfilters_ajax.ajax_url,
            type: 'POST',
            data: {
                action: 'elimfilters_search',
                nonce: elimfilters_ajax.nonce,
                query: query
            },
            timeout: 25000,
            success: function(response) {
                showLoading(false);
                showInlineLoading(false);
                try {
                    if (response && response.success) {
                        displayResults(response.data || {});
                    } else {
                        const msg = (response && response.data && response.data.message)
                            ? response.data.message
                            : 'No se encontraron resultados';
                        showError(msg);
                    }
                } catch (e) {
                    showError('Ocurrió un error inesperado al procesar la respuesta');
                }
            },
            error: function() {
                showLoading(false);
                showInlineLoading(false);
                showError('Error al conectar con el servidor. Por favor, intente nuevamente.');
            }
        });
    }
    
    /**
     * Mostrar resultados
     */
    function displayResults(data) {
        const resultsContainer = $('#elimfilters-results-content');
        // Buscar el loader más cercano al contenedor de resultados (inline o página de resultados)
        const loadingContainer = resultsContainer.closest('.elimfilters-results-container, .elimfilters-inline-results').find('.results-loading');
        
        if (!resultsContainer.length) {
            // Si no existe contenedor de resultados (p.ej., estamos en la página del formulario),
            // evita fallar silenciosamente y muestra un error amigable.
            showError('Los resultados no pudieron mostrarse aquí. Intente nuevamente o use la página de resultados.');
            return;
        }
        
        // Ocultar loading
        loadingContainer.hide();
        
        let html = '';
        
        if (data.status === 'OK' && data.data) {
            const result = data.data;
            const source = data.source || 'generated';
            const responseTime = data.response_time_ms || 0;

            // Persistencia mínima para PDF del servidor
            try {
                const canonicalData = {
                    original_query: result.original_query || '',
                    sku: result.sku || result.original_query || ''
                };
                window.elimfiltersPDFData = canonicalData;
                try { sessionStorage.setItem('elimfilters_pdf_data', JSON.stringify(canonicalData)); } catch(e) {}
                try { document.dispatchEvent(new CustomEvent('elimfilters:pdf-data-ready', { detail: canonicalData })); } catch(e) {}
            } catch(e) {}
            
            html = `
                <div class="elimfilters-result-card">
                    <div class="result-header">
                        <h3>Resultado de Búsqueda</h3>
                        <span class="result-source source-${source}">
                            ${source === 'cache' ? 'Desde caché' : 'Generado'}
                        </span>
                    </div>
                    
                    <div class="result-content">
                        <div class="result-row">
                            <span class="result-label">Código Original:</span>
                            <span class="result-value">${escapeHtml(result.oem_number || result.original_query || '')}</span>
                        </div>
                        
                        <div class="result-row">
                            <span class="result-label">SKU ELIMFILTERS:</span>
                            <span class="result-value highlight">${escapeHtml(result.sku || 'N/A')}</span>
                        </div>
                        
                        ${result.family ? `
                        <div class="result-row">
                            <span class="result-label">Familia:</span>
                            <span class="result-value">${escapeHtml(result.family)}</span>
                        </div>
                        ` : ''}
                        
                        ${result.duty ? `
                        <div class="result-row">
                            <span class="result-label">Tipo:</span>
                            <span class="result-value">${escapeHtml(result.duty)}</span>
                        </div>
                        ` : ''}
                        
                        ${result.donaldson ? `
                        <div class="result-row">
                            <span class="result-label">Donaldson:</span>
                            <span class="result-value">${escapeHtml(result.donaldson)}</span>
                        </div>
                        ` : ''}
                        
                        ${result.fram ? `
                        <div class="result-row">
                            <span class="result-label">FRAM:</span>
                            <span class="result-value">${escapeHtml(result.fram)}</span>
                        </div>
                        ` : ''}
                        
                        ${result.notes ? `
                        <div class="result-row">
                            <span class="result-label">Notas:</span>
                            <span class="result-value">${escapeHtml(result.notes)}</span>
                        </div>
                        ` : ''}
                    </div>
                    
                    <div class="result-footer">
                        <span class="response-time">Tiempo de respuesta: ${responseTime}ms</span>
                        <button class="btn-new-search" onclick="location.reload()">Nueva Búsqueda</button>
                    </div>
                </div>
            `;
        } else {
            html = `
                <div class="elimfilters-no-results">
                    <div class="no-results-icon">🔍</div>
                    <h3>Sin Resultados</h3>
                    <p>No se encontró un equivalente para el código ingresado.</p>
                    <p>Por favor, verifique el código e intente nuevamente.</p>
                    <button class="btn-new-search" onclick="location.reload()">Nueva Búsqueda</button>
                </div>
            `;
        }
        
        resultsContainer.html(html).show();
    }

    // Mostrar/Ocultar loader inline en el formulario
    function showInlineLoading(show) {
        const inline = $('.elimfilters-inline-results');
        if (!inline.length) return;
        const loader = inline.find('.results-loading');
        const resultsContainer = $('#elimfilters-results-content');
        if (show) {
            loader.show();
            resultsContainer.hide();
        } else {
            loader.hide();
        }
    }

    // Inyectar contenedor de resultados si la página es personalizada (Elementor/Gutenberg)
    function ensureResultsContainer(query) {
        if ($('#elimfilters-results-content').length) return;
        // Intentar ubicar un titular de "Search Results" para insertar justo debajo
        let anchor = null;
        const headings = Array.from(document.querySelectorAll('h1, h2, h3'));
        anchor = headings.find(h => /search results|resultados de búsqueda/i.test(h.textContent || '')) || null;

        // Si no existe, buscar contenedores comunes en temas/constructores
        const candidates = [
            '.entry-content', '.site-content', '#content', 'main',
            '.elementor-widget-container', '.elementor-section', '.container'
        ];
        let mount = anchor ? anchor : null;
        if (!mount) {
            for (const sel of candidates) {
                const el = document.querySelector(sel);
                if (el) { mount = el; break; }
            }
        }
        if (!mount) mount = document.body;

        const wrapper = document.createElement('div');
        wrapper.className = 'elimfilters-inline-results';
        wrapper.innerHTML = `
            <div class="results-loading">
                <div class="loading-spinner-large">
                    <svg class="spinner" width="32" height="32" viewBox="0 0 32 32">
                        <circle cx="16" cy="16" r="14" stroke="currentColor" stroke-width="2" fill="none" stroke-dasharray="40" stroke-dashoffset="40"/>
                    </svg>
                </div>
                <p>Buscando equivalente para: <strong>${escapeHtml(query || '')}</strong></p>
            </div>
            <div class="results-actions" style="margin: 12px 0; display:flex; gap:10px; align-items:center;">
                <a id="elimfilters-download-pdf" class="elimfilters-download-pdf btn" href="#" disabled>Descargar PDF</a>
                <span class="hint" style="font-size: 12px; color: #7f8c8d;">Se habilita al mostrar resultados</span>
            </div>
            <div id="elimfilters-results-content" class="results-content" style="display: none;"></div>
        `;

        // Insertar justo bajo el anchor si existe, sino al inicio del contenedor
        if (anchor && anchor.parentElement) {
            anchor.insertAdjacentElement('afterend', wrapper);
        } else if (mount && mount.firstChild) {
            mount.insertBefore(wrapper, mount.firstChild);
        } else {
            mount.appendChild(wrapper);
        }
    }
    
    /**
     * Funciones auxiliares
     */
    function showLoading(show) {
        if (show) {
            searchButton.addClass('loading');
            loadingSpinner.show();
            searchButton.find('.button-text').text('Buscando...');
        } else {
            searchButton.removeClass('loading');
            loadingSpinner.hide();
            searchButton.find('.button-text').text('Buscar');
        }
    }
    
    function showError(message) {
        errorContainer.html(`<p>${escapeHtml(message)}</p>`).show();
        setTimeout(hideError, 5000);
    }
    
    function hideError() {
        errorContainer.hide().empty();
    }
    
    function hideSuggestions() {
        suggestionsContainer.hide().empty();
    }
    
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Helper global para recuperar datos del PDF
    if (!window.getPDFData) {
        window.getPDFData = function() {
            try {
                const raw = sessionStorage.getItem('elimfilters_pdf_data');
                if (raw) return JSON.parse(raw);
            } catch (e) {}
            return window.elimfiltersPDFData || null;
        };
    }

    // Wiring del botón de PDF del servidor
    function buildServerPdfUrl(pdfData) {
        const query = (pdfData && (pdfData.sku || pdfData.original_query)) || '';
        if (!elimfilters_ajax || !elimfilters_ajax.ajax_url || !elimfilters_ajax.pdf_nonce || !query) return null;
        const url = `${elimfilters_ajax.ajax_url}?action=elimfilters_generate_pdf&nonce=${encodeURIComponent(elimfilters_ajax.pdf_nonce)}&query=${encodeURIComponent(query)}`;
        return url;
    }
    function setupServerPdfButton(pdfData) {
        const url = buildServerPdfUrl(pdfData);
        if (!url) return;
        const anchor = document.querySelector('#elimfilters-download-pdf, .elimfilters-download-pdf');
        if (anchor) {
            anchor.setAttribute('href', url);
            anchor.setAttribute('target', '_blank');
            anchor.removeAttribute('disabled');
        }
        const triggers = document.querySelectorAll('[data-pdf-server="true"]');
        triggers.forEach(el => {
            el.addEventListener('click', function(ev) {
                ev.preventDefault();
                window.open(url, '_blank');
            });
            el.removeAttribute('disabled');
        });
    }
    document.addEventListener('elimfilters:pdf-data-ready', function(ev) {
        const pdfData = (ev && ev.detail) ? ev.detail : window.getPDFData();
        setupServerPdfButton(pdfData);
    });
    setupServerPdfButton(window.getPDFData());
    
    /**
     * Si estamos en la página de resultados, realizar búsqueda automática
     */
    const resultsContainer = $('.elimfilters-results-container');
    if (resultsContainer.length) {
        const query = resultsContainer.data('query');
        if (query) {
            performSearch(query);
        }
    } else {
        const urlParams = new URLSearchParams(window.location.search);
        const urlQuery = urlParams.get('part');
        if (urlQuery) {
            ensureResultsContainer(urlQuery);
            performSearch(urlQuery);
        }
    }
});