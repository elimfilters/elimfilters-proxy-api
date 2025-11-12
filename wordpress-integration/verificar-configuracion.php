<?php
/**
 * Script de Verificación - ELIMFILTERS Integration
 * 
 * Este script te ayuda a verificar que tu configuración esté correcta
 * antes de implementar la integración en WordPress.
 */

// Configuración - ACTUALIZA ESTOS VALORES
$api_url = 'https://elimfilters-proxy-api-production.up.railway.app/api/detect-filter'; // URL correcta de la API en producción
$test_query = 'P552100'; // Código de prueba
$wordpress_domain = 'elimfilters.com'; // Dominio WordPress real

// =============================================================================
// NO EDITAR DEBAJO DE ESTA LÍNEA
// =============================================================================

echo "=== VERIFICACIÓN DE CONFIGURACIÓN ELIMFILTERS ===\n\n";

// 1. Verificar conexión con la API
echo "1. Verificando conexión con la API...\n";
$ch = curl_init($api_url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode(['query' => $test_query]));
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Content-Type: application/json',
    'Origin: https://' . $wordpress_domain
]);
curl_setopt($ch, CURLOPT_TIMEOUT, 30);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false); // Solo para pruebas

$response = curl_exec($ch);
$http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$error = curl_error($ch);
curl_close($ch);

if ($error) {
    echo "❌ Error de conexión: $error\n";
} elseif ($http_code === 200) {
    echo "✅ Conexión exitosa (HTTP 200)\n";
    $data = json_decode($response, true);
    if (isset($data['status']) && $data['status'] === 'OK') {
        echo "✅ Respuesta válida recibida\n";
        echo "   - SKU: " . ($data['data']['sku'] ?? 'N/A') . "\n";
        echo "   - Origen: " . ($data['source'] ?? 'N/A') . "\n";
        echo "   - Tiempo: " . ($data['response_time_ms'] ?? 'N/A') . "ms\n";
    } else {
        echo "⚠️  Respuesta recibida pero con errores:\n";
        echo "   Respuesta: " . substr($response, 0, 200) . "...\n";
    }
} else {
    echo "❌ Error HTTP: $http_code\n";
    echo "   Respuesta: " . substr($response, 0, 200) . "...\n";
}

echo "\n";

// 2. Verificar CORS
echo "2. Verificando configuración CORS...\n";
$ch = curl_init($api_url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode(['query' => $test_query]));
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Content-Type: application/json',
    'Origin: https://' . $wordpress_domain
]);
curl_setopt($ch, CURLOPT_HEADER, true);
curl_setopt($ch, CURLOPT_TIMEOUT, 30);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);

$response = curl_exec($ch);
$http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if (strpos($response, 'Access-Control-Allow-Origin:') !== false) {
    echo "✅ Headers CORS detectados\n";
    preg_match('/Access-Control-Allow-Origin: (.*)/', $response, $matches);
    if (isset($matches[1])) {
        echo "   Dominio permitido: " . trim($matches[1]) . "\n";
        if (trim($matches[1]) === '*' || strpos($matches[1], $wordpress_domain) !== false) {
            echo "✅ Tu dominio está permitido\n";
        } else {
            echo "❌ Tu dominio NO está permitido\n";
            echo "   Necesitas agregar '$wordpress_domain' a la configuración CORS\n";
        }
    }
} else {
    echo "⚠️  No se detectaron headers CORS\n";
    echo "   Esto puede causar problemas de seguridad en el navegador\n";
}

echo "\n";

// 3. Verificar endpoint de salud
echo "3. Verificando endpoint de salud...\n";
$health_url = str_replace('/api/detect-filter', '/health', $api_url);
$ch = curl_init($health_url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_TIMEOUT, 10);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);

$response = curl_exec($ch);
$http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($http_code === 200) {
    echo "✅ Endpoint de salud funcionando\n";
    $data = json_decode($response, true);
    if (isset($data['status']) && $data['status'] === 'ok') {
        echo "   - Servicio: " . ($data['service'] ?? 'N/A') . "\n";
        echo "   - Versión: " . ($data['version'] ?? 'N/A') . "\n";
        echo "   - WordPress Ready: " . ($data['features']['wordpress_ready'] ?? 'N/A') . "\n";
        echo "   - Google Sheets: " . ($data['features']['google_sheets'] ?? 'N/A') . "\n";
    }
} else {
    echo "❌ Endpoint de salud no responde (HTTP $http_code)\n";
}

echo "\n";

// 4. Verificar configuración de WordPress
echo "4. Verificando configuración de WordPress...\n";
echo "   Dominio WordPress: $wordpress_domain\n";
echo "   URL de la API: $api_url\n";
echo "   Código de prueba: $test_query\n";

echo "\n";

// 5. Recomendaciones
echo "5. Recomendaciones finales:\n";
echo "   📋 Verifica que tu dominio esté en la lista CORS del servidor\n";
echo "   🔒 Asegúrate de usar HTTPS en ambos sitios\n";
echo "   📱 Prueba en dispositivos móviles\n";
echo "   🧪 Realiza pruebas con diferentes códigos OEM\n";
echo "   📊 Monitorea los tiempos de respuesta\n";

echo "\n=== FIN DE VERIFICACIÓN ===\n";

// =============================================================================
// FUNCIONES AUXILIARES PARA WORDPRESS
// =============================================================================

/**
 * Función para agregar tu dominio a CORS (server.js)
 * Agrega esto a tu server.js:
 */
function get_cors_update_code() {
    return <<<'JS'
// En server.js, actualiza esta línea:
const allowedOrigins = [
  'https://elimfilters.com',
  'https://www.elimfilters.com',
  'https://TU-DOMINIO-WORDPRESS.com'  // <-- Agrega tu dominio aquí
];
JS;
}

/**
 * Código para functions.php de WordPress
 */
function get_wordpress_functions_code() {
    return <<<'PHP'
// Agrega esto a functions.php de tu tema hijo

// 1. Agregar buscador al header
add_action('wp_head', function() {
    if (!is_admin()) {
        echo '<div class="header-search">' . do_shortcode('[elimfilters_search_form]') . '</div>';
    }
});

// 2. Agregar al menú principal
add_filter('wp_nav_menu_items', function($items) {
    return $items . '<li class="menu-search-item">' . do_shortcode('[elimfilters_search_form]') . '</li>';
});

// 3. Personalizar estilos
add_action('wp_head', function() {
    ?>
    <style>
    .header-search {
        float: right;
        margin: 10px;
    }
    .menu-search-item {
        list-style: none;
    }
    </style>
    <?php
});
PHP;
}

echo "\n📋 CÓDIGO PARA ACTUALIZAR CORS:\n";
echo get_cors_update_code();
echo "\n📋 CÓDIGO PARA WORDPRESS:\n";
echo get_wordpress_functions_code();