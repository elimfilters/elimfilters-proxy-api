<?php
/**
 * Plugin Name: ELIMFILTERS Part Search Integration
 * Description: Integra la búsqueda de filtros con la API de ELIMFILTERS
 * Version: 1.0.0
 * Author: Tu Nombre
 * Text Domain: elimfilters-search
 */

// Evitar acceso directo
if (!defined('ABSPATH')) {
    exit;
}

// Definir constantes del plugin
define('ELIMFILTERS_API_URL', 'https://elimfilters-proxy-api-production.up.railway.app/api/detect-filter'); // URL de Railway (ajustada al dominio real del proyecto)
define('ELIMFILTERS_SEARCH_VERSION', '1.0.0');

/**
 * Clase principal del plugin
 */
class ELIMFILTERS_Search {
    
    private static $instance = null;
    
    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    
    private function __construct() {
        $this->init_hooks();
    }
    
    private function init_hooks() {
        // Registrar shortcodes
        add_shortcode('elimfilters_search_form', array($this, 'render_search_form'));
        add_shortcode('elimfilters_search_results', array($this, 'render_search_results'));
        
        // Registrar scripts y estilos
        add_action('wp_enqueue_scripts', array($this, 'enqueue_scripts'));
        
        // Registrar AJAX handlers
        add_action('wp_ajax_elimfilters_search', array($this, 'handle_ajax_search'));
        add_action('wp_ajax_nopriv_elimfilters_search', array($this, 'handle_ajax_search'));

        // Generación de PDF del lado servidor (seguro)
        add_action('wp_ajax_elimfilters_generate_pdf', array($this, 'handle_ajax_generate_pdf'));
        add_action('wp_ajax_nopriv_elimfilters_generate_pdf', array($this, 'handle_ajax_generate_pdf'));
        
        // Crear página de resultados al activar
        register_activation_hook(__FILE__, array($this, 'create_result_page'));
    }
    
    /**
     * Encolar scripts y estilos
     */
    public function enqueue_scripts() {
        wp_enqueue_script(
            'elimfilters-search',
            plugins_url('assets/search.js', __FILE__),
            array('jquery'),
            ELIMFILTERS_SEARCH_VERSION,
            true
        );
        
        wp_enqueue_style(
            'elimfilters-search',
            plugins_url('assets/search.css', __FILE__),
            array(),
            ELIMFILTERS_SEARCH_VERSION
        );
        
        // Obtener URL de la página de resultados (si existe)
        $results_page_id = get_option('elimfilters_results_page_id', 0);
        $results_page_url = $results_page_id ? get_permalink($results_page_id) : '';

        // Pasar variables de PHP a JavaScript
        wp_localize_script('elimfilters-search', 'elimfilters_ajax', array(
            'ajax_url' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('elimfilters_search_nonce'),
            'api_url' => ELIMFILTERS_API_URL,
            'results_page' => $results_page_url,
            'pdf_nonce' => wp_create_nonce('elimfilters_pdf_nonce')
        ));
    }
    
    /**
     * Renderizar formulario de búsqueda
     */
    public function render_search_form($atts = array()) {
        $atts = shortcode_atts(array(
            'placeholder' => 'Ingrese código OEM o Cross Reference...',
            'button_text' => 'Buscar',
            'show_loading' => 'true'
        ), $atts);
        
        ob_start();
        ?>
        <div class="elimfilters-search-container">
            <form id="elimfilters-search-form" class="elimfilters-search-form">
                <div class="search-input-wrapper">
                    <input 
                        type="text" 
                        id="elimfilters-search-input"
                        class="elimfilters-search-input"
                        placeholder="<?php echo esc_attr($atts['placeholder']); ?>"
                        required
                        autocomplete="off"
                    />
                    <button type="submit" class="elimfilters-search-button">
                        <span class="button-text"><?php echo esc_html($atts['button_text']); ?></span>
                        <?php if ($atts['show_loading'] === 'true'): ?>
                            <span class="loading-spinner" style="display: none;">
                                <svg class="spinner" width="16" height="16" viewBox="0 0 16 16">
                                    <circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1" fill="none" stroke-dasharray="20" stroke-dashoffset="20"/>
                                </svg>
                            </span>
                        <?php endif; ?>
                    </button>
                </div>
                <div id="elimfilters-search-suggestions" class="search-suggestions" style="display: none;"></div>
            </form>
            <div id="elimfilters-search-error" class="search-error" style="display: none;"></div>
        </div>
        <?php
        // Contenedor de resultados inline (fallback) para que no falle si no existe la página de resultados
        // Se mantiene oculto por defecto; el JS lo mostrará al recibir datos
        ?>
        <div class="elimfilters-inline-results">
            <div class="results-loading" style="display: none;">
                <div class="loading-spinner-large">
                    <svg class="spinner" width="32" height="32" viewBox="0 0 32 32">
                        <circle cx="16" cy="16" r="14" stroke="currentColor" stroke-width="2" fill="none" stroke-dasharray="40" stroke-dashoffset="40"/>
                    </svg>
                </div>
                <p>Buscando equivalente...</p>
            </div>
            <div id="elimfilters-results-content" class="results-content" style="display: none;"></div>
        </div>
        <?php
        return ob_get_clean();
    }
    
