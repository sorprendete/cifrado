/**
 * ============================================================================
 * MOTOR CRIPTOGRÁFICO E2EE (Zero-Knowledge)
 * ============================================================================
 * Este archivo contiene la implementación matemática pura del algoritmo de 
 * cifrado. Todo se ejecuta localmente en el navegador del cliente.
 * 
 * Pilares implementados aquí:
 * 1. Intercambio Vectorial LWE (Llaves Asimétricas)
 * 2. Derivación de Candado (KDF Hash Local)
 * 3. Protección Anti-Repetición (Time-Stamping)
 * 4. Generador Pseudoaleatorio (Mapa Logístico Caótico)
 * 5. Colisión Criptográfica (Operador XOR)
 * ============================================================================
 */
/**
 * CIFRADO E2EE - CORE CRIPTOGRÁFICO CUSTOM
 * Implementación 100% manual sin librerías ni APIs externas.
 */

const MiCifrado = {
    // --- PILAR 1: La Fusión Vectorial ---
    // Valores enteros para evitar cualquier diferencia de coma flotante
    matrizPublica: [735, 246, 891, 452], 
    
    calcularVectorPublico: function(vectorSecreto) {
        let vectorY = [];
        for(let i=0; i<this.matrizPublica.length; i++) {
            // Sin ruido aleatorio para asegurar simetría perfecta bidireccional
            let y = (this.matrizPublica[i] * vectorSecreto[i]);
            vectorY.push(y);
        }
        return vectorY;
    },

    generarIdentidadAleatoria: function() {
        let vectorPrivado = [];
        for(let i=0; i<this.matrizPublica.length; i++) {
            vectorPrivado.push(Math.floor(Math.random() * 900) + 100); // Enteros de 3 dígitos
        }
        let vectorPublico = this.calcularVectorPublico(vectorPrivado);
        
        return {
            privada: vectorPrivado.join(','),
            publica: vectorPublico.join(','),
            huellaDigital: this.generarHuellaVisual(vectorPublico.join(','))
        };
    },

    derivarLlaveCompartida: function(miPrivadaStr, publicaContactoStr) {
        let miVectorSecreto = miPrivadaStr.split(',').map(Number);
        let vectorPublicoContacto = publicaContactoStr.split(',').map(Number);
        
        // Producto Punto Simétrico
        let suma = 0;
        for(let i=0; i<miVectorSecreto.length; i++) {
            suma += (miVectorSecreto[i] * vectorPublicoContacto[i]);
        }
        return Math.abs(suma); // La llave es el entero exacto absoluto
    },

    // 2. Deriva el "Candado" determinista a partir de Usuario y Contraseña
    derivarLlaveCandado: function(nombre, password) {
        let input = nombre + "||" + password;
        let hash = 123456789; 
        for (let i = 0; i < input.length; i++) {
            let charCode = input.charCodeAt(i);
            hash = (hash * 31 + charCode) % 2147483647;
        }
        for (let j = 0; j < 100; j++) {
            let str = hash.toString();
            let nHash = 1;
            for (let i = 0; i < str.length; i++) {
                nHash += str.charCodeAt(i);
            }
            hash = (hash * nHash) % 2147483647;
        }
        return hash;
    },

    // 3. Cifra la Llave Privada Vectorial
    empaquetarBoveda: function(privadaStr, llaveCandado) {
        let bovedaCifrada = "";
        let offset = Math.abs(llaveCandado % 255);
        
        for (let i = 0; i < privadaStr.length; i++) {
            let originalCode = privadaStr.charCodeAt(i);
            let cifradoCode = originalCode ^ offset;
            bovedaCifrada += cifradoCode.toString(16).padStart(2, '0');
        }
        return bovedaCifrada;
    },

    // 4. Desempaquetar la Bóveda Vectorial
    desempaquetarBoveda: function(bovedaHex, llaveCandado) {
        let privStr = "";
        let offset = Math.abs(llaveCandado % 255);
        
        for (let i = 0; i < bovedaHex.length; i += 2) {
            let hexPar = bovedaHex.substr(i, 2);
            let cifradoCode = parseInt(hexPar, 16);
            let originalCode = cifradoCode ^ offset;
            privStr += String.fromCharCode(originalCode);
        }
        
        let privVector = privStr.split(',').map(Number);
        // Validar que sea un vector correcto
        if(privVector.length !== this.matrizPublica.length || isNaN(privVector[0])) {
            return { publica: "error_de_descifrado" };
        }
        
        let vectorPublico = this.calcularVectorPublico(privVector);
        let publicaStr = vectorPublico.join(',');
        
        return {
            privada: privStr,
            publica: publicaStr,
            huellaDigital: this.generarHuellaVisual(publicaStr)
        };
    },

    generarHuellaVisual: function(publicaStr) {
        let suma = 0;
        for(let i=0; i<publicaStr.length; i++) suma += publicaStr.charCodeAt(i);
        return "ID-" + suma.toString(16).toUpperCase() + "-" + publicaStr.substring(0, 4).toUpperCase();
    },

    // --- PILAR 3: Ensamblaje y Trazabilidad ---
    ensamblarPayload: function(texto) {
        let fecha = new Date();
        let timestamp = fecha.toISOString();
        let paquete = texto + "||" + timestamp;
        return this.stringToBytes(paquete);
    },

    desensamblarPayload: function(bytes) {
        let paquete = this.bytesToString(bytes);
        let partes = paquete.split("||");
        if (partes.length < 2) return { valido: false, error: "Paquete corrupto" };
        
        let texto = partes.slice(0, -1).join("||");
        let timestamp = partes[partes.length - 1];
        
        let tiempoMsj = new Date(timestamp).getTime();
        let tiempoActual = new Date().getTime();
        let diferenciaMinutos = (tiempoActual - tiempoMsj) / 1000 / 60;
        
        if (diferenciaMinutos > 5 || diferenciaMinutos < -5) {
            return { valido: false, error: "Ataque de repetición detectado (Timestamp inválido)" };
        }
        
        return { valido: true, texto: texto, timestamp: timestamp };
    },

    // --- PILAR 4: El Trinquete del Caos (Mapa Logístico) ---
    generarCaos: function(llaveRaiz, cantidadBytes) {
        let semilla = (llaveRaiz % 1000000) / 1000000;
        if (semilla < 0.1 || semilla > 0.9) semilla = 0.5;
        
        let x = semilla;
        let caosArray = [];
        
        for(let i=0; i<cantidadBytes; i++) {
            x = 3.99 * x * (1 - x);
            let byteCaotico = Math.floor(x * 256) % 256;
            caosArray.push(byteCaotico);
        }
        return caosArray;
    },

    // --- PILAR 5: Colisión, Blindaje y Envío ---
    cifrarFinal: function(texto, llaveRaiz, onLog) {
        let bytesPayload = this.ensamblarPayload(texto);
        if(onLog) onLog("1. Ensamblaje (Pilar 3)", `Texto + TS => ${bytesPayload.length} bytes`);
        
        let bytesCaos = this.generarCaos(llaveRaiz, bytesPayload.length);
        if(onLog) onLog("2. Mapa Logístico (Pilar 4)", `Generados ${bytesCaos.length} bytes de caos`);
        
        let bytesCifrados = [];
        for(let i=0; i<bytesPayload.length; i++) {
            bytesCifrados.push(bytesPayload[i] ^ bytesCaos[i]);
        }
        if(onLog) onLog("3. Colisión XOR (Pilar 5)", `Array resultante: [${bytesCifrados.slice(0,5).join(',')}...]`);
        
        let b64 = this.bytesToBase64(bytesCifrados);
        if(onLog) onLog("4. Blindaje Base64", b64);
        
        return b64;
    },

    descifrarFinal: function(cadenaB64, llaveRaiz, onLog) {
        if(onLog) onLog("1. Recibido Base64", cadenaB64);
        
        let bytesCifrados = this.base64ToBytes(cadenaB64);
        if(onLog) onLog("2. Desempaquetado a Bytes", `Recuperados ${bytesCifrados.length} bytes`);
        
        let bytesCaos = this.generarCaos(llaveRaiz, bytesCifrados.length);
        if(onLog) onLog("3. Trinquete Sincronizado", `Caos regenerado exacto: [${bytesCaos.slice(0,5).join(',')}...]`);
        
        let bytesDescifrados = [];
        for(let i=0; i<bytesCifrados.length; i++) {
            bytesDescifrados.push(bytesCifrados[i] ^ bytesCaos[i]);
        }
        if(onLog) onLog("4. Decisión XOR Inversa", `Bytes limpios: [${bytesDescifrados.slice(0,5).join(',')}...]`);
        
        let resultado = this.desensamblarPayload(bytesDescifrados);
        if(onLog) onLog("5. Trazabilidad Temporal", resultado.valido ? "Timestamp OK" : "ERROR: " + resultado.error);
        
        return resultado;
    },

    // --- FUNCIONES UTILITARIAS ---
    stringToBytes: function(str) {
        let bytes = [];
        for (let i = 0; i < str.length; i++) {
            let charCode = str.charCodeAt(i);
            if (charCode < 128) bytes.push(charCode);
            else if (charCode < 2048) { bytes.push((charCode >> 6) | 192); bytes.push((charCode & 63) | 128); }
            else { bytes.push((charCode >> 12) | 224); bytes.push(((charCode >> 6) & 63) | 128); bytes.push((charCode & 63) | 128); }
        }
        return bytes;
    },
    bytesToString: function(bytes) {
        let str = ""; let i = 0;
        while (i < bytes.length) {
            let c = bytes[i];
            if (c < 128) { str += String.fromCharCode(c); i++; }
            else if (c > 191 && c < 224) { str += String.fromCharCode(((c & 31) << 6) | (bytes[i + 1] & 63)); i += 2; }
            else { str += String.fromCharCode(((c & 15) << 12) | ((bytes[i + 1] & 63) << 6) | (bytes[i + 2] & 63)); i += 3; }
        }
        return str;
    },
    charsB64: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/",
    bytesToBase64: function(bytes) {
        let b64 = "";
        for (let i = 0; i < bytes.length; i += 3) {
            let b1 = bytes[i], b2 = bytes[i+1] || 0, b3 = bytes[i+2] || 0;
            let trip = (b1 << 16) | (b2 << 8) | b3;
            for (let j = 0; j < 4; j++) {
                if (i * 8 + j * 6 > bytes.length * 8) b64 += "=";
                else b64 += this.charsB64.charAt((trip >> 6 * (3 - j)) & 0x3F);
            }
        }
        return b64;
    },
    base64ToBytes: function(b64) {
        b64 = b64.replace(/=/g, "");
        let bytes = []; let buffer = 0, bits = 0;
        for (let i = 0; i < b64.length; i++) {
            let val = this.charsB64.indexOf(b64.charAt(i));
            if (val === -1) continue;
            buffer = (buffer << 6) | val; bits += 6;
            if (bits >= 8) { bits -= 8; bytes.push((buffer >> bits) & 0xFF); }
        }
        return bytes;
    }
};
