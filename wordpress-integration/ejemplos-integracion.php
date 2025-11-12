<?php
/**
 * Ejemplos de Integración - ELIMFILTERS Search
 * 
 * Este archivo contiene ejemplos de cómo integrar el buscador en diferentes
 * ubicaciones de tu tema WordPress.
 */

// =============================================================================
// EJEMPLO 1: Agregar al Header (functions.php)
// =============================================================================

add_action('wp_head', 'elimfilters_add_header_search');
function elimfilters_add_header_search() {
    // Solo mostrar en páginas públicas
    if (!is_admin()) {
        echo '<div class="header-search-container">';
        echo do_shortcode('[elimfilters_search_form placeholder="Buscar filtro..."]');
        echo '</div>';
    }
}

// =============================================================================
// EJEMPLO 2: Agregar al Menú Principal (functions.php)
// =============================================================================

add_filter('wp_nav_menu_items', 'elimfilters_add_menu_search', 10, 2);
function elimfilters_add_menu_search($items, $args) {
    // Ajusta 'primary' según el nombre de tu ubicación de menú
    if ($args->theme_location == 'primary') {
        $search_html = '<li class="menu-item elimfilters-menu-search">';
        $search_html .= do_shortcode('[elimfilters_search_form]');
        $search_html .= '</li>';
        
        // Agregar al final del menú
        $items .= $search_html;
        
        // O agregar al principio
        // $items = $search_html . $items;
    }
    return $items;
}

// =============================================================================
// EJEMPLO 3: Shortcode Personalizado para Header (functions.php)
// =============================================================================

function elimfilters_header_search_shortcode() {
    ob_start();
    ?>
    <div class="elimfilters-header-search">
        <div class="search-icon" onclick="toggleElimfiltersSearch()">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                <path d="M9 2a7 7 0 100 14 7 7 0 000-14zM2 9a7 7 0 1112.6 4.2l3.1 3.1a1 1 0 01-1.4 1.4l-3.1-3.1A7 7 0 012 9z"/>
            </svg>
        </div>
        <div id="elimfilters-search-dropdown" class="search-dropdown" style="display: none;">
            <?php echo do_shortcode('[elimfilters_search_form]'); ?>
        </div>
    </div>
    
    <script>
    function toggleElimfiltersSearch() {
        const dropdown = document.getElementById('elimfilters-search-dropdown');
        dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
    }
    
    // Cerrar al hacer clic fuera
    document.addEventListener('click', function(event) {
        const searchContainer = document.querySelector('.elimfilters-header-search');
        if (!searchContainer.contains(event.target)) {
            document.getElementById('elimfilters-search-dropdown').style.display = 'none';
        }
    });
    </script>
    
    <style>
    .elimfilters-header-search {
        position: relative;
        display: inline-block;
    }
    
    .search-icon {
        cursor: pointer;
        padding: 8px;
        border-radius: 4px;
        transition: background 0.3s ease;
    }
    
    .search-icon:hover {
        background: rgba(0,0,0,0.1);
    }
    
    .search-dropdown {
        position: absolute;
        top: 100%;
        right: 0;
        background: white;
        border: 1px solid #ddd;
        border-radius: 8px;
        padding: 20px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 1000;
        min-width: 300px;
        margin-top: 10px;
    }
    
    @media (max-width: 768px) {
        .search-dropdown {
            position: fixed;
            top: 60px;
            left: 10px;
            right: 10px;
            min-width: auto;
        }
    }
    </style>
    <?php
    return ob_get_clean();
}
add_shortcode('elimfilters_header_search', 'elimfilters_header_search_shortcode');

// =============================================================================
// EJEMPLO 4: Widget Personalizado (functions.php)
// =============================================================================

class ELIMFILTERS_Search_Widget extends WP_Widget {
    
    public function __construct() {
        parent::__construct(
            'elimfilters_search_widget',
            'ELIMFILTERS Search',
            array('description' => 'Widget de búsqueda de filtros ELIMFILTERS')
        );
    }
    
    public function widget($args, $instance) {
        echo $args['before_widget'];
        
        if (!empty($instance['title'])) {
            echo $args['before_title'] . apply_filters('widget_title', $instance['title']) . $args['after_title'];
        }
        
        // Personalizar el shortcode según las opciones del widget
        $shortcode_atts = array(
            'placeholder' => !empty($instance['placeholder']) ? $instance['placeholder'] : 'Buscar filtro...',
            'button_text' => !empty($instance['button_text']) ? $instance['button_text'] : 'Buscar'
        );
        
        echo do_shortcode('[elimfilters_search_form ' . http_build_query($shortcode_atts, '', ' ') . ']');
        
        echo $args['after_widget'];
    }
    
