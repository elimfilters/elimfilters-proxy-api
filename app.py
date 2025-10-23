from flask import Flask, request, jsonify
from datetime import datetime

app = Flask(__name__)

def extraer_ultimos_4_digitos(codigo):
    """Extrae los últimos 4 dígitos numéricos de un código"""
    if not codigo:
        return '0000'
    digitos = ''.join(c for c in str(codigo) if c.isdigit())
    ultimos_4 = digitos[-4:] if len(digitos) >= 4 else digitos.zfill(4)
    return ultimos_4

@app.route('/sku', methods=['POST'])
def generar_sku():
    """
    Genera SKU desde código OEM
    
    Request JSON:
    {
        "oem_code": "21707132",
        "duty": "HD",
        "fabricante": "DONALDSON" (opcional)
    }
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({
                "error": "No JSON data provided",
                "status": "error"
            }), 400
        
        oem_code = data.get('oem_code')
        duty = data.get('duty', 'HD').upper()
        fabricante = data.get('fabricante', 'OEM').upper()
        
        if not oem_code:
            return jsonify({
                "error": "oem_code is required",
                "status": "error"
            }), 400
        
        # LÓGICA HD/LD
        codigo_final = oem_code
        fabricante_final = fabricante
        
        if duty in ['HD', 'DIESEL', 'HEAVY DUTY']:
            if fabricante == 'DONALDSON':
                prefijo = 'EL'
                fabricante_final = 'DONALDSON'
            else:
                prefijo = 'EL'
                fabricante_final = 'OEM'
        
        elif duty in ['LD', 'GASOLINA', 'LIGHT DUTY']:
            if fabricante == 'FRAM':
                prefijo = 'EH'
                fabricante_final = 'FRAM'
            else:
                prefijo = 'EM'
                fabricante_final = 'OEM'
        
        else:
            prefijo = 'EL'
            fabricante_final = 'UNKNOWN'
            duty = 'UNKNOWN'
        
        # Generar SKU
        ultimos_4 = extraer_ultimos_4_digitos(codigo_final)
        sku = f"{prefijo}{ultimos_4}"
        
        # Retornar resultado
        return jsonify({
            "SKU": sku,
            "SKU_PREFIJO": prefijo,
            "SKU_DIGITOS": ultimos_4,
            "OEM_CODE": oem_code,
            "DUTY": duty,
            "FABRICANTE": fabricante_final,
            "TIMESTAMP": datetime.utcnow().isoformat(),
            "VALIDO": len(sku) == 8,
            "status": "success"
        }), 200
    
    except Exception as e:
        return jsonify({
            "error": str(e),
            "status": "error"
        }), 500

@app.route('/health', methods=['GET'])
def health():
    """Endpoint de health check"""
    return jsonify({
        "status": "ok",
        "timestamp": datetime.utcnow().isoformat()
    }), 200

@app.route('/', methods=['GET'])
def index():
    """Información de la API"""
    return jsonify({
        "name": "SKU Generator API",
        "version": "1.0.0",
        "endpoints": {
            "POST /sku": "Generate SKU from OEM code",
            "GET /health": "Health check"
        },
        "example": {
            "url": "POST /sku",
            "body": {
                "oem_code": "21707132",
                "duty": "HD",
                "fabricante": "OEM"
            }
        }
    }), 200

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)