    /**
     * Renderizar resultados de búsqueda
     */
    public function render_search_results($atts = array()) {
        // Obtener el parámetro de búsqueda de la URL
        $search_query = isset($_GET['part']) ? sanitize_text_field($_GET['part']) : '';
        
        if (empty($search_query)) {
            return '<div class="elimfilters-no-results">Por favor, realice una búsqueda.</div>';
        }
        
        ob_start();
        ?>
        <div class="elimfilters-results-container" data-query="<?php echo esc_attr($search_query); ?>">
            <div class="results-loading">
                <div class="loading-spinner-large">
                    <svg class="spinner" width="32" height="32" viewBox="0 0 32 32">
                        <circle cx="16" cy="16" r="14" stroke="currentColor" stroke-width="2" fill="none" stroke-dasharray="40" stroke-dashoffset="40"/>
                    </svg>
                </div>
                <p>Buscando equivalente para: <strong><?php echo esc_html($search_query); ?></strong></p>
            </div>
            <div class="results-actions" style="margin: 12px 0; display:flex; gap:10px; align-items:center;">
                <a id="elimfilters-download-pdf" class="elimfilters-download-pdf btn" href="#" disabled>Descargar PDF</a>
                <span class="hint" style="font-size: 12px; color: #7f8c8d;">Se habilita al mostrar resultados</span>
            </div>
            <div id="elimfilters-results-content" class="results-content" style="display: none;"></div>
        </div>
        <?php
        return ob_get_clean();
    }