    public function form($instance) {
        $title = !empty($instance['title']) ? $instance['title'] : '';
        $placeholder = !empty($instance['placeholder']) ? $instance['placeholder'] : 'Buscar filtro...';
        $button_text = !empty($instance['button_text']) ? $instance['button_text'] : 'Buscar';
        ?>
        <p>
            <label for="<?php echo esc_attr($this->get_field_id('title')); ?>">Título:</label>
            <input class="widefat" id="<?php echo esc_attr($this->get_field_id('title')); ?>" 
                   name="<?php echo esc_attr($this->get_field_name('title')); ?>" 
                   type="text" value="<?php echo esc_attr($title); ?>">
        </p>
        <p>
            <label for="<?php echo esc_attr($this->get_field_id('placeholder')); ?>">Placeholder:</label>
            <input class="widefat" id="<?php echo esc_attr($this->get_field_id('placeholder')); ?>" 
                   name="<?php echo esc_attr($this->get_field_name('placeholder')); ?>" 
                   type="text" value="<?php echo esc_attr($placeholder); ?>">
        </p>
        <p>
            <label for="<?php echo esc_attr($this->get_field_id('button_text')); ?>">Texto del botón:</label>
            <input class="widefat" id="<?php echo esc_attr($this->get_field_id('button_text')); ?>" 
                   name="<?php echo esc_attr($this->get_field_name('button_text')); ?>" 
                   type="text" value="<?php echo esc_attr($button_text); ?>">
        </p>
        <?php
    }
    
    public function update($new_instance, $old_instance) {
        $instance = array();
        $instance['title'] = (!empty($new_instance['title'])) ? strip_tags($new_instance['title']) : '';
        $instance['placeholder'] = (!empty($new_instance['placeholder'])) ? strip_tags($new_instance['placeholder']) : '';
        $instance['button_text'] = (!empty($new_instance['button_text'])) ? strip_tags($new_instance['button_text']) : '';
        
        return $instance;
    }
}

// Registrar el widget
add_action('widgets_init', function() {
    register_widget('ELIMFILTERS_Search_Widget');
});

// =============================================================================
// EJEMPLO 5: Página de Búsqueda Avanzada (page template)
// =============================================================================

/**
 * Crea un archivo llamado 'template-advanced-search.php' en tu tema hijo
 * y agrega este código:
 */

/*
Template Name: Advanced Filter Search
Description: Página de búsqueda avanzada de filtros ELIMFILTERS
*/

get_header(); ?>

<div class="content-area">
    <main id="main" class="site-main">
        
        <div class="advanced-search-header">
            <h1>Búsqueda de Filtros</h1>
            <p>Encuentra el filtro ELIMFILTERS equivalente a tu código OEM o Cross Reference</p>
        </div>
        
        <div class="advanced-search-container">
            <div class="search-instructions">
                <h3>¿Cómo buscar?</h3>
                <ul>
                    <li>Ingresa el código OEM del fabricante original</li>
                    <li>O ingresa un código Cross Reference de Donaldson, FRAM, etc.</li>
                    <li>El sistema te mostrará el equivalente ELIMFILTERS</li>
                </ul>
            </div>
            
            <div class="search-form-wrapper">
                <?php echo do_shortcode('[elimfilters_search_form placeholder="Ej: P552100, CA10234, PH8A..."]'); ?>
            </div>
            
            <div class="search-examples">
                <h4>Ejemplos de códigos válidos:</h4>
                <div class="example-codes">
                    <span class="code-example">P552100</span>
                    <span class="code-example">CA10234</span>
                    <span class="code-example">PH8A</span>
                    <span class="code-example">P550949</span>
                    <span class="code-example">AF25667</span>
                </div>
            </div>
        </div>
        
        <div class="search-results-section">
            <?php echo do_shortcode('[elimfilters_search_results]'); ?>
        </div>
        
    </main>
</div>

<style>
.advanced-search-header {
    text-align: center;
    padding: 40px 20px;
    background: #f8f9fa;
    margin-bottom: 40px;
}

.advanced-search-header h1 {
    margin-bottom: 10px;
    color: #333;
}

.advanced-search-header p {
    color: #666;
    font-size: 18px;
}

.advanced-search-container {
    max-width: 800px;
    margin: 0 auto 40px;
    padding: 0 20px;
}

.search-instructions {
    background: #e3f2fd;
    padding: 25px;
    border-radius: 8px;
    margin-bottom: 30px;
}

.search-instructions h3 {
    margin-top: 0;
    color: #1976d2;
}

.search-instructions ul {
    margin: 0;
    padding-left: 20px;
}

.search-instructions li {
    margin-bottom: 8px;
    color: #555;
}

.search-form-wrapper {
    margin-bottom: 30px;
}

.search-examples {
    text-align: center;
}

.search-examples h4 {
    margin-bottom: 15px;
    color: #333;
}

.example-codes {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    justify-content: center;
}

.code-example {
    background: #f0f0f0;
    padding: 8px 12px;
    border-radius: 4px;
    font-family: monospace;
    font-size: 14px;
    color: #555;
}

.search-results-section {
    max-width: 1000px;
    margin: 0 auto;
    padding: 0 20px;
}
</style>

<?php get_footer(); ?>

// =============================================================================
// EJEMPLO 6: Shortcode con múltiples formas de búsqueda
// =============================================================================

function elimfilters_multi_search_shortcode($atts) {
    $atts = shortcode_atts(array(
        'style' => 'horizontal', // horizontal, vertical, minimal
        'show_examples' => 'true',
        'show_history' => 'false'
    ), $atts);
    
    ob_start();
    ?>
    <div class="elimfilters-multi-search style-<?php echo esc_attr($atts['style']); ?>">
        
        <?php if ($atts['style'] === 'vertical'): ?>
            <div class="search-sidebar">
                <h3>Buscar Filtro</h3>
                <?php echo do_shortcode('[elimfilters_search_form]'); ?>
            </div>
            <div class="search-main">
                <?php echo do_shortcode('[elimfilters_search_results]'); ?>
            </div>
        <?php else: ?>
            <?php echo do_shortcode('[elimfilters_search_form]'); ?>
            <?php echo do_shortcode('[elimfilters_search_results]'); ?>
        <?php endif; ?>
        
        <?php if ($atts['show_examples'] === 'true'): ?>
            <div class="search-examples-expanded">
                <h4>Códigos populares:</h4>
                <div class="example-grid">
                    <button class="example-btn" onclick="quickSearch('P552100')">P552100</button>
                    <button class="example-btn" onclick="quickSearch('CA10234')">CA10234</button>
                    <button class="example-btn" onclick="quickSearch('PH8A')">PH8A</button>
                    <button class="example-btn" onclick="quickSearch('P550949')">P550949</button>
                </div>
            </div>
        <?php endif; ?>
        
        <?php if ($atts['show_history'] === 'true' && isset($_COOKIE['elimfilters_search_history'])): ?>
            <div class="search-history">
                <h4>Búsquedas recientes:</h4>
                <div class="history-items">
                    <?php
                    $history = json_decode(stripslashes($_COOKIE['elimfilters_search_history']), true);
                    if (is_array($history)) {
                        foreach (array_slice($history, 0, 5) as $item) {
                            echo '<button class="history-btn" onclick="quickSearch(\'' . esc_attr($item) . '\')">' . esc_html($item) . '</button>';
                        }
                    }
                    ?>
                </div>
            </div>
        <?php endif; ?>
        
    </div>
    
    <script>
    function quickSearch(code) {
        const input = document.querySelector('#elimfilters-search-input');
        if (input) {
            input.value = code;
            input.form.dispatchEvent(new Event('submit'));
        }
    }
    </script>
    
    <style>
    .elimfilters-multi-search {
        margin: 20px 0;
    }
    
    .style-vertical {
        display: flex;
        gap: 30px;
    }
    
    .search-sidebar {
        flex: 0 0 300px;
    }
    
    .search-main {
        flex: 1;
    }
    
    .search-examples-expanded,
    .search-history {
        margin-top: 30px;
        padding: 20px;
        background: #f8f9fa;
        border-radius: 8px;
    }
    
    .example-grid,
    .history-items {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-top: 15px;
    }
    
    .example-btn,
    .history-btn {
        padding: 8px 16px;
        background: white;
        border: 1px solid #ddd;
        border-radius: 4px;
        cursor: pointer;
        transition: all 0.3s ease;
        font-size: 14px;
    }
    
    .example-btn:hover,
    .history-btn:hover {
        background: #0073aa;
        color: white;
        border-color: #0073aa;
    }
    
    @media (max-width: 768px) {
        .style-vertical {
            flex-direction: column;
        }
        
        .search-sidebar {
            flex: none;
        }
    }
    </style>
    
    <?php
    return ob_get_clean();
}
add_shortcode('elimfilters_multi_search', 'elimfilters_multi_search_shortcode');

// =============================================================================
// USO DE LOS SHORTCODES
// =============================================================================

/**
 * Shortcode básico:
 * [elimfilters_search_form]
 * [elimfilters_search_results]
 * 
 * Shortcode del header (con ícono desplegable):
 * [elimfilters_header_search]
 * 
 * Shortcode de búsqueda múltiple:
 * [elimfilters_multi_search style="horizontal" show_examples="true" show_history="true"]
 * 
 * Opciones de estilo: horizontal, vertical, minimal
 * show_examples: true/false
 * show_history: true/false (requiere cookies habilitadas)
 */