    /**
     * Generar PDF en servidor con datos de la API (no alterable por el cliente)
     */
    public function handle_ajax_generate_pdf() {
        // Verificar nonce para seguridad
        if (!isset($_REQUEST['nonce']) || !wp_verify_nonce($_REQUEST['nonce'], 'elimfilters_pdf_nonce')) {
            wp_die('Security check failed');
        }

        // Obtener query
        $query = isset($_REQUEST['query']) ? sanitize_text_field($_REQUEST['query']) : '';
        $query = substr($query, 0, 128);
        if (empty($query)) {
            wp_send_json_error(array('message' => 'Se requiere el código (OEM/Cross) para generar el PDF'));
        }

        // Llamar a la API externa para obtener datos frescos
        $request_args = array(
            'method' => 'POST',
            'headers' => array('Content-Type' => 'application/json'),
            'body' => wp_json_encode(array('query' => $query)),
            'timeout' => 20
        );
        $response = wp_remote_post(ELIMFILTERS_API_URL, $request_args);
        if (is_wp_error($response)) {
            wp_send_json_error(array('message' => 'Error obteniendo datos de la API', 'error' => $response->get_error_message()));
        }
        $body = wp_remote_retrieve_body($response);
        $api = json_decode($body, true);
        if (!is_array($api) || !isset($api['status']) || $api['status'] !== 'OK' || !isset($api['data'])) {
            wp_send_json_error(array('message' => 'Sin datos válidos para PDF'));
        }

        $result = $api['data'];

        // Helpers
        $to_list = function($value) {
            if (empty($value) || $value === 'N/A') return array();
            if (is_array($value)) return array_slice(array_filter(array_map('trim', array_map('strval', $value))), 0, 10);
            $parts = preg_split('/[,;\n]+/', strval($value));
            return array_slice(array_filter(array_map('trim', $parts)), 0, 10);
        };
        $dedup = function($arr) {
            $arr = array_map('strval', (array) $arr);
            $arr = array_map('trim', $arr);
            return array_values(array_unique(array_filter($arr)));
        };
        $is_valid = function($v) {
            return !(null === $v || $v === '' || $v === 'N/A' || $v === 0 || $v === '0');
        };

        $brandLine = (isset($result['cross_brand']) && $result['cross_brand'] !== 'N/A')
            ? trim(($result['cross_brand'] ?? '') . ' ' . ($result['cross_part_number'] ?? ''))
            : '';
        $crossRef = $dedup(array_merge($brandLine ? array($brandLine) : array(), $to_list($result['cross_reference'] ?? '')));
        $engineApps = $to_list($result['engine_applications'] ?? '');
        $equipApps = $to_list($result['equipment_applications'] ?? '');
        if (count($equipApps) === 0) $equipApps = $to_list($result['source'] ?? '');
        $oemCodes = $to_list(isset($result['oem_number']) ? $result['oem_number'] : ($result['oem_codes'] ?? ''));

        $fields = array(
            array('height_mm','Height (mm)'),
            array('outer_diameter_mm','Outer Diameter (mm)'),
            array('inner_diameter_mm','Inner Diameter (mm)'),
            array('thread_size','Thread Size'),
            array('length_mm','Length (mm)'),
            array('width_mm','Width (mm)'),
            array('micron_rating','Micron Rating (µm)'),
            array('efficiency_rating','Filtration Efficiency (%)'),
            array('media_type','Media Type'),
            array('hydrostatic_burst_psi','Burst Pressure (PSI)'),
            array('weight_grams','Weight (g)'),
            array('flow_rate','Flow Rate (L/min)'),
            array('gasket_included','Gasket Included'),
            array('bypass_valve','Bypass Valve'),
            array('anti_drainback_valve','Anti-Drainback Valve')
        );
        $specs = array();
        foreach ($fields as $f) {
            $key = $f[0]; $label = $f[1];
            $direct = isset($result[$key]) ? $result[$key] : null;
            $fallback = (isset($result['tech_specs']) && isset($result['tech_specs'][$key])) ? $result['tech_specs'][$key] : null;
            $val = $is_valid($direct) ? $direct : ($is_valid($fallback) ? $fallback : null);
            if ($is_valid($val)) $specs[$label] = trim(strval($val));
        }

        $canonical = array(
            'sku' => isset($result['sku']) ? $result['sku'] : ($result['original_query'] ?? ''),
            'family' => $result['family'] ?? 'Filter',
            'duty' => $result['duty'] ?? '',
            'description' => $result['description'] ?? '',
            'cross_reference' => $crossRef,
            'applications' => $dedup(array_merge($engineApps, $equipApps)),
            'tech_specs' => $specs,
            'oem_codes' => $oemCodes,
            'source' => $result['source'] ?? ''
        );

        // Requiere Dompdf
        if (!class_exists('Dompdf\\Dompdf')) {
            wp_send_json_error(array(
                'message' => 'Dompdf no está instalado en el servidor.',
                'hint' => 'Instala dompdf/dompdf y colócalo accesible para el plugin.'
            ));
        }

        // Generar HTML para el PDF (paleta del sitio)
        $brandPrimary = '#0073aa';
        $brandPrimaryDark = '#005177';
        ob_start();
        ?>
        <html><head><meta charset="utf-8"><style>
        body { font-family: DejaVu Sans, Arial, sans-serif; font-size: 12px; color: #2c3e50; }
        h1 { text-align: center; color: <?php echo $brandPrimary; ?>; margin: 0; }
        h2 { color: <?php echo $brandPrimary; ?>; margin-top: 20px; font-size: 16px; }
        .divider { border-top: 2px solid <?php echo $brandPrimary; ?>; margin: 10px 0 20px; }
        .label { font-weight: bold; width: 160px; display: inline-block; }
        .row { margin: 6px 0; }
        ul { margin: 6px 0; padding-left: 18px; }
        .footer { text-align: center; color: #7f8c8d; font-size: 10px; margin-top: 30px; }
        </style></head><body>
          <h1>ELIMFILTERS</h1>
          <h2 style="text-align:center;">Filter Technical Data Sheet</h2>
          <div class="divider"></div>
          <div class="row"><span class="label">SKU:</span><span><strong><?php echo esc_html($canonical['sku'] ?: 'N/A'); ?></strong></span></div>
          <div class="row"><span class="label">Filter Family:</span><span><?php echo esc_html($canonical['family'] ?: 'N/A'); ?></span></div>
          <div class="row"><span class="label">Application Type:</span><span><?php echo esc_html($canonical['duty'] ?: 'N/A'); ?></span></div>
          <div class="row"><span class="label">Manufacturer:</span><span><?php echo esc_html($canonical['source'] ?: 'N/A'); ?></span></div>
          <div class="row"><span class="label">OEM Number:</span><span><?php echo esc_html((count($canonical['oem_codes'])>0)?implode(', ',$canonical['oem_codes']):'N/A'); ?></span></div>
          <h2>Description</h2>
          <div><?php echo nl2br(esc_html($canonical['description'] ?: 'N/A')); ?></div>
          <?php if (!empty($canonical['cross_reference'])): ?>
            <h2>Cross Reference</h2>
            <ul>
              <?php foreach ($canonical['cross_reference'] as $cr): ?>
                <li><?php echo esc_html($cr); ?></li>
              <?php endforeach; ?>
            </ul>
          <?php endif; ?>
          <?php if (!empty($canonical['applications'])): ?>
            <h2>Applications</h2>
            <ul>
              <?php foreach ($canonical['applications'] as $app): ?>
                <li><?php echo esc_html($app); ?></li>
              <?php endforeach; ?>
            </ul>
          <?php endif; ?>
          <?php if (!empty($canonical['tech_specs'])): ?>
            <h2>Technical Specifications</h2>
            <ul>
              <?php foreach ($canonical['tech_specs'] as $label => $value): ?>
                <li><strong><?php echo esc_html($label); ?>:</strong> <?php echo esc_html($value); ?></li>
              <?php endforeach; ?>
            </ul>
          <?php endif; ?>
          <div class="footer">
            Generated by ELIMFILTERS Technical System<br>
            <?php echo esc_html(date('Y-m-d')); ?><br>
            www.elimfilters.com
          </div>
        </body></html>
        <?php
        $html = ob_get_clean();

        try {
            // Autoload de Composer si existe
            if (file_exists(__DIR__ . '/vendor/autoload.php')) {
                require_once __DIR__ . '/vendor/autoload.php';
            }
            $dompdf = new \Dompdf\Dompdf();
            $dompdf->loadHtml($html);
            $dompdf->setPaper('A4', 'portrait');
            $dompdf->render();
            $pdfOutput = $dompdf->output();

            $filename = 'ELIMFILTERS_' . preg_replace('/\s+/', '_', ($canonical['sku'] ?: 'filter')) . '_Technical_Sheet.pdf';
            header('Content-Type: application/pdf');
            header('Content-Disposition: attachment; filename="' . $filename . '"');
            header('Content-Length: ' . strlen($pdfOutput));
            echo $pdfOutput;
            exit;
        } catch (\Throwable $e) {
            wp_send_json_error(array('message' => 'Error generando PDF en servidor', 'error' => $e->getMessage()));
        }
    }
    
    /**
     * Manejar búsqueda AJAX
     */
    public function handle_ajax_search() {
        // Verificar nonce para seguridad
        if (!isset($_POST['nonce']) || !wp_verify_nonce($_POST['nonce'], 'elimfilters_search_nonce')) {
            wp_die('Security check failed');
        }
        
        $query = isset($_POST['query']) ? sanitize_text_field($_POST['query']) : '';
        // Validar longitud razonable del query
        $query = substr($query, 0, 128);
        
        if (empty($query)) {
            wp_send_json_error(array('message' => 'Por favor ingrese un código válido'));
        }
        
        // Llamar a la API externa
        $request_args = array(
            'method' => 'POST',
            'headers' => array(
                'Content-Type' => 'application/json',
            ),
            'body' => wp_json_encode(array('query' => $query)),
            'timeout' => 20
        );

        $response = wp_remote_post(ELIMFILTERS_API_URL, $request_args);
        
        // Reintento simple en caso de error de transporte o códigos 5xx
        if (is_wp_error($response) || (int) wp_remote_retrieve_response_code($response) >= 500) {
            // Esperar un breve instante antes de reintentar
            usleep(200000); // 200ms
            $response = wp_remote_post(ELIMFILTERS_API_URL, $request_args);
        }
        
        if (is_wp_error($response)) {
            wp_send_json_error(array('message' => 'Error al conectar con el servicio'));
        }
        
        $response_code = wp_remote_retrieve_response_code($response);
        $body = wp_remote_retrieve_body($response);
        $data = json_decode($body, true);
        if ($data === null) {
            $data = array('status' => 'ERROR', 'message' => 'Respuesta inválida del servicio');
        }
        
        if ($response_code !== 200) {
            wp_send_json_error(array(
                'message' => isset($data['message']) ? $data['message'] : 'Error en la búsqueda'
            ));
        }
        
        wp_send_json_success($data);
    }
    
    /**
     * Crear página de resultados al activar
     */
    public function create_result_page() {
        $page_title = 'Part Search Results';
        $page_slug = 'part-search';
        
        // Verificar si la página ya existe
        $page = get_page_by_path($page_slug);
        
        if (!$page) {
            $page_data = array(
                'post_title' => $page_title,
                'post_name' => $page_slug,
                'post_content' => '[elimfilters_search_results]',
                'post_status' => 'publish',
                'post_type' => 'page',
                'comment_status' => 'closed',
                'ping_status' => 'closed'
            );
            
            $page_id = wp_insert_post($page_data);
            
            if ($page_id) {
                update_option('elimfilters_results_page_id', $page_id);
            }
        }
    }
}

// Inicializar el plugin
ELIMFILTERS_Search::get_instance();